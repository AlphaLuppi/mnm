---
title: 'Universal Document Viewer'
slug: 'universal-document-viewer'
created: '2026-04-07'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - react-pdf (PDF.js wrapper)
  - pdfjs-dist (PDF.js worker, peer dep)
  - Radix Dialog (existing — dialog.tsx)
  - React Context API (following DialogContext.tsx pattern)
  - @tanstack/react-query (existing — for on-click doc metadata fetch)
files_to_modify:
  - ui/src/components/ui/document-viewer.tsx (NEW — Provider + Hook + Viewer + Renderers, single file)
  - ui/src/main.tsx (wrap DocumentViewerProvider next to DialogProvider)
  - ui/src/components/chat/MessageBubble.tsx (add click handler on document_upload card)
  - ui/src/components/chat/ContextLinkBar.tsx (add onDocumentClick handler for document links)
  - ui/src/components/folders/FolderItemList.tsx (add onClick for document items)
  - ui/src/components/folders/FolderSidebar.tsx (no direct change — passes through FolderItemList)
code_patterns:
  - Radix Dialog fullscreen
  - React Context + useDocumentViewer hook (single file)
  - documentsApi.getContentUrl() for file URLs
  - Mime-type based renderer switching
  - openDocuments(docs[], startIndex) for list navigation
  - CSS transform scale/translate for image zoom
  - React.lazy() for PDF renderer
test_patterns:
  - Unit tests for mime-type detection
  - Component render tests per format
  - Integration test for hook trigger
  - Navigation prev/next boundary tests
  - Renderer switch state reset tests
  - Keyboard shortcut tests
---

# Tech-Spec: Universal Document Viewer

**Created:** 2026-04-07

## Overview

### Problem Statement

Quand un utilisateur clique sur un document (PDF, image, texte, etc.) dans MnM, il n'y a aucun preview inline — juste un download ou un badge de statut d'ingestion. L'utilisateur doit télécharger le fichier et l'ouvrir dans une app externe pour voir son contenu. Cela casse le flow de supervision et ralentit le travail.

### Solution

Un composant `DocumentViewer` en Dialog fullscreen, accessible depuis n'importe quel endroit de l'app via un React Context (`DocumentViewerProvider`) et un hook `useDocumentViewer()`. Le viewer détecte le mime-type et affiche le rendu approprié (PDF, image, texte, code, markdown, CSV, vidéo, audio). Navigation prev/next entre documents dans un contexte de liste. PDF toolbar avec zoom/page/rotation. Un bouton "Télécharger" est toujours disponible dans le header.

### Scope

**In Scope:**
- Composant `DocumentViewer` (Dialog fullscreen) dans `ui/src/components/ui/`
- `DocumentViewerProvider` + `useDocumentViewer()` hook wrappé au root de l'app — **single file**
- Formats supportés : PDF (react-pdf), images (PNG/JPG/GIF/SVG/WebP), texte/code (syntax highlight), markdown, CSV (table), vidéo/audio (natif `<video>`/`<audio>`), JSON (pretty-print)
- **Navigation prev/next** entre documents (flèches latérales + `←`/`→` clavier) — désactivées aux bornes
- **PDF toolbar** : zoom +/-, indicateur de page, rotation
- **Image zoom** : scroll-to-zoom + drag-to-pan (CSS transform, pas de lib)
- **Keyboard shortcuts** : `Escape` = fermer, `←`/`→` = prev/next, `+`/`-` = zoom
- **State reset** entre documents (zoom, page courante, rotation)
- Bouton "Télécharger" dans le header du viewer
- 4 points d'intégration : MessageBubble, ContextLinkBar, FolderItemList, FolderSidebar
- Fallback "format non supporté" avec bouton download

**Out of Scope:**
- Édition de documents inline
- Annotations / commentaires sur documents
- OCR ou extraction de texte
- Nouveau système d'upload
- Viewer d'artifacts (déjà géré par ArtifactPanel)

## Context for Development

### Codebase Patterns

