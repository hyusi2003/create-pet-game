import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadClip, frameAt, followAnimations} from '../create-pet-game/assets/character/animation-bank.mjs';
const variant = (frameCount = 32) => ({index:0,frameCount,fps:12,loop:true,face:-1,available:true});
function fixture() {
  let revision = 1, pending, closed = false;
  const calls = [], changes = [], errors = [];
  const catalog = () => ({key:'cat-'+revision,name:'Cat',signature:String(revision).repeat(64),states:[{id:'idle',variants:[variant()]},{id:'walk',variants:[{...variant(2),loop:false}]}]});
  const pet = {capabilities:{query:async()=>({status:'available'})},character:{
    getAnimationCatalog:async()=>catalog(),
    getAnimation:async options => {
      calls.push(options);const c=catalog(),v=c.states.find(s=>s.id===options.state).variants[0];
      if (options.signature!==c.signature) throw Object.assign(Error('changed'),{code:'CHARACTER_ANIMATION_CHANGED'});
      // Deliberately byte-limited pages: 7, not requested 24.
      const end=Math.min(options.offset+7,v.frameCount);
      return {...c,...v,state:options.state,variant:options.variant,frames:Array.from({length:end-options.offset},(_,i)=>({index:options.offset+i,dataUrl:'data:image/png;base64,'+(options.offset+i)})),nextOffset:end<v.frameCount?end:null};
    },
    watch:async()=>{calls.push('watch');return 'sub';},
    next:async()=>closed?null:new Promise(resolve=>{pending=resolve;}),
    unwatch:async()=>{closed=true;calls.push('unwatch');pending?.(null);return true;}
  }};
  return {pet,catalog,calls,changes,errors,options:{onChange:b=>changes.push(b),onError:e=>errors.push(e)},change(){revision++;pending?.({key:'cat-'+revision,signature:'watch-revision-different-from-catalog'});}};
}
const turn = () => new Promise(resolve=>setImmediate(resolve));
test('full ordered frames follow byte-limited nextOffset; playback honors fps and loop',async()=>{
  const f=fixture(),clip=await loadClip(f.pet.character,f.catalog(),'idle');
  assert.equal(clip.frames.length,32);assert.deepEqual(f.calls.map(c=>c.offset),[0,7,14,21,28]);
  assert.equal(frameAt(clip,1000).index,12);assert.equal(frameAt(clip,4000).index,16);
  assert.equal(frameAt({...clip,loop:false},100000).index,31);
  assert.equal(await loadClip(f.pet.character,f.catalog(),'absent'),null);
  await assert.rejects(loadClip(f.pet.character,f.catalog(),'idle',{maxFrames:5}),/ANIMATION_MEMORY_BUDGET/);
});
test('no partial or mixed revision clip is published; stale signature has bounded retry',async()=>{
  const f=fixture(),original=f.pet.character.getAnimation;let once=true;
  f.pet.character.getAnimation=async o=>{if(o.offset>0&&once){once=false;f.change();}return original(o);};
  const follow=await followAnimations(f.pet,f.options);
  assert.equal(f.changes.length,1);assert.equal(f.changes[0].key,'cat-2');
  assert.ok(Object.values(f.changes[0].clips).every(c=>c.signature==='2'.repeat(64)));
  await follow.stop();await follow.done;
  const bad=fixture();bad.pet.character.getAnimation=async()=>{throw Object.assign(Error('changed'),{code:'CHARACTER_ANIMATION_CHANGED'});};
  await assert.rejects(followAnimations(bad.pet,bad.options),/changed/);
  assert.equal(bad.changes.length,0);assert.equal(bad.calls.filter(c=>c==='unwatch').length,1);
});
test('subscription precedes load and follows two changes without duplicate waiters; stop releases it',async()=>{
  const f=fixture(),follow=await followAnimations(f.pet,f.options);assert.equal(f.calls[0],'watch');
  f.change();await turn();f.change();await turn();
  assert.deepEqual(f.changes.map(c=>c.key),['cat-1','cat-2','cat-3']);
  await follow.stop();await follow.stop();await follow.done;
  assert.equal(f.calls.filter(c=>c==='unwatch').length,1);assert.deepEqual(f.errors,[]);
});
test('corrupt pages cannot silently truncate or hang a frame loop',async()=>{
  for(const mutate of [p=>({...p,nextOffset:0}),p=>({...p,frames:[]}),p=>({...p,frames:p.frames.map(f=>({...f,index:f.index+1}))}),p=>({...p,signature:'changed'})]){
    const f=fixture(),read=f.pet.character.getAnimation;f.pet.character.getAnimation=async o=>mutate(await read(o));
    await assert.rejects(loadClip(f.pet.character,f.catalog(),'idle'),/ANIMATION_PAGE_INVALID|CHARACTER_ANIMATION_CHANGED/);
  }
});
test('unsupported and unauthorized calls create no subscription; denied live reload retains old bank and releases',async()=>{
  for(const status of ['unsupported','not_authorized','revoked']){
    const f=fixture();f.pet.capabilities.query=async()=>({status});await assert.rejects(followAnimations(f.pet,f.options),new RegExp(status));assert.deepEqual(f.calls,[]);
  }
  const missing=fixture();delete missing.pet.character.getAnimation;await assert.rejects(followAnimations(missing.pet,missing.options),/UNSUPPORTED/);
  const f=fixture(),follow=await followAnimations(f.pet,f.options);
  f.pet.character.getAnimationCatalog=async()=>{throw Error('permission_denied');};f.change();await follow.done;
  assert.equal(f.changes.length,1);assert.equal(f.errors.length,1);assert.equal(f.calls.filter(c=>c==='unwatch').length,1);
});
test('optional absent/unavailable variants do not block idle; cancelled pending load never publishes',async()=>{
  const f=fixture(),get=f.pet.character.getAnimationCatalog;
  f.pet.character.getAnimationCatalog=async()=>{const c=await get();c.states[1].variants[0].available=false;return c;};
  const follow=await followAnimations(f.pet,f.options);assert.deepEqual(Object.keys(f.changes[0].clips),['idle']);
  let finish;f.pet.character.getAnimationCatalog=()=>new Promise(resolve=>finish=resolve);f.change();await turn();
  await follow.stop();finish(f.catalog());await follow.done;assert.equal(f.changes.length,1);
});

test('optional unreadable image bytes report error and retain working idle',async()=>{
  const f=fixture(),read=f.pet.character.getAnimation;
  f.pet.character.getAnimation=async o=>{if(o.state==='walk')throw Object.assign(Error('bad image'),{code:'CHARACTER_ANIMATION_INVALID'});return read(o);};
  const follower=await followAnimations(f.pet,f.options);
  assert.deepEqual(Object.keys(f.changes[0].clips),['idle']);assert.equal(f.errors[0].code,'CHARACTER_ANIMATION_INVALID');
  await follower.stop();await follower.done;
});
