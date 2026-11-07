import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {ChevronLeft,CornerDownLeft,Delete,Expand,Heart,Home,Keyboard,Menu,Minus,MonitorPlay,MousePointer2,Move,Pause,Play,Plus,RotateCcw,Search,SkipBack,SkipForward,Volume2,VolumeX,X} from 'lucide-react';
import {remoteSocketUrl} from '../lib/remote';
import {gestureDirection,gestureRepeatCount} from '../lib/remoteGestures';
import {useModalFocus} from '../lib/useModalFocus';

const navItems=[['/',Home,'Home'],['/movies',MonitorPlay,'Movies'],['/series',Play,'Series'],['/search',Search,'Search'],['/watchlist',Heart,'My list']];
const keyRows=[
  ['1','2','3','4','5','6','7','8','9','0'],
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M'],
];
const vibration={move:3,tap:10,select:18,heavy:[24,35,24],success:[10,22,14]};

export default function PhoneRemote(){
  const [params]=useSearchParams();
  const pair=params.get('pair')||'';
  const valid=/^[A-Za-z0-9_-]{22,80}$/.test(pair);
  const [status,setStatus]=useState(valid?'connecting':'invalid'),[screenConnected,setScreenConnected]=useState(false),[screenState,setScreenState]=useState({});
  const [trackMode,setTrackMode]=useState('pointer'),[trackActive,setTrackActive]=useState(false),[finger,setFinger]=useState(null);
  const [keyboardOpen,setKeyboardOpen]=useState(false),[keyboardText,setKeyboardText]=useState(''),[shift,setShift]=useState(false);
  const socketRef=useRef(null),reconnectRef=useRef(null),wakeLockRef=useRef(null),heartbeatRef=useRef(null),attemptRef=useRef(0);
  const gestureRef=useRef(null),tapRef=useRef({at:0,timer:null}),frameRef=useRef(null),queuedPointerRef=useRef({dx:0,dy:0}),lastMoveHapticRef=useRef(0),typingAtRef=useRef(0),keyboardInputRef=useRef(null);
  const gestureTimersRef=useRef(new Set());
  const keyboardDialogRef=useRef(null);
  const closeKeyboard=useCallback(()=>setKeyboardOpen(false),[]);
  useModalFocus(keyboardOpen,keyboardDialogRef,closeKeyboard);

  const haptic=useCallback(kind=>{
    if(!navigator.vibrate)return;
    try{navigator.vibrate(vibration[kind]||vibration.tap);}catch{}
  },[]);
  const requestWakeLock=useCallback(async()=>{
    if(document.visibilityState!=='visible'||wakeLockRef.current)return;
    try{wakeLockRef.current=await navigator.wakeLock?.request('screen');wakeLockRef.current?.addEventListener?.('release',()=>{wakeLockRef.current=null;},{once:true});}catch{}
  },[]);
  const connect=useCallback(()=>{
    if(!valid)return()=>{};
    let stopped=false;
    const open=()=>{
      if(stopped)return;
      setStatus(attemptRef.current?'reconnecting':'connecting');
      const socket=new WebSocket(remoteSocketUrl(pair,'remote'));socketRef.current=socket;
      socket.addEventListener('open',()=>{
        attemptRef.current=0;setStatus('waiting');requestWakeLock();
        clearInterval(heartbeatRef.current);
        heartbeatRef.current=setInterval(()=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'ping'}));},25000);
      });
      socket.addEventListener('message',event=>{
        let payload;try{payload=JSON.parse(event.data);}catch{return;}
        if(payload.type==='presence'){
          const connected=Boolean(payload.screenConnected);setScreenConnected(connected);setStatus(connected?'connected':'waiting');
          if(connected)haptic('success');
        }else if(payload.type==='state')setScreenState(current=>({...current,...payload.state}));
      });
      socket.addEventListener('close',()=>{
        if(stopped)return;
        clearInterval(heartbeatRef.current);setScreenConnected(false);setStatus('reconnecting');
        const delay=Math.min(8000,900*2**Math.min(attemptRef.current++,4));
        reconnectRef.current=setTimeout(open,delay);
      });
      socket.addEventListener('error',()=>setStatus('error'));
    };
    open();
    const visible=()=>{if(document.visibilityState==='visible')requestWakeLock();};
    document.addEventListener('visibilitychange',visible);
    return()=>{
      clearTimeout(gestureRef.current?.longTimer);gestureRef.current=null;
      gestureTimersRef.current.forEach(clearTimeout);gestureTimersRef.current.clear();
      queuedPointerRef.current={dx:0,dy:0};
      stopped=true;document.removeEventListener('visibilitychange',visible);clearTimeout(reconnectRef.current);clearInterval(heartbeatRef.current);clearTimeout(tapRef.current.timer);cancelAnimationFrame(frameRef.current);socketRef.current?.close();wakeLockRef.current?.release?.();wakeLockRef.current=null;
      tapRef.current={at:0,timer:null};frameRef.current=null;
    };
  },[haptic,pair,requestWakeLock,valid]);
  useEffect(connect,[connect]);
  useEffect(()=>{
    if(!screenState.inputActive||Date.now()-typingAtRef.current<650)return;
    setKeyboardText(String(screenState.inputValue||''));setKeyboardOpen(true);
  },[screenState.inputActive,screenState.inputValue]);

  const send=useCallback((command,feedback='tap')=>{
    if(feedback)haptic(feedback);
    if(socketRef.current?.readyState!==WebSocket.OPEN)return false;
    socketRef.current.send(JSON.stringify({type:'command',command}));return true;
  },[haptic]);
  const queuePointer=useCallback((dx,dy)=>{
    queuedPointerRef.current.dx+=dx;queuedPointerRef.current.dy+=dy;
    if(!frameRef.current)frameRef.current=requestAnimationFrame(()=>{
      const delta=queuedPointerRef.current;queuedPointerRef.current={dx:0,dy:0};frameRef.current=null;
      send({action:'pointer_move',dx:delta.dx,dy:delta.dy,sensitivity:1.7},null);
    });
    const now=performance.now();if(now-lastMoveHapticRef.current>52){haptic('move');lastMoveHapticRef.current=now;}
  },[haptic,send]);

  const trackDown=event=>{
    if(event.button!==undefined&&event.button!==0)return;
    if(gestureRef.current)return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect=event.currentTarget.getBoundingClientRect();
    const state={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,anchorX:event.clientX,anchorY:event.clientY,moved:false,long:false,scroll:event.clientX>rect.right-42,rect};
    state.longTimer=setTimeout(()=>{
      if(!state.moved){state.long=true;send(trackMode==='pointer'?{action:'pointer_click'}:{action:'key',key:'Enter'},'heavy');}
    },580);
    gestureRef.current=state;setTrackActive(true);setFinger({x:event.clientX-rect.left,y:event.clientY-rect.top});haptic('move');
  };
  const trackMove=event=>{
    const state=gestureRef.current;if(!state||state.pointerId!==event.pointerId)return;
    event.preventDefault();
    const dx=event.clientX-state.lastX,dy=event.clientY-state.lastY;
    const totalX=event.clientX-state.startX,totalY=event.clientY-state.startY;
    if(Math.hypot(totalX,totalY)>7){state.moved=true;clearTimeout(state.longTimer);}
    if(trackMode==='pointer'){
      if(state.scroll)send({action:'scroll',dy},null);else queuePointer(dx,dy);
    }
    state.lastX=event.clientX;state.lastY=event.clientY;
    setFinger({x:Math.max(0,Math.min(state.rect.width,event.clientX-state.rect.left)),y:Math.max(0,Math.min(state.rect.height,event.clientY-state.rect.top))});
  };
  const trackEnd=event=>{
    const state=gestureRef.current;if(!state||state.pointerId!==event.pointerId)return;
    clearTimeout(state.longTimer);gestureRef.current=null;setTrackActive(false);setFinger(null);
    const dx=event.clientX-state.startX,dy=event.clientY-state.startY;
    if(state.long)return;
    if(trackMode==='focus'&&state.moved){
      const key=gestureDirection(dx,dy,28);
      if(key){const count=gestureRepeatCount(dx,dy,44,4);for(let index=0;index<count;index+=1){const timer=setTimeout(()=>{gestureTimersRef.current.delete(timer);send({action:'key',key},index===0?'select':null);},index*54);gestureTimersRef.current.add(timer);}}
      return;
    }
    if(state.moved||state.scroll)return;
    const now=Date.now();
    if(now-tapRef.current.at<290){clearTimeout(tapRef.current.timer);tapRef.current={at:0,timer:null};send({action:'play_pause'},'heavy');}
    else{
      tapRef.current.at=now;
      tapRef.current.timer=setTimeout(()=>{send(trackMode==='pointer'?{action:'pointer_click'}:{action:'key',key:'Enter'},'select');tapRef.current.at=0;},290);
    }
  };
  const cancelTrack=event=>{const state=gestureRef.current;if(state?.pointerId===event.pointerId){clearTimeout(state.longTimer);gestureRef.current=null;setTrackActive(false);setFinger(null);}};

  const openKeyboard=()=>{setKeyboardOpen(true);setKeyboardText(String(screenState.inputValue||''));send({action:'focus_input'},'select');setTimeout(()=>keyboardInputRef.current?.focus(),80);};
  const updateText=next=>{
    const clean=String(next).slice(0,240);typingAtRef.current=Date.now();setKeyboardText(clean);send({action:'text_set',value:clean},'move');
  };
  const pressKey=key=>{const value=shift?key:key.toLowerCase();updateText(`${keyboardText}${value}`);if(shift)setShift(false);};
  const submitText=()=>{send({action:'text_submit'},'heavy');setKeyboardOpen(false);keyboardInputRef.current?.blur();};

  if(!valid)return <div className="phone-remote-error"><div><strong>CINERA REMOTE</strong><h1>This pairing link is invalid.</h1><p>Open Remote on the TV and scan the newest QR code.</p></div></div>;
  const connected=status==='connected'&&screenConnected;
  return <div className="phone-remote">
    <header><div className="phone-remote-brand"><span><Play fill="currentColor"/></span>CINERA</div><div className={`phone-remote-status ${connected?'is-connected':''}`}><i/>{connected?'TV connected':status==='reconnecting'?'Reconnecting…':status==='error'?'Connection issue':'Waiting for TV'}</div></header>
    <main>
      <section className="remote-now-playing"><span>NOW CONTROLLING</span><h1>{screenState.title||'Cinera'}</h1><p>{screenState.subtitle||screenState.playerState||'Move, tap, type and control your TV'}</p><div className="remote-progress"><i style={{width:`${Math.max(0,Math.min(100,screenState.progress||0))}%`}}/></div></section>

      <section className="remote-top-actions" aria-label="Main TV controls">
        <button onClick={()=>send({action:'back'})} aria-label="Back"><ChevronLeft/></button>
        <button onClick={()=>send({action:'navigate',path:'/'})} aria-label="Home"><Home/></button>
        <button className={keyboardOpen?'is-active':''} onClick={openKeyboard} aria-label="Open TV keyboard"><Keyboard/></button>
        <button onClick={()=>send({action:'menu'})} aria-label="Open TV menu"><Menu/></button>
      </section>

      <section className="remote-trackpad-shell" aria-label="Advanced TV trackpad">
        <div className="trackpad-heading"><div><small>TOUCH CONTROL</small><strong>{trackMode==='pointer'?(screenState.pointerTarget||'Move the TV pointer'):'Swipe between TV controls'}</strong></div><div className="track-mode"><button className={trackMode==='pointer'?'active':''} onClick={()=>{setTrackMode('pointer');haptic('select');}}><MousePointer2/> Pointer</button><button className={trackMode==='focus'?'active':''} onClick={()=>{setTrackMode('focus');haptic('select');}}><Move/> Focus</button></div></div>
        <div className={`remote-trackpad ${trackActive?'is-active':''} mode-${trackMode}`} role="button" tabIndex="0" aria-label={trackMode==='pointer'?'Drag to move the TV pointer, tap to select':'Swipe to move focus, tap to select'} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat)send(trackMode==='pointer'?{action:'pointer_click'}:{action:'key',key:'Enter'},'select');}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();send({action:'key',key:event.key},'move');}}} onPointerDown={trackDown} onPointerMove={trackMove} onPointerUp={trackEnd} onPointerCancel={cancelTrack} onContextMenu={event=>event.preventDefault()}>
          <div className="trackpad-surface-lines"/><div className="trackpad-center"><MousePointer2/><span>{trackMode==='pointer'?'DRAG · TAP':'SWIPE · SELECT'}</span><small>Double tap to play or pause</small></div><div className="trackpad-scroll-rail"><i/> SCROLL</div>
          {finger&&<span className="trackpad-finger" style={{transform:`translate3d(${finger.x}px,${finger.y}px,0)`}}/>}
        </div>
      </section>

      <section className="remote-playback" aria-label="Playback controls"><button onClick={()=>send({action:'seek_relative',seconds:-10})} aria-label="Back ten seconds"><SkipBack/></button><button className="remote-play" onClick={()=>send({action:'play_pause'},'select')} aria-label="Play or pause">{screenState.playerState==='playing'?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button><button onClick={()=>send({action:'seek_relative',seconds:10})} aria-label="Forward ten seconds"><SkipForward/></button></section>
      <section className="remote-utilities"><button onClick={()=>send({action:'mute'})}>{screenState.muted?<VolumeX/>:<Volume2/>}<span>Mute</span></button><button onClick={()=>send({action:'volume',delta:-.1})}><Minus/><span>Volume</span></button><button onClick={()=>send({action:'volume',delta:.1})}><Plus/><span>Volume</span></button><button onClick={()=>send({action:'fullscreen'})}><Expand/><span>Fullscreen</span></button><button onClick={()=>send({action:'restart'})}><RotateCcw/><span>Start over</span></button><button onClick={()=>send({action:'key',key:'Enter'})}><CornerDownLeft/><span>Select</span></button></section>
      <nav className="remote-nav" aria-label="Open a TV section">{navItems.map(([path,Icon,label])=><button key={path} onClick={()=>send({action:'navigate',path})}><Icon/><span>{label}</span></button>)}</nav>
    </main>

    {keyboardOpen&&<div className="remote-keyboard-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)setKeyboardOpen(false);}}><section ref={keyboardDialogRef} className="remote-keyboard-drawer" role="dialog" aria-modal="true" aria-labelledby="remote-keyboard-title">
      <div className="remote-keyboard-heading"><div><small>TYPE ON YOUR TV</small><strong id="remote-keyboard-title">{screenState.inputLabel||'Cinera search'}</strong></div><button onClick={()=>setKeyboardOpen(false)} aria-label="Close keyboard"><X/></button></div>
      <div className="remote-keyboard-input"><Search/><input aria-label="Text to send to the TV" ref={keyboardInputRef} value={keyboardText} onChange={event=>updateText(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();submitText();}}} placeholder="Type with your phone or the keys below" autoComplete="off" enterKeyHint="search"/><button onClick={()=>updateText(keyboardText.slice(0,-1))} aria-label="Delete last character"><Delete/></button></div>
      <div className="remote-keyboard-keys">{keyRows.map((row,index)=><div key={index}>{row.map(key=><button key={key} onClick={()=>pressKey(key)}>{shift?key:key.toLowerCase()}</button>)}</div>)}<div className="remote-keyboard-special"><button className={shift?'is-active':''} onClick={()=>{setShift(value=>!value);haptic('tap');}}>SHIFT</button><button className="key-space" onClick={()=>updateText(`${keyboardText} `)}>SPACE</button><button onClick={()=>updateText('')}>CLEAR</button><button className="key-enter" onClick={submitText}><CornerDownLeft/> SEARCH</button></div></div>
    </section></div>}
  </div>;
}
