# BACKLOG — PushIT_frontend (Angular 20)

Issu d'une revue de session (2026-06-14). Sévérités : **P1** important · **P2/P3** à nettoyer.
Le travail coché est commité/poussé sur `Foxugly/PushIT_frontend` (`main`, CI verte, e2e gate).

---

## ✅ Fait le 2026-06-14

- [x] **Logo par application** — upload/preview/remove dans la console (dialog d'édition + vignette).
- [x] **Notifs par device** — section paginée + filtre par application sur la page device
  (`GET /devices/:id/notifications/`), tag de statut de livraison.
- [x] **Livraison par device sur le détail notif** — colonne « Livraison » dans le tableau des
  devices ciblés (`deliveries` de `GET /notifications/:id/`).

## À faire

- [x] **P2 — Pagination de la liste notifications** *(fait 2026-06-14)* — historique en pagination
  serveur lazy (split historique/futures). Voir la section « Audit » → cluster pagination.
- [ ] **P3 — Logo d'app en avatar** : on a le logo, ne l'afficher que sur le mobile est dommage.
  L'ajouter en avatar dans la liste des applications / des notifications pour la cohérence visuelle.
- [ ] **P3 — Filtre par device sur la liste notifications** : symétrique du filtre par app existant.
- [ ] **P2 — Sync des locales i18n** : `console-copy.service.ts` = gros objets mono-ligne FR/NL/EN,
  fragiles à désynchroniser (édition manuelle en 3 endroits). Ajouter un test qui vérifie que les
  trois locales ont **exactement les mêmes clés** (et envisager un découpage par feature).

## Audit multi-agents (2026-06-14) — constats confirmés

### Sécurité
- [ ] **P2 — Refresh token en `localStorage`** (`session.service.ts`) quand `rememberSession` : fenêtre
  d'exfiltration en cas de XSS. Envisager cookie httpOnly, ou documenter l'hypothèse (CSP forte en place).
- [ ] **P2 — App-token en clair dans la sidebar** (`console-navigation`) : `lastGeneratedToken` jamais
  effacé (aucun `.set(null)`), reste en DOM/mémoire toute la session. Effacer après copie / timeout / au logout.
- [ ] **P2 — « Use latest token » sans confirmation** (`devices-page`) : colle le token en clair sans
  indiquer l'app, et reste après le link réussi (seul `linkForm` est reset). Confirmer + effacer après usage.
- [ ] **P2 — QR data-URL persistante** (`applications-page`) : `qrImageUrl` non effacé à la destruction /
  navigation (seulement à la fermeture du dialog). Effacer + timeout.
- [ ] **P2 — uid/token de confirmation e-mail & reset dans l'URL** : visibles dans l'historique / logs
  nginx / referer. Documenter (ouvrir en privé) ou repenser (token signé unique).
- [ ] **P2 — `script-src-attr 'unsafe-inline'`** (nginx CSP) : non requis par l'implémentation Turnstile
  actuelle (rendu programmatique) → point d'escalade XSS inutile. Le retirer.
- [ ] **P2 — `authGuard` ne vérifie que la présence du token**, pas son expiration (pas de décodage JWT).
  Un token expiré en mémoire passe (l'intercepteur rattrape en 401). Vérifier `exp` en amont.
- [ ] **P3 — Refresh token dans le body du logout** : potentiellement loggé si nginx logge les bodies (non par défaut).
- [ ] **P3 — Pas de meta CSP fallback** dans `index.html` (CSP uniquement via header nginx).

### Qualité / UX
- [~] **P1 — Pagination (cluster, 2026-06-14)** : backend `OptionalPageNumberPagination` (opt-in via
  `?page`/`?page_size`, tableau nu par défaut) sur `/notifications`, `/notifications/future`, `/devices`.
  Le shell ne charge plus toutes les notifs pour les compter (`countNotifications`/`countFutureNotifications`
  → `count`). **Page notifications : historique en pagination SERVEUR lazy** (split UI historique vs
  futures, row partagé via `ngTemplateOutlet` ; futures bornées → chargées en entier). **Reste :**
  (a) `devices-page` en lazy serveur (le compteur shell devices reste chargé en entier car couplé au
  comptage des quiet-periods par device — à découpler) ; (b) `apps` reste chargé en entier (borné, la nav
  en a besoin).
- [x] **P1 — Retry + Sentry sur le chargement console (2026-06-14)** : `retry({count:2,delay:800})` sur
  `loadShell`/`refreshNavigationCounts`, `Sentry.captureException` sur les échecs (avant : avalés dans le
  signal d'erreur, invisibles), bouton « Réessayer » sur la bannière (`shell.reload()`).
- [ ] **P2 — Erreurs API brutes non traduites** : `coerceApiError()` renvoie des messages FR en dur +
  `error.detail` brut affiché. Mapper vers des clés i18n par code.
- [ ] **P2 — i18n manquant** : 2 messages d'erreur FR en dur dans `console-shell.service.ts` (l.50, 95).
- [ ] **P2 — Souscriptions sans `takeUntilDestroyed()`** : `devices-page` (linkDevice), `applications-page`
  (uploadAppLogo/deleteAppLogo).
- [ ] **P2 — `effect()` détourné pour l'état de formulaire** (`notifications-page`, `quiet-periods-page`) :
  préférer `valueChanges` (déjà utilisé correctement ailleurs).
- [ ] **P2 — État de chargement manquant** sur `applications-page` (affiche l'état vide pendant le fetch).
- [ ] **P2 — a11y** : `alt=""` sur les vignettes logo ; nombreux `p-button` icône sans `[ariaLabel]` (tooltip ≠ nom accessible).
- [ ] **P2 — `application-detail` : erreur globale unique** (forkJoin 5 requêtes) sans erreur/retry par section.
