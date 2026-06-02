import { Injectable, inject, signal } from '@angular/core';

import { getRuntimeConfig } from '../runtime-config';
import { StorageService } from './storage.service';

const API_BASE_URL_KEY = 'pushit.apiBaseUrl';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storage = inject(StorageService);
  private readonly defaultApiBaseUrl = getRuntimeConfig().apiBaseUrl;
  private readonly apiBaseUrlSignal = signal(
    this.normalizeApiBaseUrl(this.storage.getString(API_BASE_URL_KEY) ?? this.defaultApiBaseUrl),
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
      return this.defaultApiBaseUrl;
    }

    if (
      trimmedValue === 'http://127.0.0.1:8000/api/v1' ||
      trimmedValue === 'http://localhost:8000/api/v1'
    ) {
      return this.defaultApiBaseUrl;
    }

    return trimmedValue.replace(/\/+$/, '');
  }
}
