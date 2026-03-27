import { Injectable } from '@angular/core';

type StorageScope = 'local' | 'session';

@Injectable({ providedIn: 'root' })
export class StorageService {
  getString(key: string, scope: StorageScope = 'local'): string | null {
    return this.resolveStorage(scope).getItem(key);
  }

  setString(key: string, value: string, scope: StorageScope = 'local'): void {
    this.resolveStorage(scope).setItem(key, value);
  }

  remove(key: string, scope: StorageScope | 'both' = 'local'): void {
    if (scope === 'both') {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
      return;
    }

    this.resolveStorage(scope).removeItem(key);
  }

  getObject<T>(key: string, scope: StorageScope = 'local'): T | null {
    const rawValue = this.resolveStorage(scope).getItem(key);
    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return null;
    }
  }

  setObject<T>(key: string, value: T, scope: StorageScope = 'local'): void {
    this.resolveStorage(scope).setItem(key, JSON.stringify(value));
  }

  findString(key: string): { value: string; scope: StorageScope } | null {
    const localValue = localStorage.getItem(key);
    if (localValue) {
      return { value: localValue, scope: 'local' };
    }

    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) {
      return { value: sessionValue, scope: 'session' };
    }

    return null;
  }

  findObject<T>(key: string): { value: T; scope: StorageScope } | null {
    const localValue = this.getObject<T>(key, 'local');
    if (localValue) {
      return { value: localValue, scope: 'local' };
    }

    const sessionValue = this.getObject<T>(key, 'session');
    if (sessionValue) {
      return { value: sessionValue, scope: 'session' };
    }

    return null;
  }

  private resolveStorage(scope: StorageScope): Storage {
    return scope === 'local' ? localStorage : sessionStorage;
  }
}
