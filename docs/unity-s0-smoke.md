# S0 管线冒烟 — 你来做的 Unity 步骤

> **存档（2026-11-04）**：用户已弃用 Unity，作业改用本仓库 Web + Hydra。
> 本文仅作历史记录，不再维护。

目标：AudioVizURP 工程里看到 ruin1.ply 的 splat，并出一条 10 秒测试片。
照顺序做，每步做完勾掉。遇到和文档不符的报错，原样抄下来告诉我。

---

## 已由 agent 完成（文件层，你不用做）

| 位置 | 内容 | 状态 |
|---|---|---|
| `D:\libs\UnityGaussianSplatting` | 克隆的 aras-p 包 v2.0.0（MIT） | ✅ |
| `AudioVizURP\Packages\manifest.json` | 已加 `org.nesnausk.gaussian-splatting`（file 引用）+ `com.unity.recorder 5.1.7` | ✅ |
| `AudioVizURP\Assets\StreamingAssets\ruin1.ply` | 130MB 测试场景 PLY | ✅ |
| `AudioVizURP\Assets\Editor\S0PipelineSmoke.cs` | 一键设置脚本（下面第 4 步用） | ✅ |

已替你查好的工程事实：Windows 图形 API 首位是 **Direct3D12**（满足包要求，DX11 会不渲染）；
`GS_ENABLE_URP` 宏由包的 versionDefines 自动启用。

---

## 第 1 步 — 打开工程，等包导入

1. Unity Hub 打开 `D:\Github\AudioVizURP`（Unity **6000.3.9f1**）。
2. 首次启动会解析新包 + 导入 130MB PLY，进度条跑几分钟是正常的。
3. 启动完看 **Console**（Window → Panels → Console 或 Ctrl+Shift+C）：
   - 有没有红色 error？有的话原样记录（尤其是含 `gaussian-splatting` 或 `recorder` 的）。

## 第 2 步 — 确认两个包装好了

1. Window → Package Manager，左侧选 **In Project**。
2. 确认列表里有：
   - **Gaussian Splatting** 2.0.0（来源 Local）
   - **Unity Recorder** 5.1.7
3. 缺哪个 → 停下来告诉我，不要自己改 manifest。

## 第 3 步 — 检查两个开关（一次 30 秒）

1. **URP 资产**：Project 窗口搜 `UniversalRP-MediumQuality`（顺带点开 HighQuality 也行），
   在 Inspector 里找 **Quality** / 渲染设置区：
   - **Compatibility Mode (Render Graph Disabled)** 必须**不勾选**（包要求 RenderGraph 开）。
   - **Anti Aliasing (MSAA)** 必须 **None**（包已知问题：MSAA 下 splat 不工作）。
   - 三个 Quality 资产都看一眼。
2. **图形 API**：Edit → Project Settings → Player → Other Settings → Rendering，
   Windows 图标下 Graphics APIs 第一位应是 **Direct3D12**。已替你查过是，看一眼确认即可。

## 第 4 步 — 一键场景设置

菜单 **Photolipsia → S0 管线冒烟 - 设置**，它会自动做三件事：

1. 给 `ForwardRenderer` 资产挂上 `GaussianSplatURPFeature`（URP 下不挂这个 splat 不渲染）。
2. 打开 `Assets/Scene/Mainperformance.unity`，创建 **S0_RuinSplat** 物体，
   挂 `GaussianSplatRenderer`，Source Path = `ruin1.ply`。
3. 场景里没有相机时创建 `S0_MainCamera` (0, 1.5, 6) 朝 -Z。
4. 保存场景。

完成后 Console 应有 `[S0] graphicsDeviceType = Direct3D12` 和 `[S0] BatchSetup` 相关日志
（菜单版没有 BatchSetup 字样，看 scene saved 即可）。

<details><summary>愿意手动的话（替代第 4 步）</summary>

- 选中 `Assets/_Project/Base/Presets & Settings/ForwardRenderer`，Inspector 底部
  **Add Renderer Feature** → `GaussianSplatURPFeature`。
- 新建空物体改名为 `S0_RuinSplat`，Add Component → 搜 Gaussian Splat Renderer，
  **Source Path** 填 `ruin1.ply`。
- 没有相机就自己摆一台。
</details>

## 第 5 步 — 看到画面

1. 双击 Mainperformance 场景，Game 视图进入 **Play 模式**（Ctrl+P）。
2. 预期：ruin1 废墟场景渲染出来（取景不对没关系，先确认"有东西"）。
3. **常见失败对照**：
   - 纯黑/只有天空 → render feature 没挂上，回第 4 步。
   - Console 报 ply 格式错 → 文件是 Marble 导出（62 属性标准二进制 PLY，应该没问题），抄报错给我。
   - 一片过曝白 → 相机在场景内部，把 S0_MainCamera 往 z 更大方向挪。
4. **呼吸验证**：Play 中选中 `S0_RuinSplat`，Inspector 里把 **Splat Scale** 从 1.0 拖到 0.5 再回 1.0
   ——场景应整体胀缩。这个字段就是以后 Timeline/脚本驱动"呼吸"的入口。

## 第 6 步 — Recorder 出 10 秒测试片

1. Window → Recording → **Recorder**。
2. 顶部 **+ Add Recorder** → **Video Recorder**。
3. 设置面板（右侧）：
   - **Path & Filename**: Relative Path 填 `Recordings/s0-smoke`（目录会自动建）。
   - **Format**: MP4；**Resolution**: 1920×1080。
   - **Capture**: Frame Rate `60`。
   - **Record Mode**: Frame Interval，**Start 1 / End 600**（60fps × 600 帧 = 10 秒）。
4. 顶部 Recording Profile 选刚配的，点大红 **Record** 按钮。
5. 等 10 秒录完，去工程根目录 `Recordings\s0-smoke.mp4` 打开检查：
   画面有 ruin1、时长 ~10 秒、不卡帧。
6.（可选加分）录的时候在 S0_RuinSplat 上手动拖 Splat Scale 出入 0.85–1.15，片子里能看到呼吸。

## 第 7 步 — 回来汇报

做完后告诉我：
1. Console 有无 error（有就贴出来）。
2. splat 看到了吗，取景大概什么样。
3. Splat Scale 拖动有没有整体胀缩。
4. 测试片路径 + 你看完的结论（有没有明显掉帧/黑帧）。

我拿到结果后更新 strategy.md 勾 S0、写 log，然后等你 go 进 S1。

---

## 万一想让我代跑

`Assets/Editor/S0PipelineSmoke.cs` 的 `BatchSetup` 我可以直接用命令行跑（编译验证 +
自动设置一次完成），需要你确认允许我执行外部克隆的包。你手点更快，所以默认你来。
