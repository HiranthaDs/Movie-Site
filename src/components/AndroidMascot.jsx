import React,{useEffect,useId,useRef,useState} from 'react';

export function AndroidIcon({size=24,className='',...props}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false" {...props}>
    <path d="m7.1 4-1-1.7a.6.6 0 0 1 1-.6l1.1 1.8a9.8 9.8 0 0 1 7.6 0l1.1-1.8a.6.6 0 1 1 1 .6L16.9 4A7 7 0 0 1 20 9H4a7 7 0 0 1 3.1-5ZM4 10h16v7a2 2 0 0 1-2 2h-1v2a1.5 1.5 0 0 1-3 0v-2h-4v2a1.5 1.5 0 0 1-3 0v-2H6a2 2 0 0 1-2-2Zm-2 .5A1.5 1.5 0 0 1 3.5 12v4A1.5 1.5 0 0 1 .5 16v-4A1.5 1.5 0 0 1 2 10.5Zm20 0a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-3 0v-4a1.5 1.5 0 0 1 1.5-1.5Z"/>
    <circle cx="8.5" cy="6.5" r=".8" fill="var(--android-eye, #fff)"/><circle cx="15.5" cy="6.5" r=".8" fill="var(--android-eye, #fff)"/>
  </svg>;
}

// Vector geometry and animated joints keep the sculpted mascot crisp at any
// resolution, without a WebGL context or a large model download on TV browsers.
export default function AndroidMascot({dimensional=false,animated=true,decorative=false,className=''}){
  const id=useId().replace(/:/g,'');
  const mascot=useRef(null);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    if(typeof IntersectionObserver!=='function'){setVisible(true);return;}
    const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{threshold:.2});
    observer.observe(mascot.current);
    return()=>observer.disconnect();
  },[]);
  const paint=name=>dimensional?`url(#${id}-${name})`:'currentColor';
  return <svg ref={mascot} className={`android-mascot ${dimensional?'is-sculpted':'is-flat'} ${animated&&visible?'is-waving':''} ${className}`} viewBox="0 0 440 460" fill="none" role={decorative?undefined:'img'} aria-hidden={decorative||undefined} aria-label={decorative?undefined:'A friendly green Android robot waving hello'} focusable="false">
    {dimensional&&<defs>
      <linearGradient id={`${id}-body`} x1="136" y1="210" x2="288" y2="355" gradientUnits="userSpaceOnUse"><stop stopColor="#c3ff80"/><stop offset=".34" stopColor="#73e54c"/><stop offset=".72" stopColor="#3dbb36"/><stop offset="1" stopColor="#21853c"/></linearGradient>
      <radialGradient id={`${id}-head`} cx="0" cy="0" r="1" gradientTransform="translate(175 117) rotate(54) scale(152 170)" gradientUnits="userSpaceOnUse"><stop stopColor="#e3ffa7"/><stop offset=".35" stopColor="#8cec59"/><stop offset=".76" stopColor="#49c637"/><stop offset="1" stopColor="#269941"/></radialGradient>
      <linearGradient id={`${id}-limb`} x1="0" x2="1"><stop stopColor="#b7fc78"/><stop offset=".4" stopColor="#66d942"/><stop offset="1" stopColor="#249942"/></linearGradient>
      <linearGradient id={`${id}-base`} x1="180" y1="380" x2="180" y2="445" gradientUnits="userSpaceOnUse"><stop stopColor="#ecefe3"/><stop offset="1" stopColor="#c0c9b5"/></linearGradient>
      <radialGradient id={`${id}-shadow`}><stop stopColor="#1d4226" stopOpacity=".25"/><stop offset="1" stopColor="#1d4226" stopOpacity="0"/></radialGradient>
    </defs>}
    {dimensional&&<g><ellipse cx="219" cy="432" rx="161" ry="24" fill={`url(#${id}-shadow)`}/><path d="M82 388c0-22 61-39 137-39s137 17 137 39v20c0 22-61 39-137 39S82 430 82 408Z" fill={`url(#${id}-base)`}/><ellipse cx="219" cy="388" rx="137" ry="39" fill="#f7faef"/><ellipse cx="219" cy="388" rx="89" ry="22" fill={`url(#${id}-shadow)`}/></g>}
    <g className="android-mascot-body">
      <rect x="155" y="305" width="43" height="81" rx="21.5" fill={paint('limb')}/><rect x="239" y="305" width="43" height="81" rx="21.5" fill={paint('limb')}/>
      <g transform="rotate(12 112 226)"><rect x="81" y="211" width="43" height="111" rx="21.5" fill={paint('limb')}/></g>
      <g className="android-wave-arm"><g transform="rotate(34 322 230)"><rect x="302" y="129" width="43" height="119" rx="21.5" fill={paint('limb')}/>{dimensional&&<path d="M313 146v66" stroke="#e2ffb7" strokeWidth="6" strokeLinecap="round" opacity=".4"/>}</g></g>
      <path d="M131 210h174v102a31 31 0 0 1-31 31H162a31 31 0 0 1-31-31Z" fill={paint('body')}/>
      {dimensional&&<path d="M142 224v80a26 26 0 0 0 17 25" stroke="#d5ff9c" strokeWidth="5" strokeLinecap="round" opacity=".35"/>}
      <path d="m161 123-17-31m130 31 17-31" stroke={dimensional?'#67d644':'currentColor'} strokeWidth="9" strokeLinecap="round"/>
      <path d="M128 197c0-51 40-91 90-91s90 40 90 91Z" fill={paint('head')}/>
      {dimensional&&<path d="M146 165c10-26 29-42 53-46" stroke="#efffd1" strokeWidth="5" strokeLinecap="round" opacity=".55"/>}
      <ellipse cx="179" cy="161" rx="7" ry="9" fill={dimensional?'#143b27':'var(--android-eye, #fff)'}/><ellipse cx="258" cy="161" rx="7" ry="9" fill={dimensional?'#143b27':'var(--android-eye, #fff)'}/>
      {dimensional&&<g opacity=".22" fill="#fff"><circle cx="177" cy="158" r="2"/><circle cx="256" cy="158" r="2"/></g>}
    </g>
    <g className="android-wave-lines" stroke={dimensional?'#34894d':'currentColor'} strokeWidth="4" strokeLinecap="round"><path d="m367 121 12-10m-27-8 3-15m24 51 16-3"/></g>
  </svg>;
}
