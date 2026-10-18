import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import enCatalog from '../../../../../public/i18n/en.json';
import frCatalog from '../../../../../public/i18n/fr.json';
import { AppCopyService } from '../../../core/services/app-copy.service';
import { AccountDeletionPage } from './account-deletion-page';

describe('AccountDeletionPage', () => {
  const current = signal(frCatalog.app);

  beforeEach(async () => {
    current.set(frCatalog.app);
    await TestBed.configureTestingModule({
      imports: [AccountDeletionPage],
      providers: [provideRouter([]), { provide: AppCopyService, useValue: { current } }],
    }).compileComponents();
  });

  it('lists the steps, the deleted data and the fallback contact', () => {
    const fixture = TestBed.createComponent(AccountDeletionPage);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('h1')?.textContent).toBe(frCatalog.app.accountDeletion.title);
    expect(host.querySelectorAll('#steps li').length).toBe(frCatalog.app.accountDeletion.steps.length);
    expect(host.querySelectorAll('#deleted-data li').length).toBe(frCatalog.app.accountDeletion.deleted.length);
    expect(host.querySelector('#no-access')?.textContent).toContain('rvilain@foxugly.com');
    expect(host.querySelector('a[href="/privacy"]')).not.toBeNull();
  });

  it('follows the active language', () => {
    const fixture = TestBed.createComponent(AccountDeletionPage);
    fixture.detectChanges();

    current.set(enCatalog.app as typeof frCatalog.app);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toBe(
      'Delete your PushIT account',
    );
  });
});
