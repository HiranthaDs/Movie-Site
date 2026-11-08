import React,{useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowDown,ArrowUpRight,Check,ChevronDown,Gamepad2,Heart,Laptop,MonitorPlay,Search,Smartphone,Tablet,Tv,Wifi} from 'lucide-react';
import {AndroidIcon} from '../components/AndroidMascot';
import AndroidRobotScene from '../components/AndroidRobotScene';
import DevicePreview from '../components/AndroidDevicePreview';
import {APK_FILE_NAME,APK_FOLDER_URL} from '../lib/androidApp';
import '../android.css';
import '../android-devices.css';
import '../android-character.css';

const devices=[
  {id:'tv',name:'Android TV',tag:'DOWNLOAD THE APK',icon:Tv,description:'Make the big screen your favorite place. Install the TV app and settle in with your remote.',screen:'tv',action:'TV installation guide'},
  {id:'phone',name:'Android phones',tag:'USE THE WEB APP',icon:Smartphone,description:'A little screen. A world of stories. Open Cinera in your browser and add it to your home screen.',screen:'phone',action:'Phone setup guide'},
  {id:'tablet',name:'Android tablets',tag:'USE THE WEB APP',icon:Tablet,description:'More room to explore. Browse, build your list, and enjoy Cinera in portrait or landscape.',screen:'tablet',action:'Tablet setup guide'},
  {id:'laptop',name:'Laptops & PCs',tag:'USE THE WEB APP',icon:Laptop,description:'Your next watch, one tab away. Open Cinera on Windows, macOS, or Linux in a modern browser.',screen:'laptop',action:'Computer setup guide'},
];
const guides={
  tv:{title:'From download to sofa.',intro:'The available APK is built for Android TV. TV brands and Android versions may show slightly different installation screens.',steps:[
    ['Get the TV APK',`Open the download folder below and download ${APK_FILE_NAME}. You can download it on your TV, or use a computer or phone to transfer it.`],
    ['Open it on your TV','Transfer the APK using a USB drive or a file-transfer app you trust. Open the file with your TV’s file manager.'],
    ['Follow the install prompts','If Android asks, allow “Install unknown apps” for the app opening the file. Review the prompts, install Cinera, then turn that permission off again. Keep Play Protect enabled.'],
    ['Make yourself comfortable','Open Cinera from your apps. Use the directional buttons and Select to explore. Open Remote in Cinera to pair your phone with the TV’s QR code.'],
  ]},
  phone:{title:'Your next story, to go.',intro:'Phones use the Cinera web app for now. You can enjoy the site without installing the TV APK.',steps:[
    ['Open Cinera','Visit this website in a current browser on your Android phone. Tap “Open Cinera” below to get started.'],
    ['Add it to your home screen','Open the browser menu and look for “Install app” or “Add to Home screen.” You can also find Install help in Cinera’s menu. Availability varies by browser.'],
    ['Find something you love','Search for a movie or series, explore genres, and tap + to save a title to My list. Your list stays on this device.'],
    ['Watch your way','Choose a title and an available playback source. Use My list to continue watching, or export a library backup to move your collection to another browser.'],
  ]},
  tablet:{title:'A bigger little escape.',intro:'Use the web app on your Android tablet. It adapts to touch, portrait, and landscape layouts.',steps:[
    ['Open the web app','Visit Cinera in your tablet’s browser. There is no separate tablet APK in the download folder at the moment.'],
    ['Give it a home','Choose “Install app” or “Add to Home screen” from your browser menu when available. Cinera will be easier to return to.'],
    ['Turn it your way','Browse vertically or rotate to landscape for more space. Use the player’s fullscreen control when available.'],
    ['Keep your favorites close','Save titles, continue episodes, and use library export/import when switching devices. Lists and progress are stored locally, without an account.'],
  ]},
  laptop:{title:'Open a tab. Find a world.',intro:'Windows, macOS, and Linux use the website. The Android TV APK is not a native desktop installer.',steps:[
    ['Open Cinera in your browser','Use a current browser on your laptop or PC. No APK or desktop installer is needed.'],
    ['Make a shortcut','Bookmark Cinera, or use your browser’s “Install app” option when available for a dedicated app window.'],
    ['Explore with your keyboard','Press Ctrl+K or ⌘K to search. Use Tab to move between controls. The watch page’s Shortcuts guide explains player controls.'],
    ['Build your movie-night list','Save favorites and resume from My list. Export a library backup before moving to a different device or browser.'],
  ]},
};
const faqs=[
  ['Is Cinera really free?','Yes. Cinera is free to download and use, with no Cinera subscription or account required. Internet and mobile-data charges may apply. External playback services can have their own ads, availability, or terms.'],
  ['Which APK should I download?',`The download folder currently contains ${APK_FILE_NAME}, for Android TV. Phones and tablets use the web app for now. Laptops and desktop computers also use the website.`],
  ['Will it work on every smart TV?','The APK is for compatible Android TV devices. Samsung Tizen, LG webOS, and other TV platforms cannot install an Android APK. If your device cannot install it, try Cinera in a supported browser. Compatibility depends on the device, Android version, and playback source.'],
  ['Can I watch without an internet connection?','An internet connection is needed to load new titles and stream video. The web app can retain previously cached pages, but it does not download movies or episodes for offline playback.'],
  ['Will my watchlist follow me to another device?','Your watchlist and playback progress stay in the app or browser where you use Cinera. There is no automatic cloud sync. Use Export backup and Import backup in My list to move your library.'],
  ['How do I update the TV app?','Return to the download folder to check for a newer TV APK. Follow Android’s installation prompts. Back up your library before changing installations; avoid uninstalling first if you want to retain local app data.'],
];

