/**
 * Asistente básico (sin internet y sin IA en la nube).
 * Respalda al asistente de IA: si no hay conexión, no se inició sesión o todos los modelos están ocupados,
 * el usuario SIEMPRE recibe una respuesta útil basada en la lectura real de su sensor.
 */
export interface ContextoSensor {
  conectado: boolean;
  humedad: number | null;
  estado: string;                 // "Suelo seco", "Humedad óptima"…
  promedio: number | null;
  tendencia: { delta: number; dir: 'sube' | 'baja' | 'estable'; minutos: number } | null;
  cultivo: string;
  sensorId: string;
  modo: 'bluetooth' | 'nube' | null;
  registros: number;
  alertas: number;
}

export const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Rango { min: number; max: number; nota: string }
/** Referencia GENERAL de humedad del suelo (%) según el cultivo. Depende del suelo y de la calibración del sensor. */
const CULTIVOS: Record<string, Rango> = {
  tomate: { min: 55, max: 75, nota: 'Riego regular y parejo; los cambios bruscos de humedad rajan el fruto.' },
  pimenton: { min: 55, max: 75, nota: 'Evita encharcar: es sensible a hongos en la raíz.' },
  lechuga: { min: 60, max: 80, nota: 'Raíz superficial: riegos frecuentes y ligeros.' },
  zanahoria: { min: 50, max: 70, nota: 'Humedad constante para que la raíz crezca recta y sin rajaduras.' },
  cebolla: { min: 50, max: 70, nota: 'Reduce el riego al final del ciclo para que el bulbo cure bien.' },
  papa: { min: 60, max: 80, nota: 'Mucha humedad sostenida en la tuberización, pero con buen drenaje.' },
  maiz: { min: 50, max: 70, nota: 'Etapa crítica: floración y llenado de grano; ahí no dejes secar.' },
  frijol: { min: 50, max: 65, nota: 'Tolera poco el exceso de agua; evita regar en la floración con el suelo ya húmedo.' },
  cafe: { min: 50, max: 70, nota: 'Humedad pareja; la sequía en floración reduce la cosecha.' },
  platano: { min: 60, max: 80, nota: 'Consume mucha agua, pero no tolera el encharcamiento.' },
  aguacate: { min: 45, max: 65, nota: 'Muy sensible al exceso de agua (pudrición de raíz): prioriza el drenaje.' },
  fresa: { min: 55, max: 75, nota: 'Riego frecuente y moderado; mantén el fruto sin tocar el agua.' },
  arroz: { min: 75, max: 100, nota: 'Es el cultivo que mejor tolera suelos saturados.' },
  cana: { min: 50, max: 70, nota: 'Necesita más agua en la fase de macollamiento y crecimiento.' }
};
const RANGO_GENERAL: Rango = { min: 40, max: 80, nota: 'Rango general; ajústalo a tu cultivo y tipo de suelo.' };

export function cultivoEn(texto: string): string | null {
  const t = sinTildes(texto);
  for (const c of Object.keys(CULTIVOS)) if (new RegExp('\\b' + c).test(t)) return c;
  if (/\bcana/.test(t)) return 'cana';
  return null;
}

const PIE = '\n\n_Respuesta del modo básico (sin IA en la nube)._';

function datos(c: ContextoSensor): string {
  if (!c.conectado || c.humedad == null) return '';
  const t = c.tendencia
    ? c.tendencia.dir === 'estable' ? ` · estable en los últimos ${c.tendencia.minutos} min`
      : ` · ${c.tendencia.dir === 'sube' ? 'subió' : 'bajó'} ${Math.abs(c.tendencia.delta)}% en ${c.tendencia.minutos} min` : '';
  return `**Ahora:** ${c.humedad}% (${c.estado.toLowerCase()})${t}.`;
}

function rangoDe(c: ContextoSensor, texto: string): { nombre: string; r: Rango } {
  const n = cultivoEn(texto) ?? cultivoEn(c.cultivo);
  return n ? { nombre: n, r: CULTIVOS[n] } : { nombre: c.cultivo.trim(), r: RANGO_GENERAL };
}

