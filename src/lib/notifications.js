let nextId=0;
let messages=[];
const listeners=new Set();
const emit=()=>listeners.forEach(listener=>listener());

export function notify({message,actionLabel,onAction,tone='success'}){
  if(!message)return;
  const id=++nextId;
  messages=[...messages,{id,message,actionLabel,onAction,tone}].slice(-3);
  emit();
  return id;
}

export function dismissNotification(id){
  messages=messages.filter(message=>message.id!==id);
  emit();
}

export const subscribeNotifications=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
export const getNotifications=()=>messages;
