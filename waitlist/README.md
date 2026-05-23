# Educalcul Landing Page

Landing page avec système de liste d'attente (waitlist) et récompenses pour le lancement d'Educalcul.

## Features

- ✨ **Landing Page Publique** - Présentation élégante du projet
- 📝 **Système de Waitlist** - Inscription simple et rapide
- 🎁 **Système de Récompenses** - Déblocage de récompenses par parrainage
- 👥 **Parrainage (Referral)** - Invitez vos amis et gagnez des mois gratuits
- 🏆 **Leaderboard** - Classement des top ambassadeurs
- 💾 **Stockage Local** - Utilise localStorage (sans BD pour le moment)

## Structure

```
waitlist/
├── src/
│   ├── components/
│   │   ├── WaitlistForm.tsx      # Formulaire d'inscription
│   │   ├── UserDashboard.tsx     # Dashboard utilisateur avec récompenses
│   │   └── Leaderboard.tsx       # Classement
│   ├── lib/
│   │   └── waitlist.ts           # Logique métier (localStorage)
│   ├── index.tsx                 # App principale
│   ├── index.css                 # Styles
│   ├── globals.css               # Tailwind directives
│   └── main.jsx                  # Entry point React
├── public/                        # Assets statiques
├── index.html                     # HTML de base
├── package.json                   # Dépendances npm
├── vite.config.ts                # Configuration Vite
├── tsconfig.json                 # TypeScript config
├── tsconfig.node.json            # TypeScript config (Vite)
├── tailwind.config.ts            # Tailwind CSS config
└── README.md                      # Cette doc
```

## Installation & Lancement

```bash
# Aller dans le dossier
cd educalcul-next/waitlist

# Installer les dépendances
npm install

# Développement
npm run dev

# Build pour production
npm run build

# Preview production build
npm run preview
```

## Récompenses

- ⭐ **Pionnier** - Inscription automatique
- 👥 **Influenceur** - 1 ami = 1 mois gratuit
- 🚀 **Ambassadeur** - 3 amis = 3 mois gratuits
- 👑 **Légende** - 5 amis = 6 mois gratuits
- 💎 **Maître du Réseau** - 10 amis = Accès à vie

## Données

Les données sont stockées en localStorage:
- `educalcul_waitlist` - Profil utilisateur courant
- `educalcul_global_waitlist` - Liste complète de tous les inscrits

## Note

Pour le moment, il n'y a pas de base de données - tout est en localStorage. 
À l'avenir, il faudra connecter à Supabase pour persister les données.

## Intégration Future

Pour intégrer avec le site principal:
1. Créer les tables Supabase: `waitlist`, `rewards`, etc.
2. Remplacer les fonctions localStorage par des appels API
3. Migrer les données depuis localStorage vers Supabase
4. Synchroniser les récompenses avec le système d'abonnement principal
