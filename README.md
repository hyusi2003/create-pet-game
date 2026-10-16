# create-pet-game

一个可独立安装的 Codex skill：按用户选择的玩法，生成能导入兼容桌宠、邀请好友局域网联机的单文件 HTML 小游戏。制作过程不需要桌宠源码仓库，玩法不限于固定模板。

## 安装和使用

制作环境：Codex、Node.js 22+。浏览器检查另需 Chrome/Chromium。

```sh
git clone https://github.com/hyusi2003/create-pet-game.git
cd create-pet-game
node install.mjs
```

安装后新开 Codex 会话，输入：

> $create-pet-game 帮我做一个双人局域网井字棋，中文界面，用桌宠当头像，先让我选择规则，最后生成能导入桌宠的 HTML。

技能会引导确认必要的玩法选择，实现游戏并进行打包、兼容检查及可用环境下的操作验证。支持提问选项卡的环境使用选项卡，其余环境通过聊天选择。

**Skill 装进 Codex，生成的 HTML 导入桌宠。** 玩家无需 Node、模型 API Key、自建服务器或源码。真实联机需要支持 HTML/work SDK v2、`sessions:connect` 和作品邀请的桌宠客户端；普通浏览器打开只是本地预览。

完整说明见 [INSTALL.md](INSTALL.md)。也可下载 [独立技能压缩包](dist/create-pet-game-0.2.2.zip)，解压后运行安装器。安装器默认使用 `$CODEX_HOME/skills`，未设置时使用 `~/.codex/skills`，已有同名技能不会被覆盖。

## 桌宠形象和风格

