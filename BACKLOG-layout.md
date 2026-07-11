# Backlog — harmonisation layout · PushIT_frontend

> **Cible :** `STANDARD-frontend-layout.md` (repo `foxugly-ops`) ; réf = `FoxRunner_frontend`.
> **Statut : ✅ ~100 % CONFORME — MERGÉ + DÉPLOYÉ** (audit 2026-07-11).

**Aucune tâche restante.** Fait + déployé :
- Design tokens sémantiques + breakpoints ; couleurs en dur tokenisées.
- Thème + dark mode (`ThemeService`, `darkModeSelector`, anti-FOUC), toggle rectangulaire.
- Chrome : `app-topmenu` (`core/layout`, BEM `topbar__`, `[mode]`, hamburger drawer 1024),
  `app-user-menu`, `app-footer` (`core/layout`, version runtime).
- Shell : skip-link + `<main id>` ; `app-empty-state` + skeletons (liste applications).
- **i18n Transloco 5 langues** (fr/nl/en/it/es) : moteur + catalogues JSON (app/console/errors) +
  about/privacy traduits. it/es = langues d'UI (backend `UserLanguage`=FR/NL/EN).
- **`app-page-header`** (3-col + slots) sur les 12 pages console ; `console-detail-header` supprimé.

_Note : it/es non persistés côté serveur (enum backend limité à FR/NL/EN) — langues d'interface uniquement._
