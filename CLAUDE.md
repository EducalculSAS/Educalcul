# Educalcul : règles de travail

## Interface : toujours les composants du site
- Ne jamais créer un nouveau contrôle quand le site en a déjà un. Réutiliser :
  - `src/components/ui/GlassSegmentedControl.tsx` pour tout sélecteur à onglets / curseur (« slider » liquid glass) ;
  - `GlassButton`, `GlassIconButton`, `GlassCloseButton`, `GlassSwitch`, `GlassCheckbox`, `GlassDialog` (fenêtres) ;
  - `PageHero` (en-tête des pages élève/parent), `AvatarWithBorder` (avatars), `StreakFlame` (flamme).
- Mêmes tailles et styles que les autres pages :
  - carte de section : `bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]` ;
  - titre de section : `<h2 className="text-xl font-bold text-[var(--greek-blue)]">` précédé d'une icône `w-5 h-5 text-[var(--greek-gold)]` ;
  - sous-titre : `text-sm text-gray-500`.
- Tout doit être beau et utilisable sur téléphone ET ordinateur, en mode clair et sombre.

## Fluidité
- Pas d'animation infinie hors écran : les contours et titres animés sont mis en pause hors de la fenêtre (voir `AnimationGovernor`).
- Éviter les `backdrop-blur` sur de grandes surfaces qui défilent.

## Vérifier avant de pousser
`npx tsc --noEmit -p .`, `npx eslint src --max-warnings 0`, `npx vitest run`, `next build`.
