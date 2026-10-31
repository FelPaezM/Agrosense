#pragma once
#include <Arduino.h>
#include <Preferences.h>
#include "config.h"

struct MedicionSuelo { bool valida; int adc; int porcentaje; };

/*
 * SensorHumedadSuelo - YL-69
 * Cuidado del sensor (resistivo, se corroe con corriente continua):
 *  1) Solo se energiza durante la medición (~0,4 s cada 30 s = ~1 % del tiempo).
 *  2) Espera de estabilización antes de leer.
 *  3) Filtro: ordena las muestras, descarta extremos y promedia el centro.
 *  4) Calibración guardada en memoria permanente (NVS), ajustable por Serial.
 */
class SensorHumedadSuelo {
 public:
  void begin() {
    if (PIN_ALIMENTACION >= 0) { pinMode(PIN_ALIMENTACION, OUTPUT); digitalWrite(PIN_ALIMENTACION, LOW); }
    pinMode(PIN_SENSOR, INPUT);
    analogReadResolution(12);
    analogSetPinAttenuation(PIN_SENSOR, ADC_11db);
    prefs.begin("agrosense", false);
    seco   = prefs.getInt("seco",   ADC_SECO_DEFECTO);
    humedo = prefs.getInt("humedo", ADC_HUMEDO_DEFECTO);
  }

  int leerADC() {
    if (PIN_ALIMENTACION >= 0) { digitalWrite(PIN_ALIMENTACION, HIGH); delay(T_ESTABILIZACION_MS); }
    int v[MUESTRAS];
    for (uint8_t i = 0; i < MUESTRAS; i++) { v[i] = analogRead(PIN_SENSOR); delay(5); }
    if (PIN_ALIMENTACION >= 0) digitalWrite(PIN_ALIMENTACION, LOW);   // apagar de inmediato
    for (uint8_t i = 1; i < MUESTRAS; i++) {                        // ordenar
      int k = v[i]; int j = i - 1;
      while (j >= 0 && v[j] > k) { v[j + 1] = v[j]; j--; }
      v[j + 1] = k;
    }
    const uint8_t corte = MUESTRAS / 4;                             // quitar extremos
    long suma = 0;
    for (uint8_t i = corte; i < MUESTRAS - corte; i++) suma += v[i];
    return (int)(suma / (MUESTRAS - (2 * corte))); // Corrección de sintaxis aquí
  }

  MedicionSuelo medir() {
    MedicionSuelo m;
    m.adc = leerADC();
    m.valida = m.adc >= ADC_MIN_VALIDO;
    m.porcentaje = constrain(map(m.adc, seco, humedo, 0, 100), 0, 100);
    return m;
  }

  bool calibrarSeco()   { int v = leerADC(); if (v - humedo < 300) return false; seco = v;   prefs.putInt("seco", v);   return true; }
  bool calibrarHumedo() { int v = leerADC(); if (seco - v < 300) return false;   humedo = v; prefs.putInt("humedo", v); return true; }
  void restablecer() { prefs.remove("seco"); prefs.remove("humedo"); seco = ADC_SECO_DEFECTO; humedo = ADC_HUMEDO_DEFECTO; }
  int adcSeco() const { return seco; }
  int adcHumedo() const { return humedo; }

 private:
  Preferences prefs;
  int seco = ADC_SECO_DEFECTO, humedo = ADC_HUMEDO_DEFECTO;
};