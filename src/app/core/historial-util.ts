/** Utilidades puras del historial (sin Angular) */
export interface Punto { id: string; fecha: string; humedad: number }

/** Une varias listas (nube + Bluetooth), quita repetidos por id, ordena de más reciente a más antigua */
export function fusionar<T extends { id: string; fecha: string }>(listas: T[][], max = 200): T[] {
  const mapa = new Map<string, T>();
  for (const l of listas) for (const x of l) if (!mapa.has(x.id)) mapa.set(x.id, x);
  return [...mapa.values()].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, max);
}

/** Por Bluetooth llega una lectura cada ~4 s: al historial solo pasa una cada 30 s o si cambió ≥ 2 puntos */
export function debeGuardarVivo(ultima: { humedad: number; ms: number } | null, humedad: number, ahoraMs: number, minMs = 30000, cambio = 2): boolean {
  if (!ultima) return true;
  return ahoraMs - ultima.ms >= minMs || Math.abs(humedad - ultima.humedad) >= cambio;
}

export interface Tendencia { delta: number; dir: 'sube' | 'baja' | 'estable'; minutos: number }

/** Compara la lectura más reciente con la más antigua dentro de la ventana (lista ordenada de reciente a antigua) */
export function tendencia(h: Punto[], ventanaMs = 5 * 60000): Tendencia | null {
  if (h.length < 2) return null;
  const t0 = new Date(h[0].fecha).getTime();
  let ref: Punto | null = null;
  for (const p of h) { if (t0 - new Date(p.fecha).getTime() <= ventanaMs) ref = p; else break; }
  if (!ref || ref === h[0]) return null;
  const span = t0 - new Date(ref.fecha).getTime();
  if (span < 20000) return null;
  const delta = h[0].humedad - ref.humedad;
  return { delta, dir: Math.abs(delta) < 2 ? 'estable' : delta > 0 ? 'sube' : 'baja', minutos: Math.max(1, Math.round(span / 60000)) };
}

/** Curva suave (Catmull-Rom → Bézier) para el gráfico SVG del historial */
export function trazoSuave(pts: { x: number; y: number }[]): string {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Si el sensor también subió la misma lectura a la nube, se descarta la copia Bluetooth (ids "ble-…") que cae a menos de 45 s */
export function depurarDuplicados<T extends { id: string; fecha: string }>(lista: T[], ventanaMs = 45000): T[] {
  const nube = lista.filter(x => !x.id.startsWith('ble-')).map(x => new Date(x.fecha).getTime());
  if (!nube.length) return lista;
  return lista.filter(x => !x.id.startsWith('ble-') || !nube.some(t => Math.abs(t - new Date(x.fecha).getTime()) <= ventanaMs));
}
