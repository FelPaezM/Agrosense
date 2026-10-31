/**
 * Convierte el texto del asistente (Markdown sencillo) a HTML seguro.
 * Primero se escapa TODO el HTML; después solo se agregan etiquetas propias (negrita, cursiva, listas, código).
 */
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapar = (s: string) => s.replace(/[&<>"']/g, c => ESC[c]);

function enLinea(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
}

export function formatear(texto: string): string {
  const lineas = escapar((texto ?? '').replace(/\r/g, '')).split('\n');
  let html = '', lista: 'ul' | 'ol' | null = null;
  const cerrar = () => { if (lista) { html += `</${lista}>`; lista = null; } };
  for (const l of lineas) {
    const vi = /^\s*[-*•]\s+(.*)$/.exec(l), nu = /^\s*\d+[.)]\s+(.*)$/.exec(l), ti = /^\s*#{1,4}\s+(.*)$/.exec(l);
    if (vi) { if (lista !== 'ul') { cerrar(); html += '<ul>'; lista = 'ul'; } html += `<li>${enLinea(vi[1])}</li>`; }
    else if (nu) { if (lista !== 'ol') { cerrar(); html += '<ol>'; lista = 'ol'; } html += `<li>${enLinea(nu[1])}</li>`; }
    else if (ti) { cerrar(); html += `<p class="t">${enLinea(ti[1])}</p>`; }
    else if (!l.trim()) { cerrar(); }
    else { cerrar(); html += `<p>${enLinea(l)}</p>`; }
  }
  cerrar();
  return html;
}
