import { TemaService } from '../core/tema.service';
import { Component } from '@angular/core';
import { addIcons } from 'ionicons';
import { alertCircle, timer } from 'ionicons/icons';
import { MonitorService } from '../core/monitor.service';

@Component({
  standalone: false,
  selector: 'app-alertas',
  template: `
  <div class="hero"><small>{{ tema.saludo() }}</small><h1>Alertas</h1><p>Cambios y monitoreo cada 5 minutos</p></div>
  <ion-content>
    <div class="card"><h3>Monitoreo cada 5 minutos</h3>
      <p class="muted">{{ m.conectado() ? 'Activo: se registra el detalle de cada cambio y se notifica si varía 10% o más.' : 'Conecta desde el Panel para activar el monitoreo.' }}</p></div>
    @for (a of m.alertas(); track a.fecha) {
      <div appTilt class="card item">
        <span class="gem" [style.--g]="a.tipo === 'cambio' ? '#ff9f43' : '#19b5c9'"><ion-icon [name]="a.tipo === 'cambio' ? 'alert-circle' : 'timer'"></ion-icon></span>
        <div><strong>{{ a.tipo === 'cambio' ? 'Cambio de humedad' : 'Resumen de 5 min' }}</strong>
          <div>{{ a.mensaje }}</div><div class="muted">{{ a.fecha | date:'d MMM, h:mm:ss a' }}</div></div>
      </div>
    } @empty { <div class="card"><p class="muted">Aún no hay alertas. Aparecerán cuando conectes un sensor.</p></div> }
  </ion-content>`,
  styles: [`.item{display:flex;gap:14px;align-items:flex-start}.item .gem{flex:none}`]
})
export class AlertasPage {
  constructor(public tema: TemaService, public m: MonitorService) { addIcons({ alertCircle, timer }); }
}
