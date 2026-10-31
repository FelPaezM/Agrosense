#pragma once
#include <Arduino.h>

/*
 * AgroSense - CONFIGURACIÓN
 * Es el único archivo que debes editar para uso normal.
 */
#define FIRMWARE_VERSION "1.1.0"

// ---------- IDENTIDAD ----------
const char* const ID_PERSONALIZADO = "";

// ---------- WI-FI (Dinámico con WiFiManager) ----------
const char* const NTP_1 = "pool.ntp.org";
const char* const NTP_2 = "time.google.com";

// ---------- FIREBASE ----------
const char* const FIREBASE_API_KEY = "TU_API_KEY";
const char* const FIREBASE_PROJECT = "agrosense-31c62";
const char* const COLECCION        = "mediciones";
const char* const USUARIO_ID       = "sin_asignar";

// ---------- SENSOR YL-69 (humedad de suelo, resistivo) ----------
constexpr int PIN_SENSOR         = 34;  
constexpr int PIN_ALIMENTACION   = 25;  
constexpr int ADC_SECO_DEFECTO   = 4095;  
constexpr int ADC_HUMEDO_DEFECTO = 800;   // Ajustado para admitir lecturas húmedas bajas (como 912) sin saturar al 100%
constexpr int ADC_MIN_VALIDO     = 100;  

constexpr uint16_t T_ESTABILIZACION_MS = 200;  
constexpr uint8_t  MUESTRAS            = 15;   

// ---------- CUÁNDO MEDIR Y ENVIAR ----------
constexpr uint32_t INTERVALO_MUESTREO_S = 30;  
constexpr uint32_t INTERVALO_BLE_S      = 4;   // con la app conectada por Bluetooth se mide más seguido (lectura casi en vivo)
constexpr uint32_t INTERVALO_ENVIO_S    = 60;  
constexpr uint32_t ENVIO_MIN_S          = 15;  
constexpr int      CAMBIO_ENVIO_PCT     = 5;   

// ---------- ROBUSTEZ ----------
constexpr size_t   CAPACIDAD_COLA       = 60;    
constexpr uint32_t REINICIO_SIN_WIFI_S   = 600;   
constexpr uint32_t REINICIO_SIN_ENVIO_S  = 1800;

// ---------- BLUETOOTH (la app lee la humedad directo del sensor, sin internet) ----------
#define BLE_SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_DATOS_UUID   "beb5483e-36e1-4688-b7f5-ea07361b26a8"   // lectura (READ + NOTIFY), 8 bytes
#define BLE_INFO_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a9"   // "ID;firmware" (READ)
