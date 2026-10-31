import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { sparkles, send, trash, copy, refresh, leaf, flash, bluetooth, logIn } from 'ionicons/icons';
import { IaService, Mensaje } from '../core/ia.service';
import { MonitorService } from '../core/monitor.service';
import { TemaService } from '../core/tema.service';
import { formatear } from '../core/ia-formato';
import { toque } from '../core/haptico';

@Component({
  standalone: false,
  selector: 'app-asistente',
  template: `
  <ion-content>
    <div class="hero">
      <small>{{ tema.saludo() }}</small>
      <div class="fila">
        <h1>Asistente</h1>
        @if (ia.mensajes().length) {
          <button class="mini" (click)="borrar()" aria-label="Borrar conversación"><ion-icon name="trash"></ion-icon></button>
        }
      </div>
      <p>
        <span class="estado" [class.on]="ia.estado().ok && ia.conSesion" [class.basic]="!(ia.estado().ok && ia.conSesion)"></span>
        @if (!ia.configurada) { Modo básico · servidor de IA sin configurar }
        @else if (!ia.conSesion) { Modo básico · inicia sesión para la IA completa }
        @else if (!ia.estado().revisado) { Conectando con la IA… }
        @else if (ia.estado().ok) { IA activa · {{ ia.estado().modelos }} modelos de {{ ia.estado().proveedores }} proveedores }
        @else { Modo básico · IA no disponible ahora }
      </p>
    </div>

    @if (!ia.conSesion && ia.configurada) {
      <button class="card aviso" (click)="irPerfil()">
        <span class="gem" style="--g:#8e6cf0"><ion-icon name="log-in"></ion-icon></span>
        <span><strong>Activa la IA completa</strong><br><span class="muted">Inicia sesión en Perfil y tendrás un asistente con varios modelos de IA. Mientras tanto responde el modo básico.</span></span>
      </button>
    }

    <div class="chat">
      @if (!ia.mensajes().length) {
        <div class="card bienvenida">
          <span class="gem grande" style="--g:#19b5c9"><ion-icon name="sparkles"></ion-icon></span>
          <h3>Hola, soy AgroSense IA</h3>
          <p class="muted">Analizo la humedad real de tu sensor y te digo cuándo regar, qué significa cada cambio y cómo cuidar tu cultivo.</p>
          <div class="sug">
            @for (s of sugerencias(); track s) { <button class="chip" (click)="enviar(s)">{{ s }}</button> }
          </div>
        </div>
      }

      @for (x of ia.mensajes(); track x.id) {
        <div class="fila-msg" [class.yo]="x.rol === 'user'">
          @if (x.rol === 'assistant') { <span class="avatar"><ion-icon name="leaf"></ion-icon></span> }
          <div class="burbuja" [class.yo]="x.rol === 'user'">
            @if (x.rol === 'user') { {{ x.texto }} }
            @else { <div class="md" [innerHTML]="html(x)"></div> }
            @if (x.rol === 'assistant') {
              <div class="pie">
                @if (x.via === 'ia') { <span class="modelo"><ion-icon name="sparkles"></ion-icon>{{ x.modelo }} · {{ x.proveedor }}</span> }
                @else { <span class="modelo basico">Modo básico</span> }
                <span class="acciones">
                  <button (click)="copiar(x)" aria-label="Copiar"><ion-icon name="copy"></ion-icon></button>
                  @if (esUltima(x)) { <button (click)="repetir()" aria-label="Volver a preguntar"><ion-icon name="refresh"></ion-icon></button> }
                </span>
              </div>
              @if (x.aviso) { <div class="nota">{{ x.aviso }}</div> }
            }
          </div>
        </div>
      }

      @if (ia.enviando()) {
        <div class="fila-msg"><span class="avatar"><ion-icon name="leaf"></ion-icon></span>
          <div class="burbuja escribiendo"><i></i><i></i><i></i></div></div>
      }

      @if (ia.mensajes().length && !ia.enviando()) {
        <div class="sug sueltas">@for (s of sugerencias(); track s) { <button class="chip" (click)="enviar(s)">{{ s }}</button> }</div>
      }
    </div>
    <div #fin class="fin"></div>
  </ion-content>

  <div class="compositor" [class.kb]="teclado()">
    <textarea #caja rows="1" [(ngModel)]="texto" maxlength="600" placeholder="Pregunta sobre tu cultivo o tu sensor…"
      (focus)="foco(true)" (blur)="foco(false)" (input)="crecer()" (keydown.enter)="alEnter($event)"></textarea>
    <button class="enviar" (click)="enviar()" [disabled]="!texto.trim() || ia.enviando()" aria-label="Enviar">
      <ion-icon name="send"></ion-icon>
    </button>
  </div>`,
  styles: [`
    .hero .fila{display:flex;align-items:center;justify-content:space-between}
    .mini{width:40px;height:40px;border-radius:14px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:19px;display:grid;place-items:center;backdrop-filter:blur(14px)}
    .estado{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:7px;vertical-align:1px}
    .estado.on{background:#19c9a0;box-shadow:0 0 10px #19c9a0}.estado.basic{background:#ffb020;box-shadow:0 0 8px #ffb020}
    .aviso{display:flex;gap:14px;align-items:center;text-align:left;width:calc(100% - 32px);font:inherit}
    .aviso .gem{flex:none}
    .chat{padding:0 16px 190px;display:flex;flex-direction:column;gap:12px}
    .bienvenida{margin:6px 0;text-align:center}
    .bienvenida h3{margin-top:12px;font-size:20px}
    .gem.grande{width:62px;height:62px;border-radius:22px;font-size:30px}.gem.grande ion-icon{font-size:32px}
    .sug{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:14px}
    .sug.sueltas{justify-content:flex-start;margin-top:4px}
    .chip{padding:9px 14px;border-radius:999px;border:1px solid var(--border);background:var(--card);color:var(--text);font:inherit;font-size:13px;font-weight:700;
      backdrop-filter:blur(14px);box-shadow:0 4px 14px rgba(0,0,0,.12);transition:transform .15s}
    .chip:active{transform:scale(.95)}
    .fila-msg{display:flex;gap:9px;align-items:flex-end;animation:rise .35s cubic-bezier(.2,.8,.2,1) backwards}
    .fila-msg.yo{justify-content:flex-end}
    .avatar{flex:none;width:32px;height:32px;border-radius:12px;display:grid;place-items:center;color:#fff;font-size:17px;
      background:linear-gradient(145deg,rgba(255,255,255,.45),transparent 50%),linear-gradient(135deg,var(--accent),var(--accent2));box-shadow:0 6px 14px rgba(0,0,0,.25)}
    .burbuja{max-width:min(86%,520px);padding:12px 15px;border-radius:20px 20px 20px 6px;background:var(--card);border:1px solid var(--border);color:var(--text);
      backdrop-filter:blur(16px) saturate(1.4);box-shadow:var(--shadow);font-size:14.5px;line-height:1.5;word-break:break-word}
    .burbuja.yo{border-radius:20px 20px 6px 20px;border:0;color:#fff;white-space:pre-wrap;
      background:linear-gradient(145deg,rgba(255,255,255,.28),transparent 55%),linear-gradient(135deg,var(--accent),var(--accent2))}
    .md :first-child{margin-top:0}.md :last-child{margin-bottom:0}
    .md p{margin:6px 0}.md p.t{font-weight:800;margin-top:10px}.md ul,.md ol{margin:6px 0;padding-left:20px}.md li{margin:3px 0}
    .md code{background:rgba(128,128,128,.22);padding:1px 6px;border-radius:6px;font-size:.92em}
    .pie{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:9px;padding-top:8px;border-top:1px solid rgba(128,150,136,.22)}
    .modelo{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;color:var(--muted);letter-spacing:.2px}
    .modelo ion-icon{color:var(--accent)}.modelo.basico{opacity:.85}
    .acciones{display:flex;gap:2px}.acciones button{background:none;border:0;color:var(--muted);font-size:17px;padding:4px 7px;border-radius:10px}
    .acciones button:active{background:rgba(128,128,128,.2)}
    .nota{margin-top:6px;font-size:11.5px;color:var(--muted);font-style:italic}
    .escribiendo{display:flex;gap:5px;padding:15px 18px}
    .escribiendo i{width:8px;height:8px;border-radius:50%;background:var(--muted);animation:pto 1.2s infinite ease-in-out}
    .escribiendo i:nth-child(2){animation-delay:.18s}.escribiendo i:nth-child(3){animation-delay:.36s}
    .compositor{position:fixed;left:14px;right:14px;bottom:calc(86px + env(safe-area-inset-bottom,0px));z-index:20;display:flex;align-items:flex-end;gap:8px;padding:8px 8px 8px 16px;
      border-radius:28px;background:var(--tabbg);border:1px solid var(--border);backdrop-filter:blur(20px) saturate(1.5);-webkit-backdrop-filter:blur(20px);box-shadow:var(--shadow)}
    .compositor.kb{bottom:calc(10px + env(safe-area-inset-bottom,0px))}
    textarea{flex:1;border:0;outline:0;resize:none;background:transparent;color:var(--text);font:inherit;font-size:15px;line-height:1.4;max-height:120px;padding:9px 0}
    textarea::placeholder{color:var(--muted)}
    .enviar{flex:none;width:44px;height:44px;border-radius:16px;border:0;color:#fff;font-size:20px;display:grid;place-items:center;
      background:linear-gradient(145deg,rgba(255,255,255,.45),transparent 50%),linear-gradient(135deg,var(--accent),var(--accent2));
      box-shadow:inset 0 2px 3px rgba(255,255,255,.5),0 8px 16px rgba(0,0,0,.25);transition:transform .15s,opacity .2s}
    .enviar:active{transform:scale(.92)}.enviar:disabled{opacity:.4}
    @keyframes pto{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-6px);opacity:1}}
    @keyframes rise{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.fila-msg,.escribiendo i{animation:none}}
  `]
})
export class AsistentePage {
  texto = '';
  teclado = signal(false);
  @ViewChild('fin') fin?: ElementRef<HTMLElement>;
  @ViewChild('caja') caja?: ElementRef<HTMLTextAreaElement>;
  private cache = new Map<string, string>();