新游戏默认调用公共 [pet-kit](https://github.com/ShunyuYao/pet-kit)，复用 `Room` 的房间/准备/事件/状态流/时钟/预算，以及 `Looks` 的形象读取/校验/缓存和房间素材交换；0.3.0 新增可选 `Motion` 远端显示缓冲；规则、场景、本地预测和运动字段/边界适配仍由作品实现。[接入指南](create-pet-game/references/pet-kit.md) 核对 pet-kit 0.3.0 的固定源码 SHA，要求 vendor、公开入口、构建前摘要校验、离线 bundle 与 MIT 许可。当前 starter 仍是旧桥技术夹具，初始化后要替换接线，不会自动安装或接入 pet-kit。

制作默认参考 ShunyuYao 的 [赛车](https://github.com/ShunyuYao/pet-kart)、[坦克](https://github.com/ShunyuYao/pet-tank)、[水球](https://github.com/ShunyuYao/pet-bomb)、[颜料](https://github.com/ShunyuYao/pet-paint)、[大乱斗](https://github.com/ShunyuYao/pet-brawl) 的 3D 场景/布偶，以及 [躲猫猫](https://github.com/ShunyuYao/pet-hide-duel) 的姿势编辑，按玩法选择相关源码。具体文件、快照、许可与呈现区别见 [3D 游戏参考](create-pet-game/references/3d-game-reference.md)。用户指定 2D 或其他风格时遵从，不把技能自己生成的 2D 示例作为新作品视觉依据。

制作与验收还参考 [大乱斗/赛车的联机修复](create-pet-game/references/network-lessons.md)：客人自身角色回拉、其他车停住再跳跃、ACK 时间线、重连重复传形象、乱序/晚加入和准备恢复。检查双方实际操作及最终绘制轨迹，不能只验房主画面或“能连上”。缓冲/外推参数按具体玩法实测，保持房主规则权威。

随包 `PetDollSprite` 将兼容 rat-doll v2 外观转为 idle/walk 透明 PNG，`character3d:true` 不等于实时 3D 场景或通用骨架。完整 3D 需要在作品项目中实现并离线打包对应场景/角色适配；浏览器预览无法读取桌宠，会明确标注。公共参考中的多人/中转不改变本技能双人 LAN 构建契约。

## 完成后直接接入产品

0.2.1 补齐 [产品导入流程](create-pet-game/references/product-import.md)：最终 HTML + 实际画面封面 → SHA-256 目录材料 → 用户授权的本机目录/资源接入 → 真实「传 vibe → 逗 TA 一下 → 游戏」及发送联机验收。具备热加载的实例更新列表无需重启；首次启用热加载代码或更换只读安装包仍需正常升级。

```sh
node create-pet-game/scripts/prepare-vibe-import.mjs \
  --html ./dist/my-game.html --poster ./dist/cover.webp \
  --output ./delivery/my-game --id my-game --title "我的游戏"
```

材料工具不依赖宿主源码，不覆盖旧输出；它准备字节与条目，不伪装成已经修改产品。用户要求接入且宿主检出可访问时，skill 会继续登记并验证；独立制作者仍可只交付 HTML。不会因此自动公开发布或给好友发送。

同时制作自定义形象时，按 [形象接入流程](create-pet-game/references/appearance-import.md) 将预览/动作输出转换为合法外观包，从「伙伴外观 → 导入形象」登记，按授权即时换上，再验游戏读取当前外观。2D 帧、制作草稿与实时 3D 使用各自契约；预览成功不等于产品已导入。

New games use ShunyuYao's public 3D game implementations as their visual/architecture references; this repository's 2D examples remain regression fixtures. The bundled sprite adapter only renders realtime appearance data into PNG poses; a live 3D scene needs its own offline-bundled implementation. The portable builder still targets two-player LAN play. `prepare-vibe-import.mjs` prepares exact bytes and catalog metadata without host source or overwriting an existing output. Product registration continues only in an accessible, user-authorized host environment; packet preparation is not proof of installation. Catalog hot reload depends on the running host. No host installers, download/update locations or private character assets are distributed here.

For custom appearances, convert authoring/preview output to the host's supported appearance package, import it through the appearance library, apply only as authorized, and verify the game reads the selected appearance. Current local 2D application is immediate and preserves companion identity. Drafts and realtime 3D assets require their respective contracts; preview success alone does not prove import or game compatibility.

The networking reference now includes the author's recent Brawl and Kart fixes: guest-local correction, remote motion on authority time, ACK/prediction separation, bounded appearance recovery and ready-state ordering. Acceptance observes both players' actual rendered trajectories under normal and batched traffic; these references do not certify a new game's multiplayer behavior.

New games should call the public pet-kit Room/Looks abstraction, pin a reviewed source commit, vendor it, verify the copy before each build, and bundle it offline with its MIT license. Gameplay, rendering and business acknowledgements remain game responsibilities. The current starter is still a legacy bridge fixture: neither initialization nor HTML assembly automatically installs or integrates pet-kit, and the game must not run both session loops. See the [integration guide](create-pet-game/references/pet-kit.md) for the verified pet-kit 0.3.0 API and boundaries. Motion is an opt-in, transport-independent display buffer: preserve original simulation timestamps, reject stale generations, reset at lifecycle transitions, and keep sampled poses out of authoritative state and local input prediction.

## 技术回归夹具

[桌宠突击 HTML](examples/pet-strike.html) 展示纸板掩体射击、完整桌宠预览和场景角色，源码位于 [examples/pet-strike](examples/pet-strike)。

[桌宠井字棋 HTML](examples/pet-tictactoe.html) 是仅依据本技能独立生成的作品，源码位于 [examples/tictactoe](examples/tictactoe)。从桌宠文件发送入口选择同网好友，选择「发送并一起玩」，双方按宿主提示完成邀请及能力授权后准备开局。

以上保留用于独立打包、权限、角色读取和联机回归，**不作为新游戏的视觉/玩法参考**。新作品按上面的作者游戏参考制作；复杂玩法仍需限定小游戏范围并验证性能。

## 仓库内容

- `create-pet-game/`：技能说明、SDK 契约、独立桥接、起始工程和 Node 工具。
- `install.mjs`：将技能复制到当前 Codex 的技能目录。
- `examples/`：可导入的技术回归夹具和源码。
- `tests/`：无需桌宠仓库即可运行的制作、浏览器和模拟协议检查。
- `package_skill.py`：使用明确文件清单生成分发 ZIP 与 SHA-256。

## 验证

```sh
npm test
npm run test:vibe-import
npm run test:browser
npm run test:character-browser
node tests/example-protocol.mjs
node tests/example-gameplay.mjs examples/pet-tictactoe.html --out evidence/example
npm run pack
```

安装 skill、运行随包工具及旧桥夹具检查无需 npm 依赖；采用 pet-kit / 3D 引擎的新作品按其工程安装制作依赖并离线 bundle，玩家仍不需要这些依赖。技能 ZIP 打包另需 Python 3。维护者修改随包 3D 组件源码后，运行 `npm ci && npm run build:character` 重建已提交的 IIFE。第三方源码、版本和许可位于 `create-pet-game/assets/character/`。已完成独立目录构建、ZIP 安装、浏览器真实输入和模拟协议验证。维护者另外在两个隔离的真实桌宠进程中验证过文件发送、邀请配对、授权、头像交换、对局、重开及退出；这些宿主测试不构成公开客户端版本兼容承诺。

尚未验证物理双机 LAN、Windows 安装、跨子网/防火墙环境。模拟协议、同机双实例和物理双机测试是不同的证据。

## 许可

[MIT](LICENSE)。桥接和示例许可会随 HTML 保留；不改变用户原创游戏内容的权利，第三方素材另遵守其许可。本仓库不提供桌宠宿主源码、安装包或私有角色资产。


## 0.2.2 无重启导入与复用产品动作

制作并接入时，按 [在线导入避坑](create-pet-game/references/live-import.md) 完成形象/游戏的当前客户端登记及即时验证。离线进程写库、复制文件、看到卡片都不是完整验收。游戏库热刷新保留草稿、准备好的附件与进行中的对局；新内容以新导入/打开进入，不替换历史字节。

Web 行走等交互优先用 [完整动作读取与换装订阅](create-pet-game/references/host-animations.md)，包含可离线打包的帧加载器与移动示例。HTML 读取并绘制自己的角色；桌面本体 playAnim 是插件上下文接口，没有网页端桌面 moveTo。新 Web 持续跟随换装，不要求重启。完整帧接口为 experimental，先探测并授权；没有已发布最低宿主版本承诺。

Use the running client's import flow, then verify live rendering without restarting. Offline library writes are not live registration. Catalog refresh preserves drafts, prepared artifacts and active matches. New Web works reuse original animation pages and keep an appearance subscription; movement in the Web scene belongs to the work. Plugin-only desktop playback does not grant HTML desktop-window control. Feature-detect the experimental frame APIs; no released minimum host version or automatic migration of existing games is implied.
