#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <time.h>
#include "config.h"

struct Lectura { time_t ts; int humedad; int adc; int rssi; };

/*
 * NubeFirestore - envía lecturas a Firestore (API REST).
 *  - Cola en memoria: si no hay internet, guarda hasta CAPACIDAD_COLA lecturas con su hora real y las sube al volver.
 *  - Reintentos con espera creciente (5 s, 10 s, 20 s ... hasta 5 min) para no saturar la red ni Firebase.
 *  - Errores 4xx (reglas/clave/campos) se registran y se descartan para no bloquear la cola.
 * Para campos nuevos (temperatura, etc.) amplía Lectura y agrega la línea en construirJson().
 */
class NubeFirestore {
 public:
  void begin(const String& id, const String& macAddr) { sensorId = id; mac = macAddr; ultimoExito = millis(); }

  void encolar(const Lectura& l) {
    if (n == CAPACIDAD_COLA) { ini = (ini + 1) % CAPACIDAD_COLA; n--; Serial.println("[NUBE] Cola llena: se descartó la lectura más antigua"); }
    cola[(ini + n) % CAPACIDAD_COLA] = l; n++;
  }
  size_t pendientes() const { return n; }
  uint32_t segundosDesdeExito() const { return (millis() - ultimoExito) / 1000; }

  void procesar(bool hayRed, bool horaOk) {
    if (n == 0 || !hayRed || !horaOk) return;
    uint32_t ahora = millis();
    if ((int32_t)(ahora - proximoIntento) < 0) return;

    int codigo = enviar(cola[ini]);
    if (codigo >= 200 && codigo < 300) {
      Serial.printf("[NUBE] OK (HTTP %d). Pendientes: %u\n", codigo, (unsigned)(n - 1));
      ini = (ini + 1) % CAPACIDAD_COLA; n--; fallos = 0; ultimoExito = ahora; proximoIntento = ahora + 300;
    } else if (codigo >= 400 && codigo < 500 && codigo != 429) {
      Serial.printf("[NUBE] ERROR PERMANENTE HTTP %d: revisa API_KEY, proyecto y reglas de Firestore. Lectura descartada\n", codigo);
      ini = (ini + 1) % CAPACIDAD_COLA; n--; proximoIntento = ahora + 2000;
    } else {
      fallos++;
      uint32_t espera = min<uint32_t>(5000UL << min<uint8_t>(fallos - 1, 6), 300000UL);
      proximoIntento = ahora + espera;
      Serial.printf("[NUBE] Falló (código %d). Reintento en %lu s. Pendientes: %u\n", codigo, (unsigned long)(espera / 1000), (unsigned)n);
    }
  }

 private:
  String sensorId, mac;
  Lectura cola[CAPACIDAD_COLA];
  size_t ini = 0, n = 0;
  uint8_t fallos = 0;
  uint32_t proximoIntento = 0, ultimoExito = 0;

  String construirJson(const Lectura& l) {
    struct tm t; gmtime_r(&l.ts, &t);
    char iso[25]; strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", &t);
    String j; j.reserve(380);
    j += "{\"fields\":{";
    j += "\"humedad\":{\"integerValue\":\"" + String(l.humedad) + "\"},";
    j += "\"adcRaw\":{\"integerValue\":\"" + String(l.adc) + "\"},";
    j += "\"rssi\":{\"integerValue\":\"" + String(l.rssi) + "\"},";
    j += "\"fecha\":{\"timestampValue\":\"" + String(iso) + "\"},";
    j += "\"sensorId\":{\"stringValue\":\"" + sensorId + "\"},";
    j += "\"usuarioId\":{\"stringValue\":\"" + String(USUARIO_ID) + "\"},";
    j += "\"mac\":{\"stringValue\":\"" + mac + "\"},";
    j += "\"firmware\":{\"stringValue\":\"" + String(FIRMWARE_VERSION) + "\"}";
    j += "}}";
    return j;
  }

  int enviar(const Lectura& l) {
    WiFiClientSecure cliente;
    cliente.setInsecure();   // Prototipo. Para producción: cliente.setCACert(<certificado raíz de Google>)
    HTTPClient http;
    http.setConnectTimeout(8000);
    http.setTimeout(10000);
    String url = String("https://firestore.googleapis.com/v1/projects/") + FIREBASE_PROJECT +
                 "/databases/(default)/documents/" + COLECCION + "?key=" + FIREBASE_API_KEY;
    if (!http.begin(cliente, url)) return -1;
    http.addHeader("Content-Type", "application/json");
    int codigo = http.POST(construirJson(l));
    if (codigo >= 400) Serial.println(http.getString().substring(0, 200));
    http.end();
    return codigo;
  }
};
