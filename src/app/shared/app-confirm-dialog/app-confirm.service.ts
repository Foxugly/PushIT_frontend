import { Injectable, computed, signal } from '@angular/core';

type ConfirmRequest = {
  title: string;
  message: string;
  acceptLabel: string;
  rejectLabel: string;
  resolve: (accepted: boolean) => void;
};

export type ConfirmOptions = {
  title?: string;
  message: string;
  acceptLabel?: string;
  rejectLabel?: string;
};

@Injectable({ providedIn: 'root' })
export class AppConfirmService {
  private readonly request = signal<ConfirmRequest | null>(null);

  readonly current = computed(() => this.request());

  ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.request.set({
        title: options.title ?? 'Confirmation',
        message: options.message,
        acceptLabel: options.acceptLabel ?? 'Confirmer',
        rejectLabel: options.rejectLabel ?? 'Annuler',
        resolve,
      });
    });
  }

  accept(): void {
    const current = this.request();
    if (!current) {
      return;
    }

    current.resolve(true);
    this.request.set(null);
  }

  reject(): void {
    const current = this.request();
    if (!current) {
      return;
    }

    current.resolve(false);
    this.request.set(null);
  }
}
