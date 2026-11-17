import React from 'react';
import {RefreshCw} from 'lucide-react';
import {useAppUpdate} from '../lib/pwa';

export default function AppUpdateNotice(){
  const {available,apply}=useAppUpdate();
  if(!available)return null;
  return <div className="app-update-notice" role="status" aria-live="polite"><RefreshCw size={21}/><div><strong>A new Cinera version is ready.</strong><span>Update when you finish watching.</span></div><button type="button" onClick={apply}>Update now</button></div>;
}