- **Context pattern** — `ui/src/context/DialogContext.tsx` : `createContext` + `useState` + `useCallback` + Provider export + `useHook()` export. Le DocumentViewerProvider suit exactement ce pattern.
- **Provider stack** (`main.tsx` L74-96) : QueryClient > Theme > Company > Toast > LiveUpdates > Tooltip > Breadcrumb > Sidebar > Panel > **Dialog**. DocumentViewerProvider s'insère juste après DialogProvider (même niveau).
- **Dialog** (`ui/src/components/ui/dialog.tsx`) : Radix `DialogPrimitive` avec `showCloseButton` prop, className override. Le fullscreen variant override `max-w` et `max-h` via className.
- **API documents** (`ui/src/api/documents.ts`) : `getContentUrl(companyId, id)` retourne `/api/companies/{companyId}/documents/{id}/content`. L'endpoint backend set `Content-Type` correctement depuis `asset.contentType`.
- **Document type** (`shared/types/documents.ts`) : `{ id, title, mimeType, byteSize, pageCount, ... }` — mimeType disponible.
- **FolderItem** (`shared/types/folders.ts`) : `{ documentId: string | null, itemType, displayName }` — PAS de mimeType. Besoin de `documentsApi.getById()` au clic.
- **ChatContextLink** (`shared/types/chat-sharing.ts`) : `{ documentId: string | null, linkType }` — PAS de mimeType. Même pattern de résolution.
- **MessageBubble document_upload** : `meta.title` et `meta.ingestionStatus` disponibles. `meta.documentId` et `meta.mimeType` doivent être ajoutés au flow d'upload (côté frontend dans AgentChatPanel/DocumentDropZone).
- **Backend Content-Disposition** : `attachment` — n'affecte PAS les `<img>`, `<video>`, fetch() (seulement navigation directe). react-pdf utilise fetch internement, donc OK.

### Files to Reference

| File | Purpose | Détails clés |
| ---- | ------- | ------------ |
| `ui/src/context/DialogContext.tsx` | Pattern de Context à reproduire | createContext + useState + useCallback |
| `ui/src/main.tsx` L74-96 | Provider stack — insertion point | Après DialogProvider |
| `ui/src/components/ui/dialog.tsx` | Dialog Radix — base fullscreen | showCloseButton, className override |
| `ui/src/api/documents.ts` | API documents | `getContentUrl()`, `getById()` |
| `packages/shared/src/types/documents.ts` | Type Document | `{ id, title, mimeType }` |
| `packages/shared/src/types/folders.ts` | Type FolderItem | `{ documentId, displayName }` — pas de mimeType |
| `packages/shared/src/types/chat-sharing.ts` | Type ChatContextLink | `{ documentId, linkType }` — pas de mimeType |
| `ui/src/components/chat/MessageBubble.tsx` L106-141 | document_upload card | meta.title, meta.ingestionStatus — pas de documentId |
| `ui/src/components/chat/ContextLinkBar.tsx` L68-72 | handleChipClick | Actuellement artifact-only, ajouter document |
| `ui/src/components/folders/FolderItemList.tsx` L38-40 | Item row | Pas de onClick, ajouter |
| `ui/src/components/chat/DocumentDropZone.tsx` | Upload + onUploadComplete | Retourne doc.id — source pour enrichir metadata |
| `ui/src/components/AgentChatPanel.tsx` L160-168 | handleFileSelect | Upload puis sendMessage text — enrichir avec metadata |
| `server/src/routes/documents.ts` L173-208 | GET content endpoint | Content-Type correct, Content-Disposition: attachment |

### Technical Decisions

