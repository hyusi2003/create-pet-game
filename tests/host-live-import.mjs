// Optional maintainer gate. Requires an explicitly supplied, compatible host
// checkout; no host source, user assets or credentials ship with this skill.
// Real UI/file input/SDK/renderer. Account admission and OS keystore use the
// host's isolated synthetic fixture; native login/Keychain are not under test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
if(!process.env.PET_HOST_ROOT)throw Error('Set PET_HOST_ROOT to an actual compatible host checkout; missing dependencies are not a pass.');
const host=path.resolve(process.env.PET_HOST_ROOT),H=require(path.join(host,'tests/e2e-helpers.js'));
const {activateButton,activateClosingButton}=require(path.join(host,'tests/e2e/html-card-input.js'));
const esbuild=require(path.join(host,'demo/node_modules/esbuild'));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-plugin-appearance-peer-delivery-skill-'));
const profile=path.join(root,'profile');fs.mkdirSync(profile);
const evidence=path.resolve(process.env.PET_SKILL_EVIDENCE||path.join('evidence/host-live-import',new Date().toISOString().replace(/[:.]/g,'-')));fs.mkdirSync(evidence,{recursive:true});
const native=path.join(evidence,'native.jsonl');fs.writeFileSync(native,'');
let child,pet,library,work,monitor;const monitors=[];
async function observeErrors(target){const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params);};socket.send(JSON.stringify({id:1,method:'Runtime.enable'}));monitors.push(socket);}const errors=[],checks=[];let seq=0;const pending=new Map();
const check=label=>{checks.push(label);console.log('PASS',label);};
const evaluate=(target,expr)=>H.evalIn(target,expr);
async function wait(fn,label){for(let i=0;i<160;i++){if(await fn())return;await H.sleep(100);}throw Error('Timeout: '+label);}
async function command(method,params={}){const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},10000);pending.set(id,m=>{clearTimeout(timer);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result);});monitor.send(JSON.stringify({id,method,params}));});}
async function shot(target,name){await evaluate(target,'document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');const s=await H.cdp(target,'Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,name+'.png'),Buffer.from(s.data,'base64'));}
async function boot(){
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 child=H.launch({userData:profile,cdpPort:port,bootstrap:path.join(host,'tests/helpers/vibe-peer-delivery-bootstrap.js'),args:['--mute-audio'],env:{PET_E2E_TEST:'1',PET_PUBLIC_NATIVE_LOG:native,PET_VIBE_PEER_HOST_ROOT:host,PET_VIBE_PEER_E2E_UID:'910103',PET_E2E_ENV_CONFIG:JSON.stringify({test:{accountApiBase:'http://127.0.0.1:1/api',relayUrl:'',analyticsEvents:'',agentTrace:'',diagnostics:''}})}});
 pet=await H.findTarget(port,'/index.html');await wait(()=>evaluate(pet,'typeof currentCharKey==="string"&&!!frames.idle?.[0]?.[0]?.naturalWidth'),'pet painted');return port;
}
async function openLibrary(port){
 await evaluate(pet,'petAPI.openResidentPanel();true');const panel=await H.findReadyTarget(port,'dashboard.html','dashboard');
 await activateButton(panel,'[data-action=resident-more]',{capture:false});await activateButton(panel,'[data-action=resident-appearance]',{capture:false});
 library=await H.findReadyTarget(port,'companion-diy.html','companionDiy');
 monitor=new WebSocket(library.webSocketDebuggerUrl);await new Promise((r,j)=>{monitor.onopen=r;monitor.onerror=j;});
 monitor.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 await command('Runtime.enable');await command('Page.enable');await command('Page.setInterceptFileChooserDialog',{enabled:true});
}
async function importAppearance(file){
 await activateButton(library,'[data-al=import]',{capture:false});const {root:doc}=await command('DOM.getDocument');const {nodeId}=await command('DOM.querySelector',{nodeId:doc.nodeId,selector:'[data-al=import-files]'});await command('DOM.setFileInputFiles',{nodeId,files:[file]});
 await wait(()=>evaluate(library,'!document.querySelector("[data-al=import]").disabled'),'import complete');
 const r=await evaluate(library,'companionDiy.getAppearances()');assert.equal(r.ok,true);assert.deepEqual(r.errors||[],[]);return r;
}
async function apply(item){await activateButton(library,`[data-al=apply][data-id=${JSON.stringify(item.id)}]`,{capture:false});await wait(()=>evaluate(pet,`currentCharKey===${JSON.stringify(item.id)}&&frames.idle[0].every(im=>im.naturalWidth>0)`),'live apply');}
function png(r,g,b){
 const crc=bytes=>{let v=0xffffffff;for(const c of bytes){v^=c;for(let i=0;i<8;i++)v=v&1?(v>>>1)^0xedb88320:v>>>1;}return (v^0xffffffff)>>>0;};
 const chunk=(name,bytes)=>{const n=Buffer.from(name),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(bytes.length);checksum.writeUInt32BE(crc(Buffer.concat([n,bytes])));return Buffer.concat([length,n,bytes,checksum]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(1);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(Buffer.from([0,r,g,b,255]))),chunk('IEND',Buffer.alloc(0))]);
}
try{
 fs.writeFileSync(path.join(profile,'config.json'),JSON.stringify({character:'nienie',petName:'Keep identity',characterPrompts:{nienie:'Keep persona'},onboarding:{completed:true},behavior:{idleStroll:false,autoSleep:false,randomWalk:false},crossScreen:{lanEnabled:false},general:{autoCheckUpdates:false},tts:{enabled:false},relay:{url:''},plugins:{registrySources:[]}}));
 fs.writeFileSync(profile+'.environment-selection.json',JSON.stringify({environment:'test'}));
 const port=await boot(),pid=child.pid;
 // Bundle the shipped adapter, not a rewritten loader, into a plain single HTML.
 const entry=`import {followAnimations,frameAt} from ${JSON.stringify(fileURLToPath(new URL('../create-pet-game/assets/character/animation-bank.mjs',import.meta.url)))};
 let bank,follower,x=80,moving=false,last=performance.now(),time=0;window.revisions=[];
 const actor=document.querySelector('#actor'),status=document.querySelector('#status');
 document.querySelector('#start').addEventListener('click',async()=>{try{const g=await pet.capabilities.request({});if(g.status!=='granted')throw Error(g.status);follower=await followAnimations(pet,{onChange:async next=>{await Promise.all(Object.values(next.clips).flatMap(c=>c.frames.map(async f=>{const im=new Image();im.src=f.dataUrl;await im.decode()})));bank=next;window.revisions.push(next.key);status.textContent=next.key;},onError:e=>status.textContent=e.message});}catch(e){status.textContent=e.message}});
 addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();moving=true}});addEventListener('keyup',e=>{if(e.key==='ArrowRight')moving=false});
 function tick(now){const dt=Math.min(50,now-last);last=now;time+=dt;if(moving)x=Math.min(400,x+dt*.12);const clip=bank?.clips[moving?'walk':'idle']||bank?.clips.idle;if(clip){actor.src=frameAt(clip,time).dataUrl;actor.style.transform='translateX('+x+'px)';window.observed={x,key:bank.key,count:clip.frames.length,frame:frameAt(clip,time).index};}requestAnimationFrame(tick)}requestAnimationFrame(tick);
 window.stopFollower=async()=>{await follower.stop();await follower.done;return true};addEventListener('pagehide',()=>follower?.stop());`;
 const code=esbuild.buildSync({stdin:{contents:entry,resolveDir:root},bundle:true,format:'iife',write:false}).outputFiles[0].text;
 const html=path.join(root,'animation-contract.html');fs.writeFileSync(html,`<!doctype html><meta charset="utf-8"><style>body{font:18px sans-serif;background:#fff9ed;color:#272333;padding:24px}#actor{position:absolute;top:300px;left:0;width:96px;height:96px;object-fit:contain}button{padding:14px}#status{margin:20px}</style><h1>产品动作复用验证</h1><p>按右方向键移动；换装时保留位置。</p><button id="start">授权并读取动作</button><div id="status">等待授权</div><img id="actor"><script id="pet-sdk" type="application/json">{"version":1,"permissions":["character:read","character:watch"],"network":[]}</script><script>${code}</script>`);
 await evaluate(pet,'runCommand("voice");true');const chat=await H.findTarget(port,'/chat.html');await wait(()=>evaluate(chat,'!!window.chatAPI'),'chat preload');
 const point=await evaluate(pet,'({x:LX+SIZE/2,y:LY+SIZE/2})'),data={items:[{mimeType:'text/html',data:'',title:path.basename(html),baseURL:''}],files:[html],dragOperationsMask:1};
 for(const type of ['dragEnter','dragOver','drop'])await H.cdp(pet,'Input.dispatchDragEvent',{type,...point,data});
 await wait(()=>evaluate(chat,'!!document.querySelector("[data-html-preview]")'),'local HTML imported');await activateButton(chat,'[data-html-preview]');
 await wait(async()=>{work=(await (await fetch('http://127.0.0.1:'+port+'/json')).json()).find(t=>t.url.startsWith('pet-work://')&&!t.url.includes('thumbnail=1'));return !!work;},'actual work target');await wait(()=>evaluate(work,'document.readyState==="complete"&&!!window.pet&&!!document.querySelector("#start")'),'work API');assert.equal(await evaluate(work,'typeof pet.pet'),'undefined');
 await observeErrors(work);await observeErrors(pet);await activateButton(work,'#start');
 await wait(async()=>{const dialog=(await (await fetch('http://127.0.0.1:'+port+'/json')).json()).find(t=>t.url.includes('/dialog.html'));if(dialog)await activateClosingButton(port,dialog,'.btn-primary');return evaluate(work,'window.observed?.count===32');},'host permission flow');
 await wait(()=>evaluate(work,'window.observed?.count===32'),'all 32 frames loaded');check('real HTML import and host consent load all 32 idle frames through shipped adapter');
 await H.cdp(work,'Emulation.setFocusEmulationEnabled',{enabled:true});await H.cdp(work,'Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});const rendered=[];for(let i=0;i<4;i++){await H.sleep(95);await H.cdp(work,'Page.captureScreenshot',{format:'png'});rendered.push(await evaluate(work,'window.observed.frame'));}assert.ok(new Set(rendered).size>1,'actual rendered animation advances: '+JSON.stringify(rendered));assert.equal(await evaluate(work,'document.querySelector("#actor").naturalWidth>0'),true);await H.cdp(work,'Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
 assert.ok((await evaluate(work,'window.observed.x'))>95);const x=await evaluate(work,'window.observed.x');check('real keyboard moves Web actor while original animation frames play');await shot(work,'original-animation');
 await openLibrary(port);
 const source=path.join(root,'appearance');fs.mkdirSync(source);const file=path.join(source,'character.json');
 fs.writeFileSync(file,JSON.stringify({name:'Neutral live fixture',anim:{idle:{dir:'.',base:'frame',count:2,pad:2,fps:12},walk:{dir:'.',base:'frame',count:2,pad:2,fps:12}}}));
 fs.writeFileSync(path.join(source,'frame00.png'),png(120,80,200));fs.writeFileSync(path.join(source,'frame01.png'),png(100,160,230));
 let r=await importAppearance(file),item=r.items.find(i=>i.kind==='runtime2d');assert.ok(item);await apply(item);
 await wait(()=>evaluate(work,`window.observed?.key===${JSON.stringify(item.id)}`),'open HTML follows new appearance');assert.equal(await evaluate(work,'window.observed.x'),x);
 const before=r.items.length;r=await importAppearance(file);assert.equal(r.items.length,before);check('current client imports/applies appearance without restart; open HTML follows and preserves position; duplicate is idempotent');
 fs.writeFileSync(path.join(source,'frame01.png'),png(240,170,80));r=await importAppearance(file);const updated=r.items.find(i=>i.kind==='runtime2d'&&i.id!==item.id);assert.ok(updated);await apply(updated);
 await wait(()=>evaluate(work,`window.observed?.key===${JSON.stringify(updated.id)}`),'open HTML follows updated bytes');assert.equal(await evaluate(work,'window.observed.x'),x);assert.equal(child.pid,pid);await shot(work,'updated-live-animation');await shot(library,'live-library');
 const config=JSON.parse(fs.readFileSync(path.join(profile,'config.json')));assert.equal(config.petName,'Keep identity');assert.equal(config.characterPrompts.nienie,'Keep persona');check('updated bytes receive new import id and apply in same process; Web follows twice with identity/persona preserved');
 assert.equal(await evaluate(work,'window.stopFollower()'),true);check('active long-poll subscription is released explicitly');
 monitor.close();monitor=null;for(const s of monitors.splice(0))s.close();await H.stopOwned(child);fs.writeFileSync(path.join(evidence,'host.log'),child.log);child=null;
 await boot();await wait(()=>evaluate(pet,`currentCharKey===${JSON.stringify(updated.id)}`),'fresh instance persistence');check('separate fresh-instance test restores applied selection; restart was not needed for import');
 await H.stopOwned(child);fs.appendFileSync(path.join(evidence,'host.log'),child.log);child=null;
 const windows=fs.readFileSync(native,'utf8').trim().split('\n').map(JSON.parse);assert.ok(windows.length&&windows.every(w=>!w.isVisible&&!w.isFocused));assert.deepEqual(errors,[]);check('all test windows hidden before first paint; no observed renderer exception or error console');
 fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify({checks,errors,scope:'Real import, consent, animation pages and appearance hot update. Synthetic account admission; isolated profile. No native login, physical peers or OS focus claim.'},null,2));
}catch(error){fs.writeFileSync(path.join(evidence,'failure.txt'),String(error.stack));for(const [t,n] of [[work,'failure-work'],[library,'failure-library']])if(t)await shot(t,n).catch(()=>{});throw error;}
finally{for(const s of monitors)s.close();monitor?.close();if(child){fs.writeFileSync(path.join(evidence,'host.log'),child.log);await H.stopOwned(child);}fs.rmSync(root,{recursive:true,force:true});}
