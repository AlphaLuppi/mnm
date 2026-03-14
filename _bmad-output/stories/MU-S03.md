# MU-S03 : Invitation Bulk (CSV) -- Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | MU-S03 |
| **Titre** | Invitation Bulk (CSV) |
| **Epic** | Epic 3 -- Multi-User & Auth |
| **Sprint** | Batch 4 -- RBAC + Multi-User |
| **Effort** | S (2 SP, 1-2j) |
| **Assignation** | Tom |
| **Bloque par** | MU-S01 (API Invitations par Email) |
| **Debloque** | -- |
| **Type** | Frontend-only (CSV parsing client-side, boucle sur endpoint existant) |

---

## Description

### Contexte

MnM permet deja d'inviter des membres un par un via email (`POST /api/companies/:companyId/invites` avec `{ email, allowedJoinTypes }`). La page Membres (MU-S02) inclut un dialog d'invitation avec un champ email. Pour les entreprises avec de nombreux collaborateurs, inviter un par un est fastidieux. Cette story ajoute un onglet "Bulk Import" dans le dialog d'invitation existant, permettant d'uploader un fichier CSV contenant plusieurs emails (et optionnellement des roles) pour les inviter en une seule operation.

### Ce qui existe deja

1. **Endpoint `POST /api/companies/:companyId/invites`** (`server/src/routes/access.ts` L1637-1744) :
   - Accepte `{ email, allowedJoinTypes, defaultsPayload, agentMessage }` (schema `createCompanyInviteSchema`)
   - Le champ `email` est optionnel, type `z.string().email().max(320)`, normalise en lowercase/trim
   - Verification de doublon : rejette avec `409 Conflict` si une invitation pending existe deja pour cet email
   - Envoie un email d'invitation via `emailService.sendInviteEmail()`
   - Retourne `201` avec `{ id, token, inviteUrl, expiresAt, allowedJoinTypes }`

2. **API client frontend** (`ui/src/api/access.ts` L159-163) :
   - `createEmailInvite(companyId, email)` : appelle `POST /companies/${companyId}/invites` avec `{ email, allowedJoinTypes: "human" }`
   - Retourne `CompanyInviteCreated` : `{ id, token, inviteUrl, expiresAt, allowedJoinTypes }`

3. **Dialog d'invitation actuel** (`ui/src/pages/Members.tsx` L297-348) :
   - Dialog shadcn/ui avec un champ email unique
   - Mutation `inviteMutation` qui appelle `accessApi.createEmailInvite(selectedCompanyId!, email)`
   - `data-testid="mu-s02-invite-dialog"`, `data-testid="mu-s02-invite-email"`, `data-testid="mu-s02-invite-submit"`

4. **Composant Tabs** (`ui/src/components/ui/tabs.tsx`) :
   - shadcn/ui Tabs disponible : `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`

5. **Types et constantes** (`packages/shared/src/constants.ts`) :
   - `BUSINESS_ROLES` : `["admin", "manager", "contributor", "viewer"]`
   - `BUSINESS_ROLE_LABELS` : `{ admin: "Admin", manager: "Manager", contributor: "Contributor", viewer: "Viewer" }`

### Ce qui manque

1. **Frontend** : Onglet "Bulk Import" dans le dialog d'invitation avec :
   - Zone d'upload de fichier CSV
   - Parsing CSV cote client (FileReader API)
   - Validation par ligne (format email, role valide)
   - Tableau de preview avec les lignes parsees et les erreurs de validation
   - Bouton "Send All Invitations" qui boucle sur l'endpoint existant
   - Barre de progression pendant l'envoi
   - Tableau de resultats avec statut succes/echec par ligne

2. **Pas de modification backend** : On reutilise l'endpoint existant tel quel. Le parsing et la boucle se font cote client.

---

## Etat Actuel du Code (Analyse)

### Fichiers a modifier

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `ui/src/pages/Members.tsx` | Page membres avec dialog invite simple | MODIFIE : transformer le dialog en dialog avec Tabs (Single / Bulk Import) |

### Fichiers a creer

