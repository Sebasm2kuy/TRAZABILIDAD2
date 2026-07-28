import { describe, expect, it } from 'bun:test';
import { normalizeBasePath, requestPathToFile } from './serve-static.mjs';

describe('servidor de exportación estática', () => {
  it('normaliza el basePath configurado para GitHub Pages', () => {
    expect(normalizeBasePath('trazabilidad2/')).toBe('/trazabilidad2');
    expect(normalizeBasePath('/')).toBe('');
  });

  it('resuelve la raíz y los assets debajo del basePath', () => {
    expect(requestPathToFile('/trazabilidad2/', '/trazabilidad2', '/tmp/out')).toBe('/tmp/out/index.html');
    expect(requestPathToFile('/trazabilidad2/_next/app.js', '/trazabilidad2', '/tmp/out')).toBe('/tmp/out/_next/app.js');
  });

  it('rechaza rutas fuera del basePath y recorridos de directorio', () => {
    expect(requestPathToFile('/otra/app.js', '/trazabilidad2', '/tmp/out')).toBeNull();
    expect(requestPathToFile('/trazabilidad2/%2e%2e/secret', '/trazabilidad2', '/tmp/out')).toBeNull();
  });
});
