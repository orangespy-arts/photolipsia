# Photolipsia — Strategy

The agent's memory: plan, decisions, next steps. Read this first.
Human-readable project intro lives in `README.md`.

## Goal

A **generic** Gaussian-splat audiovisual visualizer. Any DSP source can drive
it; the visualizer only knows the AVParams protocol (`docs/protocol.md`),
never the source. Built as plain ES modules + Vite-less static dev server,
zero dependencies for now.

## Architecture (agreed 2026-10-26)

```
any DSP source → driver (AVParams) → mapping (pure fns) → splat render
```

Four drivers: `web-audio` (mic/file/display audio), `osc` (WebSocket bridge
← UDP ← Max/SC/PD), `midi` (Web MIDI), `mock` (synthetic + recorded playback).

## Plan

- [x] Stage 0 — repo skeleton: AGENTS.md/CLAUDE.md, protocol doc + validation
      with unit tests, driver registry + mock driver, dev server, check script
- [x] Stage 1 — splat rendering: **Spark** selected (v2.4.0, MIT, World Labs;
      Dyno shader-graph = per-splat GPU mutation, the decisive factor; gsplat.js
      and @mkkellogg/gaussian-splats-3d rejected). Test splat renders
      fullscreen, breathing verified. Import map added (zero-bundler cost).
- [x] Stage 2 — mapping layer: protocol → per-splat transforms (scale pulse,
      displacement, color), pure functions + unit tests. **Core landed as GPU
      dyno graph** (`src/render/avModifier.js`): region-band scale pulse,
      trig-wobble displacement, brightness response — all per-splat on GPU
      via `SplatMesh.objectModifier`. Hue rotation written but bypassed
      (YIQ path blackened colors; re-enable with a color-isolation test).
- [x] Stage 2b — hue rotation fixed (root cause: `dyno.vec3(a,b,c)`
      constructor corrupts output; rotated channels go straight into the
      vec4 combine — see log). Orientation verified via `?gain=` A/B
      (low → screen bottom ✓). `?gain=low=1.5,...` live-tuning params
      landed with unit tests; gain=0 mutes a field.
- [x] Stage 3 — web-audio driver (mic + file), auto-gain normalization,
      onset-grid beat estimation with HUD toggle (3a–3g complete)
- [x] Stage 4 — osc driver + dumb UDP↔WebSocket bridge (Node); E2E
      verified by user (test-sender → bridge → browser, monitor bars live)
- [x] Stage 5 — midi driver: note→events+onset, CC table→continuums,
      clock→beatPhase (real beat source); + simulate=1 scripted
      performance (no hardware needed); +6 sim/full-chain tests (94 total)
- [x] Stage 6 — param recorder/playback (.jsonl ring buffer → exact-frame
      binary-search playback driver, loop/t0), HUD rec button + ? help;
      E2E round trip verified by user
- [ ] Stage 7 — performance hardening: fixed 60fps path, latency check,
      multi-screen, full-offline rehearsal checklist
- [ ] Track 2 — minimal Unity project: URP + UnityGaussianSplatting +
      OSC listener (Room of Sounds OSC.cs), `/av/band/low` → splat scene
      breathing; protocol doc copied over as source of truth
      （**2026-11-04 升级为作业主线，见下方 Show 计划；OSC 部分留待
      未来实时演出阶段，本次作业音频在 Timeline 内排**）
      （**2026-11-04 搁置：用户弃用 Unity，作业改 Web + Hydra**）

## Decisions

- 2026-10-26: standalone repo, **not** the course fork; course conventions
  (AGENTS.md, strategy.md, check script) are borrowed but content is ours.
- 2026-10-26: pull-model drivers — render loop polls `driver.poll(now)`;
  smoothing/envelope/normalization belong to the driver, never the mapping.
- 2026-10-26: protocol v1 fields fixed in docs/protocol.md; sanitize on every
  untrusted ingress (OSC bridge, recordings).
- 2026-10-26: zero dependencies until splat rendering forces one (Stage 1).
- 2026-10-26 (revised): **two-track plan** — Unity is the live-performance
  destination; this web repo is its lab (cheap iteration on protocol/mapping)
  and the course deliverable. Unity project starts minimal (URP +
  UnityGaussianSplatting + OSC listener) and grows in parallel. Protocol doc
  is the single source of truth shared by both tracks.

## Next

- 2026-11-05：用户取消键盘映射，改为 RB/LB 切换 10 种区分明显的预设（W3f），计划已写，等 go。
- 2026-11-05：W3d 完成——VJ 页 H 隐藏/显示控制台与鼠标、`&perform=1` 直接进入并显示 2 秒提示、F 全屏。193 测试 + check 通过；内置浏览器截图确认 perform=1 只剩画面、H 来回切换正常。**F 全屏在内置浏览器面板里未生效**（requestFullscreen 已在用户激活下调用，但面板不进全屏也不报错），需用户在自己的 Chrome 里确认。W6a/W2a/W3a/W3c/W3d 均未提交。
- 2026-11-05：W3c 完成——A 闪白、X 色彩分离、Y 万花筒、Back 黑白、←/→ 色相、L3 像素化、R3 冻结，B 全清。190 测试 + check 通过；模拟手柄逐键截图确认画面变化，冻结时转镜头画面不变、松开恢复；本机 1024×768@1.25 全开四层 60fps。真实手柄未测。W6a/W2a/W3a/W3c 均未提交。
- 2026-11-05：W3a 完成——`?vj=1&scene=s01&audio=show` 播放固定曲目（11:59），场景 shake 律动 + Hydra 拖影/扭曲随音乐，扳机取大值叠加，B 静音音乐驱动，两个强度滑杆，空格播放/暂停。185 测试 + check 通过；浏览器实测音乐播放、切场不断、B 归零、滑杆 0 归零。观察：这首 DJ 混音下 onset 长期 0.6–0.8，扭曲脉冲偏"常开"，需用户听感后调（可能要提高 onset 门槛）。W6a/W2a/W3a 均未提交。下一步：用户真手柄 + 音乐整体试演。
- 2026-11-05：W2a 完成——Start 页内切下一场（上升沿、s10→s01 循环、加载中忽略、黑场淡入淡出、回新场入口、URL 同步）。181 测试 + check 通过；浏览器用模拟手柄验证 s09→s10→s01→s02→s03（加载中多按被忽略）、s03→s04 画面与 Hydra 状态正常。本机服务器下切场加载约 0.5–1 秒（此前 s10 的 20 秒应是面板隐藏导致的节流）。**更正**：每场实际 192 万 splat（非此前估的 52 万），VJ 模式不设 LOD 预算，真实 GPU 帧率待 W5 测。W6a/W2a 均未提交。下一步：用户真手柄验证 Start 手感（W1 一并）。
- 2026-11-05：W6a 完成——十场景 s01–s10（ruin1–10.ply）接入，僵尸城入口移除；176 测试 + check 通过，服务器十个文件均 200，浏览器抽查 s01/s05/s10 画面可见（s10 加载约 20 秒）。入口机位是占位值，开场镜头贴近表面。下一步：W1 手柄验收与 W6b 逐场取景回填（用户操作）。
- 2026-11-04：W0 完成——Unity 三节计划标搁置，`docs/unity-s0-smoke.md` / `unity-setup-guide.md` 加存档横幅，architecture 双轨节标 superseded，Web 代码无 AudioVizURP 引用。下一步 W1：用户用真实手柄在 `?vj=1&scene=ruin` 试操作并反馈手感。
- 2026-11-04：**用户决定放弃 Unity，作业改用本仓库 JavaScript（Spark 高斯）+ Hydra 交付**。Unity 相关计划（Show S0–S6、报废重建 R0–R5、U1–U2）全部搁置。新计划 W0–W7 见下方"Web + Hydra 作业"节，等 go；交付形式已定：手柄实时演出 + 录屏。下一步等 go 做 W0（需用户定 `docs/unity-s0-smoke.md` 存档还是删除）。

## 2026-11-04 — Web + Hydra 作业（用户决定弃用 Unity；W0 已完成）

定位：作业交付约十分钟视听表演视频，全部在浏览器内完成：Spark 渲染
高斯场景，Hydra 做后期效果，手柄实时控制镜头与效果（沿用 G 系列已
完成的 `?vj=1` 飞行 + Hydra 三预设），录屏出片。十场景叙事弧线和每场
主角参数映射沿用 Show 计划节的内容（与引擎无关）。

- [x] W0. 收尾 Unity 线：strategy 中 S/R/U 节标"搁置"；`docs/unity-s0-smoke.md`
      保留为存档或删除（问用户）；Web 仓库不再引用 AudioVizURP。
- [ ] W1. 真实手柄验收（即 G3b-b）：用户操作，我按反馈微调速度/曲线。
- [ ] W2. VJ 多场景：`?vj=1` 下手柄切场景（如 Back/Start 前后一场），
      下一场预加载，先做最便宜的黑场淡入淡出转换；场景目录从 2 场扩展的
      接口不变（`sceneCatalog.js`）。纯函数状态机 + 单测。
