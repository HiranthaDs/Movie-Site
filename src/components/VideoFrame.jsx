import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Clapperboard,ExternalLink,Play,RefreshCcw,ShieldAlert} from 'lucide-react';
import PlaybackLoading from './PlaybackLoading';
import {embedUrlWithProgress,parseEmbedPlayerMessage,shouldUseFullPagePlayer} from '../lib/embedPlayer';
import {nativeHlsType,toggleFullscreen as toggleMediaFullscreen} from '../lib/mediaCompat';
import {normalizeRemoteKey} from '../lib/tvNavigation';

const LOAD_TIMEOUT=25000;

export default function VideoFrame({source,resume=0,onProgress=()=>{},poster,onStateChange=()=>{},dataSaver=false}){
  // A wide touch PC can use the ten-foot layout, but only a confirmed TV
  // should leave the embedded player for the more compatible full-page flow.
  const confirmedTv=typeof document!=='undefined'&&document.documentElement.classList.contains('tv-device');
  const tvExternal=shouldUseFullPagePlayer(source?.type,confirmedTv);
  const videoRef=useRef(null);
  const iframeRef=useRef(null);
  const shellRef=useRef(null);
  const onProgressRef=useRef(onProgress);
  const onStateRef=useRef(onStateChange);
  const resumeRef=useRef(resume);
  const retryPositionRef=useRef(null);
  const statusRef=useRef(source?(tvExternal?'blocked':'loading'):'idle');
  const [status,setStatus]=useState(statusRef.current);
  const [message,setMessage]=useState('Connecting to server…');
  const [attempt,setAttempt]=useState(0);
  const [connectionStage,setConnectionStage]=useState(1);
  const [embedStarted,setEmbedStarted]=useState(!tvExternal);
  const tvLaunchPending=tvExternal&&!embedStarted;
  onProgressRef.current=onProgress;
  onStateRef.current=onStateChange;
  resumeRef.current=resume;

  const updateState=useCallback((next,detail='')=>{
    statusRef.current=next;
    setStatus(next);
    if(detail)setMessage(detail);
    onStateRef.current(next,detail);
    window.dispatchEvent(new CustomEvent('cinera:remote-state',{detail:{playerState:next,playerMessage:detail}}));
  },[]);

  useEffect(()=>{
    setConnectionStage(1);
    updateState(source?(tvLaunchPending?'blocked':'loading'):'idle',tvLaunchPending?'Press play to open the TV player.':'Connecting to server…');
  },[source?.id,source?.url,source?.type,attempt,tvLaunchPending,updateState]);

  useEffect(()=>{
    if(!source||source.type!=='iframe'||tvLaunchPending)return;
    const preparing=setTimeout(()=>{
      if(statusRef.current==='loading'){
        setConnectionStage(2);
        updateState('loading','Preparing external player…');
      }
    },1200);
    // Cross-origin players can keep their document load event open while they
    // probe streams. Reveal the frame after navigation has had time to start.
    const reveal=setTimeout(()=>{
      if(statusRef.current==='loading')updateState('connected',`${source.label} opened`);
    },4200);
    return()=>{clearTimeout(preparing);clearTimeout(reveal);};
  },[source?.id,source?.url,source?.type,attempt,tvLaunchPending,updateState]);

  useEffect(()=>{
    if(!source||source.type!=='iframe')return;
    const sourceOrigin=new URL(source.url).origin;
    const listener=event=>{
      if(event.origin!==sourceOrigin)return;
      const frameWindow=iframeRef.current?.contentWindow;
      if(!frameWindow||event.source!==frameWindow)return;
      const payload=parseEmbedPlayerMessage(event.data);
      if(!payload)return;
      if(payload.event==='play')updateState('playing','Playing');
      else if(payload.event==='pause')updateState('paused','Paused');
      else if(payload.event==='ended')updateState('ended','Playback complete');
      else if(payload.event==='timeupdate'&&statusRef.current==='connected')updateState('playing','Playing');
      if(['timeupdate','pause','ended'].includes(payload.event)&&typeof payload.currentTime==='number')onProgressRef.current(payload.currentTime,payload.duration,payload.event!=='timeupdate');
      window.dispatchEvent(new CustomEvent('cinera:remote-state',{detail:{
        playerState:payload.event==='timeupdate'?'playing':payload.event,
        currentTime:payload.currentTime,
        duration:payload.duration,
        progress:Number(payload.duration)>0&&typeof payload.currentTime==='number'?payload.currentTime/payload.duration*100:0,
      }}));
    };
    window.addEventListener('message',listener);
    return()=>window.removeEventListener('message',listener);
  },[source?.id,source?.url,source?.type,updateState]);

  useEffect(()=>{
    if(!source||source.type==='iframe'||!videoRef.current)return;
    const elem=videoRef.current;
    const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    const constrained=Boolean(dataSaver||connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType));
    let hls;
    let disposed=false;
    let didResume=false;
    let attemptedAutoplay=false;
    let networkRecoveries=0;
    let mediaRecoveries=0;

    const preparePlayback=()=>{
      setConnectionStage(2);
      if(statusRef.current==='loading')updateState('loading','Preparing your playback…');
    };
    const onMetadata=()=>{
      if(!didResume){
        const position=Number(retryPositionRef.current??resumeRef.current)||0;
        if(position>0&&Number.isFinite(elem.duration)&&position<elem.duration-12)elem.currentTime=position;
        didResume=true;
      }
      preparePlayback();
    };
    const onCanPlay=()=>{
      if(!attemptedAutoplay&&!elem.ended&&!['playing','paused','error'].includes(statusRef.current)){
        attemptedAutoplay=true;
        setConnectionStage(2);
        updateState('starting','Starting playback…');
        Promise.resolve(elem.play()).then(()=>{
          if(!disposed&&!elem.paused)updateState('playing','Playing');
        }).catch(error=>{
          if(disposed||statusRef.current==='paused')return;
          if(error.name==='NotAllowedError'||error.name==='AbortError')updateState('blocked','Press play to start watching.');
          else updateState('error','This video could not start. Retry or choose another server.');
        });
        return;
      }
      if(['loading','buffering'].includes(statusRef.current))updateState(elem.paused?'ready':'playing',elem.paused?'Ready to play':'Playing');
    };
    const onLoadStart=()=>{setConnectionStage(1);updateState('loading','Connecting to server…');};
    const onWaiting=()=>{if(statusRef.current!=='error'){setConnectionStage(2);updateState('buffering','Buffering your video…');}};
    const onStalled=()=>{if(elem.readyState<3&&(statusRef.current==='loading'||!elem.paused))onWaiting();};
    const onPlaying=()=>updateState('playing','Playing');
    const persistPosition=()=>{if(didResume)onProgressRef.current(elem.currentTime,elem.duration,true);};
    const onHidden=()=>{if(document.hidden)persistPosition();};
    const onPause=()=>{persistPosition();if(!elem.ended&&['playing','starting','buffering'].includes(statusRef.current))updateState('paused','Paused');};
    const onEnded=()=>updateState('ended','Playback complete');
    const onError=()=>{
      const descriptions={2:'The connection to this server was interrupted.',3:'This video could not be decoded.',4:'This video format or source is unavailable.'};
      updateState('error',descriptions[elem.error?.code]||'This source could not be played. Try again or choose another server.');
    };

    elem.addEventListener('loadstart',onLoadStart);
    elem.addEventListener('loadedmetadata',onMetadata);
    elem.addEventListener('canplay',onCanPlay);
    elem.addEventListener('waiting',onWaiting);
    elem.addEventListener('stalled',onStalled);
    elem.addEventListener('playing',onPlaying);
    elem.addEventListener('pause',onPause);
    elem.addEventListener('ended',onEnded);
    elem.addEventListener('error',onError);
    window.addEventListener('pagehide',persistPosition);
    document.addEventListener('visibilitychange',onHidden);

    if(source.type==='hls'){
      if(nativeHlsType(elem)){
        elem.src=source.url;
        elem.load();
      }else import('hls.js').then(({default:Hls})=>{
        if(disposed)return;
        if(!Hls.isSupported()){updateState('error','HLS playback is not supported by this browser.');return;}
        hls=new Hls({
          enableWorker:true,
          lowLatencyMode:false,
          backBufferLength:30,
          maxBufferLength:constrained?15:40,
          maxMaxBufferLength:constrained?30:90,
          startLevel:-1,
          capLevelToPlayerSize:true,
          testBandwidth:true,
        });
        hls.on(Hls.Events.MANIFEST_PARSED,preparePlayback);
        hls.on(Hls.Events.ERROR,(_event,data)=>{
          if(!data.fatal)return;
          if(data.type===Hls.ErrorTypes.NETWORK_ERROR&&networkRecoveries<2){
            networkRecoveries+=1;
            setConnectionStage(1);
            updateState('buffering',`Reconnecting to server… (${networkRecoveries}/2)`);
            hls.startLoad();
            return;
          }
          if(data.type===Hls.ErrorTypes.MEDIA_ERROR&&mediaRecoveries<2){
            mediaRecoveries+=1;
            setConnectionStage(2);
            updateState('buffering','Recovering the video stream…');
            hls.recoverMediaError();
            return;
          }
          updateState('error','The stream stopped responding. Try reloading this source.');
        });
        hls.loadSource(source.url);
        hls.attachMedia(elem);
      }).catch(()=>{if(!disposed)updateState('error','The video player could not be loaded. Please retry.');});
    }else{
      elem.src=source.url;
      elem.load();
    }

    return()=>{
      disposed=true;
      if(didResume)retryPositionRef.current=elem.currentTime;
      elem.removeEventListener('loadstart',onLoadStart);
      elem.removeEventListener('loadedmetadata',onMetadata);
      elem.removeEventListener('canplay',onCanPlay);
      elem.removeEventListener('waiting',onWaiting);
      elem.removeEventListener('stalled',onStalled);
      elem.removeEventListener('playing',onPlaying);
      elem.removeEventListener('pause',onPause);
      elem.removeEventListener('ended',onEnded);
      elem.removeEventListener('error',onError);
      window.removeEventListener('pagehide',persistPosition);
      document.removeEventListener('visibilitychange',onHidden);
      hls?.destroy();
      elem.pause();
      elem.removeAttribute('src');
      elem.load();
    };
  },[source?.id,source?.url,source?.type,attempt,dataSaver,updateState]);

  useEffect(()=>{
    if(!source||tvLaunchPending||!['loading','buffering','starting'].includes(status))return;
    const timer=setTimeout(()=>updateState('error','This server is taking longer than expected. Retry or choose another server.'),LOAD_TIMEOUT);
    return()=>clearTimeout(timer);
  },[source?.url,source?.type,attempt,status,tvLaunchPending,updateState]);

  const retry=()=>{setConnectionStage(1);updateState('loading','Reconnecting to server…');setAttempt(value=>value+1);};
  const startEmbeddedPlayer=()=>{
    setEmbedStarted(true);
    setConnectionStage(1);
    updateState('loading','Opening Vidy inside Cinera…');
  };
  const playFromGesture=()=>{
    const elem=videoRef.current;
    if(!elem||statusRef.current==='starting')return;
    updateState('starting','Starting playback…');
    Promise.resolve(elem.play()).then(()=>{
      if(videoRef.current===elem&&!elem.paused)updateState('playing','Playing');
    }).catch(error=>{
      if(videoRef.current!==elem||statusRef.current==='paused')return;
      if(error.name==='NotAllowedError'||error.name==='AbortError')updateState('blocked','Press play to start watching.');
      else updateState('error','This video could not start. Retry or choose another server.');
    });
  };
  const toggleFullscreen=()=>{
    toggleMediaFullscreen(shellRef.current,videoRef.current,document).catch(()=>{});
  };
  const handleRemote=event=>{
    const key=normalizeRemoteKey(event);
    if(['INPUT','SELECT','BUTTON','A'].includes(event.target.tagName)&&event.target!==shellRef.current)return;
    if(source?.type==='iframe'){
      if(tvLaunchPending)return;
      if(['Enter',' ','MediaPlay','MediaPlayPause'].includes(key)){
        event.preventDefault();
        iframeRef.current?.focus();
        try{iframeRef.current?.contentWindow?.focus();}catch{}
        updateState('connected','Player controls active');
      }
      return;
    }
    const elem=videoRef.current;
    if(!elem)return;
    if(['Enter',' ','MediaPlay','MediaPlayPause'].includes(key)){
      event.preventDefault();
      elem.paused?playFromGesture():elem.pause();
    }else if(key==='ArrowLeft'){event.preventDefault();elem.currentTime=Math.max(0,elem.currentTime-10);}
    else if(key==='ArrowRight'){event.preventDefault();elem.currentTime=Math.min(elem.duration||Infinity,elem.currentTime+10);}
    else if(key==='ArrowUp'){event.preventDefault();elem.volume=Math.min(1,elem.volume+.1);}
    else if(key==='ArrowDown'){event.preventDefault();elem.volume=Math.max(0,elem.volume-.1);}
    else if(key.toLowerCase()==='m')elem.muted=!elem.muted;
    else if(key.toLowerCase()==='f')toggleFullscreen();
  };

  useEffect(()=>{
    const command=event=>{
      const action=event.detail?.action;
      if(!action)return;
      if(action==='fullscreen'){toggleFullscreen();return;}
      if(source?.type==='iframe'){
        if(action==='restart')retry();
        return;
      }
      const elem=videoRef.current;if(!elem)return;
      if(action==='play_pause')elem.paused?playFromGesture():elem.pause();
      else if(action==='play')playFromGesture();
      else if(action==='pause')elem.pause();
      else if(action==='seek_relative')elem.currentTime=Math.max(0,Math.min(elem.duration||Infinity,elem.currentTime+(Number(event.detail.seconds)||0)));
      else if(action==='volume')elem.volume=Math.max(0,Math.min(1,elem.volume+(Number(event.detail.delta)||0)));
      else if(action==='mute')elem.muted=!elem.muted;
      else if(action==='restart'){elem.currentTime=0;playFromGesture();}
      else if(action==='pip'){
        if(document.pictureInPictureElement)document.exitPictureInPicture?.().catch(()=>{});
        else elem.requestPictureInPicture?.().catch(()=>{});
      }
    };
    window.addEventListener('cinera:remote-command',command);
    return()=>window.removeEventListener('cinera:remote-command',command);
  },[source?.id,source?.type,attempt]);

  if(!source)return <div className="video-unavailable"><Clapperboard size={36}/><span className="player-state-label">NO DIRECT SOURCE</span><h2>No ad-free stream is configured</h2><p>Use a legal watch option below, or add a licensed MP4 or HLS stream for this title.</p></div>;

  const loading=!tvLaunchPending&&['loading','buffering','starting'].includes(status);
  const loadingDetail=source.type==='iframe'?`Opening ${source.label}. Playback controls will appear here.`:connectionStage===1?'Waiting for the selected server to respond.':'Loading enough video for playback to begin.';
  const iframeUrl=embedUrlWithProgress(source.url,resume);
  return <div ref={shellRef} className={`video-frame-shell state-${status}`} tabIndex={0} data-tv-autofocus={tvLaunchPending?undefined:true} data-native-arrows={source.type==='iframe'?undefined:'true'} onKeyDown={handleRemote} aria-label={`${source.label} player`} aria-busy={loading}>
    {source.type==='iframe'
      ?embedStarted&&<iframe ref={iframeRef} tabIndex={0} key={`${source.url}-${attempt}`} src={iframeUrl} title={source.label} allow="encrypted-media; autoplay *; fullscreen *; picture-in-picture *" allowFullScreen frameBorder="0" loading="eager" referrerPolicy="strict-origin-when-cross-origin" className="video-element" onLoad={()=>updateState('connected',`${source.label} opened`)} onError={()=>updateState('error',`${source.label} could not be opened. Retry or choose another source.`)}/>
      :<video key={`${source.url}-${attempt}`} className="video-element" ref={videoRef} controls playsInline preload={dataSaver?'metadata':'auto'} poster={poster||undefined} controlsList="nodownload noplaybackrate" disablePictureInPicture={false} onTimeUpdate={event=>{const elem=event.currentTarget;onProgressRef.current(elem.currentTime,elem.duration);window.dispatchEvent(new CustomEvent('cinera:remote-state',{detail:{currentTime:elem.currentTime,duration:elem.duration,progress:Number.isFinite(elem.duration)&&elem.duration>0?elem.currentTime/elem.duration*100:0,muted:elem.muted,volume:elem.volume}}));}} onEnded={event=>onProgressRef.current(event.currentTarget.duration,event.currentTarget.duration)}/>}
    {tvLaunchPending&&<div className="player-start-prompt tv-external-start"><span className="player-state-label">TV PLAYER READY</span><h2>Play with Vidy</h2><p>TV browsers play external video more reliably as a full-page player. Press Play, then use your remote’s Back button to return to Cinera.</p><div className="tv-external-actions"><a href={iframeUrl} className="button button-primary player-start-button" data-tv-autofocus><Play size={22} fill="currentColor"/> Play on TV</a><button type="button" className="button button-glass" onClick={startEmbeddedPlayer}>Play inside Cinera</button></div></div>}
    {loading&&<PlaybackLoading phase={connectionStage} title={message} detail={loadingDetail} sourceLabel={source.label}/>}
    {status==='blocked'&&!tvLaunchPending&&<div className="player-start-prompt"><span className="player-state-label">READY TO WATCH</span><button className="button button-primary player-start-button" onClick={playFromGesture}><Play size={22} fill="currentColor"/> Play now</button><p>Your browser needs one tap to start with sound.</p></div>}
    {status==='error'&&<div className="player-error" role="alert"><ShieldAlert size={34}/><strong>Playback needs attention</strong><p>{message}</p><div><button className="button button-primary" onClick={retry}><RefreshCcw size={16}/> Retry source</button><a className="button button-glass" href={source.url} target="_blank" rel="noreferrer">Open directly <ExternalLink size={15}/></a></div></div>}
    <span className="remote-hint">{source.type==='iframe'?'REMOTE: ENTER opens player controls':'REMOTE: ←/→ seek · ENTER play · F fullscreen'}</span>
  </div>;
}
