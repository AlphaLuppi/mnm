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
  - ui/src/hooks/useAgentChat.ts (extend sendMessage to accept optional metadata + messageType)
  - ui/src/components/AgentChatPanel.tsx (pass metadata on upload)
  - ui/src/components/chat/MessageBubble.tsx (add click handler on document_upload card)
  - ui/src/components/chat/ContextLinkBar.tsx (add onDocumentClick handler for document links)
  - ui/src/components/folders/FolderItemList.tsx (add onClick for document items)
  - ui/src/components/folders/FolderSidebar.tsx (pass onItemClick to FolderItemList)
  - ui/src/pages/FolderDetail.tsx (wire onItemClick → openDocuments)
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
- Syntax highlighting pour les fichiers code (pas de lib installée, monospace brut suffisant pour v1)
- Responsive mobile / touch events (pinch-to-zoom, swipe navigation) — cockpit desktop-first

## Context for Development

### Codebase Patterns

- **Context pattern** — `ui/src/context/DialogContext.tsx` : `createContext` + `useState` + `useCallback` + Provider export + `useHook()` export. Le DocumentViewerProvider suit exactement ce pattern.
- **Provider stack** (`main.tsx`) : QueryClient > Theme > Company > Toast > LiveUpdates > Tooltip > Breadcrumb > Sidebar > Panel > **Dialog**. DocumentViewerProvider s'insère juste après DialogProvider (même niveau).
- **Dialog** (`ui/src/components/ui/dialog.tsx`) : Radix `DialogPrimitive` avec `showCloseButton` prop, className override. Le fullscreen variant override `max-w` et `max-h` via className.
- **API documents** (`ui/src/api/documents.ts`) : `getContentUrl(companyId, id)` retourne `/api/companies/{companyId}/documents/{id}/content`. L'endpoint backend set `Content-Type` correctement depuis `asset.contentType`.
- **Document type** (`shared/types/documents.ts`) : `{ id, title, mimeType, byteSize, pageCount, ... }` — mimeType disponible.
- **FolderItem** (`shared/types/folders.ts`) : `{ documentId: string | null, itemType, displayName }` — PAS de mimeType. Besoin de `documentsApi.getById()` au clic.
- **ChatContextLink** (`shared/types/chat-sharing.ts`) : `{ documentId: string | null, linkType }` — PAS de mimeType. Même pattern de résolution.
- **MessageBubble document_upload** : `meta.title` et `meta.ingestionStatus` disponibles. `meta.documentId` et `meta.mimeType` doivent être ajoutés au flow d'upload. **ATTENTION** : `messageType` est une colonne DB séparée (pas dans metadata JSONB). Le hook `useAgentChat.ts` doit envoyer `messageType` dans le payload WS pour que le message soit correctement typé au reload.
- **useAgentChat.ts sendMessage** : Signature actuelle = `(content: string) => void`. Le payload WS envoyé ne contient que `{ type, content, clientMessageId }`. Le message optimiste hardcode `metadata: null` et `messageType: "text"`. **DOIT** être étendu pour accepter metadata + messageType optionnels.
- **Backend Content-Disposition** : `attachment` — n'affecte PAS les `<img>`, `<video>`, fetch() (seulement navigation directe). react-pdf utilise fetch internement, donc OK.

### Files to Reference

