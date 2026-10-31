// ==========================================================
// PROYECTO AGROSENSE - ESP32 + YL-69
// Mide la humedad del suelo y la entrega por DOS caminos independientes:
//   · Bluetooth LE: la app lee la humedad en vivo directo del sensor (sin Wi-Fi ni internet).
//   · Wi-Fi: sube el historial a Firebase cuando hay red.
// ==========================================================
#include "config.h"
#include "Sensor.h"
#include "Conectividad.h"
#include "Nube.h"
#include "Ble.h"
#include <WiFiManager.h>

SensorHumedadSuelo sensor;
Conectividad red;
NubeFirestore nube;
AnuncioBle ble;
WiFiManager wm;                       // global: el portal de configuración funciona sin bloquear el Bluetooth
String nombrePortal;
uint32_t tPortal = 0;

String sensorId;
uint32_t tMuestreo = 0, tEnvio = 0;
bool primeraMuestra = true, hayEnvioPrevio = false;
int ultimoEnviado = -1;

// MAC de fábrica de la placa
String macTexto() {
  uint64_t mac = ESP.getEfuseMac();
  char s[18];
  snprintf(s, sizeof(s), "%02X:%02X:%02X:%02X:%02X:%02X", (uint8_t)mac, (uint8_t)(mac >> 8), (uint8_t)(mac >> 16),
           (uint8_t)(mac >> 24), (uint8_t)(mac >> 32), (uint8_t)(mac >> 40));
  return String(s);
}

// ID = "ESP32_" + últimos 3 bytes de la MAC
String construirId() {
  if (ID_PERSONALIZADO[0] != '\0') return String(ID_PERSONALIZADO);
  uint64_t mac = ESP.getEfuseMac();
  char id[16];
  snprintf(id, sizeof(id), "ESP32_%02X%02X%02X", (uint8_t)(mac >> 24), (uint8_t)(mac >> 32), (uint8_t)(mac >> 40));
  return String(id);
}

void imprimirAyuda() {
  Serial.println("Comandos: ayuda | leer | info | cal seco | cal humedo | cal reset | reiniciar");
  Serial.println("Calibrar: 1) sensor limpio y al aire -> 'cal seco'  2) sensor en agua o tierra bien mojada -> 'cal humedo'");
}

void ejecutarComando(String c) {
  c.trim(); c.toLowerCase();
  if (c == "ayuda" || c == "?") imprimirAyuda();
  else if (c == "leer") { MedicionSuelo m = sensor.medir(); Serial.printf("ADC %d -> %d %% (válida: %s)\n", m.adc, m.porcentaje, m.valida ? "sí" : "NO"); }
  else if (c == "cal seco")   Serial.println(sensor.calibrarSeco()   ? "Calibración SECO guardada"   : "Rechazada: el valor seco debe ser bastante mayor que el húmedo");
  else if (c == "cal humedo") Serial.println(sensor.calibrarHumedo() ? "Calibración HÚMEDO guardada" : "Rechazada: el valor húmedo debe ser bastante menor que el seco");
  else if (c == "cal reset")  { sensor.restablecer(); Serial.println("Calibración restablecida a valores de fábrica"); }
  else if (c == "reiniciar")  { Serial.println("Reiniciando..."); delay(200); ESP.restart(); }
  else if (c == "info") {
    Serial.printf("ID: %s | MAC: %s | Firmware: %s | Wi-Fi: %s (%d dBm) | Hora válida: %s | Bluetooth: %s\n", sensorId.c_str(), macTexto().c_str(), FIRMWARE_VERSION,
                  red.listo() ? "conectado" : "sin conexión", red.listo() ? WiFi.RSSI() : 0, red.horaValida() ? "sí" : "no",
                  ble.hayCliente() ? "app conectada" : "esperando app");
    Serial.printf("Calibración: seco=%d humedo=%d | Pendientes por enviar: %u | Activo: %lu s\n",
                  sensor.adcSeco(), sensor.adcHumedo(), (unsigned)nube.pendientes(), (unsigned long)(millis() / 1000));
  } else if (c.length()) Serial.println("Comando no reconocido. Escribe 'ayuda'");
}

void atenderSerial() {
  static String linea;
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') { if (linea.length()) ejecutarComando(linea); linea = ""; }
    else if (linea.length() < 40) linea += ch;
  }
}

