import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function normalizeBasePath(value = '') {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') return '';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

export function requestPathToFile(pathname, basePath, outputDirectory) {
  const prefix = normalizeBasePath(basePath);
  if (prefix && pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return null;

  let relative = prefix ? pathname.slice(prefix.length) : pathname;
  try { relative = decodeURIComponent(relative); } catch { return null; }
  relative = relative.replace(/^\/+/, '');
  if (!relative || relative.endsWith('/')) relative += 'index.html';

  const safeRelative = normalize(relative);
  if (safeRelative.startsWith('..') || safeRelative.includes('\0')) return null;
  const candidate = resolve(outputDirectory, safeRelative);
  if (!candidate.startsWith(`${resolve(outputDirectory)}/`) && candidate !== resolve(outputDirectory)) return null;
  return candidate;
}

export function createStaticHandler({ outputDirectory, basePath }) {
  return (request, response) => {
    const host = request.headers.host || 'localhost';
    const { pathname } = new URL(request.url || '/', `http://${host}`);
    const prefix = normalizeBasePath(basePath);

    if (prefix && pathname === '/') {
      response.writeHead(302, { Location: `${prefix}/` });
      response.end();
      return;
    }

    let file = requestPathToFile(pathname, prefix, outputDirectory);
    if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!file || !existsSync(file) || !statSync(file).isFile()) {
      const notFound = join(outputDirectory, '404.html');
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      if (existsSync(notFound)) createReadStream(notFound).pipe(response);
      else response.end('404 - Not Found');
      return;
    }

    const contentType = MIME_TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': contentType });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
  };
}

export function startStaticServer({
  outputDirectory = resolve(process.cwd(), 'out'),
  basePath = process.env.BASE_PATH ?? '/trazabilidad2',
  port = Number(process.env.PORT) || 3000,
} = {}) {
  if (!existsSync(outputDirectory)) {
    throw new Error(`No existe ${outputDirectory}. Ejecutá \"npm run build\" antes de iniciar el servidor.`);
  }
  const server = createServer(createStaticHandler({ outputDirectory, basePath }));
  server.listen(port, () => {
    process.stdout.write(`Aplicación disponible en http://localhost:${port}${normalizeBasePath(basePath)}/\n`);
  });
  return server;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) startStaticServer();
