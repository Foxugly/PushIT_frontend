import { TestBed } from '@angular/core/testing';
import { provideRouter, RedirectFunction, Router, UrlTree } from '@angular/router';

import { applicationEditRedirect, routes } from './app.routes';

describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('redirects the legacy edit route to the detail page settings tab', () => {
    const edit = routes
      .find((route) => route.path === 'dashboard')
      ?.children?.find((route) => route.path === 'applications/:appId/edit');

    expect(edit?.redirectTo).toBe(applicationEditRedirect);
    expect(edit?.loadComponent).toBeUndefined();

    const target = TestBed.runInInjectionContext(() =>
      applicationEditRedirect({ params: { appId: '42' } } as unknown as Parameters<RedirectFunction>[0]),
    ) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(target)).toBe('/dashboard/applications/42?tab=settings');
  });

  it('keeps the create route on the form page', () => {
    const create = routes
      .find((route) => route.path === 'dashboard')
      ?.children?.find((route) => route.path === 'applications/new');

    expect(create?.loadComponent).toBeDefined();
  });
});
