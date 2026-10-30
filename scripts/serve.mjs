#!/usr/bin/env node
/**
 * Minimal static file server for local development (zero dependencies).
 * Usage: npm run dev  →  http://localhost:5175
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES } from '../src/render/sceneCatalog.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 5175;

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
    const sceneFile = path === '/local-scenes/apocalyptic-zombie-city.ply'
      ? 'Apocalyptic Zombie City.ply'
      : SCENES.find((scene) => path === `/3dscene/${scene.file}`)?.file;
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
