# Commercial License — MnM

> **Steward**: Alpha Luppi (Studio Manifeste)
> **Contact**: licensing@alphaluppi.fr
> **Version**: 1.0 — 2026-04-28

---

## Version française

### Pourquoi une licence commerciale ?

MnM est distribué par défaut sous la licence **GNU Affero General Public License v3.0** (AGPL-3.0). Cette licence impose une clause de réciprocité réseau : toute modification du code, lorsqu'elle est exposée à des utilisateurs via un réseau (SaaS, intranet, etc.), doit être publiée sous AGPL-3.0.

Cette clause est incompatible avec certains modèles d'entreprise :

- Éditeurs SaaS qui ne souhaitent pas exposer leurs modifications.
- Intégrateurs intégrant MnM dans une suite propriétaire fermée.
- Grands comptes dont la politique interne interdit l'AGPL.
- ESN/ISV revendant un dérivé sous leur propre marque.

Pour ces cas, Alpha Luppi propose une **licence commerciale dual-license** sur le même code source que le core AGPL.

### Ce que la licence commerciale fournit

- **Même code source** que la version AGPL-3.0 publiée sur GitHub (pas de fork caché).
- **Sans la clause de réciprocité réseau** : Vous pouvez modifier MnM, l'exposer en SaaS, l'intégrer dans un produit propriétaire sans publier Vos modifications.
- **Droit de redistribution** sous Votre marque, après accord négocié.
- **Support optionnel** : SLA, hotfix prioritaires, accompagnement (tarif séparé).
- **Indemnisation IP** standard du marché.

### Modules Enterprise (`ee/`)

Le dossier `ee/` du dépôt contient des modules **séparés du dual-licensing du core**. Ces modules sont distribués sous la **MnM Enterprise License** (voir `ee/LICENSE`), distincte à la fois de l'AGPL et de la licence commerciale du core.

Pour activer les modules `ee/`, vous devez disposer d'une licence Enterprise active (souscription annuelle). Build flag : `EE=1`.

### Tarification

Les tarifs sont **sur demande** et dépendent de :

- Nombre d'utilisateurs / sièges / agents.
- Volume de traces/exécutions par mois.
- Modules Enterprise activés.
- Niveau de support souhaité (Standard / Premium / 24x7).
- Durée d'engagement (mensuel / annuel / pluriannuel).

### Comment souscrire

1. Contactez `licensing@alphaluppi.fr` avec une description courte de votre projet, votre stack, et le périmètre d'usage envisagé.
2. Nous reviendrons vers Vous sous 5 jours ouvrés avec un devis et un brouillon de contrat.
3. Signature électronique (DocuSign ou équivalent).
4. Émission de la licence + (si applicable) clés d'activation des modules `ee/`.

### Disclaimer

Ce document est un résumé commercial. Le contrat effectif (Master Software License Agreement) prévaut en cas de divergence. Consultez un avocat avant signature pour tout déploiement en production.

---

## English version

### Why a commercial license?

MnM is distributed by default under the **GNU Affero General Public License v3.0** (AGPL-3.0). This license imposes a network reciprocity clause: any modification to the code, when exposed to users over a network (SaaS, intranet, etc.), must be published under AGPL-3.0.

This clause is incompatible with certain business models:

- SaaS vendors that do not want to expose their modifications.
- Integrators embedding MnM in a closed proprietary suite.
- Large enterprises whose internal policy prohibits AGPL.
- VARs/ISVs reselling a derivative under their own brand.

For these cases, Alpha Luppi offers a **dual-license commercial license** on the same source code as the AGPL core.

### What the commercial license provides

- **Same source code** as the AGPL-3.0 version published on GitHub (no hidden fork).
- **Without the network reciprocity clause**: You may modify MnM, expose it as SaaS, embed it in a proprietary product without publishing Your modifications.
- **Right to redistribute** under Your brand, subject to a negotiated agreement.
- **Optional support**: SLA, priority hotfixes, professional services (separate pricing).
- **Standard IP indemnification**.

### Enterprise modules (`ee/`)

The `ee/` directory in the repository contains modules **separate from the core dual-licensing**. These modules are distributed under the **MnM Enterprise License** (see `ee/LICENSE`), distinct from both the AGPL and the core commercial license.

To enable `ee/` modules, you need an active Enterprise license (annual subscription). Build flag: `EE=1`.

### Pricing

Pricing is **on request** and depends on:

- Number of users / seats / agents.
- Volume of traces/executions per month.
- Enterprise modules enabled.
- Support level (Standard / Premium / 24x7).
- Commitment duration (monthly / annual / multi-year).

### How to subscribe

1. Contact `licensing@alphaluppi.fr` with a short description of your project, your stack, and the intended scope of use.
2. We will get back to You within 5 business days with a quote and a draft contract.
3. Electronic signature (DocuSign or equivalent).
4. License issuance + (if applicable) activation keys for `ee/` modules.

### Disclaimer

This document is a commercial summary. The actual contract (Master Software License Agreement) prevails in case of divergence. Consult a lawyer before signing for any production deployment.
