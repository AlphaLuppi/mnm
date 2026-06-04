# Spec — Configuration des sons d'events de l'app

**Date** : 2026-06-04
**Statut** : Design acté, prêt pour plan d'implémentation
**Origine** : brainstorm interactif (pas de fichier brainstorm séparé)

---

## 1. Vision

Permettre à chaque utilisateur de paramétrer, depuis un nouveau front dédié, le son que l'app joue selon les events. Aujourd'hui l'app n'a **aucun système de son**. Les events temps réel (WebSocket `/events/ws`) déclenchent déjà des **toasts** via `ToastContext`, chaque toast portant une **tonalité** (`info` / `success` / `warn` / `error`). On se branche sur ce système existant : un son par tonalité, configurable par l'utilisateur, synchronisé entre ses appareils.

Les fichiers de sons par défaut seront fournis ultérieurement par le mainteneur — le système doit fonctionner dès que les fichiers sont déposés, sans changement de code.

---

## 2. Décisions actées

| # | Décision | Justification courte |
|---|----------|----------------------|
| 1 | **Granularité = par tonalité de toast** (`info`/`success`/`warn`/`error`) | Se branche direct sur les toasts existants ; les 100+ event types restent ingérables à l'unité |
| 2 | **Stockage = DB par user, cross-device, RLS** | Synchronisé entre appareils ; cohérent multi-tenant |
| 3 | **Modèle de données = option A (une ligne JSONB par user)** | Granularité petite et fixe (4 tonalités) → JSONB suffit, suit le pattern `user_widgets` |
| 4 | **Sons = bibliothèque intégrée + upload perso** | Built-ins servis en statique ; uploads réutilisent l'infra `assets` existante (namespace `"sounds"`) |
| 5 | **Contrôles = mute global + volume global** | Suffisant ; un seul toggle + un seul slider |
| 6 | **Référence son = string** : `"none"` \| `"builtin:<id>"` \| `"asset:<uuid>"` | Une seule colonne, pas de jointure, fallback trivial |
| 7 | **Pas de nouvelle table pour les fichiers uploadés** | Réutilise `assets` (storage abstraction + `createdByUserId` déjà en place) |
| 8 | **Pas de polling** | Config lue une fois au montage ; édition mono-appareil → pas besoin d'event live |
| 9 | **Défaut initial = toutes les tonalités à `"none"`** | Silencieux tant qu'aucun son n'est choisi / aucun fichier déposé |
| 10 | **Permission = self-scope** (auth + appartenance company, pas de RBAC dédié) | La route ne lit/écrit que les settings du `userId` courant ; clé exacte confirmée au plan |

---

## 3. Architecture

### Vue d'ensemble

```
WebSocket event ──> LiveUpdatesProvider ──> ToastContext.add({tone}) ──┐
                                                                       │
                                          SoundSettingsProvider.play(tone)
                                                                       │
                                          HTMLAudioElement (volume, throttle, unlock)
```

Un **`SoundSettingsProvider`** (contexte React) charge la config du user au boot et expose `{ settings, sounds, play, update }`. Le `ToastContext.add(...)` appelle `play(tone)` à chaque toast émis. La config s'édite sur la page `/settings/sounds`.

### Multi-tenant & traçabilité

- Settings scopés `(companyId, userId)` — RLS `company_id` fail-closed. Switcher de company = config potentiellement différente.
- Uploads tracés via `assets.createdByUserId`.
- Aucune action anonyme : la lecture/écriture des settings et l'upload se font sous l'identité du user authentifié.

---

## 4. Modèle de données (option A)

Nouvelle table `user_sound_settings` :

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | uuid pk | `defaultRandom()` |
| `companyId` | uuid → `companies.id` | RLS, notNull |
| `userId` | text | notNull |
| `enabled` | boolean | default `true` — mute global (false = tout coupé) |
| `volume` | integer | default `70` — 0-100, volume global |
| `tones` | jsonb | default `{ "info":"none", "success":"none", "warn":"none", "error":"none" }` |
| `createdAt` | timestamp tz | `defaultNow()` |
| `updatedAt` | timestamp tz | `defaultNow()` |

- **Unique** `(companyId, userId)`.
- Chaque valeur de `tones` est une **référence string** : `"none"`, `"builtin:<id>"`, ou `"asset:<uuid>"`.
- **Policy RLS** `company_id` copiée du pattern existant (cf. migrations `*_rls_policies.sql`).

Les **fichiers uploadés** vivent dans la table `assets` existante (namespace `"sounds"`) — aucune table ajoutée pour les fichiers.

---

## 5. Backend

