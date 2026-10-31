import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  provideIonicAngular, IonApp, IonRouterOutlet, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonIcon, IonSpinner, IonTabs, IonTabBar, IonTabButton, IonLabel, IonBadge,
  IonSegment, IonSegmentButton, IonInput, IonModal, IonCheckbox
} from '@ionic/angular';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { TabsPage } from './pages/tabs.page';
import { PanelPage } from './pages/panel.page';
import { HistorialPage } from './pages/historial.page';
import { AlertasPage } from './pages/alertas.page';
import { PerfilPage } from './pages/perfil.page';
import { AsistentePage } from './pages/asistente.page';
import { TiltDirective } from './core/tilt.directive';
import { PoliticaComponent } from './pages/politica.component';

const IONIC = [IonApp, IonRouterOutlet, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
  IonSpinner, IonTabs, IonTabBar, IonTabButton, IonLabel, IonBadge, IonSegment, IonSegmentButton, IonInput, IonModal, IonCheckbox];

@NgModule({
  declarations: [AppComponent, TabsPage, PanelPage, HistorialPage, AlertasPage, PerfilPage, AsistentePage, TiltDirective, PoliticaComponent],
  imports: [BrowserModule, CommonModule, FormsModule, AppRoutingModule, ...IONIC],
  providers: [provideIonicAngular({ mode: 'md' })],
  bootstrap: [AppComponent]
})
export class AppModule {}
