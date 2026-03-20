# CONT-S03 : Mount Allowlist Tamper-proof -- Validation chemins montes containers

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | CONT-S03 |
| **Titre** | Mount Allowlist Tamper-proof -- validation et enforcement des chemins montes dans les containers Docker |
| **Epic** | Epic CONT -- Containerisation |
| **Sprint** | Sprint 6 (Batch 10) |
| **Effort** | M (5 SP, 3-4j) |
| **Priorite** | P0 -- Securite B2B (couche 2 de defense en profondeur, ADR-004) |
| **Assignation** | Cofondateur (backend + securite) |
| **Bloque par** | CONT-S01 (ContainerManager Docker -- DONE), CONT-S05 (Tables container enrichies -- DONE) |
| **Debloque** | CONT-S04 (Isolation reseau -- depend logiquement du mount allowlist pour securite complete) |
| **ADR** | ADR-004 (Containerisation Docker + Credential Proxy -- couche 2 sur 5) |
| **Type** | Backend (service + validation + integration ContainerManager + routes + audit) |
| **FRs couverts** | REQ-CONT-03 (Mount allowlist tamper-proof -- realpath + symlinks + null bytes) |

---

## Description

### Contexte -- Pourquoi cette story est critique

L'ADR-004 definit 5 couches de defense en profondeur pour la containerisation. CONT-S01 a implemente la couche 1 (container ephemere `--rm --read-only`). CONT-S02 a implemente la couche 3 (credential proxy HTTP). Cette story implemente la **couche 2 : Mount Allowlist**.

**Le probleme** : les containers Docker ont besoin de monter des volumes pour acceder aux fichiers de travail du projet (code source, workspace, artefacts). Sans validation :
1. Un agent compromis peut demander `/etc/passwd`, `/var/run/docker.sock`, ou tout fichier sensible
2. Des path traversal (`../../etc/shadow`) peuvent escalader hors du workspace
3. Des symlinks malicieux dans le workspace peuvent pointer vers des fichiers sensibles
4. Des null bytes (`path%00.txt`) peuvent tromper la validation
5. Des paths avec encodage URL (`%2e%2e%2f`) peuvent bypasser les checks

**La solution** : un service `MountAllowlistService` qui :
- Maintient une allowlist de chemins autorises par profil (`allowedMountPaths` dans `container_profiles`)
- Valide chaque mount request contre l'allowlist avant la creation du container
- Utilise `realpath()` pour resoudre les symlinks et normaliser les paths
- Detecte et bloque les null bytes, path traversal, et encodage malicieux
- Emet un audit `severity=critical` et tue le container si une tentative de tampering est detectee
- S'integre dans `buildDockerCreateOptions()` de container-manager.ts

### Ce que cette story construit

1. **MountAllowlistService** (`server/src/services/mount-allowlist.ts`) -- service de validation des paths montes
   - `validateMountPath(path, allowedPaths)` -- valide un chemin contre l'allowlist
   - `validateAllMounts(mounts, allowedPaths)` -- valide tous les mounts d'un container
   - `normalizePath(path)` -- normalise un chemin (resolve symlinks, decode URL, strip null bytes)
   - `detectPathTraversal(path)` -- detecte les tentatives de path traversal
   - `detectNullBytes(path)` -- detecte les null bytes
   - `detectSymlinkEscape(path, allowedPaths)` -- detecte les symlinks qui pointent hors de l'allowlist
   - `isSensitivePath(path)` -- verifie si un path est dans la liste des chemins sensibles interdits
   - `addToAllowlist(companyId, profileId, paths)` -- ajoute des chemins a l'allowlist
   - `removeFromAllowlist(companyId, profileId, paths)` -- retire des chemins de l'allowlist
   - `getEffectiveAllowlist(companyId, profileId)` -- retourne l'allowlist effective
2. **Integration ContainerManager** -- modification de `container-manager.ts` :
   - Avant `docker.createContainer()`, valider tous les mounts via `MountAllowlistService`
   - Si un mount est refuse, emettre audit `severity=critical`, refuser la creation
   - Enregistrer les `mountedPaths` validees dans `container_instances`
   - Ajouter les binds valides dans `buildDockerCreateOptions()`
