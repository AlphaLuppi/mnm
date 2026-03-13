---
title: 'Global Workspace Progress Bar'
slug: 'global-workspace-progress-bar'
created: '2026-03-13'
status: 'in-progress'
stepsCompleted: [1]
tech_stack: [React, Tailwind, shadcn/ui, React Query]
files_to_modify: []
code_patterns: []
test_patterns: []
---

# Tech-Spec: Global Workspace Progress Bar

**Created:** 2026-03-13

## Overview

### Problem Statement

Quand on est sur le dashboard du cockpit, il n'y a aucune vue d'ensemble de l'avancement global du projet. L'utilisateur doit cliquer dans chaque noeud du tree (ContextPane) pour voir la progression de chaque epic/phase. Il manque une vision "at a glance" du projet entier.

### Solution

Ajouter une barre de progression segmentée en haut du WorkPane, au-dessus du ProjectAgentsDashboard (vue par défaut). Chaque segment représente un noeud de niveau 1 du workspace tree, avec sa propre couleur. La largeur de chaque segment est proportionnelle à son poids (nombre d'items total), et le remplissage reflète son % de complétion. Supporte N niveaux de hiérarchie (pas limité à epic > story).

### Scope

**In Scope:**
- Barre de progression segmentée multi-couleurs dans le dashboard du WorkPane
- Basée sur `ContextNode.progress` (done/total) du workspace tree
- Un segment par noeud de niveau 1 (quel que soit le nom : epic, phase, etc.)
- Affichage % uniquement (pas de breakdown textuel)
- Support de hiérarchie profonde (N niveaux agrégés dans les noeuds de niveau 1)

**Out of Scope:**
- Progression basée sur les issues MnM (prévu pour le futur)
- Breakdown textuel détaillé (compteurs done/total)
- Affichage hors du dashboard (pas dans les vues story/artifact sélectionnées)

## Context for Development

### Codebase Patterns

À compléter en Step 2.

### Files to Reference

| File | Purpose |
| ---- | ------- |

À compléter en Step 2.

### Technical Decisions

À compléter en Step 2.

## Implementation Plan

### Tasks

À compléter en Step 3.

### Acceptance Criteria

À compléter en Step 3.

## Additional Context

### Dependencies

À compléter en Step 2.

### Testing Strategy

À compléter en Step 3.

### Notes

- Future évolution : la progression sera basée sur les issues MnM plutôt que le workspace tree.
- La hiérarchie du workspace n'est pas fixe (peut être epic > story, ou phase > epic > story, etc.) — le composant doit s'adapter dynamiquement aux noeuds de niveau 1.
