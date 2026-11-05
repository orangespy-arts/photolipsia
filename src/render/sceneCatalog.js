// Coordinates are authored in the same world space as the rendered scans.
// These deliberately restricted corridors are proxies, not a collision mesh.
// Ten-scene show (2026-11-05): ruin1–10.ply in /3dscene. Explorer values are
// shared placeholders until each scene's entrance is calibrated (W6b).
const NAMES = [
  '废墟入口', '空城', '地下通道', '机器大厅', '水下中庭',
  '菌丝温室', '晶体裂谷', '异变圣殿', '云海遗迹', '重生庭院',
];

const placeholderExplorer = () => ({
  groundY: -0.23, spawn: [0, -0.23, 0], cameraOffset: [0, 0.65, 2.4],
  navigation: { bounds: { min: [-1.8, -0.23, -3], max: [1.8, 3, 3] }, obstacles: [] },
});

export const SCENES = NAMES.map((name, i) => ({
  id: `s${String(i + 1).padStart(2, '0')}`, name, file: `ruin${i + 1}.ply`,
  explorer: placeholderExplorer(),
}));

export const sceneAssetUrl = (scene) => `/3dscene/${encodeURIComponent(scene.file)}`;
export const sceneById = (id) => SCENES.find((scene) => scene.id === id) ?? SCENES[0];
