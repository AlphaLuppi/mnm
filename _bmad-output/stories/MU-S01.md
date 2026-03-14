# MU-S01 : API Invitations par Email — Spécification Détaillée

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Story ID** | MU-S01 |
| **Titre** | API Invitations par Email |
| **Epic** | Epic 3 — Multi-User & Auth |
| **Sprint** | Batch 3 — RLS + Auth |
| **Effort** | S (2 SP, 1-2j) |
| **Assignation** | Tom (backend) |
| **Bloqué par** | TECH-01 (PostgreSQL externe) |
| **Débloque** | MU-S02 (Page membres UI), MU-S03 (Invitation bulk CSV) |
| **Type** | Backend-only (API endpoints + email service + schema migration) |

---

## Description

MnM dispose déjà d'un mécanisme d'invitation basé sur des tokens courts (`pcp_invite_XXXXXXXX`, TTL 10 minutes) conçu pour l'onboarding d'agents OpenClaw. Cependant, **il n'y a pas de système d'invitation par email pour les humains** : pas d'envoi d'email, pas de `targetEmail` stocké dans la table `invites`, et le TTL de 10 minutes est inadapté pour un lien envoyé par email.

Cette story transforme le système d'invitation existant pour supporter les invitations email aux utilisateurs humains avec un lien signé à longue durée de vie (7 jours), un service d'envoi d'email abstrait (Resend en production, console log en développement), et une traçabilité complète via `activity_log`.

### Ce qui existe déjà

1. **Table `invites`** (`packages/db/src/schema/invites.ts`) :
   - Colonnes : `id`, `companyId`, `inviteType`, `tokenHash`, `allowedJoinTypes`, `defaultsPayload`, `expiresAt`, `invitedByUserId`, `revokedAt`, `acceptedAt`, `createdAt`, `updatedAt`
   - Index unique sur `tokenHash`
   - **Manque** : colonne `targetEmail` pour lier l'invitation à un email spécifique

2. **Route POST `/api/companies/:companyId/invites`** (`server/src/routes/access.ts` L1629-1671) :
   - Crée un invite avec `inviteType: "company_join"`, TTL 10 min
   - Vérifie la permission `users:invite`
   - Logue via `logActivity()` avec action `"invite.created"`
   - **Manque** : envoi email, TTL 7j, champ `email` dans le body

3. **Token generation** (`access.ts` L58-75) :
   - Prefix `pcp_invite_`, suffix 8 chars alphanumériques
   - SHA-256 hash stocké en DB
   - Retry loop pour collisions de hash
   - **Suffisant** pour emails : le token est opaque et le hash est unique

4. **Route POST `/api/invites/:token/accept`** (`access.ts` L1814-2199) :
   - Accepte un invite via token, crée un `join_request`
   - Gère `requestType: "human"` et `"agent"`
   - Vérifie expiration et revocation
   - **Existe déjà** mais le flow humain doit être enrichi

5. **Route POST `/api/invites/:inviteId/revoke`** (`access.ts` L2202-2238) :
   - Révoque une invitation existante
   - Logue l'activité
   - **Existe déjà**, aucune modification nécessaire

6. **Permission `users:invite`** (`packages/shared/src/constants.ts` L258) :
   - Déjà dans la liste des 15 permission keys
   - Vérifiée via `assertCompanyPermission(req, companyId, "users:invite")`

7. **Validators** (`packages/shared/src/validators/access.ts`) :
   - `createCompanyInviteSchema` : accepte `allowedJoinTypes`, `defaultsPayload`, `agentMessage`
   - `acceptInviteSchema` : accepte `requestType`, `agentName`, `adapterType`, etc.
   - **Manque** : champ `email` dans `createCompanyInviteSchema`

### Ce qui manque

