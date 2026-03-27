import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/guards/auth.guard';
import { AboutPage } from './features/about/about-page/about-page';
import { AuthPage } from './features/auth/auth-page/auth-page';
import { ConsoleLayoutPage } from './features/console/console-layout/console-layout-page';
import { ApplicationsPage } from './features/console/pages/applications-page/applications-page';
import { ApplicationDetailPage } from './features/console/pages/application-detail-page/application-detail-page';
import { ChangePasswordPage } from './features/console/pages/change-password-page/change-password-page';
import { DeviceDetailPage } from './features/console/pages/device-detail-page/device-detail-page';
import { DevicesPage } from './features/console/pages/devices-page/devices-page';
import { NotificationDetailPage } from './features/console/pages/notification-detail-page/notification-detail-page';
import { NotificationsPage } from './features/console/pages/notifications-page/notifications-page';
import { QuietPeriodsPage } from './features/console/pages/quiet-periods-page/quiet-periods-page';
import { SettingsPage } from './features/console/pages/settings-page/settings-page';
import { DonatePage } from './features/donate/donate-page/donate-page';
import { FeaturesPage } from './features/features/features-page/features-page';
import { ForgotPasswordPage } from './features/forgot-password/forgot-password-page/forgot-password-page';
import { HomePage } from './features/home/home-page/home-page';
import { RegisterPage } from './features/register/register-page/register-page';

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'about', component: AboutPage },
  { path: 'features', component: FeaturesPage },
  { path: 'donate', component: DonatePage },
  { path: 'auth', component: AuthPage, canActivate: [guestGuard] },
  { path: 'register', component: RegisterPage, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordPage, canActivate: [guestGuard] },
  {
    path: 'dashboard',
    component: ConsoleLayoutPage,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'applications' },
      { path: 'applications', component: ApplicationsPage },
      { path: 'applications/:appId', component: ApplicationDetailPage },
      { path: 'devices', component: DevicesPage },
      { path: 'devices/:deviceId', component: DeviceDetailPage },
      { path: 'notifications', component: NotificationsPage },
      { path: 'notifications/:notificationId', component: NotificationDetailPage },
      { path: 'quiet-periods', component: QuietPeriodsPage },
      { path: 'settings', component: SettingsPage },
      { path: 'change-password', component: ChangePasswordPage },
    ],
  },
  { path: '**', redirectTo: '' },
];
