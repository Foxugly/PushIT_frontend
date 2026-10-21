import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { makeApplication } from '../../../../../testing/console-fixtures';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { AppTokenReveal } from './app-token-reveal';

const qrCopy = {
  downloadToken: 'Telecharger le token',
  copyToken: 'Copier le token',
  copied: 'Token copie.',
  copyFailed: 'Copie impossible.',
  saveNotice: 'Token affiche une seule fois.',
};

describe('AppTokenReveal', () => {
  let fixture: ComponentFixture<AppTokenReveal>;
  let component: AppTokenReveal;

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AppTokenReveal],
      providers: [
        provideNoopAnimations(),
        {
          provide: ConsoleCopyService,
          useValue: { current: signal({ applications: { qr: qrCopy } }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppTokenReveal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('app', makeApplication());
    fixture.componentRef.setInput('token', 'apt_rawsecret123');
  }

  it('shows the raw token and no QR code (only the enrolment QR is scannable)', async () => {
    await setup();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('apt_rawsecret123');
    expect(fixture.nativeElement.textContent).toContain('Token affiche une seule fois.');
  });

  it('copies the token via the clipboard API and shows the success banner', async () => {
    await setup();
    fixture.detectChanges();

    const clipboard = jasmine.createSpyObj<Clipboard>('Clipboard', ['writeText']);
    clipboard.writeText.and.resolveTo();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });

    await component.copyToken();

    expect(clipboard.writeText).toHaveBeenCalledWith('apt_rawsecret123');
    expect(component.banner()).toBe('Token copie.');
  });

  it('falls back to execCommand when the clipboard API is unavailable', async () => {
    await setup();
    fixture.detectChanges();

    // Remove the async clipboard API so the component takes the fallback path.
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const execSpy = spyOn(document, 'execCommand').and.returnValue(true);

    await component.copyToken();

    expect(execSpy).toHaveBeenCalledWith('copy');
    expect(component.banner()).toBe('Token copie.');
  });

  it('reports a copy failure when execCommand returns false', async () => {
    await setup();
    fixture.detectChanges();

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    spyOn(document, 'execCommand').and.returnValue(false);

    await component.copyToken();

    expect(component.banner()).toBe('Copie impossible.');
  });

  it('downloads the raw token as a text data: URL', async () => {
    await setup();
    fixture.detectChanges();

    const anchor = document.createElement('a');
    const clickSpy = spyOn(anchor, 'click');
    // Ne detourner QUE la creation de <a>. Un stub inconditionnel renvoyait
    // l'ancre a tout appelant, y compris au rendu interne d'Angular, qui
    // tentait de l'inserer dans sa propre arborescence -> jsdom levait
    // HierarchyRequestError. karma ne le voyait pas : rien d'autre n'appelait
    // createElement pendant ces tests.
    const realCreateElement = document.createElement.bind(document);
    spyOn(document, 'createElement').and.callFake((tag: string) =>
      tag === 'a' ? anchor : realCreateElement(tag),
    );

    component.downloadToken();

    expect(clickSpy).toHaveBeenCalled();
    expect(anchor.download).toMatch(/_token_PushIT_Mobile\.txt$/);
    expect(anchor.href).toContain('data:text/plain;charset=utf-8,');
    expect(decodeURIComponent(anchor.href)).toContain('apt_rawsecret123');
  });
});