export function respuestaLocal(pregunta: string, c: ContextoSensor): string {
  const q = sinTildes(pregunta);
  const d = datos(c);
  const { nombre, r } = rangoDe(c, pregunta);
  const paraCultivo = nombre ? ` para ${nombre}` : '';
  const h = c.humedad;
  const sin = !c.conectado || h == null;

  if (/^(hola|buen|hey|saludos)/.test(q.trim()) && q.length < 30)
    return `¡Hola! Soy el asistente de AgroSense. Puedo interpretar la humedad de tu sensor, decirte si conviene regar y darte recomendaciones por cultivo.${sin ? ' Conecta tu sensor desde el Panel para analizar tus datos reales.' : '\n\n' + d}` + PIE;

  if (/(calibr|lectura rara|no lee|siempre (0|100)|valor raro|adc)/.test(q))
    return '**Calibrar el sensor (YL-69):**\n1. Conecta el ESP32 al computador y abre el Monitor Serie (115200).\n2. Con el sensor limpio y **al aire**, escribe `cal seco`.\n3. Sumérgelo en **agua o tierra bien mojada** y escribe `cal humedo`.\n4. Para volver a valores de fábrica: `cal reset`.\n\nSi marca siempre 0% o 100%, revisa el cableado (pin 34 de lectura y pin 25 de alimentación) y que la sonda no esté corroída.' + PIE;

  if (/(bluetooth|ble\b|no aparece|no encuentra|conect|wifi|wi-fi|emparej)/.test(q))
    return '**Para conectar tu sensor:**\n- **Bluetooth (sin internet):** activa el Bluetooth, concede el permiso de *Dispositivos cercanos* y toca *Buscar sensores*. Verás un nombre como `ESP32_XXXXXX`. No se empareja desde Ajustes: se conecta desde la app.\n- **Wi-Fi / nube:** conecta el ESP32 a tu red con el portal `AgroSense-…` y la app leerá lo que sube a Firebase.\n\nSi no aparece: acércalo al teléfono, reinícialo y verifica que el Monitor Serie muestre `[BLE] Anunciándose`.' + PIE;

  if (/(alerta|notific|aviso)/.test(q))
    return `Recibes una **alerta** cuando la humedad cambia 10% o más entre dos lecturas, y un **resumen cada 5 minutos** mientras el sensor está conectado. Ahora tienes ${c.alertas} registradas.${sin ? '' : '\n\n' + d}` + PIE;

  if (/(regar|riego|rego|riegue|agua|mojar)/.test(q)) {
    if (sin) return `Para decirte si conviene regar necesito la lectura de tu sensor: conéctalo desde el Panel.\n\nComo guía general${paraCultivo}, mantén la humedad entre **${r.min}% y ${r.max}%**. ${r.nota}` + PIE;
    if (h! < r.min) return `${d}\n\n**Sí, conviene regar.** Estás por debajo del rango recomendado${paraCultivo} (${r.min}–${r.max}%).\n- Riega en la **mañana temprano o al atardecer** para perder menos agua.\n- Aplica de forma gradual y vuelve a mirar el sensor a los 15–30 min.\n- Meta: llegar a ~${Math.round((r.min + r.max) / 2)}%.\n\n${r.nota}` + PIE;
    if (h! > r.max) return `${d}\n\n**No riegues.** Superas el rango recomendado${paraCultivo} (${r.min}–${r.max}%).\n- Suspende el riego hasta que baje de ${r.max}%.\n- Revisa el drenaje para evitar hongos y pudrición de raíz.\n\n${r.nota}` + PIE;
    return `${d}\n\n**No hace falta regar ahora.** Estás dentro del rango${paraCultivo} (${r.min}–${r.max}%). Vuelve a revisar cuando baje de ${r.min + 5}%.\n\n${r.nota}` + PIE;
  }

  if (/(exceso|encharc|inund|pudri|hongo|demasiad)/.test(q))
    return `${d ? d + '\n\n' : ''}**Exceso de humedad:** satura el suelo, quita oxígeno a la raíz y favorece hongos.\n- Suspende el riego y mejora el drenaje (surcos, camas elevadas, materia orgánica).\n- Evita pisar o compactar el suelo mojado.\n- Si ves hojas amarillas y raíces oscuras, consulta a un técnico agrónomo.` + PIE;

  if (/(seco|marchit|sequ|amarill|se secan)/.test(q))
    return `${d ? d + '\n\n' : ''}**Suelo seco o plantas marchitas:**\n- Riega de forma gradual (no de golpe) para que el agua infiltre.\n- Coloca **mulch** (paja, hojas) para retener humedad.\n- Si el suelo está húmedo pero la planta se marchita, puede ser problema de raíz o plaga, no de agua.` + PIE;

  if (/(plan|semana|calendario|horario|cuando|frecuencia)/.test(q))
    return `**Plan práctico de riego${paraCultivo}:**\n1. Objetivo: mantener ${r.min}–${r.max}%.\n2. Revisa el Panel cada mañana; si está bajo ${r.min}%, riega.\n3. Usa el **Historial** para ver cada cuánto baja la humedad y ajustar tu frecuencia.\n4. Activa las **Alertas**: te avisan de caídas o subidas bruscas.\n\n${r.nota}` + PIE;

  const cult = cultivoEn(pregunta);
  if (cult || /(cultivo|siembra|sembr|recomend|consejo|rango|ideal|optim)/.test(q)) {
    const x = rangoDe(c, pregunta);
    const base = `**${x.nombre ? 'Humedad ideal para ' + x.nombre : 'Humedad de referencia'}:** ${x.r.min}% – ${x.r.max}%.\n${x.r.nota}\n\n_Es una referencia general: depende del suelo y de cómo calibraste el sensor._`;
    return (d ? d + '\n\n' : '') + base + PIE;
  }

  if (/(humedad|estado|como esta|nivel|lectura|promedio|tendencia|subi|baj)/.test(q)) {
    if (sin) return 'Aún no hay lecturas: conecta tu sensor desde el Panel (Bluetooth o Wi-Fi) y te lo interpreto al instante.' + PIE;
    const prom = c.promedio != null ? `\n**Promedio de ${c.registros} registros:** ${c.promedio}%.` : '';
    const lec = h! < RANGO_GENERAL.min ? 'El suelo está seco: conviene regar pronto.' : h! > RANGO_GENERAL.max ? 'Hay exceso de humedad: evita regar.' : 'Está en un rango saludable.';
    return `${d}${prom}\n\n${lec}` + PIE;
  }

  return `Puedo ayudarte con:\n- **¿Debo regar ahora?** según tu lectura real\n- **Humedad ideal** de tu cultivo (tomate, maíz, café, papa…)\n- **Interpretar** tendencias y alertas\n- **Conectar o calibrar** el sensor\n\nPregúntame, por ejemplo: _“¿Debo regar mi tomate?”_` + (d ? '\n\n' + d : '') + PIE;
}