| File | Purpose | Détails clés |
| ---- | ------- | ------------ |
| `ui/src/context/DialogContext.tsx` | Pattern de Context à reproduire | createContext + useState + useCallback |
| `ui/src/main.tsx` | Provider stack — insertion point | Après `<DialogProvider>`, chercher `<App />` |
| `ui/src/components/ui/dialog.tsx` | Dialog Radix — base fullscreen | showCloseButton, className override |
| `ui/src/api/documents.ts` | API documents | `getContentUrl()`, `getById()` |
| `ui/src/hooks/useAgentChat.ts` | Hook chat WS — sendMessage | `sendMessage(content: string)` → doit accepter metadata + messageType |
| `packages/shared/src/types/documents.ts` | Type Document | `{ id, title, mimeType }` |
| `packages/shared/src/types/folders.ts` | Type FolderItem | `{ documentId, displayName }` — pas de mimeType |
| `packages/shared/src/types/chat-sharing.ts` | Type ChatContextLink | `{ documentId, linkType }` — pas de mimeType |
| `ui/src/components/chat/MessageBubble.tsx` | document_upload card | Chercher `meta?.type === "document_upload"` |
| `ui/src/components/chat/ContextLinkBar.tsx` | handleChipClick | Chercher `handleChipClick` — actuellement artifact-only |
| `ui/src/components/folders/FolderItemList.tsx` | Item row | Pas de onClick, ajouter |
| `ui/src/components/folders/FolderSidebar.tsx` | Passe FolderItemList | Doit forwarder onItemClick |
| `ui/src/pages/FolderDetail.tsx` | Page dossier | Utilise FolderItemList, doit wirer openDocuments |
| `ui/src/components/chat/DocumentDropZone.tsx` | Upload + onUploadComplete | Retourne doc.id — source pour enrichir metadata |
| `ui/src/components/AgentChatPanel.tsx` | handleFileSelect | Upload puis sendMessage text — enrichir avec metadata |
| `server/src/routes/documents.ts` | GET content endpoint | Content-Type correct, Content-Disposition: attachment |
| `server/src/validators/chat-ws.ts` | Schema WS | `chatClientMessageSchema` accepte déjà `metadata` optionnel |

### Technical Decisions

1. **React Context pattern** — Un Context au root permet à n'importe quel composant d'ouvrir le viewer. Deux méthodes : `openDocument(doc)` pour un doc isolé, `openDocuments(docs[], startIndex)` pour une liste avec navigation. Suit le pattern exact de `DialogContext.tsx`.
2. **Single file** — Provider, hook, composant viewer et renderers vivent dans un seul fichier `document-viewer.tsx`. Moins de surface, plus cohésif.
3. **Provider dans main.tsx** — DocumentViewerProvider wrappé juste après DialogProvider dans le provider stack de main.tsx.
4. **react-pdf** — Wrapper React officiel pour PDF.js. Standard de l'industrie pour le rendu PDF côté client.
5. **Worker PDF.js local par défaut** — Le worker est importé depuis `react-pdf` (qui le bundle depuis pdfjs-dist). Pas de CDN — environnement enterprise avec proxy/firewall/CSP. Configuration : `import { pdfjs } from 'react-pdf'; pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();`
6. **Mime-type routing** — Le viewer switche le renderer basé sur le `mimeType` du document (stocké en DB). Pas de détection par extension.
7. **Dialog fullscreen** — Utilise le `Dialog` Radix existant avec override className : `max-w-[95vw] max-h-[95vh]` + `showCloseButton={false}` (on gère le close via notre propre header).
8. **Lazy loading** — `react-pdf` chargé via `React.lazy()` + `Suspense` pour ne pas impacter le bundle initial (~500kb).
9. **Image zoom via CSS** — `transform: scale()` + `translate()` pour le zoom/pan. Pas de lib externe.
10. **Navigation prev/next** — Gérée dans le Provider (`documents[]` + `currentIndex`). Désactivée aux bornes (pas de boucle). State reset (zoom, page, rotation) à chaque changement de document.
11. **Keyboard shortcuts avec protection** — `useEffect` avec event listener sur `keydown` quand le viewer est ouvert. **Protections obligatoires** : (a) Ignorer les events si `event.target` est un `<input>`, `<textarea>`, ou `[contenteditable]` — évite les conflits avec les formulaires PDF interactifs. (b) Appeler `event.stopPropagation()` pour éviter que les raccourcis se propagent aux composants Radix sous-jacents. (c) Cleanup au unmount.
12. **Metadata resolution on-click** — FolderItemList et ContextLinkBar n'ont pas le `mimeType` directement. Utiliser `documentsApi.getById()` au clic pour résoudre. Coût négligeable (1 API call, document déjà en cache react-query probablement).
13. **sendMessage extension** — `useAgentChat.ts` `sendMessage` doit être étendu : `(content: string, opts?: { metadata?: Record<string, unknown>; messageType?: string })`. Le payload WS envoyé doit inclure `metadata` et le message optimiste doit utiliser le `messageType` fourni. Le schema Zod backend (`chatClientMessageSchema`) accepte déjà `metadata: z.record(z.unknown()).optional()`. Il faut aussi ajouter `messageType: z.string().optional()` au schema pour que le serveur persiste le bon type. Le serveur (`chat-ws-manager.ts` `createMessage`) doit utiliser le `messageType` du payload WS si fourni.
14. **Fetch-based renderers : error handling** — Tous les renderers qui font `fetch(url)` (Text, Markdown, CSV, JSON) doivent gérer : (a) loading state (spinner), (b) erreur réseau / 403 tag-scope / 404 doc supprimé → message d'erreur + bouton download, (c) timeout implicite via AbortController (30s).
15. **CSV preview limité** — Le CsvRenderer affiche les **100 premières lignes** max. Parsing via `split('\n')` puis `split(',')` avec gestion basique du quoting (`"champ, avec virgule"`). Au-delà de 100 lignes, message "Aperçu limité aux 100 premières lignes" + bouton download pour le fichier complet.
16. **Code = texte monospace sans highlighting** — Pas de lib de syntax highlighting installée (ni Prism, ni highlight.js, ni Shiki). Les fichiers code s'affichent en `<pre><code>` monospace brut. Suffisant pour v1. Syntax highlighting = future enhancement.
17. **Accessibilité (a11y)** — `aria-label` sur les boutons prev/next/close/download. `alt` text sur les images (utiliser le `title` du document). Le Dialog Radix gère nativement `role="dialog"`, `aria-modal`, et le focus trap.

