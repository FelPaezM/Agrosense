#pragma once
#include <Arduino.h>
#include <NimBLEDevice.h>   // Librería "NimBLE-Arduino" (h2zero)
#include "config.h"

/*
 * Bluetooth LE de AgroSense: el sensor se anuncia con su ID (ej. "ESP32_A1B2C3") y, al conectarse la app,
 * le entrega la humedad en vivo SIN necesidad de Wi-Fi ni internet.
 *
 * Servicio BLE_SERVICE_UUID
 *   ├─ BLE_DATOS_UUID (READ + NOTIFY) · 8 bytes, little-endian
 *   │     [0] versión del formato (1)
 *   │     [1] humedad 0-100  (255 = todavía sin lectura)
 *   │     [2..3] ADC crudo (uint16)
 *   │     [4] RSSI Wi-Fi (int8, 0 si no hay Wi-Fi)
 *   │     [5] banderas: bit0 = Wi-Fi conectado, bit1 = hora válida (NTP), bit2 = enviando a la nube
 *   │     [6..7] lecturas pendientes por subir a la nube (uint16)
 *   └─ BLE_INFO_UUID  (READ) · texto "ID;firmware"
 *
 * Solo se usan llamadas de NimBLE que existen igual en las versiones 1.x y 2.x de la librería.
 */
class AnuncioBle {
 public:
  void begin(const String& nombre, const String& firmware) {
    NimBLEDevice::init(nombre.c_str());
    servidor = NimBLEDevice::createServer();
    NimBLEService* servicio = servidor->createService(BLE_SERVICE_UUID);

    datos = servicio->createCharacteristic(BLE_DATOS_UUID, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
    uint8_t vacio[8] = { 1, 255, 0, 0, 0, 0, 0, 0 };
    datos->setValue(vacio, sizeof(vacio));

    NimBLECharacteristic* info = servicio->createCharacteristic(BLE_INFO_UUID, NIMBLE_PROPERTY::READ);
    String txt = nombre + ";" + firmware;
    info->setValue(txt.c_str());

    servicio->start();

    anuncio = NimBLEDevice::getAdvertising();
    anuncio->setName(nombre.c_str());      // el nombre ESP32_XXXXXX es lo que la app busca al escanear
    anuncio->start();
    Serial.printf("[BLE] Anunciándose como %s\n", nombre.c_str());
  }

  /** Actualiza la lectura; si la app está suscrita, le llega al instante */
  void publicar(int humedad, int adc, int rssi, bool wifi, bool horaOk, bool enviando, size_t pendientes) {
    if (!datos) return;
    uint8_t b[8];
    b[0] = 1;
    b[1] = (uint8_t)constrain(humedad, 0, 100);
    b[2] = (uint8_t)(adc & 0xFF);
    b[3] = (uint8_t)((adc >> 8) & 0xFF);
    b[4] = (uint8_t)(int8_t)constrain(rssi, -127, 0);
    b[5] = (uint8_t)((wifi ? 1 : 0) | (horaOk ? 2 : 0) | (enviando ? 4 : 0));
    uint16_t p = pendientes > 65535 ? 65535 : (uint16_t)pendientes;
    b[6] = (uint8_t)(p & 0xFF);
    b[7] = (uint8_t)(p >> 8);
    datos->setValue(b, sizeof(b));
    if (hayCliente()) datos->notify();
  }

  bool hayCliente() const { return servidor && servidor->getConnectedCount() > 0; }

  /** Llamar en el loop: si la app se desconecta, el sensor vuelve a ser visible para otros intentos */
  void mantener() {
    if (!anuncio || hayCliente()) return;
    if (!anuncio->isAdvertising()) anuncio->start();
  }

 private:
  NimBLEServer* servidor = nullptr;
  NimBLECharacteristic* datos = nullptr;
  NimBLEAdvertising* anuncio = nullptr;
};
