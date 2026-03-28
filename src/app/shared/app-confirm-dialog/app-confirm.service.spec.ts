import { TestBed } from '@angular/core/testing';

import { AppConfirmService } from './app-confirm.service';

describe('AppConfirmService', () => {
  let service: AppConfirmService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AppConfirmService],
    });

    service = TestBed.inject(AppConfirmService);
  });

  it('creates a confirmation request with default labels', async () => {
    const pending = service.ask({ message: 'Supprimer ?' });

    expect(service.current()).toEqual(
      jasmine.objectContaining({
        title: 'Confirmation',
        message: 'Supprimer ?',
        acceptLabel: 'Confirmer',
        rejectLabel: 'Annuler',
      }),
    );

    service.accept();

    await expectAsync(pending).toBeResolvedTo(true);
    expect(service.current()).toBeNull();
  });

  it('resolves false when the request is rejected', async () => {
    const pending = service.ask({
      title: 'Attention',
      message: 'Annuler la suppression ?',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
    });

    service.reject();

    await expectAsync(pending).toBeResolvedTo(false);
    expect(service.current()).toBeNull();
  });

  it('ignores accept/reject when no request is pending', () => {
    expect(() => service.accept()).not.toThrow();
    expect(() => service.reject()).not.toThrow();
  });
});
