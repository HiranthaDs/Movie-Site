import React,{useEffect,useRef,useState} from 'react';
import {Hand,Pause,Play,RotateCcw} from 'lucide-react';
import AndroidMascot from './AndroidMascot';

export default function AndroidRobotScene(){
  const stage=useRef(null),controller=useRef(null);
  const [state,setState]=useState('loading');
  const [paused,setPaused]=useState(false);
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [entrance,setEntrance]=useState(0),[greetings,setGreetings]=useState(0);
  const motion=useRef({paused,reduced});
  motion.current={paused,reduced};

  useEffect(()=>{
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const change=()=>setReduced(preference.matches);
    change();
    if(preference.addEventListener){
      preference.addEventListener('change',change);
      return()=>preference.removeEventListener('change',change);
    }
    preference.addListener?.(change);
    return()=>preference.removeListener?.(change);
  },[]);

  useEffect(()=>{
    let disposed=false;
    import('../lib/androidRobot').then(({createAndroidRobot})=>{
      if(disposed)return;
      controller.current=createAndroidRobot(stage.current,{
        ...motion.current,
        onContextLost:()=>{if(!disposed)setState('fallback');},
      });
      setState('ready');
    }).catch(()=>{if(!disposed)setState('fallback');});
    return()=>{disposed=true;controller.current?.dispose();controller.current=null;};
  },[]);

  useEffect(()=>{controller.current?.setMotion(paused,reduced);},[paused,reduced]);

  function replay(){
    setEntrance(value=>value+1);
    setPaused(false);
    controller.current?.replay();
  }
  function greet(){
    setGreetings(value=>value+1);
    controller.current?.greet();
  }

  return <div className="android-character">
    <span className="android-hello-word" aria-hidden="true">hello.</span>
    <div className="android-robot-scene" data-state={state} data-motion={reduced?'reduced':paused?'paused':'playing'} data-entrance={entrance}>
      <div className="android-robot-canvas" ref={stage} role="img" aria-hidden={state!=='ready'||undefined} aria-label="A glossy green Android robot walks towards you, tilts its head, and waves hello."/>
      {state!=='ready'&&<div className="android-robot-fallback"><AndroidMascot key={entrance} dimensional animated={state==='fallback'&&!paused&&!reduced}/></div>}
    </div>
    <div className="android-character-caption">
      <p className="android-robot-greeting" aria-live="polite" aria-atomic="true">{greetings?greetings%2?'A wave, just for you. Let’s find a good movie.':'Hey again, movie buddy. Make yourself at home.':'Little robot. Your next movie buddy.'}</p>
      <div className="android-character-controls">
        <button className="android-greet-button" onClick={greet}><Hand size={16}/><span>Say hello</span></button>
        {!reduced&&<>
          <button className="android-replay-button" onClick={replay} aria-label="Replay entrance" title="Replay entrance"><RotateCcw size={16}/></button>
          <button className="android-motion-toggle" onClick={()=>setPaused(value=>!value)} aria-pressed={paused} aria-label={paused?'Play mascot animation':'Pause mascot animation'} title={paused?'Play animation':'Pause animation'}>{paused?<Play size={15}/>:<Pause size={15}/>}</button>
        </>}
      </div>
    </div>
  </div>;
}