3. **Routes API** pour gerer l'allowlist :
   - `GET /companies/:companyId/containers/profiles/:profileId/mount-allowlist` -- lire l'allowlist
   - `PUT /companies/:companyId/containers/profiles/:profileId/mount-allowlist` -- mettre a jour l'allowlist
   - `POST /companies/:companyId/containers/mount-validate` -- valider un ensemble de paths contre un profil
4. **Types partages** dans `packages/shared/src/types/mount-allowlist.ts`
5. **Validators** dans `packages/shared/src/validators/mount-allowlist.ts`
6. **Audit trail** -- emission d'audit events pour les violations de securite mount

### Ce que cette story ne fait PAS (scope)

- Pas d'isolation reseau Docker (CONT-S04)
- Pas d'UI pour configurer le mount allowlist (future story ou via API/profile update)
- Pas de monitoring temps reel des mounts actifs (utilise la validation pre-creation)
- Pas de chroot/pivot_root (utilise les bind mounts Docker natifs avec validation)

---

## Etat Actuel du Code (Analyse)

### Fichiers existants impactes

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `server/src/services/container-manager.ts` | Lifecycle containers Docker | MODIFIE : integration mount allowlist validation dans launchContainer + buildDockerCreateOptions |
| `server/src/routes/containers.ts` | Routes API containers | MODIFIE : 3 nouvelles routes pour mount-allowlist |
| `packages/db/src/schema/container_profiles.ts` | Schema avec `allowedMountPaths` | NON MODIFIE (colonne existe deja via CONT-S05) |
| `packages/db/src/schema/container_instances.ts` | Schema avec `mountedPaths` | NON MODIFIE (colonne existe deja via CONT-S05) |
| `packages/shared/src/types/container.ts` | Types container partagees | NON MODIFIE |
| `server/src/services/audit-emitter.ts` | Emission audit events | NON MODIFIE (utilise tel quel) |
| `server/src/services/index.ts` | Barrel exports services | MODIFIE : export mountAllowlistService |

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `server/src/services/mount-allowlist.ts` | Service de validation des paths montes |
| `packages/shared/src/types/mount-allowlist.ts` | Types : MountValidationResult, MountViolation, SensitivePath |
| `packages/shared/src/validators/mount-allowlist.ts` | Zod schemas pour validation des inputs API |

---

## Acceptance Criteria (Given/When/Then)

### AC-01 : Validation path autorise
**Given** un profil avec `allowedMountPaths: ["/workspace/project-a"]`
**When** un container est lance avec mount `/workspace/project-a/src`
**Then** le mount est autorise et le container demarre normalement

### AC-02 : Rejet path hors allowlist
**Given** un profil avec `allowedMountPaths: ["/workspace/project-a"]`
**When** un container est lance avec mount `/workspace/project-b/src`
**Then** le mount est refuse avec erreur `MOUNT_PATH_NOT_ALLOWED`

### AC-03 : Detection path traversal
**Given** un profil avec `allowedMountPaths: ["/workspace/project-a"]`
**When** un mount contient `../../etc/passwd` ou `../../../var/run/docker.sock`
**Then** acces refuse + audit `severity=critical` + erreur `MOUNT_PATH_TRAVERSAL`

### AC-04 : Detection null bytes
**Given** un path de mount contenant un null byte (`/workspace/project%00.txt`)
**When** le mount est valide
**Then** acces refuse + audit `severity=critical` + erreur `MOUNT_NULL_BYTES`

### AC-05 : Detection symlink escape
**Given** un path valide dans l'allowlist mais qui est un symlink vers `/etc/shadow`
**When** `normalizePath()` est appele et resout le realpath
**Then** le chemin resolu est hors de l'allowlist → refuse + audit `severity=critical` + erreur `MOUNT_SYMLINK_ESCAPE`

