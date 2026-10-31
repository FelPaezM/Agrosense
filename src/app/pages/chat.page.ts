import { Component, ViewChild, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { send, trash } from 'ionicons/icons';
import { AuthService } from '../core/auth.service';
import { MonitorService } from '../core/monitor.service';
import { TemaService } from '../core/tema.service';
import { ChatService, MensajeChat, ModeloIA } from '../core/chat.service';

@Component({
  standalone: false,
  selector: 'app-chat',
  template: `
  <ion-content>
    <div class="hero"><small>{{ tema.saludo() }}</small><h1>AgroBot</h1><p>Tu asistente agrícola con IA</p></div>

    @if (!a.user()) {
      <div class="card"><h3>Inicia sesión</h3>
        <p class="muted">El asistente es solo para usuarios con cuenta.</p>
        <ion-button expand="block" (click)="irPerfil()">Ir a Perfil</ion-button></div>
    } @else if (!chat.configurado()) {
      <div class="card"><h3>Falta configurar el asistente</h3>
        <p class="muted">Pon la URL de tu Worker en <b>src/app/core/ai-config.ts</b>.</p></div>
    } @else {
      <div class="chips">
        <button class="chip" [class.on]="modelo() === 'auto'" (click)="modelo.set('auto')">Automático</button>
        @for (mo of modelos(); track mo.id) { <button class="chip" [class.on]="modelo() === mo.id" (click)="modelo.set(mo.id)">{{ mo.nombre }}</button> }
      </div>

      <div class="card chat">
        @if (!mensajes().length) {
          <p class="muted">Pregúntame sobre riego, humedad o tu cultivo. Uso los datos de tu sensor para responder.</p>
          <div class="chips" style="padding:0">
            @for (s of sugerencias; track s) { <button class="chip" (click)="enviar(s)">{{ s }}</button> }
          </div>
        }
        @for (x of mensajes(); track $index) {
          <div class="burbuja" [class.yo]="x.rol === 'user'">{{ x.texto }}@if (x.modelo) { <small>{{ x.modelo }}</small> }</div>
        }
        @if (pensando()) { <div class="burbuja"><ion-spinner name="dots"></ion-spinner></div> }
        @if (error()) { <p style="color:var(--danger);margin:0">{{ error() }}</p> }
      </div>

      <div class="card entrada">
        <ion-input placeholder="Escribe tu pregunta…" [(ngModel)]="texto" (keyup.enter)="enviar()"></ion-input>
        <ion-button (click)="enviar()" [disabled]="pensando() || !texto.trim()"><ion-icon name="send"></ion-icon></ion-button>
        <ion-button fill="clear" color="medium" (click)="limpiar()"><ion-icon name="trash"></ion-icon></ion-button>
      </div>
      <p class="muted aviso">No escribas datos personales. Las respuestas son orientativas.</p>
    }
  </ion-content>`,
  styles: [`
    .chips{display:flex;gap:8px;overflow-x:auto;padding:0 16px 4px;scrollbar-width:none}
    .chip{flex:none;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:999px;padding:7px 14px;
      font:inherit;font-size:12px;font-weight:800;backdrop-filter:blur(14px)}
    .chip.on{background:var(--accent);color:#fff;border-color:transparent}
    .chat{display:flex;flex-direction:column;gap:10px}
    .burbuja{max-width:88%;padding:10px 14px;border-radius:18px 18px 18px 6px;background:rgba(128,128,128,.16);white-space:pre-wrap;line-height:1.4;font-size:14px}
    .burbuja.yo{align-self:flex-end;background:var(--accent);color:#fff;border-radius:18px 18px 6px 18px}
    .burbuja small{display:block;opacity:.65;font-size:10px;margin-top:4px}
    .entrada{display:flex;align-items:center;gap:6px;padding:8px 10px}.entrada ion-input{flex:1}
    .aviso{text-align:center;font-size:11px;margin:0 16px}
  `]
})
export class ChatPage {
  @ViewChild(IonContent) content?: IonContent;
  texto = ''; mensajes = signal<MensajeChat[]>([]); pensando = signal(false); error = signal('');
  modelos = signal<ModeloIA[]>([]); modelo = signal('auto');
  sugerencias = ['¿Debo regar hoy?', 'Interpreta mi humedad actual', '¿Qué humedad necesita mi cultivo?'];

  constructor(public tema: TemaService, public a: AuthService, public m: MonitorService, public chat: ChatService, private router: Router) {
    addIcons({ send, trash });
  }

  ionViewWillEnter() { if (this.chat.configurado()) this.chat.modelos().then(l => this.modelos.set(l)).catch(() => {}); }
  irPerfil() { this.router.navigateByUrl('/tabs/perfil'); }
  limpiar() { this.mensajes.set([]); this.error.set(''); }
  private bajar() { setTimeout(() => this.content?.scrollToBottom(300), 50); }

  /** Solo datos agronómicos: no se envía nombre ni correo */
  contexto() {
    const l = this.m.lectura(), p = this.a.perfil(); const t: string[] = [];
    if (p?.cultivo) t.push(`Cultivo del usuario: ${p.cultivo}`);
    if (l) { t.push(`Humedad del suelo actual: ${l.humedad}% (${this.m.estado(l.humedad).txt})`); t.push(`Promedio reciente: ${this.m.promedio()}%`); }
    else t.push('El usuario aún no tiene un sensor conectado.');
    const al = this.m.alertas().slice(0, 3).map(x => x.mensaje); if (al.length) t.push('Últimas alertas: ' + al.join(' | '));
    t.push('Rangos de la app: menos de 40% seco, 40–80% óptimo, más de 80% exceso.');
    return t.join('\n');
  }

  async enviar(sugerida?: string) {
    const texto = (sugerida ?? this.texto).trim(); if (!texto || this.pensando()) return;
    this.texto = ''; this.error.set('');
    this.mensajes.update(l => [...l, { rol: 'user', texto }]); this.pensando.set(true); this.bajar();
    try {
      const r = await this.chat.preguntar(this.mensajes(), this.modelo(), this.contexto());
      this.mensajes.update(l => [...l, { rol: 'assistant', texto: r.respuesta, modelo: r.modeloUsado }]);
    } catch (e: any) { this.error.set(e?.message ?? 'No se pudo obtener respuesta.'); }
    this.pensando.set(false); this.bajar();
  }
}