## Implementation Plan

### Tasks

- [ ] **Task 1 : Installer react-pdf**
  - File : `ui/package.json`
  - Action : `cd ui && bun add react-pdf` (pdfjs-dist est une peer dep auto-résolue)
  - Notes : Vérifier la compatibilité avec React 18.

- [ ] **Task 2 : Étendre sendMessage pour supporter metadata + messageType**
  - File : `ui/src/hooks/useAgentChat.ts`
  - Action :
    - Changer la signature dans `UseAgentChatResult` :
    ```typescript
    sendMessage: (content: string, opts?: { metadata?: Record<string, unknown>; messageType?: string }) => void;
    ```
    - Dans l'implémentation `sendMessage` (chercher `const sendMessage = useCallback`), ajouter le 2e param `opts` :
    ```typescript
    const sendMessage = useCallback(
      (content: string, opts?: { metadata?: Record<string, unknown>; messageType?: string }) => {
    ```
    - Modifier le message optimiste pour utiliser les opts :
    ```typescript
    const optimistic: ChatMessage = {
      // ... existing fields ...
      metadata: opts?.metadata ?? null,
      messageType: opts?.messageType ?? "text",
      // ...
    };
    ```
    - Modifier le payload WS envoyé pour inclure metadata :
    ```typescript
    wsRef.current.send(JSON.stringify({
      type: "chat_message" as const,
      content: content.trim(),
      clientMessageId,
      metadata: opts?.metadata,
    }));
    ```
  - File : `server/src/validators/chat-ws.ts`
  - Action : Ajouter `messageType` au schema :
    ```typescript
    export const chatClientMessageSchema = z.object({
      type: z.literal("chat_message"),
      content: z.string().min(1).max(4096),
      metadata: z.record(z.unknown()).optional(),
      messageType: z.string().optional(),  // ← AJOUTER
      clientMessageId: z.string().optional(),
    });
    ```
  - File : `server/src/services/chat-ws-manager.ts`
  - Action : Dans le handler `chat_message`, passer `payload.messageType` au `createMessage` si fourni. Chercher l'appel `createMessage` dans le case `"chat_message"` et ajouter le messageType.