### AC-06 : Blocage chemins sensibles
**Given** un mount vers un chemin sensible (`/etc/passwd`, `/var/run/docker.sock`, `/proc`, `/sys`, `~/.ssh`, `~/.gnupg`, `/root`)
**When** le mount est valide
**Then** refuse meme si le chemin est dans l'allowlist + erreur `MOUNT_SENSITIVE_PATH`

### AC-07 : Audit trail des violations
**Given** toute violation de mount (AC-02 a AC-06)
**When** la violation est detectee
**Then** un audit event est emis avec `action: "container.mount_violation"`, `severity: "critical"`, et le detail de la violation dans metadata

### AC-08 : Allowlist vide bloque tout
**Given** un profil avec `allowedMountPaths: []` (vide)
**When** un container est lance avec un mount quelconque
**Then** tous les mounts sont refuses (sauf le shadow .env qui est hardcode)

### AC-09 : Route GET allowlist
**Given** un admin authentifie
**When** il appelle `GET /companies/:companyId/containers/profiles/:profileId/mount-allowlist`
**Then** il recoit la liste des chemins autorises pour ce profil

### AC-10 : Route PUT allowlist
**Given** un admin authentifie
**When** il appelle `PUT /companies/:companyId/containers/profiles/:profileId/mount-allowlist` avec `{ paths: [...] }`
**Then** l'allowlist du profil est mise a jour et un audit event est emis

### AC-11 : Route POST validate
**Given** un admin authentifie
**When** il appelle `POST /companies/:companyId/containers/mount-validate` avec `{ profileId, paths: [...] }`
**Then** il recoit le resultat de validation pour chaque path (allowed/denied + raison)

### AC-12 : Integration buildDockerCreateOptions
**Given** un profil avec `allowedMountPaths: ["/workspace/project-a", "/data/shared"]`
**When** un container est lance avec des mounts `/workspace/project-a/src` et `/data/shared/config`
**Then** `buildDockerCreateOptions()` inclut ces chemins dans `HostConfig.Binds` en mode `ro` (read-only par defaut)

### AC-13 : MountedPaths enregistrees dans container_instances
**Given** un container lance avec des mounts valides
**When** le container demarre
**Then** les chemins montes sont enregistres dans `container_instances.mountedPaths`

### AC-14 : URL encoding detection
**Given** un path avec encodage URL (`/workspace/%2e%2e%2fetc%2fpasswd`)
**When** le path est valide
**Then** l'encodage est decode et le path normalise est verifie → refuse si traversal

---

## data-test-id Mapping

| data-testid | Element | Fichier | Description |
|-------------|---------|---------|-------------|
| `cont-s03-svc-validate-mount` | Code marker | `mount-allowlist.ts` | Fonction validateMountPath |
| `cont-s03-svc-validate-all` | Code marker | `mount-allowlist.ts` | Fonction validateAllMounts |
| `cont-s03-svc-normalize` | Code marker | `mount-allowlist.ts` | Fonction normalizePath |
| `cont-s03-svc-detect-traversal` | Code marker | `mount-allowlist.ts` | Fonction detectPathTraversal |
| `cont-s03-svc-detect-null` | Code marker | `mount-allowlist.ts` | Fonction detectNullBytes |
| `cont-s03-svc-detect-symlink` | Code marker | `mount-allowlist.ts` | Fonction detectSymlinkEscape |
| `cont-s03-svc-sensitive-paths` | Code marker | `mount-allowlist.ts` | Liste des chemins sensibles |
| `cont-s03-svc-add-allowlist` | Code marker | `mount-allowlist.ts` | Fonction addToAllowlist |
| `cont-s03-svc-remove-allowlist` | Code marker | `mount-allowlist.ts` | Fonction removeFromAllowlist |
| `cont-s03-svc-get-allowlist` | Code marker | `mount-allowlist.ts` | Fonction getEffectiveAllowlist |
| `cont-s03-cm-validate` | Code marker | `container-manager.ts` | Integration validation dans launchContainer |
| `cont-s03-cm-binds` | Code marker | `container-manager.ts` | Integration binds dans buildDockerCreateOptions |
| `cont-s03-cm-mounted-paths` | Code marker | `container-manager.ts` | Enregistrement mountedPaths dans instance |
| `cont-s03-route-get-allowlist` | Code marker | `containers.ts` | Route GET allowlist |
| `cont-s03-route-put-allowlist` | Code marker | `containers.ts` | Route PUT allowlist |
| `cont-s03-route-validate` | Code marker | `containers.ts` | Route POST validate |
| `cont-s03-type-result` | Code marker | `mount-allowlist.ts (types)` | Type MountValidationResult |
| `cont-s03-type-violation` | Code marker | `mount-allowlist.ts (types)` | Type MountViolation |
| `cont-s03-validator-paths` | Code marker | `mount-allowlist.ts (validators)` | Zod schema pour paths |
| `cont-s03-validator-validate` | Code marker | `mount-allowlist.ts (validators)` | Zod schema pour validate request |
| `cont-s03-audit-violation` | Code marker | `mount-allowlist.ts / container-manager.ts` | Emission audit violation |
| `cont-s03-barrel-svc` | Code marker | `services/index.ts` | Export mountAllowlistService |
| `cont-s03-barrel-types` | Code marker | `types/index.ts` | Export mount-allowlist types |
| `cont-s03-barrel-validators` | Code marker | `validators/index.ts` | Export mount-allowlist validators |