1. **React Context pattern** — Un Context au root permet à n'importe quel composant d'ouvrir le viewer. Deux méthodes : `openDocument(doc)` pour un doc isolé, `openDocuments(docs[], startIndex)` pour une liste avec navigation. Suit le pattern exact de `DialogContext.tsx`.
2. **Single file** — Provider, hook, composant viewer et renderers vivent dans un seul fichier `document-viewer.tsx`. Moins de surface, plus cohésif.
3. **Provider dans main.tsx** — DocumentViewerProvider wrappé juste après DialogProvider dans le provider stack (L84-86 de main.tsx).
4. **react-pdf** — Wrapper React officiel pour PDF.js. Standard de l'industrie pour le rendu PDF côté client.
5. **Worker PDF.js via CDN** — Chargé depuis unpkg pour éviter la complexité de build. Fallback local si CDN down.
6. **Mime-type routing** — Le viewer switche le renderer basé sur le `mimeType` du document (stocké en DB). Pas de détection par extension.
7. **Dialog fullscreen** — Utilise le `Dialog` Radix existant avec override className : `max-w-[95vw] max-h-[95vh]` + `showCloseButton={false}` (on gère le close via notre propre header).
8. **Lazy loading** — `react-pdf` chargé via `React.lazy()` + `Suspense` pour ne pas impacter le bundle initial (~500kb).
9. **Image zoom via CSS** — `transform: scale()` + `translate()` pour le zoom/pan. Pas de lib externe.
10. **Navigation prev/next** — Gérée dans le Provider (`documents[]` + `currentIndex`). Désactivée aux bornes (pas de boucle). State reset (zoom, page, rotation) à chaque changement de document.
11. **Keyboard shortcuts** — `useEffect` avec capture d'events uniquement quand le viewer est ouvert. Cleanup au unmount pour éviter les conflits.
12. **Metadata resolution on-click** — FolderItemList et ContextLinkBar n'ont pas le `mimeType` directement. Utiliser `documentsApi.getById()` au clic pour résoudre. Coût négligeable (1 API call, document déjà en cache react-query probablement).
13. **MessageBubble enrichment** — Ajouter `meta.documentId` et `meta.mimeType` lors de l'upload dans AgentChatPanel et DocumentDropZone pour éviter une résolution au clic.

## Implementation Plan

### Tasks

- [ ] **Task 1 : Installer react-pdf**
  - File : `ui/package.json`
  - Action : `bun add react-pdf` (pdfjs-dist est une peer dep auto-résolue)
  - Notes : Vérifier la compatibilité avec React 18. Configurer le worker PDF.js via CDN dans le composant.

