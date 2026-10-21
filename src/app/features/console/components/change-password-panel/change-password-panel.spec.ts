import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { Mock, vi } from 'vitest';

import { PasswordChangeResponse, UserMe } from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { SessionService } from '../../../../core/services/session.service';
import { provideTestCatalogs } from '../../../../../testing/catalog-store.testing';
import frCatalog from '../../../../../../public/i18n/fr.json';
import { ChangePasswordPanel } from './change-password-panel';

const COPY = frCatalog.app.console.changePassword;
const SECURITY_TITLE = frCatalog.app.console.settings.securityTitle;

const user: UserMe = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR',
};

const success: PasswordChangeResponse = {
  code: 'password_changed',
  detail: 'Your password has been changed.',
  access: 'access-new',
  user,
};

function httpError(status: number, body: unknown): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: body }));
}

describe('ChangePasswordPanel', () => {
  let fixture: ComponentFixture<ChangePasswordPanel>;
  let component: ChangePasswordPanel;
  let changePassword: Mock;
  let adoptTokens: Mock;

  beforeEach(async () => {
    changePassword = vi.fn().mockReturnValue(of(success));
    adoptTokens = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ChangePasswordPanel],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideTestCatalogs(),
        { provide: PushitApiService, useValue: { changePassword } },
        { provide: SessionService, useValue: { adoptTokens } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangePasswordPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function fill(current: string, next: string, confirm = next): void {
    component.form.setValue({ currentPassword: current, newPassword: next, confirmPassword: confirm });
  }

  function text(): string {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('is the « Sécurité » card, reachable through the #security anchor', () => {
    const root = fixture.nativeElement as HTMLElement;
    const card = root.querySelector('#security');

    expect(card?.classList).toContain('console-card');
    expect(card?.querySelector('h3')?.textContent?.trim()).toBe(SECURITY_TITLE);
    expect(root.querySelector('h1')).toBeNull();
    expect(root.textContent).toContain(COPY.intro);
  });

  it('renders three password fields wired to labels with the right autocomplete', () => {
    const root = fixture.nativeElement as HTMLElement;
    const current = root.querySelector<HTMLInputElement>('#change-password-current');
    const next = root.querySelector<HTMLInputElement>('#change-password-new');
    const confirm = root.querySelector<HTMLInputElement>('#change-password-confirm');

    expect(current?.getAttribute('autocomplete')).toBe('current-password');
    expect(next?.getAttribute('autocomplete')).toBe('new-password');
    expect(confirm?.getAttribute('autocomplete')).toBe('new-password');
    expect(root.querySelector('label[for="change-password-current"]')?.textContent).toContain(
      COPY.currentPassword,
    );
    expect(current?.getAttribute('placeholder')).toBeNull();
  });

  it('does not call the API while the form is invalid', () => {
    component.submit();

    expect(changePassword).not.toHaveBeenCalled();
    expect(text()).toContain(COPY.required);
  });

  it('flags a short new password and a mismatching confirmation', () => {
    fill('old-password', 'short', 'other');
    component.form.markAllAsTouched();

    component.submit();

    expect(changePassword).not.toHaveBeenCalled();
    expect(text()).toContain(COPY.passwordTooShort);
    expect(text()).toContain(COPY.passwordMismatch);
  });

  it('posts the payload, adopts the returned tokens and shows the success message', () => {
    fill('old-password', 'NewSecret123!');

    component.submit();

    expect(changePassword).toHaveBeenCalledWith({
      current_password: 'old-password',
      new_password: 'NewSecret123!',
    });
    expect(adoptTokens).toHaveBeenCalledWith(success);
    expect(component.form.getRawValue()).toEqual({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    expect(text()).toContain(COPY.success);
    expect(component.pending()).toBe(false);
  });

  it('keeps the button busy while the request is in flight', () => {
    const pending$ = new Subject<PasswordChangeResponse>();
    changePassword.mockReturnValue(pending$);
    fill('old-password', 'NewSecret123!');

    component.submit();
    expect(component.pending()).toBe(true);

    pending$.next(success);
    pending$.complete();
    expect(component.pending()).toBe(false);
  });

  const cases: Array<[string, unknown, number, string]> = [
    ['current_password_invalid', { code: 'current_password_invalid', detail: 'x' }, 400, COPY.errors.currentPasswordInvalid],
    ['password_unchanged', { code: 'password_unchanged', detail: 'x' }, 400, COPY.errors.passwordUnchanged],
    ['validation_error', { code: 'validation_error', detail: 'x', errors: {} }, 400, COPY.errors.validation],
    ['throttled', { code: 'throttled', detail: 'x' }, 429, COPY.errors.throttled],
  ];

  for (const [code, body, status, expected] of cases) {
    it(`maps ${code} to its translated message and keeps the session untouched`, () => {
      changePassword.mockReturnValue(httpError(status, body));
      fill('old-password', 'NewSecret123!');

      component.submit();

      expect(text()).toContain(expected);
      expect(adoptTokens).not.toHaveBeenCalled();
    });
  }

  it('lists the validator messages returned with password_invalid', () => {
    changePassword.mockReturnValue(
      httpError(400, {
        code: 'password_invalid',
        detail: 'This password is too common.',
        errors: { new_password: ['This password is too common.'] },
      }),
    );
    fill('old-password', 'password123');

    component.submit();

    const content = text();
    expect(content).toContain(COPY.errors.passwordInvalid);
    expect(content).toContain('This password is too common.');
  });

  it('falls back to the generic localized message for a server error', () => {
    changePassword.mockReturnValue(httpError(500, 'boom'));
    fill('old-password', 'NewSecret123!');

    component.submit();

    expect(text()).toContain(frCatalog.errors.http['500']);
    expect(component.knownErrorKey()).toBeNull();
  });
});
