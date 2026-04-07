# UX Design Blueprint — Universal Git Provider + Generic Credential Store

**Date:** 2026-04-07
**Auteur:** UX Agent
**Status:** Draft — pret pour implementation
**Ref spec:** `docs/superpowers/specs/2026-04-07-universal-git-credentials-design.md`

---

## 0. Analyse du design system existant

### Composants shadcn/ui utilises dans config-layers
- `Button` — variants: `default`, `outline`, `ghost`, `destructive`. Sizes: `sm`, `icon` (`h-7 w-7`), `xs` (`h-6 px-2`), `icon-xs`
- `Badge` — variants: `default`, `secondary`, `outline`, `destructive`
- `Input` — usage standard, `className="font-mono text-xs"` pour les paths
- `Label` — toujours associe a un input, pattern `space-y-1.5`
- `Textarea` — `rows={4..5}`, `className="font-mono text-xs sm:text-sm"` pour les env vars
- `Select` / `SelectTrigger` / `SelectContent` / `SelectItem`
- `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogFooter` — `max-w-md`
- `Separator`
- `Tooltip` / `TooltipTrigger` / `TooltipContent`

### Icones lucide-react utilisees
- `Pencil`, `Trash2`, `Plus`, `KeyRound`, `Link2Off`, `Link2`, `RefreshCw`, `AlertCircle`
- `Lock`, `Globe`, `X`
- `Github`, `GitBranch` (les deux dans `NewProjectDialog`)
- `ExternalLink`, `Loader2`

### Patterns de formulaire (reference: `McpItemEditor.tsx`)
```
<form className="space-y-4 p-3 sm:p-4 rounded-lg border border-border bg-muted/50">
  <div className="space-y-1.5">
    <Label>Nom du champ</Label>
    <Input ... />
  </div>
  <div className="flex gap-2 pt-2">
    <Button type="submit" size="sm">{item ? "Update" : "Add"}</Button>
    <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
  </div>
</form>
```

### Pattern carte item (reference: `LayerItemList.tsx` lignes 236-363)
```
<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2 rounded-lg border border-border bg-muted/50">
  <div className="flex items-center gap-2 flex-1 min-w-0">
    {/* Nom + description */}
    {/* Badge enabled/disabled (mobile) */}
    {/* Actions edit/delete (mobile) */}
  </div>
  {/* Section credentials (si applicable) */}
  {/* Badge enabled/disabled (desktop) */}
  {/* Actions edit/delete (desktop) */}
</div>
```

### Couleurs des status credentials (reference: `LayerItemList.tsx` lignes 67-77)
```typescript
const STATUS_STYLE = {
  connected:    { dotClass: "bg-green-500",    label: "Connected" },
  pending:      { dotClass: "bg-amber-500",    label: "Pending" },
  expired:      { dotClass: "bg-amber-500",    label: "Expired" },
  revoked:      { dotClass: "bg-red-500",      label: "Revoked" },
  error:        { dotClass: "bg-red-500",      label: "Error" },
  disconnected: { dotClass: "bg-neutral-400",  label: "No secrets" },
};
```

---

## 1. GitProviderIcon.tsx

**Fichier:** `ui/src/components/GitProviderIcon.tsx`

### Justification design
Lucide n'a pas d'icone pour GitLab, Bitbucket, Gitea, Azure DevOps. On utilise des SVG inline minimalistes en 16x16, stylisables via `className` (currentColor). Le composant est une factory simple — pas de state, pas de hooks.

### Code complet