- [x] W2a. **Start 键切下一场**（用户 2026-11-05 要求；go 已收到，已实现）：
  1. 纯函数 `advanceSceneSwitch(state, pad)`（新文件 `src/mapping/sceneSwitch.js`）：
     Start（标准布局按键 9）**上升沿**才触发，一按一场不连跳；s10 后回到 s01；
     切换/加载中再按忽略；非标准布局/失焦不触发。单测覆盖。
  2. 页内切换，不刷新页面（刷新会丢手柄连接，要重按 A，Hydra 也会重置）：
     `stage.js` 加 `swapSplat(url)`——旧 SplatMesh 移除并 dispose，新的
     接同样的 y-up 翻转，`ready` 重置到加载完成；Spark/Three 渲染器复用。
  3. 镜头：切场后回到该场入口（目录 explorer 占位或日后 W6b 校准值），
     flightController 加 `setHome()`，速度/朝向归零、需回中摇杆再飞。
  4. 画面：先做黑场——切换时画布淡黑，新场加载完淡入；HUD 显示
     "场景 3/10 · 地下通道"，加载中显示"正在加载…"。Hydra 效果不中断
     （黑场期间输入的就是黑画面）。
  5. URL 用 replaceState 同步 `scene=`，刷新停在当前场；copy framing
     仍按当前场生成。
  6. `npm test` + `npm run check`；浏览器里用脚本模拟 Start 上升沿抽查
     s01→s02→…→s01 循环、加载中重复按不跳场。真实手柄手感由用户验证。
  - 已知限制：无预加载，每次切场黑屏约 10–20 秒（130MB PLY）；预加载下一场
    （W2b）另行计划，需评估同时持有两份约 52 万 splat 的显存。
- 决策（W2a 实现）：黑场用 CSS 覆盖层（z 5，盖住 Hydra 输出），而非把黑画面喂给 Hydra；Hydra 在加载期间暂停渲染，之后照常。切场后 URL 去掉 view/tf（属于上一场）；?splat= 自定义资产不启用切场。顺手修复 Hydra 状态文字在场景重新加载后停在"正在准备"的旧 bug。
- 决策（W2a）：选页内切换而不是改 URL 刷新——刷新最省代码但演出中会掉手柄
  连接和 Hydra 状态，不适合现场。Back 键暂不绑定（留给"上一场"或其他）。
- [x] W3a. **固定曲目音画联动**（用户 2026-11-05 提供音频；go 已收到，已实现）：
      用户给的路径 `5songDJ.wav.asd` 是 Ableton 分析文件，不是音频；同目录的
      `5songDJ.wav`（126.9MB，按 44.1k/16bit/立体声推算约 12 分钟）才是曲目。
  1. 音频资产：拷 `5songDJ.wav` 进仓库 `audio/`，`.gitignore` 加 `audio/` 与
     `*.wav`；`serve.mjs` 只放行白名单文件 `/audio/5songDJ.wav`（不接受任意路径）。
     演出时不弹文件选择框、无网可用。
  2. web-audio 驱动加 `url` 来源（`<audio src=url>`，复用现有 file 路径的分析链），
     `?vj=1&audio=show` 时 VJ 页自动用它；默认不带 audio 参数时行为不变。
  3. 播放控制：浏览器要求用户手势才能出声——HUD 加"▶ 开始音乐"按钮（空格键同效），
     暂停/继续、进度显示 mm:ss / 总长；切场景不打断音乐。手柄暂不绑定播放键。
  4. 高斯随音乐动：VJ 现在是静态环境（不接音频），改为用已有的 **shake 模式**
     （原色不变，低频/onset 驱动抖动），HUD 加"场景律动"强度滑杆（0 = 完全静止）。
  5. Hydra 随音乐动：新增纯函数 `audioEffectDrive(params, amount)` →
     rms 推高拖影底量、onset 打出扭曲脉冲；与扳机**取较大值**叠加（手动永远能压过、
     松开扳机时音乐仍在动），B 键清晰复位同时把音乐驱动归零直到松开。HUD 加
     "效果律动"强度滑杆。单测覆盖映射与叠加规则。
  6. `npm test` + `npm run check`；浏览器内实测：音乐播放时 HUD 监视条有读数、
     切场景音乐不断、强度 0 时画面静止。音画对位手感由用户判断。
  - 不在本步：每场"主角参数"差异化（W3b，按十场映射表逐场配置）、按时间点自动
    切场（用户已定手动演出）。
- 决策（W3a）：音频随仓库本地服务（拷贝）而非每次手选文件；律动强度默认
  中等（0.5），具体值等用户听感调。
- 决策（W3a 实现）：入口 `?vj=1&scene=s01&audio=show`（首页 VJ 链接未改，仍是无音乐版）。音乐驱动时跳过 Hydra 空闲逐帧清屏，让拖影能积累；B 按住时音乐驱动归零且照常清屏。服务器音频路由支持 Range（206），只放行这一个文件。

- [x] W3c. **剩余按键全部映射 Hydra 功能**（用户 2026-11-05 要求"除了必要的行走以外每个键都 map 一个 hydra 功能"；本轮只写计划，等 go）
  已占用（保留）：左摇杆移动、右摇杆视角、十字键 ↑↓ 升降、Start 下一场、
  LT 拖影、RT 扭曲、LB/RB 换预设、B 清晰复位。
  空闲键及拟定功能（叠加在当前预设之上，归零时画面不变）：
  | 键 | Hydra 功能 | 方式 |
  | A | 反相闪白 `invert` | 按住生效，松开淡出（打点用） |
  | X | RGB 色彩分离 `shift` | 按一下开/关 |
  | Y | 万花筒 `kaleid` 叠加（与"镜像"预设独立） | 按一下开/关 |
  | Back | 黑白高对比 `saturate(0)+contrast` | 按一下开/关 |
  | 十字键 ← / → | 色相旋转 `colorama` 减/加 | 按住连续旋转，松开停在当前色相 |
  | 左摇杆按下 L3 | 像素化 `pixelate` | 按一下开/关 |
  | 右摇杆按下 R3 | 画面冻结（停止取新画面、只剩反馈） | 按住生效 |
  | Home | 不映射：Windows 上 Xbox 手柄的 Home 键浏览器读不到（被系统占用） | — |
  B 清晰复位同时关闭以上所有开关并把色相归零；切场景不清除这些开关。
  1. 纯函数 `advanceButtonFx(state, pad, dt)`（新文件 `src/mapping/buttonFx.js`）：
     开/关只在按下沿翻转、按住类带平滑淡入淡出、B 全清、无手柄/失焦全部归零。单测覆盖。
  2. `hydraStage.js` 重建效果链：在每个预设链后串上上述层，全部用函数参数驱动，
     值为 0 时等同原画（invert 0、shift 0、colorama 0、saturate 1、contrast 1、
     kaleid/pixelate 用 blend 0）；"效果为零时直接显示原画"的判断扩展到所有层。
  3. HUD：效果状态行显示当前开着的层（如"色彩分离 · 黑白 · 色相 +40°"）；
     `docs/vj-controls.md` 按键表更新。
  4. `npm test` + `npm run check`；浏览器用模拟手柄逐键检查状态与画面变化（截图），
     真实手感由用户验证。
  - 风险：层越多 Hydra 每帧着色器越长；先在本机测帧率，掉帧再把不常用层合并。
- 决策（W3c）：用户 go 按上表实现。Hydra 改为三级：o0 预设+反馈（冻结=反馈混合量拉到 1），o1 像素化+万花筒，o2 色彩分离（RGB 三通道错位相加）+色相+黑白+反相；按键层不进反馈。色彩分离没用 Hydra 的 `shift`（fract 会把纯白变黑，0 不是恒等）。界面"恢复清晰画面"按钮也清按键层。

- [x] W3d. **表演模式：隐藏控制台**（用户 2026-11-05 要求；本轮只写计划，等 go）
  1. 键盘 **H** 切换表演模式：隐藏整个左上控制台（`.hud`：入口链接、飞行/音乐/
     Hydra 面板、工具行、帮助）和左下监视条（`#monitor`），鼠标指针也隐藏；
     再按 H 恢复。手柄键已全部占用，所以不用手柄切换（避免和效果键冲突）。
  2. 键盘 **F** 切换浏览器全屏（`requestFullscreen`），录屏/投影时用；Esc 退出
     全屏是浏览器自带行为。
  3. URL 加 `&perform=1` 打开页面即进入表演模式；进入时屏幕角落淡出提示
     "表演模式 · H 显示控制台 · F 全屏"约 2 秒，之后画面上无任何文字。
  4. 表演模式下一切照常：手柄飞行/效果/Start 切场、空格播放音乐。切场景时的
     "场景 3/10" 文字也随控制台隐藏（只剩黑场过渡）。
  5. 纯逻辑很少（URL 参数读取 + 键位判断），写成小函数加单测；其余是 CSS
     `body.perform` 隐藏规则。`npm test` + `npm run check`，浏览器截图确认
     画面上无控制台、H/F 能切换。
  - 只在 VJ 页（`?vj=1`）启用，其他页面不受影响。
- 决策（W3d）：用户 go；H 切控制台、F 全屏、`perform=1` 直接进入。Ctrl/Alt 组合键与输入框内按键不触发。