---

## Test Cases (QA Agent)

### Groupe 1 -- File existence (T01-T03)
| ID | Description | data-testid |
|----|-------------|-------------|
| T01 | `mount-allowlist.ts` exists and exports `mountAllowlistService` | cont-s03-svc-validate-mount |
| T02 | `types/mount-allowlist.ts` exists with MountValidationResult + MountViolation | cont-s03-type-result |
| T03 | `validators/mount-allowlist.ts` exists with Zod schemas | cont-s03-validator-paths |

### Groupe 2 -- MountAllowlistService core functions (T04-T14)
| ID | Description | data-testid |
|----|-------------|-------------|
| T04 | `validateMountPath` function exists with signature | cont-s03-svc-validate-mount |
| T05 | `validateAllMounts` function exists | cont-s03-svc-validate-all |
| T06 | `normalizePath` function exists | cont-s03-svc-normalize |
| T07 | `detectPathTraversal` detects `..` patterns | cont-s03-svc-detect-traversal |
| T08 | `detectPathTraversal` detects encoded `%2e%2e` patterns | cont-s03-svc-detect-traversal |
| T09 | `detectNullBytes` detects `\0` and `%00` | cont-s03-svc-detect-null |
| T10 | `detectSymlinkEscape` uses realpath or similar | cont-s03-svc-detect-symlink |
| T11 | `isSensitivePath` checks against SENSITIVE_PATHS list | cont-s03-svc-sensitive-paths |
| T12 | SENSITIVE_PATHS includes critical system paths | cont-s03-svc-sensitive-paths |
| T13 | `addToAllowlist` updates profile allowedMountPaths in DB | cont-s03-svc-add-allowlist |
| T14 | `removeFromAllowlist` updates profile allowedMountPaths in DB | cont-s03-svc-remove-allowlist |

### Groupe 3 -- Validation logic (T15-T22)
| ID | Description | data-testid |
|----|-------------|-------------|
| T15 | Path within allowlist is accepted | cont-s03-svc-validate-mount |
| T16 | Subpath of allowed path is accepted | cont-s03-svc-validate-mount |
| T17 | Path outside allowlist is rejected | cont-s03-svc-validate-mount |
| T18 | Empty allowlist rejects all mounts | cont-s03-svc-validate-all |
| T19 | Path traversal `../` is detected and rejected | cont-s03-svc-detect-traversal |
| T20 | Null byte in path is detected and rejected | cont-s03-svc-detect-null |
| T21 | URL-encoded traversal `%2e%2e%2f` is detected | cont-s03-svc-detect-traversal |
| T22 | Sensitive paths are always rejected | cont-s03-svc-sensitive-paths |

