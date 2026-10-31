// Plantilla de configuración. NO pongas claves reales en este archivo.
// Copia este archivo como environment.ts y como environment.prod.ts (en esta misma carpeta)
// y reemplaza los valores con los de tu proyecto de Firebase
// (Consola de Firebase > Configuración del proyecto > Tus apps > Configuración de SDK).
// En environment.prod.ts agrega además:  production: true,
export const environment = {
  // Ley 1581 de 2012: datos del Responsable del Tratamiento
  responsable: {
    nombre: 'COMPLETA: nombre o razón social',
    documento: 'COMPLETA: NIT o cédula',
    direccion: 'COMPLETA: dirección y ciudad',
    correo: 'COMPLETA: correo para consultas y reclamos',
    telefono: 'COMPLETA: teléfono'
  },
  sensorId: 'ESP32_Invernadero',
  firebase: {
    apiKey: 'TU_API_KEY',
    authDomain: 'TU_PROYECTO.firebaseapp.com',
    projectId: 'TU_PROJECT_ID',
    storageBucket: 'TU_PROYECTO.firebasestorage.app',
    messagingSenderId: 'TU_SENDER_ID',
    appId: 'TU_APP_ID',
    measurementId: 'TU_MEASUREMENT_ID'
  }
};
