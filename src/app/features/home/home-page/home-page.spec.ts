import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppCopyService } from '../../../core/services/app-copy.service';
import { SessionService } from '../../../core/services/session.service';
import { HomePage } from './home-page';

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;
  const isAuthenticated = signal(false);

  beforeEach(async () => {
    isAuthenticated.set(false);
    const appCopy = {
      current: signal({
        home: {
          title: 'Title',
          description: 'Description',
          login: 'Se connecter',
          register: 'Créer un compte',
          contact: 'Me contacter',
          dashboard: 'Tableau de bord',
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: { isAuthenticated } },
        { provide: AppCopyService, useValue: appCopy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
  });

  function actionLabels(): string[] {
    const actions = fixture.nativeElement.querySelector('.hero__actions') as HTMLElement;
    return Array.from(actions.querySelectorAll('button')).map((b) => b.textContent!.trim());
  }

  it('shows exactly login, register and contact actions to a visitor', () => {
    fixture.detectChanges();
    expect(actionLabels()).toEqual(['Se connecter', 'Créer un compte', 'Me contacter']);
  });

  it('has no eyebrow and no embedded register form', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.public-badge, .public-eyebrow')).toBeNull();
    expect(el.querySelector('app-register-panel')).toBeNull();
  });

  it('replaces login/register with the dashboard link once signed in', () => {
    isAuthenticated.set(true);
    fixture.detectChanges();
    expect(actionLabels()).toEqual(['Tableau de bord', 'Me contacter']);
  });
});