| Fichier | Role |
|---------|------|
| `ui/src/components/BulkInviteTab.tsx` | Composant pour l'onglet Bulk Import : upload CSV, preview, envoi, resultats |

### Fichiers de reference (non modifies)

| Fichier | Role |
|---------|------|
| `ui/src/api/access.ts` | API client : `createEmailInvite()` reutilise tel quel |
| `server/src/routes/access.ts` | Endpoint POST invites reutilise tel quel |
| `packages/shared/src/constants.ts` | `BUSINESS_ROLES`, `BUSINESS_ROLE_LABELS` |
| `ui/src/components/ui/tabs.tsx` | Tabs shadcn/ui |
| `ui/src/components/ui/dialog.tsx` | Dialog shadcn/ui |
| `ui/src/components/ui/button.tsx` | Button shadcn/ui |
| `ui/src/components/ui/badge.tsx` | Badge shadcn/ui |
| `ui/src/components/ui/input.tsx` | Input shadcn/ui (pour file input) |

### Conventions du codebase (a respecter)

1. **Pages pattern** : `useCompany()` pour le companyId, `useQuery()` pour les donnees
2. **API client** : `api.post<T>(path, body)` via `accessApi`
3. **Mutations** : `useMutation()` avec `onSuccess` qui invalide les queries
4. **shadcn/ui imports** : `import { Component } from "@/components/ui/component"`
5. **Lucide icons** : Import depuis `lucide-react`
6. **Tailwind** : Utility-first, classes directes dans JSX
7. **data-testid** : Prefixe `mu-s03-` pour tous les elements de cette story

---

## Specification Technique Detaillee

### T1 : Transformer le dialog d'invitation en dialog avec Tabs -- `ui/src/pages/Members.tsx`

Le dialog actuel (L297-348) contient un formulaire email simple. Il faut le transformer pour inclure deux onglets : "Single Invite" (le formulaire actuel) et "Bulk Import" (le nouveau composant CSV).

**Modifications :**

```tsx
// AVANT : Dialog simple
<Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
  <DialogContent data-testid="mu-s02-invite-dialog">
    <DialogHeader>
      <DialogTitle>Invite Member</DialogTitle>
      <DialogDescription>
        Send an invitation email to add a new member to this company.
      </DialogDescription>
    </DialogHeader>
    {/* ... champ email ... */}
  </DialogContent>
</Dialog>

// APRES : Dialog avec Tabs
<Dialog open={inviteOpen} onOpenChange={(open) => {
  setInviteOpen(open);
  if (!open) setInviteEmail("");
}}>
  <DialogContent data-testid="mu-s02-invite-dialog" className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Invite Members</DialogTitle>
      <DialogDescription>
        Invite new members by email or upload a CSV file for bulk import.
      </DialogDescription>
    </DialogHeader>
    <Tabs defaultValue="single" data-testid="mu-s03-invite-tabs">
      <TabsList className="w-full" data-testid="mu-s03-tabs-list">
        <TabsTrigger value="single" data-testid="mu-s03-tab-single" className="flex-1">
          Single Invite
        </TabsTrigger>
        <TabsTrigger value="bulk" data-testid="mu-s03-tab-bulk" className="flex-1">
          Bulk Import
        </TabsTrigger>
      </TabsList>
      <TabsContent value="single" data-testid="mu-s03-tab-single-content">
        {/* Formulaire email existant (deplace ici) */}
      </TabsContent>
      <TabsContent value="bulk" data-testid="mu-s03-tab-bulk-content">
        <BulkInviteTab
          companyId={selectedCompanyId!}
          onComplete={() => {
            setInviteOpen(false);
            queryClient.invalidateQueries({
              queryKey: queryKeys.access.members(selectedCompanyId!),
            });
          }}
        />
      </TabsContent>
    </Tabs>
  </DialogContent>
</Dialog>
```

