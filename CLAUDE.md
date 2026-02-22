# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MnM** is an open-source IDE designed for AI agent-driven development. It replaces the traditional "Write > Run > Debug" paradigm with "Describe > Review > Approve", providing a supervision cockpit for multi-agent development workflows. The project is in early planning/design phase — there is no application code yet.

Language: French is the primary language for planning documents.

## Repository Structure

- `_bmad/` — BMAD framework (AI agent workflow toolkit). Contains agents, workflows, and configs. Do not modify these files unless working on the framework itself.
- `_bmad-output/` — Artifacts produced by BMAD workflows (brainstorming sessions, product brief, planning artifacts).
- `nikou/` — Architecture drafts and brainstorming from team member Nikou.

## BMAD Framework

This repo uses the BMAD method for structured AI-assisted planning. Key concepts:
- **Agents** (`_bmad/bmm/`, `_bmad/cis/`, etc.) — Specialized AI personas (PM, architect, analyst, brainstorming coach, etc.)
- **Workflows** — Step-by-step guided processes for brainstorming, product briefs, architecture, etc.
- **Output directory** (`_bmad-output/`) — Where all generated artifacts land, organized by phase (brainstorming, planning-artifacts).

Use `/bmad-help` to see available workflow steps and get guidance on what to do next.
