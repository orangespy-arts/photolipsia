# Development Log

一次工作一段，新的在上。

## 2026-10-27 — 第三人称跑图球 + 复绿（附记 4，`?play=1`）

### What
- 用户请求："第三人称的球，可以跑图的，球经过的地方长出绿叶，通过
  上下左右键移动"。第一个可玩原型落地：
  - **`src/mapping/greening.js`（纯函数，11 单测）**：createSeeds /
    growSeeds / coverage。平面距离衰减（忽略 y），bloom 单向不可逆
    （离开后保持），fully-grown 种子不再消耗工作；bandLow 扩大半径
    （0.8 → ×(1+0.6·bandLow)），onset 加速生长（×(1+0.5·onset)）。
  - **`scripts/make-green-seeds.mjs`**：从 ruin1.ply 流式采样地面顶点
    （1m xz 网格 cell 最小 y → 25 分位 = 楼板高；p2..p98 聚类框两轮
    过滤掉全景天空杂物形成的假地面），3000 颗叶片状小高斯写入
    `public/splats/green-seeds.ply`（opacity 0，本地不进 git）。
  - **`src/render/explorer.js`**：球网格（自发光，onset → emissive
    脉冲）+ 方向键/WASD 在相机 yaw 平面移动（ACCEL/DAMP 阻尼）+ 滚动
    自转 + 阻尼追相机；种子 SplatMesh 初始化后读 packedSplats 建表，
    每帧只写 bloom>0 且 opacity 变化超阈值的 splat
    （`setSplat` + `needsUpdate`）。
  - **接线**：`?play=1` 启用；stage 新增 `interactive` 参数，play 模式
    传 false 禁用拖拽 orbit/wheel（否则和追相机打架）；copy-framing
    按钮隐藏；帮助面板加 `&play=1` 行。默认路径零改动。
  - **`scripts/probe-explorer.mjs`（新）**：CDP
    `Input.dispatchKeyEvent` 走真实键盘路径的 E2E 探针，读
    `window.__EXPLORER__` live hook（main.js 挂的 pos/grown/coverage）。

### Verification
- `npm test` 131 绿（120 + 11 greening），`npm run check` OK。
- probe-explorer E2E：按住 ↑ 3s → 球 (0,-0.23,0) → (0,-0.23,-5.02)，
  追相机跟随（camPos z 3.20 → -1.42），grown 种子 106 → 446，
  coverage 0.056；截图 .check/explorer-before/after.png。
- 默认路径（?spin=0 无 play）probe：camPos 停在 (0,0.4,4.5)，行为不变。

### Lessons（调试记录，防重蹈）
- **3DGS PLY 行大小是 14 floats = 56 字节，不是 62**。make-test-splat.mjs
  里"rowSize = 62"的注释本身就是错的（3+3+3+1+3+4=14 项 × 4B）。验证
  脚本先怀疑数据、后才发现是验证器自己错了——**先验证验证器**。
- **DataView 套 pooled Buffer 的坑**：`new DataView(buf.buffer,
  buf.byteOffset)` 忘了 byteLength 时越界读会静默给出垃圾；验证小文件
  直接用 `buf.readFloatLE(offset)` 最稳。
- **全景扫描件的"假地面"**：天空杂物落在低 y 处会形成远处假地板 cell；
  1m 网格 + 楼板分位数之后必须再做 p2..p98 聚类框过滤，否则种子撒到
  空中。
- probe.mjs 的 URL 是**位置参数**（argv[2]），不是 --url flag。

### Open questions
- 跑图手感（速度 6.5 加速度、相机 (0,1.6,3.2) 偏移）是拍的，等用户
  试玩反馈再调。
- 地面高度目前硬编码 ruin1 的 y≈-0.23；多场景时需要逐场景配置
  （`?ground=` 或场景清单字段）。

## 2026-10-27 — ?mode=shake：原生颜色 + 只抖动（附记 3）

### What
- 用户请求："所有互动方式都不改变，颜色保持原生的颜色，只抖动"。
  交互层（拖拽取景、驱动切换、录制回放、全部 URL 参数）不动；新增
  **`?mode=shake`** 收紧音频视觉响应：
  - dyno 图（avModifier.js）：rgb 原样进 rgba（无亮度乘、无 hue 旋转）；
    scales 原样（无 band 脉冲/onset punch）；唯一保留 center wobble，
    且 onset 并入抖动幅度（`max(onset, bandEnergy)` 加权）——敲击=
    猛抖一下而不是缩放 punch。
  - stage.js：shake 模式下整体呼吸缩放关闭，object scale 恒为
    tfScale（?tf= 基准缩放仍生效）。
  - 默认路径（不带 mode=shake）一行行为不变。
- 帮助面板补 `&mode=shake` 条目。

### Verification
- `npm test` 120 绿；`npm run check` OK。
- probe A/B（同一 mock ramp 帧，ruin1.ply，t≈8.7s）：
  - `?mode=shake`：水泥原生色，splatScale=1，只有位移抖动；
  - 默认：满屏绿/品红（hue 放大文件色偏），splatScale 1.0299——旧行为原样。
  - 截图 .check/shake-ramp.png / .check/default-ramp.png。
