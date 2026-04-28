# MnM - IDE pour le Développement Agentique
## Brainstorm v2 - Vision clarifiée

**Date :** 2026-02-19  
**Vision révélée par Nikou :** Un IDE adapté au développement agentique

---

## 🎯 Vision Core

**MnM n'est PAS :**
- Un IDE classique avec copilot IA
- Un fork de VSCode avec des features IA
- Un concurrent à Cursor/Zed sur leur terrain

**MnM EST :**
- Un IDE pensé pour **développer VIA des agents**
- Architecture native pour Claude Code + BMAD
- Extensible à d'autres frameworks agentiques
- L'environnement où les coding agents sont des first-class citizens

---

## 🔍 Exploration BMAD en cours...

### Phase 1 : Différenciation

#### Qu'est-ce qui change quand on code VIA des agents ?

**Paradigme traditionnel :**
- Dev écrit le code ligne par ligne
- IDE = éditeur de texte enrichi
- IA = assistant/suggestion

**Paradigme agentique (MnM) :**
- Dev définit l'intention, l'agent code
- IDE = orchestrateur d'agents + visualiseur de changements
- IA = exécuteur principal

#### Différenciation vs VSCode/Cursor/Zed

| Feature | VSCode/Cursor/Zed | MnM (IDE Agentique) |
|---------|-------------------|---------------------|
| **Focus** | Édition manuelle + assist IA | Délégation aux agents + supervision |
| **Interface** | Éditeur de texte central | Timeline de changements + diff viewer |
| **Workflow** | Write → Run → Debug | Describe → Review → Approve |
| **IA Role** | Suggestions, completions | Autonomous code execution |

---

## 🎨 Features clés pour un IDE Agentique

### 1. Agent Session Management
- Vue dédiée des sessions Claude Code actives
- Historique des conversations agent
- Reprise de contexte entre sessions
- Multi-agent orchestration (plusieurs agents sur différentes parties du projet)

### 2. Change Review Interface
- Diff viewer optimisé pour BMAD
- Preview avant apply (tous les fichiers impactés)
- Approve/Reject granulaire (par fichier ou par chunk)
- Annotations sur les changements proposés

### 3. Intention → Code Pipeline
- Panneau pour formuler les tâches/intentions
- Templates de prompts pour tâches courantes
- Validation que l'intention est claire avant de spawner l'agent
- Historique des intentions → résultats

### 4. Agent Context Viewer
- Visualisation de ce que l'agent "voit" (quels fichiers sont dans son contexte)
- Gestion explicite du contexte (add/remove files from agent view)
- Budget token tracking en temps réel
- Workspace boundaries (scope limiter)

### 5. BMAD Native Support
- Intégration des commandes BMAD dans l'UI
- Visualisation des 4 phases (Build, Modify, Apply, Debug)
- Retry/rollback facile
- Plan visualization avant execution

### 6. Testing & Validation Layer
- Automated testing après agent changes
- Regression detection
- Performance benchmarks avant/après
- Sanity checks (syntax, imports, etc.)

### 7. Multi-Agent Coordination
- Plusieurs agents travaillant en parallèle sur différents modules
- Conflict detection entre agents
- Merge strategies pour changements concurrents
- Agent specialization (frontend agent, backend agent, etc.)

---

## 🏗️ Architecture Extensible

### Plugin System pour Frameworks Agentiques

**Interface standard :**
```typescript
interface AgenticFramework {
  name: string;
  spawn(task: Task, context: Context): AgentSession;
  communicate(session: AgentSession, message: string): Response;
  getChanges(session: AgentSession): FileChange[];
  applyChanges(changes: FileChange[]): Result;
  terminate(session: AgentSession): void;
}
```

**Implémentations :**
- `ClaudeCodeFramework` (prioritaire)
- `BMADFramework` (built-in)
- `OpenHandsFramework` (extensible)
- `DevinFramework` (extensible)
- `CustomFramework` (pour frameworks maison)

### Core vs Extensions

**Core MnM :**
- Agent session lifecycle
- Change review & apply
- Context management
- Multi-agent coordination
- Testing & validation

**Extensions (plugins) :**
- Framework-specific adapters
- Language servers
- Custom UI panels
- Workflow automations
- Integration avec outils externes (Git, CI/CD, etc.)

---

## 🤔 Questions précises pour Nikou

### Architecture & Tech Stack

1. **Platform cible :** macOS only (native Swift/SwiftUI) ou cross-platform (Electron/Tauri) ?
2. **Backend model :** MnM héberge les agents localement ou se connecte à des services externes (API Anthropic, etc.) ?
3. **Extensibilité :** Plugin system à la VSCode ou plus simple/opinioné ?

### UX & Workflow

4. **Primary interface :** Quelle vue est centrale dans MnM ?
   - Timeline des changements ?
   - Chat avec l'agent ?
   - Diff viewer ?
   - Multi-pane (chat + diff + context) ?

5. **Editing direct :** MnM permet-il l'édition manuelle du code ou c'est 100% via agents ?

6. **Review granularity :** À quel niveau review/approve les changements ?
   - Par fichier ?
   - Par fonction/classe ?
   - Par "logical change" ?
   - Tout ou rien ?

### Frameworks & Priorités

7. **BMAD integration :** BMAD est-il un framework séparé ou le workflow natif de MnM ?

8. **Claude Code dependency :** MnM utilise Claude Code CLI en subprocess ou réimplémente la logique ?

9. **Autres frameworks :** Quels autres frameworks agentiques prioriser après Claude Code + BMAD ?
   - Aider
   - OpenHands
   - Devin
   - Autres ?

### Scope & MVP

10. **MVP features :** Quelles 3-5 features sont absolument critiques pour le MVP ?

11. **Langages supportés :** Tous (via language servers) ou focus sur certains langages d'abord ?

12. **Git integration :** MnM gère Git directement ou délègue à l'utilisateur/agent ?

---

## 📝 Réflexions & Insights

### Paradigm Shift Majeur

Le passage de "coder avec assistance IA" à "déléguer le coding à des agents" est fondamental. MnM doit embrasser ce shift complètement :

- **L'éditeur de texte devient secondaire** → Les diffs et reviews deviennent primaires
- **La complétion de code disparaît** → Les intentions et validations apparaissent
- **Le debugging manuel diminue** → Le testing automatisé et la validation augmentent

### Trust & Control Balance

Défi clé : donner assez d'autonomie aux agents tout en gardant le contrôle humain. MnM doit trouver le sweet spot :

- **Trop de contrôle** → Perd l'avantage de l'automatisation
- **Trop d'autonomie** → Perte de confiance, risque de surprises

**Solution potentielle :** Niveaux de confiance graduels
- Nouveau projet → Review every change
- Projet mature + tests solides → Auto-approve certain types of changes
- Configurable par type de tâche (refactoring vs new feature vs bug fix)

### Multi-Agent Future

Vision long-terme : orchestrer plusieurs agents spécialisés sur un même projet
- Frontend specialist
- Backend specialist  
- Testing specialist
- DevOps specialist

MnM devient le "chef d'orchestre" qui coordonne ces agents.

---

## 🚀 Prochaines Étapes

1. **Attendre réponses de Nikou** aux questions
2. **Wireframes/Mockups** des interfaces clés
3. **Prototype architecture** du plugin system
4. **POC** avec Claude Code + un projet simple
5. **Itérer** sur l'UX basée sur l'usage réel

---

*Document vivant - Mis à jour au fur et à mesure de l'exploration*