**Imports a ajouter :**

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkInviteTab } from "../components/BulkInviteTab";
```

**Note** : Le formulaire single invite actuel (champ email + boutons Cancel/Submit) est deplace dans `<TabsContent value="single">`. Le `DialogFooter` est integre dans chaque tab content pour que chaque onglet ait ses propres boutons.

---

### T2 : Composant BulkInviteTab -- `ui/src/components/BulkInviteTab.tsx`

Ce composant gere l'ensemble du workflow bulk import : upload, parsing, validation, preview, envoi sequentiel, et affichage des resultats.

#### Architecture du composant

Le composant suit un pattern de machine a etats avec 4 phases :

```
idle -> preview -> sending -> results
```

**Props :**

```typescript
interface BulkInviteTabProps {
  companyId: string;
  onComplete: () => void;
}
```

**State :**

```typescript
type CsvRow = {
  line: number;          // Numero de ligne dans le CSV (1-indexed)
  email: string;         // Email parse (trimmed, lowercased)
  role: BusinessRole;    // Role parse ou default "contributor"
  validationError: string | null;  // Erreur de validation (email format, role invalide)
};

type InviteResult = CsvRow & {
  status: "success" | "error" | "skipped";
  errorMessage?: string;  // Message d'erreur API (ex: "409 Conflict")
};

type BulkPhase = "idle" | "preview" | "sending" | "results";

// State
const [phase, setPhase] = useState<BulkPhase>("idle");
const [rows, setRows] = useState<CsvRow[]>([]);
const [results, setResults] = useState<InviteResult[]>([]);
const [progress, setProgress] = useState({ current: 0, total: 0 });
const [fileName, setFileName] = useState<string | null>(null);
const abortRef = useRef(false);
```

#### Phase 1 : idle -- Upload de fichier CSV

**UI :**

```
+----------------------------------------------+
|  [Upload CSV icon]                           |
|                                              |
|  Drag & drop a CSV file or click to browse   |
|                                              |
|  Expected format:                            |
|  email,role                                  |
|  john@example.com,contributor                |
|  jane@example.com,admin                      |
|                                              |
|  [Browse Files]                              |
+----------------------------------------------+
```

**Specifications :**
- Zone de drop (drag & drop) + bouton "Browse Files"
- Accepte uniquement `.csv` et `.txt` (MIME types : `text/csv`, `text/plain`, `application/vnd.ms-excel`)
- Taille maximale : 1 MB
- Affiche le format attendu comme hint

**Parsing CSV :**
- Utilise `FileReader.readAsText()` pour lire le fichier
- Split par lignes (`\n` ou `\r\n`)
- Premiere ligne : detection du header
  - Si la premiere ligne contient `email` (case-insensitive) -> header detecte, la ligne est ignoree
  - Sinon -> pas de header, la premiere ligne est traitee comme donnees
- Chaque ligne est splittee par `,` ou `;` (support des deux separateurs)
- Colonne 1 : `email` (obligatoire)
- Colonne 2 : `role` (optionnel, defaut `"contributor"`)
- Les lignes vides sont ignorees
- Trim sur chaque valeur, lowercase sur email
- Maximum 100 lignes de donnees (au-dela, afficher une erreur)

**Validation par ligne :**
- **Email** : regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (validation basique) + longueur max 320 chars
- **Role** : doit etre dans `BUSINESS_ROLES` (`admin`, `manager`, `contributor`, `viewer`). Si valeur vide -> defaut `"contributor"`. Si valeur invalide -> erreur de validation.
- **Doublons dans le CSV** : si un email apparait plusieurs fois dans le CSV, marquer les doublons (garder la premiere occurrence, marquer les suivantes avec erreur "Duplicate email in CSV")

**Transition :** Apres parsing -> phase `preview`

---

#### Phase 2 : preview -- Tableau de preview

**UI :**

```
+----------------------------------------------+
|  file.csv -- 12 rows parsed                  |
|  [Change File]                               |
|                                              |
|  +----+--------------------+-------------+---+
|  | #  | Email              | Role        | ! |
|  +----+--------------------+-------------+---+
|  | 1  | john@example.com   | Contributor |   |
|  | 2  | jane@example.com   | Admin       |   |
|  | 3  | invalid-email      | Contributor | X |
|  | 4  | bob@example.com    | superadmin  | X |
|  | 5  | john@example.com   | Manager     | X |
|  +----+--------------------+-------------+---+
|                                              |
|  3 errors found. Fix errors or they will be  |
|  skipped during import.                      |
|                                              |
|  [Cancel]              [Send 2 Invitations]  |
+----------------------------------------------+
```

**Specifications :**
- Affiche le nom du fichier et le nombre de lignes parsees
- Bouton "Change File" pour re-uploader un autre fichier (retour a phase `idle`)
- Tableau avec colonnes : `#` (numero de ligne), `Email`, `Role`, `Status` (icone erreur si validation echouee)
- Les lignes en erreur sont affichees en rouge avec le message d'erreur en tooltip
- Compteur d'erreurs en bas du tableau
- Le bouton "Send N Invitations" indique le nombre de lignes valides
- Le bouton est desactive s'il n'y a aucune ligne valide
- Bouton "Cancel" pour fermer (appelle `onComplete`)
- Les lignes avec erreur de validation seront skippees automatiquement pendant l'envoi

