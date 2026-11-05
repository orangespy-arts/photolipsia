#!/usr/bin/env node
/**
 * Minimal static file server for local development (zero dependencies).
 * Usage: npm run dev  →  http://localhost:5175
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES } from '../src/render/sceneCatalog.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 5175;
const SHOW_AUDIO_URL = '/audio/5songDJ.wav';
const SHOW_AUDIO_FILE = '5songDJ.wav';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.ply': 'application/octet-stream',
  '.spz': 'application/octet-stream',
  '.rad': 'application/octet-stream',
  '.jsonl': 'application/x-ndjson',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let path = decodeURIComponent(url.pathname);
    // Explicit local asset only; never accept a filesystem path from the URL.
    const sceneFile = SCENES.find((scene) => path === `/3dscene/${scene.file}`)?.file;
    if (sceneFile) {
      const asset = createReadStream(join(ROOT, '3dscene', sceneFile));
      asset.once('open', () => {
        res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' });
        asset.pipe(res);
      });
      asset.on('error', () => {
        if (!res.headersSent) res.writeHead(404).end('Scene file unavailable');
        else res.destroy();
      });
      res.on('close', () => asset.destroy());
      return;
    }
    // Show track: one whitelisted file, with Range support so <audio> can
    // seek and report duration. Never maps a URL path onto the filesystem.
    if (path === SHOW_AUDIO_URL) {
      const file = join(ROOT, 'audio', SHOW_AUDIO_FILE);
      let size;
      try { size = statSync(file).size; } catch { res.writeHead(404).end('Show audio unavailable'); return; }
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
      let start = 0, end = size - 1, status = 200;
      if (range && (range[1] || range[2])) {
        start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
        end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        if (start > end || start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }).end(); return; }
        status = 206;
      }
      const headers = { 'content-type': 'audio/wav', 'accept-ranges': 'bytes', 'content-length': end - start + 1, 'cache-control': 'no-store' };
      if (status === 206) headers['content-range'] = `bytes ${start}-${end}/${size}`;
      res.writeHead(status, headers);
      const stream = createReadStream(file, { start, end });
      stream.pipe(res);
      res.on('close', () => stream.destroy());
      return;
    }
    if (path === '/') path = '/index.html';
    // Vite convention: /splats/* is served from public/splats/*
    if (path.startsWith('/splats/')) path = '/public' + path;
    // recordings: /rec/* is served from public/rec/*
    if (path.startsWith('/rec/')) path = '/public' + path;
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`photolipsia dev server → http://localhost:${PORT}`);
});
