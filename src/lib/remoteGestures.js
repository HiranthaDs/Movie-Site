export const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export function gestureDirection(dx,dy,threshold=34){
  if(Math.max(Math.abs(dx),Math.abs(dy))<threshold)return '';
  if(Math.abs(dx)>=Math.abs(dy))return dx>0?'ArrowRight':'ArrowLeft';
  return dy>0?'ArrowDown':'ArrowUp';
}

export function gestureRepeatCount(dx,dy,threshold=34,max=4){
  const distance=Math.max(Math.abs(dx),Math.abs(dy));
  return clamp(Math.floor(distance/threshold),1,max);
}

export function nextPointerPosition(position,delta,bounds,sensitivity=1.65){
  const width=Math.max(1,finite(bounds?.width,1));
  const height=Math.max(1,finite(bounds?.height,1));
  const inset=Math.max(8,finite(bounds?.inset,18));
  const insetX=Math.min(inset,width/2),insetY=Math.min(inset,height/2);
  const speed=clamp(finite(sensitivity,1.65),0.1,5);
  const currentX=Number.isFinite(position?.x)?position.x:width/2;
  const currentY=Number.isFinite(position?.y)?position.y:height/2;
  return {
    x:clamp(currentX+finite(delta?.dx)*speed,insetX,width-insetX),
    y:clamp(currentY+finite(delta?.dy)*speed,insetY,height-insetY),
  };
}