- [ ] **Task 3 : Créer le composant DocumentViewer (single file)**
  - File : `ui/src/components/ui/document-viewer.tsx` (NEW)
  - Action : Créer le fichier avec les éléments suivants, dans cet ordre :

  **3a — Types & helpers**
  ```typescript
  export interface DocumentViewerItem {
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

  function getMimeCategory(mimeType: string): "pdf" | "image" | "video" | "audio" | "text" | "markdown" | "csv" | "json" | "unknown"
  ```
  - `getMimeCategory` : route les mime-types vers le bon renderer :
    - `application/pdf` → `"pdf"`
    - `image/*` → `"image"`
    - `video/*` → `"video"`
    - `audio/*` → `"audio"`
    - `text/markdown` → `"markdown"`
    - `text/csv` → `"csv"`
    - `application/json` → `"json"`
    - `text/*`, `application/javascript`, `application/typescript`, `application/xml` → `"text"` (monospace brut, PAS de syntax highlighting)
    - Tout le reste → `"unknown"`

  **3b — Context + Provider + Hook**
  - Suivre le pattern exact de `DialogContext.tsx`
  - State : `documents: DocumentViewerItem[]`, `currentIndex: number`, `isOpen: boolean`
  - `openDocument(doc)` : set `documents=[doc]`, `currentIndex=0`, `isOpen=true`
  - `openDocuments(docs, startIndex=0)` : set `documents=docs`, `currentIndex=startIndex`, `isOpen=true`
  - `closeDocument()` : set `isOpen=false`, reset state
  - `next()` / `prev()` : incrémente/décrémente `currentIndex` (borné)
  - Export `DocumentViewerProvider` et `useDocumentViewer()`

  **3c — Hook utilitaire `useFetchContent`**
  - Hook interne partagé par les renderers qui font `fetch(url)` (Text, Markdown, CSV, JSON)
  - Gère : loading state, erreur réseau (message clair), 403 tag-scope ("Accès refusé"), 404 ("Document introuvable"), timeout via AbortController (30s)
  - Retourne `{ content: string | null, loading: boolean, error: string | null }`
  - Pattern :
  ```typescript
  function useFetchContent(url: string) {
    const [state, setState] = useState<{ content: string | null; loading: boolean; error: string | null }>({ content: null, loading: true, error: null });
    useEffect(() => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      fetch(url, { signal: controller.signal })
        .then(res => {
          if (res.status === 403) throw new Error("Accès refusé — vérifiez vos permissions");
          if (res.status === 404) throw new Error("Document introuvable");
          if (!res.ok) throw new Error(`Erreur ${res.status}`);
          return res.text();
        })
        .then(content => setState({ content, loading: false, error: null }))
        .catch(err => setState({ content: null, loading: false, error: err.message }))
        .finally(() => clearTimeout(timeout));
      return () => { controller.abort(); clearTimeout(timeout); };
    }, [url]);
    return state;
  }
  ```

  **3d — Renderers (composants internes)**
  - `PdfRenderer` : Wrappé dans `React.lazy()`. Utilise `react-pdf` `Document` + `Page` components. State interne : `numPages`, `pageNumber`, `scale`, `rotation`. Toolbar : zoom +/- (0.5x-3x par pas de 0.25), page indicator (`Page N / Total`), rotation (90° clockwise). Worker configuré localement : `import { pdfjs } from 'react-pdf'; pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();`. Gestion d'erreur : `onLoadError` → affiche message + bouton download.
  - `ImageRenderer` : `<img>` natif avec CSS `transform: scale() translate()`. State : `scale`, `position`. Handlers : `onWheel` (zoom), `onMouseDown`/`onMouseMove`/`onMouseUp` (drag pan). Curseur `grab`/`grabbing`. Double-clic = reset zoom. `alt={title}` pour a11y. `onError` → affiche message + bouton download.
  - `VideoRenderer` : `<video controls>` natif avec `src={url}` et `type={mimeType}`.
  - `AudioRenderer` : `<audio controls>` natif.
  - `TextRenderer` : Utilise `useFetchContent(url)`. Affiche dans `<pre><code>` monospace brut. Loading spinner pendant le fetch. Error → message + bouton download.
  - `MarkdownRenderer` : Utilise `useFetchContent(url)`. Réutilise `MarkdownBody` existant. Loading/error handling idem.
  - `CsvRenderer` : Utilise `useFetchContent(url)`. Parse via `split('\n')` + `split(',')` avec gestion basique du quoting. **Limité aux 100 premières lignes.** Au-delà, message "Aperçu limité aux 100 premières lignes" + bouton download. Affiche dans `<table>` avec header row stylée.
  - `JsonRenderer` : Utilise `useFetchContent(url)`. `JSON.stringify(JSON.parse(content), null, 2)` dans un `<pre>`. Si le parse JSON échoue, affiche le contenu brut.
  - `FallbackRenderer` : Message "Aperçu non disponible pour ce format" + badge mime-type + bouton Download.
  - **Tous les renderers avec fetch** affichent un error state commun : icône erreur, message, bouton "Télécharger le fichier" comme fallback.

  **3e — DocumentViewerDialog (composant principal)**
  - Utilise `Dialog` + `DialogContent` de `dialog.tsx` avec className override : `max-w-[95vw] max-h-[95vh] p-0 gap-0 overflow-hidden`
  - `showCloseButton={false}` — on gère via notre header
  - **Header** : Titre du document (truncated), badge mime-type, bouton Download (`<a href={url} download>`, `aria-label="Télécharger"`), bouton Close (X, `aria-label="Fermer"`)
  - **Body** : Switch sur `getMimeCategory(currentDoc.mimeType)` → renderer correspondant. Wrappé dans `<Suspense fallback={<spinner>}>` pour le lazy loading PDF.
  - **Navigation** : Flèches `←` / `→` positionnées aux bords gauche/droit du body, semi-transparentes, `hover:opacity-100`. Visibles seulement si `documents.length > 1`. Désactivées aux bornes (premier/dernier). `aria-label="Document précédent"` / `"Document suivant"`.
  - **Keyboard** : `useEffect` avec event listener sur `keydown` quand `isOpen=true`. **Protections** : (a) `if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement).isContentEditable) return;` (b) `event.stopPropagation()` après chaque action pour éviter propagation aux composants Radix.
    - `Escape` → `closeDocument()`
    - `ArrowLeft` → `prev()`
    - `ArrowRight` → `next()`
    - `+` / `=` → zoom in (si PDF ou image)
    - `-` → zoom out (si PDF ou image)
  - **State reset** : Quand `currentIndex` change, reset le zoom, la page, la rotation.
  - Notes : Le Dialog est rendu DANS le Provider, contrôlé par `isOpen`. Le Provider expose les méthodes, le Dialog consomme le state.

