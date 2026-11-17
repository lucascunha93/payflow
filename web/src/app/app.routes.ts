import { Routes } from '@angular/router';
import { authGuard } from './core/auth.interceptor';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login-page').then((module) => module.LoginPage),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./payments/dashboard-page').then((module) => module.DashboardPage),
  },
  { path: '**', redirectTo: '' },
];