1. **Colonne `targetEmail`** dans la table `invites` — pour lier l'invitation à un email spécifique
2. **Champ `email`** dans le validator `createCompanyInviteSchema` — pour recevoir l'email du destinataire
3. **TTL 7 jours** au lieu de 10 minutes pour les invitations par email
4. **Service d'envoi d'email** — abstraction avec implémentation Resend + fallback console
5. **Env vars** pour Resend (`RESEND_API_KEY`, `MNM_EMAIL_FROM`)
6. **Route GET `/api/invites/accept/:token`** — landing page pour le destinataire de l'email (redirect vers l'UI d'inscription)
7. **Endpoint GET `/api/companies/:companyId/invites`** — lister les invitations pending (pour MU-S02)

---

## État Actuel du Code (Analyse)

### Fichiers clés

| Fichier | Rôle | Lignes pertinentes |
|---------|------|-------------------|
| `packages/db/src/schema/invites.ts` | Schema table invites | Tout le fichier (29 lignes) |
| `server/src/routes/access.ts` | Routes invite CRUD + accept | L58-78 (token), L1558-1671 (create), L1719-1768 (get), L1814-2199 (accept), L2202-2238 (revoke) |
| `packages/shared/src/validators/access.ts` | Validators Zod invite | L23-29 (createCompanyInviteSchema), L39-51 (acceptInviteSchema) |
| `packages/shared/src/constants.ts` | Constants invite types | L244-248 (INVITE_TYPES, INVITE_JOIN_TYPES) |
| `server/src/services/activity-log.ts` | Service logActivity | Tout le fichier (46 lignes) |
| `server/src/services/index.ts` | Export services | Réexporte logActivity |
| `.env.example` | Env vars | Pas de section email |

### Constats

1. Le flow d'invitation existant est **orienté agent** (OpenClaw onboarding). Les tokens sont courts (8 chars) avec un TTL très court (10 min). Pour les emails humains, il faut un TTL de 7 jours.

2. La table `invites` n'a **pas de colonne `targetEmail`**. Les invitations actuelles sont des "liens à partager" (comme un invite Discord), pas des invitations nominatives. La story nécessite d'ajouter cette colonne pour la traçabilité et la déduplication.

3. Le mécanisme de hash SHA-256 et le retry loop sont **réutilisables tels quels**. On ne change pas le format du token, seulement le TTL.

4. L'endpoint `POST /api/companies/:companyId/invites` doit être **étendu** (pas remplacé) pour accepter un champ `email` optionnel. Quand `email` est fourni, le TTL passe à 7 jours et un email est envoyé.

5. Le service d'email doit être une **abstraction** car MnM tourne en local en développement (pas de Resend). Un fallback console log est indispensable.

---

## Acceptance Criteria

### AC-1 : Création d'invitation avec email
**Given** un Admin ou Manager avec la permission `users:invite`
**When** il envoie `POST /api/companies/:companyId/invites` avec `{ email: "alice@example.com", allowedJoinTypes: "human" }`
**Then** une invitation est créée dans la table `invites` avec :
  - `inviteType`: `"company_join"`
  - `tokenHash`: hash SHA-256 du token généré
  - `targetEmail`: `"alice@example.com"` (normalisé en lowercase, trimmed)
  - `expiresAt`: `now() + 7 jours`
  - `invitedByUserId`: l'ID de l'utilisateur qui invite
  - `allowedJoinTypes`: `"human"`
**And** la réponse est `201 Created` avec le token et l'invite URL

### AC-2 : Envoi d'email avec lien signé
**Given** une invitation créée avec un `email`
**When** la création est réussie
**Then** un email est envoyé au destinataire contenant :
  - Un lien d'invitation au format `{MNM_PUBLIC_URL}/invite/{token}`
  - Le nom de la company qui invite
  - Le nom de l'inviteur (si disponible)
