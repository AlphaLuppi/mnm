# MU-S06 : Sign-out avec Invalidation Session — Spécification Détaillée

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Story ID** | MU-S06 |
| **Titre** | Sign-out avec Invalidation Session |
| **Epic** | Epic 2 — Multi-User & Invitations |
| **Sprint** | Sprint 0 (Batch 1 — pas de blocage) |
| **Effort** | S (1 SP, 0.5j) |
| **Assignation** | Tom (backend + frontend) |
| **Bloqué par** | Aucun |
| **Débloque** | Aucun directement (amélioration sécurité transversale) |
| **Type** | Full-stack (backend endpoint + UI button + cleanup) |

---

## Description

L'application MnM dispose déjà de l'infrastructure d'authentification Better Auth (sign-in, sign-up, session resolution) et du client-side API pour le sign-out (`authApi.signOut()`). Cependant, **il n'y a aucun bouton de déconnexion visible dans l'interface utilisateur**. L'utilisateur connecté en mode `authenticated` n'a actuellement aucun moyen de se déconnecter sans manipuler manuellement les cookies ou appeler l'API.

### Ce qui existe déjà

1. **Côté serveur** : Better Auth est monté sur `app.all("/api/auth/*authPath", betterAuthHandler)` dans `server/src/app.ts` (L90-92). Better Auth fournit nativement un endpoint `POST /api/auth/sign-out` qui invalide la session côté serveur (supprime la ligne dans la table `session` PostgreSQL) et efface les cookies de session.

2. **Côté client API** : `ui/src/api/auth.ts` (L71-73) a déjà la fonction `authApi.signOut()` qui fait un `POST /api/auth/sign-out` avec `credentials: "include"`.

3. **Session query** : `queryKeys.auth.session` est utilisée dans `App.tsx` (CloudAccessGate) et `Auth.tsx` pour vérifier l'état de la session.

4. **Deployment mode detection** : Le health endpoint retourne `deploymentMode` (`"authenticated"` ou `"local_trusted"`) — le bouton sign-out ne doit s'afficher qu'en mode `authenticated`.

### Ce qui manque

1. **Aucun bouton "Sign out" / "Déconnexion" dans l'UI** — ni dans la Sidebar, ni dans le CompanyRail, ni dans le BreadcrumbBar.
2. **Pas de cleanup TanStack Query** après sign-out — il faut invalider toutes les queries et rediriger vers `/auth`.
3. **Pas de user info affichée** — l'utilisateur ne sait pas sous quel compte il est connecté.

---

## État Actuel du Code (Analyse)

### Fichiers clés

| Fichier | Rôle | Lignes pertinentes |
|---------|------|-------------------|
| `server/src/app.ts` | Monte Better Auth handler | L90-92 (`app.all("/api/auth/*authPath", ...)`) |
| `server/src/auth/better-auth.ts` | Instance Better Auth | L68-102 (`createBetterAuthInstance`) |
| `ui/src/api/auth.ts` | Client auth API | L71-73 (`signOut`), L47-61 (`getSession`) |
| `ui/src/App.tsx` | CloudAccessGate vérifie session | L56-94 |
| `ui/src/lib/queryKeys.ts` | Query keys pour session | L64-66 (`auth.session`) |
| `ui/src/api/health.ts` | Health API + types | L1-24 |
| `ui/src/components/CompanyRail.tsx` | Rail vertical gauche (lieu idéal pour le user avatar) | L263-317 |
| `ui/src/components/Layout.tsx` | Layout principal, bottom bar avec theme toggle | L186-299 |
| `ui/src/pages/Auth.tsx` | Page login/signup | L1-162 |

### Constats

1. **Le backend est déjà prêt** : Better Auth gère nativement `POST /api/auth/sign-out`. L'endpoint supprime la session de la table `session` et efface les cookies `better-auth.session_token`. Aucun code backend supplémentaire n'est nécessaire.

2. **Le client API est déjà prêt** : `authApi.signOut()` existe et appelle le bon endpoint.

3. **Il manque uniquement la partie UI** : un bouton visible, la gestion du post-sign-out (query invalidation + redirect), et idéalement l'affichage de l'identité de l'utilisateur connecté.

4. **Le CompanyRail est l'endroit naturel** pour placer un avatar/bouton utilisateur en bas du rail (pattern Discord/Slack : avatar user en bas de la barre verticale de gauche).

---

## Acceptance Criteria

### AC-1 : Bouton sign-out visible
**Given** un utilisateur connecté en mode `authenticated`
**When** il regarde le bas du CompanyRail
**Then** il voit un avatar ou icône utilisateur avec son initiale

### AC-2 : Menu utilisateur avec option déconnexion
**Given** l'avatar utilisateur dans le CompanyRail
**When** l'utilisateur clique dessus
**Then** un dropdown/popover s'affiche avec :
  - L'email de l'utilisateur connecté (ou son nom)
  - Un bouton "Sign out"

### AC-3 : Invalidation session serveur
**Given** un utilisateur connecté
**When** il clique sur "Sign out"
**Then** la session est invalidée côté serveur (row supprimée de la table `session`)
**And** les cookies de session sont effacés