- 明确边界：ruin1 文件内烤进的绿/品红色偏是 Marble 导出管线问题，
  本改动不修文件颜色；修复路径是 Marble 侧重导或文件预处理。

### Open questions
- 跑图方向多场景机制规划仍等第一批素材到手。

## 2026-10-27 — ?mode=shake：原生颜色 + 只抖动（附记 3）

### What
- 用户请求："所有互动方式都不改变，颜色保持原生的颜色，只抖动"。
  交互层（拖拽取景、驱动切换、录制回放、全部 URL 参数）不动；新增
  **`?mode=shake`** 收紧音频视觉响应：
  - dyno 图（avModifier.js）：rgb 原样进 rgba（无亮度乘、无 hue 旋转）；
    scales 原样（无 band 脉冲/onset punch）；唯一保留 center wobble，
    且 onset 并入抖动幅度（`max(onset, bandEnergy)` 加权）——敲击=
    猛抖一下而不是缩放 punch。
  - stage.js：shake 模式下整体呼吸缩放关闭，object scale 恒为
    tfScale（?tf= 基准缩放仍生效）。
  - 默认路径（不带 mode=shake）一行行为不变。
- 帮助面板补 `&mode=shake` 条目。

### Verification
- `npm test` 120 绿；`npm run check` OK。
- probe A/B（同一 mock ramp 帧，ruin1.ply，t≈8.7s）：
  - `?mode=shake`：水泥原生色，splatScale=1，只有位移抖动；
  - 默认：满屏绿/品红（hue 放大文件色偏），splatScale 1.0299——旧行为原样。
  - 截图 .check/shake-ramp.png / .check/default-ramp.png。
- 明确边界：ruin1 文件内烤进的绿/品红色偏是 Marble 导出管线问题，
  本改动不修文件颜色；修复路径是 Marble 侧重导或文件预处理。

### Open questions
- 跑图方向多场景机制规划仍等第一批素材到手。

## 2026-10-27 — 交互取景（orbit/pan/zoom + ?tf= + copy framing）；Unity 轨道搁置，历史清除

### What
- **交互取景**（用户需求："像 3D 软件一样调整模型位置和大小"）：
  - 纯解析层 `src/render/framing.js`：`?view=look@cam`、
    `?tf=x,y,z@rx,ry,rz@s`（位置@欧拉角@均匀缩放，缺省段回静息态）+
    fmtTf 序列化（静息态输出空串省参数）。13 个单测。
  - stage.js 手写 orbit 控制器（~80 行，不引 OrbitControls）：左键
    orbit、右键/Shift pan、滚轮 dolly；仅在 ?spin=0 时激活（idle 自转
    会和拖拽打架）。呼吸缩放改为**乘以** tf 基准缩放而非覆盖。
  - HUD **copy framing** 按钮：当前相机 + splat 变换 + spin=0 序列化回
    URL 复制——调好的取景是可分享的 URL，不靠截图抄数字。
  - E2E：合成 CDP pointer 事件（.check/verify-framing.mjs）验证
    orbit/pan/wheel 都动相机、复制链接重载精确复原取景。全 PASS。
- **扫描场景接入**（`public/splats/scan.ply`，本地不进 git）：用户的
  AI 视频训练件，951,554 splats、226MB、62 属性标准 3DGS PLY，Spark
  直接吃。取景定位用顶点百分位实测（p2/p50/p98）而非猜。相机距离
  1.8 会钻进场景过曝，5 左右框住全场景。
- **Unity 轨道搁置 + 历史清除**（用户决定）：
  - 背景：用户提出多场景"跑图"演出方向（废墟 → 人经过复绿 → 时空洞
    转场 → 下一场景，声音驱动抖动/复绿速度），素材走 AI 生成下载。
    机制先在 Web 端跑通，Unity 需求等机制定了再评估。
  - 操作：`photolipsia-unity/`（URP 空模板工程，无自定义代码）从磁盘
    删除；`git filter-repo --path photolipsia-unity --invert-paths` 把
    误入库的 64 个模板文件（7607 行，commit 195bf27）从全部历史清除；
    force push 重写后的历史。改写前 `git bundle` 全量备份到
    `../photolipsia-backup-before-rewrite.bundle`。
  - Track 2 计划在 strategy.md 标记 SHELVED（协议文档与
    docs/unity-setup-guide.md 保留，重建有路可循）。

### 调试记录
- `[...threeEuler]` 不可迭代（Euler 无迭代器）——序列化要用 `.x/.y/.z`。
  症状有迷惑性：copy 出的 URL 带 `tf=0,0,0@0,0,0`（应为空），实为展开
  产生的脏值。
- `__DIAG__` 原是加载时快照（watchSplat 里赋值一次），probe 拖拽后
  读到的相机位置不变——改为 defineProperty live getter 后 E2E 才
  能读到真实状态。probe 型验证要假设"读的是活的"。