**And** si `RESEND_API_KEY` n'est pas configuré, l'email est loggé en console (pas d'erreur)

### AC-3 : Lien d'invitation valide 7 jours
**Given** une invitation créée par email
**When** le destinataire clique le lien dans les 7 jours
**Then** le lien résout vers une page d'inscription fonctionnelle
**And** après 7 jours, le lien retourne 404

### AC-4 : Acceptation de l'invitation
**Given** un utilisateur non inscrit qui clique le lien d'invitation
**When** il s'inscrit via le formulaire d'inscription
**Then** il est automatiquement ajouté à la company avec le rôle `contributor`
**And** l'invitation est marquée `acceptedAt: now()`

### AC-5 : Déduplication par email
**Given** une invitation PENDING existe déjà pour `alice@example.com` dans la company X
**When** un Admin tente de créer une nouvelle invitation pour le même email dans la même company
**Then** l'API retourne `409 Conflict` avec un message explicatif
**And** l'ancienne invitation n'est pas modifiée

### AC-6 : Audit trail
**Given** une invitation est créée avec succès
**When** l'activité est loguée
**Then** un enregistrement `activity_log` est créé avec :
  - `action`: `"members.invite"`
  - `entityType`: `"invite"`
  - `entityId`: l'ID de l'invitation
  - `details`: `{ targetEmail, companyId, inviteType, expiresAt }`
  - `actorType`: `"user"`
  - `actorId`: l'ID de l'utilisateur qui invite

### AC-7 : Liste des invitations
**Given** un Admin ou Manager avec la permission `users:invite`
**When** il envoie `GET /api/companies/:companyId/invites`
**Then** il reçoit la liste des invitations avec leur statut (pending, accepted, revoked, expired)
**And** les invitations expirées sont marquées comme telles (calculé côté serveur)

### AC-8 : Invitation sans email (backward compatible)
**Given** un Admin qui crée une invitation sans fournir de champ `email`
**When** il envoie `POST /api/companies/:companyId/invites` avec `{ allowedJoinTypes: "agent" }`
**Then** le comportement est identique à l'existant (TTL 10 min, pas d'email envoyé)
**And** aucune régression sur le flow OpenClaw

### AC-9 : Validation email
**Given** un Admin qui fournit un email invalide
**When** il envoie `POST /api/companies/:companyId/invites` avec `{ email: "not-an-email" }`
**Then** l'API retourne `400 Bad Request` avec un message de validation Zod

---

## data-test-id

| Élément | data-testid | Description |
|---------|------------|-------------|
| Bouton "Inviter" (futur MU-S02 UI) | `mu-s01-invite-button` | Bouton qui déclenche la modale d'invitation |
| Champ email dans la modale | `mu-s01-invite-email-input` | Input email pour saisir l'adresse du destinataire |
| Sélecteur de rôle dans la modale | `mu-s01-invite-role-select` | Select pour choisir le rôle (futur MU-S02) |
| Bouton "Envoyer l'invitation" | `mu-s01-invite-submit-button` | Submit de la modale d'invitation |
| Ligne invitation dans la table | `mu-s01-invite-row-{inviteId}` | Chaque ligne de la liste des invitations |
| Badge statut invitation | `mu-s01-invite-status-{inviteId}` | Badge pending/accepted/revoked/expired |
| Lien d'invitation copié | `mu-s01-invite-link-{inviteId}` | Lien cliquable/copiable de l'invitation |
| Message succès d'envoi | `mu-s01-invite-success-toast` | Toast de confirmation après envoi |
| Message erreur doublon | `mu-s01-invite-duplicate-error` | Erreur affichée quand email déjà invité |

> **Note** : Les `data-testid` UI seront utilisés dans MU-S02 (Page membres). Cette story MU-S01 est backend-only mais les IDs sont définis ici pour que MU-S02 les implémente directement.

---

## Implémentation Technique

### T1 : Migration — Ajouter `targetEmail` à la table `invites`

**Fichier schema** : `packages/db/src/schema/invites.ts`

