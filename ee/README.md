# MnM Enterprise (`ee/`)

> **License**: [MnM Enterprise License](./LICENSE) — source-available, not open source.
> **Commercial subscription required for production use.** See [`../COMMERCIAL-LICENSE.md`](../COMMERCIAL-LICENSE.md).

---

## Version française

### (a) Pourquoi un dossier `ee/` séparé

MnM utilise un modèle **dual-licensing** classique (pattern PostHog / GitLab / Sentry) :

- Le **core** est sous AGPL-3.0 (libre, copyleft réseau) ou licence commerciale équivalente.
- Le dossier **`ee/`** contient des modules destinés aux usages Enterprise, sous une licence propriétaire distincte (`ee/LICENSE`), source-available mais **pas open source**.

Cette séparation permet à Alpha Luppi de financer le développement du core via les revenus Enterprise tout en gardant un produit pleinement utilisable sans `ee/` pour la communauté open source.

### (b) Contenu prévu

Modules en cours de développement ou planifiés dans `ee/` :

- **Multi-org admin** — gestion centralisée de plusieurs companies MnM depuis une console unique.
- **SSO / SAML / SCIM** — fédération d'identité entreprise (Okta, Azure AD, etc.) et provisioning automatisé.
- **Audit logs SOC 2** — journalisation immuable conforme aux exigences SOC 2 Type II.
- **Advanced RBAC** — permissions granulaires, séparation des devoirs, conditions contextuelles.
- **Billing & metering** — facturation à l'usage, quotas, plans, intégration Stripe.
- **AI Assistant Premium** — modèles avancés, fine-tuning sur la base de connaissances client, longueur de contexte étendue.
- **Marketplace privé** — gates et workflows internes à l'entreprise, non publiés sur le marketplace public.

> Le dossier peut être vide (`ee/.gitkeep` uniquement) tant que les modules ne sont pas livrés. La séparation est en place dès maintenant pour préparer la suite.

### (c) Build avec / sans EE

```bash
# Build core uniquement (par défaut, sans EE)
bun run build

# Build avec les modules Enterprise activés
EE=1 bun run build
```

Sans le flag `EE=1`, les modules `ee/` ne sont **pas inclus** dans les artefacts compilés. L'application reste 100 % fonctionnelle sur la base AGPL.

L'usage de `EE=1` en production nécessite une **souscription Enterprise active** (voir section Licensing). Une période d'évaluation de 30 jours est tolérée pour le développement et les tests.

### (d) Licensing

Le code dans ce dossier n'est **pas couvert par l'AGPL-3.0** ni par la licence commerciale du core. Il est régi par la **MnM Enterprise License** ([`./LICENSE`](./LICENSE)).

Pour souscrire ou demander un devis : `tom@alphaluppi.fr` ou voir [`../COMMERCIAL-LICENSE.md`](../COMMERCIAL-LICENSE.md).

### (e) Contributing

Les contributions au dossier `ee/` sont les bienvenues mais nécessitent la signature d'un **Enterprise CLA spécifique**, distinct du CLA du core. Cet Enterprise CLA inclut une cession de droits adaptée au modèle propriétaire et des clauses de confidentialité supplémentaires.

Pour obtenir le template de l'Enterprise CLA : `tom@alphaluppi.fr`.

---

## English version

### (a) Why a separate `ee/` folder

MnM uses a classic **dual-licensing** model (PostHog / GitLab / Sentry pattern):

- The **core** is licensed under AGPL-3.0 (free, network copyleft) or an equivalent commercial license.
- The **`ee/`** folder contains modules intended for Enterprise use, under a separate proprietary license (`ee/LICENSE`), source-available but **not open source**.

This separation allows Alpha Luppi to fund core development through Enterprise revenue while keeping a fully usable product without `ee/` for the open-source community.

### (b) What's inside

Modules in development or planned for `ee/`:

- **Multi-org admin** — centralized management of multiple MnM companies from a single console.
- **SSO / SAML / SCIM** — enterprise identity federation (Okta, Azure AD, etc.) and automated provisioning.
- **SOC 2 audit logs** — immutable logging compliant with SOC 2 Type II requirements.
- **Advanced RBAC** — granular permissions, separation of duties, contextual conditions.
- **Billing & metering** — usage-based billing, quotas, plans, Stripe integration.
- **Premium AI Assistant** — advanced models, fine-tuning on customer knowledge base, extended context length.
- **Private marketplace** — gates and workflows internal to the enterprise, not published to the public marketplace.

> The folder may be empty (only `ee/.gitkeep`) until modules ship. The separation is in place now to prepare for the future.

### (c) Build with / without EE

```bash
# Core build only (default, no EE)
bun run build

# Build with Enterprise modules enabled
EE=1 bun run build
```

Without the `EE=1` flag, `ee/` modules are **not included** in the compiled artifacts. The application remains 100% functional on the AGPL base.

Using `EE=1` in production requires an **active Enterprise subscription** (see Licensing section). A 30-day evaluation period is tolerated for development and testing.

### (d) Licensing

Code in this folder is **not covered by AGPL-3.0** nor by the core commercial license. It is governed by the **MnM Enterprise License** ([`./LICENSE`](./LICENSE)).

To subscribe or request a quote: `tom@alphaluppi.fr` or see [`../COMMERCIAL-LICENSE.md`](../COMMERCIAL-LICENSE.md).

### (e) Contributing

Contributions to the `ee/` folder are welcome but require signing a **specific Enterprise CLA**, distinct from the core CLA. This Enterprise CLA includes a rights assignment adapted to the proprietary model and additional confidentiality clauses.

To request the Enterprise CLA template: `tom@alphaluppi.fr`.