- ~~W3e 键盘映射~~ 用户 2026-11-05 取消：改为 LB/RB 切换更多预设（见 W3f）。
- [ ] W3f. **预设扩充到 10 种，RB 下一种 / LB 上一种**（用户 2026-11-05："按一下 RB 换一种效果，
  效果多做一点，且和已有的区分开，现在区分不充分"；本轮只写计划，等 go）
  原则：每个预设是一种**独立的画面语言**；RT 控制该预设强度（0 = 原画），LT 拖影所有预设共用；
  **预设不再和手柄按键层重复**（按键层已有：闪白、色彩分离、万花筒、黑白、色相、像素化、冻结）。
  现"镜像"预设本质是万花筒，和 Y 键重复——替换掉。
  | # | 预设 | RT 推上去时的画面 |
  | 1 | 回声（保留） | 噪声场轻微扭动 |
  | 2 | 波纹（保留） | 斜向条纹波浪起伏 |
  | 3 | 漩涡 | 画面绕中心扭旋，越推越卷 |
  | 4 | 隧道 | 由中心向外一圈圈缩放，像被吸进去 |
  | 5 | 扫描故障 | 横向条带错位、跳动，像坏掉的信号 |
  | 6 | 频闪 | 黑场快速频闪，越推越快越狠 |
  | 7 | 色阶 | 颜色压成几层色带（海报感） |
  | 8 | 版画 | 硬阈值纯黑白，越推阈值越高 |
  | 9 | 分屏 | 画面平铺 2×2 → 4×4 多屏 |
  | 10 | 液化 | 画面用自身做位移，像水面融化 |
  1. `mapping/vjEffects.js` 的 `EFFECT_NAMES` 扩到 10 个；LB/RB 循环（10 后回 1），一按一档不连跳（现有逻辑）。
  2. `hydraStage.js` 的 `build(index)` 按上表重写为 10 个分支；每个分支 RT=0 时为原画；
     按键层（o1/o2）与音乐驱动不变——音乐的 onset 脉冲会推当前预设的强度。
  3. 界面下拉框的选项由 `EFFECT_NAMES` 生成（不再写死三项）；状态行显示"4/10 隧道 · …"。
  4. 测试：预设循环/回绕与名称数量的单测；浏览器里逐个预设用"预览效果"（65%）截图，
     确认十种肉眼可区分、且 RT=0 回到原画；全部切一遍测本机帧率。
  5. `docs/vj-controls.md` 预设表更新。
- 决策（W3f 待确认）：10 种预设与名称按上表，用户可换。

- [ ] W3. 音频进 VJ：固定曲目用 web-audio 文件驱动播放，AVParams 同时驱动
      高斯（已有 avModifier）和 Hydra 参数（新增纯映射函数，如 rms→反馈量、
      onset→扭曲脉冲），手柄扳机与音频叠加而非互相覆盖。单测覆盖映射。
- [ ] W4. 演出提示表 show JSON v0：段落时间 → 建议场景/预设/转换类型，
      HUD 显示当前段与倒计时（录屏时可隐藏）；只提示不强制，手动随时接管。
      格式写进 docs，加 sanitize + 单测。
- [ ] W5. 出片方式定案（即 G3b-c）：OBS 采集 vs 浏览器内 MediaRecorder
      （canvas.captureStream + 音频轨，零依赖）各测一组目标分辨率帧时间/
      丢帧，选一个。
- [ ] W6. 场景逐个接入：PLY 就绪一场接一场（目录条目 + 入口机位 + 主角参数）。
      PLY 来源仍是长周期瓶颈。
- [ ] W7. 联排 + 正式录制 + 导出。

- 决策（W）：用户明确"不用 Unity 了，用 JavaScript 搭配 Hydra"；Hydra 不再
  需要用 Shader Graph 重写，直接用已接入的 hydra-synth 1.4.0。Unity 节内容
  保留作历史记录，不删除。
- [x] W6a. **十场景替换**（用户 2026-11-05 提供 ruin1–10.ply，来源
      `D:\Github\guassian-splating-unity\Gaussian-splatting-unity\Assets\Scenes`，
      每个 130.6MB，md5 互不相同，十个独立场景；本轮只写计划，等 go）：
  1. 拷十个 PLY 进 `3dscene/`（已 gitignore，共约 1.3GB），仓库自包含、
     演出离线可用；不读取/修改 PLY 内容。
  2. `sceneCatalog.js` 改为十条：id `s01`–`s10`，name 用叙事弧线
     （废墟入口…重生庭院），file `ruinN.ply`；旧"废墟大厅/僵尸城"移出
     目录（文件留在磁盘不删）。`sceneById` 未知 id 仍回落第一场。
  3. 移除僵尸城专用入口：`index.html` 的 zombie-entry 链接、`main.js`
     zombieScene 判断、`serve.mjs` 的 `/local-scenes/...` 特例路由；
     `scene=ruin` 的链接（首页 VJ 入口、gamepad.html、docs/vj-controls.md、
     probe-vj.mjs）改为 `scene=s01`。
  4. 每场 explorer 参数先统一用现废墟的占位值（地面 -0.23、入口
     [0,-0.23,0]）——坐标未实测，VJ 自由飞行不受影响；入口机位之后
     由用户逐场"copy framing"回填（属 W6b 校准）。
  5. 更新 portal/flight 测试（场景数、`scene=city` 用例改新 id），
     `npm test` + `npm run check`；浏览器打开 `?vj=1&scene=s01`…`s10`
     抽查几场能加载。
- 决策（W6a）：id 用 s01–s10 不沿用 ruin/city；未知 id 回落 s01；`3dscene/` 中旧两份 PLY 保留在磁盘；开发服务器启动时读目录，改目录后需重启服务器。
- [ ] W6b. 逐场校准入口机位/地面（用户在页面取景后回填）。

- 决策（W0）：用户选"留作存档"，Unity 文档加横幅不删除；`src/rec/record.js` 注释里的 Unity 泛指未来工具，不改。
- 决策（W）：用户确认交付形式为**手柄实时演出 + 录屏**；W4 提示表只提示不驱动。

- 2026-11-04：本次从 Unity 文件导入重新开始，按下方 U0–U2 小步指导；等用户 go 后先确认当前新工程位置及包版本，再给对应的导入操作，不沿用旧工程已完成的假设。
- 2026-11-04：用户决定**报废 AudioVizURP，重建 Unity 工程**（原因待用户补充：报废 error 原样抄录可避免重建踩同坑）。重建计划 R0–R5 已写入下方"报废重建"节，等 go 实施；S0 验收标准不变，七步手册 docs/unity-s0-smoke.md 大部分直接转移。
- 2026-11-04：Show 计划已写入（Unity Timeline 固定剪辑作业主线，S0–S6 十步）。下一步等 go 实施 **S0 管线冒烟**：AudioVizURP 装 UnityGaussianSplatting + ruin1.ply 可见 + Recorder 10 秒测试片。G3b-b/c（真实手柄/录屏负载）转为未来实时演出阶段的前置项，不阻塞作业。
- 2026-11-04：G3b-a 完成——`scripts/probe-vj.mjs` 三阶段审计 A Hydra 空闲 / B 效果激活(65% 预览) / C &hydra=0 全部 60.0fps、p95 16.8ms、无 >34ms 帧，效果合成经截图确认；headless 软件光栅化不代表真实 GPU。
- 2026-11-04：用户确认 G1 浏览器检测正常；G2 自由飞行已接入 ?vj=1&scene=ruin，172 项测试及完整 check 通过。下一步真实手柄试飞，确认速度/转向手感；随后细化 G3 Hydra 接入。尚未验证本轮实际画面与录屏性能。

## 2026-11-04 — VJ 手柄接入（go 已收到，G1 实现）

- [x] G0. 确认系统识别：截图显示 Controller (XBOX 360 For Windows)，用户确认属性页输入正常；浏览器输入尚未验证。
- [x] G1. 新增 /gamepad.html 检测页与首页入口：连接状态、设备映射、摇杆/扳机/按键读数、原始轴、死区调节、断开重连与失焦暂停；纯函数归一化测试，无新依赖。168 项测试及完整 check 通过。
- [x] G1v. 用户在检测页回复“ok 没问题”，确认浏览器手柄检测正常；未逐项记录拔插测试。
- [x] G2. 新增独立 VJ 自由飞行：双摇杆移动/转向、十字键升降、死区与平滑，失焦/断开/长帧停止，恢复需回中；速度调节、入口复位与当前取景复制。172 项测试及完整 check 通过，实际手感待用户验证。
- [ ] G3. Hydra 接入另行细化：扳机控制效果、预设切换与清晰画面复位；单场景录屏性能验证后扩展十场景编排。
- [x] G3a. 用户批准安装 hydra-synth 1.4.0；本地发行文件、同帧高斯→Hydra、独立画布与原画回退。LT 反馈、RT 扭曲、LB/RB 三预设、B 清晰复位；共享飞行输入和失焦/断连保护，扳机松开平滑归零，重连需释放。176 项测试与完整 check 通过；浏览器三预设及清晰复位已看到。
- [ ] G3b. 实际画面与录屏验收，拆三步（自动化部分等 go）：
  - [x] G3b-a. 代理自动化完成（`scripts/probe-vj.mjs`，不接真实手柄）：
        CDP 点击"预览效果"（65% 扳机模拟，与用户预览同路径）让 Hydra
        激活，三阶段 300 帧审计：A Hydra 空闲 / B 效果激活 / C &hydra=0
        基线——全部 60.0fps、p95 16.8ms、无 >34ms 帧，Hydra 开销无可测
        差异；1280×800 @ dpr 1，stage 与 hydra 缓冲一致；截图确认效果
        已合成（非直通）。预览模拟不含真实手柄输入路径，仅覆盖
        渲染/合成负载。
  - [ ] G3b-b. 用户真实手柄操作：无扳机原画、双扳机组合（LT 拖影 +
        RT 扭曲同时）、LB/RB 一次一档不连跳、B 复位、失焦/重连保护、
        自由飞行与效果同时操作的手感。
  - [ ] G3b-c. 用户录屏负载单独测量：目标分辨率（演出用分辨率）下
        OBS/采集的帧时间与丢帧，Hydra 开 vs 关各记一组；之后再扩展
        十场景编排。

