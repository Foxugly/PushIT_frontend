import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { makeApplication } from '../../../../../testing/console-fixtures';
import { ApplicationRead } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ApplicationFormPage } from './application-form-page';
import { provideTestCatalogs } from '../../../../../testing/catalog-store.testing';

const applicationsCopy = {
  errors: { create: 'Creation impossible.', invalidId: 'ID application invalide.' },
  dialog: { create: 'Creer', creating: 'Creation...', save: 'Enregistrer', saving: 'Enregistrement...' },
  page: {
    eyebrow: 'Application',
    createTitle: 'Nouvelle application',
    editTitle: "Modifier l'application",
    back: 'Retour aux applications',
    cancel: 'Annuler',
    loading: 'Chargement...',
  },
  logo: { label: 'Logo', none: 'Aucun logo', remove: 'Supprimer le logo', choose: 'Choisir une image', hint: 'Glissez une image ici.' },
};

function configure(
  apiSpy: jasmine.SpyObj<PushitApiService>,
  shellStub: {
    apps: ReturnType<typeof signal<ApplicationRead[]>>;
    createApp: jasmine.Spy;
    loadShell: jasmine.Spy;
    lastGeneratedToken: ReturnType<
      typeof signal<{ appId: number; token: string; prefix: string } | null>
    >;
  },
) {
  return TestBed.configureTestingModule({
    imports: [ApplicationFormPage],
    providers: [provideTestCatalogs(), 
      provideRouter([]),
      provideNoopAnimations(),
      provideHttpClient(),
      { provide: PushitApiService, useValue: apiSpy },
      { provide: ConsoleShellService, useValue: shellStub },
      { provide: ConsoleCopyService, useValue: { current: signal({ applications: applicationsCopy }) } },
    ],
  }).compileComponents();
}

describe('ApplicationFormPage', () => {
  let api: jasmine.SpyObj<PushitApiService>;
  let shell: {
    apps: ReturnType<typeof signal<ApplicationRead[]>>;
    createApp: jasmine.Spy;
    loadShell: jasmine.Spy;
    lastGeneratedToken: ReturnType<
      typeof signal<{ appId: number; token: string; prefix: string } | null>
    >;
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['uploadAppLogo', 'deleteAppLogo']);
    shell = {
      apps: signal<ApplicationRead[]>([makeApplication()]),
      lastGeneratedToken: signal<{ appId: number; token: string; prefix: string } | null>(null),
      // Mirror the real shell: on create it remembers the one-time token so the
      // detail page can reveal it, then invokes onDone with the created app.
      createApp: jasmine.createSpy('createApp').and.callFake(
        (_payload: unknown, onDone?: (app: { id: number }) => void) => {
          shell.lastGeneratedToken.set({ appId: 999, token: 'apt_created_secret', prefix: 'apt_c' });
          onDone?.({ id: 999 });
        },
      ),
      loadShell: jasmine.createSpy('loadShell'),
    };
  });

  describe('create mode', () => {
    let fixture: ComponentFixture<ApplicationFormPage>;
    let component: ApplicationFormPage;
    let router: Router;

    beforeEach(async () => {
      await configure(api, shell);
      fixture = TestBed.createComponent(ApplicationFormPage);
      component = fixture.componentInstance;
      router = TestBed.inject(Router);
      spyOn(router, 'navigate').and.resolveTo(true);
      fixture.detectChanges();
    });

    it('does not submit when the form is invalid', () => {
      component.save();

      expect(shell.createApp).not.toHaveBeenCalled();
      expect(component.form.controls.name.touched).toBeTrue();
    });

    it('delegates creation to the shell and lands on the Envoi tab where the token is revealed', () => {
      component.form.setValue({ name: 'Nouvelle app', description: 'Desc' });

      component.save();

      expect(shell.createApp).toHaveBeenCalledWith(
        { name: 'Nouvelle app', description: 'Desc' },
        jasmine.any(Function),
        jasmine.any(Function),
      );
      // Navigate to the new app's detail page...
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/applications', 999], { queryParams: { tab: 'sending' } });
      // ...and the one-time token is REACHABLE there: the shell holds it for the
      // created app id, which is exactly what the detail page's revealToken()
      // surfaces (regression guard: create must not strand the token).
      expect(shell.lastGeneratedToken()).toEqual({
        appId: 999,
        token: 'apt_created_secret',
        prefix: 'apt_c',
      });
    });

    it('surfaces a create error from the shell', () => {
      shell.createApp.and.callFake(
        (_payload: unknown, _onDone?: () => void, onError?: () => void) => onError?.(),
      );
      component.form.setValue({ name: 'App', description: '' });

      component.save();

      expect(component.error()?.detail).toBe('Creation impossible.');
    });

    it('keeps a cropped logo pending (no upload) until the app exists', () => {
      const file = new File(['x'], 'logo.png', { type: 'image/png' });

      component.onLogoCropped(file);

      expect(api.uploadAppLogo).not.toHaveBeenCalled();
      expect(component.pendingLogo()).toBe(file);
      expect(component.logoPreview()).not.toBeNull();

      component.removeLogo();

      expect(component.pendingLogo()).toBeNull();
      expect(component.logoPreview()).toBeNull();
      expect(api.deleteAppLogo).not.toHaveBeenCalled();
    });

    it('uploads the pending logo right after creation, then opens the detail page', () => {
      api.uploadAppLogo.and.returnValue(of(makeApplication({ id: 999, logo: 'https://cdn/logo.png' })));
      const file = new File(['x'], 'logo.png', { type: 'image/png' });
      component.onLogoCropped(file);
      component.form.setValue({ name: 'Nouvelle app', description: '' });

      component.save();

      expect(api.uploadAppLogo).toHaveBeenCalledWith(999, file);
      expect(shell.loadShell).toHaveBeenCalledWith(999);
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/applications', 999], { queryParams: { tab: 'sending' } });
      expect(component.pending()).toBeFalse();
    });

    it('still opens the detail page (token reveal) when the logo upload fails', () => {
      api.uploadAppLogo.and.returnValue(throwError(() => ({ status: 400 })));
      component.onLogoCropped(new File(['x'], 'logo.png', { type: 'image/png' }));
      component.form.setValue({ name: 'Nouvelle app', description: '' });

      component.save();

      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/applications', 999], {
        queryParams: { tab: 'sending' },
        state: { logoUploadFailed: true },
      });
      expect(shell.lastGeneratedToken()?.appId).toBe(999);
    });

    it('creates without any upload when no logo was chosen', () => {
      component.form.setValue({ name: 'Nouvelle app', description: '' });

      component.save();

      expect(api.uploadAppLogo).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/applications', 999], { queryParams: { tab: 'sending' } });
    });
  });
});
