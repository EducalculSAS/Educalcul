# Educalcul

Plateforme de mathématiques (CP → Terminale) : cours, exercices, quiz, jeux, forum, suivi parent, assistante IA **Calia**.
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (auth + base) · Stripe · Mistral.

## Démarrer

```bash
npm ci
cp .env.example .env.local   # puis remplir les valeurs
npm run dev                  # http://localhost:3000
```

Node 22 requis (voir `.github/workflows/ci.yml`).

## Contrôles qualité

| Commande | Rôle |
| --- | --- |
| `npm run typecheck` | TypeScript strict (variables inutilisées, retours manquants, `switch` qui « tombe »…) |
| `npm run lint` | ESLint, **0 avertissement toléré** (`any` interdit : utiliser `Loose` de `src/types/loose.ts` pour du JSON libre) |
| `npm test` | Tests unitaires (vitest) : `src/lib/__tests__/` |
| `npm run build` | Build de production (nécessite les variables Supabase/Stripe) |

Le CI (GitHub Actions) lance typecheck, lint, tests et build à chaque envoi sur `main`.

## Organisation

- `src/app/` — pages et routes API (`src/app/api/**`). Les routes `admin/*` sont protégées par `src/proxy.ts` (rôle + liste d'IP + 2FA)
  **et** par `requireRole` dans la route ; `cron/*` par `CRON_SECRET`.
- `src/lib/` — logique métier (notation, IA, facturation, authentification…). `src/lib/apiAuth.ts` : identité, rôles, IP du client.
- `src/components/` — composants (`viewers/` = lecteurs de cours/exercices/quiz, `admin/` = outils de rédaction).
- `src/app/globals.css` — thème, **verre liquide** (`.glass-*`, `.calia-glass*`), noms et cadres d'avatar.
- `supabase/migrations/` — migrations récentes. ⚠ La base de production a beaucoup plus de migrations que ce dossier : pour reconstruire
  le schéma, exporter la base (`supabase db dump`) plutôt que de rejouer ce dossier.
- `educalcul_*_final/` — contenu pédagogique (JSON) importé par les scripts de `scripts/`.

## Sécurité — points à connaître

- Toutes les écritures passent par des routes API qui utilisent la clé de service (`supabaseAdmin`) : chaque route doit vérifier
  l'identité (`getAuthenticatedUser`, `requireRole`) **et** que la ressource appartient bien à l'appelant.
- Lire le corps d'une requête avec `readJsonBody` (`src/lib/apiJson.ts`) : jamais d'exception sur un JSON invalide.
- IP du client : `getClientIp` (`src/lib/apiAuth.ts`), jamais l'en-tête `x-forwarded-for` à la main.
- Webhook Stripe : un événement échoué est retiré de `stripe_processed_events` pour que la relivraison soit traitée.
- Dans Supabase, activer « Leaked password protection » (Auth → Providers → Password).
