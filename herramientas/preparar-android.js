#!/usr/bin/env node
/**
 * AgroSense · prepara el AndroidManifest.xml para el Bluetooth.
 * Uso (desde la carpeta del proyecto):   node herramientas/preparar-android.js
 *
 * Agrega, solo si faltan, los permisos que Android 12+ exige para buscar y conectar el sensor por Bluetooth LE
 * y declara que la app NO usa el escaneo para calcular la ubicación (así no pide GPS en Android 12 o superior).
 * Es seguro ejecutarlo varias veces.
 */
const fs = require('fs');
const path = require('path');

const ruta = path.resolve(process.argv[2] || path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml'));
if (!fs.existsSync(ruta)) {
  console.error('No encuentro ' + ruta + '\nEjecuta primero:  npx cap add android   (o pasa la ruta del manifiesto como argumento).');
  process.exit(1);
}

let xml = fs.readFileSync(ruta, 'utf8');
const original = xml;
const cambios = [];

// 1) xmlns:tools en <manifest>
if (!/xmlns:tools=/.test(xml)) {
  xml = xml.replace(/<manifest\b/, '<manifest xmlns:tools="http://schemas.android.com/tools"');
  cambios.push('xmlns:tools');
}

// 2) Permisos
const PERMISOS = [
  ['android.permission.BLUETOOTH', '<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />'],
  ['android.permission.BLUETOOTH_ADMIN', '<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />'],
  ['android.permission.ACCESS_COARSE_LOCATION', '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" android:maxSdkVersion="30" />'],
  ['android.permission.ACCESS_FINE_LOCATION', '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />'],
  ['android.permission.BLUETOOTH_SCAN', '<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" tools:targetApi="s" />'],
  ['android.permission.BLUETOOTH_CONNECT', '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />']
];
let bloque = '';
for (const [nombre, linea] of PERMISOS) {
  if (xml.includes('"' + nombre + '"')) {
    // Si BLUETOOTH_SCAN ya existe pero sin neverForLocation, se corrige: sin esa marca Android 12+ puede ocultar los resultados del escaneo
    if (nombre === 'android.permission.BLUETOOTH_SCAN' && !/BLUETOOTH_SCAN"[^>]*neverForLocation/.test(xml)) {
      xml = xml.replace(/<uses-permission[^>]*android\.permission\.BLUETOOTH_SCAN"[^>]*\/>/, linea);
      cambios.push('BLUETOOTH_SCAN (corregido)');
    }
    continue;
  }
  bloque += '    ' + linea + '\n'; cambios.push(nombre.replace('android.permission.', ''));
}
// 3) El Bluetooth LE no es obligatorio para instalar la app (también funciona por Wi-Fi)
if (!/android\.hardware\.bluetooth_le/.test(xml)) {
  bloque += '    <uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />\n'; cambios.push('uses-feature bluetooth_le');
}

if (bloque) {
  if (!/<\/manifest>/.test(xml)) { console.error('El manifiesto no tiene </manifest>: formato inesperado.'); process.exit(1); }
  xml = xml.replace(/<\/manifest>/, '\n' + bloque + '</manifest>');
}

if (xml === original) { console.log('El AndroidManifest.xml ya estaba listo. No se cambió nada.'); process.exit(0); }
fs.writeFileSync(ruta + '.bak', original);
fs.writeFileSync(ruta, xml);
console.log('Listo. Se agregó: ' + cambios.join(', ') + '\nCopia de seguridad: ' + ruta + '.bak');
