// Gamepad key map shown on the dual-screen console. Data only; `buttons` are
// standard-layout indices, `toggle` names a buttonFx toggle whose on-state is
// highlighted even after the button is released.
export const CONTROL_MAP = [
  { input: '左摇杆', action: '移动（按视角前后左右）', axes: [0, 1] },
  { input: '右摇杆', action: '转向 / 俯仰', axes: [2, 3] },
  { input: '十字键 ↑ / ↓', action: '升 / 降', buttons: [12, 13] },
  { input: 'Start', action: '下一场景（黑场切换）', buttons: [9] },
  { input: 'LT', action: '拖影（所有预设通用）', buttons: [6] },
  { input: 'RT', action: '当前预设强度', buttons: [7] },
  { input: 'LB / RB', action: '上一 / 下一预设（共 10 种）', buttons: [4, 5] },
  { input: 'B', action: '清晰复位：清除全部效果', buttons: [1] },
  { input: 'A（按住）', action: '闪白', buttons: [0] },
  { input: 'X（开/关）', action: '色彩分离', buttons: [2], toggle: 'shift' },
  { input: 'Y（开/关）', action: '万花筒', buttons: [3], toggle: 'kaleid' },
  { input: 'Back（开/关）', action: '黑白高对比', buttons: [8], toggle: 'mono' },
  { input: '十字键 ← / →', action: '色相 往回 / 往前', buttons: [14, 15] },
  { input: 'L3（开/关）', action: '像素化', buttons: [10], toggle: 'pixel' },
  { input: 'R3（按住）', action: '冻结画面', buttons: [11] },
  { input: '键盘 ↑ / ↓', action: '♪ 粒子幅度（随声音）0–3×（键盘，非手柄）', keys: ['ArrowUp', 'ArrowDown'] },
  { input: '键盘 ← / →', action: '♪ 效果律动（随声音）0–1（键盘，非手柄）', keys: ['ArrowLeft', 'ArrowRight'] },
  { input: '键盘 空格', action: '音乐 播放 / 暂停', keys: ['Space'] },
];

// Row is "live" while any of its buttons/sticks is engaged or its toggle is on.
export function activeRows(pad, fx, deadzone = 0.15) {
  return CONTROL_MAP.map((row) => {
    if (row.toggle && fx?.toggles?.[row.toggle]) return true;
    if (!pad) return false;
    if (row.axes) return row.axes.some((i) => Math.abs(pad.axes?.[i] ?? 0) > deadzone);
    return (row.buttons ?? []).some((i) => pad.buttons?.[i]?.pressed || (pad.buttons?.[i]?.value ?? 0) > 0.03);
  });
}