/** Sugerencias de la pantalla del asistente, según el estado real del sensor */
export function sugerencias(c: ContextoSensor): string[] {
  const s: string[] = [];
  if (c.conectado && c.humedad != null) {
    s.push('¿Debo regar ahora?', 'Interpreta mi humedad actual');
    if (c.tendencia && c.tendencia.dir !== 'estable') s.push('¿Por qué está ' + (c.tendencia.dir === 'sube' ? 'subiendo' : 'bajando') + ' la humedad?');
  } else {
    s.push('¿Cómo conecto mi sensor por Bluetooth?');
  }
  s.push(c.cultivo.trim() ? `Consejos de riego para ${c.cultivo.trim()}` : '¿Qué humedad es ideal para tomate?', 'Hazme un plan de riego semanal');
  return s.slice(0, 4);
}

/** Texto compacto que se envía a la IA para que responda con los datos reales del usuario */
export function construirContexto(c: ContextoSensor, ahora = new Date()): string {
  const p: string[] = [`Fecha y hora local: ${ahora.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}.`];
  if (c.cultivo.trim()) p.push(`Cultivo del usuario: ${c.cultivo.trim().slice(0, 40)}.`);
  if (c.conectado && c.humedad != null) {
    p.push(`Sensor ${c.sensorId} conectado por ${c.modo === 'bluetooth' ? 'Bluetooth' : 'nube (Wi-Fi)'}.`);
    p.push(`Humedad del suelo ahora: ${c.humedad}% (${c.estado}). Umbrales del app: seco <40%, óptimo 40–80%, exceso >80%.`);
    if (c.promedio != null) p.push(`Promedio de ${c.registros} registros: ${c.promedio}%.`);
    if (c.tendencia) p.push(c.tendencia.dir === 'estable' ? `Estable en los últimos ${c.tendencia.minutos} min.` : `Tendencia: ${c.tendencia.dir === 'sube' ? 'sube' : 'baja'} ${Math.abs(c.tendencia.delta)}% en ${c.tendencia.minutos} min.`);
    p.push(`Alertas registradas: ${c.alertas}.`);
  } else {
    p.push('El usuario NO tiene un sensor conectado en este momento: no inventes lecturas.');
  }
  return p.join(' ').slice(0, 1100);
}
