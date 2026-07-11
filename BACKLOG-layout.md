# Backlog — harmonisation layout · PushIT_frontend

> **Cible :** `STANDARD-frontend-layout.md` (repo `foxugly-ops`).
> Le **plus éloigné** du standard (nommage `site-header`, pas de thème, pas de drawer,
> pas de page-header) — **mais** son CSS est déjà **propre** (ni Tailwind ni PrimeFlex → le modèle).
> **Statut :** standard **VALIDÉ 2026-07-11** (réf complète : `FoxRunner_frontend`). Travailler sur
> branche **`feat/scss-standard`** — **jamais `main`** (auto-deploy prod).
>
> **Fait (branche) :** tokens flotte copiés (`src/styles/_tokens.scss`, `_breakpoints.scss`) +
> importés dans `styles.scss` (additif). Les tokens sont prêts à être consommés par les phases ci-dessous.

## ✅ Déjà conforme
- `[mode]` public/authenticated ; `app-user-menu` + login « Se connecter ».
- About en `p-tabs` ; Features en grille SCSS.
- **CSS propre** : aucun framework utilitaire (0 Tailwind, 0 PrimeFlex) — **la cible pour les autres**.

## Phase 1 — structurel (gros) — partiellement MERGÉ + DÉPLOYÉ prod (2026-07-11)
- [x] **Thème** : `ThemeService` (clé `theme`, `.dark-mode`, `darkModeSelector:false→'.dark-mode'`), toggle rectangulaire (avant la langue), **anti-FOUC** inline. ✅ déployé.
- [x] **Shell** : **skip-link** (2 layouts + `<main id>`, clé `header.skipToContent` fr/nl/en) + `<p-toast>` déjà unique. ✅ déployé.
- [x] **Empty-state** : **`app-empty-state`** créé (`shared/`) + câblé (liste applications). ✅ déployé.
- [x] **Skeletons** : `p-skeleton` sur la liste applications. ✅ déployé. *(autres vues console = suivi)*
- [ ] **Topmenu** : renommer `app-site-header` → **`app-topmenu`**, déplacer `shared/site-header/` → **`core/layout/topmenu/`**, classes `site-header__*` → **BEM `topbar__*`**. *(organisationnel, non fait)*
- [ ] **Responsive** : empilement → hamburger + drawer à **1024**. *(à vérifier/ajuster)*
- [ ] **Shell (suite)** : déplacer les layouts feature-based → `core/layout/` + `<main class="main-container">` largeur tokens.
- [ ] **Footer** : `shared/site-footer/` → `core/layout/footer/` + version runtime + dark.
- [ ] **Page-header** : **créer `app-page-header`** (3 colonnes, slots) + câbler dans les pages.
- [ ] **Breakpoints** : échelle `sm 640 / md 768 / lg 1024 / xl 1280`.

## Phase 2 — i18n
- [x] **Migrer l'i18n maison** (`AppCopyService`) → **Transloco** ✅ MERGÉ + DÉPLOYÉ (PR #22, e2e vert).
  Extraction app/console/errors → catalogues JSON `core/i18n/catalogs/{fr,nl,en}.json` ; `provideTransloco` +
  loader bundlé ; `PublicI18nService` = autorité langue synchronisée avec Transloco ; façades typées sur `CATALOGS`
  (0 churn des 636 accès) ; ~1400 L de const supprimées.
- [ ] **about/privacy** : migrer vers catalogues (interpolation `${CONTACT_EMAIL}` à résoudre).
- [ ] Passer **3 → 5 langues** (ajouter `it` + `es` : ~674 chaînes × 2, trad machine à relire ; MAJ `availableLangs`,
  `LanguageCode`, `language-menu`).
