# Brainstorm Implémentation Governed Workflows — Session 2026-04-20

**Statut :** **Abandonnée en cours** — on s'est perdus sur les questions de format (TS vs JSON) et d'exécution des gates. À reprendre dans une nouvelle session à tête reposée.

**Participants :** Tom, Claude (Opus 4.7 1M)

**Contexte d'entrée :**
- Design consolidé existant : `_bmad-output/governed-workflows-consolidated-2026-04-17.md`
- Objectif : décider comment implémenter le système de governed workflows progressivement, en testant au fur et à mesure, sans tout coder d'un coup.

---

## Pourquoi on a abandonné

Au fil de la conversation, l'architecture a changé plusieurs fois :
1. D'abord "runtime TS côté serveur avec gates en fonctions TS"
2. Puis "runtime TS côté client"
3. Puis "Claude Code = scheduler, serveur = data/tools (client-side compute pour les agents)"
4. Puis "pas de code TS sur le client, juste MCP"
5. Puis "workflows = data pure, format JSON"
6. Puis Tom a rappelé que **les gates doivent bien être EXÉCUTÉES côté serveur** — ce qui rouvre la question du format (si les gates sont du code custom TS, on a besoin de TS ; si elles sont déclaratives, JSON suffit).

Claude a glissé d'un modèle à l'autre sans recadrer clairement les justifications. Trop de décisions prises sur des prémisses qui bougeaient. Stop net pour repartir frais.

---

## Décisions qui tiennent (à confirmer en nouvelle session)

1. **Système de workflows MnM actuel** (`workflow_templates`, `workflow_instances`, XState) = **abandonné / prototype non utilisé**. On fait greenfield, pas de migration.

2. **Premier workflow de test = `hello-world` avec 2 steps + gates simples.** Trivial, pas de pression métier, pour valider les fondations.

3. **Agents s'exécutent côté user** (client-side compute). Cohérent avec CLAUDE.md : "Agent execution happens on the user's machine. The server is an API/data/orchestration layer."

4. **Pas d'agent-gate LLM-as-judge au début.** Les gates seront des vérifications déterministes (ex : "tu es bien passé par le workflow brainstorm avant deploy-app ?"). Les validations non-déterministes complexes se feront via des **steps complets** qui consomment les outputs précédents, pas via des gates LLM.

5. **Plugin Claude Code MnM = ultra-minimaliste** (pas de skills custom, pas d'agents embarqués, pas de workflows dans le plugin). Tout le contenu passe via MCP. Le plugin contient au maximum : config MCP + hook SessionStart.

6. **Création/édition des workflows via MCP uniquement pour MVP.** Pas d'UI web pour créer/éditer. L'UI viendra plus tard. Mais l'archi data (DB, persistence, versioning) doit être opérationnelle pour MVP.

7. **Versioning = Git externe** (GitLab CBA qui existe déjà en interne). Pas de bare repo local MnM. Réutilisation de l'infra existante (backup, perms, SSO).

8. **Interface `GitProvider` abstraite** avec impls : MVP = `GitlabProvider` + `LocalBareRepoProvider` (pour dev/tests sans réseau).

9. **Code existant à réutiliser** : `packages/shared/src/utils/git-provider.ts` (types GIT_PROVIDER_TYPES, `detectGitProvider`, `parseRepoUrl`). C'est juste de l'utilitaire, pas un provider qui commit/push, mais la base est là.

10. **Structure repos = 3 repos par company** : `mnm-<company>/workflows`, `mnm-<company>/agents`, `mnm-<company>/skills`. Permissions/CI/webhooks différents par type d'artefact.

11. **Token MnM central + commit author = user réel.** Token = simple (MnM écrit au nom d'un bot), author du commit = l'user qui a déclenché la modif (Tom Andrieu, Paul, etc.). Traçabilité via git log.

12. **Cache client `~/.mnm/cache/<company>/...`** owned par MnM, user ne touche jamais à la main. Conflits = "le serveur gagne toujours", pas de merge. *Mais : utilité exacte à reclarifier (voir points ouverts).*

13. **Hook SessionStart Claude Code** pour check updates + changelog + accept/refuse user.

14. **Multi-company dès le départ structurellement** (sous-dossier par company dans le path racine), mais MVP single-company fonctionnel (`companyId="default"` hardcodé).

15. **Push git direct (dev power user) + webhook MnM** = reporté après MVP.

16. **Claude Code = le scheduler DAG en mode server-pull, gate-driven.** Claude Code appelle MCP, reçoit l'état, décide le prochain step, l'exécute localement, notifie, recommence. Les verdicts des gates (pass/fail/retry/block/override) pilotent les décisions du harness.

17. **Gates = évaluées côté serveur** sur les artifacts reportés par le client. ← Tom a explicitement rappelé ce point en fin de session. Reste à trancher : gates = code custom TS sandboxé OU gates = identifiers déclaratifs.

---

## Points critiques à trancher en priorité (dans la nouvelle session)

### 1. Nature des gates (LE point qui bloque tout)

Deux interprétations de "gates exécutées côté serveur" :

- **A) Gates = identifiers déclaratifs.** Chaque gate est `{ type: "hasArtifact", config: {...} }`. La logique d'évaluation est du **code serveur MnM centralisé** (dans le package MnM), qui match les types et exécute la bonne fonction. Ajouter une nouvelle sorte de gate = PR sur MnM. Simple, safe, pas de sandbox.

- **B) Gates = fonctions TS custom par workflow.** Chaque workflow peut écrire ses propres gates en TS (genre `(artifacts) => artifacts.diff.size < 1000`). Le serveur MnM sandbox/eval ce code quand il évalue la gate. Plus flexible mais ajoute : sandbox Node VM, trust model, compile TS → runtime, gestion des erreurs d'exec.