- `parseVec3('1,,3')`：空段经 `Number('')` 变 0 而非 NaN，静默错值——
  解析器对空段显式拒绝。
- pip 安装在本机超时风险高（Windows Defender 扫描），用 run_in_background
  或直接 `python -m pip --user`。

### Verification
- `npm test` 120 绿（+13 framing）；`npm run check` OK。
- E2E 见上；?tf= 变换 probe 截图验证（1.3× + 30° 旋转结构角度明显变化，
  splatScale 精确 1.334）。
- git：重写后 `git log --all -- photolipsia-unity` 为空、.git 1.4MB、
  force push 成功。

### Open questions
- 跑图方向的场景清单格式、废墟滤镜参数集、复绿触发机制——等第一批
  AI 生成素材到手后规划（素材是下载的，入库清理/归一化是新环节）。
- 7e 用户验证仍暂缓。

## 2026-10-26 — Stage 7 (7a–7d): 演出硬化 + 驾驶员切换 UI + strategy 恢复

### What
- **7a 帧率审计**（`scripts/probe.mjs --fps`）：300 帧 rAF 计时 →
  fps/p50/p95/max + >34ms 帧数，PASS/FAIL 退出码。结果：**60.0fps，
  p95 16.8ms，max 16.9ms，0 帧 >34ms —— 一次通过**。嫌疑对象
  （monitor DOM 写入、环形缓冲 shift）在这些规模下都不构成瓶颈，
  无需修改。
- **7b 延迟测量**（`scripts/probe.mjs --latency`）：mock onset 跳变 →
  画布像素响应（逐帧 drawImage 条带采样）。结果：**均值 ~16.5ms
  （n=2）—— 恰好一帧**，即架构下限（帧 N 更新的 uniform 在 N+1 渲染）。
  驱动侧数字记录在 docs/rehearsal.md §5。钩子：main.js 每帧写
  `window.__LAST_ONSET__`。
- **7c 多屏**：Spark 无原生多视口；支持路径是每输出一个全屏窗口。
  两个并发 probe 实例各自保持 60fps p95 16.8ms —— 此 splat 规模下
  无跨窗口争用。物理双屏确认留给用户（需真实显示器）。
- **7d 全离线彩排清单**（`docs/rehearsal.md`）：开演前步骤
  （npm ci → fps 审计 → splat 就位）、离线验证（全部导入解析到本地
  node_modules —— 无 CDN，零依赖决策兑现）、各驱动彩排+录制回退、
  故障切换演练（杀掉现场源 → 回放接管）、已知延迟、演出日流程。
- **7e 用户验证暂缓**（用户暂时无法本机验证）：彩排清单（含断网
  全流程）+ 双屏物理验证，移入 strategy.md Next 待办。
- **会话 UI 打磨**（两个已提交 commit）：HUD 增加**驱动切换按钮行**
  （mock/web-audio/osc/midi/playback，高亮当前项；切换即导航——
  AudioContext/WS/MIDI 属页面生命周期，reload 干净释放；清除
  driver 专属参数防误导）；`?splat=/splats/x.ply` 自定义场景
  （public/ 下任意 3DGS .ply/.splat，y-up 翻转与 dyno modifier 照常
  生效），帮助面板补条目。
- **strategy.md 意外回退修复**：commit 8370444（"track2 plan"）把
  strategy.md 覆盖成了 Stage 7 未开工的旧版——7a–7d 勾选结果、7e
  暂缓说明、整份 Track 2 计划全部丢失（残留 "rendgering" 错字）。
  从 881e335 恢复完整版本。教训：提交前 diff 要看一眼方向对不对。

### Verification
- `npm test` 107 绿；`npm run check` OK。
- probe.mjs --fps/--latency 输出见上；rehearsal.md 用户侧验证暂缓。

### Next
- 7e（暂缓）：用户本机跑 docs/rehearsal.md（断网全流程、双屏、
  故障切换）。
- Track 2（Unity 工程）计划已就绪，等 "go"；docs/unity-setup-guide.md
  是配套搭建指南（状态：未开始）。

## 2026-10-26 — Stage 6: param recorder/playback + session UI

### What
- **6a 录制器**（`src/rec/record.js`，纯、Node 可测）：环形缓冲默认
  18000 帧（60Hz×5min），旧帧滚落并计 dropped；`toJSONL()` 导出；
  `recordingName()` 生成可排序文件名（rec-驱动-日期-时间.jsonl）。
  **格式 = 协议帧本身**：一行一帧 JSON，version 字段随行——录制文件是
  协议合法的帧流，未来 Unity 轨道读同一格式，record/play 两层保持哑。
- **6b 回放读取器**（`src/rec/play.js`，纯）：parseRecording——垃圾行
  （JSON 解析错误**和** sanitize 错误）**整行丢弃并计数**，不致命；
  尾行截断（写盘中途崩溃）只丢那一帧；防御性时间升序排序；`frameAt(t)`
  二分查找，exact-frame 语义（time ≤ t 的最后一帧生效，起点前 → null
  由调用方决定Hold/gap）。**不添加任何平滑**——录制的是驱动器平滑后
  的值，铁律 1 跨录制/回放往返保持。
