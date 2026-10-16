# 桌宠 HTML 游戏制作 · Codex skill

把这个技能装进 **Codex**，让 Codex 制作游戏；把生成的 **HTML 文件**导入桌宠。制作人无需桌宠源码仓库。玩家无需 Node、自建服务器、模型 API Key 或项目源码。

## 安装

解压完整压缩包。制作环境使用 Node.js 22+；在解压后的目录运行：

```sh
node install.mjs
```

默认安装到 `$CODEX_HOME/skills/create-pet-game`；没有设置 `CODEX_HOME` 时为 `~/.codex/skills/create-pet-game`。若你的 Codex 使用另一配置目录，可指定它的 skills 目录：

```sh
node install.mjs --to /path/to/your/codex/skills
```

也可以手动把 `create-pet-game` 整个文件夹复制到当前 Codex 的 skills 目录。不需要桌宠仓库，也不必安装 npm 依赖。安装器遇到同名目录会停止，更新时请先备份并移走旧版本。安装后新开一个 Codex 会话；如果未发现技能，请核对当前 Codex 实际使用的配置目录。

## 使用

在 Codex 中输入：

> $create-pet-game 帮我做一个双人局域网井字棋，中文界面，用我们的桌宠当头像，生成能导入桌宠的 HTML。

也可以提出射击、赛车、合作闯关等玩法。技能先澄清必要规则，已授权自行设计时直接展开。新作品默认参考 ShunyuYao 的赛车、坦克、水球、颜料、大乱斗等 3D 游戏，具体入口见 [游戏参考](create-pet-game/references/3d-game-reference.md)；用户明确要求 2D 时优先遵从。起始工程和包内 2D 示例只用于桥接/打包回归，不限制画面或玩法。

新作品实际调用公共 [pet-kit](create-pet-game/references/pet-kit.md) 的统一 Room/Looks 抽象；0.3.0 的可选 Motion 复用远端运动时间缓冲，作品仍处理本地输入与规则。固定版本与源码摘要、导出副本并离线打包。制作时由作品工程补齐公共包接线/构建，安装本 skill 不会自动下载 pet-kit；玩家仍只需 HTML。公共包不代替玩法与 3D 渲染，旧桥夹具不与它同时运行。

角色会在大厅及玩法中显示，支持 2D 代表姿势与兼容 rat-doll v2 数据。随包组件将实时数据转为正面 PNG；完整 3D 场景和连续骨架动作需在作品里另行实现并内联，不是切换 `character3d:true` 即可。读取失败提示并重试，复杂游戏先明确小游戏范围。

完成后取得一个 `.html` 文件。可以用普通浏览器预览，但真实联机需要双方运行支持 HTML/work SDK v2、`sessions:connect` 和作品邀请的桌宠客户端。技能不会安装或升级桌宠；这里不承诺未经验证的最低发布版本。

## 在桌宠中玩

1. 将生成的 HTML 交给桌宠的作品/文件发送入口，选择同一局域网的好友。
2. 选择「发送并一起玩」，对方打开收到的作品并接受邀请，双方按提示确认配对与作品能力授权。
3. 双方准备后开始；选择「仅分享」只发送文件，不建立对局。

好友使用收到的同一份 HTML；不需要房间服务器或手工填写 IP。包内 `examples/pet-strike.html` 和 `examples/pet-tictactoe.html` 保留用于技术回归，不作为新游戏的美术参考。设备信任步骤以兼容客户端的实际提示为准，支持自动设备信任的宿主可能无需配对码。

## 放到「传 vibe」游戏列表

向 Codex 明确要求「制作完成后直接放进我的传 vibe / 逗 TA 一下」，并提供可访问的本机宿主环境，即授权完成该环境的作品登记和验证。制作会生成封面、哈希回执和目录条目，再继续接入资源、目录及真实入口；无需在每个已授权步骤重复确认。操作方法见 [产品导入流程](create-pet-game/references/product-import.md)。

没有宿主检出也能准备便携材料：

```sh
node create-pet-game/scripts/prepare-vibe-import.mjs \
  --html ./dist/my-game.html --poster ./dist/cover.webp \
  --output ./delivery/my-game --id my-game --title "我的游戏"
```

该命令仅准备材料，不安装客户端或修改产品。具备目录热加载的运行实例可直接看到登记更新；只读安装包更新仍需正常升级，技能不会擅自重启日常客户端。旧附件和已有对局仍固定原文件。

如果还制作了自定义形象，另按 [形象接入流程](create-pet-game/references/appearance-import.md) 转换外观包、导入「伙伴外观」并按授权换上，随后验游戏大厅读取。形象制作预览和游戏材料工具都不等同于外观安装；当前 2D 换上可即时生效，3D 与草稿按各自契约处理。

## 验证与许可

技能自带静态兼容检查及可选 Chrome/Chromium 预览工具，要求交付时分别报告静态、浏览器、模拟协议、真实宿主和物理双机测试。没有桌宠时仍能完成制作，但不能声称真实联机已验证。

`create-pet-game/LICENSE` 覆盖技能及随附桥接/示例代码。生成器在 HTML 内保留这部分 MIT 许可；这不改变用户原创游戏内容的权利。使用第三方素材或引擎时另保留对应许可。


## 无重启导入与复用产品动作

制作并接入时，按 [在线导入避坑](create-pet-game/references/live-import.md) 完成形象/游戏的当前客户端登记及即时验证。离线进程写库、复制文件、看到卡片都不是完整验收。游戏库热刷新保留草稿、准备好的附件与进行中的对局；新内容以新导入/打开进入，不替换历史字节。

Web 行走等交互优先用 [完整动作读取与换装订阅](create-pet-game/references/host-animations.md)，包含可离线打包的帧加载器与移动示例。HTML 读取并绘制自己的角色；桌面本体 playAnim 是插件上下文接口，没有网页端桌面 moveTo。新 Web 持续跟随换装，不要求重启。完整帧接口为 experimental，先探测并授权；没有已发布最低宿主版本承诺。

Use the running client's import flow, then verify live rendering without restarting. Offline library writes are not live registration. Catalog refresh preserves drafts, prepared artifacts and active matches. New Web works reuse original animation pages and keep an appearance subscription; movement in the Web scene belongs to the work. Plugin-only desktop playback does not grant HTML desktop-window control. Feature-detect the experimental frame APIs; no released minimum host version or automatic migration of existing games is implied.
