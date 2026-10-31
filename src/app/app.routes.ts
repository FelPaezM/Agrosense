import { Routes } from '@angular/router';
export const routes: Routes = [
  { path: '', redirectTo: 'tabs/panel', pathMatch: 'full' },
  { path: 'tabs', loadComponent: () => import('./pages/tabs.page').then(m => m.TabsPage), children: [
    { path: 'panel', loadComponent: () => import('./pages/panel.page').then(m => m.PanelPage) },
    { path: 'historial', loadComponent: () => import('./pages/historial.page').then(m => m.HistorialPage) },
    { path: 'alertas', loadComponent: () => import('./pages/alertas.page').then(m => m.AlertasPage) },
    { path: 'perfil', loadComponent: () => import('./pages/perfil.page').then(m => m.PerfilPage) }
  ]}
];
