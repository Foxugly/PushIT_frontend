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

- [ ] **P2 — Pagination de la liste notifications** : `/dashboard/notifications` charge **tout**
  d'un coup (historique + futures), sans pagination. Reprendre le pattern paginé lazy fait pour
  les notifs-par-device (nécessite de paginer aussi côté backend `/notifications/`).
- [ ] **P3 — Logo d'app en avatar** : on a le logo, ne l'afficher que sur le mobile est dommage.
  L'ajouter en avatar dans la liste des applications / des notifications pour la cohérence visuelle.
- [ ] **P3 — Filtre par device sur la liste notifications** : symétrique du filtre par app existant.
- [ ] **P2 — Sync des locales i18n** : `console-copy.service.ts` = gros objets mono-ligne FR/NL/EN,
  fragiles à désynchroniser (édition manuelle en 3 endroits). Ajouter un test qui vérifie que les
  trois locales ont **exactement les mêmes clés** (et envisager un découpage par feature).

> Les constats de l'audit multi-agents (2026-06-14) seront ajoutés ici après vérification.