决策：最终交付为约十分钟视听表演，用户希望实时控制镜头和效果，计划最多十个场景；先完成输入验证，每回合一步。
决策：本轮仅更新计划与日志，按 AGENTS.md 等待 go 后实施 G1；系统测试正常不代表浏览器或场景接入已通过。
决策（G1）：收到 go，本轮仅完成检测页；standard 映射采用 Xbox 名称，未知布局保留原始编号而不猜测。原始轴与径向死区处理后的摇杆同时显示；场景与 Hydra 控制留到后续。
决策（G2）：用户“来吧”授权本步；新增 ?vj=1 单场景自由飞行模式，独立于贴地探索/传送门；左摇杆按镜头朝向移动，右摇杆转向，十字键世界垂直升降。保留静态原色；无碰撞约束，提供回到入口镜头按钮。失焦/断连立即停止，恢复后先回中再允许移动；本轮不接 Hydra。
决策（G2 实现）：VJ 参数优先于 play/journey；镜头从场景目录入口初始化，自定义资产不套用目录入口；用户 view 优先。移动速度默认 1.5，摇杆径向死区 15%，俯仰限制避免翻转，无新依赖或音频协议改动。
决策（G3）：用户确认飞行“可以 没问题”并同意继续效果；依赖尚未批准，本轮只细化方案。Hydra 官方支持外部 canvas 和 autoLoop:false 的手动 tick；优先本地加载，避免录屏依赖 CDN。官方参考：https://github.com/hydra-synth/hydra-synth 。
决策（G3b 拆步）：G3b 分为 a（代理自动化：预览按钮模拟扳机测渲染负载与分辨率，等 go）、b（用户真实手柄组合操作）、c（用户录屏负载）；a 不宣称覆盖真实手柄路径，b/c 由用户本机完成。
决策（G3a）：用户回复“可以”批准新增依赖；Hydra 固定 1.4.0，关闭全局函数注入、自动循环、麦克风分析和自带录制流。镜像使用万花筒混合，复位清空双反馈缓冲；提供界面预览和 &hydra=0 原画模式。自动化没有模拟真实物理手柄。

## 2026-11-04 — Show 计划：Unity Timeline 固定剪辑作业（**搁置 2026-11-04：用户改走 Web + Hydra，见 W 节**）

十场景弧线与每场映射表仍有效（引擎无关），其余步骤搁置。

定位：本次课程作业交付一支**固定剪辑视听视频**（曲目固定，镜头/场景/
效果全部按时间轴预排，Unity Recorder 离线出片）；同一套资产与总谱
未来长成实时演出视觉工具（OSC/手柄/走位触发在那时接入）。Web 仓库
降回实验室角色（协议/映射/单测），Unity 成为主战场。

**十场景叙事弧线**（用户提供，无机 → 生命 → 融合 → 重生）：
1 废墟入口（无机冷淡）→ 2 空城（缝隙植物）→ 3 地下通道（节拍初现）
→ 4 机器大厅 → 5 水下中庭 → 6 菌丝温室 → 7 晶体裂谷 → 8 异变圣殿
（高潮）→ 9 云海遗迹（释放留白）→ 10 重生庭院（植物覆盖，呼应开场）。
植物复绿机制是贯穿主线：2 → 6 → 10 植物戏份递增。

**引擎决策**：
- Unity（D:\Github\AudioVizURP，6000.3.9f1 + URP，已有 AudioAnalyzer
  等脚本骨架）为主引擎：UnityGaussianSplatting 渲染 PLY + Unity
  Timeline 排镜头/段落 + Cinemachine 固定机位 + Unity Recorder 出片。
  选它的决定性因素：十场景全是 3DGS 扫描件，Unity 管线已验证；
  Timeline 解决"一次录不成"问题（分段排、逐段预览、随时改）。
- Hydra 效果不迁库（hydra-synth 绑 WebGL/JS 闭包，无 Unity 等价物），
  用 URP Shader Graph 重写等效：拖影=feedback RT、扭曲=UV 扰动、
  万花筒=kaleid UV 变换，挂全屏后处理 Pass；Web 端调好的参数
  （feedback 0.92/scale 1.012 等）作为 Unity 端规格。
- Unreal Sequencer 不选：splat 管线在 UE 无成熟方案，风险大于收益。

**步骤**（每回合一步，`npm test` 在 Web 仓库照常跑；Unity 端以
"编译无报错 + 编辑器实测"为验证）：

- [ ] S0. 管线冒烟（先验证能出片，再投入资产）：AudioVizURP 工程装
      UnityGaussianSplatting（local package，按 docs/unity-setup-guide.md
      §2 含 URP renderer feature 配置）→ 导入 ruin1.ply → 场景可见
      splat → Unity Recorder 出 10 秒测试片。同时确认该包 per-splat
      编辑限制下的整 scale 呼吸可行。
- [ ] S1. Timeline 骨架：曲目音频轨 + 两个已有场景（废墟/僵尸城）
      的 Cinemachine 机位 + Camera Cuts 切换 + Recorder 出第一版粗剪
      （无声画对位要求，先打通"排什么出什么"）。
- [ ] S2. 效果轨：Shader Graph 重写 Hydra 三预设（拖影/扭曲/万花筒）
      挂 URP 全屏后处理，Timeline 动画轨驱动强度曲线。
- [ ] S3. 十场景逐个接入：每场 PLY 资产 + 场景校准（地面/尺度/机位，
      重新实测不能抄 Web 坐标）+ 该场主角参数（rms 呼吸/beatPhase
      步进/onset 爆发等，见下方映射表）+ Timeline 段落排布。
      PLY 来源是长周期瓶颈，就绪一场接一场。
- [ ] S4. 转换语汇在 Timeline 落地：黑场（最便宜先做）→ onset 碎裂
      → 粒子传送门；转换类型不重复原则， tied 到段落标记。
- [ ] S5. 植物复绿的 Unity 策略：先做技术验证（compute shader 或
      CPU 批改 splat 数据二选一，实测后定）；若成本超预算，作业版
      仅在第 2/6/10 场做预烘焙生长动画（Timeline 直接摆 scale/opacity
      关键帧），实时复绿留给未来工具。
- [ ] S6. 联排 + 出片：全片 Timeline 预览修节点 → Recorder 按目标
      分辨率离线渲染 → 与曲目合成导出。

**每场主角参数映射**（协议字段不变，Web 端调好权重搬 Unity）：
1 rms 呼吸（刻意低响应铺垫）/ 2 植物 onset 冒头 / 3 beatPhase 步进
/ 4 band-low 抖动 / 5 centroid 光影横扫 / 6 植物加速+rms / 7 centroid
+flatness 强反差 / 8 全合奏 onset 主导 / 9 beatPhase 微动留白 / 10
植物满覆全合奏。转换语汇：2 行进抵达、3 传送门、4 onset 碎裂、5
Hydra 吞没(Shader Graph 版)、6 光流、7 传送门、8 黑场亮起、9 黑场
静默、10 行进收尾——每种类型 ≤2 次。

**总谱 JSON（show file）**：段落表 + 相机关键帧 + 效果权重 + 转换
标记，引擎无关；Web 端实机验证过格式后 Unity 端读同一份。格式 v0
等 S1 落地时定义。

- 决策（Show）：作业走 Unity Timeline 固定剪辑（用户明确想学
  Timeline/出片管线），Web 分段 take 方案废止；Unity 工程用已有
  AudioVizURP（同版本 6000.3.9f1，有 AudioAnalyzer 骨架），不再重建
  photolipsia-unity；十场景 PLY 资产在 Unity 工程内管理（其
  gitignore 放行 .ply 资产目录），不进 Web 仓库。
- 决策（Show）：植物复绿是叙事主轴但实现成本最高，S5 先技术验证后
  定实时/烘焙路线，允许作业版降级为关键场烘焙。
- 决策（Show）：OSC 实时输入整体推迟到未来实时演出阶段；本次作业
  音频事件（onset/节拍）在 Timeline 打标记，比实时检测更精准。

## 2026-11-04 — AudioVizURP 报废重建（**搁置 2026-11-04：用户改走 Web + Hydra，见 W 节**）