Ajouter la colonne `targetEmail` (nullable, car les invitations agent n'ont pas d'email cible) :

```typescript
targetEmail: text("target_email"),
```

Ajouter un index pour la déduplication (company + email + non-revoked + non-expired) :

```typescript
companyEmailPendingIdx: index("invites_company_email_pending_idx").on(
  table.companyId,
  table.targetEmail,
),
```

**Fichier migration** : `packages/db/src/migrations/XXXX_add_invite_target_email.sql`

```sql
ALTER TABLE invites ADD COLUMN target_email TEXT;
CREATE INDEX invites_company_email_pending_idx ON invites (company_id, target_email);
```

### T2 : Modifier le validator `createCompanyInviteSchema`

**Fichier** : `packages/shared/src/validators/access.ts`

Ajouter le champ `email` optionnel au schema existant :

```typescript
export const createCompanyInviteSchema = z.object({
  email: z.string().email().max(320).transform(v => v.toLowerCase().trim()).optional(),
  allowedJoinTypes: z.enum(INVITE_JOIN_TYPES).default("both"),
  defaultsPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  agentMessage: z.string().max(4000).optional().nullable(),
});
```

### T3 : Constantes TTL et action d'audit

**Fichier** : `server/src/routes/access.ts`

Ajouter une constante pour le TTL email (7 jours) distincte du TTL agent (10 minutes) :

```typescript
const EMAIL_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
```

Ajouter une function pour calculer l'expiration selon le type :

```typescript
function emailInviteExpiresAt(nowMs: number = Date.now()) {
  return new Date(nowMs + EMAIL_INVITE_TTL_MS);
}
```

### T4 : Service d'envoi d'email (abstraction)

**Fichier** : `server/src/services/email.ts` (nouveau)

Service avec interface abstraite et deux implémentations :

```typescript
export interface EmailService {
  sendInviteEmail(params: {
    to: string;
    inviteUrl: string;
    companyName: string;
    inviterName: string | null;
    expiresAt: Date;
  }): Promise<{ success: boolean; messageId?: string }>;
}

// Resend implementation (production)
class ResendEmailService implements EmailService {
  constructor(private apiKey: string, private fromAddress: string) {}

  async sendInviteEmail(params) {
    const { Resend } = await import("resend");
    const resend = new Resend(this.apiKey);
    const result = await resend.emails.send({
      from: this.fromAddress,
      to: params.to,
      subject: `Invitation to join ${params.companyName} on MnM`,
      html: buildInviteEmailHtml(params),
    });
    return { success: true, messageId: result.data?.id };
  }
}

// Console fallback (development)
class ConsoleEmailService implements EmailService {
  async sendInviteEmail(params) {
    logger.info("📧 [DEV EMAIL] Invite email would be sent:", {
      to: params.to,
      inviteUrl: params.inviteUrl,
      companyName: params.companyName,
    });
    return { success: true, messageId: `console-${Date.now()}` };
  }
}

// Factory
export function createEmailService(): EmailService {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MNM_EMAIL_FROM ?? "MnM <noreply@mnm.dev>";
  if (apiKey) {
    return new ResendEmailService(apiKey, from);
  }
  return new ConsoleEmailService();
}
```

### T5 : Modifier la route POST `/api/companies/:companyId/invites`

**Fichier** : `server/src/routes/access.ts`

Modifier la fonction `createCompanyInviteForCompany` pour :

1. Accepter un paramètre `email` optionnel
2. Si `email` est fourni : utiliser TTL 7 jours, stocker `targetEmail`, vérifier déduplication
3. Si `email` n'est pas fourni : comportement existant inchangé (TTL 10 min)
4. Après création, si `email` est fourni : envoyer l'email via `emailService`
5. Logger l'action `"members.invite"` (en plus de `"invite.created"` existant)

