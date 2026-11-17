import React from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,Check,ExternalLink,Home,RefreshCw,Share2,Smartphone,SquarePlus} from 'lucide-react';
import AppleBrand from '../components/AppleBrand';
import {usePwaInstall} from '../lib/pwa';
import preview from '../../docs/screenshots/home-mobile.png';
import '../iphone.css';

const steps=[
  {Icon:Smartphone,title:'Open Safari',body:'On your iPhone, open Cinera in Safari. Keep this site open while you follow the next steps.'},
  {Icon:Share2,title:'Tap Share',body:'Tap the Share button in Safari. Depending on your tab layout, open the Page Menu first and then tap Share.'},
  {Icon:SquarePlus,title:'Add to Home Screen',body:'Scroll through the share options and tap Add to Home Screen. If it is missing, scroll to the bottom and choose Edit Actions.'},
  {Icon:Home,title:'Open as Web App',body:'Turn on Open as Web App if shown, then tap Add. The Cinera icon appears on this iPhone’s Home Screen.'},
];

export default function IPhoneApp(){
  const {installed}=usePwaInstall();
  return <div className="iphone-page">
    <section className="iphone-hero" aria-labelledby="iphone-title"><div className="content-width iphone-hero-inner">
      <div className="iphone-hero-copy"><div className="iphone-eyebrow"><AppleBrand size={21}/> CINERA FOR IPHONE</div><h1 id="iphone-title">Cinema.<br/><em>Right at home.</em></h1><p>Bring your watchlist, discoveries, and movie nights to your iPhone Home Screen. Cinera installs as a web app from Safari. No App Store download is needed.</p><div className="iphone-hero-actions"><Link className="iphone-button iphone-button-dark" to="/">Open Cinera <ArrowRight size={18}/></Link><a className="iphone-text-link" href="#iphone-steps">How to install <ArrowRight size={16}/></a></div><div className="iphone-install-status"><Check size={15}/>{installed?'Cinera is open as a web app on this device':'Free to add · No account needed'}</div></div>
      <div className="iphone-visual" aria-label="Cinera on an iPhone"><div className="iphone-orbit iphone-orbit-one"/><div className="iphone-orbit iphone-orbit-two"/><div className="iphone-device"><div className="iphone-island"/><img src={preview} alt="Cinera movie discovery screen on a phone"/><div className="iphone-home-indicator"/></div><div className="iphone-app-tile"><img src="/icons/apple-touch-icon.png" alt="Cinera app icon" width="50" height="50"/><span><strong>One tap away.</strong><small>From your Home Screen.</small></span></div></div>
    </div></section>
    <section className="iphone-benefits content-width" aria-label="iPhone web app benefits"><div><strong>01</strong><span>Full-screen feel</span></div><div><strong>02</strong><span>Your list stays with you</span></div><div><strong>03</strong><span>Updates from the web</span></div></section>
    <section className="iphone-steps-section" id="iphone-steps" aria-labelledby="iphone-steps-title"><div className="content-width"><div className="iphone-section-heading"><span>THE SIMPLE SETUP</span><h2 id="iphone-steps-title">Four taps closer<br/>to movie night.</h2><p>Use Safari on the iPhone where you want Cinera. Apple’s menu labels can vary slightly by iOS version.</p></div><ol className="iphone-steps">{steps.map(({Icon,title,body},index)=><li key={title}><div className="iphone-step-icon"><Icon size={27}/></div><span className="iphone-step-number">0{index+1}</span><h3>{title}</h3><p>{body}</p></li>)}</ol><a className="iphone-apple-guide" href="https://support.apple.com/guide/iphone/iphea86e5236/ios" target="_blank" rel="noopener noreferrer"><AppleBrand size={19}/> Read Apple’s Home Screen web app guide <ExternalLink size={16}/></a></div></section>
    <section className="iphone-updates content-width" aria-labelledby="iphone-updates-title"><div className="iphone-update-mark"><RefreshCw size={38}/></div><div><span className="iphone-section-kicker">ALWAYS MOVING FORWARD</span><h2 id="iphone-updates-title">New version? You’re in control.</h2><p>When a Cinera update is ready, a notice appears in the app. Tap <strong>Update now</strong> when you’re ready to reload; you can finish watching first. Reopen Cinera while online to check for updates. Your watchlist and playback progress stay on this device.</p></div></section>
    <section className="iphone-last content-width"><AppleBrand size={40}/><h2>Your next story<br/>starts here.</h2><p>Open Cinera in Safari, add it to your Home Screen, and come back whenever you’re ready for something good.</p><Link className="iphone-button iphone-button-light" to="/">Open Cinera <ArrowRight size={18}/></Link><Link className="iphone-android-link" to="/android">Looking for the Android TV APK? <ArrowRight size={16}/></Link></section>
    <p className="iphone-note content-width">Cinera is an independent web app and is not affiliated with Apple. Video availability and streaming speed depend on the selected provider and connection.</p>
  </div>;
}