- [ ] **Task 4 : Intégrer le Provider dans main.tsx**
  - File : `ui/src/main.tsx`
  - Action : Importer `DocumentViewerProvider` depuis `@/components/ui/document-viewer`. Wrapper juste après `<DialogProvider>` :
  ```tsx
  <DialogProvider>
    <DocumentViewerProvider>
      <App />
    </DocumentViewerProvider>
  </DialogProvider>
  ```

- [ ] **Task 5 : Enrichir les metadata d'upload document**
  - File : `ui/src/components/AgentChatPanel.tsx`
  - Action dans `handleFileSelect` (chercher `const handleFileSelect`) :
    - Capturer le résultat de `documentsApi.upload()` dans une variable `doc`
    - Remplacer le `sendMessage` actuel par :
    ```typescript
    const doc = await documentsApi.upload(selectedCompanyId, file, { channelId: channel.id });
    sendMessage(`[Uploaded: ${file.name}]`, {
      messageType: "document_upload",
      metadata: {
        type: "document_upload",
        documentId: doc.id,
        title: doc.title,
        mimeType: doc.mimeType,
        ingestionStatus: doc.ingestionStatus,
      },
    });
    ```
  - Notes : `DocumentDropZone.tsx` ne nécessite pas de changement — `onUploadComplete` est géré par le parent.

- [ ] **Task 6 : Intégrer dans MessageBubble**
  - File : `ui/src/components/chat/MessageBubble.tsx`
  - Action :
    - Ajouter prop `onDocumentClick?: (documentId: string, title: string, mimeType: string) => void` à `MessageBubbleProps`
    - Dans le bloc `document_upload` (chercher `meta?.type === "document_upload"`), si `meta.documentId` existe, transformer le `<div>` wrapper en `<button>` cliquable (même pattern que le bloc `artifact_reference` juste au-dessus)
    - Au clic : appeler `onDocumentClick(meta.documentId as string, meta.title as string, meta.mimeType as string)`
    - Si `meta.documentId` n'est pas disponible (anciens messages avant cette feature), garder le `<div>` non-cliquable
    - Ajouter `cursor-pointer hover:bg-muted/50 transition-colors` au style du bouton

