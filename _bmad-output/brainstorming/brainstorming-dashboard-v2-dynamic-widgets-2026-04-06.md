# Brainstorming — Dashboard V2 : Grille Dynamique & Widgets Live

> **Date** : 2026-04-06
> **Auteur** : Tom (co-fondateur)
> **Contexte** : Session de test du MnM Blocks Platform (32 stories DONE). Tom identifie les limites de la V1 et pose la vision V2.
> **Statut** : BRAINSTORM — pas encore planifié

---

## 1. Constats sur la V1 (Blocks Platform)

### Ce qui marche
- View Presets : admin gère sidebar items, dashboard widgets, landing page par rôle
- Custom widgets via CAO : l'utilisateur décrit ce qu'il veut, le CAO génère un `ContentDocument`
- json-render : moteur de rendu unifié pour inbox, commentaires, widgets custom
- Content blocks catalogue : 14 types (MetricCard, StatusBadge, Chart, CodeBlock, ActionButton, QuickForm, etc.)
- Projects/Agents sont maintenant des sections sidebar positionnables (`__projects__`, `__agents__`)

### Ce qui ne marche pas / limites
- **Grille rigide** : widgets prédéfinis (du preset) en haut, widgets custom en bas. Pas de mix possible.
- **Resize primitif** : dropdown "Span 1-4" — pas de drag handles, pas de resize libre
- **Pas de live data** : les widgets custom font du polling React Query, pas de SSE/WebSocket natif
- **CAO shortcut** : la génération de widget est un appel API direct, pas une issue + run traçable
- **Doublon inbox** : les failed_run créaient des inbox_items ET restaient dans la section legacy (fixé — désactivé)

---

## 2. Vision V2 : Dashboard = Tour de Contrôle

MnM est un **cockpit de supervision**, pas un IDE (cf. feedback). Le dashboard est LA surface principale. Il doit fonctionner comme une vraie tour de contrôle : temps réel, personnalisable, actionable.

### 2.1 Grille Unifiée

**Principe** : Plus de séparation "predefined" vs "custom". Une seule grille plate de widgets.

- L'admin définit un preset par défaut (layout initial pour un rôle)
- Chaque utilisateur peut **tout** modifier : réordonner, supprimer, redimensionner, ajouter
- Les modifications user sont stockées dans `company_memberships.layout_overrides` (déjà prévu dans le type `LayoutOverrides`)
- Le preset fournit les defaults, l'utilisateur les override

**Migration** :
- Fusionner `DashboardWidget[]` (du preset) et `UserWidget[]` (custom) en une seule liste
- Chaque widget a un `widgetId` unique, un `type` (registry ou "custom"), et un `span`
- Les widgets prédéfinis deviennent des `user_widgets` auto-créés au premier accès
- Le preset ne stocke plus que le layout initial, pas les widgets eux-mêmes

### 2.2 Resize Dynamique avec Pretext

