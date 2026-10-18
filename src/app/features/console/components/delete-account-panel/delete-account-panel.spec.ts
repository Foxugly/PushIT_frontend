import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject, of, throwError } from 'rxjs';

import frCatalog from '../../../../../../public/i18n/fr.json';
import { CatalogStore } from '../../../../core/i18n/catalog-store';
import { AppCopyService } from '../../../../core/services/app-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { SessionService } from '../../../../core/services/session.service';
import { DeleteAccountPanel } from './delete-account-panel';

const COPY = frCatalog.app.console.settings.deleteAccount;

function apiError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('DeleteAccountPanel', () => {
  let fixture: ComponentFixture<DeleteAccountPanel>;
  let component: DeleteAccountPanel;
  let api: { deleteMe: ReturnType<typeof vi.fn> };
  let session: { clear: ReturnType<typeof vi.fn> };
  let shell: { clearGeneratedToken: ReturnType<typeof vi.fn> };
  let messages: { add: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    api = { deleteMe: vi.fn() };
    session = { clear: vi.fn() };
    shell = { clearGeneratedToken: vi.fn() };
    messages = { add: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [DeleteAccountPanel],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: PushitApiService, useValue: api },
        { provide: SessionService, useValue: session },
        { provide: ConsoleShellService, useValue: shell },
        { provide: MessageService, useValue: messages },
        { provide: AppCopyService, useValue: { current: signal(frCatalog.app) } },
        { provide: CatalogStore, useValue: { get: () => frCatalog } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(DeleteAccountPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function openWithPassword(password: string): void {
    component.open();
    component.password.setValue(password);
  }

  it('renders the section with its button and the public info link', () => {
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain(COPY.title);
    expect(host.querySelector('a[href="/account-deletion"]')?.textContent).toContain(COPY.moreInfo);
  });

  it('does not call the API without a password', () => {
    openWithPassword('');
    component.submit();

    expect(api.deleteMe).not.toHaveBeenCalled();
    expect(component.error()).toBe(COPY.passwordRequired);
  });

  it('sends the current password, clears the session and goes home on 204', async () => {
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    api.deleteMe.mockReturnValue(of(undefined));

    openWithPassword('hunter2');
    component.submit();

    expect(api.deleteMe).toHaveBeenCalledWith('hunter2');
    expect(shell.clearGeneratedToken).toHaveBeenCalled();
    // Refresh tokens are blacklisted server-side: drop locally, no redirect to /auth.
    expect(session.clear).toHaveBeenCalledWith();
    expect(navigate).toHaveBeenCalledWith('/');
    expect(component.pending()).toBe(false);

    await Promise.resolve();
    TestBed.tick();
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: COPY.success }),
    );
  });

  it('maps current_password_invalid to the translated message and keeps the session', () => {
    api.deleteMe.mockReturnValue(
      throwError(() => apiError(400, { code: 'current_password_invalid', detail: 'Current password is incorrect.' })),
    );

    openWithPassword('wrong');
    component.submit();

    expect(component.error()).toBe(COPY.passwordInvalid);
    expect(session.clear).not.toHaveBeenCalled();
    expect(component.pending()).toBe(false);
  });

  it('maps billing_unavailable to the translated message and keeps the session', () => {
    api.deleteMe.mockReturnValue(
      throwError(() => apiError(503, { code: 'billing_unavailable', detail: 'Billing down.' })),
    );

    openWithPassword('hunter2');
    component.submit();

    expect(component.error()).toBe(COPY.billingUnavailable);
    expect(session.clear).not.toHaveBeenCalled();
    expect(component.pending()).toBe(false);
  });

  it('maps validation_error to the password-required message', () => {
    api.deleteMe.mockReturnValue(
      throwError(() => apiError(400, { code: 'validation_error', detail: 'Invalid', errors: { current_password: ['x'] } })),
    );

    openWithPassword('x');
    component.submit();

    expect(component.error()).toBe(COPY.passwordRequired);
  });

  it('falls back to the localized HTTP message for other failures', () => {
    api.deleteMe.mockReturnValue(throwError(() => apiError(429, null)));

    openWithPassword('hunter2');
    component.submit();

    expect(component.error()).toBe(frCatalog.errors.http['429']);
  });

  it('ignores a second submit while the request is in flight', () => {
    const pending$ = new Subject<void>();
    api.deleteMe.mockReturnValue(pending$);

    openWithPassword('hunter2');
    component.submit();
    component.submit();
    component.cancel();

    expect(api.deleteMe).toHaveBeenCalledTimes(1);
    expect(component.pending()).toBe(true);
  });

  it('resets the password and error each time the dialog opens', () => {
    openWithPassword('');
    component.submit();
    component.password.setValue('typed');

    component.open();

    expect(component.password.value).toBe('');
    expect(component.error()).toBeNull();
  });
});