- [ ] **Task 2 : Créer le composant DocumentViewer (single file)**
  - File : `ui/src/components/ui/document-viewer.tsx` (NEW)
  - Action : Créer le fichier avec les éléments suivants, dans cet ordre :

  **2a — Types & helpers**
  ```typescript
  interface DocumentViewerItem {
    id: string;
    title: string;
    mimeType: string;
    url: string;
  }

  interface DocumentViewerContextValue {
    isOpen: boolean;
    openDocument: (doc: DocumentViewerItem) => void;
    openDocuments: (docs: DocumentViewerItem[], startIndex?: number) => void;
    closeDocument: () => void;
  }

  function getMimeCategory(mimeType: string): "pdf" | "image" | "video" | "audio" | "text" | "code" | "markdown" | "csv" | "json" | "unknown"
  ```
  - `getMimeCategory` : route les mime-types vers le bon renderer :
    - `application/pdf` → `"pdf"`
    - `image/*` → `"image"`
    - `video/*` → `"video"`
    - `audio/*` → `"audio"`
    - `text/markdown` → `"markdown"`
    - `text/csv` → `"csv"`
    - `application/json` → `"json"`
    - `text/*`, `application/javascript`, `application/typescript`, `application/xml` → `"code"`
    - Tout le reste → `"unknown"`

  **2b — Context + Provider + Hook**
  - Suivre le pattern exact de `DialogContext.tsx`
  - State : `documents: DocumentViewerItem[]`, `currentIndex: number`, `isOpen: boolean`
  - `openDocument(doc)` : set `documents=[doc]`, `currentIndex=0`, `isOpen=true`
  - `openDocuments(docs, startIndex=0)` : set `documents=docs`, `currentIndex=startIndex`, `isOpen=true`
  - `closeDocument()` : set `isOpen=false`, reset state
  - `next()` / `prev()` : incrémente/décrémente `currentIndex` (borné)
  - Export `DocumentViewerProvider` et `useDocumentViewer()`

  **2c — Renderers (composants internes)**
  - `PdfRenderer` : Wrappé dans `React.lazy()`. Utilise `react-pdf` `Document` + `Page` components. State interne : `numPages`, `pageNumber`, `scale`, `rotation`. Toolbar : zoom +/- (0.5x-3x par pas de 0.25), page indicator (`Page N / Total`), rotation (90° clockwise). Worker configuré via `pdfjs.GlobalWorkerOptions.workerSrc` = CDN unpkg.
  - `ImageRenderer` : `<img>` natif avec CSS `transform: scale() translate()`. State : `scale`, `position`. Handlers : `onWheel` (zoom), `onMouseDown`/`onMouseMove`/`onMouseUp` (drag pan). Curseur `grab`/`grabbing`. Double-clic = reset zoom.
  - `VideoRenderer` : `<video controls>` natif avec `src={url}` et `type={mimeType}`.
  - `AudioRenderer` : `<audio controls>` natif.
  - `TextRenderer` : `<pre>` avec le contenu fetché via `fetch(url)`. Pour les types `code`, utiliser un `<code>` bloc avec classe de langage détectée depuis le mime-type.
  - `MarkdownRenderer` : Réutiliser `MarkdownBody` existant. Fetch le contenu texte via `fetch(url)`.
  - `CsvRenderer` : Fetch le CSV, parse les lignes, afficher dans un `<table>` avec header row.
  - `JsonRenderer` : Fetch le JSON, `JSON.stringify(parsed, null, 2)` dans un `<pre>`.
  - `FallbackRenderer` : Message "Aperçu non disponible pour ce format" + badge mime-type + bouton Download.

  **2d — DocumentViewerDialog (composant principal)**
  - Utilise `Dialog` + `DialogContent` de `dialog.tsx` avec className override : `max-w-[95vw] max-h-[95vh] p-0 gap-0 overflow-hidden`
  - `showCloseButton={false}` — on gère via notre header
  - **Header** : Titre du document (truncated), badge mime-type, bouton Download (`<a href={url} download>`), bouton Close (X)
  - **Body** : Switch sur `getMimeCategory(currentDoc.mimeType)` → renderer correspondant. Wrappé dans `<Suspense>` pour le lazy loading PDF.
  - **Navigation** : Flèches `←` / `→` positionnées aux bords gauche/droit du body, semi-transparentes, `hover:opacity-100`. Visibles seulement si `documents.length > 1`. Désactivées aux bornes (premier/dernier).
  - **Keyboard** : `useEffect` avec event listener sur `keydown` quand `isOpen=true` :
    - `Escape` → `closeDocument()`
    - `ArrowLeft` → `prev()`
    - `ArrowRight` → `next()`
    - `+` / `=` → zoom in (si PDF ou image)
    - `-` → zoom out (si PDF ou image)
  - **State reset** : Quand `currentIndex` change, reset le zoom, la page, la rotation.
  - Notes : Le Dialog est rendu DANS le Provider, contrôlé par `isOpen`. Le Provider expose les méthodes, le Dialog consomme le state.

- [ ] **Task 3 : Intégrer le Provider dans main.tsx**
  - File : `ui/src/main.tsx`
  - Action : Importer `DocumentViewerProvider` depuis `@/components/ui/document-viewer`. Wrapper juste après `<DialogProvider>` (L84) :
  ```tsx
  <DialogProvider>
    <DocumentViewerProvider>
      <App />
    </DocumentViewerProvider>
  </DialogProvider>
  ```

- [ ] **Task 4 : Enrichir les metadata d'upload document**
  - Files : `ui/src/components/AgentChatPanel.tsx`, `ui/src/components/chat/DocumentDropZone.tsx`
  - Action dans `AgentChatPanel.tsx` (L160-168) :
    - `handleFileSelect` : capturer le résultat de `documentsApi.upload()` dans une variable `doc`
    - Envoyer le message avec metadata enrichie au lieu d'un simple texte :
    ```typescript
    const doc = await documentsApi.upload(selectedCompanyId, file, { channelId: channel.id });
    sendMessage(`[Uploaded: ${file.name}]`, {
      type: "document_upload",
      documentId: doc.id,
      title: doc.title,
      mimeType: doc.mimeType,
      ingestionStatus: doc.ingestionStatus,
    });
    ```
  - Action dans `DocumentDropZone.tsx` : Le `onUploadComplete` reçoit déjà `doc.id`. Le parent (`AgentChatPanel`) gère le message — pas de changement ici.
  - Notes : Vérifier que `sendMessage` accepte un 2e argument `metadata`. Si non, adapter l'API du WS client.