### Migration
- Table `user_sound_settings` + policy RLS `company_id`.

### Service — `server/src/services/soundSettings.ts`
- `get(companyId, userId)` → renvoie la ligne, ou un objet de **défauts** si absente (ne crée pas de ligne à la lecture).
- `upsert(companyId, userId, patch)` → insert/update, valide :
  - `volume` ∈ [0, 100]
  - chaque ref de `tones` conforme au format (`none` / `builtin:<id>` / `asset:<uuid>`)

### Routes — sous `/companies/:companyId/`
| Méthode | Chemin | Rôle |
|---------|--------|------|
| `GET` | `/sound-settings` | Config du user courant (ou défauts) |
| `PUT` | `/sound-settings` | Upsert (valide refs + volume) |
| `POST` | `/sounds` | Upload audio : MIME whitelist `audio/mpeg\|wav\|ogg\|webm`, taille max **2 Mo**, `storage.putFile({ namespace:"sounds" })`, insert `assets` |
| `GET` | `/sounds` | Liste les sons uploadés du user (assets namespace `sounds`) |

- **Lecture audio** : réutilise le `GET /assets/:id/content` **existant** (rien à ajouter).
- **Bibliothèque intégrée** : servie en statique depuis `ui/public/sounds/` + manifest — pas de backend.

---

## 6. Frontend

### Provider & hook
- **`SoundSettingsProvider`** monté près de `LiveUpdatesProvider` : fetch au mount, expose `{ settings, sounds, play, update }`.
- Intégration toast : dans `ToastContext.add(...)`, appel `play(tone)`.

### Page — `ui/src/pages/SoundSettingsPage.tsx`
- **Bloc global** : toggle *Activer les sons* (`enabled`) + slider *Volume* (`volume`).
- **4 lignes** (info / success / warn / error) : `Select` du son (built-ins + uploadés + « Aucun ») + bouton **▶ Aperçu**.
- **Bloc upload** : déposer un fichier audio → upload → apparaît dans les sélecteurs.

### Câblage
- Route `settings/sounds` dans `App.tsx` + entrée dans le menu settings.
- API clients : `ui/src/api/soundSettings.ts`, `ui/src/api/sounds.ts`.
- Composants UI **uniquement depuis `ui/src/components/ui/`** (créer la primitive shadcn manquante au besoin).

---

## 7. Lecture du son

- `HTMLAudioElement` :
  - URL built-in : `/sounds/<file>`
  - URL uploadé : `/api/companies/:companyId/assets/:id/content`
  - Volume = `volume / 100` ; skip total si `enabled === false` ou ref `"none"`.
- **Throttle** : un seul son par fenêtre courte (**~300 ms**) pour éviter le mitraillage en rafale de toasts.
- **Autoplay policy** : les navigateurs bloquent l'audio avant interaction utilisateur → *unlock* one-shot au premier geste (click/keydown). Avant unlock, skip silencieux.

---

## 8. Bibliothèque par défaut (assets à venir)

- Manifest `ui/src/sounds/manifest.ts` : liste `{ id, label, file }` des sons intégrés.
- Fichiers dans `ui/public/sounds/`.
- Les fichiers seront fournis plus tard → le manifest démarre **vide/placeholder** ; la feature marche dès que les fichiers sont déposés (aucun changement de code requis).

---

## 9. Erreurs & edge cases

| Cas | Comportement |
|-----|--------------|
| Son uploadé supprimé / introuvable (`asset:<uuid>` invalide) | Fallback `"none"`, jamais de throw |
| Échec de chargement de la config | Défauts (silencieux), pas de crash |
| Upload invalide (MIME / taille) | `400` explicite |
| Autoplay bloqué (pré-unlock) | Skip silencieux jusqu'au unlock |
| `enabled = false` | Aucun son, quelles que soient les refs |

---

## 10. Tests & parité

- **Unit** : service `soundSettings` (défauts, upsert, validation refs/volume) ; validation upload (MIME / taille).
- **Component** : logique `play` (mute, volume, throttle, fallback asset manquant, unlock).
- **RLS** : user A ne peut pas lire les settings de user B.
- **Parity tracker** : MAJ `scripts/parity/data.ts` (nouvelle page settings → statut desktop Tauri).

---

## 11. Hors scope (YAGNI)

- Granularité par event individuel ou par catégorie (décision : par tonalité).
- Volume / mute par tonalité (décision : global uniquement).
- Synchronisation live de la config entre onglets/appareils via event (édition mono-appareil suffisante).
- Bibliothèque de sons partagée au niveau company (les sons sont built-in ou perso).
