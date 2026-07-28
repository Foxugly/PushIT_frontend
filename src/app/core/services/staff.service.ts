import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { StaffUser, StaffUserPatch } from '../models/api.models';
import { SettingsService } from './settings.service';

/**
 * Back-office des comptes. Surface volontairement étroite : chercher un compte
 * et lui offrir (ou lui retirer) l'accès. Tout le reste — email, mot de passe,
 * activation, suppression — reste dans l'admin Django, et le serveur le refuse
 * explicitement ici.
 */
@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  /** Sans terme de recherche, le serveur renvoie les comptes déjà offerts. */
  users(query = ''): Observable<StaffUser[]> {
    const params = query ? new HttpParams().set('q', query) : undefined;
    return this.http
      .get<{ results: StaffUser[] }>(`${this.settings.apiBaseUrl()}/staff/users/`, { params })
      .pipe(map((body) => body.results ?? []));
  }

  update(userId: number, patch: StaffUserPatch): Observable<StaffUser> {
    return this.http.patch<StaffUser>(
      `${this.settings.apiBaseUrl()}/staff/users/${userId}/`,
      patch,
    );
  }
}
