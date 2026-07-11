import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { UserMe } from '../../models/api.models';
import { AppCopyService } from '../../services/app-copy.service';
import { PushitApiService } from '../../services/pushit-api.service';
import { SessionService } from '../../services/session.service';
import { UserMenu } from './user-menu';

describe('UserMenu', () => {
  let fixture: ComponentFixture<UserMenu>;
  let component: UserMenu;
  let session: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    user: ReturnType<typeof signal<UserMe | null>>;
    refreshToken: jasmine.Spy<() => string | null>;
    clear: jasmine.Spy<(redirect?: boolean) => void>;
  };
  let api: jasmine.SpyObj<PushitApiService>;

  beforeEach(async () => {
    session = {
      isAuthenticated: signal(false),
      user: signal<UserMe | null>(null),
      refreshToken: jasmine.createSpy('refreshToken').and.returnValue(null),
      clear: jasmine.createSpy('clear'),
    };
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['logout']);
    api.logout.and.returnValue(of(void 0));
    const appCopy = {
      current: signal({
        header: {
          login: 'Se connecter',
          settings: 'Settings',
          changePassword: 'Changer de mot de passe',
          logout: 'Deconnexion',
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [UserMenu],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: SessionService, useValue: session },
        { provide: PushitApiService, useValue: api },
        { provide: AppCopyService, useValue: appCopy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserMenu);
    component = fixture.componentInstance;
  });

  it('shows the login action when the user is not authenticated', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Se connecter');
  });

  it('shows the user email when the user is authenticated', () => {
    session.isAuthenticated.set(true);
    session.user.set({ id: 1, email: 'renaud@example.com', userkey: 'usr_123', is_active: true, language: 'FR' });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('renaud@example.com');
    expect(text).not.toContain('Se connecter');
  });

  it('clears the session immediately when no refresh token is available', () => {
    component.requestLogout();
    expect(api.logout).not.toHaveBeenCalled();
    expect(session.clear).toHaveBeenCalledWith(true);
  });

  it('logs out through the API when a refresh token exists', () => {
    session.refreshToken.and.returnValue('refresh-token');
    component.requestLogout();
    expect(api.logout).toHaveBeenCalledWith('refresh-token');
    expect(session.clear).toHaveBeenCalledWith(true);
  });
});
