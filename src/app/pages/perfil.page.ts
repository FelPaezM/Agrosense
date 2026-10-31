import { Component, signal } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { AuthService, mensajeFirestore } from '../core/auth.service';
import { MonitorService } from '../core/monitor.service';
import { TemaService } from '../core/tema.service';

@Component({
  standalone: false,
  selector: 'app-perfil',
  template: `
  <ion-content>
    <div class="hero"><small>{{ tema.saludo() }}</small><h1>Perfil</h1><p>Tu cuenta y recomendaciones</p></div>

    @if (a.user(); as u) {
      <div class="card" style="text-align:center">
        <div class="avatar">{{ (a.perfil()?.nombre || u.displayName || u.email || '?').charAt(0).toUpperCase() }}</div>
        <h3>{{ a.perfil()?.nombre || u.displayName }}</h3>
        <p class="muted">{{ u.email }}<br>Cultivo: {{ a.perfil()?.cultivo || 'No indicado' }}</p>
        <ion-button fill="outline" color="medium" (click)="a.logout()">Cerrar sesión</ion-button>
      </div>

      @if (!a.cargandoPerfil() && necesita()) {
        <div class="card"><h3>Completa tu perfil</h3>
          <p class="muted">¿Qué cultivas? Lo usamos para darte mejores recomendaciones.</p>
          @if (a.errorPerfil()) { <p style="color:#ff6b6b;font-size:12px;font-weight:700">{{ a.errorPerfil() }}</p> }
          <div class="form" style="margin-top:12px">
            <ion-input label="Cultivo (ej. tomate)" labelPlacement="floating" fill="outline" [(ngModel)]="cultivo"></ion-input>
            @if (!a.perfil()?.consentimiento) {
              <ion-checkbox labelPlacement="end" justify="start" [checked]="acepto()" (ionChange)="acepto.set($event.detail.checked)">
                <span class="chk">Soy mayor de edad y autorizo el tratamiento de mis datos personales (Ley 1581 de 2012).</span>
              </ion-checkbox>
              <a class="link" (click)="verPolitica.set(true)">Leer la Política de Tratamiento de Datos</a>
            }
            <ion-button expand="block" (click)="completar()" [disabled]="!puedeCompletar()">Guardar y continuar</ion-button>
            @if (!a.perfil()?.consentimiento) {
              <ion-button fill="clear" color="medium" size="small" (click)="noAcepto()">No acepto (eliminar mi cuenta)</ion-button>
            }
          </div>
        </div>
      } @else if (!a.cargandoPerfil()) {
        <div class="card"><h3>Recomendaciones</h3>
          @for (r of recomendaciones(); track r) { <p>• {{ r }}</p> }
        </div>
      }

      <div class="card"><h3>Mis datos y privacidad</h3>
        <p class="muted">Tus datos se tratan conforme a la Ley 1581 de 2012. Puedes consultarlos, copiarlos y eliminarlos.</p>
        <div class="form" style="margin-top:12px">
          <ion-button fill="outline" (click)="verPolitica.set(true)">Política de tratamiento de datos</ion-button>
          <ion-button fill="outline" (click)="abrirDatos()">Ver y copiar mis datos</ion-button>
          <ion-button fill="clear" color="danger" (click)="eliminar()">Revocar autorización y eliminar mi cuenta</ion-button>
        </div>
      </div>
    } @else {
      <div class="card">
        <ion-segment [value]="modo()" (ionChange)="modo.set($any($event.detail.value))">
          <ion-segment-button value="login"><ion-label>Iniciar sesión</ion-label></ion-segment-button>
          <ion-segment-button value="registro"><ion-label>Crear perfil</ion-label></ion-segment-button>
        </ion-segment>
        <div class="form">
          @if (modo() === 'registro') {
            <ion-input label="Nombre" labelPlacement="floating" fill="outline" [(ngModel)]="nombre"></ion-input>
            <ion-input label="Cultivo (ej. tomate)" labelPlacement="floating" fill="outline" [(ngModel)]="cultivo"></ion-input>
          }
          <ion-input label="Correo" type="email" labelPlacement="floating" fill="outline" [(ngModel)]="email"></ion-input>
          <ion-input label="Contraseña" type="password" labelPlacement="floating" fill="outline" [(ngModel)]="pass"></ion-input>
          @if (modo() === 'registro') {
            <ion-checkbox labelPlacement="end" justify="start" [checked]="acepto()" (ionChange)="acepto.set($event.detail.checked)">
              <span class="chk">Soy mayor de edad y autorizo el tratamiento de mis datos personales (Ley 1581 de 2012).</span>
            </ion-checkbox>
            <a class="link" (click)="verPolitica.set(true)">Leer la Política de Tratamiento de Datos</a>
          } @else {
            <ion-button fill="clear" size="small" style="margin:0;align-self:flex-end;font-weight:800" (click)="olvide()">¿Olvidaste tu contraseña?</ion-button>
          }
          <ion-button expand="block" (click)="enviar()" [disabled]="ocupado() || (modo() === 'registro' && !acepto())">{{ modo() === 'login' ? 'Entrar' : 'Crear cuenta' }}</ion-button>
          <p class="muted" style="text-align:center;margin:0">o</p>
          <ion-button expand="block" fill="outline" (click)="google()" [disabled]="ocupado()">Continuar con Google</ion-button>
          <p class="muted" style="text-align:center;margin:0;font-size:12px">Con Google te pediremos tu autorización de datos al entrar.</p>
        </div>
      </div>
    }
  </ion-content>

  <ion-modal [isOpen]="verPolitica()" (didDismiss)="verPolitica.set(false)" [initialBreakpoint]="0.9" [breakpoints]="[0, 0.9, 1]">
    <ng-template><ion-content><app-politica></app-politica></ion-content></ng-template>
  </ion-modal>

  <ion-modal [isOpen]="datosAbierto()" (didDismiss)="datosAbierto.set(false)" [initialBreakpoint]="0.7" [breakpoints]="[0, 0.7, 1]">
    <ng-template>
      <ion-content>
        <div class="sheet">
          <h2>Mis datos</h2>
          <p class="muted">Esta es la información personal que guardamos de ti.</p>
          <pre>{{ datosJson() }}</pre>
          <ion-button expand="block" (click)="copiar()">Copiar</ion-button>
        </div>
      </ion-content>
    </ng-template>
  </ion-modal>`,
  styles: [`.form{display:flex;flex-direction:column;gap:14px;margin-top:18px}
    .avatar{width:78px;height:78px;border-radius:50%;margin:0 auto 10px;display:grid;place-items:center;font-size:32px;font-weight:800;color:#fff;
      background:linear-gradient(145deg,rgba(255,255,255,.45),transparent 50%),linear-gradient(135deg,var(--accent),var(--accent2));
      box-shadow:inset 0 3px 5px rgba(255,255,255,.5),inset 0 -6px 12px rgba(0,0,0,.25),0 12px 24px rgba(0,0,0,.25)}
    .link{color:var(--accent);font-weight:800;text-decoration:underline;cursor:pointer;font-size:13px}
    ion-checkbox{--size:22px;color:var(--text);align-items:flex-start}.chk{font-size:13px;line-height:1.35;white-space:normal;display:block}
    .sheet{padding:26px 18px 40px;color:var(--text)}.sheet h2{margin:0 0 4px;font-weight:800}
    pre{background:rgba(128,128,128,.14);border-radius:16px;padding:14px;font-size:12px;white-space:pre-wrap;word-break:break-all;max-height:42vh;overflow:auto}`]
})
export class PerfilPage {
  modo = signal<'login' | 'registro'>('login'); ocupado = signal(false); acepto = signal(false);
  verPolitica = signal(false); datosAbierto = signal(false); datosJson = signal('');
  nombre = ''; cultivo = ''; email = ''; pass = '';
  constructor(public tema: TemaService, public a: AuthService, private m: MonitorService,
              private toast: ToastController, private alerts: AlertController) {}

