import { Component } from '@angular/core';
import { environment } from '../../environments/environment';
import { VERSION_POLITICA } from '../core/auth.service';

const RESPONSABLE_DEFECTO = {
  nombre: 'COMPLETA: nombre o razón social',
  documento: 'COMPLETA: NIT o cédula',
  direccion: 'COMPLETA: dirección y ciudad',
  correo: 'COMPLETA: correo para consultas y reclamos',
  telefono: 'COMPLETA: teléfono'
};

@Component({
  standalone: false,
  selector: 'app-politica',
  template: `
  <div class="pol">
    <h2>Política de Tratamiento de Datos Personales</h2>
    <p class="muted">Versión {{ v }} · Ley 1581 de 2012 y Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015)</p>

    <h3>1. Responsable del tratamiento</h3>
    <p>{{ r.nombre }} · {{ r.documento }}<br>{{ r.direccion }}<br>Correo: {{ r.correo }} · Tel.: {{ r.telefono }}</p>

    <h3>2. Datos que recolectamos</h3>
    <p>Nombre, correo electrónico, cultivo, identificador de cuenta, método de acceso (correo o Google) y registro de tu autorización. Del sensor: humedad, fecha y hora, e identificador del sensor. No recolectamos datos sensibles ni datos de menores de edad.</p>

    <h3>3. Finalidades</h3>
    <p>Crear y administrar tu cuenta; mostrarte las mediciones, el historial y las alertas de tu sensor; generar recomendaciones para tu cultivo; recuperar tu acceso; y atender tus consultas y reclamos.</p>

    <h3>4. Tus derechos como titular</h3>
    <p>Conocer, actualizar y rectificar tus datos; solicitar prueba de la autorización; ser informado del uso que se les da; presentar quejas ante la Superintendencia de Industria y Comercio; revocar la autorización y/o solicitar la supresión de tus datos; y acceder gratuitamente a ellos. Puedes ejercer los dos últimos desde la pestaña Perfil → «Mis datos y privacidad».</p>

    <h3>5. Autorización</h3>
    <p>El tratamiento requiere tu autorización previa, expresa e informada, que te solicitamos al crear tu cuenta. Puedes revocarla en cualquier momento eliminando tu cuenta.</p>

    <h3>6. Consultas y reclamos</h3>
    <p>Escríbenos a {{ r.correo }}. Las consultas se responden en máximo 10 días hábiles (prorrogables 5) y los reclamos en máximo 15 días hábiles (prorrogables 8), conforme a los artículos 14 y 15 de la Ley 1581.</p>

    <h3>7. Encargados y transmisión internacional</h3>
    <p>Tus datos se almacenan y procesan con Google (Firebase), que actúa como Encargado y puede usar servidores fuera de Colombia. Al aceptar esta política autorizas dicha transmisión.</p>

    <h3>8. Seguridad y conservación</h3>
    <p>Usamos conexiones cifradas y reglas de acceso para que cada persona solo pueda leer y modificar su propio perfil. Conservamos tus datos mientras tu cuenta exista y los suprimimos cuando la eliminas.</p>
  </div>`,
  styles: [`.pol{padding:26px 18px 40px;color:var(--text);font-size:14px;line-height:1.5}
    .pol h2{margin:0 0 4px;font-weight:800}.pol h3{margin:18px 0 4px;font-size:15px;font-weight:800;color:var(--accent)}.pol p{margin:0}`]
})
export class PoliticaComponent { v = VERSION_POLITICA; r = { ...RESPONSABLE_DEFECTO, ...((environment as any).responsable ?? {}) }; }