```typescript
async function createCompanyInviteForCompany(input: {
  req: Request;
  companyId: string;
  email?: string;           // NEW
  allowedJoinTypes: "human" | "agent" | "both";
  defaultsPayload?: Record<string, unknown> | null;
  agentMessage?: string | null;
}) {
  const isEmailInvite = Boolean(input.email);
  const normalizedEmail = input.email?.toLowerCase().trim() ?? null;

  // Deduplication check for email invites
  if (normalizedEmail) {
    const existing = await db
      .select({ id: invites.id })
      .from(invites)
      .where(
        and(
          eq(invites.companyId, input.companyId),
          eq(invites.targetEmail, normalizedEmail),
          isNull(invites.revokedAt),
          isNull(invites.acceptedAt),
          gt(invites.expiresAt, new Date())
        )
      )
      .then((rows) => rows[0] ?? null);
    if (existing) {
      throw conflict(`An active invitation already exists for ${normalizedEmail}`);
    }
  }

  const insertValues = {
    companyId: input.companyId,
    inviteType: "company_join" as const,
    allowedJoinTypes: isEmailInvite ? "human" : input.allowedJoinTypes,
    targetEmail: normalizedEmail,
    defaultsPayload: mergeInviteDefaults(
      input.defaultsPayload ?? null,
      input.agentMessage ?? null
    ),
    expiresAt: isEmailInvite
      ? emailInviteExpiresAt()
      : companyInviteExpiresAt(),
    invitedByUserId: input.req.actor.userId ?? null,
  };

  // ... existing token generation loop ...
}
```

Dans le handler de la route, après la création :

```typescript
// Send email if email invite
if (req.body.email && created) {
  const company = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .then((rows) => rows[0]);

  const inviterUser = req.actor.userId
    ? await db
        .select({ name: authUsers.name, email: authUsers.email })
        .from(authUsers)
        .where(eq(authUsers.id, req.actor.userId))
        .then((rows) => rows[0] ?? null)
    : null;

  const baseUrl = process.env.MNM_PUBLIC_URL || requestBaseUrl(req);
  await emailService.sendInviteEmail({
    to: req.body.email,
    inviteUrl: `${baseUrl}/invite/${token}`,
    companyName: company?.name ?? "MnM",
    inviterName: inviterUser?.name ?? inviterUser?.email ?? null,
    expiresAt: created.expiresAt,
  });
}

// Log with new action name for email invites
await logActivity(db, {
  companyId,
  actorType: req.actor.type === "agent" ? "agent" : "user",
  actorId: req.actor.type === "agent"
    ? req.actor.agentId ?? "unknown-agent"
    : req.actor.userId ?? "board",
  action: req.body.email ? "members.invite" : "invite.created",
  entityType: "invite",
  entityId: created.id,
  details: {
    targetEmail: req.body.email ?? null,
    inviteType: created.inviteType,
    allowedJoinTypes: created.allowedJoinTypes,
    expiresAt: created.expiresAt.toISOString(),
  },
});
```

### T6 : Route GET `/api/companies/:companyId/invites` (liste)

**Fichier** : `server/src/routes/access.ts`

Ajouter un endpoint pour lister les invitations d'une company :

```typescript
router.get(
  "/companies/:companyId/invites",
  async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertCompanyPermission(req, companyId, "users:invite");

    const rows = await db
      .select()
      .from(invites)
      .where(eq(invites.companyId, companyId))
      .orderBy(desc(invites.createdAt));

    const enriched = rows.map((invite) => ({
      ...invite,
      status: invite.revokedAt
        ? "revoked"
        : invite.acceptedAt
          ? "accepted"
          : invite.expiresAt.getTime() <= Date.now()
            ? "expired"
            : "pending",
    }));

    res.json(enriched);
  }
);
```

### T7 : Env vars

**Fichier** : `.env.example`

Ajouter une section email :