- [ ] **Task 5 : Intégrer dans MessageBubble**
  - File : `ui/src/components/chat/MessageBubble.tsx`
  - Action :
    - Ajouter prop `onDocumentClick?: (documentId: string, title: string, mimeType: string) => void` à `MessageBubbleProps`
    - Dans le bloc `document_upload` (L106-141), transformer le `<div>` wrapper en `<button>` cliquable (comme le bloc artifact_reference)
    - Au clic : appeler `onDocumentClick(meta.documentId, meta.title, meta.mimeType)` si les données sont disponibles
    - Si `meta.documentId` n'est pas disponible (anciens messages), ne pas rendre cliquable
    - Ajouter `cursor-pointer hover:bg-muted/50 transition-colors` au style

- [ ] **Task 6 : Intégrer dans ContextLinkBar**
  - File : `ui/src/components/chat/ContextLinkBar.tsx`
  - Action :
    - Ajouter prop `onDocumentClick?: (documentId: string) => void` à `ContextLinkBarProps`
    - Dans `handleChipClick` (L68-72), ajouter la branche document :
    ```typescript
    if (link.linkType === "document" && link.documentId && onDocumentClick) {
      onDocumentClick(link.documentId);
    }
    ```
    - Le composant parent résout le metadata via `documentsApi.getById()` et appelle `openDocument()`.

- [ ] **Task 7 : Intégrer dans FolderItemList**
  - File : `ui/src/components/folders/FolderItemList.tsx`
  - Action :
    - Ajouter prop `onItemClick?: (item: FolderItem) => void` à `FolderItemListProps`
    - Wrapper le `<div>` de chaque item (L38) avec un `onClick` qui appelle `onItemClick(item)` pour les items de type `document`
    - Ajouter `cursor-pointer` quand l'item est de type document
    - Le composant parent (`FolderDetail`, `FolderSidebar`) résout le metadata via `documentsApi.getById()` et appelle `openDocument()` ou `openDocuments()` pour la liste complète des documents du dossier.

- [ ] **Task 8 : Wiring dans les pages parentes**
  - Files : Pages qui utilisent MessageBubble, ContextLinkBar, FolderItemList
  - Action : Dans chaque page parente :
    - Importer `useDocumentViewer` et `useCompany`
    - Créer un handler qui résout le document metadata si nécessaire (`documentsApi.getById()`), construit le `DocumentViewerItem` (`{ id, title, mimeType, url: documentsApi.getContentUrl(companyId, id) }`), et appelle `openDocument()` ou `openDocuments()`
    - Passer le handler comme prop aux composants enfants
  - Notes : Pour FolderDetail/FolderSidebar, construire la liste complète des documents du dossier pour le `openDocuments()` avec navigation prev/next.

### Acceptance Criteria