### AC-4 : Redirect vers page auth
**Given** l'utilisateur vient de cliquer "Sign out"
**When** le sign-out est complété
**Then** il est redirigé vers `/auth`
**And** toutes les queries TanStack sont invalidées (query cache clear)

### AC-5 : Ancien token rejeté
**Given** un ancien cookie de session (avant sign-out)
**When** une requête API est faite avec ce cookie
**Then** elle retourne 401 Unauthorized

### AC-6 : Masquage en mode local_trusted
**Given** le mode de déploiement est `local_trusted`
**When** l'utilisateur regarde le CompanyRail
**Then** l'avatar/bouton utilisateur N'EST PAS affiché (pas d'auth en mode local)

### AC-7 : État de chargement pendant sign-out
**Given** l'utilisateur clique "Sign out"
**When** la requête est en cours
**Then** le bouton est désactivé / affiche un état de chargement
**And** l'utilisateur ne peut pas cliquer à nouveau

---

## data-test-id

| Élément | data-testid | Description |
|---------|------------|-------------|
| Avatar/icône utilisateur dans le CompanyRail | `mu-s06-user-avatar` | Bouton qui ouvre le menu utilisateur |
| Menu dropdown utilisateur | `mu-s06-user-menu` | Conteneur du dropdown |
| Email/nom affiché dans le menu | `mu-s06-user-email` | Texte identifiant l'utilisateur |
| Bouton "Sign out" dans le menu | `mu-s06-sign-out-button` | Bouton déconnexion |

---

## Implémentation Technique

### T1 : Créer un hook `useCurrentUser` (optionnel, petit helper)

**Fichier** : `ui/src/hooks/useCurrentUser.ts` (nouveau)

Ce hook encapsule la query session + la query health pour exposer facilement :
- `user` : `{ id, email, name } | null`
- `isAuthenticated` : `boolean`
- `isAuthenticatedMode` : `boolean` (deployment mode = authenticated)

```typescript
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../api/auth";
import { healthApi } from "../api/health";
import { queryKeys } from "../lib/queryKeys";

export function useCurrentUser() {
  const { data: health } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });

  const isAuthenticatedMode = health?.deploymentMode === "authenticated";

  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    enabled: isAuthenticatedMode,
    retry: false,
  });

  return {
    user: session?.user ?? null,
    isAuthenticated: !!session,
    isAuthenticatedMode,
  };
}
```

### T2 : Ajouter UserMenu dans CompanyRail

**Fichier** : `ui/src/components/CompanyRail.tsx`

Ajouter un composant `UserMenu` en bas du CompanyRail, entre le séparateur et le bouton "Add company". Ce composant :

1. Utilise `useCurrentUser()` pour obtenir l'utilisateur
2. Si `!isAuthenticatedMode`, ne rend rien (AC-6)
3. Affiche un avatar circulaire avec l'initiale du nom ou de l'email
4. Au clic, ouvre un `DropdownMenu` (composant shadcn existant) avec :
   - L'email/nom de l'utilisateur
   - Un bouton "Sign out"
5. Le sign-out utilise `useMutation` pour appeler `authApi.signOut()`, puis :
   - `queryClient.clear()` pour vider tout le cache TanStack
   - `window.location.href = "/auth"` pour un hard redirect (garantit un état propre)

**Placement dans le JSX** de `CompanyRail` (L295-316) :

```
{/* Existing separator */}
<div className="w-8 h-px bg-border mx-auto shrink-0" />

{/* NEW: User menu (authenticated mode only) */}
<UserMenu />

{/* Existing: Add company button */}
<div className="flex items-center justify-center py-2 shrink-0">
  ...
</div>
```

### T3 : Composant UserMenu

**Fichier** : soit inline dans `CompanyRail.tsx`, soit `ui/src/components/UserMenu.tsx` (nouveau)

```typescript
function UserMenu() {
  const { user, isAuthenticatedMode } = useCurrentUser();
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!isAuthenticatedMode || !user) return null;

  const initial = (user.name?.[0] ?? user.email?.[0] ?? "?").toUpperCase();
  const displayName = user.name ?? user.email ?? "User";

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await authApi.signOut();
      queryClient.clear();
      window.location.href = "/auth";
    } catch {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-2 shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            data-testid="mu-s06-user-avatar"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-muted text-xs font-medium text-foreground hover:bg-accent transition-colors"
            aria-label={`User menu for ${displayName}`}
          >
            {initial}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" data-testid="mu-s06-user-menu">
          <DropdownMenuLabel>
            <span data-testid="mu-s06-user-email" className="text-xs truncate block max-w-[180px]">
              {displayName}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-testid="mu-s06-sign-out-button"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {isSigningOut ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

### T4 : Pas de modification backend nécessaire

Better Auth gère nativement `POST /api/auth/sign-out` :
- Supprime la session de la table `session` dans PostgreSQL
- Efface les cookies `better-auth.session_token` via `Set-Cookie` avec `max-age=0`
- L'endpoint est déjà monté via `app.all("/api/auth/*authPath", opts.betterAuthHandler)` dans `server/src/app.ts` L91

Le `actorMiddleware` dans `server/src/middleware/auth.ts` vérifie la session via `resolveBetterAuthSession()`. Si la session a été supprimée, la résolution échouera et `req.actor` restera `{ type: "none" }`, ce qui causera un 401 sur les routes protégées (AC-5).

### T5 : Enrichir getSession pour retourner email/name

**Fichier** : `server/src/app.ts` L73-89

Actuellement, le endpoint custom `GET /api/auth/get-session` retourne `email: null` et `name: null` pour les sessions Better Auth parce qu'il utilise `req.actor` qui ne stocke pas ces infos. Deux options :

**Option A (recommandée, simple)** : Ne pas toucher au backend. Le `authApi.getSession()` côté client parse la réponse de Better Auth directement. La query session dans `CloudAccessGate` passe déjà par l'actor middleware qui résout la session Better Auth. Si `req.actor.source === "session"`, on sait qu'il y a une session Better Auth, mais les champs `email` et `name` ne sont pas dans `req.actor`.

**Option B (meilleure UX)** : Enrichir le `actorMiddleware` pour stocker `email` et `name` quand la source est `"session"`. Cela nécessite de modifier le type `Actor` dans `packages/shared/`. C'est hors scope pour cette story S (1 SP) — on peut afficher l'email obtenu directement via un second appel à Better Auth's get-session natif.

**Solution retenue** : Utiliser directement l'endpoint natif Better Auth `GET /api/auth/get-session` (qui passe par `betterAuthHandler`) plutôt que l'endpoint custom. L'endpoint custom est un fallback pour le mode `local_trusted`. L'`authApi.getSession()` existant appelle déjà `/api/auth/get-session` qui est intercepté par l'endpoint custom en L73 de `app.ts` AVANT le handler Better Auth (car il est monté plus tôt dans la chaîne). Or, l'endpoint custom ne retourne pas `email` et `name`.

**Correction nécessaire** : Modifier `server/src/app.ts` L73-89 pour que, quand la source est `"session"` (Better Auth), on query les infos user depuis la DB.

```typescript
app.get("/api/auth/get-session", async (req, res) => {
  if (req.actor.type !== "board" || !req.actor.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  let email: string | null = null;
  let name: string | null = null;
  if (req.actor.source === "session") {
    // Fetch user info from Better Auth's user table
    const userRow = await db
      .select({ email: authUsers.email, name: authUsers.name })
      .from(authUsers)
      .where(eq(authUsers.id, req.actor.userId))
      .then((rows) => rows[0] ?? null);
    email = userRow?.email ?? null;
    name = userRow?.name ?? null;
  }
  res.json({
    session: {
      id: `mnm:${req.actor.source}:${req.actor.userId}`,
      userId: req.actor.userId,
    },
    user: {
      id: req.actor.userId,
      email,
      name: req.actor.source === "local_implicit" ? "Local Board" : name,
    },
  });
});
```

Cela nécessite d'importer `authUsers` et `eq` dans `app.ts`, et de rendre `db` accessible dans ce scope (il l'est déjà — passé en paramètre à `createApp`).

---

## Fichiers Modifiés (Résumé)

| Fichier | Action | Effort |
|---------|--------|--------|
| `ui/src/hooks/useCurrentUser.ts` | Créer | Petit |
| `ui/src/components/CompanyRail.tsx` | Ajouter UserMenu | Moyen |
| `server/src/app.ts` | Enrichir get-session avec email/name | Petit |
| `ui/src/components/UserMenu.tsx` | Créer (ou inline dans CompanyRail) | Moyen |

---

## Edge Cases

1. **Sign-out pendant une requête en cours** : Le `queryClient.clear()` + hard redirect couvre ce cas — toute requête en vol sera ignorée après le redirect.

2. **Sign-out échoue (erreur réseau)** : L'état `isSigningOut` est reset à `false`, l'utilisateur peut réessayer. On pourrait ajouter un toast d'erreur mais c'est hors scope (1 SP).

3. **Session expire naturellement** : Le `CloudAccessGate` dans `App.tsx` gère déjà ce cas — si `getSession()` retourne `null`, il redirige vers `/auth`. Le bouton sign-out est pour l'invalidation **volontaire**.

4. **Multiple onglets** : Le hard redirect via `window.location.href = "/auth"` ne notifie pas les autres onglets. Les autres onglets continueront de fonctionner jusqu'à ce que leur cache TanStack refetch la session (qui sera 401). C'est acceptable pour une story S. L'amélioration cross-tab pourrait venir dans une future story via `BroadcastChannel`.

5. **Mode local_trusted** : Le composant `UserMenu` ne rend rien si `isAuthenticatedMode` est `false` (AC-6). Pas d'impact sur le mode dev solo.

6. **User sans nom et sans email** : L'initial fallback est `"?"`. Le display name fallback est `"User"`. Cas théorique avec Better Auth mais géré.

---

## Hors Scope

- Cross-tab sign-out synchronisation (BroadcastChannel)
- Confirmation modal avant sign-out ("Êtes-vous sûr ?")
- "Remember me" / session duration settings
- User profile / settings page
- Avatar upload