- **6c 回放驱动**（`src/drivers/playback.js`）：首次 poll 把墙上时钟
  锚定到录制起点+t0；默认循环（回绕），loop=false 钳制到末帧保持；
  帧原样重发（source 标 'playback'，不改动录制的帧——磁盘上 source
  保持原驱动）。
- **6d 录制接线**：HUD `rec` 按钮切换；录的是**后增益帧**（渲染可见值
  ——所见即所录，?gain= 的调参结果一起进录制）；录制中按钮显示秒数；
  停止 → Blob 下载，状态栏报帧数。
- **6e 验证**：+13 测试（往返、环形缓冲、垃圾容忍、exact-frame、
  不可信文件门、回放驱动锚定/偏移/循环/无变异），107 总绿。
- **6f UI 打磨**：HUD 按钮一行化（beat / rec / ?），`?` 帮助面板列出
  全部 URL 参数—— Stage 0 攒到现在的 ?driver/?kind/?source/?simulate/
  ?osc/?rec/?t0/?gain/?beat 一页可见。
- serve.mjs 加 `/rec/*` → `public/rec/*` 映射 + .jsonl MIME。

### 调试记录
- 垃圾行判定第一版用启发式（sanitize 后全零且有错误 → 丢弃）——
  `{"rms":"loud","time":1}` sanitize 成 rms=0/time=1 被误判有效。改成
  干脆的规则：**sanitize 有 errors = 整行丢弃**。比"钳制后收下"更严格
  的理由：录制文件验证失败说明文件可疑，丢帧好过修帧（与 OSC 入口的
  sanitize-then-use 不同——那是实时流，那是档案）。
- 回放驱动测试里 first-poll 锚定语义：锚定发生**在首次 poll**，所以
  测试必须先 poll(0) 再 poll(dt)——直接 poll(2.0) 会把 2.0 当锚点。

### Verification
- `npm test` 107 绿；`npm run check` OK（rec/record、rec/play 进导入
  smoke）。
- **用户端到端确认**：录制 mock/simulate 演出 → .jsonl 下载 →
  `?driver=playback` 文件选择器回放 → 同样的演出循环重演，监测条模式
  与录制一致。Stage 6 关闭。

### Next
- Stage 7：演出硬化（固定 60fps 路径、延迟检查、多屏、全离线彩排清单）。

## 2026-10-26 — Stage 5: MIDI driver (+ simulator, no hardware needed)

### What
- **5a 纯核心**（`src/drivers/midi/midiCore.js`，Node 可测）：设备即 DSP 端
  ——velocity 0–127 → /127 直接是协议值（铁律 2 免费拿），驱动器只做组装：
  - note on (vel>0) → 事件 {type:'note', pitch, velocity, time} +
    **velocity 缩放的 onset 充电**（重键狠、轻键柔——"onset 不是布尔"的
    MIDI 版）；note off 和 vel-0 note-on（MIDI 规范等价）→ velocity-0 事件
  - CC 映射表 `CC_MAP`：1 调制轮/11 表情 → bands.mid（follower 平滑）、
    64 延音踏板 → bands.high（踩下保持、松开衰减）、74 brightness →
    centroid（直通）。未列的 CC 忽略——扩表须连协议文档一起改
  - pitch bend 14 位（8192 中位）→ centroid
  - **MIDI clock 0xF8 → beatPhase** = ticks%24/24：真节拍源（对比
    web-audio 的自估器）；0xFA/0xFB 重置 tick 计数，停摆 >2s 自动失效
    （协议：无节拍源 → 恒 0）
  - 通道位忽略；poll() 组装完整帧（铁律 3：衰减在此发生、保持在此保持）
- **5b 浏览器封装**（`index.js`）：requestMIDIAccess({sysex:false})、绑定
  全部输入口、ev.timeStamp/1000 作事件时钟（与 poll 同源 performance.now）、
  热插拔 onstatechange、设备名暴露给状态行。
- **5c** `?driver=midi` 懒加载；状态行显示设备名。
- **模拟演奏器**（`simulate.js` + `?driver=midi&simulate=1`）——用户没有
  MIDI 键盘，这成为正式验证路径：脚本化 8s 循环（120bpm kick 强弱交替、
  每 eighth hi-hat、CC1 正弦、CC74 扫频、真 MIDI clock 字节流）喂给**与
  硬件完全相同的字节路径**（bytes → core → 协议 → 渲染）。anchor() 把
  调度锚在首次 poll 的墙上时钟，避免页面晚载导致的爆发回放。

### 调试记录
- **事件窗口重复**：generate 的边界含等号（`<= to`）让同一边界时刻被相邻
  两片都发一次（kicks 出现 0.5, 0.5）。改半开区间 `[from, to)` + 1e-9 容
  差的 `ceil(from/step - 1e-9)` 起点——边界时刻由"从它开始的那片"发且只
  发一次。连续 60fps 调用下语义正确。
- 测试计数预期连错两次（120bpm 一秒 2 拍不是 4 拍；半开区间端点不属本窗
  口）——对着字节流打印修正。