用户宣布 AudioVizURP 报废、重建 Unity 工程。可复用资产：
`D:\libs\UnityGaussianSplatting`（MIT v2.0.0 clone）直接复用；
`docs/unity-s0-smoke.md` 第 5/6 步（看画面+呼吸、Recorder 参数）不变；
`Assets/Editor/S0PipelineSmoke.cs` 文件层复制进新工程；
`ruin1.ply` 从 Web 仓库重新拷。改造点：包安装改为 **UI 加 disk**
（Package Manager → Add package from disk，Unity 自己写 manifest 路径，
消除 file: 相对路径解析的不确定性）。

- [ ] R0. Hub 新建 URP 模板工程 `photolipsia-unity`（6000.3.9f1，位置
      `D:\Github\photolipsia-unity`，照 docs/unity-setup-guide.md §1 原建议）；
      Editor 设置确认 Visible Meta Files + Force Text（默认已是）。
- [ ] R1. Package Manager → **Add package from disk** →
      `D:\libs\UnityGaussianSplatting\package\package.json`；
      注册表搜 Unity Recorder 加 5.1.x；Console 无 error。
- [ ] R2. git init + Unity 官方 .gitignore + 资产目录 .ply 例外
      （十场景 PLY 进此工程，照 Show 决策）。
- [ ] R3. 拷 ruin1.ply 进 StreamingAssets + 新场景放 GaussianSplatRenderer
      （Source Path=ruin1.ply）+ 拷 S0PipelineSmoke.cs 挂
      GaussianSplatURPFeature → Play 可见 + 拖 Splat Scale 呼吸（照手册第 5 步）。
- [ ] R4. Recorder 出 10 秒测试片（MP4 1080p60 帧区间 1–600，照手册第 6 步）。
- [ ] R5. 汇报结果勾 S0；确认报废原因若属管线性问题（非旧工程损坏），重建时规避。

验证以"编译无报错 + 编辑器实测"为准，每回合一步，新依赖先问。

## 2026-11-04 — Unity 从文件导入开始（**搁置 2026-11-04：用户改走 Web + Hydra，见 W 节**）

- [x] U0. 阅读现有重建计划及 S0 手册，明确本次从首个场景文件导入开始。
- [ ] U1. 确认用户当前 Unity 工程路径、是否已打开及 Gaussian Splatting 包版本；核对本地包说明，给出对应的包安装/首个 PLY 文件导入步骤，由用户在编辑器操作。
- [ ] U2. 首个文件导入成功后，再配置 URP 渲染与场景相机，验收可见画面和 Console；通过后回归 S0 出片计划。

决策：沿用此前用户自行操作 Unity 的方式；本轮只写计划，不复制大资产、不修改 Unity 工程、不安装依赖。默认首个文件为原计划 ruin1.ply，实际路径与工程状态在 U1 确认。

## Earlier next items

- 2026-10-30：目录场景与边界传送闭环已实现；首页“开始探索 · 粒子传送门”进入 ?journey=1。已实际验证两个场景加载、前向自动触发、手动往返、输入恢复；164 项测试通过。下一步是扩大安全通道前的精确障碍/地形校准，以及完整过渡性能/显存实测，不能宣称任意扫描表面绝不穿透。
- 2026-10-30：首页“进入僵尸城”入口已接入（P2a）；启动或重启预览服务后可点击加载。实际取景尚未验证；随后继续 P1b 校准与双场景过渡。
- 2026-10-30：go 已收到；P1a 安全逻辑已实现，P1b 第一场景实景校准待完成。本地 5173–5180 无监听；需用户启动 npm run dev 后继续 P1b，再进入 P2。C3 性能工作并入 P4 的双场景实测。

- 玻璃球修订已完成（半径 0.22，透明反光近似）；下一步仍为 C3 性能实测。

- 2026-10-27 连贯体验 C1 已实现并通过自动检查；C2 用户指定的透明球、静态环境与实体叶片已实现并浏览器查看。下一步 C3 性能实测；地形碰撞及 HUD 收起仍待后续，每回合一步。
- ~~附记 4 跑图球~~ 已落地（`?play=1` 原型可玩）。下一步候选（等用户选）：
  跑图手感调参（速度/相机距离/复绿半径）、多场景机制规划（portal +
  场景清单，等第一批 AI 场景）、地面高度逐场景配置（`?ground=` 或清单）。
- ruin1 文件本身的绿/品红色偏仍是 Marble 导出问题——修复路径：Marble
  侧重导或文件预处理。
- **7e（暂缓待办）**：用户本机跑 `docs/rehearsal.md` 彩排清单——离线
  验证（断网全流程）、双屏物理验证、故障切换演练。条件允许时再做，
  做完写 Stage 7 log 收尾。
- ~~Track 2 — Unity project~~ **搁置（2026-10-27）**：演出方向改为
  多场景跑图（见 2026-10-27 附记 3），机制先在 Web 端跑通，Unity 需求
  等机制定了再评估。协议文档不变；重建路径见 docs/unity-setup-guide.md。

## Track 2 plan — minimal Unity project (drafted 2026-10-26, **SHELVED 2026-10-27**)

Goal: the performance destination gets a pulse. A minimal Unity project
(URP) hosting UnityGaussianSplatting, receiving OSC from a UDP listener,
mapping `/av/*` addresses to a splat scene breathing. The web repo stays
the lab; Unity becomes the live show.

Key constraints/decisions:
- **Protocol doc is the contract**: copy `docs/protocol.md` into the
  Unity project (`Docs/protocol.md`) at setup — any Unity-side mapping
  ambiguity is resolved against it, not re-decided.
- **OSC.cs from Room of Sounds** as the listener (the user's known-good
  reference); no third-party OSC asset.
- **Iron rules apply unchanged** — driver-side smoothing stays on the
  sender side (web-audio driver etc.); Unity consumes complete frames
  and maps only. Smoothing added inside Unity = protocol violation.
- One Unity mapping behavior per step, testable by eye with the
  existing `scripts/osc-test-sender.mjs` (it already speaks the protocol).

- [ ] 2.0. **Project skeleton**: Unity version pin (LTS, URP template);
      drop UnityGaussianSplatting in (git submodule or vendored — decide
      when we see how it wants its splat assets); a single scene with one
      splat asset; `Docs/protocol.md` copied. Acceptance: splat visible
      in Play mode, no console errors.
- [ ] 2.1. **OSC listener**: OSC.cs wired on a UDP port (match the
      bridge's 9129? — no: the DSP side sends UDP directly; pick 9000
      default, documented), address→float table accumulated per frame,
      `/av/*` only, unknown addresses ignored. Acceptance: a debug HUD
      or inspector shows live `/av/band/low` values while test-sender
      runs.
- [ ] 2.2. **Frame assembly + sanitize**: values clamped to 0–1 on
      ingress (iron rule 2 enforcement point on this side), missing
      fields → 0 (silence, never stale). Acceptance: sender stops →
      values decay/drop, never freeze (same release-decay question as
      the web osc driver — reuse its decision: no packets for 0.5s →
      release-decay toward 0).
- [ ] 2.3. **First mapping — breathing**: `/av/rms` → global splat scale
      pulse (the web repo's pulseScale equivalent, CPU-side since
      UnityGaussianSplatting mutation is C#-side; start with a single
      global multiplier before per-splat work). Acceptance: test-sender
      ramp makes the splat breathe on the beat.
- [ ] 2.4. **Verify — user**: run bridge-free path (DSP → UDP → Unity
      directly) with test-sender; user confirms breathing and that
      silence is still. Then decide next: per-band regions (like web
      mapping) or on to the show.

Non-goals: no per-splat GPU mutation yet (Unity side starts CPU/global),
no timeline/sequencer, no visual parity with the web repo.

## Stage 7 plan — performance hardening (drafted 2026-10-26, GO received)

Goal: the web repo becomes a dependable live instrument — predictable
frame rate, known latency, multi-screen capable, and a rehearsal checklist
that proves it runs fully offline.

- [x] 7a. **Frame-rate audit** (`scripts/probe.mjs --fps`): 300-frame
      rAF timing audit → fps/p50/p95/max + >34ms count, PASS/FAIL exit
      code. Result: **60.0fps, p95 16.8ms, max 16.9ms, 0 frames >34ms —
      PASS on first run**. No suspects needed fixing (monitor DOM writes
      and ring-buffer shift are cheap at these sizes).
- [x] 7b. **Latency measurement** (`scripts/probe.mjs --latency`): mock
      onset jump → canvas pixel response, sampled per frame via a
      drawImage strip. Result: **~16.5ms mean (n=2) — exactly one frame**,
      the architectural floor (uniform update in frame N renders in N+1).
      Driver-side numbers documented in docs/rehearsal.md §5. Hook:
      main.js sets `window.__LAST_ONSET__` per frame.
- [x] 7c. **Multi-screen**: Spark has no native multi-viewport; the
      supported path is one fullscreen window per output. Verified two
      concurrent probe instances each hold 60fps p95 16.8ms — no
      cross-window contention at this splat count. Physical two-monitor
      confirmation left to the user (needs real displays).
- [x] 7d. **Full-offline rehearsal checklist** (`docs/rehearsal.md`):
      pre-gig steps (npm ci → fps audit → splat present), offline
      verification (all imports resolve to local node_modules — no CDN,
      the zero-dependency decision pays off), driver-specific rehearsals
      each with a recorded fallback, failover drill (kill live source →
      playback takes over), known-latency section, show-day flow.