---

#### Phase 3 : sending -- Envoi sequentiel avec progression

**UI :**

```
+----------------------------------------------+
|  Sending invitations...                      |
|                                              |
|  [====================          ] 7/12       |
|                                              |
|  Currently sending: alice@example.com        |
|                                              |
|  [Cancel Import]                             |
+----------------------------------------------+
```

**Specifications :**
- Barre de progression (`current / total`) avec pourcentage
- Affiche l'email en cours d'envoi
- Boucle sequentielle sur les lignes valides (pas de parallelisme pour eviter le rate limiting)
- Pour chaque ligne valide :
  1. Appelle `accessApi.createEmailInvite(companyId, email)`
  2. Met a jour `progress.current`
  3. Enregistre le resultat (success/error) dans `results`
- Si l'API retourne une erreur (ex: 409 Conflict "already exists"), la ligne est marquee en erreur mais le processus continue
- Bouton "Cancel Import" : arrete l'envoi en cours (les invitations deja envoyees ne sont pas annulees). Utilise `abortRef.current = true` pour interrompre la boucle.
- Apres le dernier envoi (ou annulation) -> phase `results`

**Note sur la gestion d'erreur :**
- `409 Conflict` -> "Invitation already exists for this email"
- `403 Forbidden` -> "Permission denied"
- `400 Bad Request` -> Message d'erreur du serveur
- Autre erreur -> "Unexpected error"

---

#### Phase 4 : results -- Tableau de resultats

**UI :**

```
+----------------------------------------------+
|  Import Complete                             |
|                                              |
|  9 sent / 1 failed / 2 skipped              |
|                                              |
|  +----+--------------------+--------+--------+
|  | #  | Email              | Role   | Status |
|  +----+--------------------+--------+--------+
|  | 1  | john@example.com   | Contr. | [ok]   |
|  | 2  | jane@example.com   | Admin  | [ok]   |
|  | 3  | invalid-email      | Contr. | [skip] |
|  | 4  | bob@example.com    | Contr. | [fail] |
|  +----+--------------------+--------+--------+
|                                              |
|  [Done]                                      |
+----------------------------------------------+
```

**Specifications :**
- Resume en haut : `N sent / N failed / N skipped`
  - `sent` = succes API
  - `failed` = erreur API
  - `skipped` = erreur de validation (email format, role invalide, doublon CSV)
- Tableau avec colonnes : `#`, `Email`, `Role`, `Status`
  - Status affiche avec Badge :
    - `success` -> Badge variant `secondary` avec texte "Sent"
    - `error` -> Badge variant `destructive` avec texte "Failed" + tooltip avec message d'erreur
    - `skipped` -> Badge variant `outline` avec texte "Skipped" + tooltip avec raison
- Bouton "Done" ferme le dialog et invalide les queries membres (`onComplete`)
- Si l'import a ete annule, afficher "Import Cancelled" au lieu de "Import Complete"

---

## Registre des data-test-id