  private async aviso(message: string, color = 'dark', duration = 3500) { (await this.toast.create({ message, duration, color })).present(); }
  necesita() { return !this.a.perfil()?.consentimiento || !this.a.perfil()?.cultivo; }
  puedeCompletar() { return (!!this.cultivo.trim() || !!this.a.perfil()?.cultivo) && (!!this.a.perfil()?.consentimiento || this.acepto()); }

  async enviar() {
    this.ocupado.set(true);
    try {
      if (this.modo() === 'login') await this.a.login(this.email, this.pass);
      else await this.a.registrar(this.nombre, this.cultivo, this.email, this.pass);
    } catch (e: any) {
      const msg: Record<string, string> = { 'auth/invalid-credential': 'Correo o contraseña incorrectos', 'auth/email-already-in-use': 'Ese correo ya está registrado',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres', 'auth/invalid-email': 'Correo inválido',
        'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos', 'auth/operation-not-allowed': 'Activa Correo/Contraseña en Firebase Authentication',
        'permission-denied': 'Tu cuenta se creó, pero Firestore rechazó guardar el perfil. Completa tu perfil en la pantalla siguiente; si persiste, revisa reglas y App Check en Firebase.' };
      await this.aviso(msg[e.code] ?? 'Error: ' + e.code, 'danger');
    }
    this.ocupado.set(false);
  }

  async google() {
    this.ocupado.set(true);
    try { await this.a.loginGoogle(); }
    catch (e: any) {
      const txt = String(e?.code ?? '') + ' ' + String(e?.message ?? '');
      if (/popup-closed|cancelled-popup|cancel|SIGN_IN_CANCELED|12501|-5/i.test(txt)) { this.ocupado.set(false); return; }
      let m = 'No se pudo entrar con Google: ' + (e?.code ?? e?.message ?? 'error');
      if (/UNIMPLEMENTED|not implemented/i.test(txt))
        m = 'El plugin de Google no está instalado en esta app de Android. Ejecuta «npx cap sync android» y vuelve a compilar desde Android Studio.';
      else if (/DEVELOPER_ERROR|\b10\b|12500|12501|no credential/i.test(txt))
        m = 'Google rechazó la configuración. Agrega el SHA-1 y SHA-256 en Firebase, descarga de nuevo google-services.json y recompila.';
      else if (/network/i.test(txt)) m = 'Sin conexión a internet. Inténtalo de nuevo.';
      else if (/auth\/operation-not-allowed/.test(txt)) m = 'Activa el proveedor Google en Firebase → Authentication → Método de acceso.';
      await this.aviso(m, 'danger', 7000);
    }
    this.ocupado.set(false);
  }

