import { Injectable, signal, computed } from '@angular/core';
import { collection, query, orderBy, limit, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Preferences } from '@capacitor/preferences';
import { LocalNotifications } from '@capacitor/local-notifications';
import { db } from './firebase';
import { BleService } from './ble.service';
import { LecturaBle, explicarErrorBle } from './ble-datos';
import { debeGuardarVivo, depurarDuplicados, fusionar, tendencia as calcTendencia } from './historial-util';

export interface Medicion { id: string; humedad: number; fecha: string; sensorId: string; usuarioId: string }
export interface Alerta { fecha: string; tipo: 'cambio' | 'monitoreo'; mensaje: string; humedad: number }
export type Modo = 'bluetooth' | 'nube';

const UMBRAL_CAMBIO = 10;            // % de cambio que dispara notificación
const INTERVALO_MS = 5 * 60 * 1000;  // resumen cada 5 minutos
const VENTANA_EN_LINEA = 10 * 60 * 1000;   // por la nube, el sensor sube datos cada ~1 min
const VENTANA_BLE = 20 * 1000;             // por Bluetooth llega una lectura cada ~4 s
const MAX_REINTENTOS_BLE = 15;

export function hace(iso: string, ahora = Date.now()) {
  const s = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'hace instantes';
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

@Injectable({ providedIn: 'root' })
export class MonitorService {
  conectado = signal(false);
  cargando = signal(false);
  error = signal('');
  sensorId = signal('');
  ultimo = signal('');   // último sensor que el usuario conectó (solo para reconectar)
  ultimoBle = signal<{ id: string; nombre: string } | null>(null);
  historial = signal<Medicion[]>([]);   // copia local + Bluetooth + nube (para Historial)
  alertas = signal<Alerta[]>([]);
  ahora = signal(Date.now());
  modo = signal<Modo | null>(null);                 // cómo está conectado el sensor
  enlace = signal<'ok' | 'reconectando'>('ok');     // estado del enlace Bluetooth
  vivo = signal<Medicion | null>(null);             // última lectura recibida por Bluetooth
  infoSensor = signal<LecturaBle | null>(null);     // datos extra que reporta el ESP32 (Wi-Fi, pendientes…)

  /** Lectura en vivo: solo existe mientras hay un sensor conectado */
  lectura = computed(() => this.conectado() ? (this.vivo() ?? this.historial()[0] ?? null) : null);
  actual = this.lectura;
  tendencia = computed(() => calcTendencia(this.historial()));
  senal = computed(() => {
    const l = this.lectura(); if (!l) return null;
    if (this.modo() === 'bluetooth') {
      if (this.enlace() === 'reconectando') return { ok: false, txt: 'Reconectando por Bluetooth…' };
      const ok = this.ahora() - new Date(l.fecha).getTime() <= VENTANA_BLE;
      return { ok, txt: ok ? 'En vivo · Bluetooth' : 'Sin señal · ' + hace(l.fecha, this.ahora()) };
    }
    const ok = this.ahora() - new Date(l.fecha).getTime() <= VENTANA_EN_LINEA;
    return { ok, txt: ok ? 'Sensor en línea' : 'Sin señal · ' + hace(l.fecha, this.ahora()) };
  });
  promedio = computed(() => {
    const h = this.historial();
    return h.length ? Math.round(h.reduce((a, m) => a + m.humedad, 0) / h.length) : null;
  });

  private unsub?: Unsubscribe;
  private timer?: any;
  private reintento?: any;
  private previa: number | null = null;
  private ultimoResumen: number | null = null;
  private bleId = '';
  private usuarioDesconecto = true;
  private intentos = 0;
  private guardadaBle: { humedad: number; ms: number } | null = null;
  private deBle: Medicion[] = [];     // lecturas recibidas por Bluetooth (ya reducidas a 1 cada 30 s)
  private deNube: Medicion[] = [];    // lecturas que el sensor subió a Firebase

  constructor(private ble: BleService) {
    this.limpiarAntiguo();
    setInterval(() => this.ahora.set(Date.now()), 5000);
  }

  /** Borra datos de prueba guardados por versiones anteriores */
  private async limpiarAntiguo() {
    for (const k of ['historial', 'alertas', 'sensorId']) await Preferences.remove({ key: k });
    const u = await Preferences.get({ key: 'ultimoSensor' }); if (u.value) this.ultimo.set(u.value);
    const b = await Preferences.get({ key: 'ultimoBle' });
    if (b.value) { try { this.ultimoBle.set(JSON.parse(b.value)); } catch { /* dato dañado */ } }
  }
  async olvidarSensor() {
    this.ultimo.set(''); this.ultimoBle.set(null);
    await Preferences.remove({ key: 'ultimoSensor' }); await Preferences.remove({ key: 'ultimoBle' });
  }

  /** Copia local (offline) separada por sensor; solo se carga al conectar ese sensor */
  private async cargarCache(id: string) {
    const h = await Preferences.get({ key: 'historial:' + id }); const a = await Preferences.get({ key: 'alertas:' + id });
    const lista: Medicion[] = h.value ? JSON.parse(h.value) : [];
    this.deBle = lista.filter(x => x.id.startsWith('ble-')); this.deNube = lista.filter(x => !x.id.startsWith('ble-'));
    this.historial.set(lista); this.alertas.set(a.value ? JSON.parse(a.value) : []);
  }

  /** Une Bluetooth + nube, quita duplicados y guarda la copia local */
  private recomponer() {
    const lista = depurarDuplicados(fusionar([this.deBle, this.deNube], 200));
    this.historial.set(lista);
    const id = this.sensorId();
    if (id) Preferences.set({ key: 'historial:' + id, value: JSON.stringify(lista.slice(0, 100)) });
  }

  private mapear(docs: any[]): Medicion[] {
    return docs.map(d => {
      const x: any = d.data();
      let f: Date = x.fecha?.toDate ? x.fecha.toDate() : new Date(x.fecha);
      if (isNaN(f.getTime())) f = new Date(0);
      return { id: d.id, humedad: Number(x.humedad), sensorId: x.sensorId ?? '', usuarioId: x.usuarioId ?? '', fecha: f.toISOString() };
    });
  }
  private msg(e: any) {
    return e?.code === 'permission-denied' ? 'Firestore rechazó la lectura. Revisa las reglas de seguridad.' : 'No se pudo conectar: ' + (e?.message ?? e);
  }

  /** Escucha en Firebase lo que el sensor sube por Wi-Fi. En modo Bluetooth se usa solo como historial de apoyo (silencioso). */
  private escucharNube(id: string, apoyo: boolean) {
    const q = query(collection(db, 'mediciones'), orderBy('fecha', 'desc'), limit(200));
    this.unsub = onSnapshot(q, snap => {
      this.deNube = this.mapear(snap.docs).filter(m => m.sensorId === id);
      this.recomponer();
      if (apoyo) return;
      this.conectado.set(true); this.cargando.set(false);
      if (this.deNube.length) this.procesar(this.deNube[0].humedad);
    }, err => {
      if (apoyo) return;   // sin internet o sin permisos: el Bluetooth sigue funcionando
      this.error.set(this.msg(err)); this.cargando.set(false); this.conectado.set(false);
    });
  }

  /** Conexión por Wi-Fi / nube (lo que el sensor sube a Firebase) */
  async conectar(id: string) {
    id = id.trim(); if (!id) return;
    this.desconectar();
    this.usuarioDesconecto = false;
    this.modo.set('nube');
    this.sensorId.set(id); await this.cargarCache(id);
    this.ultimo.set(id); Preferences.set({ key: 'ultimoSensor', value: id });
    this.cargando.set(true); this.error.set('');
    try { await LocalNotifications.requestPermissions(); } catch { /* web */ }
    this.escucharNube(id, false);
    this.timer = setInterval(() => this.resumen(), INTERVALO_MS);
  }

  /** Conexión directa por Bluetooth LE: lectura en vivo del ESP32, sin Wi-Fi ni internet */
  async conectarBle(deviceId: string, nombre: string): Promise<boolean> {
    this.desconectar();
    this.usuarioDesconecto = false;
    this.modo.set('bluetooth'); this.bleId = deviceId; this.sensorId.set(nombre);
    this.cargando.set(true); this.error.set('');
    await this.cargarCache(nombre);
    try { await LocalNotifications.requestPermissions(); } catch { /* web */ }
    try {
      await this.ble.conectar(deviceId, () => this.alPerderBle(), l => this.alLecturaBle(l));
    } catch (e) {
      const m = explicarErrorBle(e);
      this.descartarConexion();
      this.error.set(m || '');
      return false;
    }
    this.conectado.set(true); this.cargando.set(false); this.enlace.set('ok');
    this.ultimo.set(nombre); this.ultimoBle.set({ id: deviceId, nombre });
    Preferences.set({ key: 'ultimoSensor', value: nombre });
    Preferences.set({ key: 'ultimoBle', value: JSON.stringify({ id: deviceId, nombre }) });
    this.timer = setInterval(() => this.resumen(), INTERVALO_MS);
    this.escucharNube(nombre, true);   // si hay internet, además se trae el historial guardado en la nube
    return true;
  }

  private alLecturaBle(l: LecturaBle) {
    this.infoSensor.set(l);
    this.enlace.set('ok');
    if (l.humedad == null) return;   // el sensor aún no ha medido
    const t = Date.now();
    const m: Medicion = { id: 'ble-' + t, humedad: l.humedad, fecha: new Date(t).toISOString(), sensorId: this.sensorId(), usuarioId: '' };
    this.vivo.set(m);
    if (debeGuardarVivo(this.guardadaBle, m.humedad, t)) {
      this.guardadaBle = { humedad: m.humedad, ms: t };
      this.deBle = [m, ...this.deBle].slice(0, 200);
      this.recomponer();
      this.procesar(m.humedad);
    }
  }

  /** El enlace se cortó (sensor lejos, apagado…): se reintenta solo durante ~1 minuto */
  private alPerderBle() {
    if (this.usuarioDesconecto || this.modo() !== 'bluetooth' || !this.conectado() || this.enlace() === 'reconectando') return;
    this.enlace.set('reconectando'); this.intentos = 0;
    this.programarReintento();
  }

  private programarReintento() {
    clearTimeout(this.reintento);
    this.reintento = setTimeout(async () => {
      if (this.usuarioDesconecto || this.modo() !== 'bluetooth') return;
      this.intentos++;
      try {
        await this.ble.desconectar(this.bleId);
        await this.ble.conectar(this.bleId, () => this.alPerderBle(), l => this.alLecturaBle(l));
        this.enlace.set('ok'); this.intentos = 0;
      } catch {
        if (this.intentos >= MAX_REINTENTOS_BLE) {
          const nombre = this.sensorId();
          this.desconectar();
          this.error.set(`Se perdió la conexión Bluetooth con ${nombre}. Acércate al sensor y vuelve a conectar.`);
        } else this.programarReintento();
      }
    }, this.intentos === 0 ? 1500 : 4000);
  }

  /** Limpia una conexión que no llegó a establecerse (sin borrar el mensaje de error) */
  private descartarConexion() {
    this.desconectar();
  }

  desconectar() {
    this.usuarioDesconecto = true;
    clearTimeout(this.reintento);
    this.unsub?.(); this.unsub = undefined; clearInterval(this.timer);
    if (this.bleId) { this.ble.desconectar(this.bleId); this.bleId = ''; }
    this.conectado.set(false); this.cargando.set(false); this.previa = null; this.ultimoResumen = null; this.guardadaBle = null;
    this.deBle = []; this.deNube = []; this.vivo.set(null); this.infoSensor.set(null);
    this.modo.set(null); this.enlace.set('ok');
    this.historial.set([]); this.alertas.set([]); this.sensorId.set('');
  }

  private procesar(h: number) {
    if (this.previa !== null && Math.abs(h - this.previa) >= UMBRAL_CAMBIO) {
      const d = h - this.previa;
      this.agregar({ tipo: 'cambio', humedad: h, fecha: new Date().toISOString(),
        mensaje: `La humedad ${d > 0 ? 'subió' : 'bajó'} ${Math.abs(d)}% (de ${this.previa}% a ${h}%)` }, true);
    }
    this.previa = h;
    if (this.ultimoResumen === null) this.ultimoResumen = h;
  }

  private resumen() {
    const h = this.lectura()?.humedad;
    if (h === undefined) return;
    const d = h - (this.ultimoResumen ?? h);
    this.agregar({ tipo: 'monitoreo', humedad: h, fecha: new Date().toISOString(),
      mensaje: d === 0 ? `Sin cambios en 5 min. Humedad: ${h}%`
        : `En 5 min la humedad ${d > 0 ? 'subió' : 'bajó'} ${Math.abs(d)}% y está en ${h}%` }, false);
    this.ultimoResumen = h;
  }

  private async agregar(a: Alerta, notificar: boolean) {
    const lista = [a, ...this.alertas()].slice(0, 200);
    this.alertas.set(lista);
    Preferences.set({ key: 'alertas:' + this.sensorId(), value: JSON.stringify(lista) });
    if (notificar) {
      try { await LocalNotifications.schedule({ notifications: [{ id: Date.now() % 2147483647, title: 'AgroSense', body: a.mensaje }] }); }
      catch { /* web */ }
    }
  }

  estado(h: number | null | undefined) {
    if (h == null) return { txt: 'Sin datos', color: 'var(--muted)' };
    if (h < 40) return { txt: 'Suelo seco', color: '#ff8a3d' };
    if (h > 80) return { txt: 'Exceso de humedad', color: '#3d8bff' };
    return { txt: 'Humedad óptima', color: '#19c9a0' };
  }
}