```tsx
import { GitBranch, Github } from "lucide-react";
import type { SVGProps } from "react";
import type { GitProviderType } from "@mnm/shared";

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

// GitLab — fox minimal (triangle + carres)
function GitlabIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M8 14.5 1 5.5l1.5-4h1L5 6h6l1.5-4.5h1L15 5.5z" />
      <path opacity="0.6" d="M8 14.5 5 6h6z" />
      <path opacity="0.4" d="M8 14.5 2.5 5.5 5 6z" />
      <path opacity="0.4" d="M8 14.5 13.5 5.5 11 6z" />
    </svg>
  );
}

// Bitbucket — bucket simplifie
function BitbucketIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M1.5 2a.5.5 0 0 0-.496.565l2 11A.5.5 0 0 0 3.5 14h9a.5.5 0 0 0 .496-.435l2-11A.5.5 0 0 0 14.5 2h-13zm7 9.5H7.5l-.75-4h2.5L8.5 11.5z"
      />
    </svg>
  );
}

// Gitea — thee tasses superposees
function GiteaIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 8 3z" />
      <circle cx="8" cy="8" r="2" />
      <path d="M8 3v2M8 11v2M3 8h2M11 8h2" strokeWidth="1.5" stroke="currentColor" fill="none" />
    </svg>
  );
}

// Azure DevOps — infinite loop simplifie
function AzureDevOpsIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M2 10.5 6.5 2l4 3.5L7 9l3.5.5L14 6v4.5L10.5 14l-3-3.5H5L2 12z" />
    </svg>
  );
}

const PROVIDER_ICONS: Record<GitProviderType, React.FC<IconProps>> = {
  github: Github,
  gitlab: GitlabIcon,
  bitbucket: BitbucketIcon,
  gitea: GiteaIcon,
  azure_devops: AzureDevOpsIcon,
  generic: GitBranch,
};

export function GitProviderIcon({
  provider,
  className,
  ...props
}: { provider: GitProviderType } & IconProps) {
  const Icon = PROVIDER_ICONS[provider] ?? GitBranch;
  return <Icon className={className} {...props} />;
}
```

### Tailles utilisees dans le projet
- `h-3 w-3` — dans les badges et liens inline (ProjectProperties workspace row)
- `h-3.5 w-3.5` — actions mobiles
- `h-4 w-4` — standard dans les boutons et headers
- `h-5 w-5` — rare, formulaires principaux

---

## 2. GitProviderItemEditor.tsx

**Fichier:** `ui/src/components/config-layers/GitProviderItemEditor.tsx`

### Layout
Meme pattern que `McpItemEditor.tsx` : form avec `space-y-4 p-3 sm:p-4 rounded-lg border border-border bg-muted/50`.

### Champs
1. **URL ou hostname** — input text, blur → auto-detection
2. **Provider detecte** — readonly, icone + label (conditionnellement visible si URL valide)
3. **Boutons Save/Cancel**

Note: Le PAT n'est PAS dans ce formulaire. Il est stocke separement via `ItemCredentialActions` (section 4). L'editeur ne gere que la config (`host` + `providerType`).

### States
- **empty** — URL vide, section "Provider detecte" cachee
- **editing** — URL en cours de frappe
- **detected** — URL valide, provider detecte affiche avec icone
- **saving** — bouton Save desactive + spinner
- **error** — message d'erreur sous le bouton

### Code complet

```tsx
import { useState } from "react";
import { GitBranch } from "lucide-react";
import type { ConfigLayerItem } from "@mnm/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitProviderIcon } from "../GitProviderIcon";
import { detectGitProvider } from "@mnm/shared";
import type { DetectedGitProvider } from "@mnm/shared";

type Props = {
  item?: ConfigLayerItem;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
};

export function GitProviderItemEditor({ item, onSave, onCancel }: Props) {
  const existing = item?.configJson as { host?: string; providerType?: string } | undefined;

  // Initialiser avec l'URL existante ou le host
  const [urlInput, setUrlInput] = useState(existing?.host ?? "");
  const [detected, setDetected] = useState<DetectedGitProvider | null>(
    existing?.host
      ? detectGitProvider(existing.host)
      : null,
  );

  function handleUrlBlur() {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setDetected(null);
      return;
    }
    setDetected(detectGitProvider(trimmed));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!detected) return;
    onSave({
      name: detected.host,
      host: detected.host,
      providerType: detected.providerType,
    });
  }

  const canSubmit = !!detected;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 p-3 sm:p-4 rounded-lg border border-border bg-muted/50"
    >
      <div className="space-y-1.5">
        <Label>Repository URL or hostname</Label>
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onBlur={handleUrlBlur}
          placeholder="https://github.com/org/repo or gitlab.mycompany.com"
          autoFocus={!item}
        />
        <p className="text-xs text-muted-foreground">
          Paste any git URL or hostname. The provider is detected automatically.
        </p>
      </div>

      {detected && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
          <GitProviderIcon
            provider={detected.providerType}
            className="h-4 w-4 shrink-0 text-muted-foreground"
          />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{detected.label}</span>
            <span className="text-xs text-muted-foreground ml-2">{detected.host}</span>
          </div>
        </div>
      )}

      {!detected && urlInput.trim() && (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2">
          <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Click outside the field to detect the provider.
          </span>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {item ? "Update" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
```

