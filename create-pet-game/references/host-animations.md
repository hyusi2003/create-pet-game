# 复用产品动画制作可交互 Web

核对 2026-10-16 的公开契约：[类型](https://github.com/ShunyuYao/pet-plugin-types/blob/4abb17b/index.d.ts)、[脚手架说明](https://github.com/ShunyuYao/create-pet-plugin/blob/ca71e03/README.md)、[市场 SDK 边界](https://github.com/ShunyuYao/pet-plugin-registry/blob/31b6655/registry/SDK.md)。完整动作读取是 experimental、尚无已发布最低宿主版本；先探测目标客户端能力，不能按类型包/应用版本文字猜支持。新的交互 Web 优先复用当前形象已有动作，不重复生成同一套素材。

## 两种上下文

| 目的 | 真实接口与边界 |
| --- | --- |
| 在 HTML 内画当前宠物，行走/说话/睡觉或自定义动作 | `pet.character.getAnimationCatalog()` + `getAnimation(options)`；HTML work、tool/panel/block，需 `character:read`。作品控制 Web 内的位置、碰撞和动作切换。 |
| HTML 内宠物随产品换装即时更新 | `pet.character.watch()/next(id)/unwatch(id)`；另需 `character:watch`。订阅整个页面生命周期。 |
| 插件让桌面宠物本体播放动作 | 仅插件 tool/panel/block，需 `pet`：`pet.pet.getAnimations()` 查询首变体元数据，`pet.pet.playAnim(state)` 派发动作。返回 true 仅表示派发，不是播放完成。 |

普通 HTML 没有 `pet.pet.playAnim`，也没有桌面窗口 `moveTo/moveBy` 或原始 IPC。播放 walk 与移动桌面窗口不是同一件事。Web 交互时直接复用 walk 帧并移动自己的画布角色；如需求确实是跨桌面移动本体，报告现有权限/接口缺口，不能虚构方法或扩大宿主能力。不要为绕过边界把普通 Web 擅自改造成高权限插件。

## 声明与完整读取

在唯一的 `pet-sdk` 声明中加入 `character:read`、`character:watch`；联网游戏保留 `sessions:connect` 与既有 interaction。声明不等于授权，通过实际按钮请求宿主同意，获授权后再开始订阅。旧宿主/拒绝授权/撤销时显示状态及重试；可明确退回 getCurrent 代表图，但不能说完整动作与实时换装已通过。

普通非联机 Web 使用宿主支持的 v1 声明，例如 `{"version":1,"permissions":["character:read","character:watch"],"network":[]}`；双人游戏使用 [SDK 契约](desktop-pet-sdk.md) 中的 v2 声明及完整 interaction。不要把仅含只读权限、没有 interaction 的对象标成 version:2：当前宿主会以 invalid interaction 拒绝，页面无法打开。v1/v2 是作品声明格式，与新增动画方法是否受支持是不同维度；都要运行时探测。

授权以返回状态与 capabilities 查询为准；当前本机预览的基础权限可由宿主直接授予，不一定出现确认弹窗。不要硬等一个不存在的弹窗，也不要把自动授予误判成没有经过权限检查。

目录返回 `{key,name,signature,states:[{id,variants:[{index,frameCount,fps,loop,face?,available,errorCode?}]}]}`。只读取要用的动作和实际可用变体；缺 walk 可明确回 idle，不能把缺帧伪装成完整行走动画。getCurrent 只提供代表图，不能循环那一张冒充完整动作。

帧页调用 `getAnimation({state,variant,offset,limit:24,signature:catalog.signature})`，返回身份、state/variant、frameCount/fps/loop/face、`frames:[{index,dataUrl}]`、`nextOffset`。跟随 nextOffset 到 null；每页最多24帧/原始6MiB，单帧2MiB，字节上限可能提前截页，不能用 offset += 24。收到 CHARACTER_ANIMATION_CHANGED 时丢弃整次旧加载，重新取目录后有限重试，不能混合两版帧。watch 的 revision.signature 与动画目录签名属于不同快照，不能混用。

图像本地解码/缓存后按 fps 与 elapsed 选帧，loop=false 停在最后一帧或由玩法明确回 idle；face 只按实际左右朝向镜像一次。每帧只绘制，不按渲染帧率读 SDK/磁盘。目录/帧页限额分别60/240次每分钟、并发各2；按需加载、有界内存，读取失败保留上一套有效画面并给出反馈。额外高分辨率/长动作应按作品内存预算评估，不一次预载所有动作。

## 可执行的接线示例

随包 [animation-bank.mjs](../assets/character/animation-bank.mjs) 提供 `loadClip`、`frameAt`、`followAnimations`。复制到作品项目并随 game.js 离线 bundle，不在成品使用相对 import/CDN。适配器只是只读帧加载与订阅，不替代 Room、Looks、规则或联网形象交换。其默认512帧是示例内存预算，不是宿主格式上限。

```js
import {followAnimations, frameAt} from './animation-bank.mjs';
const image = document.querySelector('#actor');
const keys = new Set();
let bank, facing = 1, x = 80, last = performance.now(), elapsed = 0, action = 'idle';
let follower, disposed = false;
function report(error) { document.querySelector('#status').textContent = String(error.code || error.message); }
addEventListener('keydown', e => { if (['ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); keys.add(e.key); } });
addEventListener('keyup', e => keys.delete(e.key));
addEventListener('blur', () => keys.clear());
async function startAfterConsent() {
  follower = await followAnimations(window.pet, {
    states: ['idle','walk'], onError: report,
    async onChange(next) {
      // Decode replacement before switching; retain x, game state and old bank.
      await Promise.all(Object.values(next.clips).flatMap(c => c.frames.map(async f => {
        const im = new Image(); im.src = f.dataUrl; await im.decode();
      })));
      if (!disposed) { bank = next; elapsed = 0; }
    }
  });
  if (disposed) await follower.stop();
}
function draw(now) {
  if (disposed) return;
  const dt = Math.min(50, now - last); last = now;
  const direction = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
  if (direction) facing = direction;
  x = Math.max(0, Math.min(Math.max(0, innerWidth - image.width), x + direction * dt * 0.12));
  const nextAction = direction && bank?.clips.walk ? 'walk' : 'idle';
  if (action !== nextAction) { action = nextAction; elapsed = 0; }
  elapsed += dt;
  const clip = bank?.clips[action];
  if (clip) {
    image.src = frameAt(clip, elapsed).dataUrl;
    image.style.transform = `translateX(${x}px) scaleX(${clip.face && clip.face !== facing ? -1 : 1})`;
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
// Call after the game's actual consent button resolves granted. Catch failures
// in that handler and offer retry; stop any old follower before retrying.
// await startAfterConsent().catch(report);
addEventListener('pagehide', () => { disposed = true; follower?.stop().catch(report); }, {once:true});
```

元素用绝对定位，transform-origin:center；不要把游戏的焦点抢到宿主宠物窗。真实键盘移动要检查最终画面中的位置与动作帧；换装时保留位置与玩法进度。开始订阅在首次读取之前，关闭/撤权/终止时 unwatch；不能在重试时叠加订阅或无限重试耗尽配额。

多人按 [公共 pet-kit](pet-kit.md) 现有 Room/Looks 入口接入，先检查固定版本是否已经消费新帧接口；指南或 SDK 更新不会自动升级 vendor。只传要用且获授权的素材，按内容签名去重，不因收包/ACK而重复传图。读取本机完整帧不代表对端已经取得完整帧，也不将 2D 帧自动转换为 3D 骨架。
