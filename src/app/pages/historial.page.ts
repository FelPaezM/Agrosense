import { Component, signal, computed } from '@angular/core';
import { addIcons } from 'ionicons';
import { bluetooth, cloud, arrowUp, arrowDown, analytics } from 'ionicons/icons';
import { MonitorService } from '../core/monitor.service';
import { TemaService } from '../core/tema.service';
import { trazoSuave } from '../core/historial-util';

@Component({
  standalone: false,
  selector: 'app-historial',
  template: `
  <ion-content>
    <div class="hero"><small>{{ tema.saludo() }}</small><h1>Historial</h1><p>Registros guardados de tu sensor</p></div>
    <div class="card">
      <ion-segment [value]="filtro()" (ionChange)="filtro.set($any($event.detail.value))">
        <ion-segment-button value="hoy"><ion-label>Hoy</ion-label></ion-segment-button>
        <ion-segment-button value="semana"><ion-label>7 días</ion-label></ion-segment-button>
        <ion-segment-button value="todo"><ion-label>Todo</ion-label></ion-segment-button>
      </ion-segment>

      <div class="chart">
        @if (grafica(); as g) {
          <svg viewBox="0 0 320 150" preserveAspectRatio="none" aria-label="Gráfica de humedad">
            <defs>
              <linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".5"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient>
            </defs>
            <rect x="0" y="6" width="320" [attr.height]="y(80) - 6" class="z alto"/>
            <rect x="0" [attr.y]="y(40)" width="320" [attr.height]="144 - y(40)" class="z seco"/>
            <line x1="0" [attr.y1]="y(80)" x2="320" [attr.y2]="y(80)" class="ref"/><line x1="0" [attr.y1]="y(40)" x2="320" [attr.y2]="y(40)" class="ref"/>
            <path [attr.d]="g.linea + ' L320,144 L0,144 Z'" fill="url(#area)"/>
            <path [attr.d]="g.linea" class="curva"/>
            <circle [attr.cx]="g.fin.x" [attr.cy]="g.fin.y" r="4.5" class="punto"/>
          </svg>
          <span class="eje a">80%</span><span class="eje b">40%</span>
        } @else { <div class="vacio">{{ lista().length ? 'Se necesitan al menos 2 registros para dibujar la curva' : 'Aún no hay datos registrados' }}</div> }
      </div>
      <p class="muted">{{ lista().length ? lista().length + (lista().length === 1 ? ' registro' : ' registros') + ' · antigua → reciente' : 'Conecta tu sensor desde el Panel para empezar a registrar.' }}</p>
    </div>

    @if (lista().length) {
      <div class="tiles">
        <div appTilt class="tile"><span class="gem" style="--g:#3b9be8"><ion-icon name="arrow-down"></ion-icon></span><strong>{{ resumen().min }}%</strong><span class="muted">Mínima</span></div>
        <div appTilt class="tile"><span class="gem" style="--g:#8e6cf0"><ion-icon name="analytics"></ion-icon></span><strong>{{ resumen().prom }}%</strong><span class="muted">Promedio</span></div>
        <div appTilt class="tile"><span class="gem" style="--g:#f08a2b"><ion-icon name="arrow-up"></ion-icon></span><strong>{{ resumen().max }}%</strong><span class="muted">Máxima</span></div>
      </div>
      <div class="card list">
        @for (x of lista(); track x.id) {
          <div class="row">
            <span class="dot" [style.background]="m.estado(x.humedad).color"></span>
            <div><strong>{{ x.humedad }}%</strong>
              <div class="muted">{{ m.estado(x.humedad).txt }} · {{ x.sensorId }}
                <ion-icon class="orig" [name]="x.id.startsWith('ble-') ? 'bluetooth' : 'cloud'"></ion-icon></div></div>
            <span class="muted">{{ x.fecha | date:'d MMM, h:mm a' }}</span>
          </div>
        }
      </div>
    }
  </ion-content>`,
  styles: [`
    .chart{position:relative;height:160px;margin-top:16px}
    svg{width:100%;height:100%;overflow:visible}
    .z{opacity:.1}.z.alto{fill:#3d8bff}.z.seco{fill:#ff8a3d}
    .ref{stroke:var(--border);stroke-dasharray:4 5;stroke-width:1}
    .curva{fill:none;stroke:var(--accent);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;filter:drop-shadow(0 3px 5px rgba(0,0,0,.25))}
    .punto{fill:#fff;stroke:var(--accent);stroke-width:3;vector-effect:non-scaling-stroke}
    .eje{position:absolute;right:2px;font-size:10px;font-weight:800;color:var(--muted)}.eje.a{top:17%}.eje.b{bottom:39%}
    .vacio{position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);font-weight:700;text-align:center;padding:0 20px}
    .list{padding:6px 18px}.row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(128,150,136,.18)}
    .row:last-child{border:0}.row div{flex:1}.row strong{font-size:17px}.dot{width:12px;height:12px;border-radius:50%}
    .orig{font-size:12px;vertical-align:-1px;margin-left:4px;opacity:.8}
  `]
})
export class HistorialPage {
  filtro = signal<'hoy' | 'semana' | 'todo'>('todo');
  lista = computed(() => {
    const f = this.filtro(), ahora = Date.now();
    const lim = f === 'hoy' ? 864e5 : f === 'semana' ? 7 * 864e5 : Infinity;
    return this.m.historial().filter(x => ahora - new Date(x.fecha).getTime() <= lim);
  });
  resumen = computed(() => {
    const h = this.lista().map(x => x.humedad);
    if (!h.length) return { min: 0, max: 0, prom: 0 };
    return { min: Math.min(...h), max: Math.max(...h), prom: Math.round(h.reduce((a, b) => a + b, 0) / h.length) };
  });
  /** Curva suave de hasta 60 puntos (de antigua a reciente) */
  grafica = computed(() => {
    const l = this.lista().slice(0, 60).reverse();
    if (l.length < 2) return null;
    const pts = l.map((x, i) => ({ x: (i / (l.length - 1)) * 320, y: this.y(x.humedad) }));
    return { linea: trazoSuave(pts), fin: pts[pts.length - 1] };
  });
  constructor(public tema: TemaService, public m: MonitorService) { addIcons({ bluetooth, cloud, arrowUp, arrowDown, analytics }); }
  /** 0–100 % → posición vertical dentro de la gráfica */
  y(h: number) { return 144 - Math.max(0, Math.min(100, h)) / 100 * 138; }
}