| data-testid | Element | Phase |
|-------------|---------|-------|
| `mu-s03-invite-tabs` | Tabs container dans le dialog | all |
| `mu-s03-tabs-list` | TabsList | all |
| `mu-s03-tab-single` | TabsTrigger "Single Invite" | all |
| `mu-s03-tab-bulk` | TabsTrigger "Bulk Import" | all |
| `mu-s03-tab-single-content` | TabsContent single invite | single |
| `mu-s03-tab-bulk-content` | TabsContent bulk import | bulk |
| `mu-s03-dropzone` | Zone de drag & drop / file input | idle |
| `mu-s03-file-input` | Input file (hidden) | idle |
| `mu-s03-browse-button` | Bouton "Browse Files" | idle |
| `mu-s03-format-hint` | Texte du format attendu | idle |
| `mu-s03-file-error` | Message d'erreur fichier (taille, format) | idle |
| `mu-s03-file-name` | Nom du fichier uploade | preview |
| `mu-s03-row-count` | Nombre de lignes parsees | preview |
| `mu-s03-change-file` | Bouton "Change File" | preview |
| `mu-s03-preview-table` | Tableau de preview | preview |
| `mu-s03-preview-row-{line}` | Ligne du tableau de preview (line = numero de ligne CSV) | preview |
| `mu-s03-preview-email-{line}` | Email dans la ligne de preview | preview |
| `mu-s03-preview-role-{line}` | Role dans la ligne de preview | preview |
| `mu-s03-preview-error-{line}` | Icone/message d'erreur dans la ligne de preview | preview |
| `mu-s03-error-count` | Compteur d'erreurs | preview |
| `mu-s03-cancel-button` | Bouton "Cancel" | preview |
| `mu-s03-send-button` | Bouton "Send N Invitations" | preview |
| `mu-s03-progress-bar` | Barre de progression | sending |
| `mu-s03-progress-text` | Texte de progression (X/Y) | sending |
| `mu-s03-current-email` | Email en cours d'envoi | sending |
| `mu-s03-cancel-import` | Bouton "Cancel Import" | sending |
| `mu-s03-results-title` | Titre "Import Complete" ou "Import Cancelled" | results |
| `mu-s03-results-summary` | Resume (N sent / N failed / N skipped) | results |
| `mu-s03-results-table` | Tableau de resultats | results |
| `mu-s03-result-row-{line}` | Ligne du tableau de resultats | results |
| `mu-s03-result-email-{line}` | Email dans la ligne de resultats | results |
| `mu-s03-result-role-{line}` | Role dans la ligne de resultats | results |
| `mu-s03-result-status-{line}` | Badge de statut dans la ligne de resultats | results |
| `mu-s03-done-button` | Bouton "Done" | results |

---

## Acceptance Criteria

### AC1 : Upload de fichier CSV

**Given** l'utilisateur est sur la page Members et ouvre le dialog d'invitation
**When** il clique sur l'onglet "Bulk Import"
**Then** il voit une zone de drop avec le format CSV attendu et un bouton "Browse Files"

**Given** l'utilisateur est sur l'onglet "Bulk Import"
**When** il uploade un fichier CSV valide contenant 5 lignes avec colonnes `email,role`
**Then** le fichier est parse cote client et il voit le tableau de preview avec les 5 lignes

**Given** l'utilisateur est sur l'onglet "Bulk Import"
**When** il uploade un fichier non-CSV (ex: `.png`)
**Then** il voit un message d'erreur "Please upload a CSV file (.csv or .txt)"

**Given** l'utilisateur est sur l'onglet "Bulk Import"
**When** il uploade un fichier CSV depassant 1 MB
**Then** il voit un message d'erreur "File is too large. Maximum size is 1 MB."

**Given** l'utilisateur est sur l'onglet "Bulk Import"
**When** il uploade un fichier CSV contenant plus de 100 lignes de donnees
**Then** il voit un message d'erreur "Too many rows. Maximum is 100 rows per import."

### AC2 : Parsing CSV avec header

