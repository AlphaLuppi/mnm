# Recherche Technique Approfondie -- MnM IDE

**Date :** 2026-02-22
**Auteur :** Recherche technique senior
**Contexte :** Recherche pour la phase d'architecture de MnM -- IDE open-source de supervision d'agents IA

---

## Table des matieres

1. [Electron vs Tauri vs alternatives desktop](#1-electron-vs-tauri-vs-alternatives-desktop)
2. [Interception de l'activite de Claude Code en temps reel](#2-interception-de-lactivite-de-claude-code-en-temps-reel)
   - 2.1-2.5 : Strategies classiques (subprocess, MCP, file watching, historique)
   - 2.6 : Claude Agent SDK -- Analyse verifiee des capacites *(ajout 2026-02-28)*
   - 2.7 : Architecture interne d'Agent Teams -- Fichiers et protocoles *(ajout 2026-02-28)*
   - 2.8 : Architecture recommandee revisee : SDK spawn + file watching *(ajout 2026-02-28)*
3. [Parsing et visualisation de workflows BMAD](#3-parsing-et-visualisation-de-workflows-bmad)
4. [Drift detection entre documents](#4-drift-detection-entre-documents)
5. [Real-time file watching et Git integration](#5-real-time-file-watching-et-git-integration)
6. [Synthese et recommandations globales](#6-synthese-et-recommandations-globales) *(revisee 2026-02-28)*

---

## 1. Electron vs Tauri vs alternatives desktop

### 1.1 Contexte du choix

MnM necessite :
- Acces filesystem local complet (lecture/ecriture de fichiers de contexte, workflows, specs)
- Gestion de process systeme (spawn/monitor de Claude Code CLI, agents)
- Integration Git native (lecture de l'historique, diffs, branches)
- UI riche et reactive (layout 3 volets, timeline, graphes, drag & drop)
- L'equipe n'a jamais fait d'app desktop -- la courbe d'apprentissage est un facteur critique

### 1.2 Comparaison detaillee

| Critere | **Electron** | **Tauri** | **Flutter Desktop** | **Neutralinojs** |
|---------|-------------|-----------|---------------------|------------------|
| **Moteur de rendu** | Chromium embarque | WebView natif OS (WebKit sur macOS) | Moteur Skia propre | WebView natif OS |
| **Backend/runtime** | Node.js | Rust | Dart VM | C++ leger |
| **Taille bundle** | 150-300 MB | 5-15 MB | 30-80 MB | 2-5 MB |
| **RAM au repos** | 150-400 MB | 30-80 MB | 80-150 MB | 20-50 MB |
| **Acces filesystem** | Complet (Node.js fs) | Complet (Rust + API Tauri) | Complet (dart:io) | Limite (API restreinte) |
| **Process management** | Complet (child_process) | Complet (Command API Rust) | Limite | Tres limite |
| **Ecosysteme npm** | Total (c'est Node.js) | Partiel (frontend only) | Aucun (Dart packages) | Partiel |
| **Ecosysteme UI** | React, Vue, Svelte, etc. | React, Vue, Svelte, etc. | Widgets Flutter | React, Vue, Svelte, etc. |
| **Maturite** | Tres haute (depuis 2013) | Haute (v2 stable, 2024) | Moyenne (desktop beta-ish) | Basse |
| **Courbe d'apprentissage web dev** | Tres faible | Moyenne (Rust requis pour le backend) | Haute (nouveau langage/framework) | Faible |
| **Hot reload / DX** | Excellent | Bon | Excellent | Correct |
| **Cross-platform** | Windows, macOS, Linux | Windows, macOS, Linux | Windows, macOS, Linux | Windows, macOS, Linux |
| **Securite** | Faible (acces Node complet depuis le renderer) | Haute (sandboxing strict, permissions declaratives) | Moyenne | Haute |
| **Support natif menus/tray/notifications** | Mature | Mature (v2) | Limite | Basique |
| **Auto-update** | electron-updater (mature) | Tauri updater (integre) | Manuel | Manuel |

### 1.3 Analyse approfondie des candidats principaux

#### Electron

**Forces pour MnM :**
- L'ecosysteme est colossal. VS Code, Cursor, Zed (avant migration native), Slack, Discord, Figma Desktop, Postman -- tous construits sur Electron.
- L'acces complet a Node.js signifie que `child_process.spawn()` pour lancer Claude Code CLI, `fs` pour le file watching, `simple-git` pour Git -- tout est immediatement disponible avec des librairies NPM matures.
- L'equipe peut utiliser 100% de ses competences web existantes (React/TypeScript).
- La documentation et les patterns pour construire un IDE-like sont abondants (VS Code est open source et sert de reference).
- Le debugging est trivial (Chrome DevTools integre).

**Faiblesses :**
- La taille du bundle (150-300 MB) et la consommation RAM (150-400 MB) sont significatives. Cependant, pour un IDE qui tourne en permanence sur un poste de developpeur, c'est acceptable -- VS Code consomme 400-800 MB en usage normal.
- La securite du modele "renderer a acces Node" est un risque theorique, mais pour un outil interne ce n'est pas un souci majeur.
- La performance de rendu peut souffrir avec des UI tres complexes (milliers de nodes dans un graphe). Les solutions existent (virtualisation, Canvas/WebGL).

**Apps similaires construites avec Electron :**
- **VS Code** -- l'IDE de reference, preuve que le framework tient pour des apps de cette complexite
- **Cursor** -- IDE IA, concurrent direct en termes de categorie
- **Atom** (discontinue) -- IDE, abandon lie a la competition avec VS Code, pas a Electron
- **Slack, Discord** -- apps de communication complexes avec multi-volets
- **Postman** -- app de dev avec UI riche
- **n8n Desktop** -- editeur de workflows visuel (tres pertinent pour MnM)

#### Tauri

**Forces pour MnM :**
- Bundle 10-20x plus leger qu'Electron. Demarrage plus rapide.
- Consommation RAM 3-5x inferieure.
- Le modele de securite est superieur avec un systeme de permissions declaratives.
- Tauri v2 (stable depuis 2024) a significativement ameliore l'API : `Command` pour executer des process systeme, API filesystem complete, support des plugins (barcode, biometrics, clipboard, dialog, fs, global-shortcut, notification, shell, etc.).
- Le frontend reste 100% web (React, Vue, Svelte) -- l'equipe peut utiliser ses competences existantes pour le frontend.

**Faiblesses :**
- Le backend est en Rust. Pour une equipe qui n'a jamais ecrit de Rust, c'est un obstacle significatif. Chaque interaction entre le frontend JS et le backend systeme necessite d'ecrire du code Rust (commandes Tauri).
- L'ecosysteme de plugins est moins riche qu'Electron/Node.js. Il n'y a pas d'equivalent direct a `simple-git` ou `chokidar` -- il faut soit utiliser des crates Rust, soit reimplementer.
- Le WebView natif (WebKit sur macOS) a des differences subtiles de rendu avec Chromium. Certaines API CSS ou JS recentes peuvent ne pas etre disponibles.
- Le debugging est plus complexe : le frontend se debug normalement, mais le backend Rust necessite un tooling separe (lldb, logs).
- La communaute et la documentation pour des cas d'usage complexes (IDE-like) sont significativement moins fournies qu'Electron.

**Apps similaires construites avec Tauri :**
- **Cody** (Sourcegraph) -- assistant de code
- **Padloc** -- gestionnaire de mots de passe
- **Pake** -- wrapper d'apps web en desktop
- Pas d'IDE complet ni d'editeur de workflow majeur construit avec Tauri a ce jour

#### Flutter Desktop

**Non recommande pour MnM.** L'equipe devrait apprendre Dart, un nouveau framework (Flutter), et le desktop support reste moins mature que les alternatives web-based. L'ecosysteme de librairies pour la visualisation de graphes, l'edition de workflows, et l'integration Git est beaucoup plus restreint qu'en JavaScript/TypeScript.

#### Neutralinojs

**Non recommande pour MnM.** L'API d'acces systeme est trop limitee pour les besoins de process management et de filesystem avances de MnM.

### 1.4 Analyse specifique aux besoins MnM

| Besoin MnM | Electron | Tauri |
|------------|----------|-------|
| **Spawn et monitor Claude Code CLI** | `child_process.spawn()` -- trivial, bien documente | `Command::new()` en Rust -- fonctionne mais necessite du code Rust |
| **File watching temps reel** | `chokidar` (NPM) -- standard mature | `notify` (crate Rust) -- mature mais code Rust requis |
| **Git integration** | `simple-git` ou `isomorphic-git` (NPM) -- riche | `git2` (crate Rust, binding libgit2) -- puissant mais API Rust |
| **UI 3 volets + drag & drop** | React + librairies JS -- ecosysteme riche | React + librairies JS -- identique (frontend web) |
| **Visualisation de graphes** | React Flow, d3.js -- directement utilisable | React Flow, d3.js -- directement utilisable |
| **Timeline d'activite** | Librairies JS existantes | Librairies JS existantes |
| **Performance sur gros projets** | Suffisante avec optimisations | Meilleure (RAM/CPU) |
| **Temps de dev** | Plus court (tout en JS/TS) | Plus long (JS + Rust) |
| **Maintenance long terme** | Plus facile (un seul langage) | Plus complexe (deux langages) |

### 1.5 Recommandation : Electron

**Electron est le choix recommande pour le MVP de MnM**, pour les raisons suivantes :

1. **Courbe d'apprentissage minimale.** L'equipe n'a jamais fait d'app desktop. Electron permet de rester dans l'ecosysteme web (React + TypeScript + Node.js) sans apprendre Rust. Chaque heure passee a debugger du Rust est une heure perdue sur les features core de MnM.

2. **Acces systeme immediat.** Les trois besoins systeme critiques de MnM (process management, file watching, Git) ont des solutions NPM matures et bien documentees (`child_process`, `chokidar`, `simple-git`). Avec Tauri, il faudrait ecrire ces integrations en Rust.

3. **Precedent prouve.** VS Code demontre qu'Electron est capable de porter un IDE complet avec des performances acceptables. n8n demontre qu'un editeur de workflows visuel fonctionne bien sur Electron.

4. **Ecosysteme de librairies.** React Flow (editeur de workflows), xterm.js (terminal embeddable), Monaco Editor (si besoin d'inspection de code) -- tout est disponible en NPM et pensee pour l'ecosysteme Electron.

5. **Pragmatisme MVP.** La taille du bundle et la consommation RAM sont des defauts reels mais acceptables pour un outil interne utilise par 3 developpeurs sur des machines de dev. L'optimisation peut venir plus tard ; la vitesse de livraison est plus critique maintenant.

**Migration future possible.** Si les performances deviennent un probleme, une migration vers Tauri v3+ est envisageable a terme. Le frontend (React) serait reutilisable ; seul le backend Node.js devrait etre reecrit en Rust. Cette migration sera plus facile si le code est bien separe (pattern IPC clair entre renderer et main process).

**Stack recommandee :**
- **Runtime :** Electron (derniere version stable)
- **Frontend :** React 19 + TypeScript
- **State management :** Zustand (leger, performant) ou Jotai
- **Styling :** Tailwind CSS
- **Build :** Vite (rapide, bon support Electron via `electron-vite`)
- **Packaging :** electron-builder ou electron-forge
- **IPC :** Architecture claire main process / renderer avec contextBridge

---

## 2. Interception de l'activite de Claude Code en temps reel

### 2.1 Comment Claude Code fonctionne techniquement

Claude Code est un CLI (Command Line Interface) installe globalement via NPM (`npm install -g @anthropic-ai/claude-code`). Son architecture est la suivante :

#### Architecture interne

```
Utilisateur (terminal)
    |
    v
Claude Code CLI (Node.js)
    |
    |-- Lecture du CLAUDE.md (contexte projet)
    |-- Lecture des fichiers du projet (via outils internes)
    |-- Appels API Anthropic (streaming via SSE)
    |-- Execution d'outils :
    |     |-- Read (lecture de fichiers)
    |     |-- Edit (modification de fichiers)
    |     |-- Write (creation de fichiers)
    |     |-- Bash (execution de commandes shell)
    |     |-- Glob (recherche de fichiers par pattern)
    |     |-- Grep (recherche dans le contenu)
    |     |-- Git (operations git)
    |     |-- NotebookEdit (edition de notebooks Jupyter)
    |
    v
Sortie terminal (stdout/stderr, TUI interactive)
```

#### Points d'acces techniques

1. **Process systeme** : Claude Code est un process Node.js lance avec la commande `claude`. Il utilise stdin/stdout/stderr.
2. **API Anthropic** : Les requetes passent par l'API Anthropic Messages (streaming). L'authentification est geree par une cle API locale.
3. **Fichiers locaux** : Claude Code lit et ecrit directement sur le filesystem. Chaque appel d'outil (Read, Edit, Write, Bash) est une operation sur le filesystem ou le shell local.
4. **Mode non-interactif** : Claude Code supporte un mode `--print` (ou `-p`) qui execute une commande et affiche le resultat sans interface interactive.

### 2.2 Strategies d'interception

Il existe plusieurs approches pour intercepter et monitorer l'activite de Claude Code en temps reel.

#### Strategie A : Subprocess wrapping (recommandee pour le MVP)

MnM lance Claude Code comme un child process et capture ses flux :

```typescript
import { spawn } from 'child_process';

const claude = spawn('claude', ['--print', taskDescription], {
  cwd: projectRoot,
  env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
  stdio: ['pipe', 'pipe', 'pipe']
});

// Capture stdout en temps reel
claude.stdout.on('data', (data: Buffer) => {
  const output = data.toString();
  parseClaudeOutput(output); // Analyse l'activite
});

// Capture stderr
claude.stderr.on('data', (data: Buffer) => {
  const error = data.toString();
  handleError(error);
});

// Detecte la fin
claude.on('close', (code: number) => {
  handleCompletion(code);
});
```

**Avantages :**
- Simple a implementer
- Pas de modification de Claude Code
- Fonctionne avec n'importe quelle version

**Limites :**
- La sortie de Claude Code en mode interactif est une TUI (Text User Interface) avec des codes ANSI, difficile a parser
- Le mode `--print` est plus facile a capturer mais perd l'interactivite
- La granularite des informations depend du format de sortie

#### Strategie B : Mode MCP (Model Context Protocol) -- approche recommandee a moyen terme

Claude Code supporte le MCP (Model Context Protocol), qui permet de definir des serveurs de contexte externes. MnM pourrait implementer un serveur MCP qui :
- Recoit les notifications d'outils utilises par Claude Code
- Fournit du contexte supplementaire a Claude Code
- Intercepte les operations fichier

```typescript
// Serveur MCP pour MnM
const mcpServer = {
  tools: {
    // Intercepter les lectures de fichiers
    'mnm_file_read': async (params: { path: string }) => {
      notifyMnM('file_read', params.path);
      return fs.readFile(params.path, 'utf-8');
    },
    // Intercepter les ecritures
    'mnm_file_write': async (params: { path: string, content: string }) => {
      notifyMnM('file_write', params.path);
      fs.writeFileSync(params.path, params.content);
      return { success: true };
    }
  }
};
```

**Avantages :**
- Integration native avec le protocole Claude
- Acces structure aux operations
- Bidirectionnel (MnM peut aussi fournir du contexte a Claude Code)

**Limites :**
- Necessite que Claude Code soit configure pour utiliser le serveur MCP de MnM
- Le protocole MCP evolue rapidement, necessitant une maintenance

#### Strategie C : File system watching (complementaire)

Independamment de l'interception du process, MnM peut surveiller le filesystem pour detecter les modifications faites par Claude Code :

```typescript
import chokidar from 'chokidar';

const watcher = chokidar.watch(projectRoot, {
  ignored: /(^|[\/\\])\../, // ignorer dotfiles
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 100,
    pollInterval: 50
  }
});

watcher.on('change', (filePath) => {
  // Un fichier a ete modifie -- est-ce par Claude Code ?
  detectAgentOrigin(filePath);
  updateTimeline('file_modified', filePath);
});

watcher.on('add', (filePath) => {
  updateTimeline('file_created', filePath);
});
```

**Avantages :**
- Independant du CLI utilise (fonctionne avec n'importe quel agent)
- Aucune modification de l'agent requise
- Detecte les changements quel que soit le mecanisme

**Limites :**
- Ne sait pas QUI a fait le changement (agent vs humain)
- Pas d'acces a l'intention ou au raisonnement de l'agent

#### Strategie D : Analyse du fichier de conversation Claude Code

Claude Code stocke l'historique de ses conversations dans des fichiers locaux (generalement dans `~/.claude/` ou le dossier du projet `.claude/`). MnM peut analyser ces fichiers pour :
- Reconstituer l'historique des operations
- Identifier les outils utilises et les fichiers touches
- Extraire le raisonnement de l'agent

### 2.3 Comment savoir quels fichiers Claude Code lit/modifie en temps reel

La strategie recommandee est un **systeme en couches** :

| Couche | Mecanisme | Ce qu'on detecte | Latence |
|--------|-----------|-------------------|---------|
| **1. File watching** | chokidar / fs.watch | Fichiers modifies/crees/supprimes | < 100ms |
| **2. Stdout parsing** | Child process capture | Operations en cours, raisonnement | Temps reel |
| **3. Git diff** | Polling git status | Changements accumules | 1-5s (polling) |
| **4. Historique Claude** | Lecture fichiers .claude/ | Operations passees, contexte | Post-hoc |

**Pipeline recommande pour le MVP :**

1. MnM lance Claude Code via `spawn()` avec capture stdout/stderr
2. En parallele, `chokidar` surveille le projet pour les modifications fichier
3. Le parsing de stdout extrait les noms d'outils utilises (Read, Edit, Write, Bash, Glob, Grep)
4. Les modifications fichier sont cross-referencees avec le process actif pour l'attribution
5. Tout est agrege dans la timeline d'activite

### 2.4 Patterns pour wrapper un CLI agent

#### Pattern "Agent Harness"

Un pattern architectural eprouve pour wrapper des agents CLI :

```typescript
interface AgentHarness {
  // Lifecycle
  start(task: string, context: AgentContext): AgentSession;
  stop(session: AgentSession): void;

  // Monitoring
  onToolUse(callback: (tool: string, params: any) => void): void;
  onFileChange(callback: (path: string, type: 'read' | 'write' | 'delete') => void): void;
  onOutput(callback: (text: string) => void): void;
  onError(callback: (error: Error) => void): void;
  onComplete(callback: (result: AgentResult) => void): void;

  // Control
  sendInput(text: string): void;
  pause(): void;
  resume(): void;

  // Introspection
  getActiveFiles(): string[];
  getTokenUsage(): TokenMetrics;
  getStatus(): AgentStatus; // 'idle' | 'thinking' | 'executing' | 'waiting' | 'error'
}
```

Ce pattern a ete utilise avec succes dans des projets comme :
- **SWE-bench** (wrapper pour agents de code dans des benchmarks)
- **OpenHands** (anciennement OpenDevin, orchestre des agents via des sandboxes)
- **Aider** (expose des hooks pour integration avec des editeurs)

#### Pattern "Event Bus" pour la communication interne

```typescript
// Tous les evenements de l'agent passent par un bus central
type AgentEvent =
  | { type: 'tool_start'; tool: string; params: Record<string, any> }
  | { type: 'tool_end'; tool: string; result: any }
  | { type: 'file_read'; path: string }
  | { type: 'file_write'; path: string; diff: string }
  | { type: 'thinking'; content: string }
  | { type: 'output'; content: string }
  | { type: 'error'; message: string }
  | { type: 'status_change'; from: AgentStatus; to: AgentStatus }
  | { type: 'token_update'; input: number; output: number };

class AgentEventBus {
  private listeners: Map<string, Function[]> = new Map();

  emit(event: AgentEvent): void { /* ... */ }
  on(type: string, callback: Function): void { /* ... */ }
  off(type: string, callback: Function): void { /* ... */ }
}
```

### 2.5 Recommandation pour MnM

**Phase MVP :**
1. Utiliser le **subprocess wrapping** (Strategie A) pour lancer Claude Code en mode `--print` ou via le SDK Node.js si disponible
2. Combiner avec le **file watching** (Strategie C) via chokidar pour la detection de modifications
3. Implementer un **AgentHarness** basique qui normalise les evenements

**Phase post-MVP :**
1. Implementer un **serveur MCP** (Strategie B) pour une integration plus profonde
2. Ajouter l'analyse de l'historique Claude (Strategie D) pour la reconstitution de sessions
3. Generaliser le AgentHarness pour supporter d'autres agents (OpenHands, Aider, etc.)

### 2.6 Claude Agent SDK -- Analyse verifiee des capacites (mis a jour 2026-02-28)

> **IMPORTANT** : Cette section corrige et complete la section 2.5 suite a une verification approfondie du SDK reel.

#### Architecture du SDK

Le `@anthropic-ai/claude-agent-sdk` n'est **PAS** une API standalone. C'est un **wrapper TypeScript autour du binaire Claude Code CLI**. Le SDK :
- Localise le binaire `claude` installe globalement
- Le lance en mode subprocess avec des flags specifiques (`--output-format stream-json`)
- Parse le flux JSON structure en sortie
- Expose une API TypeScript propre (`query()`)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const conversation = query({
  prompt: "Cree un composant React Button",
  options: {
    // CRITIQUE : sans settingSources, aucune feature Claude Code n'est activee
    settingSources: ['project', 'user'],
    // CRITIQUE : sans systemPrompt preset, pas de tools Claude Code
    systemPrompt: { type: 'preset', preset: 'claude_code' },
    // Permissions
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    // Limites
    maxTurns: 100,
    // Variables d'environnement pour features experimentales
    env: {
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"
    }
  }
});

// Le SDK retourne un AsyncIterable de messages
for await (const message of conversation) {
  if (message.type === "assistant") {
    console.log(message.content);
  }
}
```

#### Tableau des features verifiees

| Feature Claude Code | Support SDK | Methode d'acces | Notes |
|---------------------|-------------|-----------------|-------|
| **Sub-agents (Agent tool)** | OUI | Natif via query() | L'agent peut spawner des sub-agents automatiquement |
| **Skills / Slash commands** | OUI | Via settingSources | Charge les skills depuis CLAUDE.md et project settings |
| **Commandes BMAD** | OUI | Via settingSources | Les skills BMAD sont chargees comme n'importe quelle skill |
| **CLAUDE.md** | OUI | Via settingSources: ['project'] | Charge automatiquement les instructions projet |
| **MCP servers** | OUI | Via settingSources | Configuration MCP lue depuis les settings |
| **Hooks (PreToolUse, PostToolUse...)** | OUI | Via settingSources | 18 types d'evenements, hooks executes automatiquement |
| **Plugins** | OUI | Via settingSources: ['user'] | Extensions utilisateur chargees |
| **Custom agents** | OUI | Via settingSources | Agents personnalises definis dans les settings |
| **Permissions / Rules** | OUI | Via permissionMode | Controle total des permissions |
| **Session resume** | OUI | Via sessionId option | Reprendre une conversation existante |
| **File checkpointing** | OUI | Automatique | Points de restauration fichier actifs |
| **Plan mode** | OUI | Via prompt | L'agent peut entrer/sortir du plan mode |
| **Rules (.claude/rules/)** | OUI | Via settingSources | Regles projet chargees automatiquement |
| **Agent Teams** | PARTIEL | Via env variable + prompt | Pas d'API directe pour l'orchestration de teams |
| **Auto-Memory** | PARTIEL | Via settingSources | Lecture passive ok, ecriture memoire non garantie |
| **Worktrees** | PARTIEL | Via hooks | Hooks uniquement, pas d'API directe |
| **Task management** | PARTIEL | Observable via fichiers | Pas de controle direct des tasks via SDK |

**Conclusion SDK** : Le SDK est suffisant pour **lancer** des agents avec toutes les features Claude Code. La limitation principale est l'**observation** : le SDK ne fournit pas de callbacks pour les evenements internes des agents. C'est la que le **file watching** devient essentiel.

### 2.7 Architecture interne d'Agent Teams -- Fichiers et protocoles (decouverte 2026-02-28)

> **Decouverte majeure** : Agent Teams ecrit TOUT son etat sur le disque en temps reel. Cette propriete rend possible la supervision externe sans modifier Claude Code.

#### Structure des fichiers Agent Teams

```
~/.claude/
  teams/
    {team-name}/
      config.json           # Configuration de l'equipe (membres, roles)
      inboxes/
        {agent-name}.json   # Boite aux lettres de chaque agent (messages JSON)
  tasks/
    {team-name}/
      1.json                # Tache individuelle (JSON)
      2.json
      3.json
      .lock                 # Verrou flock() pour exclusion mutuelle
      .highwatermark        # Prochain ID de tache
  projects/
    {project-path-hash}/
      sessions/
        {session-id}.jsonl  # Transcription par agent (append-only JSONL)
```

#### Schema des fichiers

**config.json** (equipe) :
```json
{
  "members": [
    {
      "name": "team-lead",
      "agentId": "abc-123-def",
      "agentType": "leader"
    },
    {
      "name": "frontend-dev",
      "agentId": "ghi-456-jkl",
      "agentType": "worker"
    },
    {
      "name": "backend-dev",
      "agentId": "mno-789-pqr",
      "agentType": "worker"
    }
  ]
}
```

**inboxes/{agent-name}.json** (messages) :
```json
[
  {
    "from": "team-lead",
    "text": "{\"type\":\"task_assignment\",\"taskId\":\"1\",\"subject\":\"Creer le composant Button\"}",
    "timestamp": "2026-02-28T10:30:00.000Z",
    "read": false
  },
  {
    "from": "backend-dev",
    "text": "{\"type\":\"message\",\"content\":\"L'API /users est prete\"}",
    "timestamp": "2026-02-28T10:35:00.000Z",
    "read": true
  }
]
```

**Types de messages dans les inboxes :**

| Type | Direction | Description |
|------|-----------|-------------|
| `task_assignment` | Leader -> Worker | Attribution d'une tache avec taskId |
| `message` | Any -> Any | Communication libre entre agents |
| `broadcast` | Leader -> All | Message diffuse a toute l'equipe |
| `shutdown_request` | Leader -> Worker | Demande d'arret d'un agent |
| `idle_notification` | Worker -> Leader | L'agent n'a plus de travail |
| `plan_approval_request` | Worker -> Leader | Demande de validation d'un plan |
| `plan_approval_response` | Leader -> Worker | Reponse a la demande de plan |

**tasks/{team-name}/{id}.json** (tache individuelle) :
```json
{
  "id": "3",
  "subject": "Implementer le composant UserProfile",
  "description": "Creer un composant React affichant les infos utilisateur...",
  "owner": "frontend-dev",
  "status": "in_progress",
  "blocks": ["4"],
  "blockedBy": ["1"],
  "createdAt": "2026-02-28T10:30:00.000Z",
  "updatedAt": "2026-02-28T11:15:00.000Z"
}
```

**sessions/{session-id}.jsonl** (transcription agent) :

Chaque ligne est un objet JSON complet avec chaining via uuid/parentUuid :
```jsonl
{"uuid":"a1b2c3","parentUuid":null,"type":"human","message":{"role":"user","content":"Implemente le Button"},"timestamp":"..."}
{"uuid":"d4e5f6","parentUuid":"a1b2c3","type":"assistant","message":{"role":"assistant","content":"Je vais creer..."},"timestamp":"..."}
{"uuid":"g7h8i9","parentUuid":"d4e5f6","type":"tool_use","tool":"Write","input":{"file_path":"src/Button.tsx"},"timestamp":"..."}
```

#### Mecanismes de synchronisation

- **Verrous fichier** : `flock()` sur `.lock` pour les ecritures concurrentes de taches
- **High watermark** : `.highwatermark` contient le prochain ID de tache disponible
- **Append-only** : Les fichiers JSONL de session sont append-only (pas de modification)
- **JSON atomique** : Les fichiers de taches et d'inbox sont reecrits entierement a chaque modification

### 2.8 Architecture recommandee revisee : SDK spawn + file watching (2026-02-28)

> Suite aux decouvertes sur Agent Teams, l'architecture d'interception est fondamentalement revisee.

#### Le pattern "SDK spawn + file watching"

L'ancienne recommandation (subprocess wrapping + stdout parsing) est remplacee par une approche plus robuste :

```
MnM IDE (Electron)
│
├─ [SPAWN] Claude Agent SDK query()
│    │
│    ├─ Agent 1 (team-lead)     ──┐
│    ├─ Agent 2 (frontend-dev)  ──┤── Ecrivent en temps reel
│    └─ Agent 3 (backend-dev)   ──┘   dans ~/.claude/
│
├─ [WATCH] chokidar sur ~/.claude/
│    │
│    ├─ teams/{name}/config.json    → Composition equipe
│    ├─ teams/{name}/inboxes/*.json → Messages inter-agents
│    ├─ tasks/{name}/*.json         → Creation/MAJ taches
│    └─ projects/*/sessions/*.jsonl → Transcriptions temps reel
│
├─ [WATCH] chokidar sur {project}/
│    │
│    ├─ src/**/*                    → Fichiers modifies par agents
│    └─ .claude/settings.local.json → Config projet
│
├─ [EVENT BUS] Zustand store
│    │
│    ├─ TeamState      → Membres, statuts, roles
│    ├─ MessageState   → Messages inter-agents temps reel
│    ├─ TaskState      → Taches, dependencies, progres
│    ├─ SessionState   → Transcriptions, outils utilises
│    └─ FileState      → Fichiers modifies, diffs
│
└─ [UI] React components
     │
     ├─ AgentPanel     → Vue par agent (statut, activite)
     ├─ Timeline       → Chronologie des evenements
     ├─ TaskBoard      → Kanban des taches
     ├─ MessageFeed    → Flux de messages inter-agents
     └─ FileExplorer   → Fichiers touches avec attribution
```

#### Avantages vs l'ancienne approche

| Critere | Ancien (subprocess wrapping) | Nouveau (SDK + file watching) |
|---------|------------------------------|-------------------------------|
| **Multi-agents** | 1 process a la fois | N agents simultanes |
| **Messages inter-agents** | Invisible | Visible via inboxes JSON |
| **Taches** | Non observable | Observable via tasks JSON |
| **Transcriptions** | Stdout brut, difficile a parser | JSONL structure, facile a parser |
| **Robustesse** | Depend du format stdout | Depend de fichiers JSON stables |
| **Intrusivite** | Doit wrapper le process | Zero modification de Claude Code |

#### Implementation du watcher core

```typescript
import chokidar from 'chokidar';
import { readFile } from 'fs/promises';
import path from 'path';

interface MnMWatcherConfig {
  claudeDir: string;      // ~/.claude
  projectDir: string;     // Repertoire du projet
  teamName: string;       // Nom de l'equipe
}

class ClaudeTeamWatcher {
  private watchers: chokidar.FSWatcher[] = [];

  constructor(private config: MnMWatcherConfig) {}

  start() {
    // 1. Watcher inboxes (messages inter-agents)
    const inboxPattern = path.join(
      this.config.claudeDir, 'teams', this.config.teamName, 'inboxes', '*.json'
    );
    this.watchers.push(
      chokidar.watch(inboxPattern, { awaitWriteFinish: { stabilityThreshold: 100 } })
        .on('change', (filePath) => this.onInboxChange(filePath))
    );

    // 2. Watcher tasks (taches)
    const tasksPattern = path.join(
      this.config.claudeDir, 'tasks', this.config.teamName, '*.json'
    );
    this.watchers.push(
      chokidar.watch(tasksPattern, { awaitWriteFinish: { stabilityThreshold: 100 } })
        .on('change', (filePath) => this.onTaskChange(filePath))
        .on('add', (filePath) => this.onTaskCreated(filePath))
    );

    // 3. Watcher sessions (transcriptions)
    const sessionsPattern = path.join(
      this.config.claudeDir, 'projects', '**', 'sessions', '*.jsonl'
    );
    this.watchers.push(
      chokidar.watch(sessionsPattern, { awaitWriteFinish: { stabilityThreshold: 50 } })
        .on('change', (filePath) => this.onSessionUpdate(filePath))
    );

    // 4. Watcher fichiers projet (modifications par agents)
    this.watchers.push(
      chokidar.watch(this.config.projectDir, {
        ignored: [/(^|[\/\\])\./, '**/node_modules/**'],
        awaitWriteFinish: { stabilityThreshold: 200 }
      })
        .on('change', (filePath) => this.onProjectFileChange(filePath))
        .on('add', (filePath) => this.onProjectFileCreated(filePath))
    );
  }

  private async onInboxChange(filePath: string) {
    const agentName = path.basename(filePath, '.json');
    const messages = JSON.parse(await readFile(filePath, 'utf-8'));
    const unread = messages.filter((m: any) => !m.read);
    // Emettre vers le store Zustand
    eventBus.emit({ type: 'inbox_update', agent: agentName, messages: unread });
  }

  private async onTaskChange(filePath: string) {
    const task = JSON.parse(await readFile(filePath, 'utf-8'));
    eventBus.emit({ type: 'task_update', task });
  }

  private async onTaskCreated(filePath: string) {
    const task = JSON.parse(await readFile(filePath, 'utf-8'));
    eventBus.emit({ type: 'task_created', task });
  }

  private async onSessionUpdate(filePath: string) {
    // Lire uniquement les nouvelles lignes (tail -f style)
    const lastLine = await getLastLine(filePath);
    const entry = JSON.parse(lastLine);
    eventBus.emit({ type: 'session_entry', sessionFile: filePath, entry });
  }

  private onProjectFileChange(filePath: string) {
    eventBus.emit({ type: 'file_changed', path: filePath });
  }

  private onProjectFileCreated(filePath: string) {
    eventBus.emit({ type: 'file_created', path: filePath });
  }

  stop() {
    this.watchers.forEach(w => w.close());
  }
}
```

#### Projets existants validant cette approche

| Projet | Technique | Pertinence MnM |
|--------|-----------|-----------------|
| **c9watch** | Watch ~/.claude/ + dashboard web | Preuve directe que le file watching fonctionne |
| **claude-code-hooks-multi-agent-observability** | Hooks + file watching combinés | Pattern hooks complementaire |
| **claude_code_agent_farm** | Spawn SDK + monitoring | Validation du pattern SDK spawn |
| **claude-code-teams-mcp** | MCP server pour teams | Integration MCP complementaire |
| **clog** | Parse sessions JSONL | Validation du parsing de transcriptions |

---

## 3. Parsing et visualisation de workflows BMAD

### 3.1 Structure des workflows BMAD

L'analyse du repository montre que les workflows BMAD utilisent un format dual :

**1. Fichier de metadonnees (`workflow.yaml`) :**
```yaml
name: dev-story
description: "Execute a story by implementing tasks/subtasks..."
author: "BMad"
config_source: "{project-root}/_bmad/bmm/config.yaml"
installed_path: "{project-root}/_bmad/bmm/workflows/4-implementation/dev-story"
instructions: "{installed_path}/instructions.xml"
validation: "{installed_path}/checklist.md"
# Variables configurables
story_file: ""
sprint_status: "{implementation_artifacts}/sprint-status.yaml"
```

**2. Fichier d'instructions (`instructions.xml`) :**
```xml
<workflow>
  <critical>Contraintes globales...</critical>
  <step n="1" goal="Find next ready story" tag="sprint-status">
    <check if="condition">
      <action>Action a executer</action>
      <goto anchor="task_check" />
    </check>
    <output>Message a afficher</output>
    <ask>Question a poser</ask>
  </step>
  <step n="2" goal="Next step" tag="development">
    ...
  </step>
</workflow>
```

### 3.2 Parsing des workflows

#### Parsing YAML

Pour parser les fichiers `workflow.yaml`, la librairie standard est :

| Librairie | Langage | Points forts | Notes |
|-----------|---------|-------------|-------|
| **js-yaml** | JavaScript | Standard de facto, rapide, bien maintenue | Recommande pour MnM |
| **yaml** (npm) | JavaScript | Support YAML 1.2 complet, preservation des commentaires | Alternative si besoin de preservation de commentaires |
| **gray-matter** | JavaScript | Parse le frontmatter YAML dans les fichiers Markdown | Utile pour les documents BMAD avec frontmatter |

```typescript
import yaml from 'js-yaml';
import fs from 'fs';

interface BMADWorkflow {
  name: string;
  description: string;
  author: string;
  config_source: string;
  installed_path: string;
  instructions: string;
  validation: string;
  [key: string]: any; // Variables dynamiques
}

function parseWorkflowYaml(filePath: string): BMADWorkflow {
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content) as BMADWorkflow;
}
```

#### Parsing XML

Pour parser les fichiers `instructions.xml` (la structure de graphe du workflow) :

| Librairie | Points forts | Notes |
|-----------|-------------|-------|
| **fast-xml-parser** | Tres rapide, bien maintenue, bonne API | Recommande |
| **xml2js** | Classique, callbacks/promises | Plus ancienne mais stable |
| **cheerio** | API jQuery-like, flexible | Bien pour du parsing ad-hoc |
| **DOMParser** (natif navigateur) | Zero dependance cote frontend | Limite cote Node |

```typescript
import { XMLParser } from 'fast-xml-parser';

interface WorkflowStep {
  id: number;
  goal: string;
  tag?: string;
  checks: WorkflowCheck[];
  actions: string[];
  outputs: string[];
  asks: string[];
  gotos: { anchor: string }[];
}

interface WorkflowGraph {
  criticals: string[];
  steps: WorkflowStep[];
  edges: { from: number; to: number; condition?: string }[];
}

function parseWorkflowXml(xmlContent: string): WorkflowGraph {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true
  });

  const parsed = parser.parse(xmlContent);
  // Transformer en graphe de steps interconnectes
  return buildGraph(parsed.workflow);
}
```

#### Transformation en graphe

La structure XML des workflows BMAD se prete naturellement a une representation en graphe :
- Chaque `<step>` devient un **node**
- Chaque `<goto>` cree un **edge** vers l'ancre cible
- Chaque `<check>` cree une **branche conditionnelle** (edge avec condition)
- La sequence lineaire des steps (n=1, n=2, ...) cree des edges implicites

```typescript
interface WorkflowNode {
  id: string;            // "step-1", "step-2", etc.
  type: 'step' | 'decision' | 'action' | 'output' | 'halt';
  label: string;         // Le goal du step
  tag?: string;          // Tag fonctionnel
  data: {
    actions: string[];
    criticals: string[];
    outputs: string[];
    asks: string[];
  };
  position: { x: number; y: number }; // Pour le layout
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;        // Condition de la branche
  type: 'sequence' | 'conditional' | 'goto';
}
```

### 3.3 Librairies de visualisation de workflows

| Librairie | Type | Points forts | Points faibles | Pertinence MnM |
|-----------|------|-------------|----------------|-----------------|
| **React Flow** | React, nodes + edges | API declarative React, bien maintenue, extensible, community active | Necessite React | **Tres haute** |
| **dagre** | Layout algorithmique | Excellent pour l'auto-layout de DAGs, utilise par React Flow | Pas de rendu, juste du positionnement | Haute (complement) |
| **elkjs** | Layout algorithmique | Layout hierarchique tres avance, port Java->JS | Plus complexe que dagre | Moyenne |
| **d3.js** | Bas niveau, SVG/Canvas | Puissance maximale, personnalisation totale | Beaucoup de code a ecrire | Basse (trop bas niveau) |
| **JointJS / Rappid** | Canvas, nodes + edges | Tres complet, pro | Licence commerciale pour les features avancees | Moyenne |
| **vis.js Network** | Canvas, graphes | Simple, leger | Moins de features d'edition | Basse |
| **Mermaid** | Declaratif (texte -> diagramme) | Zero code, beau rendu | Pas interactif, pas editable | Basse (rendu only) |
| **Cytoscape.js** | Canvas, graphes | Excellent pour les graphes complexes | API moins React-friendly | Basse |

#### React Flow : le choix recommande

React Flow est la librairie la plus adaptee pour l'editeur de workflows de MnM. Raisons :

1. **React-native** : S'integre directement dans l'architecture React de MnM
2. **Nodes personnalisables** : Chaque type de step BMAD peut avoir son propre composant visuel
3. **Edges intelligents** : Support des edges conditionnels, labels, animations
4. **Drag & drop** : Support natif du deplacement de nodes
5. **Mini-map** : Composant integre pour la vue d'ensemble
6. **Controls** : Zoom, fit-to-view, lock integres
7. **Performance** : Virtualisation native, supporte des centaines de nodes
8. **Communaute** : Tres active, bien documentee, exemples abondants

```typescript
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap
} from 'reactflow';

// Nodes personnalises pour BMAD
const nodeTypes = {
  bmadStep: BMADStepNode,        // Step normal avec goal + actions
  bmadDecision: BMADDecisionNode, // Check conditionnel
  bmadHalt: BMADHaltNode,        // Point d'arret
  bmadOutput: BMADOutputNode     // Output/Ask a l'utilisateur
};

function WorkflowEditor({ workflow }: { workflow: WorkflowGraph }) {
  const nodes: Node[] = workflow.steps.map(step => ({
    id: step.id,
    type: 'bmadStep',
    data: step,
    position: calculatePosition(step) // dagre pour le layout auto
  }));

  const edges: Edge[] = workflow.edges.map(edge => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.condition,
    animated: edge.type === 'goto'
  }));

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

### 3.4 Patterns de synchronisation visuel <-> fichier source

Pour MnM, la synchronisation entre la representation visuelle du workflow et le fichier source (YAML + XML) est critique. Voici les patterns applicables :

#### Pattern 1 : Source of Truth = Fichier (recommande pour le MVP)

```
Fichier YAML/XML  -->  Parse  -->  Modele en memoire  -->  React Flow (rendu)
       ^                                  |
       |                                  |
       +---- Serialize <-- Modification --+
```

- Le fichier est toujours la source de verite
- Chaque modification dans l'editeur visuel declenche une serialisation vers le fichier
- Le fichier est relu et re-parse pour confirmer la synchronisation
- **Avantage** : Coherence garantie, compatible avec Git
- **Inconvenient** : Latence de serialisation/deserialisation

#### Pattern 2 : Modele intermediaire (recommande post-MVP)

```
Fichier YAML/XML  <-->  Modele intermediaire  <-->  React Flow
                              |
                              v
                         Validation
```

- Un modele TypeScript intermediaire sert de source de verite en memoire
- Le fichier est lu au chargement et ecrit au save
- Les modifications visuelles mettent a jour le modele, qui notifie React Flow
- **Avantage** : Performance (pas de re-parsing constant)
- **Inconvenient** : Risque de desynchronisation modele/fichier

#### Pattern 3 : CRDT pour sync bidirectionnelle (long terme)

Pour la synchronisation bidirectionnelle chat <-> builder (post-MVP) :
- Utiliser un CRDT (Conflict-free Replicated Data Type) comme Yjs ou Automerge
- Le modele du workflow est un document CRDT
- Le chat et le builder envoient des operations sur le meme document
- Pas de conflit possible

**Librairies CRDT :**
| Librairie | Points forts |
|-----------|-------------|
| **Yjs** | Mature, performante, integrations React |
| **Automerge** | API plus simple, bonne documentation |
| **Liveblocks** | Service manage, facile a integrer |

### 3.5 Recommandation pour le workflow editor MnM

**Stack recommandee :**
- **Parsing YAML :** js-yaml
- **Parsing XML :** fast-xml-parser
- **Visualisation :** React Flow + dagre (auto-layout)
- **Sync modele/fichier :** Pattern 1 (Source of Truth = Fichier) pour le MVP
- **Nodes personnalises :** Composants React pour chaque type BMAD (step, decision, halt, output)

---

## 4. Drift detection entre documents

### 4.1 Le probleme a resoudre

MnM doit detecter les incoherences entre les niveaux de la hierarchie documentaire :

```
Product Brief (vision)
    |
    v
PRD (details fonctionnels)
    |
    v
Architecture Spec (choix techniques)
    |
    v
Stories (unites de travail)
    |
    v
Code (implementation)
```

Types de drift identifies (cf. brainstorm Tom) :
- Terminologie inconsistante ("SSE" vs "websocket")
- Comportement divergent ("notification push" vs "polling")
- Scope creep silencieux (story ajoute une feature non prevue)
- Contradiction architecturale ("monorepo" vs "micro-services")

### 4.2 Techniques de detection

#### Approche A : Comparaison basee sur embeddings

**Principe :** Transformer chaque section de document en vecteur (embedding), puis comparer la similarite cosinus entre sections correspondantes.

```
Document A (Product Brief)     Document B (Story)
    |                               |
    v                               v
Chunking (par section)         Chunking (par section)
    |                               |
    v                               v
Embeddings (vecteurs)          Embeddings (vecteurs)
    |                               |
    +-------> Similarite cosinus <--+
                    |
                    v
            Score de coherence
```

**Librairies et modeles d'embedding :**

| Solution | Type | Performance | Cout | Notes |
|----------|------|------------|------|-------|
| **all-MiniLM-L6-v2** | Local (Sentence Transformers) | Rapide, 80MB | Gratuit | Bon pour du matching semantique general |
| **nomic-embed-text** | Local (Ollama) | Rapide, ~300MB | Gratuit | Bonne qualite, facile a deployer |
| **text-embedding-3-small** | API OpenAI | Tres rapide | ~$0.02/1M tokens | Excellent rapport qualite/prix |
| **text-embedding-3-large** | API OpenAI | Tres rapide | ~$0.13/1M tokens | Meilleure qualite |
| **voyage-3** | API Voyage AI | Rapide | ~$0.06/1M tokens | Specialise code + docs techniques |
| **Cohere embed-v3** | API Cohere | Rapide | Variable | Bon pour le multilingual (FR) |

**Limites des embeddings pour le drift :**
- Les embeddings capturent la similarite semantique globale mais manquent de precision sur les contradictions specifiques
- "Utiliser SSE" et "Utiliser websocket" peuvent avoir des embeddings tres proches (les deux parlent de communication temps reel)
- Utile comme filtre de pre-selection mais insuffisant seul pour la detection fine

#### Approche B : LLM-as-judge (recommandee)

**Principe :** Utiliser un LLM pour comparer directement deux sections de documents et detecter les incoherences.

```typescript
async function detectDrift(
  parentDoc: string,
  childDoc: string,
  parentType: 'product-brief' | 'prd' | 'architecture',
  childType: 'prd' | 'architecture' | 'story' | 'code'
): Promise<DriftReport> {
  const prompt = `
Tu es un auditeur technique. Compare ces deux documents et identifie
les incoherences, contradictions ou divergences.

DOCUMENT PARENT (${parentType}) -- SOURCE DE VERITE :
${parentDoc}

DOCUMENT ENFANT (${childType}) :
${childDoc}

Pour chaque incoherence trouvee, donne :
1. Le concept concerne
2. Ce que dit le document parent
3. Ce que dit le document enfant
4. La severite (critique / warning / info)
5. Une suggestion de resolution

Reponds en JSON structure.
  `;

  const response = await llm.complete(prompt);
  return parseDriftReport(response);
}
```

**Avantages :**
- Detecte les contradictions fines (SSE vs websocket)
- Comprend le contexte et les implications
- Peut distinguer les synonymes legitimes des vrais drifts
- Peut evaluer la severite

**Inconvenients :**
- Cout en tokens (chaque comparaison consomme des tokens)
- Latence (1-5 secondes par comparaison)
- Non-deterministe (deux analyses du meme drift peuvent donner des resultats legerement differents)

#### Approche C : Extraction de concepts + comparaison structuree

**Principe :** Extraire les concepts-cles de chaque document, puis comparer les graphes de concepts.

```
Document  -->  Extraction de concepts (LLM)  -->  Graphe de concepts
                                                       |
                                                       v
                                              Comparaison structuree
                                              (matching de concepts)
```

**Etape 1 : Extraction de concepts**

```typescript
interface Concept {
  name: string;           // ex: "communication-temps-reel"
  value: string;          // ex: "SSE (Server-Sent Events)"
  category: string;       // ex: "architecture", "fonctionnel", "ux"
  source_line: number;    // Pour le lien vers le document
  confidence: number;     // Score de confiance de l'extraction
}

async function extractConcepts(document: string): Promise<Concept[]> {
  const prompt = `
Extrais tous les concepts techniques et fonctionnels de ce document.
Pour chaque concept, donne :
- name: identifiant normalise
- value: la valeur/decision choisie
- category: architecture | fonctionnel | ux | donnees | securite
Reponds en JSON.

Document:
${document}
  `;

  return await llm.complete(prompt);
}
```

**Etape 2 : Comparaison des graphes de concepts**

```typescript
interface DriftItem {
  concept: string;
  parentValue: string;
  childValue: string;
  severity: 'critical' | 'warning' | 'info';
  parentLine: number;
  childLine: number;
}

function compareConcepts(
  parentConcepts: Concept[],
  childConcepts: Concept[]
): DriftItem[] {
  const drifts: DriftItem[] = [];

  for (const child of childConcepts) {
    const parent = parentConcepts.find(p => p.name === child.name);
    if (parent && parent.value !== child.value) {
      drifts.push({
        concept: child.name,
        parentValue: parent.value,
        childValue: child.value,
        severity: classifySeverity(child.category),
        parentLine: parent.source_line,
        childLine: child.source_line
      });
    }
  }

  return drifts;
}
```

**Avantages :**
- Structure les informations de maniere reutilisable
- Le graphe de concepts peut etre visualise dans MnM
- Les comparaisons structurees sont rapides et deterministes (seule l'extraction est non-deterministe)
- Le graphe peut etre cache et mis a jour incrementalement

**Inconvenients :**
- L'extraction depend de la qualite du LLM
- La normalisation des noms de concepts peut etre imparfaite

### 4.3 Comparaison des approches

| Critere | Embeddings | LLM-as-judge | Extraction de concepts |
|---------|-----------|--------------|----------------------|
| **Precision** | Moyenne (filtre grossier) | Haute | Haute |
| **Recall** | Haute (peu de faux negatifs) | Moyenne | Moyenne |
| **Cout** | Faible (local possible) | Eleve ($0.01-0.05 par comparaison) | Moyen (extraction initiale couteuse, comparaisons gratuites) |
| **Latence** | < 100ms (local) | 1-5s | Extraction 2-5s, comparaison < 100ms |
| **Determinisme** | Oui | Non | Extraction non, comparaison oui |
| **Richesse du resultat** | Score numerique | Explication en langage naturel | Structure + matchable |
| **Cache-able** | Oui (embeddings) | Non | Oui (concepts) |

### 4.4 Architecture recommandee : hybride en 3 couches

```
Modification detectee (file watcher)
        |
        v
[Couche 1] Pre-filtre par embeddings (local, rapide)
        |
        | Seuls les documents avec similarite < seuil passent
        v
[Couche 2] Extraction de concepts (LLM, cache-able)
        |
        | Concepts mis a jour incrementalement
        v
[Couche 3] Comparaison structuree + LLM-as-judge si ambiguite
        |
        v
Rapport de drift --> Timeline MnM
```

**Couche 1 (filtre rapide) :**
- Utiliser `nomic-embed-text` via Ollama (local, gratuit)
- Calculer les embeddings de chaque section de chaque document
- Si une section change et que la similarite avec le document parent baisse significativement -> drapeau
- Cout : 0, latence : < 100ms

**Couche 2 (extraction structuree) :**
- Utiliser Claude (API Anthropic) pour extraire les concepts
- Cacher les concepts par document + hash du contenu
- Recalculer uniquement quand le document change
- Comparer les structures de concepts (deterministe, rapide)
- Cout : faible (extraction uniquement au changement), latence : 2-5s au changement, 0 apres

**Couche 3 (arbitrage) :**
- Quand la comparaison structuree detecte un drift potentiel mais ambigu
- Envoyer le contexte au LLM pour confirmer et qualifier
- Generer l'alerte actionnable (comme decrit dans le brainstorm de Tom)
- Cout : faible (uniquement pour les cas ambigus), latence : 2-5s

### 4.5 Outils et librairies existants

| Outil | Type | Usage pour MnM |
|-------|------|----------------|
| **LangChain.js** | Framework LLM | Orchestration des appels LLM, chaining de prompts |
| **Ollama** | Runtime LLM local | Heberger des modeles d'embedding et petits LLM localement |
| **ChromaDB / Qdrant** | Base vectorielle | Stocker les embeddings de documents |
| **tiktoken** | Tokenizer | Estimer les couts avant envoi au LLM |
| **marked / remark** | Parser Markdown | Decomposer les documents en sections pour le chunking |
| **unified / mdast** | AST Markdown | Parser structurel de Markdown, extraction de sections |
| **Vercel AI SDK** | Framework IA | Appels LLM structures avec streaming |

### 4.6 Estimation des couts

Pour un projet typique BMAD avec 5-10 documents (Product Brief, PRD, Architecture, 3-5 Epics) :

| Operation | Frequence | Tokens estimes | Cout API Claude |
|-----------|-----------|---------------|-----------------|
| Extraction initiale de concepts | 1x au setup | ~50K tokens | ~$0.75 |
| Re-extraction apres modification | ~5x/jour | ~10K tokens/op | ~$0.75/jour |
| LLM-as-judge (cas ambigus) | ~2x/jour | ~5K tokens/op | ~$0.15/jour |
| **Total quotidien** | | | **~$1/jour** |

En utilisant un modele local (Ollama + Mistral/Llama) pour les couches 1 et 2, le cout peut etre ramene a ~$0.15/jour (uniquement couche 3 via API).

### 4.7 Recommandation pour MnM

**MVP :** Commencer par l'approche LLM-as-judge pure (Approche B). C'est la plus simple a implementer et la plus precise. Le cout est acceptable pour 3 utilisateurs.

**Post-MVP :** Migrer vers l'architecture hybride en 3 couches pour reduire les couts et la latence. Ajouter le pre-filtre par embeddings et le cache de concepts.

---

## 5. Real-time file watching et Git integration

### 5.1 File watching sur macOS

#### Mecanismes disponibles

| Mecanisme | Niveau | Latence | Fiabilite | Notes |
|-----------|--------|---------|-----------|-------|
| **FSEvents** | Kernel macOS | < 100ms | Tres haute | API native macOS, la plus performante |
| **kqueue** | Kernel BSD | < 50ms | Haute | Plus bas niveau, plus complexe |
| **fs.watch** (Node.js) | Natif Node | Variable | Moyenne | Utilise FSEvents sur macOS, mais API limitee |
| **fs.watchFile** (Node.js) | Polling | 1-5s | Haute | Polling stat(), lent mais fiable |

#### Librairies recommandees

##### chokidar

**La reference pour le file watching en Node.js.**

```typescript
import chokidar from 'chokidar';

const watcher = chokidar.watch('/path/to/project', {
  // Configuration recommandee pour MnM
  ignored: [
    /(^|[\/\\])\../,           // Fichiers caches
    '**/node_modules/**',       // Dependencies
    '**/.git/objects/**',       // Git objects (beaucoup de churn)
    '**/*.pyc',                 // Bytecode
  ],
  persistent: true,
  ignoreInitial: true,         // Ne pas emettre pour les fichiers existants
  awaitWriteFinish: {
    stabilityThreshold: 200,   // Attendre 200ms de stabilite
    pollInterval: 50
  },
  usePolling: false,           // Utiliser FSEvents (natif macOS)
  atomic: true,                // Gerer les ecritures atomiques (rename)
  followSymlinks: false
});

// Evenements
watcher.on('add', (path) => console.log(`File added: ${path}`));
watcher.on('change', (path) => console.log(`File changed: ${path}`));
watcher.on('unlink', (path) => console.log(`File removed: ${path}`));
watcher.on('addDir', (path) => console.log(`Dir added: ${path}`));
watcher.on('unlinkDir', (path) => console.log(`Dir removed: ${path}`));
```

**Points forts :**
- Utilise FSEvents sur macOS (performance maximale)
- Gere le debouncing et la stabilisation des ecritures
- API evenementielle propre
- Tres bien maintenue (utilisee par webpack, Vite, etc.)
- Supporte les glob patterns

**Considerations de performance :**
- Sur un projet avec 10 000 fichiers : < 5MB RAM, latence < 100ms
- Eviter de surveiller `node_modules` et `.git/objects` (beaucoup de fichiers)
- Le mode `awaitWriteFinish` est critique pour eviter les faux evenements lors d'ecritures incrementales

##### @parcel/watcher (alternative)

```typescript
import { subscribe } from '@parcel/watcher';

const subscription = await subscribe('/path/to/project', (err, events) => {
  for (const event of events) {
    console.log(event.type, event.path);
    // event.type: 'create' | 'update' | 'delete'
  }
});

// Pour arreter
await subscription.unsubscribe();
```

**Points forts :**
- Binding natif C++ utilisant FSEvents directement
- Plus performant que chokidar pour les tres gros projets
- API plus simple (batch d'evenements)

**Points faibles :**
- Moins de features haut niveau (pas de glob patterns, pas de debouncing integre)
- Moins populaire que chokidar

##### nsfw (Node Sentinel File Watcher)

Alternative performante mais moins maintenue. Non recommandee pour un nouveau projet.

#### Recommandation pour le file watching

**chokidar** est le choix recommande pour MnM. C'est la librairie standard, la plus documentee, et elle offre toutes les features necessaires (debouncing, filtering, atomic writes). Si des problemes de performance apparaissent sur de tres gros projets, migrer vers `@parcel/watcher` est simple.

### 5.2 Git integration programmatique

#### Librairies comparees

| Librairie | Type | Points forts | Points faibles | NPM downloads/semaine |
|-----------|------|-------------|----------------|----------------------|
| **simple-git** | Wrapper CLI git | API complete, bien maintenue, TypeScript | Necessite git installe | ~1.5M |
| **isomorphic-git** | Pure JavaScript | Pas de dependance a git, fonctionne dans le browser | API plus complexe, certaines operations lentes | ~400K |
| **nodegit** (libgit2) | Binding C libgit2 | Tres performant, acces bas niveau | Installation difficile (compilation C), maintenance incertaine | ~30K |
| **dugite** | Git embarque | Git binaire embarque, utilise par GitHub Desktop | Binding specifique GitHub | ~15K |

#### simple-git (recommande)

```typescript
import simpleGit, { SimpleGit, StatusResult, DiffResult } from 'simple-git';

class GitIntegration {
  private git: SimpleGit;

  constructor(projectRoot: string) {
    this.git = simpleGit(projectRoot);
  }

  // Status des fichiers (modifies, staged, untracked)
  async getStatus(): Promise<StatusResult> {
    return this.git.status();
  }

  // Diff d'un fichier specifique
  async getFileDiff(filePath: string): Promise<string> {
    return this.git.diff(['--', filePath]);
  }

  // Diff entre deux commits
  async getDiffBetween(from: string, to: string): Promise<string> {
    return this.git.diff([from, to]);
  }

  // Historique d'un fichier
  async getFileHistory(filePath: string, maxCount: number = 20) {
    return this.git.log({
      file: filePath,
      maxCount
    });
  }

  // Contenu d'un fichier a un commit donne (versioning de contexte)
  async getFileAtCommit(filePath: string, commitHash: string): Promise<string> {
    return this.git.show([`${commitHash}:${filePath}`]);
  }

  // Branches
  async getBranches() {
    return this.git.branch();
  }

  // Log recent
  async getRecentCommits(count: number = 50) {
    return this.git.log({ maxCount: count });
  }

  // Fichiers modifies dans un commit
  async getCommitFiles(commitHash: string) {
    return this.git.show([
      commitHash,
      '--name-status',
      '--pretty=format:'
    ]);
  }
}
```

**Pourquoi simple-git plutot qu'isomorphic-git :**

1. **Prerequis rempli** : MnM cible des developpeurs qui ont forcement Git installe (c'est un prerequis du Product Brief)
2. **Performance** : simple-git utilise le binaire git natif, qui est hautement optimise. isomorphic-git reimplemente Git en JavaScript, ce qui est plus lent pour les operations sur de gros repos.
3. **API complete** : simple-git expose toutes les commandes git via une API TypeScript propre. isomorphic-git a une couverture incomplete de certaines commandes avancees.
4. **Maintenance** : simple-git est activement maintenue avec une bonne couverture TypeScript.

**Cas d'usage isomorphic-git :** Si MnM devait un jour tourner dans un navigateur (web app), isomorphic-git serait necessaire. Pour le MVP desktop, simple-git est superieur.

### 5.3 Detection des changements par les agents en temps reel

#### Architecture recommandee

```
                    +-----------------+
                    |  Agent Process  |
                    |  (Claude Code)  |
                    +---------+-------+
                              |
                              | stdout/stderr
                              v
+------------------+  +-------------------+
| File Watcher     |  | Process Monitor   |
| (chokidar)       |  | (stdout parsing)  |
+--------+---------+  +--------+----------+
         |                     |
         v                     v
+---------------------------------------------+
|           Event Correlator                   |
|                                              |
|  file_change + active_agent -> attributed    |
|  file_change + no_agent   -> human_change    |
+---------------------------------------------+
         |
         v
+------------------+
| Timeline Store   |
| (Zustand/Redux)  |
+------------------+
         |
         v
+------------------+
| React UI         |
| (Timeline view)  |
+------------------+
```

#### Event Correlator : attribuer les changements

Le defi principal est d'attribuer un changement fichier a l'agent qui l'a fait. Strategies :

```typescript
interface FileEvent {
  path: string;
  type: 'create' | 'modify' | 'delete';
  timestamp: number;
  size?: number;
}

interface AgentEvent {
  agentId: string;
  tool: string;     // 'Write', 'Edit', 'Bash'
  target?: string;   // Fichier cible si connu
  timestamp: number;
}

class EventCorrelator {
  private recentAgentEvents: AgentEvent[] = [];
  private correlationWindowMs = 2000; // 2 secondes

  // Appele par le stdout parser quand l'agent utilise un outil
  recordAgentEvent(event: AgentEvent): void {
    this.recentAgentEvents.push(event);
    // Nettoyage des anciens evenements
    this.cleanOldEvents();
  }

  // Appele par chokidar quand un fichier change
  correlateFileChange(fileEvent: FileEvent): AttributedChange {
    const matchingAgent = this.recentAgentEvents.find(ae =>
      ae.target === fileEvent.path &&
      Math.abs(ae.timestamp - fileEvent.timestamp) < this.correlationWindowMs
    );

    if (matchingAgent) {
      return {
        ...fileEvent,
        source: 'agent',
        agentId: matchingAgent.agentId,
        tool: matchingAgent.tool
      };
    }

    // Pas de correspondance -> changement humain ou agent non-monitore
    return {
      ...fileEvent,
      source: 'unknown'
    };
  }
}
```

#### Optimisations de performance

1. **Debouncing intelligent** : Quand un agent fait un `Edit` qui genere plusieurs ecritures intermediaires, ne compter qu'un seul evenement.

```typescript
const debouncedChanges = new Map<string, NodeJS.Timeout>();

function handleFileChange(path: string) {
  if (debouncedChanges.has(path)) {
    clearTimeout(debouncedChanges.get(path)!);
  }

  debouncedChanges.set(path, setTimeout(() => {
    emitConsolidatedChange(path);
    debouncedChanges.delete(path);
  }, 300)); // 300ms de debounce
}
```

2. **Filtering par pertinence** : Ne pas traquer les fichiers non pertinents (node_modules, build output, logs temporaires).

3. **Batch processing** : Quand un agent modifie 20 fichiers en rafale, les grouper en un seul evenement "batch edit".

### 5.4 Git + File watching : combinaison pour le versioning de contexte

Pour implementer le versioning de contexte (cf. brainstorm Gabri, idee #30 "Git comme moteur de versioning du contexte") :

```typescript
class ContextVersioning {
  private git: GitIntegration;
  private watcher: FSWatcher;

  // Quand un fichier de contexte change, trouver le commit
  // ou il avait sa version precedente
  async getContextDelta(contextFile: string): Promise<ContextDelta> {
    const history = await this.git.getFileHistory(contextFile, 2);

    if (history.length < 2) {
      return { type: 'new', currentContent: await fs.readFile(contextFile, 'utf-8') };
    }

    const previousCommit = history[1].hash;
    const previousContent = await this.git.getFileAtCommit(contextFile, previousCommit);
    const currentContent = await fs.readFile(contextFile, 'utf-8');

    return {
      type: 'modified',
      previousContent,
      currentContent,
      previousCommit,
      diff: await this.git.getFileDiff(contextFile),
      // Delta en langage naturel (pour l'agent)
      naturalLanguageDelta: await this.generateDelta(previousContent, currentContent)
    };
  }

  // Voir le contexte tel qu'il etait quand un code a ete ecrit
  async getContextAtCodeCommit(
    codeFile: string,
    contextFiles: string[]
  ): Promise<Map<string, string>> {
    // Trouver le dernier commit qui a modifie le code
    const codeHistory = await this.git.getFileHistory(codeFile, 1);
    const codeCommit = codeHistory[0].hash;

    // Recuperer le contenu des fichiers de contexte a ce commit
    const contextAtCommit = new Map<string, string>();
    for (const ctxFile of contextFiles) {
      try {
        const content = await this.git.getFileAtCommit(ctxFile, codeCommit);
        contextAtCommit.set(ctxFile, content);
      } catch {
        // Le fichier de contexte n'existait pas a ce commit
        contextAtCommit.set(ctxFile, '[N/A - fichier inexistant a ce commit]');
      }
    }

    return contextAtCommit;
  }
}
```

### 5.5 Recommandation pour MnM

**Stack recommandee :**

| Composant | Outil | Justification |
|-----------|-------|---------------|
| **File watching** | chokidar | Standard, performant, bien documente |
| **Git** | simple-git | API complete, TypeScript, utilise git natif |
| **Correlation** | Event Correlator custom | Logique specifique a MnM |
| **State management** | Zustand | Leger, performant, bon pour les evenements temps reel |

**Architecture :**
1. **Main process Electron** : chokidar + simple-git + Event Correlator
2. **IPC bridge** : Envoie les evenements correles au renderer process
3. **Renderer process** : Zustand store -> React components (Timeline, Contexte)

---

## 6. Synthese et recommandations globales

> **Mise a jour 2026-02-28** : Cette section integre les decouvertes sur l'Agent SDK et Agent Teams (sections 2.6-2.8). La strategie d'integration est fondamentalement revisee.

### Stack technique recommandee pour le MVP

| Couche | Choix | Alternatives considerees |
|--------|-------|------------------------|
| **Desktop runtime** | Electron | Tauri (future option) |
| **Frontend framework** | React 19 + TypeScript | -- |
| **Build tool** | Vite (via electron-vite) | webpack |
| **State management** | Zustand | Jotai, Redux Toolkit |
| **Styling** | Tailwind CSS | CSS Modules |
| **Workflow viz** | React Flow + dagre | JointJS, d3.js |
| **YAML parsing** | js-yaml | yaml (npm) |
| **XML parsing** | fast-xml-parser | xml2js |
| **File watching** | chokidar | @parcel/watcher |
| **Git** | simple-git | isomorphic-git |
| **Agent spawn** | @anthropic-ai/claude-agent-sdk | child_process.spawn('claude') |
| **Agent observation** | chokidar sur ~/.claude/ | stdout parsing (ancien) |
| **Drift detection** | LLM-as-judge (Claude API) | Embeddings locaux (post-MVP) |
| **Markdown parsing** | remark / unified | marked |
| **Packaging** | electron-builder | electron-forge |

### Decision architecturale majeure : "SDK spawn + file watching"

La strategie d'integration avec Claude Code repose sur deux piliers :

1. **SPAWN via SDK** : Utiliser `@anthropic-ai/claude-agent-sdk` pour lancer les agents avec `settingSources: ['project', 'user']` et `env: { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1" }`. Le SDK gere le lifecycle des agents.

2. **OBSERVE via file watching** : Utiliser chokidar pour surveiller `~/.claude/` (teams, tasks, inboxes, sessions) et le repertoire projet. Les fichiers JSON/JSONL ecrits par Agent Teams constituent l'interface d'observation.

**Pourquoi cette approche remplace le subprocess wrapping :**
- Le stdout parsing est fragile et ne supporte qu'un agent a la fois
- Agent Teams ecrit TOUT son etat sur disque en JSON/JSONL structure
- Le file watching est non-intrusif (zero modification de Claude Code)
- Permet d'observer N agents simultanement
- Les schemas JSON sont stables et faciles a parser

### Risques techniques identifies (revises)

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Agent Teams API instable (experimental)** | Haute | Haut | Abstraire derriere une interface, tests de regression sur les schemas JSON, veille sur les releases Claude Code |
| **Format des fichiers ~/.claude/ change** | Moyenne | Haut | Schema validation a l'entree, adapter pattern, monitoring des releases |
| **Performance Electron sur gros projets** | Moyenne | Moyen | Virtualisation de listes, lazy loading, worker threads |
| **File watching race conditions** | Moyenne | Moyen | awaitWriteFinish, debouncing, validation JSON avant traitement |
| **Drift detection bruyante (faux positifs)** | Haute | Haut | Seuils configurables, bouton "ignorer", apprentissage |
| **Sync workflow visuel <-> fichier** | Moyenne | Moyen | Pattern Source of Truth = Fichier, tests de regression |
| **Complexite IPC Electron** | Moyenne | Moyen | Architecture claire, contextBridge, typage fort |
| **settingSources non documente officiellement** | Moyenne | Moyen | Tests reguliers, fallback sur spawn CLI si SDK casse |

### Ordre de developpement recommande (revise)

1. **Fondation (Semaines 1-3)** : Setup Electron + React + Vite, layout 3 volets, file watching basique (chokidar sur le projet)
2. **SDK Integration (Semaines 4-5)** : Integration Claude Agent SDK, spawn d'un agent simple, capture du flux query(), verification settingSources
3. **Agent Teams observation (Semaines 6-8)** : File watching sur ~/.claude/, parsing des inboxes/tasks/sessions, event bus Zustand, UI timeline
4. **Multi-agent dashboard (Semaines 9-10)** : Vue multi-agents, kanban des taches, flux de messages inter-agents, attribution des modifications fichier
5. **Git integration (Semaines 11-12)** : Historique, diffs, versioning de contexte
6. **Drift detection (Semaines 13-15)** : LLM-as-judge, alertes actionnables
7. **Workflow editor (Semaines 16-18)** : Parsing YAML/XML, React Flow, edition basique

### Points de vigilance

- **Agent Teams est experimental** (env flag `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`). Suivre l'evolution dans les changelogs Anthropic.
- **Le SDK necessite le binaire CLI** installe globalement. MnM doit verifier la presence de `claude` au demarrage et guider l'installation si absent.
- **Les schemas JSON ne sont pas documentes officiellement**. Les schemas decrits en section 2.7 sont derives d'observation directe. Implementer une couche de validation (zod) pour detecter les changements de format.
- **Hooks TypeScript** : Certains hooks (SessionStart, SessionEnd, TeammateIdle, TaskCompleted) ne supportent que des handlers TypeScript (.ts), pas bash. MnM devra fournir des handlers .ts preconfigures.

---

*Ce rapport est un document technique de reference pour la phase d'architecture de MnM. Derniere mise a jour : 2026-02-28 (ajout sections 2.6-2.8, revision section 6).*
