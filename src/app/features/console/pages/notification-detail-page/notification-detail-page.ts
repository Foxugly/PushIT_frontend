import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import {
  ApiErrorResponse,
  NotificationRead,
  NotificationStatus,
} from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { coerceApiError } from '../../../../core/utils/api-error.utils';

@Component({
  selector: 'app-notification-detail-page',
  imports: [CommonModule, RouterLink, DatePipe, ButtonModule, TagModule],
  templateUrl: './notification-detail-page.html',
  styleUrl: './notification-detail-page.scss',
})
export class NotificationDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PushitApiService);

  readonly notification = signal<NotificationRead | null>(null);
  readonly isFuture = signal(false);
  readonly loading = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);

  ngOnInit(): void {
    const notificationId = Number(this.route.snapshot.paramMap.get('notificationId'));
    if (!Number.isFinite(notificationId) || notificationId <= 0) {
      this.error.set({
        code: 'invalid_notification_id',
        detail: 'Identifiant notification invalide.',
      });
      return;
    }

    this.loadNotification(notificationId);
  }

  isShifted(notification: NotificationRead): boolean {
    return Boolean(
      notification.scheduled_for &&
        notification.effective_scheduled_for &&
        notification.scheduled_for !== notification.effective_scheduled_for,
    );
  }

  notificationSeverity(notification: NotificationRead): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    if (this.isShifted(notification)) {
      return 'warn';
    }

    switch (notification.status) {
      case 'sent':
        return 'success';
      case 'queued':
      case 'processing':
        return 'info';
      case 'failed':
      case 'partial':
        return 'danger';
      case 'scheduled':
        return 'warn';
      default:
        return 'secondary';
    }
  }

  statusBadgeSeverity(status: NotificationStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    switch (status) {
      case 'sent':
        return 'success';
      case 'queued':
      case 'processing':
        return 'info';
      case 'scheduled':
        return 'warn';
      case 'failed':
      case 'partial':
        return 'danger';
      case 'no_target':
        return 'contrast';
      default:
        return 'secondary';
    }
  }

  private loadNotification(notificationId: number): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      notification: this.api.getNotification(notificationId),
      futureNotification: this.api.getFutureNotification(notificationId).pipe(catchError(() => of(null))),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ notification, futureNotification }) => {
          this.notification.set(futureNotification ?? notification);
          this.isFuture.set(Boolean(futureNotification));
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }
}
