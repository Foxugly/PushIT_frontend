import { TestBed } from '@angular/core/testing';

import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

describe('SettingsService', () => {
  let storage: jasmine.SpyObj<StorageService>;

  function createService(storedValue: string | null = null): SettingsService {
    storage = jasmine.createSpyObj<StorageService>('StorageService', ['getString', 'setString']);
    storage.getString.and.returnValue(storedValue);

    TestBed.configureTestingModule({
      providers: [SettingsService, { provide: StorageService, useValue: storage }],
    });

    return TestBed.inject(SettingsService);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('uses the runtime config api base url when storage is empty', () => {
    const service = createService();

    // Aucun global injecté en test → défaut inline du runtime-config = '/api/v1'.
    expect(service.apiBaseUrl()).toBe('/api/v1');
  });

  it('prefers a runtime-injected api base url over the inline default', () => {
    (globalThis as unknown as { __PUSHIT_API_BASE_URL?: string }).__PUSHIT_API_BASE_URL =
      'https://pushit-api.foxugly.com/api/v1';
    try {
      const service = createService();
      expect(service.apiBaseUrl()).toBe('https://pushit-api.foxugly.com/api/v1');
    } finally {
      delete (globalThis as unknown as { __PUSHIT_API_BASE_URL?: string }).__PUSHIT_API_BASE_URL;
    }
  });

  it('normalizes localhost backend urls to the dev proxy path', () => {
    const service = createService();

    service.updateApiBaseUrl('http://127.0.0.1:8000/api/v1');

    expect(service.apiBaseUrl()).toBe('/api/v1');
    expect(storage.setString).toHaveBeenCalledWith('pushit.apiBaseUrl', '/api/v1');
  });

  it('trims trailing slashes on custom backend urls', () => {
    const service = createService();

    service.updateApiBaseUrl(' https://api.pushit.test/v1/// ');

    expect(service.apiBaseUrl()).toBe('https://api.pushit.test/v1');
    expect(storage.setString).toHaveBeenCalledWith(
      'pushit.apiBaseUrl',
      'https://api.pushit.test/v1',
    );
  });
});
