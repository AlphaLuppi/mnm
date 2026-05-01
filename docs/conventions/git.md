# Conventions Git

## Atomic commit + push

**Toujours commit + push immédiatement.** Jamais laisser de commit non-pushé.

```bash
git add <fichiers-touchés>
git commit -m "..."
git push
```

Pas de commit local qui traîne. Pas de batch « je push à la fin ». Si le push échoue, on fix avant de continuer.

## GPG signing

Le signing GPG time out fréquemment. Si `git commit` échoue avec `gpg: signing failed: Timeout` :

```bash
git -c commit.gpgsign=false commit -m "..."
```

Ne **jamais** désactiver le signing par défaut — uniquement en fallback ponctuel.

## Format des messages

Conventional commits :

```
feat(scope): nouvelle fonctionnalité
fix(scope): correction de bug
chore(scope): tâche de maintenance
refactor(scope): refacto sans changement de comportement
docs(scope): documentation
test(scope): tests
```

Exemples :
- `feat(workflows): add canonical step-succeeded gate`
- `fix(rbac): tag scope leak on cross-company query`
- `chore(deps): bump drizzle to 0.31.0`

## Pas de Co-Authored-By Claude/AI

**Ne jamais ajouter** de trailer `Co-Authored-By: Claude <...>` ou équivalent. Tom est le seul auteur des commits.

## Branches

Solo dev pattern : push direct sur `master` autorisé. Pas de PR pour le travail courant.

Pour les features importantes ou un travail multi-jours, créer une branche `feature/xxx` ou `fix/xxx`, puis merger en fast-forward sur `master`.

## Stage explicite

Préférer `git add <fichier>` à `git add -A` ou `git add .` :

- Évite d'inclure des fichiers non-trackés (artefacts, .env, screenshots locaux).
- Évite de balayer des changements d'autres sessions Claude pas encore validés par Tom.

## Index GitNexus après commit

Un PostToolUse hook réindexe automatiquement après `git commit` / `git merge`. Si tu vois un warning « index stale » dans les outils GitNexus, run :

```bash
npx gitnexus analyze
```

Si le repo a des embeddings (vérifier `.gitnexus/meta.json` → `stats.embeddings > 0`), préserver avec `--embeddings` :

```bash
npx gitnexus analyze --embeddings
```

> Sans `--embeddings`, l'analyze détruit les embeddings existants.
