/**
 * Contrato Bluetooth LE entre la app y el firmware del ESP32 (archivo Ble.h).
 * Todo lo que no depende de Angular ni de Capacitor vive aquí para poder probarlo solo.
 */
export const BLE_SERVICIO = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const BLE_DATOS = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';   // READ + NOTIFY · 8 bytes
export const BLE_INFO = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';    // READ · "ID;firmware"

export interface LecturaBle {
  humedad: number | null;        // 0-100, null si el sensor aún no midió
  adc: number;                   // valor crudo del ADC (sirve para calibrar)
  wifi: boolean;                 // el sensor tiene Wi-Fi
  rssiWifi: number | null;       // dBm del Wi-Fi del sensor
  horaValida: boolean;           // el sensor ya sincronizó la hora (NTP)
  enviando: boolean;             // tiene lecturas esperando para subir a la nube
  pendientes: number;            // cuántas
}

/** Decodifica el paquete de 8 bytes. Devuelve null si el formato no es el esperado. */
export function parsearLecturaBle(v: DataView): LecturaBle | null {
  if (!v || v.byteLength < 8 || v.getUint8(0) !== 1) return null;
  const h = v.getUint8(1);
  const f = v.getUint8(5);
  const rssi = v.getInt8(4);
  return {
    humedad: h <= 100 ? h : null,
    adc: v.getUint16(2, true),
    wifi: !!(f & 1),
    rssiWifi: (f & 1) && rssi !== 0 ? rssi : null,
    horaValida: !!(f & 2),
    enviando: !!(f & 4),
    pendientes: v.getUint16(6, true)
  };
}

/** Los sensores AgroSense se anuncian como "ESP32_XXXXXX" */
export function esSensorAgro(nombre?: string | null): boolean {
  return !!nombre && /^ESP32/i.test(nombre.trim());
}

/** Barras de señal (0-4) a partir del RSSI Bluetooth en dBm */
export function barrasSenal(rssi?: number | null): 0 | 1 | 2 | 3 | 4 {
  if (rssi == null) return 0;
  if (rssi >= -60) return 4;
  if (rssi >= -72) return 3;
  if (rssi >= -84) return 2;
  return 1;
}

/** Traduce los errores del plugin Bluetooth a mensajes que el usuario pueda resolver. Cadena vacía = cancelación del usuario (no mostrar). */
export function explicarErrorBle(e: unknown): string {
  const x: any = e;
  const t = String(x?.message ?? x ?? '').toLowerCase();
  if (/cancel|chooser|no device selected/.test(t)) return '';
  if (/not enabled|disabled|turned off|bluetooth is off|enable bluetooth|adapter.*off/.test(t)) return 'El Bluetooth del teléfono está apagado. Actívalo e inténtalo de nuevo.';
  if (/location services|location.*(off|disabled)/.test(t)) return 'Activa la ubicación del teléfono: Android la exige para buscar dispositivos Bluetooth.';
  if (/permission|denied|not granted|unauthorized|not allowed/.test(t)) return 'Falta el permiso de Bluetooth. En Ajustes ▸ Aplicaciones ▸ AgroSense ▸ Permisos activa «Dispositivos cercanos» (en Android 11 o anterior, «Ubicación»).';
  if (/timeout|timed out/.test(t)) return 'El sensor no respondió a tiempo. Acércate a él y vuelve a intentarlo.';
  if (/unimplemented|not implemented|not supported|not available/.test(t)) return 'Este dispositivo o navegador no admite Bluetooth LE.';
  if (/gatt|connect|not connected|disconnect|service|characteristic/.test(t)) return 'No se pudo conectar con el sensor. Acércalo al teléfono, comprueba que esté encendido y vuelve a intentar.';
  return 'Bluetooth: ' + (x?.message ?? x ?? 'error desconocido');
}
