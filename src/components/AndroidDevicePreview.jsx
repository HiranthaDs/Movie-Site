import React from 'react';
import desktopScreen from '../../docs/screenshots/home-desktop.png';
import mobileScreen from '../../docs/screenshots/home-mobile.png';

function Screen({type}){
  return <div className="android-device-screen"><img src={type==='phone'?mobileScreen:desktopScreen} alt="" loading="lazy" decoding="async"/></div>;
}

/** Decorative, front-facing previews. Device names and compatibility live in the card copy. */
export default function AndroidDevicePreview({type}){
  return <div className={`android-device-art android-device-preview device-art-${type}`} aria-hidden="true">
    <div className={`device-silhouette device-silhouette-${type}`}>
      <div className={`android-device-frame device-frame-${type}`}>
        <Screen type={type}/>
        {(type==='phone'||type==='tablet'||type==='laptop')&&<span className="device-camera"/>}
        {type==='tv'&&<div className="device-tv-chin"><span>CINERA</span><i/></div>}
      </div>
      {type==='tv'&&<div className="android-device-stand device-tv-feet"><span/><span/></div>}
      {type==='laptop'&&<div className="android-device-stand device-laptop-base"><span/></div>}
    </div>
    <span className="device-ground-shadow"/>
  </div>;
}