- [ ] **Task 7 : Intégrer dans ContextLinkBar**
  - File : `ui/src/components/chat/ContextLinkBar.tsx`
  - Action :
    - Ajouter prop `onDocumentClick?: (documentId: string) => void` à `ContextLinkBarProps`
    - Dans `handleChipClick` (chercher `const handleChipClick`), ajouter la branche document avant le return :
    ```typescript
    if (link.linkType === "document" && link.documentId && onDocumentClick) {
      onDocumentClick(link.documentId);
    }
    ```

- [ ] **Task 8 : Intégrer dans FolderItemList + FolderSidebar**
  - File : `ui/src/components/folders/FolderItemList.tsx`
  - Action :
    - Ajouter prop `onItemClick?: (item: FolderItem) => void` à `FolderItemListProps`
    - Dans le `.map()` de chaque item (chercher `items.map`), ajouter `onClick={() => item.itemType === "document" && onItemClick?.(item)}` sur le `<div>` row
    - Ajouter `cursor-pointer` conditionnellement quand `item.itemType === "document"`
  - File : `ui/src/components/folders/FolderSidebar.tsx`
  - Action :
    - Ajouter prop `onDocumentClick?: (item: FolderItem) => void` à `FolderSidebarProps`
    - Passer `onItemClick={onDocumentClick}` au `<FolderItemList>` (chercher `<FolderItemList`)

