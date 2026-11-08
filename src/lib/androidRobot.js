// Loaded only by the Android page. The character is a small, articulated model;
// lighting and transparent rendering let it live directly on the page.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const ease=value=>{const t=clamp(value);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;

export function createAndroidRobot(host,options){
  const cleanups=[];
  try{return buildAndroidRobot(host,options,cleanup=>cleanups.push(cleanup));}
  catch(error){
    // A driver can fail during environment/shader setup after the canvas exists.
    // Release every resource already created before showing the SVG fallback.
    for(const cleanup of cleanups.reverse()){try{cleanup();}catch{}}
    throw error;
  }
}

function disposeScene(scene){
  const geometries=new Set(),materials=new Set();
  scene.traverse(part=>{if(part.geometry)geometries.add(part.geometry);if(part.material)materials.add(part.material);});
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
}

function buildAndroidRobot(host,{paused=false,reduced=false,onContextLost},onFailure){
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power'});
  if(!context)throw new Error('WebGL is unavailable');
  const renderer=new THREE.WebGLRenderer({canvas,context,alpha:true,antialias:true});
  onFailure(()=>{renderer.dispose();renderer.forceContextLoss();canvas.remove();});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
  renderer.setClearColor(0x000000,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.9;
  canvas.setAttribute('aria-hidden','true');
  host.appendChild(canvas);

  const scene=new THREE.Scene();
  onFailure(()=>disposeScene(scene));
  const camera=new THREE.PerspectiveCamera(36,1,.1,60);
  const environment=new RoomEnvironment();
  onFailure(()=>environment.dispose());
  const pmrem=new THREE.PMREMGenerator(renderer);
  onFailure(()=>pmrem.dispose());
  const environmentMap=pmrem.fromScene(environment,.04);
  onFailure(()=>environmentMap.dispose());
  scene.environment=environmentMap.texture;
  scene.environmentIntensity=.6;
  environment.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff,0x4b6840,1.1));
  const key=new THREE.DirectionalLight(0xfff9e8,2.5);
  key.position.set(-3,6,4);scene.add(key);
  const rim=new THREE.DirectionalLight(0xe5ffd7,1.8);
  rim.position.set(4,3,-3);scene.add(rim);

  const green=new THREE.MeshPhysicalMaterial({color:0x50b91d,metalness:.04,roughness:.32,clearcoat:.45,clearcoatRoughness:.28});
  const dark=new THREE.MeshPhysicalMaterial({color:0x07130b,roughness:.32,clearcoat:.4});
  const robot=new THREE.Group();scene.add(robot);
  function mesh(geometry,material,parent,x=0,y=0,z=0){
    const part=new THREE.Mesh(geometry,material);
    part.position.set(x,y,z);parent.add(part);return part;
  }
  // Rounded cylinder profile keeps the classic Android silhouette, with soft
  // bevels that catch the light around the shoulders and lower edge.
  const profile=[new THREE.Vector2(0,.67),new THREE.Vector2(.66,.67)];
  for(let i=0;i<=8;i++){
    const a=-Math.PI/2+i*Math.PI/16;
    profile.push(new THREE.Vector2(.66+.12*Math.cos(a),.79+.12*Math.sin(a)));
  }
  profile.push(new THREE.Vector2(.78,1.86));
  for(let i=0;i<=8;i++){
    const a=i*Math.PI/16;
    profile.push(new THREE.Vector2(.72+.06*Math.cos(a),1.86+.06*Math.sin(a)));
  }
  profile.push(new THREE.Vector2(0,1.92));
  mesh(new THREE.LatheGeometry(profile,64),green,robot);

  const head=new THREE.Group();head.position.y=2.03;robot.add(head);
  mesh(new THREE.SphereGeometry(.84,64,32,0,Math.PI*2,0,Math.PI/2),green,head);
  const headBase=mesh(new THREE.CircleGeometry(.84,64),green,head);
  headBase.rotation.x=Math.PI/2;
  const eyes=[];
  for(const sign of [-1,1]){
    const antenna=mesh(new THREE.CapsuleGeometry(.043,.42,5,12),green,head,sign*.54,.79,0);
    antenna.rotation.z=-sign*.47;
    const eye=mesh(new THREE.SphereGeometry(1,24,16),dark,head,sign*.32,.38,.686);
    eye.scale.set(.075,.105,.034);eye.rotation.y=sign*.28;eye.rotation.x=-.3;
    eyes.push(eye);
  }
  const arms=[],legs=[];
  for(const sign of [-1,1]){
    const arm=new THREE.Group();arm.position.set(sign*1.005,1.73,0);robot.add(arm);
    mesh(new THREE.CapsuleGeometry(.19,.66,8,24),green,arm,0,-.34,0);
    arms.push(arm);
    const leg=new THREE.Group();leg.position.set(sign*.365,.81,0);robot.add(leg);
    mesh(new THREE.CapsuleGeometry(.215,.48,8,24),green,leg,0,-.36,0);
    legs.push(leg);
  }

  // A soft contact shadow, with no floor card, plinth, or scene background.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;
  const brush=shadowCanvas.getContext('2d');
  const gradient=brush.createRadialGradient(64,64,3,64,64,64);
  gradient.addColorStop(0,'rgba(27,53,18,0.29)');gradient.addColorStop(.38,'rgba(27,53,18,0.13)');gradient.addColorStop(1,'rgba(27,53,18,0)');
  brush.fillStyle=gradient;brush.fillRect(0,0,128,128);
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas);
  onFailure(()=>shadowTexture.dispose());
  const shadow=mesh(new THREE.PlaneGeometry(3.7,2.6),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}),scene,0,-.035,0);
  shadow.rotation.x=-Math.PI/2;

  let elapsed=0,lastTime=0,frame=0,visible=true,disposed=false,lost=false;
  let helloTime=-100,attention={x:0,y:0},look={x:0,y:0};

  function pose(time){
    const walk=ease(time/2.35),arrival=ease((time-2.1)/.65);
    const gait=Math.sin(time*10.7)*(1-ease((time-1.9)/.6));
    const hop=Math.sin(clamp((time-2.2)/.65)*Math.PI)*.13;
    robot.position.set(mix(3.2,-.12,walk),Math.abs(gait)*.07+hop,mix(-5,.66,walk)+Math.sin(arrival*Math.PI)*.4);
    robot.rotation.set(0,mix(-.48,-.10,walk),gait*.025);
    legs[0].rotation.x=gait*.55;legs[1].rotation.x=-gait*.55;
    arms[0].rotation.set(-gait*.55,0,-.08);
    arms[1].rotation.set(gait*.55,0,.08);
    const greetElapsed=time-helloTime;
    const initialWave=ease((time-2.65)/.55);
    // The first greeting finishes in a welcoming pose; Say hello repeats it.
    const waveTime=greetElapsed<3.6?greetElapsed:time-3.2;
    const waveEnergy=waveTime>=0?Math.max(0,1-waveTime/4.1):0;
    const wave=reduced?0:Math.sin(waveTime*10)*.24*waveEnergy;
    arms[1].rotation.z=mix(.08,2.24+wave,initialWave);
    arms[1].rotation.x*=1-initialWave;
    if(time>2.8){
      robot.position.y+=reduced?0:Math.sin(time*2.2)*.018;
      robot.rotation.z+=-.025*initialWave;
    }
    look.x=mix(look.x,attention.x,.07);look.y=mix(look.y,attention.y,.07);
    head.rotation.set(reduced?0:look.y*.08, reduced?0:look.x*.14,initialWave*(-.085+(reduced?0:Math.sin(time*1.5)*.018)));
    const blinkPhase=(time+1.5)%5.6;
    const blink=!reduced&&blinkPhase<.16?1-Math.sin(blinkPhase/.16*Math.PI)*.86:1;
    eyes.forEach(eye=>{eye.scale.y=.105*blink;});
    shadow.position.x=robot.position.x;shadow.position.z=robot.position.z;
    shadow.material.opacity=1-hop;
  }
  function render(){
    if(disposed||lost)return;
    pose(reduced?8:elapsed);
    renderer.render(scene,camera);
  }
  function canAnimate(){return !disposed&&!lost&&!paused&&!reduced&&visible&&!document.hidden;}
  function tick(now){
    frame=0;
    if(!canAnimate()){lastTime=0;return;}
    if(lastTime)elapsed+=Math.min((now-lastTime)/1000,.05);
    lastTime=now;render();
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    if(frame)cancelAnimationFrame(frame);
    frame=0;lastTime=0;
    if(visible&&!document.hidden)render();
    if(canAnimate())frame=requestAnimationFrame(tick);
  }
  function resize(){
    if(disposed||lost)return;
    const width=host.clientWidth,height=host.clientHeight;
    if(!width||!height)return;
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    camera.position.set(0,1.85,Math.max(7.1,4.6/camera.aspect));
    camera.lookAt(0,1.52,0);camera.updateProjectionMatrix();render();
  }
  function pointer(event){
    const rect=host.getBoundingClientRect();
    attention={x:clamp((event.clientX-rect.left)/rect.width*2-1,-1,1),y:clamp((event.clientY-rect.top)/rect.height*2-1,-1,1)};
  }
  function leave(){attention={x:0,y:0};}
  function contextLost(event){
    event.preventDefault();lost=true;sync();onContextLost?.();
  }
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();},{threshold:.05}):null;
  observer?.observe(host);
  const sizes=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;
  sizes?.observe(host);
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',sync);
  host.addEventListener('pointermove',pointer);host.addEventListener('pointerleave',leave);
  canvas.addEventListener('webglcontextlost',contextLost);
  onFailure(()=>{
    disposed=true;if(frame)cancelAnimationFrame(frame);
    observer?.disconnect();sizes?.disconnect();
    window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',sync);
    host.removeEventListener('pointermove',pointer);host.removeEventListener('pointerleave',leave);
    canvas.removeEventListener('webglcontextlost',contextLost);
  });
  resize();sync();

  return {
    setMotion(nextPaused,nextReduced){paused=nextPaused;reduced=nextReduced;sync();},
    replay(){elapsed=0;helloTime=-100;paused=false;sync();},
    greet(){helloTime=elapsed;sync();},
    dispose(){
      disposed=true;if(frame)cancelAnimationFrame(frame);
      observer?.disconnect();sizes?.disconnect();
      window.removeEventListener('resize',resize);
      document.removeEventListener('visibilitychange',sync);
      host.removeEventListener('pointermove',pointer);host.removeEventListener('pointerleave',leave);
      canvas.removeEventListener('webglcontextlost',contextLost);
      disposeScene(scene);
      shadowTexture.dispose();environmentMap.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    },
  };
}
