#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <time.h>
#include "config.h"

/* Wi-Fi no bloqueante con reintentos + hora por NTP (necesaria para la marca de tiempo de cada lectura). */
class Conectividad {
 public:
  void begin() {
    // WiFiManager (en el .ino) ya configuró el modo y realizó la conexión.
    // Solo inicializamos los contadores.
    ultimoConectado = millis();
    ultimoIntento = millis();
    Serial.println("[WIFI] Monitor de conectividad iniciado");
  }

  /** Llamar en cada vuelta del loop. Con el portal de configuración abierto no se toca el Wi-Fi para no interrumpirlo. */
  void mantener(bool permitirReconectar = true) {
    uint32_t ahora = millis();
    if (WiFi.status() == WL_CONNECTED) {
      if (!conectado) {
        conectado = true; huboConexion = true;
        Serial.printf("[WIFI] Conectado. IP %s, señal %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
        configTime(0, 0, NTP_1, NTP_2);   // hora UTC
      }
      ultimoConectado = ahora;
      return;
    }
    
    if (conectado) { 
      conectado = false; 
      Serial.println("[WIFI] Conexión perdida"); 
    }
    
    if (permitirReconectar && ahora - ultimoIntento > 15000UL) {
      ultimoIntento = ahora;
      Serial.println("[WIFI] Intentando reconectar usando credenciales guardadas...");
      WiFi.disconnect();
      WiFi.reconnect(); // Reconecta usando los datos que guardó WiFiManager
    }
  }

  bool listo() const { return conectado; }
  bool alMenosUnaVez() const { return huboConexion; }   // ¿hubo Wi-Fi alguna vez desde el arranque?
  bool horaValida() const { return time(nullptr) > 1700000000; }
  uint32_t segundosSinWifi() const { return conectado ? 0 : (millis() - ultimoConectado) / 1000; }

 private:
  bool conectado = false, huboConexion = false;
  uint32_t ultimoConectado = 0, ultimoIntento = 0;
};