- [ ] **Task 9 : Wiring dans AgentChatPanel (MessageBubble + ContextLinkBar)**
  - File : `ui/src/components/AgentChatPanel.tsx`
  - Action :
    - Importer `useDocumentViewer` depuis `@/components/ui/document-viewer`
    - Importer `documentsApi` (déjà importé pour l'upload)
    - Créer un handler `handleDocumentClick` :
    ```typescript
    const { openDocument } = useDocumentViewer();
    const handleDocumentClick = useCallback((documentId: string, title: string, mimeType: string) => {
      openDocument({
        id: documentId,
        title,
        mimeType,
        url: documentsApi.getContentUrl(selectedCompanyId!, documentId),
      });
    }, [selectedCompanyId, openDocument]);

    // Pour ContextLinkBar (pas de mimeType disponible, résolution via API)
    const handleContextDocumentClick = useCallback(async (documentId: string) => {
      const doc = await documentsApi.getById(selectedCompanyId!, documentId);
      openDocument({
        id: doc.id,
        title: doc.title,
        mimeType: doc.mimeType,
        url: documentsApi.getContentUrl(selectedCompanyId!, doc.id),
      });
    }, [selectedCompanyId, openDocument]);
    ```
    - Passer `onDocumentClick={handleDocumentClick}` aux `<MessageBubble>` (chercher `<MessageBubble`)
    - Passer `onDocumentClick={handleContextDocumentClick}` au `<ContextLinkBar>` (chercher `<ContextLinkBar`)

- [ ] **Task 10 : Wiring dans FolderDetail + FolderSidebar parents**
  - File : `ui/src/pages/FolderDetail.tsx`
  - Action :
    - Importer `useDocumentViewer` et `documentsApi`
    - Créer un handler qui construit la liste complète des `DocumentViewerItem[]` depuis les items du dossier :
    ```typescript
    const { openDocuments } = useDocumentViewer();
    const handleFolderDocumentClick = useCallback(async (clickedItem: FolderItem) => {
      if (!clickedItem.documentId || !companyId) return;
      // Résoudre les metadata du document cliqué
      const doc = await documentsApi.getById(companyId, clickedItem.documentId);
      // Construire la liste de tous les documents du dossier pour navigation prev/next
      const docItems = folder.items.filter(i => i.itemType === "document" && i.documentId);
      const viewerDocs: DocumentViewerItem[] = [];
      let startIndex = 0;
      for (let i = 0; i < docItems.length; i++) {
        const item = docItems[i];
        if (item.documentId === clickedItem.documentId) {
          startIndex = i;
          viewerDocs.push({ id: doc.id, title: doc.title, mimeType: doc.mimeType, url: documentsApi.getContentUrl(companyId, doc.id) });
        } else {
          // Les autres documents — on met un mimeType placeholder, il sera résolu quand l'utilisateur naviguera
          viewerDocs.push({ id: item.documentId!, title: item.displayName ?? item.documentId!, mimeType: "application/octet-stream", url: documentsApi.getContentUrl(companyId, item.documentId!) });
        }
      }
      openDocuments(viewerDocs, startIndex);
    }, [companyId, folder, openDocuments]);
    ```
    - Passer `onDocumentClick={handleFolderDocumentClick}` au `<FolderItemList>` et au `<FolderSidebar>`
  - Notes : Les documents "voisins" dans la navigation auront un mimeType placeholder (`application/octet-stream`) qui route vers le FallbackRenderer. C'est acceptable — quand l'utilisateur navigue vers un voisin, le FallbackRenderer affiche le bouton download. Pour une meilleure UX future, on pourrait pré-fetcher les metadata de tous les documents du dossier.

### Acceptance Criteria

**Rendus par format :**
- [ ] **AC 1** : Given un document PDF dans un dossier, when l'utilisateur clique dessus, then le viewer s'ouvre en fullscreen avec le PDF affiché et la toolbar (zoom, page, rotation) visible.
- [ ] **AC 2** : Given une image (PNG/JPG/SVG) dans le chat, when l'utilisateur clique sur le document_upload, then le viewer s'ouvre avec l'image affichée. L'utilisateur peut zoomer avec scroll et pan avec drag.
- [ ] **AC 3** : Given un fichier vidéo uploadé, when l'utilisateur clique dessus, then le viewer affiche un `<video>` avec les contrôles natifs (play/pause/seek).
- [ ] **AC 4** : Given un fichier texte/JSON/CSV, when l'utilisateur clique dessus, then le viewer affiche le contenu formaté (JSON pretty-printed, CSV en table limitée à 100 lignes, texte brut en `<pre>`).
- [ ] **AC 5** : Given un format non supporté (ex: .exe, .zip), when l'utilisateur clique dessus, then le viewer affiche un message "Aperçu non disponible" avec un bouton Download.

**Contrôles :**
- [ ] **AC 6** : Given le viewer ouvert, when l'utilisateur clique sur le bouton Télécharger dans le header, then le fichier se télécharge avec son nom original.
- [ ] **AC 7** : Given un dossier avec 5 documents, when l'utilisateur clique sur le 3ème, then le viewer s'ouvre sur le 3ème document. Les flèches prev/next permettent de naviguer. Prev est désactivé sur le 1er, Next sur le 5ème.
- [ ] **AC 8** : Given le viewer ouvert sur un PDF (page 3, zoom 150%), when l'utilisateur navigue au document suivant (une image), then le state est reset : zoom revient à 100%, page revient à 1.
- [ ] **AC 9** : Given le viewer ouvert, when l'utilisateur appuie sur `Escape`, then le viewer se ferme. `←`/`→` naviguent. `+`/`-` zooment. Les raccourcis ne se déclenchent PAS si le focus est dans un input/textarea.

**Intégrations :**
- [ ] **AC 10** : Given un document_upload dans le chat SANS `documentId` dans la metadata (ancien message), when l'utilisateur voit le message, then la card n'est PAS cliquable (pas de cursor pointer, pas de handler).
- [ ] **AC 11** : Given un lien document dans ContextLinkBar, when l'utilisateur clique sur le chip, then le viewer s'ouvre avec le document (après résolution metadata via API).
- [ ] **AC 12** : Given un nouveau document uploadé via le chat, when le message apparaît, then il a `messageType: "document_upload"` et `metadata.documentId` + `metadata.mimeType`. Au reload de la page, le message s'affiche toujours comme une card document cliquable.

**Error handling :**
- [ ] **AC 13** : Given le viewer ouvert sur un fichier texte/JSON/CSV, when le `fetch()` du contenu retourne 403 (tag-scope), then le viewer affiche "Accès refusé — vérifiez vos permissions" + bouton download.
- [ ] **AC 14** : Given le viewer ouvert sur un fichier texte, when le `fetch()` du contenu échoue (réseau, 404, timeout), then le viewer affiche un message d'erreur approprié + bouton download comme fallback.
- [ ] **AC 15** : Given un CSV de 500 lignes, when l'utilisateur l'ouvre dans le viewer, then seules les 100 premières lignes sont affichées avec un message "Aperçu limité aux 100 premières lignes".

## Additional Context

### Dependencies

- `react-pdf` (npm) — PDF rendering via PDF.js. Version recommandée : latest stable (9.x).
- `pdfjs-dist` — PDF.js worker, peer dependency auto-résolue par react-pdf. Worker chargé **localement** via `import.meta.url` (pas de CDN).
- Aucune autre dépendance externe nécessaire — images/video/audio sont natifs browser, CSV/JSON/texte parsés en JS vanilla. Pas de lib de syntax highlighting (v1 = monospace brut).

### Testing Strategy

- **Unit tests** (`document-viewer.test.tsx`) :
  - `getMimeCategory()` : chaque mime-type route vers le bon renderer (15+ cas)
  - `useDocumentViewer` hook : `openDocument` → `isOpen=true`, `closeDocument` → `isOpen=false`, `next`/`prev` bornés, state reset au changement de document
  - Navigation boundary : `prev()` quand `currentIndex=0` → no-op, `next()` quand `currentIndex=last` → no-op
  - `useFetchContent` : mock fetch → loading/success/error/403/404/timeout states
- **Unit tests** (`useAgentChat.test.ts`) :
  - `sendMessage` avec metadata : vérifie que le payload WS inclut metadata
  - `sendMessage` sans metadata : vérifie backward compat (metadata: null, messageType: "text")
- **Component tests** :
  - Chaque renderer monte sans crash avec des données mockées
  - DocumentViewerDialog affiche le bon renderer selon le mime-type
  - Flèches navigation visibles seulement si `documents.length > 1`
  - Bouton Download présent avec le bon `href` et `aria-label`
  - Error state : renderer texte avec fetch 403 → affiche "Accès refusé"
  - CSV avec >100 lignes → affiche message de limitation
- **Integration tests** :
  - MessageBubble avec `meta.documentId` → cliquable, appelle `onDocumentClick`
  - MessageBubble sans `meta.documentId` → non cliquable
  - ContextLinkBar chip document → appelle `onDocumentClick`
  - FolderItemList item document → appelle `onItemClick`
- **E2E** (Playwright) :
  - Upload PDF via chat → clic sur la card → viewer fullscreen visible → toolbar PDF visible → download fonctionne
  - Navigation dans un dossier avec 3 documents → prev/next fonctionne → state reset entre docs
  - Vérifier que le message document_upload persiste après reload (messageType correct en DB)
- **Keyboard** :
  - Escape ferme le viewer
  - ← et → naviguent
  - + et - zooment (PDF/image)
  - Raccourcis ignorés si focus dans un input/textarea

### Notes

- **Risque : react-pdf worker setup** — Le worker est chargé localement via `import.meta.url` pour compatibilité enterprise (proxy/firewall/CSP). Si le bundler ne supporte pas `new URL(..., import.meta.url)`, fallback vers `pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'` avec copie manuelle dans `public/`.
- **Risque : gros fichiers** — Les PDF >50 pages utilisent le scroll natif de react-pdf. Les images très haute résolution sont gérées par le browser. Les CSV sont limités à 100 lignes preview.
- **Backward compatibility** — Les anciens messages `document_upload` sans `documentId` dans la metadata ne seront pas cliquables. C'est acceptable — seuls les nouveaux uploads bénéficient du viewer.
- **Sécurité tag-scope** — Les renderers fetch-based gèrent le 403 avec un message clair. Si un utilisateur navigue (prev/next) vers un document dont il n'a pas l'accès, le FallbackRenderer s'affiche avec bouton download (qui retournera aussi 403 — comportement cohérent).
- **Future : Content-Disposition** — Si besoin d'ouvrir des documents dans un `<iframe>` à l'avenir, il faudra changer `Content-Disposition: attachment` → `inline` sur le backend.
- **Future : Syntax highlighting** — Ajouter Shiki ou highlight.js pour la coloration syntaxique des fichiers code. Out of scope v1.
- **Future : Thumbnail previews** — Thumbnails dans les listes de documents (première page PDF, miniature image). Out of scope.
- **Future : Mobile/touch** — Pinch-to-zoom, swipe navigation, responsive layout. Out of scope v1 (cockpit desktop-first).
- **Future : Pré-fetch metadata dossier** — Pour la navigation prev/next dans un dossier, pré-fetcher les metadata de tous les documents pour afficher le bon renderer sans fallback.
