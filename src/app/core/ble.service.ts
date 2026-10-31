import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { BLE_SERVICIO, BLE_DATOS, LecturaBle, esSensorAgro, explicarErrorBle, parsearLecturaBle } from './ble-datos';

export interface Dispositivo { id: string; nombre: string; rssi: number | null }

/**
 * Bluetooth LE: busca sensores AgroSense cercanos y se conecta a ellos para recibir la humedad EN VIVO,
 * directo del ESP32, sin Wi-Fi ni internet.
 */
@Injectable({ providedIn: 'root' })
export class BleService {
  buscando = signal(false);
  intento = signal(false);
  dispositivos = signal<Dispositivo[]>([]);
  mensaje = signal('');
  /** Android/iOS siempre; en navegador solo si el navegador trae Web Bluetooth (Chrome) */
  readonly disponible = Capacitor.isNativePlatform() || (typeof navigator !== 'undefined' && 'bluetooth' in navigator);
  private listo = false;

  /** Inicializa el plugin y, en Android, pide encender el Bluetooth si está apagado */
  private async preparar() {
    if (!this.listo) { await BleClient.initialize({ androidNeverForLocation: true }); this.listo = true; }
    if (Capacitor.getPlatform() === 'android') {
      if (!(await BleClient.isEnabled())) await BleClient.requestEnable();
    }
  }

  async buscar() {
    this.buscando.set(true); this.dispositivos.set([]); this.mensaje.set('');
    const vistos = new Map<string, Dispositivo>();
    const publicar = () => this.dispositivos.set([...vistos.values()].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999)));
    try {
      await this.preparar();
      if (Capacitor.isNativePlatform()) {
        // Sin filtros del plugin: se filtra aquí por el nombre del anuncio (ESP32_XXXXXX), que es más fiable en todos los Android
        await BleClient.requestLEScan({ scanMode: 2 } as any, r => {
          const nombre = r.localName ?? r.device.name;
          if (!esSensorAgro(nombre)) return;
          vistos.set(r.device.deviceId, { id: r.device.deviceId, nombre: nombre!.trim(), rssi: r.rssi ?? null });
          publicar();
        });
        await new Promise(res => setTimeout(res, 8000));
        await BleClient.stopLEScan();
      } else {
        const d = await BleClient.requestDevice({ namePrefix: 'ESP32', optionalServices: [BLE_SERVICIO] });
        vistos.set(d.deviceId, { id: d.deviceId, nombre: d.name ?? d.deviceId, rssi: null }); publicar();
      }
    } catch (e) {
      try { await BleClient.stopLEScan(); } catch { /* no había escaneo */ }
      this.mensaje.set(explicarErrorBle(e));
    }
    this.buscando.set(false); this.intento.set(true);
  }

  /** Conecta y empieza a recibir lecturas. Lanza error (ya traducible con explicarErrorBle) si no se logra. */
  async conectar(id: string, alDesconectar: () => void, alLectura: (l: LecturaBle) => void) {
    await this.preparar();
    await BleClient.connect(id, () => alDesconectar(), { timeout: 10000 });
    try {
      const l = parsearLecturaBle(await BleClient.read(id, BLE_SERVICIO, BLE_DATOS, { timeout: 5000 }));
      if (l) alLectura(l);
    } catch { /* la primera notificación traerá el dato */ }
    await BleClient.startNotifications(id, BLE_SERVICIO, BLE_DATOS, v => { const l = parsearLecturaBle(v); if (l) alLectura(l); });
  }

  async desconectar(id: string) {
    try { await BleClient.stopNotifications(id, BLE_SERVICIO, BLE_DATOS); } catch { /* ya estaba desconectado */ }
    try { await BleClient.disconnect(id); } catch { /* ya estaba desconectado */ }
  }
}
