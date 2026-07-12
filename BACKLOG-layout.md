# Backlog — harmonisation layout · PushIT_frontend

> **Cible :** `STANDARD-frontend-layout.md` (repo `foxugly-ops`) ; réf = `FoxRunner_frontend`.
> **Statut : ✅ 100 % CONFORME — MERGÉ + DÉPLOYÉ** (2026-07-12).

**Aucune tâche restante.** Fait + déployé :
- Design tokens sémantiques + breakpoints ; couleurs en dur tokenisées.
- Thème + dark mode (`ThemeService`, `darkModeSelector`, anti-FOUC), toggle rectangulaire.
- Chrome : `app-topmenu` (`core/layout`, BEM `topbar__`, `[mode]`, hamburger drawer 1024),
  `app-user-menu`, `app-footer` (`core/layout`, version runtime).
- Shell : skip-link + `<main id>` ; `app-empty-state` + skeletons (liste applications).
- **i18n Transloco 5 langues** (fr/nl/en/it/es) : moteur + catalogues JSON (app/console/errors) +
  about/privacy traduits. it/es **persistés côté serveur** (enum `UserLanguage` étendu IT/ES sur PushIT_server).
- **`app-page-header`** (3-col + slots) sur les 12 pages console ; `console-detail-header` supprimé.
- Login : toggle thème **borderless** (aligné sur le trigger langue) ; rangée **meta unique**
  (« Se souvenir de moi » à gauche + « Mot de passe oublié ? » à droite), lien inscription sous la carte
  (conformité flotte 2026-07-12).

- **Lien magique (passwordless) — FAIT + déployé 2026-07-12** : backend `PushIT_server` (modèle
  `MagicLinkToken` single-use+TTL, endpoints request anti-énumération + verify→JWT, Turnstile fail-closed,
  calqué sur Poker_server) + front (bouton « ou » → mode magic inline avec Turnstile, page de vérif
  `/auth/magic-link/:token`). Build + 119 unit + 19 e2e verts.

## ✅ Audit profond 2026-07-12 (déployé)
- Token **`--chrome-accent`** ajouté ; lien nav actif du chrome = tint translucide (`color-mix`) via le token.
- **`app-language-menu` → `app-language-switcher`** (dossier/selector/classe renommés, usages mis à jour).
- **`p-toast` monté à la racine du shell** (`console-layout` + `public-layout`, `MessageService` au root) au lieu
  d'être local à `notifications-page`.
- Topmenu : blocs restants (`.brand`/`.nav`…) renommés en **BEM `topbar__*`**.
- **Breakpoints éparses** `720/960px` → 768/1024 (échelle canonique).

**Aucune tâche restante.**
