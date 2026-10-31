# AgroSense

Sistema IoT de monitoreo de la humedad del suelo para pequeños y medianos productores de Cundinamarca.
Un sensor YL-69 conectado a un microcontrolador ESP32 envía las lecturas por Bluetooth y Wi-Fi a una
aplicación móvil híbrida hecha con Ionic y Angular, que las guarda en Firebase, genera alertas y ofrece
un asistente con inteligencia artificial. Funciona con enfoque offline-first.

Proyecto del equipo **Creadores de Oportunidad** – Ingeniería de Software, Universidad de Cundinamarca, Extensión Soacha.

## Tecnologías
- **Frontend:** Ionic 9, Angular 22, TypeScript, Capacitor (Bluetooth LE, notificaciones locales, preferencias)
- **Backend y base de datos:** Firebase (Authentication con correo y Google, Firestore NoSQL)
- **Asistente de IA:** Worker de Cloudflare que guarda las claves de los modelos (las claves no están en la app)
- **Hardware:** ESP32 y sensor de humedad YL-69

## Estructura
```
src/app/core/     servicios (Firebase, Bluetooth, monitoreo, IA, autenticación)
src/app/pages/    pantallas: panel, historial, alertas, asistente, perfil, política de datos
src/environments/ configuración (la real NO se sube; ver environment.example.ts)
firestore.rules   reglas de seguridad de Firestore
```

## Cómo ejecutarlo
1. Instala [Node.js](https://nodejs.org) y el CLI de Ionic: `npm install -g @ionic/cli`
2. Instala las dependencias: `npm install`
3. Copia `src/environments/environment.example.ts` como `src/environments/environment.ts` y como
   `src/environments/environment.prod.ts` (en este último agrega `production: true,`) y reemplaza los
   valores con la configuración de tu proyecto de Firebase.
4. Ejecuta en el navegador: `ionic serve`
5. Para Android: `npm run build`, luego `npx cap sync android` y `npx cap open android`.

## Firebase
- Activa **Authentication** (correo/contraseña y Google) y **Firestore**.
- Publica las reglas de `firestore.rules` en Firestore > Reglas.
- Colecciones: `mediciones` (humedad, fecha, sensorId) y `perfiles` (un documento por usuario, con
  nombre, correo, cultivo y consentimiento).

## Seguridad
El repositorio no incluye credenciales: los archivos `environment.ts` y `environment.prod.ts` están en `.gitignore`.
