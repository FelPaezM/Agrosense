import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { AuthService } from './auth.service';
import { MonitorService } from './monitor.service';
import { auth } from './firebase';
import { IA_ENDPOINT, IA_CONFIGURADA } from './config-ia';
import { ContextoSensor, construirContexto, respuestaLocal, sugerencias } from './experto';

export interface Mensaje {
  id: string; rol: 'user' | 'assistant'; texto: string; fecha: number;
  via?: 'ia' | 'local';          // quién respondió
  modelo?: string; proveedor?: string;
  aviso?: string;                // por qué se usó el modo básico
}

type Fallo = 'sin-config' | 'sin-sesion' | 'limite' | 'ocupado' | 'sin-red' | 'servidor';
class ErrorIa extends Error { constructor(public motivo: Fallo) { super(motivo); } }

const AVISOS: Record<Fallo, string> = {
  'sin-config': 'La IA en la nube aún no está configurada en esta app.',
  'sin-sesion': 'Inicia sesión en Perfil para activar la IA completa.',
  'limite': 'Llegaste al límite de preguntas por minuto. Espera un momento.',
  'ocupado': 'Todos los modelos de IA están ocupados en este momento.',
  'sin-red': 'Sin conexión a internet.',
  'servidor': 'El servidor de IA no respondió bien.'
};

const MAX_MENSAJES = 60;       // historial que se conserva en el teléfono
const MAX_A_IA = 10;           // mensajes que se envían como contexto de la conversación
const ESPERA_MS = 28000;       // el servidor puede probar varios modelos antes de responder

@Injectable({ providedIn: 'root' })
export class IaService {
  mensajes = signal<Mensaje[]>([]);
  enviando = signal(false);
  /** Pregunta lista desde otra pantalla (ej. el Panel); la pantalla del asistente la envía al abrirse */
  preguntaPendiente = signal('');
  estado = signal<{ revisado: boolean; ok: boolean; modelos: number; proveedores: number }>({ revisado: false, ok: false, modelos: 0, proveedores: 0 });
  readonly configurada = IA_CONFIGURADA;
  private cargadoPara = '';
  private ultimoEnvio = 0;

  constructor(private a: AuthService, private m: MonitorService) {}

  get conSesion() { return !!this.a.user(); }

  private llave() { return 'chat:' + (this.a.user()?.uid ?? 'invitado'); }

  /** Carga la conversación del usuario actual (cada cuenta tiene la suya en este teléfono) */
  async asegurarCarga() {
    const k = this.llave();
    if (this.cargadoPara === k) return;
    this.cargadoPara = k;
    try {
      const r = await Preferences.get({ key: k });
      this.mensajes.set(r.value ? JSON.parse(r.value) : []);
    } catch { this.mensajes.set([]); }
  }

  private guardar() {
    Preferences.set({ key: this.llave(), value: JSON.stringify(this.mensajes().slice(-MAX_MENSAJES)) });
  }

  async borrar() { this.mensajes.set([]); await Preferences.remove({ key: this.llave() }); }

  /** Consulta cuántos modelos tiene activos el servidor (para la etiqueta del encabezado) */
  async revisarEstado() {
    if (!this.configurada) { this.estado.set({ revisado: true, ok: false, modelos: 0, proveedores: 0 }); return; }
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 7000);
      const r = await fetch(IA_ENDPOINT + '/salud', { signal: c.signal }); clearTimeout(t);
      const j = await r.json();
      this.estado.set({ revisado: true, ok: !!j?.ok, modelos: Number(j?.modelos) || 0, proveedores: Number(j?.proveedores) || 0 });
    } catch { this.estado.set({ revisado: true, ok: false, modelos: 0, proveedores: 0 }); }
  }

  contextoSensor(): ContextoSensor {
    const l = this.m.lectura(); const h = l?.humedad ?? null;
    return {
      conectado: this.m.conectado() && h != null, humedad: h, estado: this.m.estado(h).txt, promedio: this.m.promedio(),
      tendencia: this.m.tendencia(), cultivo: this.a.perfil()?.cultivo ?? '', sensorId: this.m.sensorId(), modo: this.m.modo(),
      registros: this.m.historial().length, alertas: this.m.alertas().length
    };
  }
  sugerencias() { return sugerencias(this.contextoSensor()); }

  private nuevo(rol: Mensaje['rol'], texto: string, extra: Partial<Mensaje> = {}): Mensaje {
    return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), rol, texto, fecha: Date.now(), ...extra };
  }

  async enviar(texto: string) {
    texto = (texto ?? '').trim().slice(0, 600);
    if (!texto || this.enviando() || Date.now() - this.ultimoEnvio < 900) return;
    this.ultimoEnvio = Date.now();
    await this.asegurarCarga();
    this.mensajes.update(l => [...l, this.nuevo('user', texto)]);
    this.enviando.set(true);
    const ctx = this.contextoSensor();
    let respuesta: Mensaje;
    try {
      const r = await this.consultarIA(construirContexto(ctx));
      respuesta = this.nuevo('assistant', r.texto, { via: 'ia', modelo: r.modelo, proveedor: r.proveedor });
    } catch (e) {
      const motivo: Fallo = e instanceof ErrorIa ? e.motivo : 'sin-red';
      respuesta = this.nuevo('assistant', respuestaLocal(texto, ctx), { via: 'local', aviso: AVISOS[motivo] });
    }
    this.mensajes.update(l => [...l, respuesta]);
    this.enviando.set(false);
    this.guardar();
  }

  /** Mensajes para la IA: solo la conversación real (sin las respuestas del modo básico), alternando roles */
  private conversacion() {
    const base = this.mensajes().filter(x => x.rol === 'user' || x.via === 'ia').slice(-MAX_A_IA);
    const out: { rol: string; texto: string }[] = [];
    for (const x of base) {
      const t = x.texto.slice(0, 1500);
      if (out.length && out[out.length - 1].rol === x.rol) out[out.length - 1].texto += '\n' + t; else out.push({ rol: x.rol, texto: t });
    }
    while (out.length && out[0].rol !== 'user') out.shift();
    return out;
  }

  private async consultarIA(contexto: string): Promise<{ texto: string; modelo: string; proveedor: string }> {
    if (!this.configurada) throw new ErrorIa('sin-config');
    const user = auth.currentUser;
    if (!user) throw new ErrorIa('sin-sesion');
    let token: string;
    try { token = await user.getIdToken(); } catch { throw new ErrorIa('sin-red'); }

    const c = new AbortController(); const t = setTimeout(() => c.abort(), ESPERA_MS);
    let r: Response;
    try {
      r = await fetch(IA_ENDPOINT + '/chat', {
        method: 'POST', signal: c.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ mensajes: this.conversacion(), contexto })
      });
    } catch { throw new ErrorIa('sin-red'); } finally { clearTimeout(t); }

    if (r.status === 401 || r.status === 403) throw new ErrorIa('sin-sesion');
    if (r.status === 429) throw new ErrorIa('limite');
    if (r.status === 503) throw new ErrorIa('ocupado');
    if (!r.ok) throw new ErrorIa('servidor');
    let j: any;
    try { j = await r.json(); } catch { throw new ErrorIa('servidor'); }
    const texto = String(j?.texto ?? '').trim();
    if (!texto) throw new ErrorIa('servidor');
    return { texto, modelo: String(j?.modelo ?? ''), proveedor: String(j?.proveedor ?? '') };
  }
}
