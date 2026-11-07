import React,{useEffect,useRef,useState} from 'react';
import {Shuffle} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {api} from '../lib/api';
import {notify} from '../lib/notifications';

export default function SurpriseButton({className=''}){
  const navigate=useNavigate();
  const [loading,setLoading]=useState(false);
  const request=useRef(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  const surprise=async()=>{
    if(loading||request.current)return;
    const controller=new AbortController();request.current=controller;
    setLoading(true);
    try{
      const data=await api('/api/home',controller.signal);
      const items=[...(data.featured||[]),...(data.rows||[]).flatMap(row=>row.items||[])];
      const unique=[...new Map(items.filter(item=>item?.id&&item?.kind).map(item=>[`${item.kind}:${item.id}`,item])).values()];
      const pick=unique[Math.floor(Math.random()*unique.length)];
      if(pick)navigate(`/title/${pick.kind}/${pick.id}`);
      else notify({message:'No titles are available yet. Try exploring the catalog.',tone:'info'});
    }catch(error){if(error.name!=='AbortError')notify({message:'Could not find a story right now. Please try again.',tone:'error'});}
    finally{request.current=null;if(!controller.signal.aborted)setLoading(false);}
  };
  return <button type="button" className={`surprise-button ${className}`} onClick={surprise} disabled={loading}><Shuffle/>{loading?'Finding a story…':'Surprise me'}</button>;
}
