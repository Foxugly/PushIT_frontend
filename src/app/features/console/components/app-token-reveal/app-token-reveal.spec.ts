import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { makeApplication } from '../../../../../testing/console-fixtures';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { AppTokenReveal } from './app-token-reveal';

const qrCopy = {
  title: 'QR code du token',
  scanHint: 'Scannez ce QR.',
  downloadQr: 'Telecharger le QR',
  downloadToken: 'Telecharger le token',
  copyToken: 'Copier le token',
  copied: 'Token copie.',
  copyFailed: 'Copie impossible.',
  saveNotice: 'Token affiche une seule fois.',
  error: 'QR impossible.',
  loading: 'Generation...',
};

// A tiny but valid PNG blob so the FileReader produces a `data:image/png;base64,…`
// URL (the reveal renders that as the QR <img> and derives the download ext).
function pngBlob(): Blob {
  return new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' });
}

// FileReader.readAsDataURL resolves on the macrotask queue, which fakeAsync's
// tick() does not patch — poll the signal under real async instead.
async function waitForQr(component: AppTokenReveal): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    if (component.qrImageUrl() !== null || component.qrError() !== null) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('AppTokenReveal', () => {
  let fixture: ComponentFixture<AppTokenReveal>;
  let component: AppTokenReveal;
  let api: jasmine.SpyObj<PushitApiService>;

  async function setup(qrResponse = of(pngBlob())): Promise<void> {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['getAppQrCode']);
    api.getAppQrCode.and.returnValue(qrResponse);

    await TestBed.configureTestingModule({
      imports: [AppTokenReveal],
      providers: [
        provideNoopAnimations(),
        { provide: PushitApiService, useValue: api },
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

  it('fetches the QR for the app+token inputs and renders it as a data: URL', async () => {
    await setup();

    fixture.detectChanges();
    await waitForQr(component);
    fixture.detectChanges();

    expect(api.getAppQrCode).toHaveBeenCalledWith(101, 'apt_rawsecret123');
    expect(component.qrImageUrl()).toMatch(/^data:image\/png;base64,/);
    expect(component.qrError()).toBeNull();
    expect(component.qrLoading()).toBeFalse();

    const img = fixture.nativeElement.querySelector('img.app-qr__img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toMatch(/^data:image\/png;base64,/);
  });

  it('surfaces a QR error when the request fails', async () => {
    await setup(throwError(() => new Error('boom')));

    fixture.detectChanges();
    await waitForQr(component);
    fixture.detectChanges();

    expect(component.qrError()).toBe('QR impossible.');
    expect(component.qrImageUrl()).toBeNull();
    expect(fixture.nativeElement.querySelector('img.app-qr__img')).toBeNull();
  });

  it('copies the token via the clipboard API and shows the success banner', async () => {
    await setup();
    fixture.detectChanges();
    await waitForQr(component);

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
    await waitForQr(component);

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
    await waitForQr(component);

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    spyOn(document, 'execCommand').and.returnValue(false);

    await component.copyToken();

    expect(component.banner()).toBe('Copie impossible.');
  });

  it('downloads the QR image with an extension derived from its mime type', async () => {
    await setup();
    fixture.detectChanges();
    await waitForQr(component);
    expect(component.qrImageUrl()).toMatch(/^data:image\/png;base64,/);

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

    component.downloadQr();

    expect(clickSpy).toHaveBeenCalled();
    expect(anchor.download).toMatch(/_qrcode_token_PushIT_Mobile\.png$/);
    expect(anchor.href).toMatch(/^data:image\/png;base64,/);
  });

  it('does not download a QR before the image is ready', async () => {
    await setup(throwError(() => new Error('boom')));
    fixture.detectChanges();
    await waitForQr(component);

    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

    component.downloadQr();

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('downloads the raw token as a text data: URL', async () => {
    await setup();
    fixture.detectChanges();
    await waitForQr(component);

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
