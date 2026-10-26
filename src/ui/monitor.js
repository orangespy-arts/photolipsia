// Debug monitor: renders the AVParams frame as bar meters.
// Minimal on purpose — replaced by the splat canvas in Stage 1,
// but useful for driver development forever.

export function createMonitor(root) {
  const rows = [
    ['rms', 'rms'],
    ['low', 'bands.low'],
    ['mid', 'bands.mid'],
    ['high', 'bands.high'],
    ['cent', 'centroid'],
    ['flat', 'flatness'],
    ['onset', 'onset'],
    ['beat', 'beatPhase'],
  ];
  root.innerHTML = rows
    .map(
      ([key, label]) => `
      <div class="row" data-key="${key}">
        <span class="label">${label}</span>
        <span class="bar"><span class="fill"></span></span>
        <span class="value">0.00</span>
      </div>`,
    )
    .join('') + '<div class="meta" id="monitor-meta"></div>';

  const fills = new Map(
    rows.map(([key]) => [key, root.querySelector(`[data-key="${key}"] .fill`)]),
  );
  const values = new Map(
    rows.map(([key]) => [key, root.querySelector(`[data-key="${key}"] .value`)]),
  );
  const meta = root.querySelector('#monitor-meta');

  return {
    update(p) {
      const vals = {
        rms: p.rms, low: p.bands.low, mid: p.bands.mid, high: p.bands.high,
        cent: p.centroid, flat: p.flatness, onset: p.onset, beat: p.beatPhase,
      };
      for (const [key, v] of Object.entries(vals)) {
        const pct = `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`;
        fills.get(key).style.width = pct;
        values.get(key).textContent = Number(v).toFixed(2);
      }
      meta.textContent = `source=${p.source} t=${p.time.toFixed(2)}s v${p.version}`
        + (p.events.length ? ` events=${p.events.length}` : '');
    },
  };
}