### Groupe 4 -- ContainerManager integration (T23-T28)
| ID | Description | data-testid |
|----|-------------|-------------|
| T23 | launchContainer calls mount validation before docker.createContainer | cont-s03-cm-validate |
| T24 | buildDockerCreateOptions includes validated paths in Binds | cont-s03-cm-binds |
| T25 | mountedPaths is saved to container_instances after launch | cont-s03-cm-mounted-paths |
| T26 | launchContainer with invalid mount emits audit severity=critical | cont-s03-audit-violation |
| T27 | launchContainer accepts mountPaths option | cont-s03-cm-validate |
| T28 | Shadow .env bind is always included regardless of allowlist | cont-s03-cm-binds |

### Groupe 5 -- Routes (T29-T34)
| ID | Description | data-testid |
|----|-------------|-------------|
| T29 | GET mount-allowlist route exists with requirePermission | cont-s03-route-get-allowlist |
| T30 | PUT mount-allowlist route exists with requirePermission | cont-s03-route-put-allowlist |
| T31 | POST mount-validate route exists with requirePermission | cont-s03-route-validate |
| T32 | PUT mount-allowlist emits audit event | cont-s03-route-put-allowlist |
| T33 | POST mount-validate uses Zod validation | cont-s03-route-validate |
| T34 | Routes use assertCompanyAccess | cont-s03-route-get-allowlist |

### Groupe 6 -- Types and validators (T35-T40)
| ID | Description | data-testid |
|----|-------------|-------------|
| T35 | MountValidationResult type has path, allowed, violation fields | cont-s03-type-result |
| T36 | MountViolation type has code, message, severity fields | cont-s03-type-violation |
| T37 | MOUNT_VIOLATION_CODES constant lists all violation codes | cont-s03-type-violation |
| T38 | Zod mountPathsSchema validates array of paths | cont-s03-validator-paths |
| T39 | Zod mountValidateSchema validates profileId + paths | cont-s03-validator-validate |
| T40 | Types are exported from types/index.ts barrel | cont-s03-barrel-types |

### Groupe 7 -- Barrel exports (T41-T43)
| ID | Description | data-testid |
|----|-------------|-------------|
| T41 | mount-allowlist exported from services/index.ts | cont-s03-barrel-svc |
| T42 | mount-allowlist types exported from types/index.ts | cont-s03-barrel-types |
| T43 | mount-allowlist validators exported from validators/index.ts | cont-s03-barrel-validators |

### Groupe 8 -- Audit emission (T44-T46)
| ID | Description | data-testid |
|----|-------------|-------------|
| T44 | Audit event emitted on mount violation with action "container.mount_violation" | cont-s03-audit-violation |
| T45 | Audit metadata includes violation code and path | cont-s03-audit-violation |
| T46 | Audit event emitted on allowlist update with action "container.mount_allowlist_updated" | cont-s03-route-put-allowlist |

### Groupe 9 -- Launch options integration (T47-T50)
| ID | Description | data-testid |
|----|-------------|-------------|
| T47 | ContainerLaunchOptions or launchContainer accepts mountPaths parameter | cont-s03-cm-validate |
| T48 | launchSchema in containers.ts includes mountPaths | cont-s03-cm-validate |
| T49 | getEffectiveAllowlist reads from profile's allowedMountPaths | cont-s03-svc-get-allowlist |
| T50 | Validated mounts are added as read-only Binds | cont-s03-cm-binds |

---

## Definition of Done

- [ ] MountAllowlistService cree avec toutes les fonctions de validation
- [ ] Detection path traversal, null bytes, symlinks, URL encoding
- [ ] Liste de chemins sensibles interdits
- [ ] Integration dans container-manager.ts (launchContainer + buildDockerCreateOptions)
- [ ] 3 routes API (GET/PUT allowlist, POST validate)
- [ ] Types partages et validators Zod
- [ ] Audit trail severity=critical pour violations
- [ ] Barrel exports dans services/, types/, validators/
- [ ] mountedPaths enregistres dans container_instances
- [ ] 50 E2E tests Playwright passent
- [ ] TypeScript compile sans erreurs
- [ ] 0 regressions CONT-S01, CONT-S02, CONT-S05
