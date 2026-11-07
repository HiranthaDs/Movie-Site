import React,{useState,useEffect,useRef} from 'react';
import {Link,NavLink,useLocation} from 'react-router-dom';
import {Search,Heart,Film,Tv,Compass,House,Menu,X,ArrowUpRight,Play,Clapperboard,Download,CheckCircle2,Share2,Gamepad2} from 'lucide-react';
import {useStore} from '../lib/store';
import {usePwaInstall} from '../lib/pwa';
import {shouldHideWatchHeader} from '../lib/headerVisibility';
import SmartSearch from './SmartSearch';
import {ConnectionNotice,ToastViewport} from './AppFeedback';
import RouteEffects from './RouteEffects';

const links=[
  {to:'/',label:'Home',caption:'Featured stories',icon:House},
  {to:'/movies',label:'Movies',caption:'Explore the catalog',icon:Film},
  {to:'/series',label:'TV series',caption:'Stories worth staying for',icon:Tv},
  {to:'/discover',label:'Discover',caption:'Filter by your mood',icon:Compass},
  {to:'/watchlist',label:'My list',caption:'Saved for later',icon:Heart},
];

function SiteHeader(){
  const location=useLocation();const {saved}=useStore();
  const [searchOpen,setSearchOpen]=useState(false),[menuOpen,setMenuOpen]=useState(false),[scrolled,setScrolled]=useState(false),[watchHeaderHidden,setWatchHeaderHidden]=useState(false);
  const [installNote,setInstallNote]=useState('');
  const {canInstall,installed,isiOS,install}=usePwaInstall();
  const searchDialog=useRef(null),searchTrigger=useRef(null),menuTrigger=useRef(null);
  useEffect(()=>{const update=()=>{setScrolled(window.scrollY>22);setWatchHeaderHidden(shouldHideWatchHeader(location.pathname,window.scrollY));};update();window.addEventListener('scroll',update,{passive:true});return()=>window.removeEventListener('scroll',update);},[location.pathname]);
  useEffect(()=>{setMenuOpen(false);setSearchOpen(false);},[location.pathname,location.search]);
  useEffect(()=>{
    const shortcut=event=>{
      const typing=event.target?.closest?.('input,textarea,select,[contenteditable="true"]');
      const command=(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k';
      const slash=event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!location.pathname.startsWith('/watch/');
      if(event.defaultPrevented||event.repeat||event.isComposing||typing||(!command&&!slash)||document.querySelector('[role="dialog"]'))return;
      event.preventDefault();setMenuOpen(false);setSearchOpen(true);
    };
    window.addEventListener('keydown',shortcut);
    return()=>window.removeEventListener('keydown',shortcut);
  },[location.pathname]);
  useEffect(()=>{document.body.classList.toggle('menu-is-open',menuOpen||searchOpen);return()=>document.body.classList.remove('menu-is-open');},[menuOpen,searchOpen]);
  useEffect(()=>{
    if(!searchOpen&&!menuOpen)return;
    const panel=searchOpen?searchDialog.current:document.getElementById('main-menu');
    const background=[...document.querySelectorAll('main,.site-footer,.mobile-bottom-nav')];
    background.forEach(element=>{element.inert=true;});
    if(menuOpen)panel.querySelector('a')?.focus();
    const keydown=event=>{
      if(event.key==='Escape'){setSearchOpen(false);setMenuOpen(false);(searchOpen?searchTrigger:menuTrigger).current?.focus();}
      if(event.key==='Tab'){
        const nodes=[...(menuOpen?[menuTrigger.current]:[]),...panel.querySelectorAll('button:not([disabled]):not([tabindex="-1"]),a,input,select')].filter(node=>node&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden'&&getComputedStyle(node).display!=='none');
        const first=nodes[0],last=nodes[nodes.length-1];
        if(!nodes.includes(document.activeElement)){event.preventDefault();(event.shiftKey?last:first)?.focus();}
        else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    window.addEventListener('keydown',keydown);
    return()=>{background.forEach(element=>{element.inert=false;});window.removeEventListener('keydown',keydown);};
  },[searchOpen,menuOpen]);
  const closeSearch=()=>{setSearchOpen(false);searchTrigger.current?.focus();};
  const handleInstall=async()=>{
    if(installed)return;
    if(canInstall){
      const result=await install();
      setInstallNote(result.outcome==='accepted'?'Cinera is being added to this device.':'Installation was dismissed. You can try again from the browser menu.');
      return;
    }
    setInstallNote(isiOS?'Tap Share, then choose “Add to Home Screen”.':'Open your browser menu and choose “Install app” or “Add to Home screen”.');
  };
  return <>
    <header className={`site-header ${scrolled?'header-scrolled':''} ${watchHeaderHidden&&!menuOpen&&!searchOpen?'header-watch-hidden':''}`} id="top"><div className="header-inner">
      <Link to="/" className="brand" aria-label="Cinera home"><span className="brand-mark"><Play size={18} fill="currentColor"/></span><span className="brand-word">CINERA</span></Link>
      <div className="header-center"><span className="live-dot"/> CINEMA · EVERYWHERE</div>
      <div className="header-actions">
        <button ref={searchTrigger} className="header-search-trigger" aria-label="Search the catalog" title="Search (Ctrl / ⌘ K)" aria-keyshortcuts="Control+k Meta+k /" aria-expanded={searchOpen} aria-controls="catalog-search" onClick={()=>{setMenuOpen(false);setSearchOpen(value=>!value);}}>{searchOpen?<X size={21}/>:<Search size={21}/>}</button>
        <Link to="/pair" className="remote-pair-link" aria-label="Pair phone remote"><Gamepad2 size={19}/><span>Remote</span></Link>
        <Link to="/discover" className="header-cta">Find a movie <ArrowUpRight size={17}/></Link>
        <button ref={menuTrigger} className="menu-toggle" onClick={()=>{setSearchOpen(false);setMenuOpen(value=>!value);}} aria-label={menuOpen?'Close navigation menu':'Open navigation menu'} aria-expanded={menuOpen} aria-controls="main-menu"><strong>{menuOpen?'CLOSE':'MENU'}</strong>{menuOpen?<X size={25}/>:<Menu size={25}/>}</button>
      </div>
    </div></header>
    {searchOpen&&<div className="search-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)closeSearch();}}><div ref={searchDialog} className="search-drawer" id="catalog-search" role="dialog" aria-modal="true" aria-labelledby="search-dialog-title"><div className="search-drawer-heading"><div id="search-dialog-title"><span className="live-dot"/> Find your next story</div><button className="search-cancel" onClick={closeSearch} aria-label="Close search"><X size={17}/><span>ESC</span></button></div><div className="search-drawer-inner"><SmartSearch variant="drawer" autoFocus/></div><p className="search-drawer-note">Movies, series, and something you haven’t discovered yet.</p></div></div>}
    <div className={`menu-panel ${menuOpen?'is-open':''}`} id="main-menu" aria-hidden={!menuOpen}><div className="menu-panel-inner"><div className="menu-panel-intro"><span>YOUR NEXT GREAT WATCH</span><h2>Pick a story.<br/><em>Feel everything.</em></h2><p>Search, save and continue across a catalog built for movie nights on every screen.</p><Link to="/pair" className="menu-remote-card"><Gamepad2/><span><small>PHONE REMOTE</small><strong>Scan. Pair. Control.</strong></span><ArrowUpRight/></Link><div className="pwa-install-card"><div className="pwa-install-icon">{installed?<CheckCircle2/>:isiOS&&!canInstall?<Share2/>:<Download/>}</div><div className="pwa-install-copy"><span>INSTALL CINERA</span><strong>{installed?'Ready from your home screen':'Faster access. Offline-ready.'}</strong><small>{installed?'Cinera is installed on this device.':'Add Cinera to your phone, computer or supported TV.'}</small></div><button type="button" onClick={handleInstall} disabled={installed}>{installed?'Installed':canInstall?'Install app':'Install help'}</button>{installNote&&<p className="pwa-install-note" role="status" aria-live="polite">{installNote}</p>}</div></div><nav>{links.map(({to,label,caption,icon:Icon},index)=><NavLink key={to} to={to} end={to==='/' }><span className="menu-number">{String(index+1).padStart(2,'0')}</span><Icon size={22}/><span><strong>{label}</strong><small>{caption}</small></span><ArrowUpRight size={22}/></NavLink>)}</nav><div className="menu-panel-foot"><span>FULL TMDB CATALOG</span><span>{saved.length} SAVED TITLE{saved.length===1?'':'S'}</span></div></div></div>
  </>;
}

function Footer(){return <footer className="site-footer"><div className="footer-inner"><div className="footer-kicker"><span>WATCH BETTER</span><span>BUILT FOR EVERY SCREEN</span></div><div className="footer-statement"><h2>YOUR NEXT STORY<br/><em>STARTS HERE.</em></h2><Clapperboard size={80}/></div><div className="footer-links">{links.map(({to,label})=><Link key={to} to={to}>{label}</Link>)}</div><div className="footer-bottom"><span>© {new Date().getFullYear()} Cinera. Independent movie discovery.</span><span className="footer-credit">Developed by <strong>Hich Web</strong></span></div></div></footer>}

export default function SiteLayout({children}){
  const location=useLocation();
  if(location.pathname==='/remote')return <div className="remote-app-shell"><RouteEffects/><main id="main-content" tabIndex={-1}>{children}</main><ToastViewport/></div>;
  return <div className="app-shell"><RouteEffects/><a className="skip-link" href="#main-content">Skip to content</a><SiteHeader/><ConnectionNotice/><main id="main-content" tabIndex={-1}>{children}</main><Footer/><nav className="mobile-bottom-nav" aria-label="Main navigation">{links.filter((_,index)=>index!==3).map(({to,label,icon:Icon})=><NavLink to={to} key={to} end={to==='/' }><Icon size={20}/><span>{label==='TV series'?'Series':label}</span></NavLink>)}</nav><ToastViewport/></div>;
}
