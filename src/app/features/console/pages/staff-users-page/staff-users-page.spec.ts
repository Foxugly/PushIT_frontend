import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { StaffUser } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { StaffService } from '../../../../core/services/staff.service';
import { StaffUsersPage } from './staff-users-page';

const STAFF_COPY = {
  title: 'Comptes',
  lead: 'Lead',
  searchPlaceholder: 'Email',
  search: 'Chercher',
  noMatch: 'Aucun compte ne correspond.',
  noneOffered: "Aucun compte n'a d'acces offert.",
  offered: 'Acces offert',
  unconfirmed: 'Email non confirme',
  inactive: 'Desactive',
  notePlaceholder: 'Pourquoi ?',
  saved: 'Enregistre.',
  scopeNote: 'Seul l acces offert est modifiable ici.',
  fields: { email: 'Compte', access: 'Acces offert', note: 'Note', grantedAt: 'Offert le' },
};

function makeUser(overrides: Partial<StaffUser> = {}): StaffUser {
  return {
    id: 7,
    email: 'client@example.com',
    userkey: 'usr_abc',
    is_active: true,
    email_confirmed: true,
    subscription_bypass: false,
    bypass_note: '',
    bypass_granted_at: null,
    ...overrides,
  };
}

describe('StaffUsersPage', () => {
  let fixture: ComponentFixture<StaffUsersPage>;
  let component: StaffUsersPage;
  let staff: jasmine.SpyObj<StaffService>;

  async function setup(users: StaffUser[] = [makeUser()]): Promise<void> {
    staff = jasmine.createSpyObj<StaffService>('StaffService', ['users', 'update']);
    staff.users.and.returnValue(of(users));

    await TestBed.configureTestingModule({
      imports: [StaffUsersPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StaffService, useValue: staff },
        { provide: ConsoleCopyService, useValue: { current: signal({ staffUsers: STAFF_COPY }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffUsersPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('lists the already-offered accounts on arrival', async () => {
    // Sans terme de recherche, le serveur repond « a qui ai-je donne quoi ».
    await setup();

    expect(staff.users).toHaveBeenCalledWith('');
    expect(component.users().length).toBe(1);
  });

  it('sends the note along with the toggle', async () => {
    // C'est au moment de l'octroi que la note a du sens : le journal serveur
    // l'enregistre avec lui.
    await setup();
    staff.update.and.returnValue(of(makeUser({ subscription_bypass: true, bypass_note: 'partenaire' })));

    component.setNote(7, 'partenaire');
    component.toggle(makeUser(), true);

    expect(staff.update).toHaveBeenCalledWith(7, {
      subscription_bypass: true,
      bypass_note: 'partenaire',
    });
  });

  it('editing a note alone never touches the access flag', async () => {
    // Sinon corriger une faute de frappe revoquerait un acces.
    await setup();
    staff.update.and.returnValue(of(makeUser({ bypass_note: 'corrige' })));

    component.setNote(7, 'corrige');
    component.saveNote(makeUser());

    expect(staff.update).toHaveBeenCalledWith(7, { bypass_note: 'corrige' });
  });

  it('shows what the server recorded, not what was asked', async () => {
    // La date d'octroi est horodatee par le serveur : la deviner l'afficherait faux.
    await setup();
    staff.update.and.returnValue(
      of(makeUser({ subscription_bypass: true, bypass_granted_at: '2026-07-28T10:00:00Z' })),
    );

    component.toggle(makeUser(), true);

    expect(component.users()[0].bypass_granted_at).toBe('2026-07-28T10:00:00Z');
    expect(component.notice()).toBe('Enregistre.');
  });

  it('reloads after a failed toggle so the switch cannot lie', async () => {
    // Laisser l'interrupteur sur une position que le serveur a refusee ferait
    // croire a un acces offert qui n'existe pas.
    await setup();
    staff.update.and.returnValue(throwError(() => new Error('refused')));
    staff.users.calls.reset();

    component.toggle(makeUser(), true);

    expect(component.error()).not.toBeNull();
    expect(staff.users).toHaveBeenCalled();
  });

  it('surfaces a search failure instead of showing an empty list', async () => {
    await setup();
    staff.users.and.returnValue(throwError(() => new Error('down')));

    component.search();

    expect(component.error()).not.toBeNull();
    expect(component.loading()).toBe(false);
  });

  it('passes the trimmed query to the server', async () => {
    await setup();
    staff.users.calls.reset();

    component.query = '  client@  ';
    component.search();

    expect(staff.users).toHaveBeenCalledWith('client@');
  });
});
