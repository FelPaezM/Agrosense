import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './pages/tabs.page';
import { PanelPage } from './pages/panel.page';
import { HistorialPage } from './pages/historial.page';
import { AlertasPage } from './pages/alertas.page';
import { PerfilPage } from './pages/perfil.page';
import { AsistentePage } from './pages/asistente.page';

const routes: Routes = [
  { path: '', redirectTo: 'tabs/panel', pathMatch: 'full' },
  { path: 'tabs', component: TabsPage, children: [
    { path: 'panel', component: PanelPage },
    { path: 'historial', component: HistorialPage },
    { path: 'asistente', component: AsistentePage },
    { path: 'alertas', component: AlertasPage },
    { path: 'perfil', component: PerfilPage },
    { path: '', redirectTo: 'panel', pathMatch: 'full' }
  ]}
];

@NgModule({ imports: [RouterModule.forRoot(routes)], exports: [RouterModule] })
export class AppRoutingModule {}
