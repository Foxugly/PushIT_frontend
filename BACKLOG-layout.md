# Backlog — harmonisation layout · PushIT_frontend

> **Cible :** `STANDARD-frontend-layout.md` (repo `foxugly-ops`).
> Le **plus éloigné** du standard (nommage `site-header`, pas de thème, pas de drawer,
> pas de page-header) — **mais** son CSS est déjà **propre** (ni Tailwind ni PrimeFlex → le modèle).
> **Statut :** à faire (audit 2026-07-10).

## ✅ Déjà conforme
- `[mode]` public/authenticated ; `app-user-menu` + login « Se connecter ».
- About en `p-tabs` ; Features en grille SCSS.
- **CSS propre** : aucun framework utilitaire (0 Tailwind, 0 PrimeFlex) — **la cible pour les autres**.

## Phase 1 — structurel (gros)
- [ ] **Topmenu** : renommer `app-site-header` → **`app-topmenu`**, déplacer `shared/site-header/` → **`core/layout/topmenu/`**, classes `site-header__*` → **BEM `topbar__*`**.
- [ ] **Thème** : ajouter **toggle + `ThemeService`** + dark mode (aujourd'hui `darkModeSelector:false`) → `.dark-mode`, `localStorage['theme']`, **anti-FOUC**. Placer avant la langue.
- [ ] **Responsive** : **empilement vertical → hamburger + drawer** à **1024**.
- [ ] **Shell** : `console-layout` / `public-layout` (feature-based) → **`core/layout/` `main`/`public-layout`** + **skip-link** + `<main class="main-container">` + `<p-toast>` unique.
- [ ] **Largeur** : `--content-max: 80rem` / `--content-pad: 1.5rem`, fonds pleine largeur.
- [ ] **Footer** : `shared/site-footer/` → **`app-footer` `core/layout/footer/`** + version runtime + dark.
- [ ] **Page-header** : **créer `app-page-header`** (aucun aujourd'hui) — 3 colonnes, slots.
- [ ] **Empty-state** : **créer `app-empty-state`** (absent).
- [ ] **Skeletons** : **ajouter** des états de chargement `p-skeleton` (absents).
- [ ] **Breakpoints** : 800 → échelle `sm 640 / md 768 / lg 1024 / xl 1280`.

## Phase 2 — i18n
- [ ] **Migrer l'i18n maison** (`AppCopyService`) → **Transloco**.
- [ ] Passer **3 → 5 langues** (ajouter `it` + `es`).