- [ ] 7e. **Verify — user**（暂缓 2026-10-26：用户暂时无法本机验证，
      移入 Next 待办）：run the docs/rehearsal.md checklist on this
      machine, including the offline pass (disconnect network, full show
      flow) and, when two monitors are available, the multi-screen path.

Non-goals: no WebGPU migration, no worker-thread DSP, no new drivers.

## Stage 6 plan — recorder/playback + session UI (drafted 2026-10-26, GO received)

Goal: record any driver's AVParams frame stream to `.jsonl`, play it back
later through the normal pipeline (`?driver=playback`). Use cases: show
fallback (record a good take, replay it when the live source dies),
offline visual tuning against a real performance, regression material
for the mapping layer.

- [x] 6a. **Pure recorder** (`src/rec/record.js`): createRecorder ring
      buffer (default 18000 frames = 60Hz×5min), add/length/dropped/
      toJSONL; recordingName() sortable filenames. Format = the protocol
      frame itself, one JSON object per line.
- [x] 6b. **Pure playback reader** (`src/rec/play.js`): parseRecording —
      garbage lines (JSON errors AND sanitize errors) dropped whole and
      counted (stricter than clamping: a recording that fails validation
      is suspect); time-ascending sort defensively; frameAt binary
      search, exact-frame semantics (last frame with time ≤ t; before
      start → null). No smoothing added — recorded frames are already
      driver-smoothed (iron rule 1 across the round trip).
- [x] 6c. **Playback driver** (`src/drivers/playback.js`): wall clock →
      recording time anchored at first poll, `?t0=` offset, loop by
      default (wrap), no-loop clamps+holds. Frames re-emitted verbatim,
      source-tagged 'playback', never mutated.
- [x] 6d. **Record wiring**: HUD `rec: off/●/time` toggle records
      post-gain (render-visible) frames; stop → Blob download with
      recordingName filename; status shows saved count.
- [x] 6e. **Verify**: `npm test` 107 green (+8 rec, +5 playback driver);
      round-trip, ring buffer, garbage tolerance, loop/offset semantics,
      untrusted-file gate all tested. **Remaining: user E2E** — record
      ~30s, download, `?driver=playback` + file picker (or drop the file
      in `public/rec/` + `?rec=name`), watch the same performance replay.
- [x] 6f. **Session UI polish**: HUD button row (beat / rec / ?), `?`
      help panel listing every URL param.

Non-goals: no compression (jsonl of 60Hz frames ≈ 20MB/h — fine for
5-min performance capture; revisit if sessions get long), no server-side
storage, no audio recording (visual params only).

## Stage 5 plan — MIDI driver (drafted 2026-10-26, GO received)

Goal: `?driver=midi` — a MIDI controller/keyboard drives the splats live.
Web MIDI API (Chrome/Edge; permission model like web-audio: lazy load,
ask only when selected). Unlike web-audio (we analyze), here the *device*
is the DSP side: note velocity IS the normalized value (0–127 → /127),
protocol iron rule 2 mostly comes free — the driver's job is assembly,
not analysis.

- [x] 5a. **Pure MIDI→AVParams core** (`src/drivers/midi/midiCore.js`,
      Node-testable): note on (vel>0) → event + velocity-scaled onset
      charge; note off (incl. vel-0 note-on per MIDI spec) → velocity-0
      event; CC_MAP {1,11→mid, 64→high, 74→centroid} with follower
      smoothing on band targets, centroid direct; pitch bend 14-bit →
      centroid; clock 0xF8 → beatPhase = ticks%24/24 (real beat source),
      0xFA/0xFB reset ticks, stall >2s → clockInactive → phase 0.
      Channel bits ignored. poll() assembles complete frames (iron rule 3).
- [x] 5b. **Browser wrapper** (`src/drivers/midi/index.js`):
      requestMIDIAccess({sysex:false}), binds ALL inputs, routes with
      ev.timeStamp/1000 as atSec (same performance.now clock), hot-plug
      via onstatechange, device list exposed for the status line.
- [x] 5c. **Wire-up**: `?driver=midi` lazy import; status line shows
      connected device names.
- [x] 5d. **Verify**: `npm test` 88 green (+15 MIDI), `npm run check` OK
      (midiCore in import smoke). **Remaining: user verifies with a real
      controller** — keys → onset punch + note events in monitor; mod
      wheel → mid swells; sustain → high presence; sequencer clock →
      beat row stepping at true tempo.

Non-goals held: no MPE, no sysex, no per-note polyphonic expression.