```bash
# --- Email (invitations) ------------------------------------------------
# Resend API key (optional — falls back to console logging in dev)
# RESEND_API_KEY=re_xxxxxxxxxxxx
# MNM_EMAIL_FROM=MnM <noreply@mnm.dev>
```

### T8 : Template HTML email

**Fichier** : `server/src/services/email.ts` (dans le même fichier)

Template HTML minimaliste et responsive pour l'email d'invitation :

```typescript
function buildInviteEmailHtml(params: {
  inviteUrl: string;
  companyName: string;
  inviterName: string | null;
  expiresAt: Date;
}): string {
  const inviterLine = params.inviterName
    ? `<p>${params.inviterName} vous invite à rejoindre <strong>${params.companyName}</strong> sur MnM.</p>`
    : `<p>Vous êtes invité(e) à rejoindre <strong>${params.companyName}</strong> sur MnM.</p>`;

  const expiresLine = `Ce lien expire le ${params.expiresAt.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}.`;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  ${inviterLine}
  <p>
    <a href="${params.inviteUrl}"
       style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
      Accepter l'invitation
    </a>
  </p>
  <p style="color:#6b7280;font-size:14px;">${expiresLine}</p>
  <p style="color:#9ca3af;font-size:12px;">Si vous n'avez pas demandé cette invitation, ignorez cet email.</p>
</body>
</html>`;
}
```

---

## Fichiers Modifiés (Résumé)

| Fichier | Action | Effort |
|---------|--------|--------|
| `packages/db/src/schema/invites.ts` | Ajouter colonne `targetEmail` + index | Petit |
| `packages/db/src/migrations/XXXX_add_invite_target_email.sql` | Migration SQL | Petit |
| `packages/shared/src/validators/access.ts` | Ajouter champ `email` au validator | Petit |
| `server/src/services/email.ts` | Créer service email (Resend + console fallback) | Moyen |
| `server/src/services/index.ts` | Exporter `emailService` | Petit |
| `server/src/routes/access.ts` | Modifier create, ajouter list, TTL 7j, dédup | Moyen |
| `.env.example` | Ajouter section email vars | Petit |

---

## Diagramme de Séquence

```
Admin                    API                         DB                    EmailService
  │                       │                          │                         │
  ├─POST /companies/:id/invites──►│                  │                         │
  │  { email, joinTypes } │                          │                         │
  │                       ├─check dedup──────────────►│                         │
  │                       │◄─no existing─────────────┤│                         │
  │                       ├─generate token            │                         │
  │                       ├─INSERT invites────────────►│                         │
  │                       │◄─created─────────────────┤│                         │
  │                       ├─SELECT company name───────►│                         │
  │                       ├─SELECT inviter info───────►│                         │
  │                       ├─sendInviteEmail────────────────────────────────────►│
  │                       │◄─success──────────────────────────────────────────┤│
  │                       ├─INSERT activity_log──────►│                         │
  │◄──201 { invite, token }│                          │                         │
  │                       │                          │                         │

Destinataire             API                         DB
  │                       │                          │
  ├─click email link──────►│                          │
  │  GET /invite/:token   │                          │
  │                       ├─resolve token hash───────►│
  │◄─redirect /auth?invite=token                      │
  │                       │                          │
  ├─POST /invites/:token/accept──►│                   │
  │  { requestType: "human" }     │                   │
  │                       ├─validate invite───────────►│
  │                       ├─mark acceptedAt───────────►│
  │                       ├─create join_request────────►│
  │                       ├─INSERT activity_log───────►│
  │◄──200 { joinRequest } │                           │