- 60fps 采样 48Hz clock：相邻帧 phase 可能相等（本帧无新 tick）——断言
  改为"前进/相等/回绕"三态合法。
- midiCore 第一版有个 feed2/origFeed 间接层（feed 返回值再收集）——重写
  为 feed 直接改状态、poll 只组装，接口诚实。

### Verification
- `npm test` 94 绿（+15 midiCore、+6 simulator/full-chain）。
- `npm run check` OK（midiCore 进导入 smoke）。
- 全链路测试证明：模拟字节流 → core → 协议帧，2s 内 onset 充放电、
  centroid 扫频、beatPhase 按 120bpm 步进回绕、事件数正确。
- **用户确认**：`?driver=midi&simulate=1` 验证通过——状态栏 `driver: midi
  — simulated performance`，视觉随 8s 循环呼吸/跳动/变色，beat 行 120bpm
  步进。真硬件路径（`?driver=midi` 不带 simulate）留待有设备时验证。
  Stage 5 关闭。

### Next
- Stage 6：参数录制/回放（.jsonl）、会话 UI 打磨。

## 2026-10-26 — Stage 4: OSC driver + dumb UDP↔WebSocket bridge

### What
- **4a OSC 解码器**（`src/drivers/osc/oscDecode.js`，纯、零依赖、Node 可测）：
  typetags i/f/s/b、严格 4 字节对齐、#bundle（timetag 解析但忽略——立即
  处理不做调度）、嵌套 bundle 展平。坏包抛 `OscError`（调用方丢包，绝不
  崩渲染循环），13 个测试全部用手工字节包。
- **4b 地址映射**（`oscMap.js`，纯）：协议文档的 OSC 地址表直接变成代码。
  `OscFrameAssembler`：feed(msg) 累积一个 60Hz 周期，takeFrame(now) 过
  sanitizeParams 并原地重置——陈旧值不漏到下一帧，缺席字段归 0（静音，
  不是卡住的旧值）。未知地址忽略（向前兼容）。6 测试。
- **4c 哑桥**（`scripts/osc-bridge.mjs`，Node 零依赖）：dgram UDP :9129 →
  手写最小 RFC6455 WebSocket :9128（握手 + 二进制帧 + ping/pong；浏览器
  上行帧读入即弃——桥是单方向的）。每个 UDP 包原样广播给所有 WS 客户端，
  不理解内容。`--udp/--ws` 参数。
- **4d 浏览器驱动**（`drivers/osc/index.js`）：WS 客户端 + 指数退避重连
  （0.5→8s）。**断链保护**：0.5s 无包 → 全字段按 τ=0.3s 释放衰减归 0、
  centroid 回中性 0.5——掉链子不能让视觉卡死在一个姿势。OscError 静默
  丢包，真错误照常上抛。
- **4e 接线**：`?driver=osc&osc=localhost:9128`（懒加载，同 web-audio 模式）。
  附 `scripts/osc-test-sender.mjs`（60Hz 脚本信号：8s 循环 ramp + 质心扫频
  + 120bpm kick）和 `scripts/smoke-osc-bridge.mjs`（一次性冒烟：起桥 →
  UDP 发包 → 断言 WS 原样收到 → 退出，非长期进程）。
- 责任划分与 web-audio 驱动相反：**平滑/归一化在 DSP 端**（Max/SC）——
  桥和浏览器驱动都不做平滑，协议铁律 1 由发送方履行。

### 调试记录（OSC 字节层的坑）
- **OSC 字符串 pad 公式**：NUL 终止后补齐到 4 的倍数，且**至少 1 个 NUL**
  ——pad = `4 - len%4`（不带外层 %4）。第一版 `(4-len%4)%4` 让 12 字符
  地址（恰好对齐）发了 0 个 NUL，解码器把 `,f` 的 `,` 读进了地址。真实
  OSC 发送方永远至少 1 个 NUL——是测试 helper 错，不是解码器错。
- `Array.prototype.flat` **不展平 TypedArray**；`Uint8Array.of(...[u8obj])`
  把一个 Uint8Array 对象折成一个 NaN→0 元素。测试 helper 改为先 map 成
  普通数组再 flat。
- OSC f32 精度：60 编码成 f32 解码回 60.0000009——测试断言全部改近似
  比较，deepStrictEqual 只用于地址/字符串。
- blob 长度字段声明内容长度，对齐 pad 不属于内容（解码 slice 到声明长
  度是正确行为，测试期望写错过）。
- readStringAt 第一版从 offset 0 搜 NUL、第二版覆盖偏移而非累加——字节
  层解析器每一处偏移推进都要对着字节转储验证。

### Verification
- `npm test` 73 绿（+19 OSC：13 解码 + 6 映射）。
- `npm run check` OK（oscDecode/oscMap 进导入 smoke）。
- `node scripts/smoke-osc-bridge.mjs` OK（UDP 包原样出现在 WS）。
- **用户端到端确认**（截图 `ai/stage4.png`）：test-sender 60Hz → 桥
  （udp 224B → 1 ws client 日志）→ 浏览器 `?driver=osc`：八条监测条全部
  活动，beatPhase 由 sender 的 120bpm kick 驱动，splat 随信号变形变色。
  Stage 4 关闭。

