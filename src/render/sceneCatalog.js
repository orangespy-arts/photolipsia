// Coordinates are authored in the same world space as the rendered scans.
// These deliberately restricted corridors are proxies, not a collision mesh.
export const SCENES = [
  {
    id: 'ruin', name: '废墟大厅', file: 'Brutalist Ruin Interior Vista.ply',
    explorer: {
      groundY: -0.23, spawn: [0, -0.23, 0], cameraOffset: [0, 0.65, 2.4],
      navigation: { bounds: { min: [-1.8, -0.23, -3], max: [1.8, 3, 3] }, obstacles: [] },
    },
  },
  {
    id: 'city', name: '僵尸城', file: 'Apocalyptic Zombie City.ply',
    explorer: {
      groundY: -0.23, spawn: [1.9, -0.23, 0], cameraOffset: [0, 0.65, 2.4],
      navigation: { bounds: { min: [0.3, -0.23, -3], max: [3.5, 3, 3] }, obstacles: [] },
    },
  },
];

export const sceneAssetUrl = (scene) => `/3dscene/${encodeURIComponent(scene.file)}`;
export const sceneById = (id) => SCENES.find((scene) => scene.id === id) ?? SCENES[0];
