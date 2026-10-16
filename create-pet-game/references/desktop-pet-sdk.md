# HTML/work SDK 契约快照

核对日期：2026-10-16。以下是桌宠已实现的 HTML 作品能力，部分接口仍为 experimental。**不以应用版本号推测支持情况**；页面运行时探测 `window.pet` 和方法是否存在，必要时查询 capability。旧宿主不支持时显示明确提示，而不是降级成假联机。本包不包含宿主源码、安装包或私有服务地址。

## 最小单文件声明

```html
<script id="pet-sdk" type="application/json">
{"version":2,"permissions":["character:read","sessions:connect"],"network":[],"interaction":{"players":2,"transport":"lan","protocol":{"id":"my-pet-game","version":1}}}
</script>
```

声明是能力申请，不等于授权。`id="pet-sdk"` 在整页只能出现一次，不能带 `src`。协议 ID 由字母/数字开头，随后为字母/数字/点/下划线/冒号/连字符，最多 64 字符；版本为正整数。`players:2` 兼容面最广，某些宿主支持 3–4 人但本起点只实现双人。

可选的 `<meta name="desktop-pet-display" content="desktop-overlay">` 请求桌面覆盖显示；不写则普通作品卡窗口。单文件上限 10 MiB。图片可用内嵌 data URL 或授权读取的角色 data URL；脚本/CSS 全部内联。

宿主限制脚本来源并按内容计算 CSP 哈希：不要依赖远端 script、内联 onclick 等事件属性、eval/new Function、iframe、Worker、弹窗或任意跳转。用 `addEventListener`。JS 模块/第三方库应先打包为本地 IIFE，再内联；保留所需第三方许可。

## 授权、角色与退出

```js
const available = await pet.capabilities.query('character.getCurrent');
const grant = await pet.capabilities.request({});
if (grant.status !== 'granted') { /* 显示未授权，停止依赖这些能力的路径 */ }
const character = await pet.character.getCurrent({states:['idle']});
// {key, name, signature, poses:[{id,label,dataUrl}]}
```

先请求 `idle`，不要假设每个角色都有 walk/greet。数据只含当前角色请求姿势的图像；不要把制作人的私有角色包打进公开作品。能力缺失或 `CHARACTER_STATE_UNAVAILABLE` 要有可见降级说明。

### 完整动作与连续换装

新接口 `character.getAnimationCatalog()` / `getAnimation({state,variant?,offset?,limit?,signature?})` 支持 HTML work 读取完整原始帧，复用 character:read；用 character:watch 的 watch/next/unwatch 跟随当前形象。具体分页、版本竞争、可执行加载器和 Web 内移动示例见 [复用产品动画](host-animations.md)。getCurrent 代表图、完整动作帧和实时3D数据分别使用对应接口；普通 HTML 没有插件专用 pet.pet.playAnim 或桌面窗口位移方法。

### 实时换装外观

`await pet.character.getRealtime()` 使用同一个 `character:read` 权限。先探测方法和 `pet.capabilities.query('character.getRealtime')`。

普通 2D 角色返回 `null`；支持的实时形象返回 `{key,name,signature,renderer,dataVersion,data,assets}`。`assets[id]` 为 `{contentType,dataBase64}`，没有路径，也不是可直接给 img 的 URL。当前已核对 `rat-doll-renderer` 的数据 v2：`data.person`、`headScale`、`garments.top/bottom.kind` 和各素材键；解析与渲染使用包内适配器。详见 [角色与风格](character-and-style.md)。

`getCurrent` 与 `getRealtime` 的 key 必须一致；读到不同角色说明读取期间形象变更，应重试。此接口不会授予 `pet.render`、宿主渲染控制或任意模型加载权限。不要在 HTML 里使用插件专用的 `appearance.apply` 等接口。

`window.desktopGame?.exit()` 只关闭自己的作品窗口。离开对局先 `await pet.sessions.leave()`；页面关闭后宿主也会回收会话。当前默认房主关窗会结束该局，没有自动房主迁移。

## sessions

仅 HTML work 上下文、声明并获授 `sessions:connect` 后可用。所有方法按 Promise 处理。

| 方法 | 输入 | 返回/意义 |
| --- | --- | --- |
| `getContext()` | 无 | 未绑定邀请为 `null`；否则下述 context |
| `join()` | 无 | `{status:'waiting'或'connected',epoch,limits,peerStatus}`，加入**当前邀请** |
| `send(message)` | 下述消息 | `{status:'queued'或'peer_received',seq}`，不是游戏业务已执行的证明 |
| `poll({cursor,waitMs})` | cursor≥0，waitMs 0–10000 | `{cursor,events,transportState,epoch}` |
| `transfer(asset)` | 下述素材 | `{transferId,sha256,byteLength}` |
| `readTransfer({transferId})` | 收到的素材 ID | `{transferId,sha256,byteLength,contentType,purpose,dataBase64}` |
| `leave()` | 无 | `{released:true,peerAcknowledged:boolean}` |

Context：`{invitationId,artifactHash,protocol:{id,version},role:'host'或'guest',peer:{sessionPeerId,displayName},expiresAt}`。从这里取角色；不要凭启动顺序/IP 猜。`artifactHash` 由宿主按整份 HTML 计算，邀请绑定同一产物。

可靠消息：`{lane:'reliable',type:'game.ready',messageId:crypto.randomUUID(),payload:{...}}`。不能带 key。

最新状态：`{lane:'latest',key:'input',type:'game.input',payload:{...}}`。必须带 key，不能带 messageId；同 key 只保留最新状态，可合并/跳过。type/key 均为字母数字开头的短标识符，不含空格。

Poll events 的重要部分：

```js
{type:'message',message:{lane,type,payload, /* key 或 messageId */ }}
{type:'transfer',transferId,sha256,byteLength,contentType,purpose}
{type:'resync_required',reason}
{type:'closed',reason}
```

`transportState` 为 waiting/connected/reconnecting/closed。一次只挂一个 poll 等待者。即便某个事件处理失败也推进 batch.cursor；否则会永久重放坏事件。epoch 改变/要求 resync 后用完整快照恢复，不继续应用旧增量。

素材：`{purpose:'game.portrait.v1',contentType:'image/png',dataBase64:'...'}`；支持 PNG、WebP、application/octet-stream。base64 是原始字节的编码，不带 data URL 前缀。只读取该会话收到的 transferId；宿主负责摘要与会话绑定。

## 限额（留余量）

可靠单消息 8192 B；latest 单消息 60 KiB；最多 8 个 latest key；单素材 1 MiB；会话保留素材约 8 MiB；poll 返回批量约 64 KiB。会话限速约 30 次 send/秒、512 KiB/秒，SDK 方法另有调用方配额；不要把这些数字当推荐发送速率。

本包桥接默认把 latest 合并至总计约 20 次/秒，并按约 128 KiB/秒节流。游戏仍需控制对象大小、素材量和可靠动作数。可靠接收保留记录有界，不能逐帧走 reliable；键鼠边沿用累积计数或业务动作编号去重。

## 没有的接口

没有网页端 `createRoom()`、`joinRoom(code)`、`send_file()`、`ask_user_choice()`、`lan_game_generate()`；没有原始 IPC、Node 或主机路径。不要臆造。好友选择、文件投递和入场邀请由桌宠宿主提供，Codex 只交付 HTML。