### Next
- Stage 5：MIDI 驱动（note→onset 事件、CC→连续量、clock→beatPhase）。

## 2026-10-26 — Stage 3: web-audio driver (mic/file), autogain, beat estimation

### What
- **3a 纯 DSP 核心**（`src/drivers/webaudio/dsp.js`，无 Web Audio 依赖、Node
  可测）：频段分箱按协议边界 20–250/250–2k/2k–16k；频段能量 = 该频段占全谱
  能量份额（√压缩）——第一版"band 均值/全局 max"会稀释宽频段（high 频段
  1400 bin 只有 11 个非零，hi-hat 信号 high 能量算出 0.099），份额法尺度
  无关且不受 bin 数量惩罚；质心走真对数刻度 20Hz–20kHz（80Hz≈0.20、9kHz
  ≈0.88），静音→中性 0.5；谱平坦度带相对下限（1e-6×max），稀疏音读作音调、
  静音→0；onset 用 spectral flux + 运行均值/方差（~1s 时间常数）得 fluxRatio。
- **3b 自动增益**（`autogain.js`）：每字段衰减峰值跟踪器——瞬时上升、τ=8s
  缓降、warmup（前 40 帧）不缩顶、0.02 下限防除零。安静房间也能满量程。
  centroid/flatness 尺度无关，直通不增益。
- **3c 驱动封装**（`webaudio/index.js`）：AudioContext + AnalyserNode
  （fftSize 2048，**smoothingTimeConstant=0**——平滑全归驱动器，铁律 1）。
  mic：getUserMedia（echoCancellation/noiseSuppression/autoGainControl 全关）；
  file：MediaElementSource 循环播放并接 destination。dB→线性幅度换算在此层。
  poll() 全管线：analyze → autogain → attack(50ms)/release(200ms) follower
  → flux 触发 + onset 充电衰减包络。
- **3d 接线**：main.js 懒加载——只有 `?driver=web-audio` 时才 import 驱动
  模块并请求麦克风权限；`?source=mic|file`，文件经动态 `<input type=file>`
  选择器（取消有 focus 兜底）。mock 保持默认。
- **3e 遗留清理**：avModifier.js 里可疑的 `dyno.vec3(wob1, m, wob2)`（Stage
  2b 判定的坏构造器路径）替换为逐分量 `dyno.combine({vectorType:'vec3',
  x,y,z})` + swizzle center——已验证可靠路径。Stage 2b 遗留项关闭。
- **3g 节拍估计**（`beat.js`，用户请求：说话时 beatPhase 恒 0 → web-audio
  加自估节拍 + 可关按钮）：纯 onset 栅格自相关——6s onset 滑窗，扫描
  60–300 BPM 候选周期，栅格对齐分最高者胜（onset 落栅格线的接近度求和）；
  相位锚定最后 onset（打击=相位 0）；置信度 = 对齐分 × 漏拍衰减（~4 拍归
  0）。**置信门槛 0.6**：语音对齐分上不去 → beatPhase 保持协议 0。UI：
  HUD `beat: on/off` 按钮，运行时经 driver.setBeatEnabled() 切换（关 =
  跟踪器整个不跑）；`?beat=0` 默认关。八分音符等细分也能锁（maxBpm 300
  覆盖细分栅格）。

### 调试记录（3a/3g 的坑）
- onset 包络第一版"先充电后衰减"→ 触发帧自己衰减了一格，改为先衰减后
  充电（触发帧拿全额强度）。
- 测试预期两处算错：release 衰减 100ms 只吃了 ~40% 不是 50%+（exp 物理）；
  80Hz 质心在对数刻度上是 0.2065——这是**正确值**，是阈值写错不是代码错。
- beat 周期换算漏 ×60：`1/maxBpm` 给 0.0056s 而非 0.333s，扫描范围错 180
  倍导致锁到错误栅格。`60/maxBpm` 修正。
- 语音用例伪随机序列能侥幸擦过 0.5 锁定线 → 锁定门槛提到 0.6 + 输出侧
  二道门（score<0.6 时 confidence 恒 0）。
- JS 语法坑：`-(i/width) ** 2` 是 SyntaxError（一元负号紧邻幂运算符），
  需括号 `-((i/width) ** 2)`。

### Verification
- `npm test` 54 绿（+8 beat、+5 env、+6 autogain、+13 dsp，原 22）。
- `npm run check` OK（导入 smoke 加了三个纯 DSP 模块）。
- **用户听感确认**（3f/3g）：说话时 beat 行保持 0 ✓；节奏音乐锁定、视觉
  踩点 ✓；HUD 开关实时切换 ✓。Stage 3 关闭。

### Next
- Stage 4：OSC 驱动 + 哑 UDP↔WebSocket 桥（Node），sanitize 在桥/驱动入口。

## 2026-10-26 — Stage 2b: hue rotation fixed, orientation verified, gain params

