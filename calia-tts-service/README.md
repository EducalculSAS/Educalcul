# Calia TTS — Kyutai Pocket-TTS (voix française)

Service vocal open source (Kyutai Pocket-TTS, modèle `french_24l`, voix
`estelle`) pour le mode "Calia en classe" d'Educalcul. Tourne entièrement
sur CPU, zéro GPU — hébergé sur le tier gratuit de Render.com.

Un seul endpoint, protégé par un secret partagé (pas de token de plateforme
requis) :

```
POST /speak
Authorization: Bearer <CALIA_TTS_SECRET>
Content-Type: application/json

{ "text": "Bonjour !" }
```
→ `200 audio/wav`

## Déploiement (Render.com, gratuit, sans carte bancaire)

1. Créer un compte sur render.com (gratuit), connecter le repo GitHub
   `EducalculSAS/Educalcul`.
2. Nouveau "Web Service" → Root Directory: `calia-tts-service` → Environment:
   Docker (Render détecte le `Dockerfile` automatiquement) → Instance Type:
   Free.
3. Ajouter la variable d'environnement `CALIA_TTS_SECRET` (une valeur
   aléatoire, ex. générée avec `openssl rand -hex 32`) sur le service Render.
4. Une fois déployé, récupérer l'URL du service
   (`https://calia-tts-xxxx.onrender.com`).
5. Dans Vercel (projet `project-educalcul`), ajouter les mêmes variables :
   - `CALIA_TTS_URL` = URL du service Render ci-dessus
   - `CALIA_TTS_SECRET` = la même valeur qu'à l'étape 3

## Limite connue (tier gratuit)

Le service s'endort après 15 min d'inactivité (redémarrage à froid de
30-60s au prochain appel). `CaliaSceneDemo.tsx` retombe automatiquement sur
la synthèse vocale du navigateur si l'appel échoue ou met trop de temps,
donc la fonctionnalité ne reste jamais muette.
