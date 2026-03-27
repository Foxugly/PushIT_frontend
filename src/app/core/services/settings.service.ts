import { Injectable, inject, signal } from '@angular/core';

import { StorageService } from './storage.service';

const API_BASE_URL_KEY = 'pushit.apiBaseUrl';
const DEFAULT_API_BASE_URL = '/api/v1';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storage = inject(StorageService);
  private readonly apiBaseUrlSignal = signal(
    this.normalizeApiBaseUrl(this.storage.getString(API_BASE_URL_KEY) ?? DEFAULT_API_BASE_URL),
  );

  apiBaseUrl(): string {
    return this.apiBaseUrlSignal();
  }

  updateApiBaseUrl(value: string): void {
    const normalizedValue = this.normalizeApiBaseUrl(value);
    this.apiBaseUrlSignal.set(normalizedValue);
    this.storage.setString(API_BASE_URL_KEY, normalizedValue);
  }

  private normalizeApiBaseUrl(value: string): string {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return DEFAULT_API_BASE_URL;
    }

    if (
      trimmedValue === 'http://127.0.0.1:8000/api/v1' ||
      trimmedValue === 'http://localhost:8000/api/v1'
    ) {
      return DEFAULT_API_BASE_URL;
    }

    return trimmedValue.replace(/\/+$/, '');
  }
}