### What
- **灰度根因找到了**：不是自定义 Dyno 节点的问题（那个也真有问题，但被这个
  掩盖着）——是 `dyno.vec3(a, b, c)` 标量构造器本身产生错误输出。A/B 二分：
  ① hueAngle 钉 0（hueRotate 应恒等）→ 仍灰度，排除三角函数；② 换成纯
  swizzle→vec3 恒等重建 → 仍灰度，锁定 vec3 构造器；③ 对照 transcript 里
  colors-restored 版本，唯一差异就是中间那层 `dyno.vec3(...)`。
- 修复：`hueRotateChannels()` 返回三个**标量**通道 rp/gp/bp，直接进
  `dyno.combine({vectorType:'vec4'})`（此路径已验证可靠），不经任何 vec3
  构造。hue 重新启用，真实 centroid 驱动：`angle = (centroid−0.5)·π`。
- Probe 截图验证：mock centroid≈0.27 → 整体色相偏移 ~−40°（底部品红、
  顶部黄绿），ramp 模式下色相随 centroid 扫频连续旋转。颜色饱和、无灰度。
- `?gain=` URL 参数（`src/mapping/gains.js` + 单测）：`?gain=low=1.5,onset=2`
  逐字段乘增益、clamp 0..1；onset 乘峰不乘底；**gain=0 = 静音该字段**
  （第一版 `if (gains.x)` 把 0 当 falsy 跳过——0 是有意义的增益，改成
  `!== undefined` 判断，补了单测）。
- main.js 透传 `?kind=` 到 mock driver（ramp 调试入口）。
- probe.mjs 移除 dyno 内省临时块；avModifier.js 移除废弃的 HUE_GLSL 常量。

### Region orientation A/B（通过 ?gain= 隔离单频段）
- low-only（gain=high=0,mid=0,low=2）：球体下半鼓胀，下蛋形 ✓
- high-only（gain=low=0,mid=0,high=2）：上半鼓胀 ✓
- ramp 起点（low=0.58, high=0.02）：下坠形 ✓
- 结论：**low → 屏幕底部（暖色区）、high → 顶部（冷色区），取向正确**；
  同时验证了 gain 链路端到端工作（monitor 数值 0.375×2=0.75 可见）。

### Dyno API lessons（追加）
- `dyno.vec3(a,b,c)` / `dyno.vec4(vec3val)` 作**构造器**时输出错误
  （vec3 标量构造 → 灰度；vec4(vec3) → alpha 缺失编译错）。可靠路径：
  标量通道直接进 `dyno.combine({vectorType, x, y, z, w})`。
  wobble 位移里的 `dyno.vec3(wob1, m, wob2)` 恰好没暴露问题（位移对
  填充模式不敏感？），但按此结论应视为可疑——Stage 3 前替换掉。

### Verification
- `npm test` 22 绿（+6 gains）；`npm run check` OK；probe 无异常，
  截图存档 .check/（ab-low/ab-high/ramp-*）。

### Next
- Stage 3：web-audio driver（mic + file），auto-gain。
- 遗留：wobble 的 dyno.vec3 待换；自定义 Dyno 节点致黑根因仍 TBD
  （vec3 构造器问题解释了它的一部分症状，未必是全部）。

## 2026-10-26 — Stage 2: per-splat GPU audio deformation (dyno)

### What
- `src/render/avModifier.js`: a `dynoBlock` Gsplat→Gsplat modifier wired to
  `SplatMesh.objectModifier`. Audio state travels as 6 uniforms
  (uLow/uMid/uHigh/uOnset/uCentroid/uTime) updated per frame from JS;
  per-splat math runs in GLSL:
  - region-band scale pulse (mirrors mapping/visual.js regionEnergy,
    triangular weights 0.15/0.5/0.85 + 0.1 floor)
  - trig-wobble displacement scaled by band energy (breathing drift)
  - brightness response to band energy
  - hue rotation via custom statement Dyno (YIQ) — **written, bypassed**:
    colors went black through that path; needs an isolation test (Stage 2b)
- `stage.js` updateParams feeds uniforms with a light extra smoothing
  (dt*30 ramp) to avoid pops on live edits.
- Height mapping: object-space y is flipped by the y-down→y-up quaternion,
  so screen height = 0.5 − cy·0.5 (verified visually via the red zone).

### Dyno API lessons (hard-won, keep for Unity-era reference)
- `dyno.float(x)` is a **cast of a DynoVal**, NOT a literal constructor —
  numeric literals go through `dyno.dynoConst('float', x)`.
- `dyno.splitGsplat(g)` returns a Dyno node; fields live on `.outputs`
  (center/scales/rgba/rgb/opacity/x/y/z/...).
- DynoVals have no `.x/.y` JS accessors — components need `dyno.swizzle`
  or the pre-split outputs.
- `dyno.vec4(vec3val)` compiles to GLSL `vec4(v)` (alpha implicit) which
  fails validation ("not enough data for construction") — build vec4 via
  `dyno.combine({vectorType:'vec4', x,y,z,w})`.