**Lib** : [Pretext](https://github.com/chenglou/pretext) de chenglou (créateur de React Motion)

**Pourquoi Pretext et pas les alternatives** :
- dnd-kit : bon pour le drag-and-drop, pas conçu pour le resize
- Pragmatic DnD (Atlassian) : lourd, over-engineered
- Gridstack : jQuery-based, pas React-native
- Pretext : léger, animations fluides, React-native, conçu pour ce use case exact

**UX cible** :
- Handles de resize sur les bords droits et bas de chaque widget
- Drag-and-drop pour réordonner dans la grille
- Snap-to-grid (colonnes 1-4) avec animation fluide
- Preview en temps réel pendant le drag
- Responsive : collapse en 1 colonne sur mobile

### 2.3 Widgets Live SSE

**Principe** : Les widgets peuvent s'abonner à des events SSE pour du vrai temps réel.

**Architecture** :
```
Widget.dataSource = {
  endpoint: "/companies/:id/dashboard/summary",  // polling classique
  refreshInterval: 120,                           // secondes
  // OU
  sseChannel: "dashboard.metrics",                // subscription SSE
  sseEventTypes: ["agent.status", "run.completed", "issue.updated"]
}
```

**Flow** :
1. User ouvre le dashboard
2. Pour chaque widget avec `sseChannel`, le frontend ouvre une subscription SSE via `/events/ws`
3. Le serveur envoie les events pertinents au widget
4. Le widget se re-rend en temps réel
5. Quand le user quitte le dashboard, les subscriptions sont fermées

**Garde-fou CAO** :
- Le CAO évalue l'impact infra avant de créer un widget live
- Si trop de subscriptions SSE risquent de surcharger → le CAO dit à l'utilisateur :
  - "Ce widget pourrait surcharger l'infra. Je te recommande un refresh interval de 60s à la place."
  - Ou : "Discute avec l'équipe infra" → crée une issue taggée `infra` et l'assigne au tag/user approprié
  - Ajoute un bouton "Refresh" manuel sur le widget à la place du live

### 2.4 CAO Widget = Issue + Run (pas un shortcut API)

**Principe** : Comme pour "Créer un agent via CAO", créer un widget doit passer par le flow standard.

**Flow cible** :
1. User tape "Show me agent health overview" dans le dialog "Ask CAO"
2. Le frontend crée une **issue** : "Dashboard widget: Agent health overview"
3. Le CAO est **assigné** à l'issue via wakeup
4. Le CAO run génère le `ContentDocument` + metadata
5. Le résultat est stocké comme `user_widget` et commenté sur l'issue
6. L'issue est fermée automatiquement

**Avantages** :
- Traçabilité complète (qui a demandé quoi, quand, pourquoi)
- Le CAO peut être interrompu, réassigné, l'issue peut avoir des commentaires
- L'approval flow peut être activé (si l'admin veut valider les widgets avant affichage)
- L'historique des widgets générés est visible dans les issues

### 2.5 Widgets Responsifs

- Les widgets générés par le CAO doivent fonctionner à tous les spans (1 à 4)
- Le prompt CAO (DI-07) doit inclure des contraintes responsive
- Les MetricCards en `stack horizontal` doivent wrapper en `flex-wrap` sur petit span
- Les Charts doivent utiliser `ResponsiveContainer` de recharts
- Les DataTable doivent avoir `overflow-x-auto`

---

## 3. Dépendances & Ordre

```
Phase 1 — Grille unifiée (pré-requis pour tout le reste)
  - Fusionner predefined + custom en une seule liste
  - Layout overrides per-user dans company_memberships
  - Migration : auto-créer user_widgets depuis le preset au premier accès

Phase 2 — Resize dynamique (Pretext)
  - Intégrer Pretext dans DashboardGrid
  - Drag handles + snap-to-grid
  - Sauvegarder position/span en temps réel

Phase 3 — Widgets Live SSE
  - Étendre data_source avec sseChannel/sseEventTypes
  - Frontend : hook useWidgetSSE qui subscribe/unsubscribe
  - CAO : évaluation impact infra dans le prompt

Phase 4 — CAO Widget = Issue + Run
  - Refactorer POST /my-widgets/generate en issue creation + CAO wakeup
  - Frontend : dialog montre le progress de l'issue/run
  - Auto-close issue on widget creation
```

---

## 4. Questions Ouvertes

1. **Persistence des overrides** : `company_memberships.layout_overrides` suffit ? Ou faut-il un table dédiée `user_dashboard_layouts` ?
2. **Pretext maturité** : La lib est-elle stable pour prod ? Fallback si chenglou abandonne ?
3. **SSE scaling** : Combien de subscriptions SSE simultanées le serveur supporte ? Faut-il un Redis pub/sub ?
4. **Widget marketplace** : Les widgets custom d'un user pourraient-ils être partagés avec d'autres ? (template library)
5. **Permissions widget** : Un widget peut-il afficher des données que l'utilisateur n'a pas le droit de voir ? (data_source filtering par tag)

---

## 5. Références

- `_bmad-output/brainstorming/brainstorming-mnm-blocks-platform-unifie-2026-04-05.md` — Architecture initiale Blocks Platform
- `_bmad-output/brainstorming/brainstorming-json-render-agent-content-engine-2026-04-05.md` — json-render comme moteur
- `_bmad-output/brainstorming/brainstorming-view-presets-dashboard-par-persona-2026-04-04.md` — View presets par persona
- Mémoire : `project_dashboard_evolution.md`, `feedback_widget_live_architecture.md`
- Pretext : https://github.com/chenglou/pretext