→ **Le choix conditionne tout le reste** (format workflow TS vs JSON, rôle du package `@mnm/governed-workflows`, complexité du serveur).

### 2. Format des workflows (dépend de 1)

- Si **gates = déclaratives (A)** → **JSON pur + JSON Schema** est plus simple, safe, valide. Pas besoin de TS.
- Si **gates = TS custom (B)** → **TS est nécessaire** pour les fonctions gates, et le workflow peut rester TS pour cohérence.

### 3. Cache client `~/.mnm/cache/`

- Nécessaire si le client exécute du code local (workflows TS, gates TS côté client). 
- Inutile si client = juste un orchestrateur MCP qui reçoit tout inline dans les réponses.
- Peut-être utile pour les **agents** (promptsde sub-agents réutilisés) même si inutile pour les workflows.

### 4. Contenu exact du package `@mnm/governed-workflows`

- Si JSON : juste types TS + JSON Schema + validateur zod
- Si TS : + helpers `defineWorkflow()`, `step()`, `builtins.*` + potentiellement runtime exécution

### 5. Découpage des tranches

Dépend des points ci-dessus. Le découpage discuté pendant la session (A.1 / A.2 / A.3 / B / C) est à refondre après décision sur 1-2.

---

## Ce qui est hors scope MVP (acté)

- UI web pour créer/éditer workflows
- Push git direct par les devs + webhook post-receive
- Nightly Synthesis
- Orchestrator Agent conversationnel
- Agent-gate LLM-as-judge (reporté)
- CAO méta-juge des gates
- Sensei (brainstorm dédié)
- Access logs universels (brainstorm dédié)
- Composition / héritage entre workflows
- A/B testing de workflows
- Emergency bypass + dette automatique

---

## Prompt de reprise pour la nouvelle session

```
Salut, on reprend le brainstorm sur l'implémentation incrémentale des governed
workflows. Session précédente abandonnée car on s'est perdus sur des questions
de format et d'exécution.

Contexte à lire AVANT de commencer :

1. Design consolidé :
   _bmad-output/governed-workflows-consolidated-2026-04-17.md

2. Récap de la session abandonnée (décisions actées + points ouverts) :
   _bmad-output/brainstorming/implementation-governed-workflows-session-2026-04-20.md

Mon objectif : décider comment implémenter les workflows progressivement,
en testant au fur et à mesure, SANS tout coder d'un coup.

Le point le plus critique à trancher EN PREMIER est : la nature des gates.
Option A = identifiers déclaratifs (code d'évaluation centralisé côté serveur MnM).
Option B = fonctions TS custom par workflow (sandbox côté serveur).

Ça conditionne tout le reste (format workflow TS vs JSON, cache client, etc.).

Consignes :
- Pose-moi les questions UNE PAR UNE
- Ne saute pas sur une archi avant que j'aie validé les fondations
- Si tu changes d'avis sur une décision déjà actée, ARRÊTE-TOI et dis-le clairement
- Si ton modèle mental bouge, reclarifie avant de continuer (c'est ce qui nous a
  perdus la dernière fois)
- Relis le récap avant de partir dans une direction
```

---

## Notes pour Claude de la prochaine session

- Ne pas redécouvrir la roue sur les points 1-16 des "décisions actées" — les confirmer rapidement, pas re-brainstormer.
- Attaquer direct le point 1 (nature des gates) : Tom doit trancher A ou B.
- Rester honnête : si une justification change parce que l'archi change, **le dire explicitement** au lieu de glisser silencieusement.
- Le skill `superpowers:brainstorming` structure bien la session, mais ne pas laisser le flow guider la conversation sans valider les fondations.
