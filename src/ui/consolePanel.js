import { CONTROL_MAP, activeRows } from './controlMap.js';

// Dual-screen console: key map table with live highlighting, the output
// window button and its connection state.
export function createConsolePanel({ table, openButton, outputState, getPad, getFx, getFrame = () => null }) {
  table.replaceChildren(...CONTROL_MAP.map((row) => {
    const tr = document.createElement('tr');
    for (const text of [row.input, row.action]) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
    return tr;
  }));
  const rows = [...table.rows];
  let popup = null, last = null, diag = '', nextDiag = 0;
  openButton.addEventListener('click', () => {
    if (popup && !popup.closed) { popup.focus(); return; }
    popup = window.open('/output.html', 'photolipsia-output', 'popup,width=960,height=540');
  });
  return {
    update() {
      // push this frame's composite into the output window (see output.js)
      if (popup && !popup.closed) {
        const f = getFrame();
        try { if (f) popup.__photolipsiaPresent?.(f.canvas, f.frame); } catch {}
      }
      activeRows(getPad(), getFx()).forEach((on, i) => rows[i].classList.toggle('live', on));
      const open = popup && !popup.closed;
      // once a second: the output window's own counters, read from here so
      // they are visible without touching (and defocusing into) the output
      const now = performance.now();
      if (open && now >= nextDiag) {
        nextDiag = now + 1000;
        try {
          const o = popup.__OUTPUT__?.();
          if (o) {
            const dt = last ? (now - last.t) / 1000 : 0;
            const rate = (k) => (last && dt > 0 ? Math.round(((o[k] ?? 0) - (last[k] ?? 0)) / dt) : '…');
            let mine = '?';
            try { const c = document.getElementById('composite'); mine = [...c.getContext('2d').getImageData(c.width / 2 | 0, c.height / 2 | 0, 1, 1).data.slice(0, 3)].join(','); } catch {}
            diag = ` · push ${rate('pushes')}/s · copy ${rate('copies')}/s · output loop ${rate('ticks')}/s · ${o.visible === 'visible' ? 'visible' : 'hidden'} · centre pixel output ${o.pixel} / preview ${mine}${o.error ? ` · error ${o.error}` : ''}`;
            last = { ...o, t: now };
          }
        } catch (e) { diag = ` · read failed ${e.message}`; }
      }
      if (!open) { last = null; diag = ''; }
      const text = open ? `Output window: open${diag}` : 'Output window: closed';
      if (outputState.textContent !== text) outputState.textContent = text;
    },
  };
}