function DownloadLink({children='Download APK',className=''}){
  return <a className={`android-download-button ${className}`} href={APK_FOLDER_URL} target="_blank" rel="noopener noreferrer"><AndroidIcon size={23}/><span>{children}</span><ArrowUpRight size={19}/><span className="sr-only"> — opens Google Drive in a new tab</span></a>;
}

export default function AndroidApp(){
  const [device,setDevice]=useState('tv'),[openFaq,setOpenFaq]=useState(0),[qr,setQr]=useState('');
  const guideHeading=useRef(null);
  const guide=guides[device];
  useEffect(()=>{
    let active=true;
    import('qrcode').then(({default:QRCode})=>QRCode.toDataURL(APK_FOLDER_URL,{width:240,margin:2,color:{dark:'#14271d',light:'#ffffff'},errorCorrectionLevel:'M'})).then(url=>{if(active)setQr(url);}).catch(()=>{});
    return()=>{active=false;};
  },[]);
  const showGuide=id=>{
    setDevice(id);
    guideHeading.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    guideHeading.current?.focus({preventScroll:true});
  };
  return <div className="android-page">
    <section className="android-character-hero content-width" aria-labelledby="android-title">
      <div className="android-hero-copy">
        <div className="android-eyebrow"><span className="android-status-dot"/> CINERA FOR ANDROID™</div>
        <h1 id="android-title">YOUR NEW<br/>MOVIE <span>BUDDY.</span></h1>
        <p className="android-hero-description">A little hello. A whole world of stories.<br/>Bring Cinera home to your Android TV, or take the web app with you. Always free. Always good company.</p>
        <div className="android-hero-actions"><DownloadLink/><button className="android-guide-link" onClick={()=>showGuide('tv')}>How to install <ArrowDown size={16}/></button></div>
        <div className="android-download-note"><Check size={14}/><span>Free Android TV APK <i/> Opens Google Drive</span></div>
        <div className="android-hero-promise"><span>100% free.</span><span>No account.</span><span>Just press play.</span></div>
      </div>
      <AndroidRobotScene/>
    </section>

    <div className="android-platform-strip"><div className="content-width"><span>MAKE YOURSELF AT HOME.</span>{devices.map(({id,name,icon:Icon})=><button key={id} onClick={()=>showGuide(id)}><Icon size={19}/>{name}</button>)}</div></div>

    <section className="android-devices content-width" aria-labelledby="android-devices-title">
      <div className="android-section-heading"><div><span className="android-eyebrow">01 / FIND YOUR SCREEN</span><h2 id="android-devices-title">SOFA. DESK. <span>EVERYWHERE.</span></h2></div><p>The TV gets an APK. Your phone, tablet, and computer get the web app. Pick your screen. We’ll show you the way.</p></div>
      <div className="android-device-grid">{devices.map(({id,name,tag,description,screen,action,icon:Icon})=><article className={`android-device-card android-device-${id}`} key={id}><div className="android-device-top"><Icon size={22}/><span>{tag}</span></div><DevicePreview type={screen}/><div className="android-device-copy"><h3>{name}</h3><p>{description}</p><button onClick={()=>showGuide(id)} aria-label={action}>{id==='tv'?'Get set up':'Explore the web app'}<ArrowUpRight size={18}/></button></div></article>)}</div>
    </section>

    <section className="android-features content-width" aria-labelledby="android-features-title"><div className="android-section-heading"><div><span className="android-eyebrow">02 / A LITTLE MORE CINEMA</span><h2 id="android-features-title">ALL THE GOOD STUFF.<br/><span>NONE OF THE SIGN-UP.</span></h2></div><p>From “what should we watch?” to “just one more episode,” Cinera keeps things simple.</p></div><div className="android-feature-grid">{[
      {Icon:Search,title:'Find your kind of story.',text:'Explore movies and series, search by title, and narrow the catalog by genre, year, or rating.'},
      {Icon:Heart,title:'Keep the good ones close.',text:'Save favorites to My list, pick up an episode, and export a backup of your personal collection.'},
      {Icon:Gamepad2,title:'Settle into the big screen.',text:'Navigate with your TV remote, or pair your phone by QR code for a trackpad and keyboard.'},
    ].map(({Icon,title,text},index)=><article key={title}><div><Icon size={25}/><span>0{index+1}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section className="android-guide-section" aria-labelledby="android-guide-title"><div className="content-width android-guide-inner"><div className="android-guide-intro"><span className="android-eyebrow">03 / LET’S GET YOU SET UP</span><h2 id="android-guide-title" ref={guideHeading} tabIndex={-1}>A FEW STEPS.<br/><span>A WHOLE WORLD.</span></h2><p>Choose your device for a simple walkthrough.</p><div className="android-guide-devices" role="group" aria-label="Choose your installation guide">{devices.map(({id,name,icon:Icon})=><button key={id} aria-pressed={device===id} onClick={()=>setDevice(id)} aria-controls="android-guide-content"><Icon size={20}/><span>{name}</span>{device===id?<Check size={17}/>:<ArrowUpRight size={16}/>}</button>)}</div><div className="android-guide-help"><Wifi size={19}/><p>Keep an internet connection for streaming. Your library stays local to the app or browser you use.</p></div></div><div className="android-guide-content" id="android-guide-content" aria-live="polite"><div className="android-guide-content-heading"><span>{device==='tv'?'ANDROID TV · APK':'CINERA · WEB APP'}</span><h3>{guide.title}</h3><p>{guide.intro}</p></div><ol>{guide.steps.map(([title,text],index)=><li key={`${device}-${title}`}><span>{String(index+1).padStart(2,'0')}</span><div><h4>{title}</h4><p>{text}</p></div></li>)}</ol><div className="android-guide-cta">{device==='tv'?<DownloadLink>Open APK downloads</DownloadLink>:<Link className="android-download-button" to="/"><MonitorPlay size={21}/><span>Open Cinera</span><ArrowUpRight size={18}/></Link>}{device==='tv'&&<a className="android-install-reference" href="https://developer.android.com/distribute/marketing-tools/alternative-distribution#unknown-sources" target="_blank" rel="noopener noreferrer">Android installation guidance <ArrowUpRight size={13}/></a>}</div></div></div></section>

    <section className="android-faq content-width" aria-labelledby="android-faq-title"><div><span className="android-eyebrow">04 / GOOD QUESTIONS</span><h2 id="android-faq-title">A LITTLE<br/><span>CLARITY.</span></h2><p>No guesswork. Here’s what to know before you get comfortable.</p></div><div className="android-faq-list">{faqs.map(([question,answer],index)=><div className={`android-faq-item ${openFaq===index?'is-open':''}`} key={question}><h3><button aria-expanded={openFaq===index} aria-controls={`android-answer-${index}`} id={`android-question-${index}`} onClick={()=>setOpenFaq(value=>value===index?null:index)}>{question}<ChevronDown size={20}/></button></h3><div id={`android-answer-${index}`} role="region" aria-labelledby={`android-question-${index}`} hidden={openFaq!==index}><p>{answer}</p></div></div>)}</div></section>

    <section className="android-last-call content-width" aria-labelledby="android-download-title"><div className="android-last-copy"><span className="android-eyebrow"><AndroidIcon size={20}/> YOUR SOFA IS CALLING</span><h2 id="android-download-title">LET’S MAKE IT<br/><span>A MOVIE NIGHT.</span></h2><p>The Android TV app is ready when you are. Free to download. Free to make yourself at home.</p><DownloadLink/><small>{APK_FILE_NAME} · Download folder on Google Drive</small></div><div className="android-qr-card">{qr?<img src={qr} width="160" height="160" alt="QR code to open the Cinera APK download folder"/>:<AndroidIcon size={100}/>}<strong>Scan. Download. Settle in.</strong><p>Open the folder on your phone,<br/>then transfer the APK to your TV.</p><a href={APK_FOLDER_URL} target="_blank" rel="noopener noreferrer">Open download folder <ArrowUpRight size={14}/></a></div></section>
  </div>;
}
