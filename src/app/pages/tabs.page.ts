import { Component } from '@angular/core';
import { addIcons } from 'ionicons';
import { speedometer, time, notifications, person, sparkles } from 'ionicons/icons';
import { MonitorService } from '../core/monitor.service';

@Component({
  standalone: false,
  selector: 'app-tabs',
  template: `
  <ion-tabs>
    <ion-tab-bar slot="bottom">
      <ion-tab-button tab="panel"><ion-icon name="speedometer"/><ion-label>Panel</ion-label></ion-tab-button>
      <ion-tab-button tab="historial"><ion-icon name="time"/><ion-label>Historial</ion-label></ion-tab-button>
      <ion-tab-button tab="asistente" class="ia"><span class="orbe"><ion-icon name="sparkles"/></span><ion-label>Asistente</ion-label></ion-tab-button>
      <ion-tab-button tab="alertas"><ion-icon name="notifications"/><ion-label>Alertas</ion-label>
        @if (m.alertas().length) { <ion-badge color="danger">{{ m.alertas().length > 99 ? '99+' : m.alertas().length }}</ion-badge> }
      </ion-tab-button>
      <ion-tab-button tab="perfil"><ion-icon name="person"/><ion-label>Perfil</ion-label></ion-tab-button>
    </ion-tab-bar>
  </ion-tabs>`
})
export class TabsPage {
  constructor(public m: MonitorService) { addIcons({ speedometer, time, notifications, person, sparkles }); }
}
