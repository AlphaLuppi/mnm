# Folder Workspace — Design Spec

## Résumé

Transformer les folders en vrais espaces de travail : upload direct de fichiers, instructions markdown injectées dans les conversations, modèle de partage granulaire (user-level + tag-level) contrôlé par les permissions de rôle, et un layout workspace 3 colonnes pour le chat contextuel.

## 1. Modèle de données

### 1.1 Table `folders` — modifications

- **Ajout** `instructions` (text, nullable) — markdown libre injecté dans le system prompt des chats du folder
- **Suppression** `visibility` — la visibilité est désormais entièrement dérivée de l'ownership, des `folder_shares` et des `tag_assignments`

### 1.2 Nouvelle table `folder_shares`

```sql
CREATE TABLE folder_shares (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id     uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES companies(id),
  shared_with_user_id text NOT NULL,
  permission    text NOT NULL DEFAULT 'viewer',  -- 'viewer' | 'editor'
  shared_by_user_id   text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(folder_id, shared_with_user_id)
);
```

### 1.3 Table `documents` — modification

- **Ajout** `owned_by_folder_id` (uuid, FK → folders, nullable, ON DELETE SET NULL) — si non-null, le document est "natif" au folder
- **Index** `documents_owned_folder_idx` sur `(owned_by_folder_id)`

### 1.4 Table `folder_items` — inchangée

Sert uniquement pour les items **importés** (artefacts/documents/channels qui existaient indépendamment et sont liés au folder). Les documents natifs sont identifiés via `documents.ownedByFolderId`.

### 1.5 Nouvelles permissions

| Slug | Description |
|------|-------------|
| `folders:share_users` | Partager un folder à des utilisateurs spécifiques |
| `folders:share_tags` | Assigner des tags à un folder (partage de groupe) |

Les permissions existantes `folders:create`, `folders:read`, `folders:edit`, `folders:delete` restent inchangées.

## 2. Visibilité

La visibilité est dérivée, pas stockée :

| Qui | Voit le folder ? | Peut éditer ? |
|-----|-------------------|---------------|
| Owner | Toujours | Toujours |
| Admin (bypassTagFilter) | Toujours | Toujours |
| User dans `folder_shares` | Oui | Si `permission = 'editor'` |
| User qui partage ≥1 tag avec le folder | Oui | Non (viewer implicite) |
| Autre | Non | Non |

### Query de listing

```sql
WHERE company_id = :companyId AND (
  owner_user_id = :userId
  OR EXISTS (
    SELECT 1 FROM folder_shares
    WHERE folder_id = folders.id AND shared_with_user_id = :userId
  )
  OR EXISTS (
    SELECT 1 FROM tag_assignments fa
    JOIN tag_assignments ua ON fa.tag_id = ua.tag_id
    WHERE fa.target_type = 'folder' AND fa.target_id = folders.id::text
      AND fa.company_id = :companyId
      AND ua.target_type = 'user' AND ua.target_id = :userId
      AND ua.company_id = :companyId
  )
)
```

### Contrôle d'édition

- Owner et Admin → toujours éditeur
- `folder_shares` avec `permission = 'editor'` → éditeur
- Tag overlap → viewer uniquement
- Seul l'owner peut supprimer le folder

## 3. Upload et ownership des documents

### 3.1 Upload dans un folder

Nouvelle route `POST /folders/:id/upload` (multipart) :

1. Passe par le flow existant : StorageService → Asset → Document
2. Set `ownedByFolderId = folderId` sur le document
3. Crée un `folderItem` de type "document" pointant vers ce doc (affichage unifié)
4. Pipeline d'ingestion existant (BullMQ text extraction + embeddings)

### 3.2 Import d'un item existant

Inchangé — `POST /folders/:id/items`. Le document/artefact n'a pas de `ownedByFolderId`, lié via `folderItems` uniquement.

### 3.3 Suppression d'un folder

**Étape 1 — Preview :** `GET /folders/:id/deletion-preview` retourne :
- `nativeDocuments[]` — docs avec `ownedByFolderId = folderId` (seront supprimés par défaut)
- `importedItems[]` — items liés via `folderItems` (lien cassé, entités conservées)
- `channels[]` — chats du folder (`folderId` → null)

**Étape 2 — Confirmation :** `DELETE /folders/:id` avec body optionnel :
```json
{ "preserveDocumentIds": ["uuid1", "uuid2"] }
```

- Docs dans `preserveDocumentIds` → `ownedByFolderId = null` (deviennent standalone)
- Docs natifs non préservés → soft-delete (`deletedAt = now()`)
- Folder supprimé → CASCADE sur `folderItems`, SET NULL sur `chatChannels.folderId`

## 4. Instructions et injection chat

### 4.1 Stockage

Champ `instructions` (text, nullable) sur `folders`. Markdown libre.

### 4.2 Édition

Via `PATCH /folders/:id`, champ ajouté au `updateFolderSchema`. Éditable par owner et editors.

### 4.3 Injection dans le system prompt

Dans `chatCompletionService.prepareContext()` :

1. Le channel a un `folderId` → fetch `folders.instructions`
2. Injection dans `buildSystemPrompt()` en premier, avant le prompt agent :

