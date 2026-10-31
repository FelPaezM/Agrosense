import { Component, signal } from '@angular/core';
import { addIcons } from 'ionicons';
import { flash, flashOff, analytics, albums, notifications, hardwareChip, swapHorizontal, search, bluetooth, wifi, trendingUp, trendingDown, remove, sparkles, cloudUpload, bulb } from 'ionicons/icons';
import { MonitorService } from '../core/monitor.service';
import { TemaService } from '../core/tema.service';
import { Capacitor } from '@capacitor/core';
import { Router } from '@angular/router';
import { BleService, Dispositivo } from '../core/ble.service';
import { IaService } from '../core/ia.service';
import { barrasSenal } from '../core/ble-datos';
import { trazoSuave } from '../core/historial-util';
import { exito, toque } from '../core/haptico';

const LIQ: Record<string, { a: string; b: string }> = {
  seco: { a: '#ffc15e', b: '#ff6a2b' }, ok: { a: '#63f2cc', b: '#0fa88b' },
  alto: { a: '#86c5ff', b: '#2f63e6' }, nd: { a: '#d6ddec', b: '#9aa7c0' }
};
function mezclar(a: string, b: string, t: number) {
  const p = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return '#' + [1, 3, 5].map(i => Math.round(p(a, i) * (1 - t) + p(b, i) * t).toString(16).padStart(2, '0')).join('');
}