### Responsive
- Mobile : identique desktop, layout lineaire. Pas de grille.
- Le bloc "provider detecte" est toujours full-width.

---

## 3. CredentialDialog.tsx (renomme depuis ApiKeyCredentialDialog)

**Fichier:** `ui/src/components/config-layers/CredentialDialog.tsx`

### Generalisation
Le `ApiKeyCredentialDialog` actuel est mode-agnostique au niveau du stockage (il poste `{ material: { env: {...} } }`). Pour les git providers, on veut un champ unique "Access Token" au lieu d'un textarea KEY=VALUE.

La prop `mode` controle l'affichage :
- `"mcp"` — textarea KEY=VALUE (comportement actuel)
- `"git"` — input password + label "Personal Access Token"

### Code complet

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { configLayersApi } from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";

function parseEnvText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1);
    if (key) result[key] = value;
  }
  return result;
}

type CredentialDialogMode = "mcp" | "git";

export function CredentialDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  companyId,
  mode = "mcp",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  companyId: string;
  mode?: CredentialDialogMode;
}) {
  const queryClient = useQueryClient();

  // Mode MCP : textarea env vars
  const [envText, setEnvText] = useState("");

  // Mode git : champ PAT unique
  const [patValue, setPatValue] = useState("");

  function reset() {
    setEnvText("");
    setPatValue("");
  }

  const storeMutation = useMutation({
    mutationFn: () => {
      if (mode === "git") {
        return configLayersApi.storePat(companyId, itemId, { token: patValue.trim() });
      }
      const env = parseEnvText(envText);
      return configLayersApi.storeApiKey(companyId, itemId, { env });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.configLayers.credentials(companyId),
      });
      reset();
      onOpenChange(false);
    },
  });

  // Validation
  const isMcp = mode === "mcp";
  const parsed = isMcp ? parseEnvText(envText) : null;
  const mcpKeyCount = parsed ? Object.keys(parsed).length : 0;
  const canSubmit = isMcp ? mcpKeyCount > 0 : patValue.trim().length > 0;

  const dialogTitle = mode === "git"
    ? `Personal Access Token — ${itemName}`
    : `Secret credentials — ${itemName}`;

  const submitLabel = isMcp
    ? storeMutation.isPending
      ? "Encrypting…"
      : `Store ${mcpKeyCount} secret${mcpKeyCount !== 1 ? "s" : ""}`
    : storeMutation.isPending
      ? "Encrypting…"
      : "Store token";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {isMcp ? (
            <>
              <p className="text-xs text-muted-foreground">
                These values are stored encrypted (AES-256-GCM) and injected at
                runtime as environment variables. They override static env vars
                defined in the MCP server config.
              </p>
              <div className="space-y-1.5">
                <Label>
                  Secret env vars{" "}
                  <span className="text-muted-foreground font-normal">
                    (KEY=value per line)
                  </span>
                </Label>
                <Textarea
                  value={envText}
                  onChange={(e) => setEnvText(e.target.value)}
                  placeholder={"APITOKEN=your-secret-token\nSECRET_KEY=abc123"}
                  rows={5}
                  className="font-mono text-sm"
                  autoFocus
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Your Personal Access Token is stored encrypted (AES-256-GCM) and
                injected into the agent sandbox at runtime. It is never written
                to disk or returned by the API.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="pat-input">Personal Access Token</Label>
                <Input
                  id="pat-input"
                  type="password"
                  value={patValue}
                  onChange={(e) => setPatValue(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="font-mono"
                  autoFocus
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  For GitHub: Settings → Developer settings → Personal access tokens.
                  Scopes required: <code className="font-mono">repo</code>.
                </p>
              </div>
            </>
          )}

          {storeMutation.isError && (
            <p className="text-xs text-destructive">
              Failed to store credentials. Please try again.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => storeMutation.mutate()}
            disabled={!canSubmit || storeMutation.isPending}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### API client — nouvelle methode a ajouter dans `config-layers.ts`

```typescript
// Dans configLayersApi :
storePat: (companyId: string, itemId: string, material: { token: string }) =>
  api.post<{ ok: boolean }>(`/companies/${companyId}/credentials/${itemId}/pat`, { material }),
```

---

## 4. ItemCredentialActions.tsx

**Fichier:** `ui/src/components/config-layers/ItemCredentialActions.tsx`

### Justification extraction
Le bloc credential dans `LayerItemList.tsx` (lignes 277-333) est duplique pour MCP et devra l'etre pour git. L'extraire en composant evite la duplication et centralise la logique d'affichage.

### Props interface

```typescript
type ItemCredentialActionsProps = {
  item: ConfigLayerItem;           // l'item complet (pour hasOAuthConfig)
  companyId: string;
  credByItemId: Map<string, UserCredential>;  // map globale (passee du parent)
  readOnly?: boolean;
  onOpenCredentialDialog: (itemId: string, itemName: string) => void;
  onRevoke: (credentialId: string) => void;
  isRevoking?: boolean;
  mode?: "mcp" | "git";           // controle l'affichage des boutons
};
```

### Differences MCP vs git
- `mcp` : bouton "Add/Update secrets" + bouton OAuth (si oauth config) + bouton Revoke
- `git` : bouton "Add/Update token" (libelle different) + bouton Revoke (pas d'OAuth pour MVP)

### Code complet

```tsx
import { KeyRound, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConfigLayerItem, UserCredential } from "@mnm/shared";
import type { CredentialStatus } from "@mnm/shared";
import { OAuthConnectButton } from "./OAuthConnectButton";
import { cn } from "../../lib/utils";

const STATUS_STYLE: Record<CredentialStatus | "disconnected", { dotClass: string; label: string }> = {
  connected:    { dotClass: "bg-green-500",   label: "Connected" },
  pending:      { dotClass: "bg-amber-500",   label: "Pending" },
  expired:      { dotClass: "bg-amber-500",   label: "Expired" },
  revoked:      { dotClass: "bg-red-500",     label: "Revoked" },
  error:        { dotClass: "bg-red-500",     label: "Error" },
  disconnected: { dotClass: "bg-neutral-400", label: "No secrets" },
};

function CredentialStatusBadge({ status }: { status: CredentialStatus | "disconnected" }) {
  const cfg = STATUS_STYLE[status] ?? STATUS_STYLE.disconnected;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", cfg.dotClass)} />
      {cfg.label}
    </span>
  );
}

export function ItemCredentialActions({
  item,
  companyId,
  credByItemId,
  readOnly,
  onOpenCredentialDialog,
  onRevoke,
  isRevoking,
  mode = "mcp",
}: ItemCredentialActionsProps) {
  const cred = credByItemId.get(item.id);
  const status: CredentialStatus | "disconnected" = cred
    ? (cred.status as CredentialStatus)
    : "disconnected";

  const isConnected = status === "connected";

  function hasOAuthConfig(): boolean {
    const cfg = item.configJson as Record<string, unknown> | undefined;
    return !!(cfg?.oauth && typeof cfg.oauth === "object");
  }

  const secretButtonLabel = mode === "git"
    ? isConnected ? "Update token" : "Add token"
    : isConnected ? "Update secrets" : "Add secrets";

  return (
    <div className="flex items-center gap-2 flex-wrap shrink-0">
      <CredentialStatusBadge status={status} />

      {!readOnly && (
        <Button
          size="sm"
          variant={isConnected ? "outline" : "secondary"}
          className="h-7 text-xs"
          onClick={() => onOpenCredentialDialog(item.id, item.displayName ?? item.name)}
        >
          <KeyRound className="h-3 w-3 mr-1" />
          {secretButtonLabel}
        </Button>
      )}

      {/* OAuth — uniquement pour MCP avec config oauth */}
      {!readOnly && mode === "mcp" && hasOAuthConfig() && (
        <OAuthConnectButton
          itemId={item.id}
          companyId={companyId}
          status={status}
        />
      )}

      {!readOnly && isConnected && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground hover:text-destructive"
          onClick={() => { if (cred) onRevoke(cred.id); }}
          disabled={isRevoking}
        >
          <Link2Off className="h-3 w-3 mr-1" />
          Revoke
        </Button>
      )}
    </div>
  );
}
```

---

## 5. Modifications de LayerEditor.tsx

**Fichier:** `ui/src/components/config-layers/LayerEditor.tsx`

### Changement minimal — ajout du tab

```tsx
// Avant (ligne 14-19)
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "mcp", label: "MCP Servers" },
  { id: "skill", label: "Skills" },
  { id: "hook", label: "Hooks" },
  { id: "setting", label: "Settings" },
];

// Apres
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "mcp", label: "MCP Servers" },
  { id: "git_provider", label: "Git Providers" },  // ← position 2, apres MCP
  { id: "skill", label: "Skills" },
  { id: "hook", label: "Hooks" },
  { id: "setting", label: "Settings" },
];
```

Aucun autre changement dans `LayerEditor.tsx`. Le tab bar gere automatiquement le compteur via `countByType`.

---

## 6. Modifications de LayerItemList.tsx

**Fichier:** `ui/src/components/config-layers/LayerItemList.tsx`

### Changements a effectuer

**1. Imports — ajouter les nouveaux composants**

```tsx
// Ajouter
import { GitProviderItemEditor } from "./GitProviderItemEditor";
import { ItemCredentialActions } from "./ItemCredentialActions";
import { CredentialDialog } from "./CredentialDialog";
// Supprimer (ou conserver comme alias si besoin de compat)
// import { ApiKeyCredentialDialog } from "./ApiKeyCredentialDialog";
// import { McpOAuthConnectButton } from "./McpOAuthConnectButton";
```

**2. ITEM_TYPE_LABELS — ajouter git_provider**

```tsx
// Ligne 58-63
const ITEM_TYPE_LABELS: Record<ConfigLayerItemType, string> = {
  mcp: "MCP Server",
  git_provider: "Git Provider",   // ← AJOUTER
  hook: "Hook",
  skill: "Skill",
  setting: "Setting",
};
```

**3. ItemEditor switch — ajouter case git_provider**

```tsx
// Dans le switch (apres case "mcp")
case "git_provider":
  return (
    <GitProviderItemEditor item={item} onSave={onSave} onCancel={onCancel} />
  );
```

**4. Credentials — generaliser au-dela de MCP**

```tsx
// Avant (ligne 108)
const isMcp = itemType === "mcp";
const { data: credentials } = useQuery({
  queryKey: queryKeys.configLayers.credentials(companyId!),
  queryFn: () => configLayersApi.listCredentials(companyId!),
  enabled: isMcp && !!companyId,
});

// Apres
const CREDENTIALED_TYPES: ConfigLayerItemType[] = ["mcp", "git_provider"];
const needsCredentials = CREDENTIALED_TYPES.includes(itemType);
const { data: credentials } = useQuery({
  queryKey: queryKeys.configLayers.credentials(companyId!),
  queryFn: () => configLayersApi.listCredentials(companyId!),
  enabled: needsCredentials && !!companyId,
});
```

**5. State — generifier apiKeyItemId (pas de renommage si on veut zero risk)**

Ajouter un state pour le mode du dialog :

```tsx
const [credDialogMode, setCredDialogMode] = useState<"mcp" | "git">("mcp");
```

**6. Remplacer le bloc credential inline par ItemCredentialActions**

```tsx
// Avant (ligne 277-333) : bloc inline avec isMcp
{isMcp && companyId && (
  <div className="flex items-center gap-2 flex-wrap shrink-0">
    ...inline badges, boutons...
  </div>
)}

// Apres : utiliser ItemCredentialActions
{needsCredentials && companyId && (
  <ItemCredentialActions
    item={it}
    companyId={companyId}
    credByItemId={credByItemId}
    readOnly={readOnly}
    onOpenCredentialDialog={(id, name) => {
      setApiKeyItemId(id);
      setApiKeyItemName(name);
      setCredDialogMode(itemType === "git_provider" ? "git" : "mcp");
    }}
    onRevoke={(credId) => revokeMutation.mutate(credId)}
    isRevoking={revokeMutation.isPending}
    mode={itemType === "git_provider" ? "git" : "mcp"}
  />
)}
```

**7. Remplacer ApiKeyCredentialDialog par CredentialDialog**

```tsx
// Avant (lignes 367-378)
{apiKeyItemId && companyId && (
  <ApiKeyCredentialDialog
    open={!!apiKeyItemId}
    onOpenChange={(open) => { if (!open) setApiKeyItemId(null); }}
    itemId={apiKeyItemId}
    itemName={apiKeyItemName}
    companyId={companyId}
  />
)}

// Apres
{apiKeyItemId && companyId && (
  <CredentialDialog
    open={!!apiKeyItemId}
    onOpenChange={(open) => { if (!open) setApiKeyItemId(null); }}
    itemId={apiKeyItemId}
    itemName={apiKeyItemName}
    companyId={companyId}
    mode={credDialogMode}
  />
)}
```

---

## 7. Modifications de NewProjectDialog.tsx

**Fichier:** `ui/src/components/NewProjectDialog.tsx`

### Changements

**1. Import — remplacer Github par GitProviderIcon + import detectGitProvider**

```tsx
// Avant (ligne 27-29)
import {
  Maximize2, Minimize2, Target, Calendar, Plus, X, FolderOpen, Github, GitBranch,
} from "lucide-react";

// Apres
import {
  Maximize2, Minimize2, Target, Calendar, Plus, X, FolderOpen, GitBranch,
} from "lucide-react";
import { GitProviderIcon } from "./GitProviderIcon";
import { detectGitProvider } from "@mnm/shared";
```

**2. Validation — remplacer isGitHubRepoUrl par looksLikeGitUrl**

```tsx
// Avant (lignes 99-109)
const isGitHubRepoUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return false;
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.length >= 2;
  } catch {
    return false;
  }
};

// Apres
const looksLikeGitUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // URL https:// ou ssh git@
  if (trimmed.startsWith("git@")) return trimmed.includes(":");
  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && segments.length >= 2;
  } catch {
    return false;
  }
};
```

**3. handleSubmit — remplacer la validation**

```tsx
// Avant (ligne 144-147)
if (repoRequired && !isGitHubRepoUrl(repoUrl)) {
  setWorkspaceError("Repo workspace must use a valid GitHub repo URL.");
  return;
}

// Apres
if (repoRequired && !looksLikeGitUrl(repoUrl)) {
  setWorkspaceError("Repo workspace must be a valid git URL (https:// or git@...).");
  return;
}
```

**4. deriveWorkspaceNameFromRepo — enlever le fallback "GitHub repo"**

```tsx
const deriveWorkspaceNameFromRepo = (value: string) => {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const repo = segments[segments.length - 1]?.replace(/\.git$/i, "") ?? "";
    return repo || "Git repo";  // "GitHub repo" → "Git repo"
  } catch {
    return "Git repo";
  }
};
```

**5. Bouton "A github repo" — icone dynamique + texte generique**

```tsx
// Avant (lignes 308-318)
<button ... onClick={() => toggleWorkspaceSetup("repo")}>
  <div className="flex items-center gap-2 text-sm font-medium">
    <Github className="h-4 w-4" />
    A github repo
  </div>
  <p className="mt-1 text-xs text-muted-foreground">Paste a GitHub URL.</p>
</button>

// Apres
<button ... onClick={() => toggleWorkspaceSetup("repo")}>
  <div className="flex items-center gap-2 text-sm font-medium">
    <GitProviderIcon
      provider={workspaceRepoUrl.trim() ? detectGitProvider(workspaceRepoUrl).providerType : "generic"}
      className="h-4 w-4"
    />
    A git repo
  </div>
  <p className="mt-1 text-xs text-muted-foreground">Paste any git URL.</p>
</button>
```

**6. Input repo URL — placeholder generique**

```tsx
// Avant (ligne 354)
placeholder="https://github.com/org/repo"

// Apres
placeholder="https://github.com/org/repo or git@gitlab.com:org/repo.git"
```

**7. Label "GitHub repo URL" → "Git repo URL"**

```tsx
// Avant (ligne 350)
<label className="mb-1 block text-xs text-muted-foreground">GitHub repo URL</label>

// Apres
<label className="mb-1 block text-xs text-muted-foreground">Git repo URL</label>
```

---

## 8. Modifications de ProjectProperties.tsx

**Fichier:** `ui/src/components/ProjectProperties.tsx`

### Changements — memes patterns que NewProjectDialog

**1. Import — remplacer Github par GitProviderIcon**

```tsx
// Avant (ligne 17)
import { ExternalLink, Github, Loader2, Plus, ScanSearch, Trash2, X } from "lucide-react";

// Apres
import { ExternalLink, Loader2, Plus, ScanSearch, Trash2, X } from "lucide-react";
import { GitProviderIcon } from "./GitProviderIcon";
import { detectGitProvider } from "@mnm/shared";
```

**2. Validation isGitHubRepoUrl → looksLikeGitUrl (lignes 170-179)**

Meme implementation que dans `NewProjectDialog.tsx` (copier-coller la fonction `looksLikeGitUrl`).

**3. submitRepoWorkspace — message d'erreur generique**

```tsx
// Avant (ligne 229)
setWorkspaceError("Repo workspace must use a valid GitHub repo URL.");

// Apres
setWorkspaceError("Repo workspace must be a valid git URL (https:// or git@...).");
```

**4. deriveWorkspaceNameFromRepo — "GitHub repo" → "Git repo"**

Meme changement que NewProjectDialog.

**5. Icone dans la liste des workspaces (ligne 414-416)**

```tsx
// Avant
<Github className="h-3 w-3 shrink-0" />

// Apres
<GitProviderIcon
  provider={detectGitProvider(workspace.repoUrl).providerType}
  className="h-3 w-3 shrink-0"
/>
```

**6. Bouton "Add workspace repo" — texte inchange** (generique par nature)

**7. Placeholder input repo URL (ligne 499)**

```tsx
// Avant
placeholder="https://github.com/org/repo"

// Apres
placeholder="https://github.com/org/repo or git@gitlab.com:org/repo.git"
```

---

## 9. Ajout dans config-layers.ts (API client)

**Fichier:** `ui/src/api/config-layers.ts`

```typescript
// Ajouter apres storeApiKey :
storePat: (companyId: string, itemId: string, material: { token: string }) =>
  api.post<{ ok: boolean }>(`/companies/${companyId}/credentials/${itemId}/pat`, { material }),

// Mettre a jour listCredentials et revokeCredential pour utiliser la nouvelle route :
listCredentials: (companyId: string) =>
  api.get<UserCredential[]>(`/companies/${companyId}/credentials`),
storeApiKey: (companyId: string, itemId: string, material: Record<string, unknown>) =>
  api.post<{ ok: boolean }>(`/companies/${companyId}/credentials/${itemId}/secret`, { material }),
revokeCredential: (companyId: string, credentialId: string) =>
  api.delete<void>(`/companies/${companyId}/credentials/${credentialId}`),
```

Mettre a jour les types imports :
```typescript
// Avant
import type { ..., UserMcpCredential } from "@mnm/shared";

// Apres
import type { ..., UserCredential } from "@mnm/shared";
```

---

## 10. OAuthConnectButton.tsx (renomme depuis McpOAuthConnectButton)

**Fichier:** `ui/src/components/config-layers/OAuthConnectButton.tsx`

### Changements minimes
- Renommer le fichier
- Renommer l'export `McpOAuthConnectButton` → `OAuthConnectButton`
- Remplacer `import { type McpCredentialStatus }` par `import { type CredentialStatus }`
- Remplacer le check `event.data?.type === "mcp-oauth-result"` → `"oauth-result"` (si le backend est aussi mis a jour)

Le comportement et le JSX sont identiques. Aucun changement visuel.

---

## 11. Recapitulatif des nouveaux fichiers

| Fichier | Type | Dependances |
|---------|------|-------------|
| `ui/src/components/GitProviderIcon.tsx` | Nouveau | `lucide-react`, `@mnm/shared` (GitProviderType) |
| `ui/src/components/config-layers/GitProviderItemEditor.tsx` | Nouveau | `GitProviderIcon`, `@mnm/shared` (detectGitProvider) |
| `ui/src/components/config-layers/CredentialDialog.tsx` | Renomme + etendu | `@/ui`, `configLayersApi` |
| `ui/src/components/config-layers/ItemCredentialActions.tsx` | Nouveau (extraction) | `OAuthConnectButton`, `@/ui` |
| `ui/src/components/config-layers/OAuthConnectButton.tsx` | Renomme | `@/ui`, `queryKeys` |

## 12. Recapitulatif des fichiers modifies

| Fichier | Changements |
|---------|-------------|
| `ui/src/components/config-layers/LayerEditor.tsx` | +1 tab `git_provider` |
| `ui/src/components/config-layers/LayerItemList.tsx` | +ITEM_TYPE_LABELS, +case switch, generalise credentials, utilise ItemCredentialActions + CredentialDialog |
| `ui/src/components/NewProjectDialog.tsx` | Import GitProviderIcon, looksLikeGitUrl, icone dynamique, textes generiques |
| `ui/src/components/ProjectProperties.tsx` | Memes changements que NewProjectDialog |
| `ui/src/api/config-layers.ts` | +storePat, URLs renommees /credentials, types UserCredential |

---

## 13. Comportement UX detaille — flux utilisateur

### Flux : Ajouter un git provider

1. User ouvre le LayerEditor d'un agent → tab "Git Providers"
2. Liste vide : "No git providers configured."
3. Click "Add Git Provider" → formulaire `GitProviderItemEditor` apparait en haut de liste
4. User colle `https://gitlab.mycompany.com/team/project`
5. User quitte le champ (onBlur) → `detectGitProvider` s'execute → affiche bloc "GitLab (self-hosted) — gitlab.mycompany.com"
6. Click "Add" → item cree avec `{ host: "gitlab.mycompany.com", providerType: "gitlab" }`
7. Item apparait dans la liste avec badge "No secrets" et bouton "Add token"
8. User click "Add token" → `CredentialDialog` mode `"git"` s'ouvre
9. User colle le PAT → "Store token" → credential stocke chiffre
10. Badge passe a "Connected"

### Flux : Repo workspace avec icone dynamique

1. User ouvre NewProjectDialog → section workspace → click "A git repo"
2. Input URL vide → icone `GitBranch` generique
3. User tape `https://gitlab.com/org/` → icone passe a `GitlabIcon` (si onBlur ou onChange avec debounce — voir note ci-dessous)
4. User valide → plus de validation GitHub-only

**Note sur l'icone dans NewProjectDialog :** L'icone dans le bouton de selection "A git repo" se met a jour uniquement si `workspaceRepoUrl` change (react state). Pas de debounce necessaire — l'icone est juste decorative. Si l'URL est vide, on affiche `generic`.

### Gestion d'erreur credential

Si `storeMutation.isError` → message inline dans le dialog : "Failed to store credentials. Please try again." (identique a l'actuel). Pas de toast, pas de notification externe — pattern existant conserve.

---

*Generated by UX Design Agent — implementable directement*