**Given** l'utilisateur uploade un CSV avec la premiere ligne `email,role`
**When** le fichier est parse
**Then** la premiere ligne est ignoree (traitee comme header) et les lignes suivantes sont parsees

**Given** l'utilisateur uploade un CSV avec la premiere ligne `john@example.com,contributor`
**When** le fichier est parse
**Then** la premiere ligne est traitee comme donnees (pas de header detecte)

**Given** l'utilisateur uploade un CSV avec separateur `;` au lieu de `,`
**When** le fichier est parse
**Then** les lignes sont correctement splittees par `;`

### AC3 : Validation par ligne

**Given** un CSV contient une ligne avec un email invalide `not-an-email`
**When** le tableau de preview s'affiche
**Then** la ligne est marquee en erreur avec le message "Invalid email format"

**Given** un CSV contient une ligne avec un role invalide `superadmin`
**When** le tableau de preview s'affiche
**Then** la ligne est marquee en erreur avec le message "Invalid role. Must be one of: admin, manager, contributor, viewer"

**Given** un CSV contient une ligne avec seulement un email (pas de colonne role)
**When** le tableau de preview s'affiche
**Then** la ligne est valide avec le role par defaut "contributor"

**Given** un CSV contient deux lignes avec le meme email `john@example.com`
**When** le tableau de preview s'affiche
**Then** la deuxieme occurrence est marquee en erreur avec le message "Duplicate email in CSV"

### AC4 : Preview et actions

**Given** le tableau de preview affiche 10 lignes dont 2 en erreur
**When** l'utilisateur regarde le bouton d'envoi
**Then** il voit "Send 8 Invitations" (les 2 lignes en erreur sont exclues)

**Given** le tableau de preview affiche uniquement des lignes en erreur
**When** l'utilisateur regarde le bouton d'envoi
**Then** le bouton "Send 0 Invitations" est desactive

**Given** le tableau de preview est affiche
**When** l'utilisateur clique "Change File"
**Then** le composant retourne a la phase idle pour uploader un nouveau fichier

### AC5 : Envoi sequentiel avec progression

**Given** l'utilisateur clique "Send 8 Invitations"
**When** l'envoi commence
**Then** il voit une barre de progression et l'email en cours d'envoi

**Given** l'envoi est en cours et l'API retourne 409 pour `bob@example.com`
**When** cette ligne est traitee
**Then** elle est marquee "error" avec message "Invitation already exists for this email" et l'envoi continue avec les lignes suivantes

**Given** l'envoi est en cours
**When** l'utilisateur clique "Cancel Import"
**Then** l'envoi s'arrete apres l'invitation en cours, et le tableau de resultats s'affiche avec les invitations deja envoyees et les restantes marquees comme non-traitees

### AC6 : Tableau de resultats

**Given** l'envoi est termine avec 7 succes, 1 echec, 2 skipped
**When** le tableau de resultats s'affiche
**Then** il voit le resume "7 sent / 1 failed / 2 skipped" et chaque ligne avec le bon badge de statut

**Given** le tableau de resultats est affiche
**When** l'utilisateur clique "Done"
**Then** le dialog se ferme et la liste des membres se rafraichit (invalidation query)

### AC7 : Integration dans le dialog existant

**Given** l'utilisateur ouvre le dialog d'invitation
**When** le dialog s'affiche
**Then** il voit deux onglets "Single Invite" (actif par defaut) et "Bulk Import"

**Given** l'onglet "Single Invite" est actif
**When** l'utilisateur utilise le formulaire email existant
**Then** le comportement est identique a avant (aucune regression)

---

## Cas limites et edge cases

### Fichier CSV

1. **Fichier vide** : Afficher erreur "File is empty or contains no data rows"
2. **Fichier avec seulement un header** : Afficher erreur "File contains only a header row with no data"
3. **Lignes vides** dans le CSV : Ignorees silencieusement
4. **Espaces autour des valeurs** : Trimes automatiquement (`  john@example.com  ` -> `john@example.com`)
5. **Colonnes supplementaires** : Ignorees (seules les 2 premieres colonnes sont utilisees)
6. **Guillemets CSV** : Les valeurs entre guillemets sont supportees (`"john@example.com","admin"` -> `john@example.com`, `admin`)
7. **BOM UTF-8** : Le BOM (`\uFEFF`) en debut de fichier est ignore

