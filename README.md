# Roue de la fortune — commerces locaux

Application web (Next.js) qui remplace la page HTML autonome de roue de la
fortune par une vraie petite app avec backend :

- Les e-mails collectés sont stockés côté serveur (SQLite via Prisma), pas
  seulement dans le navigateur du client.
- Le lot gagné + le code sont envoyés automatiquement par e-mail (Resend), en
  plus de l'affichage à l'écran.
- Anti-triche : une adresse e-mail ne peut jouer qu'une seule fois (contrainte
  appliquée côté serveur **et** au niveau de la base de données).
- Dashboard admin protégé par mot de passe : liste des participations + export
  CSV.
- Configuration (nom du commerce, couleurs, lots et probabilités) centralisée
  dans un seul fichier pour pouvoir réutiliser l'app pour plusieurs clients.

Direction artistique "premium minimaliste" façon roulette de bar à cocktails :
fond ivoire, encre profonde, un seul accent chaud (terracotta) et un filet
laiton, polices **Fraunces** (titres) + **Inter** (texte), roue animée en
`<canvas>` à segments alternés encre/champagne.

## ⚠️ Contrainte légale — à ne jamais contourner

**Aucun lot ne doit être conditionné au dépôt d'un avis Google, TripAdvisor ou
toute autre plateforme d'avis.** C'est interdit par l'article L111-7-2 du Code
de la consommation et par la politique de Google.

Cette règle est appliquée en dur dans le code (`lib/prizes.ts`) : le serveur
refuse de démarrer si un lot du fichier de configuration contient un mot-clé
lié aux avis ("avis", "review", "google maps", "tripadvisor", etc.), et le
type TypeScript des lots (`PrizeType`) n'autorise que : `discount` (réduction
liée à un achat), `social` (abonnement réseaux sociaux), `newsletter`
(inscription newsletter) et `product` (produit offert).

## Stack technique

