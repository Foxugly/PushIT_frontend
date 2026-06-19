import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { makeApplication } from '../../../../../testing/console-fixtures';
import { ApplicationRead } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ApplicationFormPage } from './application-form-page';

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
  paramMap: Record<string, string>,
  apiSpy: jasmine.SpyObj<PushitApiService>,
  shellStub: {
    apps: ReturnType<typeof signal<ApplicationRead[]>>;
    createApp: jasmine.Spy;
    loadShell: jasmine.Spy;
  },
) {
  return TestBed.configureTestingModule({
    imports: [ApplicationFormPage],
    providers: [
      provideRouter([]),
      provideNoopAnimations(),
      provideHttpClient(),
      { provide: PushitApiService, useValue: apiSpy },
      { provide: ConsoleShellService, useValue: shellStub },
      { provide: ConsoleCopyService, useValue: { current: signal({ applications: applicationsCopy }) } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(paramMap) } } },
    ],
  }).compileComponents();
}

describe('ApplicationFormPage', () => {
  let api: jasmine.SpyObj<PushitApiService>;
  let shell: {
    apps: ReturnType<typeof signal<ApplicationRead[]>>;
    createApp: jasmine.Spy;
    loadShell: jasmine.Spy;
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['getApp', 'updateApp', 'uploadAppLogo', 'deleteAppLogo']);
    api.getApp.and.returnValue(of(makeApplication()));
    api.updateApp.and.returnValue(of(makeApplication({ name: 'PushIT Mobile V2' })));
    shell = {
      apps: signal<ApplicationRead[]>([makeApplication()]),
      createApp: jasmine.createSpy('createApp').and.callFake(
        (_payload: unknown, onDone?: (app: { id: number }) => void) => onDone?.({ id: 999 }),
      ),
      loadShell: jasmine.createSpy('loadShell'),
    };
  });

  describe('create mode', () => {
    let fixture: ComponentFixture<ApplicationFormPage>;
    let component: ApplicationFormPage;
    let router: Router;

    beforeEach(async () => {
      await configure({}, api, shell);
      fixture = TestBed.createComponent(ApplicationFormPage);
      component = fixture.componentInstance;
      router = TestBed.inject(Router);
      spyOn(router, 'navigate').and.resolveTo(true);
      fixture.detectChanges();
    });

    it('starts in create mode', () => {
      expect(component.isEdit()).toBeFalse();
    });

    it('does not submit when the form is invalid', () => {
      component.save();

      expect(shell.createApp).not.toHaveBeenCalled();
      expect(component.form.controls.name.touched).toBeTrue();
    });

    it('delegates creation to the shell and navigates to the detail page (token reveal)', () => {
      component.form.setValue({ name: 'Nouvelle app', description: 'Desc' });

      component.save();

      expect(shell.createApp).toHaveBeenCalledWith(
        { name: 'Nouvelle app', description: 'Desc' },
        jasmine.any(Function),
        jasmine.any(Function),
      );
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/applications', 999]);
    });

    it('surfaces a create error from the shell', () => {
      shell.createApp.and.callFake(
        (_payload: unknown, _onDone?: () => void, onError?: () => void) => onError?.(),
      );
      component.form.setValue({ name: 'App', description: '' });

      component.save();

      expect(component.error()?.detail).toBe('Creation impossible.');
    });
  });

  describe('edit mode', () => {
    let fixture: ComponentFixture<ApplicationFormPage>;
    let component: ApplicationFormPage;
    let router: Router;

    beforeEach(async () => {
      await configure({ appId: '101' }, api, shell);
      fixture = TestBed.createComponent(ApplicationFormPage);
      component = fixture.componentInstance;
      router = TestBed.inject(Router);
      spyOn(router, 'navigate').and.resolveTo(true);
      fixture.detectChanges();
    });

    it('prefills the form from the loaded application', () => {
      expect(component.isEdit()).toBeTrue();
      expect(api.getApp).toHaveBeenCalledWith(101);
      expect(component.form.controls.name.value).toBe('PushIT Mobile');
      expect(component.form.controls.description.value).toBe('Application mobile');
    });

    it('updates the application then navigates to the detail page', () => {
      component.form.patchValue({ name: 'PushIT Mobile V2' });

      component.save();

      expect(api.updateApp).toHaveBeenCalledWith(101, {
        name: 'PushIT Mobile V2',
        description: 'Application mobile',
      });
      expect(shell.loadShell).toHaveBeenCalledWith(101);
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/applications', 101]);
    });

    it('uploads a cropped logo for the edited application', () => {
      api.uploadAppLogo.and.returnValue(of(makeApplication({ logo: 'https://cdn/logo.png' })));
      const file = new File(['x'], 'logo.png', { type: 'image/png' });

      component.onLogoCropped(file);

      expect(api.uploadAppLogo).toHaveBeenCalledWith(101, file);
      expect(component.application()?.logo).toBe('https://cdn/logo.png');
    });

    it('removes the logo for the edited application', () => {
      api.deleteAppLogo.and.returnValue(of(void 0));

      component.removeLogo();

      expect(api.deleteAppLogo).toHaveBeenCalledWith(101);
      expect(component.application()?.logo).toBeNull();
    });
  });
});
