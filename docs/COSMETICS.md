# Contours d'avatar et titres (couleurs de nom)

Un seul catalogue : `src/lib/cosmetics/catalog.ts`. Tout le reste (droits, vitrine, formules, tests) en découle.

## Deux façons de les obtenir (pas plus)
| Façon | Durée | Où c'est enregistré |
|---|---|---|
| **Mission** (`MISSIONS`) : atteindre des compteurs (exercices, cours, quiz, série, mini-jeux, badges…) | pour toujours | table `user_cosmetics` (clé = identifiant de la mission) |
| **Abonnement** : la formule du parent (`subscription_plans.features.cosmetic_borders` / `cosmetic_colors`) | tant que la formule est active | rien (calculé) |

Un élément peut avoir les deux (ex. le Brasier). **Aucun élément n'est réservé aux administrateurs** : ils suivent la règle de tout le monde.

## Parcours
- `cosmetics/entitlements.ts` : `resolveUnlocked()` = missions accomplies + formule active (fonction pure).
- `cosmeticEntitlements.ts` (serveur) : charge les droits d'un compte ; `reconcileCosmetics*` retire ce qui n'est plus permis (webhook Stripe, synchronisation, rétractation, changement de formule, tâche de nuit `data-retention`).
- `cosmetics/stats.ts` + `missions.ts` : compteurs et avancement ; `POST /api/child/check-badges` attribue les missions accomplies.
- `POST /api/child/equip` : refuse tout ce qui n'est pas dans les droits.
- `cosmetics/view.ts` + `components/child/CosmeticsShowcase.tsx` : vitrine « Mes trophées » (curseur Tous / Missions / Abonnement / Obtenus, tri, avancement, formules concernées).

## Ajouter un contour
1. `BORDERS` (+ `COLORS` pour le titre) et une `MISSION` dans `catalog.ts` ;
2. une palette et un motif dans `AvatarRingDecor.tsx` ; une classe `.name-…` dans `globals.css` (liste commune `:is(...)` + variables `--t --m --b --o --g`) ;
3. `npx vitest run src/lib/__tests__/cosmeticsCatalog.test.ts` vérifie que rien ne manque (palette, classe CSS, mission valide).