- Custom GLSL: `new dyno.Dyno({ statements, globals })` works fine for
  inline helper functions (avHueShift lives in globals).
- `dynoBlock` construct callback receives `(inputs, outputs, {roots})` —
  inputs are used directly, not via `.outputs`.
- Full dyno API surface introspectable at runtime via the probe
  (`Object.keys(dyno)`).

### Verification
- `npm run check` OK; probe: shader compiles (only a benign
  signed/unsigned warning), 6500 splats, ready, breathing + wobble visible
  in screenshots (.check/probe.png), monitor bars live.
- User screenshots archived: `ai/stage1.png` (Stage 1 — static ring,
  whole-object breathing only) vs `ai/stage2.png` (Stage 2 — ring visibly
  warped by the wobble displacement, brightness pulsing). The ring is the
  tell: it deforms non-uniformly, which only per-splat displacement can do.

### Next
- Stage 2b: orientation A/B via mock ramp, hue isolation test, gain params.

## 2026-10-26 — Stage 1: Spark rendering, first splat breathing

### What
- Engine selection: **Spark** (`@sparkjsdev/spark@2.4.0`, MIT, World Labs,
  released 2026-10-20). Decisive factor: Dyno shader-graph compiles JS→GLSL
  running **on the GPU**, injected via `SplatMesh.objectModifier` — audio
  params as per-frame uniforms drive per-splat center/scales/rgba with zero
  CPU per-splat cost. Alternatives rejected: gsplat.js (fading, no per-splat
  mutation API), @mkkellogg/gaussian-splats-3d (static viewer, last release
  2025-01).
- Self-written test-splat generator `scripts/make-test-splat.mjs`
  (6500 splats: spectrum sphere red=low bottom → violet=high top + gray ring;
  3DGS binary .ply, SH DC coefficients, y-down convention). Doubles as a
  visual verification instrument for the Stage 2 region mapping. Course
  kit's equivalent script was downloaded-then-rejected: external code stays
  out of the repo.
- `src/render/stage.js`: three.js scene + Spark SplatMesh, y-down→y-up flip,
  Stage-1 global response (low-weighted breathing scale + onset punch,
  exp-smoothed toward target; hue shift stored but not yet applied —
  per-splat color belongs to the Stage 2 dyno, by design).
- `index.html`: fullscreen canvas + import map for three/spark bare imports.
- `scripts/check.mjs`: now auto-generates the test splat if missing.
- `scripts/serve.mjs`: added `/splats/*` → `public/splats/*` mapping
  (Vite convention our zero-dep server didn't have; 404 found via curl).

### Verification
- `npm run check` OK (16 tests + splat generation + module graph).
- Dev server: page 200, splat 200. Visual confirmation by user pending.

### Gotchas found
- Node 24 `node --test <dir>` doesn't expand directory args — use globs.
- Bare imports (`import from 'three'`) fail in the browser without a
  bundler; fixed with an import map in index.html pointing at
  `three/build/three.module.js` and `@sparkjsdev/spark/dist/spark.module.js`.
  This is the price of our zero-bundler setup; Vite is the fallback if the
  import map ever fights us.

### Open questions
- `splat.quaternion.array = [...]` — unverified Spark API for the y-down
  flip; check browser console / spark docs when user reports the visual.

## 2026-10-26 — Stage 0: repo skeleton

### What
- Initialized the standalone repo (decision: not the course fork; conventions
  borrowed from photolipsia-agentic-kit).
- AVParams protocol v1: `docs/protocol.md` (field spec, three iron rules,
  OSC address mapping) + `src/protocol/params.js` (emptyParams, sanitizeParams).
- Driver architecture: `src/drivers/registry.js` (pull-model interface,
  poll(now) → AVParams), first driver `src/drivers/mock.js` (pulse / ramp /
  silence synthetic signals).
- Mapping layer first pieces: `src/mapping/visual.js` (regionEnergy with
  0.1 floor — no dead regions, pulseScale, centroidHue) and
  `src/mapping/combine.js` (weighted multi-driver fusion, onset = max,
  events concatenated + tagged).
- Dev server `scripts/serve.mjs` (zero-dep static, port 5175) and
  `scripts/check.mjs` (unit tests + module-graph import smoke →
  `.check/report.json`).
- Front page `index.html` + `src/main.js`: driver selection via `?driver=`,
  bar-meter monitor of the protocol fields (`src/ui/monitor.js`).

### Verification
- `npm test` — 16 tests green (protocol shape, clamping, garbage tolerance,
  event filtering, registry, mock decay behavior, combiner, spatial mapping).
- `npm run check` — OK.

### Gotchas found
- Node v24 on this machine doesn't expand a bare directory arg for
  `node --test test/` — use the glob `node --test "test/**/*.test.js"`.
- First version of regionEnergy left dead zones at the extremes (y=0/y=1
  got zero energy for far bands); fixed with the 0.1 floor.

### Open questions
- Splat viewer library choice for Stage 1 (Spark vs gsplat.js vs
  gaussian-splats-3d) — evaluation criteria in strategy.md.
- Source of first test splats.
