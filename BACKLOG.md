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
- [x] **P2 — Sync des locales i18n** *(fait 2026-06-14)* — `copy-locale-parity.spec.ts` : échec CI si
  FR/NL/EN n'ont pas exactement les mêmes clés (`CONSOLE_COPY`/`APP_COPY` exportés).
- [ ] **P3 — Logo d'app en avatar** dans les listes web *(différé : polish ; le logo est déjà sur mobile + détail)*.
- [ ] **P3 — Filtre par device sur la liste notifications** *(différé : symétrie, faible valeur)*.

## Audit multi-agents (2026-06-14) — constats confirmés

### Sécurité
- [x] **P2 — App-token en clair dans la sidebar** *(fait)* — `lastGeneratedToken` auto-clear 120s +
  clear au logout + après copie + bouton « Masquer ».
- [x] **P2 — « Use latest token »** *(fait)* — `appTokenForm` effacé après un link réussi.
- [x] **P2 — QR data-URL persistante** *(fait)* — `clearQrImage()` à `ngOnDestroy`.
- [x] **P2 — `script-src-attr 'unsafe-inline'`** *(fait)* — retiré du CSP nginx (sera live au prochain déploiement).
- [x] **P2 — `authGuard` expiration** *(fait)* — `accessTokenExpired()` (décodage `exp`) ; session morte
  (expiré + sans refresh) → `/auth` ; expiré + refresh présent → laissé passer (intercepteur rafraîchit).
- [ ] **P2 — Refresh token en `localStorage`** *(différé : architectural)* — passer en cookie httpOnly est
  un changement cross-stack (le backend doit poser/lire le cookie, CSRF, CORS). Risque atténué par la CSP
  forte en place. À traiter comme un chantier dédié, pas un fix ponctuel.
- [ ] **P2 — uid/token e-mail/reset dans l'URL** *(différé : surtout « documenter » ; envisager un token signé unique)*.
- [ ] **P3 — Refresh token dans le body du logout** *(différé : le backend en a besoin pour révoquer ; nginx ne logge pas les bodies)*.
- [ ] **P3 — Pas de meta CSP fallback** *(différé : l'app est liée à nginx+SSM ; servir sans casserait déjà le runtime-config)*.

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
- [x] **P2 — Souscriptions sans `takeUntilDestroyed()`** *(fait)* — `devices-page` (linkDevice),
  `applications-page` (upload/delete logo).
- [x] **P2 — État de chargement manquant** sur `applications-page` *(fait)* — spinner pendant le fetch initial.
- [x] **P2 — Erreurs API localisées** *(fait 2026-06-14)* — `API_ERROR_COPY` + `localizeApiError()` +
  pipe `apiError` (impur) appliqué à toutes les bannières d'erreur (console + auth/forgot/reset) :
  les statuts HTTP / validation / unexpected → message FR/NL/EN ; plus de fuite de `error.message`.
- [x] **P2 — i18n : 2 messages du `console-shell`** *(fait)* — viennent de `API_ERROR_COPY`.
- [ ] **P2 — `effect()` pour l'état de formulaire** *(différé : borderline)* — le cas notifications est
  un sync **signal→form** (idiomatique en effect) ; seul le déclencheur de chargement quiet-periods est
  discutable mais fonctionne. Faible valeur / risque de régression.
- [ ] **P2 — a11y : `[ariaLabel]` sur les boutons-icônes** *(différé : sweep mécanique ~30+ boutons sur 5
  pages)*. *(N.B. `alt=""` sur les vignettes logo à côté du nom est correct — décoratif, pas un bug.)*
- [ ] **P2 — `application-detail` : erreur/retry par section** *(différé : refactor modéré, valeur moyenne)*.