```

---

## Edge Cases

1. **Email déjà membre de la company** : La déduplication vérifie la table `invites`, pas `company_memberships`. L'invitation sera créée mais à l'acceptation, le flow existant gère le cas "already a member" via le `join_request` process. Pour V1, on ne bloque pas la création de l'invite dans ce cas. Amélioration future possible.

2. **Resend rate limiting** : Si Resend retourne une erreur 429, l'invitation est quand même créée en DB. L'email n'est pas envoyé mais l'admin peut copier le lien manuellement. L'erreur est loguée mais ne cause pas un 500 au client.

3. **Email bounce / invalid mailbox** : Resend gère les bounces en interne. L'API MnM ne vérifie pas la délivrabilité. L'invitation existe en DB avec le lien signé.

4. **Token collision** : Le retry loop existant (max 5 tentatives) gère ce cas. Probabilité extrêmement faible avec 8 chars alphanumériques + SHA-256.

5. **Invitation révoquée après envoi email** : Le lien dans l'email pointe vers l'endpoint `GET /api/invites/:token` qui vérifie `revokedAt`. Si révoqué, l'utilisateur verra une erreur 404.

6. **Multiple invitations à la même personne** : La déduplication ne bloque que s'il existe une invitation PENDING (non expired, non revoked, non accepted). Si l'ancienne a expiré, une nouvelle peut être créée.

7. **MNM_PUBLIC_URL non configuré** : L'URL de l'invitation est construite avec `requestBaseUrl(req)` en fallback (extrait de `x-forwarded-host` ou `req.host`). Le lien fonctionnera en local mais pourrait être incorrect derrière un reverse proxy mal configuré.

8. **`email` fourni avec `allowedJoinTypes: "agent"`** : Incohérent. Le validator force `allowedJoinTypes: "human"` quand `email` est fourni. Si l'utilisateur envoie explicitement `"agent"`, le serveur override à `"human"`.

---

## Hors Scope

- UI d'invitation (modale, formulaire) — MU-S02
- Import CSV bulk d'emails — MU-S03
- Personnalisation du template email (branding company)
- Tracking d'ouverture/clic email
- Webhooks Resend (bounce, complaint)
- Rate limiting sur le nombre d'invitations par company/jour
- Réenvoi d'invitation (resend same invite)
- Invitation avec rôle spécifique (toujours `contributor` par défaut, modifiable après par admin)

---

## Dépendances Techniques

| Dépendance | Statut | Impact |
|-----------|--------|--------|
| TECH-01 (PostgreSQL externe) | DONE | Table `invites` dans PostgreSQL |
| `resend` npm package | À installer (`pnpm add resend --filter server`) | Optionnel si `RESEND_API_KEY` non configuré |
| Better Auth (sign-up flow) | Existant | Le destinataire de l'invite utilise le flow sign-up standard |
| `invites` table schema | Existant + migration | Ajout colonne `targetEmail` |

---

## Checklist Dev

- [ ] Migration : ajouter `targetEmail` à `invites`
- [ ] Modifier `createCompanyInviteSchema` : ajouter champ `email`
- [ ] Constante `EMAIL_INVITE_TTL_MS` (7 jours)
- [ ] Service `email.ts` (Resend + console fallback)
- [ ] Déduplication email dans `createCompanyInviteForCompany`
- [ ] Envoi email après création
- [ ] Action audit `"members.invite"`
- [ ] Route `GET /api/companies/:companyId/invites`
- [ ] `.env.example` : `RESEND_API_KEY`, `MNM_EMAIL_FROM`
- [ ] Tests unitaires : service email, déduplication, TTL
- [ ] `pnpm typecheck` : aucune erreur
- [ ] Backward compatibility : invitations agent inchangées

## Checklist QA

- [ ] Test POST invite avec email → 201 + activité loguée
- [ ] Test POST invite sans email → comportement existant (TTL 10 min)
- [ ] Test déduplication → 409 si invitation pending pour même email
- [ ] Test email invalide → 400
- [ ] Test GET liste invites → retourne pending/accepted/revoked/expired
- [ ] Test accept invite → join_request créé, acceptedAt set
- [ ] Test invite expirée → 404
- [ ] Test sans permission `users:invite` → 403
- [ ] Test console fallback quand pas de RESEND_API_KEY
