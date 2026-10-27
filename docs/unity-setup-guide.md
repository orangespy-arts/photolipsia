# Unity 工程搭建指南（Track 2）

> 保存于 2026-10-26。状态：**搁置（2026-10-27）**——Web 端先做多场景
> 跑图机制（复绿/时空洞/场景清单），Unity 需求等机制定了再评估；
> 2026-10-27 曾建过空模板工程并删除（无自定义代码），重建照本指南从零开始。
> Web 仓库（`D:\Github\photolipsia`）为开发实验室，本工程为现场演出引擎。
> 两者共享 `docs/protocol.md`（AVParams 协议）——它是最终权威，两个工程都照它实现。

## 定位（为什么建、什么时候算成）

- **Unity 是演出主线**：UnityGaussianSplatting + URP，OSC 接收 `/av/*` 参数驱动 splat。
- Web 仓库负责把协议、驱动分工、映射设计用最低成本迭代好；Unity 端照着实现。
- **第一个验收目标（Stage U1）**：`/av/band/low` 有信号 → 场景里的 splat 随之呼吸。
  这一步通了，"协议 → Unity → splat 属性"的整条通路就验证完毕，后面全是填肉。

## 1. 工程创建

- [ ] Unity Hub 新建工程：**URP** 模板，名字建议 `photolipsia-unity`
      （位置建议 `D:\Github\photolipsia-unity`，和 Web 仓库分开）
- [ ] Unity 版本：用 AudioViz 现在的同版本（省一次适配）；不确定就用 6000.x LTS
- [ ] git init + Unity 官方 `.gitignore`（Library/ Temp/ Logs/ Obj/ 全排除）
- [ ] Editor 设置：Project Settings → Editor → Version Control = Visible Meta Files,
      Asset Serialization = Force Text（新工程默认已是，检查一下）

## 2. 装 UnityGaussianSplatting（aras-p）

- [ ] 本地 clone（推荐 local package 方式，方便日后改源码）：
      ```sh
      git clone https://github.com/aras-p/UnityGaussianSplatting D:\libs\UnityGaussianSplatting
      ```
- [ ] Package Manager → Add package from disk →
      选 `D:\libs\UnityGaussianSplatting\package\package.json`
- [ ] 装完跑一遍它的 demo 场景确认能渲染（Menu: Window → Gaussian Splatting）
- [ ] 导入一个测试 .ply：菜单 Gaussian Splatting → Create Asset，
      选 .ply 文件（先用课程 kit 的 test splat 或任意扫描件）

> 已知深水区预警：这个包主打**静态资产高效渲染**，per-splat 逐帧编辑不是它的
> 主打 API。"整体 scale 呼吸"应该好办；"逐 splat 位移/变色调"大概率要动它的
> compute shader——这是预期内的，到那步再一起啃。

## 3. OSC 输入

- [ ] 从 Room of Sounds 项目拷 `OSC.cs` 进 `Assets/Scripts/`
      （ICLC 计划本来就打算复用，先用自己的验证过的轮子）
- [ ] 备选：OscCore / extOSC 包——只在 OSC.cs 不够用时再看
- [ ] OSC.cs 监听端口写进常量，建议和 Web 侧约定一致（如 57200）

## 4. Stage U1：呼吸闭环（第一个验收目标）

- [ ] 场景里放一个 SplatRenderer，显示测试 .ply
- [ ] OSC.cs 收 `/av/band/low`（float 0–1）
- [ ] 测试信号源：**手机 OSC 发送 app**（如 TouchOSC / OSC Controller）手动推 fader，
      不用先搭 Max/SC——先把接收端调通
- [ ] Update 里把值喂给 splat 资产的 scale（整体缩放呼吸即可）
- [ ] 验收标准：推 fader → splat 平滑胀缩，松开回落；无卡顿

## 5. 同步协议

- [ ] 把 `D:\Github\photolipsia\docs\protocol.md` 拷进本工程 `Docs/protocol.md`
- [ ] 以后改协议：先改 Web 仓库里的（source of truth），再同步过来，
      两边同一次工作里完成，不留分叉

## 6. 下一步路线（U1 之后，按需推进）

- [ ] U2: 全套 `/av/*` 接收（rms/bands×3/centroid/flatness/onset/beatPhase/events）
- [ ] U3: 频段→空间区域分配（对应 Web 侧 `regionEnergy`，纯函数翻译成 C#）
- [ ] U4: per-splat compute shader 扰动（位移涌动、色调偏移）
- [ ] U5: 音源实装：SuperCollider/Max 发 OSC（`NetAddr("127.0.0.1", 端口)`）
- [ ] U6: 演出加固：全离线彩排清单、双机网线直连（见 Web 仓库对话记录）、状态机

## 陷阱备忘（开工前读一遍）

1. **URP 兼容**：UnityGaussianSplatting 支持 URP 但要按它 README 做一次
   renderer feature 配置（相机上挂 splat render pass），漏了会黑屏/不渲染
2. **.ply 格式**：只吃 3DGS 标准格式的二进制 .ply；ASCII .ply 和某些导出变体
   会被拒——报错先查格式
3. **大资产**：扫描训练出的 .ply 几百 MB 很正常，编辑器导入会卡一阵，属正常；
   git 里不要存（.gitignore 已含 *.ply 时注意 Unity 的 .ply 是资产，
   要在 Unity 工程 gitignore 里放行自己的资产目录或用外部备份盘）
4. **防火墙**：Unity 第一次开 UDP 监听会弹 Windows 防火墙，勾"专用网络"放行；
   彩排机上提前做一次
