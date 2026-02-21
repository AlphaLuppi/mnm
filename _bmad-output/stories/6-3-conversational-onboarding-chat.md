---
story_id: "6.3"
title: "Conversational Onboarding Chat"
epic: "Epic 6: LLM-Powered Discovery & Interaction"
status: ready-for-dev
priority: high
estimate: 3 days
created: 2026-02-20
tags: [frontend, backend, onboarding, chat, FR10]
blocked_by: ["0-7"]
---

# Story 6.3: Conversational Onboarding Chat

## User Story

**As a** new user,
**I want** a conversational chat experience during onboarding,
**So that** I can understand my project and MnM's capabilities interactively.

## Background

The PRD (FR10.2, FR10.3) specifies conversational onboarding. The brainstorm-v2 vision states: "L'onboarding est entièrement conversationnel" with examples showing Claude greeting the user, asking about their project, and proposing workflows.

Current implementation (`src/app/onboarding/page.tsx`) is a static step-based wizard. This story replaces it with a chat interface.

## Acceptance Criteria

### AC1: Chat Interface
**Given** I launch MnM for the first time
**When** the onboarding flow starts
**Then** I see a chat interface with:
- Claude's welcome message
- Text input for my responses
- Chat history panel
- Typing indicator when Claude is responding

### AC2: Welcome & Project Discovery
**Given** I start the onboarding chat
**When** Claude greets me
**Then** Claude:
- Introduces itself as MnM assistant
- Asks about my project or offers to analyze the current directory
- If repo detected, offers to scan it

### AC3: Repository Analysis
**Given** I confirm repository analysis
**When** Claude analyzes the repo
**Then** Claude:
- Shows progress: "Analyzing your repository..."
- Reports findings: "I found 5 BMAD workflows, 12 specs, 3 Claude commands"
- Explains what each discovery means
- Asks if the analysis looks correct

### AC4: Interactive Q&A
**Given** Claude has analyzed my project
**When** I ask questions like:
- "What workflows are available?"
- "How do I run drift detection?"
- "What specs did you find?"
**Then** Claude provides contextual answers based on the discovered project state

### AC5: Configuration Capture
**Given** the conversation progresses
**When** Claude needs configuration (API key, preferences)
**Then** Claude:
- Asks conversationally: "To enable drift detection, I'll need your Claude API key. Would you like to set that up now?"
- Provides inline input field for API key
- Validates the key and confirms success

### AC6: Next Steps Suggestions
**Given** onboarding is complete
**When** Claude summarizes the session
**Then** Claude:
- Summarizes what was configured
- Suggests next actions based on project state: "You have 3 stories with unresolved drift. Want to review them?"
- Provides quick action buttons for common next steps

### AC7: Onboarding Completion
**Given** the conversation reaches a natural end
**When** I'm ready to proceed
**Then**:
- Chat can be dismissed
- Onboarding state is saved (never shown again)
- User is directed to main dashboard

## Technical Notes

### Chat Implementation
- Use streaming for Claude responses (Claude API with streaming)
- Store chat history in session (not persisted)
- Use SSE or fetch with streaming for real-time responses

### Backend API
- `POST /api/onboarding/chat` — Send user message, receive Claude response
- `POST /api/onboarding/analyze` — Trigger repo analysis
- `POST /api/onboarding/complete` — Mark onboarding done

### Claude API Integration
- System prompt: Define MnM assistant persona
- Include discovered project context in conversation
- Use structured output for action suggestions

### UI Components
- Chat container with message bubbles
- Typing indicator
- Inline action buttons
- API key input field (secure, masked)
- Progress indicators for analysis

### File Locations
- Page: `src/app/onboarding/page.tsx` (replace existing)
- Components: `src/components/onboarding/`
  - `onboarding-chat.tsx`
  - `chat-message.tsx`
  - `chat-input.tsx`
  - `analysis-progress.tsx`
  - `action-suggestion.tsx`
- API: `src/app/api/onboarding/chat/route.ts`

## Out of Scope
- Voice input
- Multi-language support (English only for MVP)
- Persistent chat history beyond session
- Workflow editing from chat (read-only suggestions)

## Definition of Done
- [ ] Chat interface renders and accepts input
- [ ] Claude responses stream in real-time
- [ ] Repository analysis works and reports findings
- [ ] User can ask questions and get contextual answers
- [ ] API key can be configured via chat
- [ ] Onboarding completion is persisted
- [ ] Unit tests for chat components
- [ ] Integration test for full onboarding flow
- [ ] Accessible (keyboard navigation, screen reader support)

## Dependencies
- Story 0.7 (Configuration Management & API Key Storage)

## References
- PRD: FR10.1, FR10.2, FR10.3
- Brainstorm-v2: Section 2.5 (Onboarding = Workflow Editor)
