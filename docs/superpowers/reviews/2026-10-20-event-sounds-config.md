# Revue — Configuration des sons d'events (PR #37)

Date : 2026-10-20 · Branche : `feat/event-sounds-config`
Spec : [`specs/2026-06-04-event-sounds-config-design.md`](../specs/2026-06-04-event-sounds-config-design.md) · Plan : [`plans/2026-06-04-event-sounds-config.md`](../plans/2026-06-04-event-sounds-config.md)

Revue en trois passes parallèles : backend/DB/shared, frontend, et analyse audio des sons intégrés avec [earshot](https://github.com/Leonxlnx/earshot) (toolkit d'écoute pour agents, MIT).

**Verdict : aucun bloquant.** Les points importants sont corrigés dans la PR (commit `a3bf798`). Les sons earshot sont ajoutés en commit `9303281`.

## 1. Corrigé dans la PR

### Frontend

| Point | Fichier | Correctif |
|---|---|---|
| Une réponse PUT tardive écrasait le draft (« last response wins ») ; un refetch réinitialisait un slider en cours | `ui/src/pages/SoundSettingsPage.tsx` | Mutations sérialisées (`scope`), `onSuccess` met à jour le cache seulement, resync du draft uniquement hors mutation |
| Échec de sauvegarde silencieux, draft optimiste resté affiché | `SoundSettingsPage.tsx` | Rollback sur `onError` + message d'erreur |
| Mute non respecté pendant le chargement / changement de company / erreur (fallback sur les défauts `enabled: true`) | `ui/src/context/SoundSettingsProvider.tsx` | Aucun son tant que les réglages user ne sont pas chargés |
| Une exception audio (`volume = NaN`) empêchait le dismiss du toast | `SoundSettingsProvider.tsx` | `try/catch` autour de la lecture + `toAudioVolume()` NaN-safe |
| Slider : pas de nom accessible, commit sur Tab/Shift, `{...props}` écrasait les handlers, drag stylet non commité | `ui/src/components/ui/slider.tsx` | Commit sur `pointerup` + touches de valeur seulement, handlers chaînés, `aria-valuetext` |
| Switch / Selects / boutons « Aperçu » sans label lié | `SoundSettingsPage.tsx` | `htmlFor`/`id`, `aria-labelledby`, `aria-label` par tonalité |

### Backend

| Point | Fichier | Correctif |
|---|---|---|
| `upsert` en read-modify-write : deux PUT partiels concurrents perdaient un champ | `server/src/services/sound-settings.ts` | Fusion en SQL dans `ON CONFLICT DO UPDATE` (`tones \|\| patch::jsonb`, champs absents non touchés), `RETURNING` |
| `asset:<uuid>` jamais validé : référence vers l'asset d'un autre user, un non-son ou un uuid inexistant | `server/src/routes/sound-settings.ts` | PUT refuse en 422 tout asset qui n'est pas un son (`sounds/%`) uploadé par ce user dans cette company (`foreignSoundIds`) + 2 tests de route |

Vérifié OK : migration `0086` sans collision, RLS `ENABLE`+`FORCE`+`RESTRICTIVE` fail-closed conforme à `0085`, préfixe `/companies/:companyId/`, limite 2 Mo appliquée par multer en streaming, identité humaine (`createdByUserId`), ordre des providers, cleanup des listeners d'unlock, throttle par tonalité, zéro polling, parity tracker à jour.

## 2. Sons intégrés — analyse earshot

Les modèles CLAP/AST d'earshot n'ont pas pu être téléchargés depuis l'environnement de revue (proxy) : `match`/`realness` non exécutés. Analyse faite avec les commandes sans modèle (`measure`, `sfx check`, `sfx render`, `gallery`).

**Sons actuels (sinus additifs)** : tous propres (−3 dBFS, sans clic), bien distincts entre eux, mais **tous marqués `truncated`** par `sfx check` (fade de 4 ms alors que l'enveloppe est encore audible). `chime` dure 0,7 s ; `error` est très grave (centroïde ~290 Hz), peu audible sur haut-parleurs de portable.

**Ajoutés** (rendus par ID depuis le sound bank d'earshot — recettes DSP, aucun audio enregistré — puis post-traités ffmpeg) : `sfx check` clean pour les six.

| id | Proposé pour | Source earshot | Durée | Taille |
|---|---|---|---|---|
| `soft-pop` | info | `pop/1` | 0,15 s | 13 Ko |
| `glass-ping` | info / général | `pro_notify/ding_2296` | 0,26 s | 23 Ko |
| `bell-chime` | général (remplaçant de `chime`) | `notify/m2` en G5 | 0,55 s | 49 Ko |
| `rise-chime` | success | `pro_notify/ding_1930` ×3 (C6-G6-C7) | 0,45 s | 40 Ko |
| `double-ding` | warn | `pro_notify/ding_1822` ×2 en Bb5 | 0,43 s | 38 Ko |
| `low-sweep` | error | `pro_zip/down_warm` | 0,37 s | 33 Ko |

Régénération reproductible (commit earshot épinglé, sortie byte-identique vérifiée) : `scripts/sounds/render-earshot-sounds.py`.

Ils sont proposés comme **choix supplémentaires** ; `DEFAULT_SOUND_SETTINGS` n'est pas modifié tant qu'ils ne sont pas validés à l'écoute. Compromis : distance log-mel min entre finaux 11,2 dB contre 15,4 dB pour les sons actuels (trois sons de la famille « ding », distingués par hauteur et nombre de notes).

## 3. Tests

- UI `ui/src/sounds` : 36/36 ✅
- Serveur (Postgres réel) : service 4/4, routes 7/7 (dont les 2 nouveaux), RLS e2e 5/5 ✅. Le fichier RLS échoue s'il est lancé en parallèle des autres sur une base vierge (course sur la migration / le rôle de test partagé) ; il passe seul.
- `bun run typecheck` : 17/17 packages ✅ (seule erreur, sur le package racine : `@embedded-postgres/windows-x64` absent de l'environnement Linux, préexistante sur master).

## 4. Restant (mineur, non traité)

- Pas d'audit (`emitAudit`) sur l'upload ni sur le PUT des réglages ; pas de quota ni de route `DELETE /me/sounds/:id`.
- MIME de l'upload déclaré par le client (pas de magic bytes) — même niveau que `assets/images`.
- `builtin:<id>` accepté sans lien avec le manifest (échec silencieux côté UI).
- Réglages par company et non globaux par user — à confirmer comme choix produit.
- Copie : son « Alerte » vs tonalité « Avertissement » ; pas de validation client avant upload ; son importé non auto-sélectionné.
- Indentation de `sounds:generate` dans `package.json`.

## 5. Avant merge

- [ ] Écouter les sons (galerie earshot ou page `/settings/sounds`) et décider du mapping par défaut — proposition : info → `soft-pop`, success → `rise-chime`, warn → `double-ding`, error → `low-sweep`.
- [ ] Smoke test UI : choisir un son, déclencher un toast, vérifier lecture + volume + mute.
