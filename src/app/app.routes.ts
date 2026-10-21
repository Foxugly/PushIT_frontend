import { inject } from '@angular/core';
import { RedirectFunction, Router, Routes } from '@angular/router';

import { adminGuard, authGuard, guestGuard, superuserGuard } from './core/guards/auth.guard';

/**
 * `applications/:appId/edit` predates the tabbed detail page: editing now lives
 * in its Paramètres tab, so old links land there.
 */
export const applicationEditRedirect: RedirectFunction = ({ params }) =>
  inject(Router).createUrlTree(['/dashboard/applications', params['appId']], {
    queryParams: { tab: 'settings' },
  });

/** The change-password form now lives in the « Sécurité » block of « Mon compte ». */
export const changePasswordRedirect: RedirectFunction = () =>
  inject(Router).createUrlTree(['/dashboard/settings'], { fragment: 'security' });

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/public-layout/public-layout-page').then((m) => m.PublicLayoutPage),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home-page/home-page').then((m) => m.HomePage),
      },
      {
        path: 'about',
        data: { titleKey: 'header.about' },
        loadComponent: () => import('./features/about/about-page/about-page').then((m) => m.AboutPage),
      },
      {
        path: 'features',
        data: { titleKey: 'header.features' },
        loadComponent: () => import('./features/features/features-page/features-page').then((m) => m.FeaturesPage),
      },
      {
        path: 'donate',
        data: { titleKey: 'header.donate' },
        loadComponent: () => import('./features/donate/donate-page/donate-page').then((m) => m.DonatePage),
      },
      {
        path: 'privacy',
        data: { titleKey: 'footer.privacy' },
        loadComponent: () =>
          import('./features/privacy/privacy-page/privacy-page').then((m) => m.PrivacyPage),
      },
      {
        // Stable public URL (Google Play Data safety "account deletion URL"): keep it.
        path: 'account-deletion',
        data: { titleKey: 'accountDeletion.title' },
        loadComponent: () =>
          import('./features/account-deletion/account-deletion-page/account-deletion-page').then(
            (m) => m.AccountDeletionPage,
          ),
      },
      {
        path: 'auth',
        data: { titleKey: 'auth.title' },
        loadComponent: () => import('./features/auth/auth-page/auth-page').then((m) => m.AuthPage),
        canActivate: [guestGuard],
      },
      {
        path: 'register',
        data: { titleKey: 'registerPanel.defaultTitle' },
        loadComponent: () => import('./features/register/register-page/register-page').then((m) => m.RegisterPage),
        canActivate: [guestGuard],
      },
      {
        path: 'forgot-password',
        data: { titleKey: 'forgotPassword.title' },
        loadComponent: () =>
          import('./features/forgot-password/forgot-password-page/forgot-password-page').then(
            (m) => m.ForgotPasswordPage,
          ),
        canActivate: [guestGuard],
      },
      {
        path: 'reset-password/:uid/:token',
        data: { titleKey: 'resetPassword.title' },
        loadComponent: () =>
          import('./features/reset-password/reset-password-page/reset-password-page').then(
            (m) => m.ResetPasswordPage,
          ),
        canActivate: [guestGuard],
      },
      {
        path: 'auth/check-email',
        data: { titleKey: 'checkEmail.title' },
        loadComponent: () =>
          import('./features/check-email/check-email-page/check-email-page').then((m) => m.CheckEmailPage),
        canActivate: [guestGuard],
      },
      {
        path: 'auth/confirm-email/:uid/:token',
        data: { titleKey: 'confirmEmail.title' },
        loadComponent: () =>
          import('./features/confirm-email/confirm-email-page/confirm-email-page').then(
            (m) => m.ConfirmEmailPage,
          ),
        canActivate: [guestGuard],
      },
      {
        path: 'auth/magic-link/:token',
        data: { titleKey: 'magicLink.title' },
        loadComponent: () =>
          import('./features/magic-link/magic-link-page/magic-link-page').then(
            (m) => m.MagicLinkPage,
          ),
        canActivate: [guestGuard],
      },
    ],
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./core/layout/console-layout/console-layout-page').then((m) => m.ConsoleLayoutPage),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        data: { titleKey: 'console.dashboard.title' },
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/console/pages/dashboard-home-page/dashboard-home-page').then(
            (m) => m.DashboardHomePage,
          ),
      },
      {
        path: 'applications',
        data: { titleKey: 'console.sections.0.label' },
        loadComponent: () =>
          import('./features/console/pages/applications-page/applications-page').then((m) => m.ApplicationsPage),
      },
      {
        path: 'applications/new',
        data: { titleKey: 'console.sections.0.label' },
        loadComponent: () =>
          import('./features/console/pages/application-form-page/application-form-page').then(
            (m) => m.ApplicationFormPage,
          ),
      },
      {
        path: 'applications/:appId/edit',
        redirectTo: applicationEditRedirect,
      },
      {
        path: 'applications/:appId',
        data: { titleKey: 'console.sections.0.label' },
        loadComponent: () =>
          import('./features/console/pages/application-detail-page/application-detail-page').then(
            (m) => m.ApplicationDetailPage,
          ),
      },
      {
        path: 'devices',
        data: { titleKey: 'console.sections.1.label' },
        loadComponent: () => import('./features/console/pages/devices-page/devices-page').then((m) => m.DevicesPage),
      },
      {
        path: 'devices/:deviceId',
        data: { titleKey: 'console.sections.1.label' },
        loadComponent: () =>
          import('./features/console/pages/device-detail-page/device-detail-page').then((m) => m.DeviceDetailPage),
      },
      {
        path: 'notifications',
        data: { titleKey: 'console.sections.2.label' },
        loadComponent: () =>
          import('./features/console/pages/notifications-page/notifications-page').then((m) => m.NotificationsPage),
      },
      {
        path: 'notifications/:notificationId',
        data: { titleKey: 'console.sections.2.label' },
        loadComponent: () =>
          import('./features/console/pages/notification-detail-page/notification-detail-page').then(
            (m) => m.NotificationDetailPage,
          ),
      },
      {
        path: 'quiet-periods',
        data: { titleKey: 'console.sections.3.label' },
        loadComponent: () =>
          import('./features/console/pages/quiet-periods-page/quiet-periods-page').then((m) => m.QuietPeriodsPage),
      },
      {
        path: 'settings',
        data: { titleKey: 'header.settings' },
        loadComponent: () =>
          import('./features/console/pages/settings-page/settings-page').then((m) => m.SettingsPage),
      },
      {
        path: 'billing',
        data: { titleKey: 'console.navigation.billing.label' },
        loadComponent: () =>
          import('./features/console/pages/billing-page/billing-page').then((m) => m.BillingPage),
      },
      {
        path: 'change-password',
        redirectTo: changePasswordRedirect,
      },
      {
        path: 'accounts',
        data: { titleKey: 'console.navigation.accounts.label' },
        canActivate: [superuserGuard],
        loadComponent: () =>
          import('./features/console/pages/accounts-page/accounts-page').then(
            (m) => m.AccountsPage,
          ),
      },
      {
        path: 'admin',
        data: { titleKey: 'console.navigation.admin.label' },
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/console/pages/admin-status-page/admin-status-page').then(
            (m) => m.AdminStatusPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
