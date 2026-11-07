export function parseEmbedPlayerMessage(input){
  let payload=input;
  if(typeof payload==='string'){
    try{payload=JSON.parse(payload);}catch{return null;}
  }
  if(!payload||typeof payload!=='object')return null;
  const body=payload.type==='PLAYER_EVENT'&&payload.data&&typeof payload.data==='object'?payload.data:payload;
  if(!['play','pause','ended','timeupdate'].includes(body.event))return null;
  const rawTime=body.currentTime??body.timestamp;
  const rawDuration=body.duration;
  const seconds=value=>{
    if(typeof value!=='number'&&(typeof value!=='string'||!value.trim()))return undefined;
    const number=Number(value);
    return Number.isFinite(number)&&number>=0&&number<=Number.MAX_SAFE_INTEGER?number:undefined;
  };
  return {
    event:body.event,
    currentTime:seconds(rawTime),
    duration:seconds(rawDuration),
  };
}

export function embedUrlWithProgress(sourceUrl,resume=0){
  const url=new URL(sourceUrl);
  const value=Number(resume);
  const seconds=Number.isFinite(value)&&value>0?Math.floor(Math.min(value,Number.MAX_SAFE_INTEGER)):0;
  if(seconds>0)url.searchParams.set('progress',String(seconds));
  else url.searchParams.delete('progress');
  return url.toString();
}

export const shouldUseFullPagePlayer=(sourceType,isConfirmedTv)=>sourceType==='iframe'&&isConfirmedTv===true;
