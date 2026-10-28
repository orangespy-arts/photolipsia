# Photolipsia 启动指南

适用项目：`D:\Github\photolipsia`  
更新日期：2026-10-28

当前体验：透明玻璃小球贴地移动，经过的地方长出绿叶；草随声音跳动，建筑环境保持静止。

## 1. 每次启动：最常用的方式

在 VS Code 打开 `D:\Github\photolipsia`，选择 **终端 → 新建终端**，运行：

```powershell
Set-Location D:\Github\photolipsia
npm run dev
```

保持这个终端运行，然后打开：

**[玻璃球 + 绿叶 + 麦克风声音互动](http://localhost:5175/?play=1&driver=web-audio&source=mic)**

1. 浏览器询问麦克风权限时，点击允许。
2. 等待场景加载完成，点击画面锁定鼠标；左右移动鼠标转向，上下移动调整俯仰。
3. 按方向键或 WASD 移动，走过的地方会长出草。
4. 对麦克风说话、拍手，或让麦克风听到音乐；不同植株分别偏向低、中、高频：低频起伏，中频摇摆，高频颤动；形态和动作速度也有差异。
5. 环境不随音乐变形；玻璃球也不随音量缩放。

> 平时只需要启动这个网页服务器。麦克风、音乐文件、模拟信号和 MIDI 模式都不需要 OSC 桥。

## 2. 第一次使用 / 依赖缺失

先检查 Node.js 与 npm 是否可用：

```powershell
node --version
npm --version
```

如果命令不存在，先安装 Node.js（包含 npm），再重新打开 VS Code 终端。

在项目目录安装依赖并检查：

```powershell
Set-Location D:\Github\photolipsia
npm ci
npm test
npm run check
```

- `npm ci` 按锁文件安装依赖，一般只在首次安装或依赖变化后运行。
- `npm test` 运行自动测试。
- `npm run check` 检查测试和模块导入，并在需要时生成测试场景。
- 上述检查通过后，运行 `npm run dev`。

**场景文件：** 跑图默认使用 `public\splats\ruin1.ply`。这是本地场景资源，换电脑或重新克隆仓库时需要另行准备；`npm ci` 和 `npm run check` 不会下载它。当前草使用程序化网格，不需要 `green-seeds.ply`。

## 3. 常用启动入口

先运行 `npm run dev`，再选择下列一个入口即可。

| 用途 | 打开页面 | 额外操作 |
| --- | --- | --- |
| 麦克风互动 | [麦克风模式](http://localhost:5175/?play=1&driver=web-audio&source=mic) | 允许麦克风访问 |
| 选择音乐文件 | [音乐文件模式](http://localhost:5175/?play=1&driver=web-audio&source=file) | 在文件选择器中选本地音频 |
| 无麦克风测试 | [模拟节拍模式](http://localhost:5175/?play=1&driver=mock&kind=pulse) | 移动长出草，观察模拟节拍响应 |
| 静音观察 | [静音模式](http://localhost:5175/?play=1&driver=mock&kind=silence) | 草仍会长出，但不随声音跳动 |
| MIDI 控制器 | [MIDI 模式](http://localhost:5175/?play=1&driver=midi) | 接好设备，允许浏览器 MIDI 访问 |
| 无硬件 MIDI 测试 | [MIDI 模拟模式](http://localhost:5175/?play=1&driver=midi&simulate=1) | 不需要控制器 |
| 录制参数回放 | [回放模式](http://localhost:5175/?play=1&driver=playback) | 选择之前下载的 `.jsonl` 文件 |
| 外部 OSC 输入 | [OSC 模式](http://localhost:5175/?play=1&driver=osc&osc=localhost:9128) | 按下一节启动 OSC 桥 |

麦克风模式读取的是输入设备，不会自动读取电脑内部播放的音频。直接用一首本地音乐驱动植物时，选择“音乐文件模式”。

刷新页面或切换音源会重置当前位置和已生长植物。`rec` 录制的是音画参数，不是音乐、视频、移动路径或植物存档；回放时仍需自己移动长出植物。

## 3.1 昨天使用的场景（2026-10-27）

这些资源仍在 `D:\Github\photolipsia\public\splats`，不需要另开一个程序。先启动同一个 `npm run dev`，再用链接里的 `splat` 参数选择场景。

| 文件 | 用途 | 启动入口 |
| --- | --- | --- |
| `ruin1.ply` | 废墟场景；当前玻璃球、长草与声音互动的默认场景 | [废墟跑图 + 麦克风](http://localhost:5175/?play=1&driver=web-audio&source=mic&splat=/splats/ruin1.ply) |
| `scan.ply` | 你导入的扫描场景；使用昨天日志保存的相机取景 | [查看扫描场景](http://localhost:5175/?splat=/splats/scan.ply&mode=static&spin=0&view=0.26,1.3,-0.2@0.26,1.5,5) |
| `test.ply` | 程序生成的测试场景，用来检查渲染与音频变形 | [模拟信号测试](http://localhost:5175/?splat=/splats/test.ply&driver=mock&kind=pulse) |
| `ruin1.spz` | 废墟的压缩资源，不是另一张新地图 | [尝试压缩版废墟](http://localhost:5175/?play=1&driver=web-audio&source=mic&splat=/splats/ruin1.spz) |

**废墟只看场景、不跑图：** [打开静态废墟](http://localhost:5175/?splat=/splats/ruin1.ply&mode=static&spin=0)。左键拖动旋转视角，右键或 Shift 拖动平移，滚轮缩放。

**废墟跑图、不用麦克风：** [用模拟节拍驱动草](http://localhost:5175/?play=1&driver=mock&kind=pulse&splat=/splats/ruin1.ply)。

说明：

- `scan.ply` 的链接沿用昨天记录的取景值，本次只核对了文件存在和历史参数，没有重新验证画面。进入扫描场景的跑图模式前，还需要单独校准地面和出生点；不能直接假定它与废墟共用地面高度。
- `ruin1.spz` 已确认在本地，但本次没有验证它的加载结果或与 PLY 的取景一致性；日常使用先选 `ruin1.ply`。
- `green-seeds.ply` 是早期复绿实验的辅助资源，不是独立场景；现在的实体茎叶不依赖它。
- 目前通过不同链接切换场景，会重新加载页面；尚未实现从一张地图无缝走入另一张地图。
- 大型场景资源不随代码仓库自动下载。备份或迁移项目时，也需要保留这些本地文件。

## 4. 使用 Max / SuperCollider / Pure Data 的 OSC

仅使用麦克风时，可以跳过本节。

### 终端 1：网页服务器

```powershell
Set-Location D:\Github\photolipsia
npm run dev
```

### 终端 2：OSC 桥

```powershell
Set-Location D:\Github\photolipsia
node scripts/osc-bridge.mjs --udp 9129 --ws 9128
```

保持两个终端都在运行，然后打开 [OSC 探索页面](http://localhost:5175/?play=1&driver=osc&osc=localhost:9128)。

外部声音程序向 **127.0.0.1 的 UDP 9129 端口**发送 OSC；浏览器通过 **WebSocket 9128 端口**接收转发。

草目前使用 `/av/rms`、`/av/band/low` 和 `/av/onset`，数值范围为 0–1。完整格式参见 [协议文档](docs/protocol.md)。

### 可选终端 3：没有外部声音程序时测试 OSC

```powershell
Set-Location D:\Github\photolipsia
node scripts/osc-test-sender.mjs --host 127.0.0.1 --udp 9129
```

看到监测条响应后，移动小球长出植物，检查它们是否跳动。接入真实 OSC 来源前，先用 `Ctrl+C` 停止测试发送器，避免两个来源混在一起。

## 5. 操作与常用调整

- **点击画面**：锁定鼠标，开启类似射击游戏的视角控制。
- **移动鼠标**：左右转向、上下调整俯仰；保留第三人称玻璃球视角。
- **方向键 / WASD**：按当前鼠标朝向移动；A/D 或左右键为侧移。
- **Esc**：释放鼠标并停止移动，随后可点击音源、录制等按钮。
- **按住右键拖动**：无需锁定鼠标也可转向，适用于限制 Pointer Lock 的内嵌浏览器。
- **Onset Size**：实时调整节拍触发时草的增高幅度，范围 0–10；0 关闭 onset 增高，1 为原始强度。数值是响应倍数，不是植物最终高度倍数；静音时不会把草永久放大。按 Esc 释放鼠标后拖动滑杆，数值会写入当前网址，刷新后保留。
- **rec**：开始录制；再次点击停止并下载音画参数 `.jsonl`。
- **?**：显示参数帮助。
- **beat**：切换音频节拍估计；关闭它不会关闭草的低频和瞬态响应。
- **刷新页面**：重新开始，清除本次植物和位置。

声音响应太弱时，可使用 [增强低频与节拍的麦克风入口](http://localhost:5175/?play=1&driver=web-audio&source=mic&gain=low=1.5,onset=1.5)。增益越高越容易达到响应上限，并非无限放大。

球或植物与地面高度不一致时，在原网址末尾添加：

```text
&ground=-0.23
```

修改数字可统一调整球和植物所在平面。当前没有地形碰撞，不能自动适应台阶、斜坡或墙壁。

## 6. 停止程序

1. 如果正在录制，先点击 `rec` 停止并保存。
2. 关闭互动页面，结束浏览器的音频或麦克风会话。
3. 在运行网页服务器的终端按 `Ctrl+C`。
4. 如果还开着 OSC 桥、测试发送器，分别到它们的终端按 `Ctrl+C`。

下次使用时重新执行第 1 节即可。

## 7. 常见问题

| 现象 | 检查方法 |
| --- | --- |
| localhost 页面打不开 | 确认 `npm run dev` 的终端仍在运行，并使用 `http://localhost:5175/`，不要双击 `index.html` |
| 端口已占用 / EADDRINUSE | 先打开已有的 5175 页面；若是旧项目服务器，回到它的终端按 `Ctrl+C`，再从 D 盘项目启动 |
| 加载 ruin1 失败 | 确认 `D:\Github\photolipsia\public\splats\ruin1.ply` 存在；测试场景生成命令不能替代这个文件 |
| 模块找不到 / three 或 Spark 加载失败 | 在 D 盘项目运行 `npm ci`，再刷新页面 |
| 麦克风监测条不动 | 检查浏览器站点麦克风权限、Windows 输入设备和应用麦克风权限；然后刷新重试 |
| 监测条在动，但没有草 | 先移动小球；植物只在走过的位置生成 |
| 音乐文件没有声音 | 检查标签页是否静音、浏览器是否拦截自动播放；允许本站播放后重新加载并选择文件 |
| WASD 没反应 | 点击画面，再按键；输入焦点不要停留在地址栏或其他窗口 |
| OSC 没有响应 | 确认桥在运行、发送目标是 UDP 9129、页面连接的是 WS 9128；可用测试发送器排查 |

如果 5175 确实需要保留给另一个程序，可以在当前 PowerShell 终端临时换端口：

```powershell
Set-Location D:\Github\photolipsia
$env:PORT = '5176'
npm run dev
```

此时把本指南链接中的 `5175` 改为 `5176`。停止后运行 `Remove-Item Env:PORT` 可清除当前终端的端口覆盖。