- [ ] **AC 1** : Given un document PDF dans un dossier, when l'utilisateur clique dessus, then le viewer s'ouvre en fullscreen avec le PDF affiché et la toolbar (zoom, page, rotation) visible.
- [ ] **AC 2** : Given une image (PNG/JPG/SVG) dans le chat, when l'utilisateur clique sur le document_upload, then le viewer s'ouvre avec l'image affichée. L'utilisateur peut zoomer avec scroll et pan avec drag.
- [ ] **AC 3** : Given un fichier vidéo uploadé, when l'utilisateur clique dessus, then le viewer affiche un `<video>` avec les contrôles natifs (play/pause/seek).
- [ ] **AC 4** : Given un fichier texte/JSON/CSV, when l'utilisateur clique dessus, then le viewer affiche le contenu formaté (JSON pretty-printed, CSV en table, texte brut en `<pre>`).
- [ ] **AC 5** : Given un format non supporté (ex: .exe, .zip), when l'utilisateur clique dessus, then le viewer affiche un message "Aperçu non disponible" avec un bouton Download.
- [ ] **AC 6** : Given le viewer ouvert, when l'utilisateur clique sur le bouton Télécharger dans le header, then le fichier se télécharge avec son nom original.
- [ ] **AC 7** : Given un dossier avec 5 documents, when l'utilisateur clique sur le 3ème, then le viewer s'ouvre sur le 3ème document. Les flèches prev/next permettent de naviguer. Prev est désactivé sur le 1er, Next sur le 5ème.
- [ ] **AC 8** : Given le viewer ouvert sur un PDF (page 3, zoom 150%), when l'utilisateur navigue au document suivant (une image), then le state est reset : zoom revient à 100%, page revient à 1.
- [ ] **AC 9** : Given le viewer ouvert, when l'utilisateur appuie sur `Escape`, then le viewer se ferme. `←`/`→` naviguent. `+`/`-` zooment.
- [ ] **AC 10** : Given un document_upload dans le chat SANS `documentId` dans la metadata (ancien message), when l'utilisateur voit le message, then la card n'est PAS cliquable (pas de cursor pointer, pas de handler).
- [ ] **AC 11** : Given un lien document dans ContextLinkBar, when l'utilisateur clique sur le chip, then le viewer s'ouvre avec le document (après résolution metadata via API).

## Additional Context

### Dependencies

- `react-pdf` (npm) — PDF rendering via PDF.js. Version recommandée : latest stable (9.x).
- `pdfjs-dist` — PDF.js worker, peer dependency auto-résolue par react-pdf.
- Aucune autre dépendance externe nécessaire — images/video/audio sont natifs browser, CSV/JSON/texte parsés en JS vanilla.

### Testing Strategy

- **Unit tests** (`document-viewer.test.tsx`) :
  - `getMimeCategory()` : chaque mime-type route vers le bon renderer (15+ cas)
  - `useDocumentViewer` hook : `openDocument` → `isOpen=true`, `closeDocument` → `isOpen=false`, `next`/`prev` bornés, state reset au changement de document
  - Navigation boundary : `prev()` quand `currentIndex=0` → no-op, `next()` quand `currentIndex=last` → no-op
- **Component tests** :
  - Chaque renderer monte sans crash avec des données mockées
  - DocumentViewerDialog affiche le bon renderer selon le mime-type
  - Flèches navigation visibles seulement si `documents.length > 1`
  - Bouton Download présent avec le bon `href`
- **Integration tests** :
  - MessageBubble avec `meta.documentId` → cliquable, appelle `onDocumentClick`
  - MessageBubble sans `meta.documentId` → non cliquable
  - ContextLinkBar chip document → appelle `onDocumentClick`
  - FolderItemList item document → appelle `onItemClick`
- **E2E** (Playwright) :
  - Upload PDF via chat → clic sur la card → viewer fullscreen visible → toolbar PDF visible → download fonctionne
  - Navigation dans un dossier avec 3 documents → prev/next fonctionne → state reset entre docs
- **Keyboard** :
  - Escape ferme le viewer
  - ← et → naviguent
  - + et - zooment (PDF/image)

### Notes

- **Risque : react-pdf worker setup** — La configuration du worker PDF.js est le point le plus fragile. Si le CDN échoue, le PDF ne se charge pas. Mitigation : fallback vers un worker local copié au build, ou message d'erreur clair.
- **Risque : gros fichiers** — Les PDF >50 pages et les images très haute résolution peuvent causer des problèmes de performance. react-pdf pagine nativement, donc OK. Pour les images, le browser gère.
- **Backward compatibility** — Les anciens messages `document_upload` sans `documentId` dans la metadata ne seront pas cliquables. C'est acceptable — seuls les nouveaux uploads bénéficient du viewer.
- **Future : Content-Disposition** — Si besoin d'ouvrir des documents dans un `<iframe>` à l'avenir, il faudra changer `Content-Disposition: attachment` → `inline` sur le backend. Pas nécessaire pour cette implémentation (react-pdf et `<img>` n'utilisent pas d'iframe).
- **Future : Thumbnail previews** — Une fois le viewer en place, on pourrait ajouter des thumbnails dans les listes de documents (première page PDF, miniature image). Out of scope actuel.