@Component({
  standalone: false,
  selector: 'app-panel',
  template: `
  <ion-content>
    <div class="hero"><small>{{ tema.saludo() }}</small><h1>Panel</h1>
      <p>{{ m.conectado() ? 'Conectado a ' + m.sensorId() : 'Sin sensor conectado' }}
        @if (m.conectado() && m.modo()) {
          <span class="via" [class.ble]="m.modo() === 'bluetooth'"><ion-icon [name]="m.modo() === 'bluetooth' ? 'bluetooth' : 'wifi'"></ion-icon>{{ m.modo() === 'bluetooth' ? 'Bluetooth directo' : 'Nube · Wi-Fi' }}</span>
        }</p></div>

    <div class="card dial">
      <div class="stage" (pointermove)="mover($event)" (pointerleave)="reset()">
        <div class="bob"><div class="tilt" [style.transform]="giro()">
          <div class="rw back"><div class="spin"><i></i></div></div>
          <div class="sphere" [class.off]="!m.lectura()" [style.--l1]="c().a" [style.--l2]="c().b" [style.--lvl]="nivel() + '%'">
            @if (nivel() > 0) {
              <div class="liquid">
                <svg class="wv" viewBox="0 0 400 20" preserveAspectRatio="none"><path d="M0 10 Q50 0 100 10 T200 10 T300 10 T400 10 V20 H0Z" fill="currentColor"/></svg>
                <svg class="wv b" viewBox="0 0 400 20" preserveAspectRatio="none"><path d="M0 10 Q50 0 100 10 T200 10 T300 10 T400 10 V20 H0Z" fill="currentColor"/></svg>
              </div>
            }
            <div class="gloss"></div>
            <div class="read"><b>{{ m.lectura() ? m.lectura()!.humedad : '--' }}</b><small>% humedad</small></div>
          </div>
          <div class="rw front"><div class="spin"><i></i></div></div>
        </div></div>
        <div class="podium"></div>
      </div>
      <div class="chips">
        @if (m.lectura()) {
          <span class="pill" [style.background]="est().color">{{ est().txt }}</span>
          <span class="pill sig" [class.bad]="!m.senal()!.ok">{{ m.senal()!.txt }}</span>
          @if (m.tendencia(); as t) {
            <span class="pill tend" [class.up]="t.dir === 'sube'" [class.down]="t.dir === 'baja'">
              <ion-icon [name]="t.dir === 'sube' ? 'trending-up' : t.dir === 'baja' ? 'trending-down' : 'remove'"></ion-icon>
              {{ t.dir === 'estable' ? 'Estable' : (t.delta > 0 ? '+' : '') + t.delta + '%' }} · {{ t.minutos }} min
            </span>
          }
        } @else {
          <span class="muted">{{ m.conectado() ? 'Esperando lecturas de ' + m.sensorId() + '…' : 'Conecta tu ESP32 para ver la humedad' }}</span>
        }
      </div>
      @if (m.lectura()) { <p class="muted fecha">Última lectura · {{ m.lectura()!.fecha | date:'d MMM, h:mm:ss a' }}</p> }
      @if (trazo(); as z) {
        <svg class="spark" viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" [attr.stop-color]="est().color" stop-opacity=".45"/><stop offset="1" [attr.stop-color]="est().color" stop-opacity="0"/></linearGradient></defs>
          <path [attr.d]="z + ' L300,56 L0,56 Z'" fill="url(#sg)"/>
          <path [attr.d]="z" fill="none" [attr.stroke]="est().color" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      }
    </div>

    <div appTilt class="card">
      <h3>Sensor ESP32</h3>
      <p class="muted">{{ m.conectado() ? (m.modo() === 'bluetooth' ? 'Lectura en vivo directo del sensor, sin necesidad de internet.' : 'Monitoreo con lo que el sensor sube a la nube por Wi-Fi.') : 'Elige tu sensor para empezar el monitoreo en tiempo real.' }}</p>
      @if (m.conectado() && m.modo() === 'bluetooth' && m.infoSensor(); as i) {
        <div class="datos">
          <span [class.ok]="i.wifi"><ion-icon name="wifi"></ion-icon>{{ i.wifi ? 'Wi-Fi del sensor conectado' + (i.rssiWifi ? ' · ' + i.rssiWifi + ' dBm' : '') : 'Sensor sin Wi-Fi (solo Bluetooth)' }}</span>
          @if (i.wifi) { <span [class.ok]="!i.pendientes"><ion-icon name="cloud-upload"></ion-icon>{{ i.pendientes ? i.pendientes + ' lecturas por subir a la nube' : 'Nube al día' }}</span> }
        </div>
      }
      @if (m.error() && !abierto()) { <p style="color:var(--danger)">{{ m.error() }}</p> }
      @if (!m.conectado()) {
        <ion-button expand="block" (click)="abrir()" [disabled]="m.cargando()">
          @if (m.cargando()) { <ion-spinner name="dots"></ion-spinner> } @else { <ion-icon slot="start" name="flash"></ion-icon>Conectar sensor }
        </ion-button>
      } @else {
        <div class="duo">
          <ion-button fill="outline" color="medium" (click)="abrir()"><ion-icon slot="start" name="swap-horizontal"></ion-icon>Cambiar</ion-button>
          <ion-button color="medium" (click)="m.desconectar()"><ion-icon slot="start" name="flash-off"></ion-icon>Desconectar</ion-button>
        </div>
      }
    </div>

    <button appTilt class="card consejo" (click)="preguntar()">
      <span class="gem" [style.--g]="consejo().color"><ion-icon name="bulb"></ion-icon></span>
      <span class="txt"><strong>{{ consejo().titulo }}</strong><span class="muted">{{ consejo().texto }}</span>
        <span class="ia"><ion-icon name="sparkles"></ion-icon>Preguntar al asistente</span></span>
    </button>

    <div class="tiles">
      <div appTilt class="tile"><span class="gem" style="--g:#8e6cf0"><ion-icon name="analytics"></ion-icon></span><strong>{{ m.lectura() && m.promedio() !== null ? m.promedio() + '%' : '--' }}</strong><span class="muted">Promedio</span></div>
      <div appTilt class="tile"><span class="gem" style="--g:#3b9be8"><ion-icon name="albums"></ion-icon></span><strong>{{ m.conectado() ? m.historial().length : '--' }}</strong><span class="muted">Registros</span></div>
      <div appTilt class="tile"><span class="gem" style="--g:#f08a2b"><ion-icon name="notifications"></ion-icon></span><strong>{{ m.alertas().length }}</strong><span class="muted">Alertas</span></div>
    </div>
  </ion-content>

  <ion-modal [isOpen]="abierto()" (didDismiss)="abierto.set(false)" [initialBreakpoint]="0.85" [breakpoints]="[0, 0.85, 1]">
    <ng-template>
      <ion-content>
        <div class="sheet">
          <h2>Conectar sensor</h2>
          <p class="muted">Elige cómo quieres leer tu ESP32.</p>
          <ion-segment [value]="via()" (ionChange)="cambiarVia($any($event.detail.value))">
            <ion-segment-button value="ble"><ion-label>Bluetooth</ion-label></ion-segment-button>
            <ion-segment-button value="nube"><ion-label>Wi-Fi / nube</ion-label></ion-segment-button>
          </ion-segment>

          @if (m.ultimo()) {
            <button appTilt class="sensor" (click)="reconectar()">
              <span class="gem" style="--g:#8e6cf0"><ion-icon name="flash"></ion-icon></span>
              <span class="info"><b>{{ m.ultimo() }}</b><small>Último sensor · toca para reconectar{{ m.ultimoBle() ? ' por Bluetooth' : '' }}</small></span>
            </button>
            <ion-button fill="clear" size="small" color="medium" (click)="m.olvidarSensor()">Olvidar este sensor</ion-button>
          }

          @if (via() === 'ble') {
            <p class="muted ayuda">Lee la humedad <b>en vivo, sin internet</b>. Enciende el ESP32 y acércalo; se anuncia como «ESP32_…». No hay que emparejarlo en Ajustes.</p>
            @if (!ble.disponible) {
              <p class="muted">Este navegador no admite Bluetooth. Usa la app instalada en el teléfono o Chrome.</p>
            } @else {
              <ion-button expand="block" fill="outline" (click)="ble.buscar()" [disabled]="ble.buscando()">
                @if (ble.buscando()) { <ion-spinner name="dots"></ion-spinner> } @else { <ion-icon slot="start" name="bluetooth"></ion-icon>{{ ble.intento() ? 'Buscar de nuevo' : 'Buscar sensores cercanos' }} }
              </ion-button>
            }
            @for (d of ble.dispositivos(); track d.id) {
              <button appTilt class="sensor" (click)="elegirBle(d)">
                <span class="gem" style="--g:#19b5c9"><ion-icon name="hardware-chip"></ion-icon></span>
                <span class="info"><b>{{ d.nombre }}</b><small>Sensor cercano · toca para conectar</small></span>
                <span class="barras" [attr.data-n]="barras(d)"><i></i><i></i><i></i><i></i></span>
              </button>
            }
            @if (ble.mensaje()) { <p style="color:var(--danger)">{{ ble.mensaje() }}</p> }
            @if (ble.intento() && !ble.buscando() && !ble.dispositivos().length && !ble.mensaje()) {
              <p class="muted">No se encontró ningún sensor. Comprueba que el ESP32 esté encendido (el Monitor Serie debe decir «[BLE] Anunciándose»), que el Bluetooth del teléfono esté activo y que la app tenga el permiso «Dispositivos cercanos».</p>
            }
          } @else {
            <p class="muted ayuda">Usa lo que el sensor <b>sube a Firebase por Wi-Fi</b>. Sirve desde cualquier lugar con internet.</p>
            <div class="manual">
              <ion-input label="ID de tu sensor (ej. ESP32_A1B2C3)" labelPlacement="floating" fill="outline" [(ngModel)]="manual"></ion-input>
              <ion-button expand="block" (click)="elegir(manual)" [disabled]="!manual.trim()">Conectar con este ID</ion-button>
            </div>
          }
          @if (m.error()) { <p style="color:var(--danger)">{{ m.error() }}</p> }
        </div>
      </ion-content>
    </ng-template>
  </ion-modal>`,
  styles: [`
    .dial{padding:10px 10px 18px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.14),transparent 60%),var(--card)}
    .stage{height:310px;display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:pan-y}
    .bob{perspective:900px;animation:bob 5s ease-in-out infinite}
    .tilt{position:relative;width:216px;height:216px;transition:transform .18s ease-out}
    .sphere{position:absolute;inset:0;border-radius:50%;overflow:hidden;transition:opacity .6s;
      background:radial-gradient(circle at 30% 22%,rgba(255,255,255,.7),rgba(255,255,255,.14) 38%,rgba(15,25,80,.3) 100%);
      box-shadow:inset 0 -22px 44px rgba(10,20,70,.35),inset 0 10px 24px rgba(255,255,255,.35),0 26px 50px rgba(0,0,0,.28)}
    .sphere.off{opacity:.8}
    .liquid{position:absolute;left:0;right:0;bottom:0;height:var(--lvl);background:linear-gradient(180deg,var(--l1),var(--l2));transition:height 1.1s cubic-bezier(.3,1.4,.5,1)}
    .wv{position:absolute;left:0;bottom:100%;width:200%;height:16px;margin-bottom:-2px;color:var(--l1);animation:wave 5s linear infinite}
    .wv.b{margin-bottom:-6px;opacity:.55;animation-duration:8s;animation-direction:reverse}
    .gloss{position:absolute;left:14%;top:8%;width:42%;height:24%;border-radius:50%;background:linear-gradient(180deg,rgba(255,255,255,.75),transparent);transform:rotate(-24deg);filter:blur(1px)}
    .read{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-shadow:0 3px 12px rgba(0,0,0,.45)}
    .read b{font-size:64px;line-height:1;font-weight:800}.read small{font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:800}
    .rw{position:absolute;inset:-32px;border-radius:50%;border:2.5px solid var(--accent2);transform:rotateX(74deg);pointer-events:none}
    .rw.back{clip-path:inset(-24px -24px 50% -24px);opacity:.5}.rw.front{clip-path:inset(50% -24px -24px -24px)}
    .spin{position:absolute;inset:-2.5px;animation:orbit 6s linear infinite}
    .spin i{position:absolute;top:-8px;left:50%;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:var(--accent2);box-shadow:0 0 14px 3px var(--accent2)}
    /* pedestal con los colores de la colina del fondo */
    .podium{width:250px;height:38px;margin-top:10px;border-radius:50%;position:relative;
      background:radial-gradient(ellipse at 50% 30%,var(--accent),var(--land1) 72%);
      box-shadow:0 11px 0 -2px var(--land2),0 26px 34px rgba(0,0,0,.35),0 0 40px -6px var(--accent);animation:sh 5s ease-in-out infinite}
    .chips{display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 8px 0;text-align:center}
    .pill.sig{background:rgba(0,0,0,.3)}.pill.sig::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#19c9a0;margin-right:7px;box-shadow:0 0 8px #19c9a0}
    .pill.sig.bad::before{background:#ff8a3d;box-shadow:0 0 8px #ff8a3d}
    .fecha{text-align:center;margin:8px 0 0}
    .spark{display:block;width:calc(100% - 20px);height:56px;margin:12px 10px 0;overflow:visible}
    .via{display:inline-flex;align-items:center;gap:5px;margin-left:8px;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:800;background:rgba(128,128,128,.2);color:var(--text)}
    .via.ble{background:rgba(25,181,201,.22);color:var(--accent)}
    .pill.tend{background:rgba(128,128,128,.55)}.pill.tend.up{background:#2f8f6f}.pill.tend.down{background:#c77a2e}
    .pill ion-icon{vertical-align:-2px;margin-right:3px}
    .datos{display:flex;flex-direction:column;gap:6px;margin:10px 0 12px;font-size:13px;color:var(--muted);font-weight:700}
    .datos span{display:flex;align-items:center;gap:8px}.datos .ok{color:#19a583}
    .consejo{display:flex;gap:14px;align-items:center;width:calc(100% - 32px);text-align:left;font:inherit}
    .consejo .gem{flex:none}.consejo .txt{display:flex;flex-direction:column;gap:3px}.consejo strong{font-size:15px}
    .consejo .ia{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;font-weight:800;color:var(--accent)}
    .ayuda{margin:14px 0 10px}
    .barras{display:flex;align-items:flex-end;gap:3px;height:20px}.barras i{width:5px;border-radius:2px;background:rgba(128,128,128,.35)}
    .barras i:nth-child(1){height:6px}.barras i:nth-child(2){height:10px}.barras i:nth-child(3){height:15px}.barras i:nth-child(4){height:20px}
    .barras[data-n="1"] i:nth-child(-n+1),.barras[data-n="2"] i:nth-child(-n+2),.barras[data-n="3"] i:nth-child(-n+3),.barras[data-n="4"] i{background:#19c9a0}
    .duo{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .sheet{padding:26px 18px 40px;color:var(--text)}.sheet h2{margin:0 0 4px;font-weight:800}
    .scan{display:flex;align-items:center;gap:10px;color:var(--muted);padding:10px 0}
    .sensor{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px;margin:10px 0;border:1px solid var(--border);
      border-radius:22px;background:var(--card);color:var(--text);font:inherit;backdrop-filter:blur(14px);box-shadow:var(--shadow)}
    .info{flex:1;display:flex;flex-direction:column}.info small{color:var(--muted)}
    .dotst{width:12px;height:12px;border-radius:50%;background:#ff8a3d}.dotst.on{background:#19c9a0;box-shadow:0 0 10px #19c9a0}
    .manual{display:flex;flex-direction:column;gap:12px;margin-top:14px}
    @keyframes bob{50%{transform:translateY(-10px)}}@keyframes sh{50%{transform:scale(.94)}}
    @keyframes wave{to{transform:translateX(-50%)}}@keyframes orbit{to{transform:rotate(360deg)}}
  `]
})
export class PanelPage {
  rx = signal(0); ry = signal(0); abierto = signal(false);
  via = signal<'ble' | 'nube'>('nube');
  manual = ''; nativo = Capacitor.isNativePlatform();
  constructor(public tema: TemaService, public m: MonitorService, public ble: BleService, private ia: IaService, private router: Router) {
    addIcons({ flash, flashOff, analytics, albums, notifications, hardwareChip, swapHorizontal, search, bluetooth, wifi, trendingUp, trendingDown, remove, sparkles, cloudUpload, bulb });
    if (this.ble.disponible) this.via.set('ble');
  }
  abrir() { this.abierto.set(true); if (this.via() === 'ble' && this.nativo) this.ble.buscar(); }
  cambiarVia(v: 'ble' | 'nube') { this.via.set(v); if (v === 'ble' && this.nativo && !this.ble.buscando() && !this.ble.dispositivos().length) this.ble.buscar(); }
  /** Wi-Fi / nube */
  async elegir(id: string) { this.abierto.set(false); await this.m.conectar(id); }
  /** Bluetooth directo */
  async elegirBle(d: Dispositivo) { this.abierto.set(false); toque(); if (await this.m.conectarBle(d.id, d.nombre)) exito(); }
  async reconectar() {
    const b = this.m.ultimoBle();
    if (b && this.via() === 'ble') { this.abierto.set(false); toque(); if (await this.m.conectarBle(b.id, b.nombre)) exito(); }
    else await this.elegir(this.m.ultimo());
  }
  barras(d: Dispositivo) { return barrasSenal(d.rssi); }
  /** Curva de las últimas lecturas para la tarjeta principal */
  trazo() {
    if (!this.m.conectado()) return '';
    const h = this.m.historial().slice(0, 24).reverse();
    if (h.length < 3) return '';
    const pts = h.map((x, i) => ({ x: (i / (h.length - 1)) * 300, y: 52 - Math.max(0, Math.min(100, x.humedad)) / 100 * 48 }));
    return trazoSuave(pts);
  }
  consejo() {
    const h = this.m.lectura()?.humedad; const t = this.m.tendencia();
    if (h == null) return { titulo: 'Conecta tu sensor', texto: 'Por Bluetooth lees la humedad en vivo sin internet; por Wi-Fi ves el historial desde cualquier lugar.', color: '#8e6cf0' };
    const cae = t && t.dir === 'baja' && t.delta <= -5 ? ' Además está bajando rápido.' : '';
    if (h < 40) return { titulo: 'Es momento de regar', texto: `El suelo está seco (${h}%). Riega de forma gradual, de preferencia temprano o al atardecer.${cae}`, color: '#ff8a3d' };
    if (h > 80) return { titulo: 'Evita regar por ahora', texto: `Hay exceso de humedad (${h}%). Revisa el drenaje para prevenir hongos y pudrición de raíz.`, color: '#3d8bff' };
    return { titulo: 'Todo en orden', texto: `Tu suelo está en un rango saludable (${h}%).${cae || ' No necesitas regar ahora.'}`, color: '#19c9a0' };
  }
  preguntar() {
    const h = this.m.lectura()?.humedad;
    this.ia.preguntaPendiente.set(h == null ? '¿Cómo conecto mi sensor por Bluetooth?' : '¿Debo regar ahora? Interpreta mi humedad actual.');
    this.router.navigateByUrl('/tabs/asistente');
  }
  est() { return this.m.estado(this.m.lectura()?.humedad); }
  nivel() { return Math.max(0, Math.min(100, this.m.lectura()?.humedad ?? 0)); }
  c() {
    const h = this.m.lectura()?.humedad; const b = LIQ[h == null ? 'nd' : h < 40 ? 'seco' : h > 80 ? 'alto' : 'ok'];
    const ac = this.tema.accent(); return { a: mezclar(b.a, ac, .2), b: mezclar(b.b, ac, .2) };
  }
  mover(e: PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.rx.set(((e.clientX - r.left) / r.width - .5) * 30); this.ry.set(((e.clientY - r.top) / r.height - .5) * -30);
  }
  reset() { this.rx.set(0); this.ry.set(0); }
  giro() { return `rotateY(${this.rx()}deg) rotateX(${this.ry()}deg)`; }
}
