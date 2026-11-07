import {useEffect} from 'react';

// Keep keyboard navigation inside the dialog, including browsers without inert.
export function useModalFocus(open,ref,onClose){
  useEffect(()=>{
    if(!open||!ref.current)return;
    const previous=document.activeElement;
    const panel=ref.current;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const focusable=()=>[...panel.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter(node=>node.getClientRects().length);
    focusable()[0]?.focus({preventScroll:true});
    const keydown=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}
      if(event.key!=='Tab')return;
      const nodes=focusable(),first=nodes[0],last=nodes[nodes.length-1];
      if(!nodes.length){event.preventDefault();return;}
      if(!panel.contains(document.activeElement)||(event.shiftKey&&document.activeElement===first)){event.preventDefault();(event.shiftKey?last:first)?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',keydown,true);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown,true);if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[open,ref,onClose]);
}
