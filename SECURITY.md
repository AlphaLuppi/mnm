# Security Policy

> 🇫🇷 Politique de sécurité de MnM (Make no Mistake) — projet open source maintenu par **Alpha Luppi** (Studio Manifeste).
> 🇬🇧 Security policy for MnM (Make no Mistake) — open source project maintained by **Alpha Luppi** (Studio Manifeste).

---

## 🇫🇷 Français

### Signaler une vulnérabilité

La sécurité de MnM est une priorité. Si vous découvrez une vulnérabilité, **merci de NE PAS ouvrir d'issue publique sur GitHub**.

Deux canaux privés sont disponibles, par ordre de préférence :

1. **Email** (canal préféré) : `security@alphaluppi.fr`
   - Chiffrement PGP disponible sur demande.
   - Merci d'inclure : description de la vulnérabilité, étapes de reproduction, impact estimé, version concernée, et toute PoC ou patch que vous voulez bien partager.

2. **GitHub Security Advisories** (alternatif) : ouvrez un advisory privé via l'onglet *Security* du dépôt → *Report a vulnerability*.
   - URL directe : `https://github.com/AlphaLuppi/mnm/security/advisories/new`

### Ce que nous nous engageons à faire (SLA)

| Étape | Délai cible |
|---|---|
| Accusé de réception | **< 72h** |
| Évaluation initiale + sévérité (CVSS) | < 7 jours |
| Correctif **critique** (CVSS ≥ 9.0) | **< 30 jours** |
| Correctif **élevé** (CVSS 7.0–8.9) | **< 90 jours** |
| Correctif **moyen / faible** | Best-effort, intégré dans le cycle de release standard |

Pour les vulnérabilités exploitées dans la nature (in-the-wild), nous escaladerons et publierons un patch hors-cycle si nécessaire.

### Versions supportées

MnM suit un modèle **rolling release** : nous supportons activement la **version courante** et la **version précédente (N-1)** sur la branche `main`. Nous n'avons pas de branches LTS distinctes pour le moment.

| Version | Supportée |
|---|---|
| Dernière release (N) | ✅ |
| Release précédente (N-1) | ✅ |
| Antérieures | ❌ — merci de mettre à jour |

### Divulgation responsable

Nous adhérons au principe de **divulgation responsable** :

- Embargo standard de **90 jours** entre le report et la publication (ou jusqu'à la disponibilité du correctif si plus tôt).
- Nous coordonnons avec vous la date de publication et la mention du crédit (CVE, advisory GitHub, hall of fame).
- Pas de bug bounty programmatique pour l'instant, mais nous remercions publiquement les chercheurs qui acceptent.

### Hors-périmètre

Les rapports suivants ne sont pas considérés comme des vulnérabilités exploitables :

- Auto-XSS nécessitant que la victime colle elle-même un payload dans la console.
- Absence de header HTTP (CSP, HSTS) sans démonstration d'exploit.
- Rate-limit absent sur des endpoints non-authentifiés sans impact métier démontré.
- Vulnérabilités dans des dépendances non-utilisées en production (vérifier d'abord avec `bun audit`).

---

## 🇬🇧 English

### Reporting a vulnerability

Security is a top priority for MnM. If you discover a vulnerability, **please DO NOT open a public GitHub issue**.

Two private channels are available, in order of preference:

1. **Email** (preferred): `security@alphaluppi.fr`
   - PGP encryption available on request.
   - Please include: description of the vulnerability, reproduction steps, estimated impact, affected version, and any PoC or patch you're willing to share.

2. **GitHub Security Advisories** (alternative): open a private advisory via the repo's *Security* tab → *Report a vulnerability*.
   - Direct URL: `https://github.com/AlphaLuppi/mnm/security/advisories/new`

### Our commitments (SLA)

| Step | Target timeline |
|---|---|
| Acknowledgement | **< 72h** |
| Initial assessment + severity (CVSS) | < 7 days |
| **Critical** fix (CVSS ≥ 9.0) | **< 30 days** |
| **High** fix (CVSS 7.0–8.9) | **< 90 days** |
| **Medium / Low** fix | Best-effort, included in regular release cycle |

For vulnerabilities being actively exploited in the wild, we will escalate and ship out-of-band patches as needed.

### Supported versions

MnM follows a **rolling release** model: we actively support the **current version** and the **previous version (N-1)** on the `main` branch. We don't currently maintain separate LTS branches.

| Version | Supported |
|---|---|
| Latest release (N) | ✅ |
| Previous release (N-1) | ✅ |
| Older | ❌ — please upgrade |

### Responsible disclosure

We follow **responsible disclosure** principles:

- Standard **90-day embargo** between report and public disclosure (or until a fix is available, whichever comes first).
- We coordinate with you on the disclosure date and credit attribution (CVE, GitHub advisory, hall of fame).
- No formal bug bounty program at this time, but we publicly thank researchers who accept.

### Out of scope

The following are not considered exploitable vulnerabilities:

- Self-XSS requiring the victim to paste a payload into their own console.
- Missing HTTP headers (CSP, HSTS) without a demonstrable exploit.
- Lack of rate-limiting on unauthenticated endpoints without demonstrated business impact.
- Vulnerabilities in dependencies not used in production (please verify first with `bun audit`).

---

**Thanks for helping keep MnM and its users safe.**
*— The Alpha Luppi maintainers team*