### Envoi

1. **Erreur reseau** pendant l'envoi : La ligne est marquee `error` avec "Network error", l'envoi continue
2. **Session expiree (401)** : L'envoi s'arrete, message d'erreur global "Session expired, please log in again"
3. **Permission refusee (403)** : La ligne est marquee `error`, l'envoi continue

### UX

1. **Fermer le dialog pendant l'envoi** : Non-bloquant, le dialog se ferme mais les invitations deja envoyees restent valides. L'utilisateur perd la vue des resultats.
2. **Changer d'onglet pendant la phase preview/results** : Les donnees sont conservees (pas de reset)
3. **Re-ouvrir le dialog apres un import** : L'etat est reset (phase idle)

---

## Plan d'implementation

### Ordre des taches

1. **T2 en premier** : Creer `BulkInviteTab.tsx` avec toutes les phases
2. **T1 en second** : Modifier `Members.tsx` pour integrer les Tabs et le composant BulkInviteTab

### Estimation

- T1 : ~30 min (modification legere du dialog existant)
- T2 : ~3-4h (composant complet avec 4 phases, parsing CSV, boucle d'envoi)
- Tests manuels : ~30 min
- **Total** : ~4-5h (1 jour)

---

## Contrat de tests (pour l'agent QA)

### Tests unitaires (optionnel)

- Parsing CSV : header detection, separateur `,` vs `;`, trim, lowercase
- Validation email : cas valides et invalides
- Validation role : roles valides, invalides, defaut contributor
- Detection doublons

### Tests E2E Playwright (`e2e/tests/MU-S03.spec.ts`)

Les tests E2E utilisent les `data-testid` pour cibler les elements.

1. **Navigation vers Bulk Import** :
   - Ouvre la page Members
   - Clique "Invite Member"
   - Verifie la presence des 2 onglets
   - Clique "Bulk Import"
   - Verifie la zone de drop

2. **Upload CSV valide** :
   - Cree un fichier CSV en memoire avec `email,role` header + 3 lignes valides
   - Upload via `setInputFiles`
   - Verifie le tableau de preview avec 3 lignes
   - Verifie le bouton "Send 3 Invitations"

3. **Validation erreurs** :
   - Upload un CSV avec emails invalides et roles invalides
   - Verifie les erreurs dans le tableau de preview
   - Verifie le compteur d'erreurs
   - Verifie que le bouton "Send" indique le bon nombre

4. **Envoi et resultats** :
   - Upload un CSV valide
   - Clique "Send N Invitations"
   - Verifie la barre de progression
   - Verifie le tableau de resultats
   - Clique "Done"
   - Verifie que le dialog se ferme

5. **Onglet Single Invite non-regression** :
   - Verifie que le formulaire email simple fonctionne toujours
   - Envoie une invitation single
   - Verifie le succes

6. **Change File** :
   - Upload un CSV
   - Clique "Change File"
   - Verifie le retour a la phase idle

7. **Fichier invalide** :
   - Upload un fichier trop gros (>1MB)
   - Verifie le message d'erreur
   - Upload un fichier non-CSV
   - Verifie le message d'erreur

---

## Diagramme de flux

```
[User opens dialog]
        |
        v
  [Tabs: Single | Bulk]
        |
   clicks "Bulk"
        |
        v
  [Phase: idle]
  Upload CSV file
        |
   file selected
        |
        v
  Parse CSV client-side
  Validate each row
        |
        v
  [Phase: preview]
  Show table with rows
  Show error count
        |
   clicks "Send N"
        |
        v
  [Phase: sending]
  Sequential API calls
  Progress bar
        |
   all done / cancel
        |
        v
  [Phase: results]
  Show success/fail/skip
  per row
        |
   clicks "Done"
        |
        v
  [Dialog closes]
  [Members list refreshes]
```
