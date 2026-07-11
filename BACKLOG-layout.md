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
  about/privacy traduits. it/es **persistés côté serveur** (enum `UserLanguage` étendu IT/ES sur PushIT_server).
- **`app-page-header`** (3-col + slots) sur les 12 pages console ; `console-detail-header` supprimé.
- Login : toggle thème **borderless** (aligné sur le trigger langue) ; rangée **meta unique**
  (« Se souvenir de moi » à gauche + « Mot de passe oublié ? » à droite), lien inscription sous la carte
  (conformité flotte 2026-07-12).

## Reste (différé)
- **Bouton magic-link inline sur le login** (standard §Pages d'auth, point 6) : **DIFFÉRÉ — besoin backend.**
  PushIT n'a **aucun flux passwordless / lien de connexion** (aucun service `magic`/`login-link` côté
  `PushIT_server`). On n'ajoute pas de bouton non fonctionnel : à implémenter côté serveur d'abord
  (endpoint demande de lien + page de vérification `/magic-link`), puis carte login en mode magic inline.
