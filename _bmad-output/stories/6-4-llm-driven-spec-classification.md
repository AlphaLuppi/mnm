---
story_id: "6.4"
title: "LLM-Driven Spec Classification"
epic: "Epic 6: LLM-Powered Discovery & Interaction"
status: ready-for-dev
priority: medium
estimate: 1.5 days
created: 2026-02-20
tags: [backend, discovery, LLM, FR9]
blocked_by: ["1-2", "0-7"]
---

# Story 6.4: LLM-Driven Spec Classification

## User Story

**As a** user,
**I want** specs classified by LLM during discovery,
**So that** the spec browser shows accurate categorization instead of relying on heuristics.

## Background

The PRD (FR9.2) specifies LLM-powered spec discovery. Current implementation in `src/lib/discovery/discovery-service.ts` uses heuristic pattern matching (file paths, keywords) which is inaccurate and returns too many false positives.

The user reported: "When I search for specs, it shows a looooot of files. I would like this to be discovered by an LLM."

## Acceptance Criteria

### AC1: LLM Classification During Discovery
**Given** MnM scans the repository for specs
**When** a potential spec file is found
**Then** the LLM classifies it as:
- `product_brief` — High-level product vision
- `prd` — Product Requirements Document
- `architecture` — Technical architecture decisions
- `epic` — Epic definition
- `story` — User story
- `config` — Configuration file
- `not_a_spec` — Regular code/docs, not a spec

### AC2: Classification Confidence
**Given** LLM classifies a file
**When** the classification is returned
**Then** it includes:
- `type`: The spec type
- `confidence`: high / medium / low
- `reasoning`: Brief explanation (e.g., "Contains YAML frontmatter with story format")

### AC3: Batch Classification
**Given** multiple files need classification
**When** discovery runs
**Then**:
- Files are batched (max 10 per API call) to reduce latency
- Classification completes within 60 seconds for typical repos
- Progress is reported: "Classifying specs: 45/120"

### AC4: User Review & Override
**Given** LLM has classified specs
**When** I view the discovery results
**Then** I can:
- See each classified file with its type and confidence
- Override classification via dropdown selector
- Save overrides to persist my corrections

### AC5: Classification Caching
**Given** a file has been classified
**When** the file hasn't changed (same content hash)
**Then**:
- Cached classification is used
- No LLM API call is made
- Re-classification only happens on file change

### AC6: Graceful Fallback
**Given** LLM API is unavailable
**When** classification is attempted
**Then**:
- Fall back to heuristic classification
- Log warning: "LLM classification unavailable, using heuristics"
- UI shows indicator: "⚠️ Classifications may be inaccurate"

## Technical Notes

### LLM Prompt Design
```
Classify the following file as a specification document.

File path: {path}
Content preview (first 500 chars):
{content}

Respond with JSON:
{
  "type": "product_brief" | "prd" | "architecture" | "epic" | "story" | "config" | "not_a_spec",
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation"
}
```

### API Integration
- Use Claude API with JSON mode
- Temperature: 0 (deterministic)
- Model: claude-sonnet-4 (fast, accurate enough)

### Database Updates
- Add `classification_source` column to specs table: "llm" | "heuristic" | "user_override"
- Add `classification_confidence` column
- Store `content_hash` for cache invalidation

### File Locations
- Classifier: `src/lib/discovery/llm-classifier.ts`
- Update: `src/lib/discovery/discovery-service.ts`
- API: `POST /api/discovery/classify` (batch endpoint)

## Out of Scope
- Fine-tuning LLM for classification (use prompt engineering)
- Real-time classification as files change (batch only)
- Classification of binary files

## Definition of Done
- [ ] LLM classifier implemented with batch support
- [ ] Classification results stored with confidence
- [ ] User can override classifications
- [ ] Caching prevents redundant API calls
- [ ] Fallback to heuristics when API unavailable
- [ ] Unit tests for classifier
- [ ] Integration test with mock LLM responses

## Dependencies
- Story 1.2 (Spec File Detection & Indexing)
- Story 0.7 (API Key Storage)

## References
- PRD: FR9.2.1, FR9.2.2, FR9.2.3, FR9.2.4
