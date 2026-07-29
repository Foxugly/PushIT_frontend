import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { makeApplication } from '../../../../../testing/console-fixtures';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { EnrolmentPanel } from './enrolment-panel';

describe('EnrolmentPanel', () => {
  let fixture: ComponentFixture<EnrolmentPanel>;
  let component: EnrolmentPanel;
  let api: jasmine.SpyObj<PushitApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', [
      'getEnrolmentQrCode',
      'rotateEnrolmentCode',
    ]);
    api.getEnrolmentQrCode.and.returnValue(of(new Blob(['qr'], { type: 'image/png' })));
    api.rotateEnrolmentCode.and.returnValue(
      of({
        app_id: 101,
        enrolment_code: 'apk_Zz99Yy88Xx77',
        enrolment_code_rotated_at: '2026-07-29T12:00:00Z',
      }),
    );

    const consoleCopy = {
      current: signal({
        enrolment: {
          intro: 'Ce code circule.',
          copy: 'Copier le code',
          copied: 'Code copie.',
          copyFailed: 'Copie impossible.',
          qrAlt: 'QR du code',
          qrLoading: 'Generation...',
          qrError: 'QR impossible.',
          scanHint: 'Faites scanner ce QR.',
          downloadQr: 'Telecharger le QR',
          rotate: 'Nouveau code',
          rotatePending: 'Generation...',
          rotateWarning: 'Un nouveau code ne retire personne.',
          rotateConfirm: 'Nouveau code pour {name} ?',
          rotated: 'Nouveau code genere.',
          rotateError: 'Generation impossible.',
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [EnrolmentPanel],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        { provide: PushitApiService, useValue: api },
        { provide: ConsoleCopyService, useValue: consoleCopy },
        { provide: AppConfirmService, useValue: { ask: () => Promise.resolve(true) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EnrolmentPanel);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('app', makeApplication());
    fixture.detectChanges();
  });

  it('shows the code permanently, in clear', () => {
    // It is not a secret: it goes to every recipient. Hiding it behind a reveal
    // would teach the opposite.
    const code = fixture.nativeElement.querySelector('[data-testid="enrolment-code"]');

    expect(code.textContent.trim()).toBe('apk_Ab12Cd34Ef56');
  });

  it('asks the QR of the enrolment code, with no secret from the caller', () => {
    expect(api.getEnrolmentQrCode).toHaveBeenCalledWith(101);
  });

  it('displays the new code after a rotation and tells the page', async () => {
    const rotated: string[] = [];
    component.rotated.subscribe((code) => rotated.push(code));

    await component.rotate();

    expect(api.rotateEnrolmentCode).toHaveBeenCalledWith(101);
    expect(component.currentCode()).toBe('apk_Zz99Yy88Xx77');
    expect(rotated).toEqual(['apk_Zz99Yy88Xx77']);
  });

  it('does not rotate when the confirmation is declined', async () => {
    const confirmService = TestBed.inject(AppConfirmService);
    spyOn(confirmService, 'ask').and.resolveTo(false);

    await component.rotate();

    expect(api.rotateEnrolmentCode).not.toHaveBeenCalled();
    expect(component.currentCode()).toBe('apk_Ab12Cd34Ef56');
  });

  it('warns that rotating evicts nobody', () => {
    // The moment you rotate is usually the moment you want somebody out.
    expect(fixture.nativeElement.textContent).toContain('Un nouveau code ne retire personne.');
  });
});
