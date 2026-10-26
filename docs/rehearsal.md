# 演出彩排清单（rehearsal checklist）

Photolipsia web 版的演出流程。每条都是**本机已验证**的步骤——新机器首次
使用时全部重跑一遍，打勾后才算演出就绪。

## 0. 前置（演出前一次）

- [ ] `npm ci`（干净依赖；仓库只有 three + spark 两个运行时依赖）
- [ ] `npm test` 全绿、`npm run check` OK
- [ ] `node scripts/probe.mjs "http://localhost:5175/?driver=mock" 6 --fps`
      → PASS（p95 ≤ 17ms、无帧 > 34ms）
- [ ] 测试 splat 存在：`public/splats/test.ply`（缺失时 `npm run check`
      自动生成；**演出用真 splat 时替换它并记录文件名**）

## 1. 离线验证（关键：演出场地可能没网）

- [ ] 断网（拔网线/关 Wi-Fi）
- [ ] `node scripts/serve.mjs` → 页面 200、splat 200（import map 全部指向
      本地 `node_modules`，无 CDN 依赖——这是零依赖决定的回报）
- [ ] `?driver=mock` 视觉正常
- [ ] `?driver=midi&simulate=1` 正常（模拟演奏也是离线路径）
- [ ] 恢复网络

## 2. 驱动彩排（按演出用的源）

- [ ] **web-audio**：`?driver=web-audio` 麦克风权限弹窗提前授；播放演出
      曲目 30s，监测条行为符合预期；**录一份**（rec 按钮）作兜底
- [ ] **osc**：`node scripts/osc-bridge.mjs` + DSP 端发送 60Hz；确认监测
      条活动；**停发 0.5s 验证衰减归零**（断链保护）后恢复；录一份兜底
- [ ] **midi**：`?driver=midi` 设备出现在状态栏；键/CC/clock 各验证一次；
      无设备时 `&simulate=1` 兜底验证
- [ ] **playback 兜底就位**：上面录的 .jsonl 放在手边（Downloads 或
      `public/rec/`），`?driver=playback`（文件选择器）或
      `?driver=playback&rec=<name>`（服务器路径）能循环回放

## 3. 故障切换演练（演出中场源死掉的预案）

- [ ] 演出中（任一活源驱动）→ 点 rec 录 ≥10s → 停止
- [ ] 杀掉活源（关麦克风/停 test-sender/拔 MIDI）
- [ ] 新标签 `?driver=playback` → 选刚录的文件 → 循环回放顶上
- [ ] 全程无网络参与——离线可完成

## 4. 多屏

Spark 无原生多视口。支持路径（已验证）：**每个输出一个全屏窗口**——
- [ ] 拖浏览器窗口到第二屏 → F11 全屏；两屏各 60fps（用 `--fps` 审计逐屏
      验证）；主屏操作、副屏纯显示
- [ ] 演出分辨率记录在案：`--window-size`、devicePixelRatio

## 5. 已知延迟（本构建实测，2026-10-26，dev box）

- 渲染侧（协议值变化 → 像素变化）：**~16.5ms（一帧）**
  —— uniform 更新在帧 N，GPU 呈现在帧 N+1。这是该架构的下限，正常。
- 驱动侧：
  - web-audio：AudioContext 分析延迟 ≈ fftSize/sampleRate ≈ 2048/48000
    ≈ 43ms 窗口 + attack 50ms 平滑 → 总计 ~100ms 量级，视觉律动可接受
  - osc/midi：延迟在 DSP 端/设备端，本地解码可忽略（<1ms）
- 演出含义：**避免把 onset 视觉与音频精确对帧**（对不齐）；把 onset 用作
  包络/呼吸感而非打击点同步。

## 6. 演出日流程

1. 到场 → 步骤 0 快速重跑（fps 审计一次）
2. 断网确认（步骤 1）→ 恢复
3. 驱动彩排 + 录制兜底（步骤 2）
4. 开演。活源故障 → 步骤 3 演练过的回放路径顶上