- [Next.js 14](https://nextjs.org/) (App Router) — front + API routes dans le
  même projet.
- [Prisma](https://www.prisma.io/) + SQLite pour la base de données.
- [Resend](https://resend.com/) pour l'envoi d'e-mails transactionnels.
- Aucune dépendance CSS externe : styles maison dans `app/globals.css`.

## Structure du projet

```
config/site.config.ts   -> configuration business (nom, couleurs, lots, poids)
lib/prizes.ts            -> tirage pondéré, génération de code, garde-fou légal
lib/email.ts              -> template + envoi d'e-mail (Resend)
lib/adminAuth.ts          -> session admin signée (cookie httpOnly)
lib/db.ts                 -> client Prisma
prisma/schema.prisma      -> modèle de données (table Entry)
app/page.tsx               -> page publique (roue)
app/components/Wheel.tsx   -> roue canvas + formulaire + logique de spin
app/api/spin/route.ts      -> API de tirage (anti-triche + email)
app/admin/                 -> dashboard admin (page protégée)
app/api/admin/             -> login / logout / export CSV
```

## Installation en local

```bash
npm install
cp .env.example .env
# éditez .env : au minimum ADMIN_PASSWORD et ADMIN_SESSION_SECRET
npx prisma migrate dev --name init
npm run dev
```

L'app est disponible sur http://localhost:3000, le dashboard admin sur
http://localhost:3000/admin.

### Générer un secret de session admin

```bash
openssl rand -hex 32
```

## Configurer les clés API

Toutes les clés sensibles vivent dans `.env` (jamais commité, voir
`.gitignore`). Copiez `.env.example` vers `.env` puis renseignez :

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Connexion à la base (SQLite en local : `file:./dev.db`) |
| `RESEND_API_KEY` | Clé API récupérée sur [resend.com/api-keys](https://resend.com/api-keys) |
| `EMAIL_FROM` | Adresse d'expédition, doit appartenir à un domaine vérifié sur Resend (ex: `"Le Petit Bistrot <contact@monrestaurant.fr>"`) |
| `ADMIN_PASSWORD` | Mot de passe pour accéder à `/admin` |
| `ADMIN_SESSION_SECRET` | Chaîne aléatoire longue pour signer le cookie de session admin |
| `NEXT_PUBLIC_BUSINESS_NAME` | Nom du commerce affiché sur la page |
| `NEXT_PUBLIC_LOGO_URL` | URL d'un logo (optionnel, sinon le nom est affiché en titre) |
| `NEXT_PUBLIC_GOOGLE_REVIEW_URL` | Lien vers votre fiche d'avis Google (optionnel). Voir section "Demande d'avis" ci-dessous. |

> Vous voulez utiliser Brevo plutôt que Resend ? Le point d'entrée unique est
> `lib/email.ts` (fonction `sendPrizeEmail`) : remplacez l'appel au SDK Resend
> par un appel à l'API Brevo (`POST https://api.brevo.com/v3/smtp/email`) en
> gardant la même signature de fonction, rien d'autre à changer.

## Configurer les lots et le design

Tout se passe dans **`config/site.config.ts`** :

- `business` : nom, logo, mention affichée avec le lot ("à présenter en
  caisse").
- `theme` : palette (bone, paper, champagne, ink, terracotta, brass — hex).
- `legal.consentLabel` : texte de la case de consentement RGPD.
- `prizes` : tableau de lots, chacun avec :
  - `id` (stable, ne pas changer une fois en prod — utilisé en base),
  - `label` (texte affiché),
  - `weight` (poids relatif de tirage — pas besoin de faire 100 au total),
  - `type` (`discount` | `social` | `newsletter` | `product`),
  - `description` (optionnel, repris dans l'e-mail),
  - `color` (optionnel, sinon alterne encre/champagne façon roulette).

Le tirage du lot est **entièrement calculé côté serveur** (`app/api/spin`) :
le navigateur ne fait qu'animer la roue jusqu'au lot renvoyé par l'API. Un
client ne peut donc pas manipuler les probabilités ni deviner le lot avant le
serveur.

## Anti-triche

- Contrainte unique sur `email` en base (`prisma/schema.prisma`), donc même en
  cas de requêtes concurrentes, une seule participation par e-mail est
  acceptée.
- Vérification applicative dans `app/api/spin/route.ts` avant tirage, avec un
  message clair renvoyé au client (`"Tu as déjà tenté ta chance..."`, HTTP
  409).
- IP et user-agent sont journalisés par participation (colonnes
  `ipAddress` / `userAgent`) à titre d'audit, sans bloquer sur ce critère par
  défaut.
- L'e-mail est **obligatoire** pour jouer : champ HTML `required`, bouton
  "Tourner la roue" désactivé tant que l'adresse n'est pas valide et la case
  de consentement cochée (`app/components/Wheel.tsx`), et re-validé côté
  serveur (`app/api/spin/route.ts`) avant tout tirage.

## Demande d'avis Google (après coup, jamais une condition)

Si `NEXT_PUBLIC_GOOGLE_REVIEW_URL` est renseigné, un écran "Merci d'avoir
joué !" apparaît **après** que le client a fermé l'écran de son lot déjà
attribué et déjà envoyé par e-mail, avec un bouton "Laisser un avis Google" et
un bouton "Plus tard". Cet écran :

- n'apparaît qu'une fois le lot déjà acquis (il ne peut donc pas être une
  condition pour l'obtenir) ;
- est entièrement facultatif et fermable sans conséquence ;
- ne modifie ni le lot, ni le code, ni son envoi par e-mail.

**Ne modifiez jamais ce flux pour rendre un lot ou le tour de roue conditionné
au dépôt d'un avis.** C'est interdit par l'article L111-7-2 du Code de la
consommation et par la politique de Google, et le serveur refuse de toute
façon de démarrer si un lot du fichier de config est lié à un avis (voir
garde-fou dans `lib/prizes.ts`).

## Dashboard admin

- `/admin/login` : formulaire de mot de passe (comparaison en temps constant,
  cookie de session httpOnly signé, expire après 8h).
- `/admin` : liste des participations (date, e-mail, lot, code, statut email
  envoyé) + bouton d'export CSV (`/api/admin/export`).

## Déploiement

### Sur Vercel

Le build Next.js fonctionne tel quel sur Vercel. **Attention cependant** :
Vercel exécute les fonctions serverless sur un système de fichiers éphémère,
donc **un fichier SQLite local ne persistera pas** entre les invocations (les
données seraient perdues à tout moment).

Deux options pour un déploiement Vercel en production :

1. **Remplacer SQLite par une base managée** (recommandé) : Neon, Vercel
   Postgres ou Supabase. Il suffit de changer le `provider` dans
   `prisma/schema.prisma` (`sqlite` → `postgresql`) et de pointer
   `DATABASE_URL` vers la base managée, puis `npx prisma migrate deploy`.
2. **Déployer ailleurs qu'en serverless** si vous voulez garder SQLite tel
   quel : Render, Railway, Fly.io ou un simple VPS avec disque persistant
   fonctionnent très bien (`npm run build && npm run start`, avec
   `DATABASE_URL` pointant vers un fichier sur le disque persistant).

### Variables d'environnement en production

Configurez les mêmes variables que `.env.example` dans les paramètres de
votre plateforme d'hébergement (jamais dans le code ou dans un commit).

## Réutiliser l'app pour plusieurs commerçants

Cette application est mono-tenant par déploiement (une instance = un
commerce), ce qui garde le code simple. Pour un nouveau client :

1. Dupliquez le dépôt (ou juste gardez le même dépôt avec une branche par
   client, selon votre préférence).
2. Modifiez `config/site.config.ts` (nom, couleurs, lots).
3. Créez un nouveau projet d'hébergement avec ses propres variables d'environnement
   (`.env` différent : mot de passe admin, clé Resend/domaine d'envoi, base de
   données dédiée).
4. Déployez. Aucune autre modification de code n'est nécessaire.
