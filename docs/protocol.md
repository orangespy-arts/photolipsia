# AVParams 协议 v1

Photolipsia 的唯一契约。任何 DSP 来源 → 驱动器 → 本协议 → 映射层 → splat 渲染。
驱动器可以换成任何实现，协议不变。

## 三条铁律

1. **平滑责任在驱动器。** 协议中的每个数值都是"可直接用于渲染"的：
   连续量已平滑，包络量已带衰减。映射层不做任何平滑。
   （否则换驱动器行为不一致。）
2. **全部 0–1 无量纲。** 映射层永远看不到 dB、Hz、MIDI 号等原始单位。
   驱动器负责归一化（含自动增益）。
3. **每帧一个不可变对象。** 帧内所有量属于同一时刻，禁止部分字段来自上一帧。

## 字段

```jsonc
{
  "version": 1,

  // ── 连续量（0–1，驱动器内已平滑）──
  "rms": 0.0,        // 整体响度，对数感知加权
  "bands": {
    "low":  0.0,     // ~20–250 Hz   kick/贝斯 → 整体脉冲
    "mid":  0.0,     // ~250–2000 Hz 人声/和声 → 涌动
    "high": 0.0      // ~2k–16k Hz   hihat/气声 → 颗粒闪烁
  },
  "centroid": 0.0,   // 频谱质心，对数刻度 0–1 → 色调
  "flatness": 0.0,   // 谱平坦度 0–1（噪声感）→ 抖动强度

  // ── 包络量（0–1，驱动器内已做衰减）──
  "onset": 0.0,      // 瞬态强度，指数衰减 ~200ms → "跳"的包络
  "beatPhase": 0.0,  // 0–1 节拍相位；无节拍源时恒 0

  // ── 事件（本帧内稀疏发生）──
  "events": [
    // { "type": "note", "pitch": 60, "velocity": 0.8, "time": 12.3 }
  ],

  // ── 元信息 ──
  "source": "web-audio", // 驱动器 id: web-audio | osc | midi | mock | playback
  "time": 12.30          // 音频时钟，秒；录制/回放对齐用
}
```

### 语义细节

- `rms` / `bands`：平滑时间常数由驱动器自定（推荐 attack ~50ms / release ~200ms），
  但**结果语义**是"当前可感知能量"，不是原始 FFT 帧值。
- `onset`：不是布尔。0.9 = 刚发生的强瞬态，0.05 = 上一拍残余。
- `events[].time`：单位秒，与顶层 `time` 同一时钟。
- 协议不含 per-splat 数据。空间分配（哪个频段驱动哪片 splat）是映射层的事。

## OSC 地址映射（供 osc 驱动 / DSP 端参考）

| 地址 | 类型 | 对应字段 |
|---|---|---|
| `/av/rms` | f | `rms` |
| `/av/band/low` · `/mid` · `/high` | f | `bands.*` |
| `/av/centroid` | f | `centroid` |
| `/av/flatness` | f | `flatness` |
| `/av/onset` | f | `onset` |
| `/av/beat` | f | `beatPhase` |
| `/av/event` | sff | `events[]`（type, value1, value2） |

推荐发送率 60Hz，bundle 打包。DSP 端（Max/SC）做分析与归一化，
桥只转发，不理解内容。

## 演进规则

改字段名 / 范围 / 语义 = 破坏性变更：同一次提交里更新本文件
**并** bump `src/protocol/version.js` 的 `PROTOCOL_VERSION`。