Non-goals: no MPE, no sysex, no per-note polyphonic expression, no
audio-rate MIDI. Events stay sparse/protocol-shaped (no per-splat notes
yet — that's a mapping-layer question for later).

## Stage 4 plan — OSC driver + dumb bridge (drafted 2026-10-26, GO received)

Goal: Max/SC/PD sends OSC over UDP → Node bridge relays raw packets over
WebSocket → browser osc driver decodes and assembles AVParams. The bridge
stays dumb (forwards bytes, understands nothing) per protocol doc; OSC
decoding lives in the browser driver, as pure testable modules.

- [x] 4a. **Minimal OSC decoder** (`src/drivers/osc/oscDecode.js`, pure,
      zero-dep): typetags `i f s b`, strict 4-byte alignment, bundles
      (#bundle, timetag skipped — immediate processing), nested bundles
      flatten. Malformed input throws OscError (drop packet, never crash
      the loop). 13 tests incl. hand-built byte packets.
- [x] 4b. **Address→AVParams mapping** (`src/drivers/osc/oscMap.js`, pure):
      OscFrameAssembler — feed(msg) accumulates, takeFrame(now) returns a
      sanitized frame and resets (stale values never leak across frames;
      absent fields fall back to 0). Unknown addresses ignored. 6 tests.
- [x] 4c. **Bridge** (`scripts/osc-bridge.mjs`, Node, zero-dep): dgram UDP
      + hand-rolled minimal RFC6455 WS server (handshake, binary frames
      out, ping/pong, client frames read+discarded). Every UDP packet
      broadcast verbatim. `--udp/--ws` flags (default 9129/9128).
- [x] 4d. **Browser driver** (`src/drivers/osc/index.js`): WS client with
      exponential-backoff reconnect (0.5→8s). Link-death guard: no packets
      for 0.5s → all fields release-decay toward 0, centroid to neutral
      (a dropped link must not freeze visuals in a stuck pose). OscError
      packets dropped silently, real errors surface.
- [x] 4e. **Wire-up**: `?driver=osc&osc=localhost:9128` lazy-imported in
      main.js. Test sender `scripts/osc-test-sender.mjs` (8s scripted loop
      at 60Hz: ramp + centroid sweep + 120bpm kick). Smoke test
      `scripts/smoke-osc-bridge.mjs` (spawn bridge → UDP packet in →
      assert verbatim WS out → exit) — **passed**.
- [x] 4f. **Verify**: `npm test` 73 green (+19 OSC), `npm run check` OK
      (oscDecode/oscMap in import smoke). **Remaining: user end-to-end** —
      run bridge + test-sender + browser, monitor bars must move; then
      optionally with real Max/SC.

Non-goals: no bidirectional OSC (visual→DSP) yet; no timetag scheduling;
no TCP OSC.

## Stage 3 plan — web-audio driver (drafted 2026-10-26, GO received)

Goal: `?driver=web-audio` drives the splats from real sound — mic or an
audio file — through the AVParams protocol, with auto-gain so quiet/loud
rooms both produce full-range visuals.

- [x] 3a. **Pure DSP core first, unit-tested** (`src/drivers/webaudio/dsp.js`):
      band binning (protocol edges), energy = band's share of total spectral
      energy (sqrt-compressed — shares are scale-free), centroid on a true
      log 20Hz–20kHz scale (silence → neutral 0.5), flatness with relative
      floor (sparse tone reads tonal, silence → 0), spectral flux +
      adaptive running mean/variance for onset ratio.
- [x] 3b. **Auto-gain** (`src/drivers/webaudio/autogain.js`): per-field
      decaying peak tracker (instant rise, tau=8s decay, warmup holds the
      first peak, 0.02 floor) → divide + clamp. centroid/flatness pass
      through (scale-free by construction).
- [x] 3c. **Driver wrapper** (`src/drivers/webaudio/index.js`):
      AudioContext + AnalyserNode (fftSize 2048, smoothingTimeConstant 0 —
      we own smoothing), mic via getUserMedia (echoCancellation etc. OFF)
      or file via MediaElementSource (loops, also connected to destination).
      dB→linear magnitude conversion happens here. poll(now) full pipeline.
      Smoothing/envelope/autogain all in-driver per iron rule 1.
- [x] 3d. **Wire-up**: main.js lazy-imports the driver only when
      `?driver=web-audio` (`?source=mic|file`, file picker via dynamic
      input element; cancel handled). Mock stays default; registry keeps
      sync registration for the common case.
- [x] 3e. **Cleanup carried in**: `dyno.vec3(wob1, m, wob2)` replaced with
      per-component `dyno.combine({vectorType:'vec3', x,y,z})` on swizzled
      center — the proven-reliable path.
- [x] 3f. **Verify**: unit tests + check green (54 tests incl. beat).
      **Remaining: user listens/looks** — mic → bass pulses the bottom,
      hi-hats flicker the top, hits punch; `?source=file` with an audio
      file; confirm autogain makes a quiet room still move the splats.
- [x] 3g. **Beat estimation from onsets** (`src/drivers/webaudio/beat.js`,
      user-requested): pure onset-grid autocorrelation — scan candidate
      periods 60–300 BPM against a 6s onset window, densest consistent
      grid wins; phase anchored at the last onset (onset = phase 0);
      confidence = alignment score × missed-beat decay, gated at 0.6 so
      speech never drives beatPhase (stays protocol-0). UI toggle button
      in the HUD (`beat: on/off`), runtime switchable via
      driver.setBeatEnabled(); `?beat=0` starts off. 8 new tests.

Non-goals: no OSC/MIDI yet, no recording, no fancy latency tuning (Stage 7).

## 2026-10-27 附记 — 自定义 splat 场景接入（用户扫描件）

- 用户新扫描的视频 3DGS 训练件（951,554 splats，226MB，标准 62 属性
  二进制 PLY）已接入：拷到 `public/splats/scan.ply`（**本地文件，不进
  git**——AGENTS.md 禁大二进制）。
- 新参数：`?view=look@cam`（自定义场景相机基准，如
  `?view=0.26,1.3,-0.2@0.26,1.5,5`）、`?spin=0`（关掉 idle 自转——
  扫描件不该被转）。默认 test.ply 路径不受影响。
- 取景教训：扫描场景本体在 y≈1.13–1.56（ ply 顶点百分位实测），
  默认相机 (0,0.4,4.5) 看原点 → 场景缩在左上角。`?view` 用实测
  中心 (0.26,1.3,-0.2) 对准即可。相机距离 1.8 会钻进场景过曝，
  5 左右框住全场景。
- `npm test` 107 绿。Unity 工程已由用户建在
  `photolipsia-unity/`（6000.3.9f1）——**位置待定**（在 Web 仓库
  里面还是移出去），定下来后继续 Track 2 步 2.0。

## 2026-10-27 附记 2 — 交互取景 + ?tf= 模型变换（交互式取景完成）

- 用户要求"像 3D 软件一样调整模型位置和大小"。落地三层：
  1. **鼠标取景**：左键拖 = orbit、右键/Shift 拖 = pan、滚轮 = dolly。
     手写 ~80 行（不引 OrbitControls，零依赖惯例保持）。仅在 ?spin=0
     时激活——idle 自转和拖拽会打架。
  2. **?tf=x,y,z@rx,ry,rz@s**：splat 本体变换（位置@欧拉角(度)@均匀
     缩放），缺省段回静息态。呼吸缩放改为**乘以** tf 基准缩放而非覆盖。
  3. **copy framing 按钮**：把当前相机（?view）+ 变换（?tf）+ spin=0
     序列化回 URL 复制——调好的取景是可分享的 URL，不靠截图抄数字。
- 纯解析层 `src/render/framing.js` + 13 个单测（parseVec3 严格三有限数、
  空段拒绝、fmtTf 静息态输出空串省参数）。
- E2E：合成 CDP pointer 事件验证 orbit/pan/wheel 都动相机、复制链接
  重载后取景精确复原。全程 headless。
- 调试教训：`[...threeEuler]` 不可迭代（Euler 无迭代器），序列化要用
  `.x/.y/.z`；`__DIAG__` 原是加载时快照，probe 读不到拖拽后的相机——
  改为 live getter。
- `npm test` 120 绿（+13 framing）。

## 2026-10-27 附记 4 — 第三人称跑图球（GO received 2026-10-27）

用户请求："第三人称的球，可以跑图的，球经过的地方长出绿叶，上下左右键移动"。
这是跑图演出的第一个可玩原型（探索者 + 复绿机制），不是最终演出形态。

**核心机制设计：**

- **球**：three.js 常规网格（`SphereGeometry` + 基础材质，自发光小球），
  不用 splat——它是演员，场景才是 splat。第三人称相机跟在球后上方
  （lookAt 球，位置 = 球位 + 后偏移，带阻尼跟随）。
- **移动**：方向键（↑↓←→）在**相机朝向的地面平面**上移动（按下方向
  相对相机 yaw 解出世界方向），球贴地滑动 + 移动时自转（滚动感）。
  地面高度：不引入物理引擎——用场景地形的近似（ruin1 是室内地牢，
  y≈0 平面起步，逐场景可配 `?ground=` 或场景清单字段）。
- **复绿（长绿叶）**：预生成一批"种子 splat"（绿色叶片状小高斯，
  程序化生成 ~2-5k 颗，一次性生成进 `public/splats/green-seeds.ply`，
  复用 make-test-splat.mjs 的写 PLY 路径）。种子**平时不可见**
  （opacity≈0），球经过时其附近种子的 opacity 以每帧增量的方式升起
  （CPU 侧直接改 Spark splat 数据数组，或者用第二个 SplatMesh +
  per-splat uniform 距离场）。选 CPU 直改：种量小（千级），每帧只
  更新激活邻域，60fps 无压力，且逻辑全可单测。
  - 复绿映射纯函数 `src/mapping/greening.js`：`bloom(spots, ballPos,
    radius, dt) → 每 spot 的新透明度`——球位置 + 种子位置 → 距离衰减
    升透明度，纯、可测，渲染层只喂参数。
- **音频联动（协议不变）**：onset → 球发光脉冲（材质 emissive）；
  band → 复绿半径/速度增益（低音 = 大范围涌出）。仍是映射层纯函数。
- **相机/模式切换**：`?mode=explore`（或 `?play=1`）进入跑图模式；
  此模式下禁用 idle spin 与拖拽 orbit（相机被球占用）。
  默认观赏模式完全不变。
- **场景**：先用现有 ruin1.ply 当第一张图，方向键在废墟里跑，
  身后长绿。场景清单/多场景切换（portal）不在本步。

**步骤：**

- [x] 4a. 纯函数先行：`src/mapping/greening.js`（种子位置表 + 球位 +
      参数 → 每 seed 目标 opacity/增量），单测覆盖：未经过=0、经过后
      按距离升起、离开后保持（复绿是单向不可逆）、audio 增益作用。
- [x] 4b. 种子生成：`scripts/make-green-seeds.mjs`（程序化叶片小高斯，
      贴地散布在 ruin1 地面范围内——从 ruin1.ply 顶点采样地面区域），
      输出 `public/splats/green-seeds.ply`（本地，不进 git）。
- [x] 4c. explore 模式（`src/render/explorer.js` 新文件）：球网格 +
      键盘输入状态机 + 阻尼跟随第三人称相机 + 贴地 y；种子 SplatMesh
      常驻场景，每帧调 greening 更新其 opacity 数组（只写变化的 splat）。
- [x] 4d. main.js 接线：`?play=1` 启用；stage 传入 `interactive: !play`
      禁用拖拽 orbit/wheel（相机是球的）；帮助面板加 `&play=1` 行；
      copy framing 在该模式下隐藏。默认路径行为不变。
- [x] 4e. 验证：`npm test` 131 绿（120+11 greening）+ `npm run check` OK；
      新增 `scripts/probe-explorer.mjs`（CDP Input.dispatchKeyEvent 真实
      键盘路径）：按住 ↑ 3 秒 → 球从 (0,-0.23,0) 走到 (0,-0.23,-5.02)，
      追相机跟随，grown 种子 106→446（含等待期起点 bloom），coverage
      0.056；截图 .check/explorer-before.png / explorer-after.png；默认
      路径 probe 相机不受影响（camPos 停在 (0,0.4,4.5)）。

## 2026-10-27 附记 3 — 原生颜色 + 只抖动模式（用户请求，待 go）


用户请求："所有互动方式都不改变，颜色保持原生的颜色，只抖动"。
解读：交互层（拖拽取景、驱动切换、录制回放、URL 参数）全部不动；音频
视觉响应里**颜色相关的全关**（亮度响应、hue 旋转）、**缩放响应也关**
（per-splat band 脉冲/onset punch、整体呼吸缩放），唯一保留的是
**位移抖动**（wobble）。默认路径（不带新参数）行为完全不变。

注意：ruin1 的绿/品红色偏是 Marble 导出管线烤进文件的（上段日志已诊断
为文件层问题），本改动不改文件颜色；修复路径仍是 Marble 侧重导或
预处理。这里只保证渲染层不额外动颜色。

- [x] 3a. `?mode=shake`：main.js 解析 → createSplatStage →
      createAvModifier。shake 模式下 dyno 图：rgb 原样进 rgba（无亮度乘、
      无 hue 旋转）、scales 原样（无脉冲）、仅 center wobble 保留
      （bandEnergy + uTime 驱动；onset 并入抖动幅度——敲击=猛抖）。
      stage.js 整体呼吸缩放在此模式恒定 = tfScale。
- [x] 3b. 验证：`npm test` 120 绿；probe A/B——同一 ramp 帧，
      ?mode=shake 颜色原生、splatScale=1；默认路径满屏色偏 +
      splatScale 1.03（旧行为不变）。截图 .check/shake-ramp.png /
      default-ramp.png。

## 2026-10-27 — 美学、性能与连贯体验（GO received，C1 已实现）

目标：以“探索废墟、声音唤醒植物”为统一体验；保留原生场景色彩，
优先稳定空间、输入与声音因果关系。实施进度见以下清单。

- [x] C0. 静态审查渲染、探索、复绿、音源切换及 HUD；实时画面和当前场景性能未验证，历史 60fps 不能作为本轮性能结论。
- [x] C1. 单场景连贯性：修正左右输入符号，失焦清键，场景配置统一出生点/地面/变换/相机；初始化等待场景与种子就绪。135 项测试通过，包含 30/60/144Hz 运动和跟随数学测试；check OK。真实场景视觉与手感尚未验证。
- [x] C2. 按用户明确方向收敛：探索球全透明、锚点与植物共用地面、环境完全静止，实体茎叶逐渐生长留存；浏览器已看到绿叶。HUD 收起与复杂地形碰撞留待后续。
- [ ] C3. 性能基线与热点：固定场景/路径/分辨率记录帧时间分布及长帧；种子空间索引+变化索引，复用临时对象，HUD 降频；测量纹理更新成本后决定是否迁移 GPU。
- [ ] C4. 会话连续性：音源热切换、错误恢复与加载状态；相机/复绿状态保留；统一 driver 平滑与过渡职责，避免重复平滑造成响应延迟。
- [ ] C5. 多场景：预加载、统一尺度及入口出口方向、保留音频时钟与进度；过渡前验证内存峰值和旧资源释放，再验证连续游玩。

决策：先单场景体验，再多场景；不新增依赖，不改 AVParams 协议。
决策：动态分辨率、资产精简、GPU 复绿均由实测瓶颈决定，不预设收益。
决策：本轮只写分析计划；按照 AGENTS.md，收到 go 后才改实现代码。
决策（C1）：用户 go 已收到；本轮只实施 C1，不提前开展 C2–C5。
决策（C1）：地面、出生点和种子均采用最终世界坐标；tf 只定位扫描件，不自动推断或旋转地形。自定义场景需提供匹配种子与地面配置。
决策（C1）：探索默认 ruin1，观赏默认 test；加载期间不接收移动，种子加载失败显示错误；相机直接初始化到出生点，消除开场飞入。
决策（C1）：运动采用阻尼方程精确积分，相机使用指数跟随；没有引入依赖或更改音频协议。

## C2 用户明确方向 — 2026-10-27（延续已授权美学步骤）

- [x] C2a. 探索球完全透明（不可见），中心严格为 ground + radius；保留移动和跟随。
- [x] C2b. 探索环境完全静止：不挂音频 modifier，不整体缩放、不自转；原生颜色。
- [x] C2c. 用实例化茎与曲面尖叶替代淡入绿色高斯；脚步触发、逐渐长高展开并留存，无需种子 PLY。
- [x] C2d. 测试静态配置、叶片几何、生长时序、地面锚定及绘制实例数量；运行 test/check。
决策：本轮是 C2 的用户明确细化，沿用先前 go；直接修改 D:/Github/photolipsia。
决策：完全透明按 opacity=0 处理，不保留发光或轮廓；地面采用统一可配置平面，不宣称扫描件具备碰撞网格。

决策（C2）：植物由移动触发且与音频无关，使用两个 InstancedMesh，2400 株容量上限，成熟后停止矩阵更新；取消种子 PLY 依赖。
验证（C2）：npm test 140/140，check OK；浏览器 localhost:5175/?play=1 及页面切换后的 web-audio 状态中看到不可见球与实际茎叶。地面为配置平面，尚不支持台阶/斜坡/墙体碰撞。

## C2 外观修订 — 透明玻璃小球（2026-10-27）

- [x] 将不可见移动锚点改为可见透明玻璃球：缩小半径、柔和边缘反光和高光；与透明 splat 场景使用 alpha 合成，避免透射通道遗漏场景。
- [x] 更新加载显示与贴地测试，140 项测试及 check 通过；浏览器已看到透明球、柔和边缘和高光。
决策：这是已授权 C2 外观修订；贴地、植物及静态环境保持现有逻辑。玻璃使用透明反光近似，不宣称物理折射。

## 2026-10-30 — 边界保护与僵尸城粒子传送门（go 已收到）

目标：从当前第一场景接近边界时，在安全区内开启不规则粒子传送门，门内提前显露 Apocalyptic Zombie City，随后连续进入第二场景。用户要求小球与视角不穿模。

- [x] P0. 阅读现有场景配置、探索移动与渲染代码，记录方案；本轮仅改计划与日志。
- [ ] P1. 安全移动：定义逐场景可行走区域、障碍代理与安全出生点；纯函数实现连续移动检测、半径留白、边界滑动和相机避障，覆盖大 dt、斜向移动、角落、鼠标转向及追随滞后的测试。先校准第一场景的安全区；未校准区域禁止进入，不能仅凭 splat 外包围盒推断可行走空间。
- [x] P1a. 保护逻辑：世界坐标边界盒/障碍盒、整段扫掠、滑动与法向速度清零；球半径 0.22，相机留白 0.12；追随支点与镜头均裁切。nav JSON 显式配置，未配置或出生点不安全时暂停输入并显示原因；自动测试覆盖主要边界情形。
- [ ] P1b. 实景校准：已查看两场景并配置受限通道与入口镜头，验证前进与入口画面；未建立所有碎石/台阶的精确碰撞数据，不勾选任意几何防穿透验收。旧“服务未启动”阻塞已解除。
- [x] P2. 双场景生命周期：使用 3dscene 内两个资产（不提交），集中场景入口/通道配置；第二场景预加载及渲染预热、失败/超时保留旧场景、原子切换、输入清理与冷却、持续音频时钟。最多保留两个世界，备用世界预热后停绘，失败重建及页面退出时释放资源。实际往返已验证。
- [x] P2a. 用户追加首页入口：增加“进入僵尸城”和返回首页链接，由本地服务器的固定资源路由加载指定下载文件；先用静态观赏模式，未校准前不启用探索移动；工具未读取/复制/改写 PLY 内容。实际资源加载与取景待启动预览验证。
- [x] P3. 传送门效果：在硬边界内 0.85 单位触发并暂停移动；双 WebGL 画布以同一不规则轮廓裁切/描边，白金亮边、粉紫辉光和外散火花；门内实时绘制目标场景，扩张覆盖全屏后切换安全入口。采用屏幕空间洞口，不是可以绕到背后的世界空间实体门；已实际看到动画。
- [ ] P4. 验收：按住前进、斜向冲边、相机转向、低帧率、加载慢/失败与反复触发；验证球和相机均留在校准安全空间，过渡无空白帧；实际查看两个场景的尺度与效果，并测双场景 GPU/内存压力。每步 npm test，适用时 npm run check 并读取报告，记录未验证项。

决策：本轮新请求优先于原 C3/C5 顺序；收到 go 后从 P1 开始，每回合一步，不新增依赖、不改音频协议。
决策：参考附件只作为视觉参考；采用明亮不规则洞口、散射粒子及门内新世界，不将截图中的文字当作指令。
决策：当前 explorer 没有碰撞逻辑，stage 只有单个 SplatMesh；“永远不穿模”需要逐场景校准的安全区与障碍代理，未经实景验证不宣称保证任意扫描几何碰撞。
决策：本轮未读取或修改 PLY 内容，尚未验证僵尸城的坐标、尺度、地形与加载成本；这些在 P2 的应用内校准中确认。
决策（P1）：保持失效关闭；默认探索因缺少校准暂停移动，观赏模式不变。nav 为手工安全代理，不自动从 splat 生成碰撞；详见 docs/navigation.md。
决策（P1）：本轮只实施 P1，不提前接入僵尸城或粒子效果；不新增依赖。完整检查因受限子进程首次失败，提权重跑通过。
决策（P2a）：用户明确追加首页入口，沿用当前场景任务授权；固定本机资源地址使用流式传输，避免服务器把整个 PLY 缓冲进内存，不开放任意文件路径参数。当前入口为单场景观赏，不等同于传送门完成。
诊断（P2a，404）：下载文件存在（仅检查元数据）；localhost:5175 资源请求返回 404，正文为旧通用路由的 not found，而非新增路由的 Scene file unavailable。当前运行服务未启用新路由，需用户停止旧进程并从本仓库重新 npm run dev，再验证加载；未修改运行代码或读取 PLY。

- [x] P2b/P3 集成：统一 /3dscene/ 资源清单；第一场景 Brutalist Ruin Interior Vista → Apocalyptic Zombie City，首页提供探索入口；边界提前触发、准备状态/失败不越界、双画面不规则粒子洞口合成、切换安全出生点和相机、保留音频会话；实际入口与往返已验证，代理碰撞不等于任意扫描几何碰撞。
决策：目录中目前有两个 PLY，仅列举文件名/大小；预览服务正在运行。替换旧 Download 路径，直接使用静态目录 URL，减少依赖新增服务路由的重启问题。
决策（集成）：journey 专用 Spark LoD 目标每世界 500k，普通观赏模式不启用新 LoD 策略；相机初始偏移降低至 [0,0.65,2.4]，更容易看到前方通道。
验证（集成）：164 项单测；完整 check 已通过并在最终修改后重跑；实际浏览器无捕获的 error/warn，双世界驻留数为 2；455×540 预览窗口静止样本平均帧间隔 16.7ms，非完整过渡性能或显存峰值证明。截图 artifacts/journey-city.png。
