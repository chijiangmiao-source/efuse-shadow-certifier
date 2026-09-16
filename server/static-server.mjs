#!/usr/bin/env node
/**
 * 零依赖静态文件服务器：仅托管 dist/，不发起任何外部请求。
 * 用法：node server/static-server.mjs [dist目录] [端口]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '..', process.argv[2] ?? 'dist');
const PORT = Number(process.argv[3] ?? process.env.PORT ?? 4173);
const HOST = '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${HOST}`);
    // 防目录穿越：规范化后必须仍在 DIST 内。
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, '');
    let filePath = join(DIST, rel);
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    let body;
    try {
      body = await readFile(filePath);
    } catch {
      // SPA 回退到入口
      filePath = join(DIST, 'index.html');
      body = await readFile(filePath);
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`fuse-array web on http://${HOST}:${PORT} (serving ${DIST})`);
});
