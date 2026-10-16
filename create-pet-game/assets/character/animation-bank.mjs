// Read-only HTML/work adapter. Bundle this module into the final inline script.
const failure = code => Object.assign(new Error(code), {code});

export async function loadClip(character, catalog, state, {maxFrames = 512} = {}) {
  const meta = catalog.states.find(s => s.id === state)?.variants.find(v => v.available);
  if (!meta) return null; // Optional missing actions are not fabricated.
  if (meta.frameCount > maxFrames) throw failure('ANIMATION_MEMORY_BUDGET');
  const frames = [];
  let offset = 0;
  do {
    const page = await character.getAnimation({state, variant: meta.index, offset, limit: 24, signature: catalog.signature});
    if (page.key !== catalog.key || page.signature !== catalog.signature) throw failure('CHARACTER_ANIMATION_CHANGED');
    if (page.state !== state || page.variant !== meta.index || page.frameCount !== meta.frameCount ||
        page.fps !== meta.fps || page.loop !== meta.loop || page.face !== meta.face ||
        !page.frames.length || page.frames.length > 24 || page.frames.some((f, i) => f.index !== offset + i)) {
      throw failure('ANIMATION_PAGE_INVALID');
    }
    frames.push(...page.frames);
    const next = frames.length < meta.frameCount ? frames.length : null;
    if (frames.length > meta.frameCount || page.nextOffset !== next) throw failure('ANIMATION_PAGE_INVALID');
    offset = next;
  } while (offset !== null);
  return {...meta, state, key: catalog.key, signature: catalog.signature, frames};
}

export function frameAt(clip, elapsedMs) {
  const index = Math.max(0, Math.floor(elapsedMs * clip.fps / 1000));
  return clip.frames[clip.loop ? index % clip.frames.length : Math.min(index, clip.frames.length - 1)];
}

// Register the subscription before the initial read. Build a replacement bank
// offscreen and publish atomically; a failed reload leaves the previous bank.
// onChange may decode images before committing them, but should finish promptly.
export async function followAnimations(pet, {states = ['idle', 'walk'], maxFrames = 512, onChange, onError = () => {}}) {
  for (const name of ['getAnimationCatalog', 'getAnimation', 'watch', 'next', 'unwatch']) {
    if (typeof pet?.character?.[name] !== 'function') throw failure('ANIMATION_API_UNSUPPORTED');
    const status = await pet.capabilities.query('character.' + name);
    if (status.status !== 'available') throw failure(status.status);
  }
  const character = pet.character;
  const subscription = await character.watch();
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    await character.unwatch(subscription);
  };
  async function refresh() {
    // Bound retries under rapid changes; do not loop until quota exhaustion.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const catalog = await character.getAnimationCatalog(), clips = {};
        let used = 0;
        for (const state of new Set(['idle', ...states])) {
          try {
            const clip = await loadClip(character, catalog, state, {maxFrames: maxFrames - used});
            if (clip) { clips[state] = clip; used += clip.frames.length; }
          } catch (error) {
            if (state === 'idle' || !['CHARACTER_STATE_UNAVAILABLE', 'CHARACTER_ANIMATION_INVALID',
              'CHARACTER_ANIMATION_UNAVAILABLE', 'CHARACTER_ANIMATION_TOO_LARGE', 'ANIMATION_MEMORY_BUDGET'].includes(error.code)) throw error;
            onError(error); // Optional invalid/oversized assets must not hide idle.
          }
        }
        if (!clips.idle) throw failure('CHARACTER_STATE_UNAVAILABLE');
        if (!stopped) await onChange({key: catalog.key, signature: catalog.signature, clips});
        return;
      } catch (error) {
        if (error.code !== 'CHARACTER_ANIMATION_CHANGED' || attempt === 1) throw error;
      }
    }
  }
  try { await refresh(); }
  catch (error) { await stop(); throw error; }
  // Exactly one next() request per subscription. Errors terminate and release;
  // the UI can offer retry after authorization/support changes.
  const done = (async () => {
    try {
      while (!stopped) {
        const change = await character.next(subscription);
        if (!change || stopped) break;
        await refresh(); // watch's revision is opaque, not a catalog signature.
      }
    } catch (error) { if (!stopped) onError(error); }
    finally { await stop(); }
  })();
  return {stop, done};
}