  /** Recuperar contraseña: pide el correo en un diálogo (rellenado si ya lo escribió) y envía el enlace */
  async olvide() {
    const al = await this.alerts.create({
      header: 'Recuperar contraseña',
      message: 'Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.',
      inputs: [{ name: 'email', type: 'email', placeholder: 'tucorreo@ejemplo.com', value: this.email.trim() }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Enviar enlace', handler: (d: any) => { this.enviarRecuperacion(String(d?.email ?? '')); return true; } }
      ]
    });
    await al.present();
  }

  private async enviarRecuperacion(correo: string) {
    const em = correo.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { await this.aviso('Escribe un correo válido', 'warning'); return; }
    this.email = em;
    this.ocupado.set(true);
    try {
      await this.a.recuperar(em);
      await this.aviso('Listo. Si ese correo tiene una cuenta con contraseña, recibirás un enlace en unos minutos. Revisa también spam o correo no deseado.', 'success', 8000);
    } catch (e: any) {
      const c = e?.code;
      if (c === 'auth/invalid-email') await this.aviso('Correo inválido', 'danger');
      else if (c === 'auth/too-many-requests') await this.aviso('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.', 'danger', 5000);
      else if (c === 'auth/network-request-failed') await this.aviso('Sin conexión a internet. Inténtalo de nuevo.', 'danger');
      else if (c === 'auth/user-not-found') await this.aviso('Si ese correo tiene una cuenta con contraseña, recibirás un enlace en unos minutos.', 'success', 6000);
      else await this.aviso('No se pudo enviar el enlace: ' + (c ?? 'error'), 'danger');
    }
    this.ocupado.set(false);
  }

  async completar() {
    try { await this.a.completarPerfil(this.cultivo.trim() || this.a.perfil()?.cultivo || '', !this.a.perfil()?.consentimiento); this.cultivo = ''; this.acepto.set(false); await this.aviso('Perfil guardado', 'success', 2000); }
    catch (e: any) { await this.aviso(mensajeFirestore(e), 'danger', 7000); }
  }

  async noAcepto() { try { await this.a.eliminarCuenta(); } catch { await this.a.logout(); } }

  abrirDatos() { this.datosJson.set(this.a.exportar()); this.datosAbierto.set(true); }
  async copiar() {
    try { await navigator.clipboard.writeText(this.datosJson()); await this.aviso('Datos copiados', 'success', 2000); }
    catch { await this.aviso('No se pudo copiar. Selecciona el texto y cópialo manualmente.', 'warning'); }
  }

  async eliminar() {
    const al = await this.alerts.create({ header: 'Eliminar cuenta y datos',
      message: 'Se eliminarán tu cuenta, tu perfil y los datos guardados en este dispositivo. Esta acción no se puede deshacer.',
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Eliminar', role: 'destructive', handler: () => { this.confirmarEliminar(); } }] });
    await al.present();
  }
  private async confirmarEliminar() {
    try { this.m.desconectar(); await this.a.eliminarCuenta(); await this.aviso('Tu cuenta y tus datos fueron eliminados', 'success'); }
    catch (e: any) {
      await this.aviso(e?.code === 'auth/requires-recent-login'
        ? 'Por seguridad, cierra sesión, vuelve a entrar y repite la eliminación.' : 'No se pudo eliminar: ' + (e?.code ?? 'error'), 'danger', 5000);
    }
  }

  recomendaciones(): string[] {
    const h = this.m.historial(); const p = this.m.promedio();
    if (!h.length) return ['Conecta tu sensor desde el Panel para recibir recomendaciones basadas en tu historial.'];
    const r: string[] = []; const sec = h.filter(x => x.humedad < 40).length, alta = h.filter(x => x.humedad > 80).length;
    if (p! < 40) r.push(`Tu humedad promedio es ${p}%: aumenta la frecuencia o duración del riego.`);
    else if (p! > 80) r.push(`Tu humedad promedio es ${p}%: reduce el riego y mejora el drenaje y la ventilación.`);
    else r.push(`Tu humedad promedio es ${p}%, dentro del rango óptimo (40–80%).`);
    if (sec / h.length > .3) r.push('Más del 30% de tus lecturas muestran suelo seco: considera riego programado.');
    if (alta / h.length > .3) r.push('Hay muchas lecturas con exceso de humedad: riesgo de hongos, ventila el invernadero.');
    const v = Math.max(...h.map(x => x.humedad)) - Math.min(...h.map(x => x.humedad));
    if (v > 40) r.push(`La humedad varía ${v} puntos entre lecturas: revisa que el riego sea uniforme.`);
    return r;
  }
}
