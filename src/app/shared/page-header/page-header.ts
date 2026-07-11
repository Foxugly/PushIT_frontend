import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * En-tête de page partagé (fleet standard) : grille 3 colonnes (1fr · auto · 1fr).
 * Slot gauche = Retour / breadcrumbs ([slot=left]), centre = icône emerald + <h1>
 * centré (+ [slot=title-after] pour un badge), slot droite = actions ([slot=right]).
 * Se replie en une colonne sous 640px.
 */
@Component({
  selector: 'app-page-header',
  imports: [],
  template: `
    <div class="page-header">
      <div class="page-header__side page-header__side--left">
        <ng-content select="[slot=left]"></ng-content>
      </div>
      <div class="page-header__center">
        @if (icon()) {
          <i class="pi {{ icon() }}" aria-hidden="true"></i>
        }
        <h1>{{ title() }}</h1>
        <ng-content select="[slot=title-after]"></ng-content>
      </div>
      <div class="page-header__side page-header__side--right">
        <ng-content select="[slot=right]"></ng-content>
      </div>
    </div>
  `,
  styles: [
    `
      .page-header {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1.25rem;
      }
      .page-header__center {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        justify-self: center;
      }
      .page-header__center i {
        color: var(--accent);
        font-size: 1.25rem;
      }
      .page-header__center h1 {
        margin: 0;
        font-size: 1.4rem;
        color: var(--ink);
        text-align: center;
      }
      .page-header__side {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .page-header__side--right {
        justify-content: flex-end;
      }
      @media (max-width: 640px) {
        .page-header {
          grid-template-columns: 1fr;
        }
        .page-header__center {
          justify-self: start;
        }
        .page-header__center h1 {
          text-align: left;
        }
        .page-header__side--right {
          justify-content: flex-start;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeader {
  readonly icon = input('');
  readonly title = input('');
}
