import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Check,Clock3,Gamepad2,Gauge,Keyboard,PictureInPicture,RotateCcw,Share2,SkipForward,X} from 'lucide-react';
import {notify} from '../lib/notifications';
import {useModalFocus} from '../lib/useModalFocus';

export default function WatchTools({item,sourceType,dataSaver,onDataSaver,autoNext,onAutoNext,canAutoNext,onRestart}){
  const [sleepMinutes,setSleepMinutes]=useState(0),[shortcutsOpen,setShortcutsOpen]=useState(false),[shared,setShared]=useState(''),[sharing,setSharing]=useState(false);
  const shortcutDialog=useRef(null),mounted=useRef(true);
  const closeShortcuts=useCallback(()=>setShortcutsOpen(false),[]);
  useModalFocus(shortcutsOpen,shortcutDialog,closeShortcuts);
  const directPlayer=sourceType==='video'||sourceType==='hls';
  const pipSupported=directPlayer&&Boolean(document.pictureInPictureEnabled);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(!directPlayer)setSleepMinutes(0);},[directPlayer]);
  useEffect(()=>{if(!shared)return;const timer=setTimeout(()=>setShared(''),2200);return()=>clearTimeout(timer);},[shared]);
  useEffect(()=>{
    if(!sleepMinutes)return;
    const timer=setTimeout(()=>{window.dispatchEvent(new CustomEvent('cinera:remote-command',{detail:{action:'pause'}}));setSleepMinutes(0);notify({message:'Sleep timer finished. Playback paused.'});},sleepMinutes*60*1000);
    return()=>clearTimeout(timer);
  },[sleepMinutes]);
  useEffect(()=>{
    const keydown=event=>{
      if(event.defaultPrevented||event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return;
      if(event.target?.closest?.('input,textarea,select,[contenteditable],[role="textbox"]'))return;
      if(event.key==='?'&&!document.querySelector('[role="dialog"][aria-modal="true"]')){event.preventDefault();setShortcutsOpen(true);}
    };
    window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);
  },[]);
  const share=async()=>{
    if(sharing)return;
    setSharing(true);
    const data={title:item?.title?`${item.title} on Cinera`:'Watch on Cinera',text:item?.title?`Watch ${item.title} on Cinera.`:'Watch this on Cinera.',url:window.location.href};
    try{
      if(navigator.share){
        await navigator.share(data);
        if(mounted.current)setShared('Shared');
        notify({message:'Watch link shared.'});
      }else{
        if(!navigator.clipboard?.writeText)throw new Error('Sharing is unavailable in this browser. Copy the link from your address bar.');
        await navigator.clipboard.writeText(data.url);
        if(mounted.current)setShared('Link copied');
        notify({message:'Watch link copied to your clipboard.'});
      }
    }catch(error){
      if(error.name!=='AbortError')notify({message:error.name==='NotAllowedError'?'Sharing was blocked. Allow sharing or clipboard access, or copy the address bar link.':error.message||'Could not share this link. Please try again.',tone:'error'});
    }finally{if(mounted.current)setSharing(false);}
  };
  const pip=async()=>{
    try{
      if(document.pictureInPictureElement)await document.exitPictureInPicture();
      else{
        const video=document.querySelector('video.video-element');
        if(!video||video.readyState===0)throw new Error('Start the video before opening Picture-in-Picture.');
        await video.requestPictureInPicture();
      }
    }catch(error){notify({message:error.message||'Picture-in-Picture could not open. Please try again.',tone:'error'});}
  };
  const shortcuts=directPlayer?[
    ['Enter / Space','Play or pause'],['← / →','Seek backward / forward 10 seconds'],['↑ / ↓','Adjust volume'],['M','Mute or unmute'],['F','Toggle fullscreen'],['?','Open this guide'],['Tab','Move between controls'],['Esc','Close dialogs'],
  ]:[['Enter','Select or activate player controls'],['← ↑ → ↓','Navigate page controls'],['Tab','Move between controls'],['?','Open this guide'],['Esc','Close dialogs']];
  return <>
    <section className="watch-tools" aria-label="Playback tools">
      <div className="watch-tools-heading"><span>QUICK TOOLS</span><strong>Make movie night yours</strong></div>
      <div className="watch-tools-grid">
        <Link to="/pair" className="tv-only-remote-tool"><Gamepad2/><span><strong>Phone remote</strong><small>Scan to control the TV</small></span></Link>
        <label className={sleepMinutes?'is-active':''}><Clock3/><span><strong>Sleep timer</strong><small>{!directPlayer?'Direct video only':sleepMinutes?`${sleepMinutes} minutes`:'Turn off later'}</small></span><select aria-label="Set sleep timer" disabled={!directPlayer} value={sleepMinutes} onChange={event=>setSleepMinutes(Number(event.target.value))}><option value="0">Off</option><option value="15">15m</option><option value="30">30m</option><option value="45">45m</option><option value="60">60m</option></select></label>
        <button type="button" onClick={pip} disabled={!pipSupported}><PictureInPicture/><span><strong>Picture-in-Picture</strong><small>{!directPlayer?'Direct video only':!pipSupported?'Unavailable in this browser':'Keep watching anywhere'}</small></span></button>
        <button type="button" className={dataSaver?'is-active':''} aria-pressed={dataSaver} onClick={()=>onDataSaver(!dataSaver)}><Gauge/><span><strong>Data Saver</strong><small>{dataSaver?'Lower bandwidth on':'Adaptive quality'}</small></span>{dataSaver&&<Check/>}</button>
        <button type="button" className={autoNext?'is-active':''} aria-pressed={autoNext} disabled={!canAutoNext} onClick={()=>onAutoNext(!autoNext)}><SkipForward/><span><strong>Autoplay next</strong><small>{canAutoNext?(autoNext?'Enabled':'Disabled'):'Series only'}</small></span>{autoNext&&canAutoNext&&<Check/>}</button>
        <button type="button" onClick={onRestart}><RotateCcw/><span><strong>Start over</strong><small>Restart from 00:00</small></span></button>
        <button type="button" onClick={share} disabled={sharing} aria-busy={sharing}><Share2/><span><strong>{sharing?'Sharing…':shared||'Share title'}</strong><small>Send this watch link</small></span></button>
        <button type="button" aria-haspopup="dialog" aria-expanded={shortcutsOpen} aria-controls="shortcut-title" onClick={event=>{event.currentTarget.focus();setShortcutsOpen(true);}}><Keyboard/><span><strong>Shortcuts</strong><small>Remote and keyboard guide</small></span></button>
      </div>
    </section>
    {shortcutsOpen&&<div className="shortcut-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)closeShortcuts();}}><div ref={shortcutDialog} className="shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-title" aria-describedby="shortcut-description" style={{maxHeight:'calc(100vh - 44px)',overflowY:'auto'}}><button className="shortcut-close" onClick={closeShortcuts} aria-label="Close shortcuts"><X/></button><span>CONTROL CINERA FASTER</span><h2 id="shortcut-title">Keyboard & remote shortcuts</h2><p id="shortcut-description">{directPlayer?'Click the video area first to use playback shortcuts. Use Tab or your remote to select other controls.':'External players provide their own playback shortcuts. Select the player to use its controls.'}</p><div className="shortcut-grid">{shortcuts.map(([key,description])=><div key={key}><kbd>{key}</kbd><p>{description}</p></div>)}</div></div></div>}
  </>;
}
