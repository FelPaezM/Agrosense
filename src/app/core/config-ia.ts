/**
 * Dirección del servidor del asistente de IA (carpeta ia-worker, se publica gratis en Cloudflare Workers).
 * Después de ejecutar "npx wrangler deploy" copia aquí la URL que te muestra, SIN barra final. Ejemplo:
 *   export const IA_ENDPOINT = 'https://agrosense-ia.tu-usuario.workers.dev';
 * Mientras diga "PEGA-AQUI" el asistente responde en modo básico (reglas + tus datos), sin IA en la nube.
 */
export const IA_ENDPOINT = 'https://agrosense-ia.agrosense-felip.workers.dev'

export const IA_CONFIGURADA = /^https:\/\/[^\s]+$/.test(IA_ENDPOINT) && !/PEGA-AQUI/i.test(IA_ENDPOINT);