  constructor(public ia: IaService, public tema: TemaService, private m: MonitorService, private router: Router) {
    addIcons({ sparkles, send, trash, copy, refresh, leaf, flash, bluetooth, logIn });
  }

  /** Ionic llama esto cada vez que se abre la pestaña */
  async ionViewWillEnter() {
    await this.ia.asegurarCarga();
    this.ia.revisarEstado();
    const p = this.ia.preguntaPendiente();
    if (p) { this.ia.preguntaPendiente.set(''); this.enviar(p); } else this.bajar();
  }
  ionViewWillLeave() { this.foco(false); }
  /** Con el teclado abierto se oculta la barra de pestañas y el compositor baja al borde */
  foco(abierto: boolean) { this.teclado.set(abierto); document.body.classList.toggle('kb-open', abierto); }

  sugerencias() { return this.ia.sugerencias(); }
  html(x: Mensaje) {
    let h = this.cache.get(x.id);
    if (h === undefined) { h = formatear(x.texto); this.cache.set(x.id, h); }
    return h;
  }
  esUltima(x: Mensaje) { const l = this.ia.mensajes(); return l.length > 0 && l[l.length - 1].id === x.id; }

  async enviar(t?: string) {
    const q = (t ?? this.texto).trim(); if (!q || this.ia.enviando()) return;
    this.texto = ''; this.crecer(); toque();
    const p = this.ia.enviar(q);
    this.bajar(); await p; this.bajar();
  }
  alEnter(e: Event) { const k = e as KeyboardEvent; if (!k.shiftKey) { e.preventDefault(); this.enviar(); } }

  async repetir() {
    const l = this.ia.mensajes();
    const i = l.map(x => x.rol).lastIndexOf('user'); if (i < 0) return;
    const u = l[i];
    this.ia.mensajes.set(l.slice(0, i));   // quita la pregunta y su respuesta, y vuelve a preguntar
    await this.enviar(u.texto);
  }

  async copiar(x: Mensaje) {
    try { await navigator.clipboard.writeText(x.texto); toque(); } catch { /* sin permiso de portapapeles */ }
  }
  async borrar() { await this.ia.borrar(); }
  irPerfil() { this.router.navigateByUrl('/tabs/perfil'); }

  crecer() {
    const t = this.caja?.nativeElement; if (!t) return;
    t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px';
  }
  private bajar() { setTimeout(() => this.fin?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60); }
}
