import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/public/public-layout/public-layout-page').then((m) => m.PublicLayoutPage),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home-page/home-page').then((m) => m.HomePage),
      },
      {
        path: 'about',
        loadComponent: () => import('./features/about/about-page/about-page').then((m) => m.AboutPage),
      },
      {
        path: 'features',
        loadComponent: () => import('./features/features/features-page/features-page').then((m) => m.FeaturesPage),
      },
      {
        path: 'donate',
        loadComponent: () => import('./features/donate/donate-page/donate-page').then((m) => m.DonatePage),
      },
      {
        path: 'auth',
        loadComponent: () => import('./features/auth/auth-page/auth-page').then((m) => m.AuthPage),
        canActivate: [guestGuard],
      },
      {
        path: 'register',
        loadComponent: () => import('./features/register/register-page/register-page').then((m) => m.RegisterPage),
        canActivate: [guestGuard],
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/forgot-password/forgot-password-page/forgot-password-page').then(
            (m) => m.ForgotPasswordPage,
          ),
        canActivate: [guestGuard],
      },
    ],
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/console/console-layout/console-layout-page').then((m) => m.ConsoleLayoutPage),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/console/pages/dashboard-home-page/dashboard-home-page').then(
            (m) => m.DashboardHomePage,
          ),
      },
      {
        path: 'applications',
        loadComponent: () =>
          import('./features/console/pages/applications-page/applications-page').then((m) => m.ApplicationsPage),
      },
      {
        path: 'applications/:appId',
        loadComponent: () =>
          import('./features/console/pages/application-detail-page/application-detail-page').then(
            (m) => m.ApplicationDetailPage,
          ),
      },
      {
        path: 'devices',
        loadComponent: () => import('./features/console/pages/devices-page/devices-page').then((m) => m.DevicesPage),
      },
      {
        path: 'devices/:deviceId',
        loadComponent: () =>
          import('./features/console/pages/device-detail-page/device-detail-page').then((m) => m.DeviceDetailPage),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/console/pages/notifications-page/notifications-page').then((m) => m.NotificationsPage),
      },
      {
        path: 'notifications/:notificationId',
        loadComponent: () =>
          import('./features/console/pages/notification-detail-page/notification-detail-page').then(
            (m) => m.NotificationDetailPage,
          ),
      },
      {
        path: 'quiet-periods',
        loadComponent: () =>
          import('./features/console/pages/quiet-periods-page/quiet-periods-page').then((m) => m.QuietPeriodsPage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/console/pages/settings-page/settings-page').then((m) => m.SettingsPage),
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./features/console/pages/change-password-page/change-password-page').then(
            (m) => m.ChangePasswordPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