void tareaMuestreo() {
  uint32_t ahora = millis();
  // Con la app conectada por Bluetooth se mide cada pocos segundos (lectura casi en vivo); sin ella, cada INTERVALO_MUESTREO_S.
  // El sensor solo se energiza durante la medición, así que el desgaste del YL-69 sigue siendo mínimo.
  uint32_t intervalo = (ble.hayCliente() ? INTERVALO_BLE_S : INTERVALO_MUESTREO_S) * 1000UL;
  if (!primeraMuestra && ahora - tMuestreo < intervalo) return;
  tMuestreo = ahora; primeraMuestra = false;

  MedicionSuelo m = sensor.medir();
  if (!m.valida) { Serial.printf("[SENSOR] Lectura inválida (ADC=%d): revisa el cableado o un posible cortocircuito\n", m.adc); return; }

  // Camino 1: Bluetooth (no necesita hora ni internet)
  ble.publicar(m.porcentaje, m.adc, red.listo() ? WiFi.RSSI() : 0, red.listo(), red.horaValida(), nube.pendientes() > 0, nube.pendientes());

  // Camino 2: nube. Sin hora NTP no hay marca de tiempo confiable, así que solo se encola cuando la hora es válida.
  if (!red.horaValida()) { Serial.printf("[SENSOR] ADC %d | Humedad %d %% (solo Bluetooth: sin hora/Wi-Fi)\n", m.adc, m.porcentaje); return; }

  bool porTiempo = !hayEnvioPrevio || ahora - tEnvio >= INTERVALO_ENVIO_S * 1000UL;
  bool porCambio = hayEnvioPrevio && abs(m.porcentaje - ultimoEnviado) >= CAMBIO_ENVIO_PCT && ahora - tEnvio >= ENVIO_MIN_S * 1000UL;

  Serial.printf("[SENSOR] ADC %d | Humedad %d %%%s\n", m.adc, m.porcentaje, (porTiempo || porCambio) ? " -> se envía" : "");

  if (porTiempo || porCambio) {
    Lectura l{ time(nullptr), m.porcentaje, m.adc, red.listo() ? WiFi.RSSI() : 0 };
    nube.encolar(l);
    ultimoEnviado = m.porcentaje; tEnvio = ahora; hayEnvioPrevio = true;
  }
}

void vigilancia() {
  // Solo se reinicia por falta de Wi-Fi si ya hubo Wi-Fi antes (se cayó el router) y nadie usa el Bluetooth.
  // Un sensor que trabaja solo por Bluetooth NO debe reiniciarse nunca por no tener Wi-Fi.
  if (red.alMenosUnaVez() && !ble.hayCliente() && red.segundosSinWifi() > REINICIO_SIN_WIFI_S) {
    Serial.println("[VIGILANCIA] Mucho tiempo sin Wi-Fi: reiniciando");
    delay(200); ESP.restart();
  }
  // Hay lecturas pendientes, hay Wi-Fi y nada se envía desde hace mucho: reiniciar
  if (nube.pendientes() > 0 && red.listo() && nube.segundosDesdeExito() > REINICIO_SIN_ENVIO_S) {
    Serial.println("[VIGILANCIA] Sin envíos exitosos a Firebase: reiniciando");
    delay(200); ESP.restart();
  }
}

/** Si nunca se configuró un Wi-Fi, el portal "AgroSense-<ID>" se vuelve a abrir cada 5 min (el Bluetooth sigue funcionando siempre). */
void portalWifi() {
  wm.process();   // atiende el portal si está abierto (modo no bloqueante)
  if (red.listo() || wm.getConfigPortalActive() || wm.getWiFiIsSaved()) return;
  if (millis() - tPortal < 300000UL) return;
  tPortal = millis();
  Serial.println("[WIFI] Sin red guardada: reabriendo portal de configuración");
  wm.autoConnect(nombrePortal.c_str());
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.printf("=== AgroSense ESP32 · firmware %s ===\n", FIRMWARE_VERSION);

  sensor.begin();
  sensorId = construirId();
  Serial.printf("[ID] %s | MAC %s\n", sensorId.c_str(), macTexto().c_str());

  // Bluetooth primero y SIEMPRE: funciona aunque no haya Wi-Fi configurado o se haya caído
  ble.begin(sensorId, FIRMWARE_VERSION);

  // Wi-Fi sin bloquear: si no hay red guardada se abre el punto de acceso "AgroSense-<ID>" para configurarla
  // desde el celular, y mientras tanto el sensor ya mide y se deja leer por Bluetooth.
  WiFi.mode(WIFI_STA);
  nombrePortal = "AgroSense-" + sensorId;
  wm.setConfigPortalBlocking(false);
  wm.setConnectTimeout(15);
  wm.setConfigPortalTimeout(180);
  tPortal = millis();
  if (wm.autoConnect(nombrePortal.c_str())) Serial.println("[WIFI] Conectado con la red guardada");
  else Serial.println("[WIFI] Sin Wi-Fi por ahora (portal abierto 3 min). El Bluetooth funciona igual.");

  red.begin();
  nube.begin(sensorId, macTexto());
  imprimirAyuda();
}

void loop() {
  atenderSerial();
  portalWifi();
  red.mantener(!wm.getConfigPortalActive());
  ble.mantener();
  tareaMuestreo();
  nube.procesar(red.listo(), red.horaValida());
  vigilancia();
  delay(20);
}
