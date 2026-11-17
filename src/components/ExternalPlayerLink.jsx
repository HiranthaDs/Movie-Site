import React,{useCallback,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useModalFocus} from '../lib/useModalFocus';

// Confirm only navigations Cinera starts. A third-party iframe owns its own popups.
export default function ExternalPlayerLink({href,children,className='',target='_top',...props}){
  const [open,setOpen]=useState(false);
  const panelRef=useRef(null);
  const close=useCallback(()=>setOpen(false),[]);
  useModalFocus(open,panelRef,close);
  return <>
    <button type="button" className={className} onClick={()=>setOpen(true)} {...props}>{children}</button>
    {open&&createPortal(<div className="external-player-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="external-player-title" aria-describedby="external-player-description" className="external-player-dialog">
        <span className="player-state-label">LEAVING CINERA</span>
        <h2 id="external-player-title">Open the external player?</h2>
        <p id="external-player-description">This provider may show ads or open other pages. Cinera cannot control its popups or video buttons.</p>
        <div className="external-player-actions">
          <button type="button" className="button button-glass external-player-cancel" onClick={close}>Stay in Cinera</button>
          <a className="button button-primary" href={href} target={target} rel={target==='_blank'?'noopener noreferrer':undefined} onClick={close}>Open player</a>
        </div>
      </div>
    </div>,document.body)}
  </>;
}