```
[Folder instructions — ces instructions s'appliquent à cette conversation]
{folder.instructions}

[Agent]
You are {agent.name}...
```

Ordre : folder instructions → agent system prompt → capabilities → chat features prompt.

### 4.4 Documents du folder comme contexte RAG

Quand un chat est dans un folder, les documents natifs + importés sont automatiquement disponibles comme contexte RAG (même mécanisme que `chatContextLinks`).

## 5. Routes API

### 5.1 Routes modifiées

| Route | Changement |
|-------|-----------|
| `POST /folders` | Suppression du champ `visibility` dans le body |
| `PATCH /folders/:id` | Ajout de `instructions` dans le body. Check élargi : owner OU editor |
| `DELETE /folders/:id` | Body optionnel `{ preserveDocumentIds }`, flow deletion-preview |
| `GET /folders` | Nouvelle query de listing (owner + shares + tags) |
| `GET /folders/:id` | Retourne `instructions`, `shares[]`, indicateur `canEdit` |
| `POST /folders/:id/tags` | Permission changée : `folders:share_tags` (au lieu de `folders:edit`) |
| `DELETE /folders/:id/tags/:tagId` | Permission changée : `folders:share_tags` |

### 5.2 Nouvelles routes

| Route | Permission | Description |
|-------|-----------|-------------|
| `POST /folders/:id/upload` | `folders:edit` | Upload multipart dans le folder |
| `GET /folders/:id/deletion-preview` | `folders:delete` | Preview des entités impactées |
| `POST /folders/:id/shares` | `folders:share_users` | Partager à un user `{ userId, permission }` |
| `GET /folders/:id/shares` | `folders:read` | Lister les shares du folder |
| `PATCH /folders/:id/shares/:shareId` | `folders:share_users` | Modifier la permission |
| `DELETE /folders/:id/shares/:shareId` | `folders:share_users` | Révoquer un partage |

## 6. Frontend

### 6.1 Navigation (3 niveaux)

1. **Liste des folders** (`/folders`) — `FolderCard` avec tags affichés en badges colorés
2. **Détail du folder** (`/folders/:id`) — infos, instructions, documents, conversations, partage
3. **Workspace mode** (`/folders/:id/chat/:channelId`) — layout 3 colonnes

### 6.2 Workspace layout

```
┌─────────────────┬──────────────────────────┬─────────────────┐
│  Sidebar folder  │        Chat              │ Artifact preview│
│                 │                          │   (optionnel)   │
│ ▸ Instructions  │  [messages]              │                 │
│   (éditable)    │                          │  [preview HTML/ │
│                 │                          │   code/md]      │
│ ▸ Documents     │                          │                 │
│   - doc1.pdf    │                          │                 │
│   - doc2.xlsx   │                          │                 │
│                 │                          │                 │
│ ▸ Artefacts     │  ┌──────────────────┐    │                 │
│   - schema.sql  │  │ input + send     │    │                 │
│                 │  └──────────────────┘    │                 │
│ ▸ Partage       │                          │                 │
│   Tom (editor)  │                          │                 │
│   #devops (tag) │                          │                 │
└─────────────────┴──────────────────────────┴─────────────────┘
```

- **Sidebar gauche** : infos du folder éditables inline (instructions markdown, drag & drop upload, gestion partage). Collapsible.
- **Centre** : chat existant. Bannière "Folder: {name}" avec lien retour.
- **Droite** : panel artefacts existant, s'ouvre au clic.

### 6.3 Composants

**À créer :**
- `FolderDetailPage` — page détail du folder
- `FolderWorkspaceLayout` — layout 3 colonnes
- `FolderSidebar` — sidebar workspace (instructions, docs, partage)
- `FolderShareManager` — gestion des shares (users + tags)
- `FolderUploadZone` — zone d'upload drag & drop

**À refactorer :**
- `FolderCard` — afficher les tags en badges colorés
- `FolderItemList` — distinguer natif vs importé visuellement

**Réutilisés tels quels :**
- `ChatMessageList`, `ChatInput`, `ArtifactPreview`

## 7. Migration

**Nouvelle migration (numéro suivant disponible) :**

1. Migrer les folders `visibility = 'public'` → deviennent privés (early-stage, pas de données prod)
2. `ALTER TABLE folders DROP COLUMN visibility`
3. `ALTER TABLE folders ADD COLUMN instructions text`
4. `CREATE TABLE folder_shares (...)`
5. `ALTER TABLE documents ADD COLUMN owned_by_folder_id uuid REFERENCES folders(id) ON DELETE SET NULL`
6. `CREATE INDEX documents_owned_folder_idx ON documents(owned_by_folder_id)`
7. `INSERT INTO permissions` : `folders:share_users`, `folders:share_tags`

**Code mort à supprimer :**
- Type `FolderVisibility` et constante `FOLDER_VISIBILITIES` dans `packages/shared`
- Champ `visibility` dans les validators Zod (`createFolderSchema`, `updateFolderSchema`)
- Logique de filtre `visibility` dans `folderService.list()` et `folderService.getById()`
- Query param `visibility` dans la route `GET /folders`
- Toute référence à `folders.visibility` dans le code
