---
name: cc-create-architecture
description: "Guided architecture document authoring"
---

# Create Architecture

This skill produces `docs/architecture/architecture.md` — the master architecture
document that translates all approved GDDs into a concrete technical blueprint.
It sits between design and implementation, and must exist before sprint planning begins.

**Distinct from `/cc-architecture-decision`**: ADRs record individual point decisions.
This skill creates the whole-system blueprint that gives ADRs their context.

Resolve the review mode (once, store for all gate spawns this run):
1. If `--review [full|lean|solo]` was passed → use that
2. Else use `file_search` to find `**/review-mode.txt`, then `read_file` → use that value
3. Else → default to `lean`

**Argument modes:**
- **No argument / `full`**: Full guided walkthrough — all sections, start to finish
- **`layers`**: Focus on the system layer diagram only
- **`data-flow`**: Focus on data flow between modules only
- **`api-boundaries`**: Focus on API boundary definitions only
- **`adr-audit`**: Audit existing ADRs for engine compatibility gaps only

---

## Phase 0: Load All Context

Before anything else, load the full project context in this order:

### 0a. Engine Context (Critical)

Read the engine reference library completely:

1. Use `read_file` on `docs/engine-reference/[engine]/VERSION.md`
   → Extract: engine name, version, LLM cutoff, post-cutoff risk levels
2. Use `read_file` on `docs/engine-reference/[engine]/breaking-changes.md`
   → Extract: all HIGH and MEDIUM risk changes
3. Use `read_file` on `docs/engine-reference/[engine]/deprecated-apis.md`
   → Extract: APIs to avoid
4. Use `read_file` on `docs/engine-reference/[engine]/current-best-practices.md`
   → Extract: post-cutoff best practices that differ from training data
5. Use `file_search` for `docs/engine-reference/[engine]/modules/*.md` and read all
   → Extract: current API patterns per domain

If no engine is configured, stop and prompt:
> "No engine is configured. Run `/cc-setup-engine` first. Architecture cannot be
> written without knowing which engine and version you are targeting."

### 0b. Design Context + Technical Requirements Extraction

Read all approved design documents and extract technical requirements from each:

1. Use `read_file` on `design/gdd/game-concept.md` — game pillars, genre, core loop
2. Use `read_file` on `design/gdd/systems-index.md` — all systems, dependencies, priority tiers
3. Use `read_file` on project technical preferences file — naming conventions, performance budgets,
   allowed libraries, forbidden patterns
4. **Every GDD in `design/gdd/`** — use `file_search` for `design/gdd/*.md`, then `read_file` each.
   For each, extract technical requirements:
   - Data structures implied by the game rules
   - Performance constraints stated or implied
   - Engine capabilities the system requires
   - Cross-system communication patterns
   - State that must persist (save/load implications)
   - Threading or timing requirements

Build a **Technical Requirements Baseline** — a flat list of all extracted
requirements across all GDDs, numbered `TR-[gdd-slug]-[NNN]`. Present it as:

```
## Technical Requirements Baseline
Extracted from [N] GDDs | [X] total requirements

| Req ID | GDD | System | Requirement | Domain |
|--------|-----|--------|-------------|--------|
| TR-combat-001 | combat.md | Combat | Hitbox detection per-frame | Physics |
| TR-combat-002 | combat.md | Combat | Combo state machine | Core |
| TR-inventory-001 | inventory.md | Inventory | Item persistence | Save/Load |
```

This baseline feeds into every subsequent phase.

### 0c. Existing Architecture Decisions

Use `file_search` for `docs/architecture/adr-*.md` to find and read all existing ADRs.
List any ADRs found and their domains.

### 0d. Generate Knowledge Gap Inventory

Display a structured summary:

```
## Engine Knowledge Gap Inventory
Engine: [name + version]
LLM Training Covers: up to approximately [version]
Post-Cutoff Versions: [list]

### HIGH RISK Domains (must verify against engine reference before deciding)
- [Domain]: [Key changes]

### MEDIUM RISK Domains (verify key APIs)
- [Domain]: [Key changes]

### LOW RISK Domains (in training data, likely reliable)
- [Domain]: [no significant post-cutoff changes]

### Systems from GDD that touch HIGH/MEDIUM risk domains:
- [GDD system name] → [domain] → [risk level]
```

Ask via `vscode_askQuestions`: "This inventory identifies [N] systems in HIGH RISK
engine domains. Shall I continue building the architecture with these warnings
flagged throughout?"

---

## Phase 1: System Layer Mapping

Map every system from `systems-index.md` into an architecture layer:

```
┌─────────────────────────────────────────────┐
│  PRESENTATION LAYER                         │  ← UI, HUD, menus, VFX, audio
├─────────────────────────────────────────────┤
│  FEATURE LAYER                              │  ← gameplay systems, AI, quests
├─────────────────────────────────────────────┤
│  CORE LAYER                                 │  ← physics, input, combat, movement
├─────────────────────────────────────────────┤
│  FOUNDATION LAYER                           │  ← engine integration, save/load,
│                                             │    scene management, event bus
├─────────────────────────────────────────────┤
│  PLATFORM LAYER                             │  ← OS, hardware, engine API surface
└─────────────────────────────────────────────┘
```

For each GDD system, ask:
- Which layer does it belong to?
- What are its module boundaries?
- What does it own exclusively?

Present the proposed layer assignment and ask for approval via `vscode_askQuestions`
before proceeding. Write the approved layer map immediately to the skeleton file.

**Engine awareness check**: For each system in Core and Foundation layers, flag if it
touches a HIGH or MEDIUM risk engine domain.

---

## Phase 2: Module Ownership Map

For each module defined in Phase 1, define ownership:

- **Owns**: what data and state this module is solely responsible for
- **Exposes**: what other modules may read or call
- **Consumes**: what it reads from other modules
- **Engine APIs used**: which specific engine classes/nodes/signals this module
  calls directly (with version and risk level noted)

Format as a table per layer, then as an ASCII dependency diagram.

**Engine awareness check**: For every engine API listed, verify against the
relevant module reference doc. If an API is post-cutoff, flag it:

```
⚠️  [ClassName.method()] — [Engine] [version] (post-cutoff, HIGH risk)
    Verified against: docs/engine-reference/[engine]/modules/[domain].md
    Behaviour confirmed: [yes / NEEDS VERIFICATION]
```

Get user approval on the ownership map before writing.

---

## Phase 3: Data Flow

Define how data moves between modules during key game scenarios. Cover at minimum:

1. **Frame update path**: Input → Core systems → State → Rendering
2. **Event/signal path**: How systems communicate without tight coupling
3. **Save/load path**: What state is serialised, which module owns serialisation
4. **Initialisation order**: Which modules must boot before others

Use ASCII sequence diagrams where helpful. For each data flow:
- Name the data being transferred
- Identify the producer and consumer
- State whether this is synchronous call, signal/event, or shared state
- Flag any data flows that cross thread boundaries

Get user approval per scenario before writing.

---

## Phase 4: API Boundaries

Define the public contracts between modules. For each boundary:

- What is the interface a module exposes?
- What are the entry points (functions/signals/properties)?
- What invariants must callers respect?
- What must the module guarantee to callers?

Write in pseudocode or the project's actual language.
These become the contracts programmers implement against.

**Engine awareness check**: If any interface uses engine-specific types, flag the
version and verify the type exists and has not changed signature.

---

## Phase 5: ADR Audit + Traceability Check

Review all existing ADRs against both the architecture built in Phases 1-4
AND the Technical Requirements Baseline from Phase 0b.

### ADR Quality Check

For each ADR:
- [ ] Does it have an Engine Compatibility section?
- [ ] Is the engine version recorded?
- [ ] Are post-cutoff APIs flagged?
- [ ] Does it have a "GDD Requirements Addressed" section?
- [ ] Does it conflict with the layer/ownership decisions made in this session?
- [ ] Is it still valid for the pinned engine version?

### Traceability Coverage Check

Map every requirement from the Technical Requirements Baseline to existing ADRs:

| Req ID | Requirement | ADR Coverage | Status |
|--------|-------------|--------------|--------|
| TR-combat-001 | Hitbox detection per-frame | ADR-0003 | ✅ |
| TR-combat-002 | Combo state machine | — | ❌ GAP |

Count: X covered, Y gaps. For each gap, it becomes a **Required New ADR**.

### Required New ADRs

List all decisions made during this architecture session that don't have ADRs,
PLUS all uncovered Technical Requirements. Group by layer — Foundation first:

**Foundation Layer (must create before any coding):**
- `/cc-architecture-decision [title]` → covers: TR-[id], TR-[id]

**Core Layer:**
- `/cc-architecture-decision [title]` → covers: TR-[id]

---

## Phase 6: Missing ADR List

Based on the full architecture, produce a complete list of ADRs that should exist
but don't. Group by priority:

**Must have before coding starts (Foundation & Core decisions):**
- [e.g. "Scene management and scene loading strategy"]
- [e.g. "Event bus vs direct signal architecture"]

**Should have before the relevant system is built:**
- [e.g. "Inventory serialisation format"]

**Can defer to implementation:**
- [e.g. "Specific shader technique for water"]

---

## Phase 7: Write the Master Architecture Document

Once all sections are approved, write the complete document.

Ask via `vscode_askQuestions`: "May I write the master architecture document to
`docs/architecture/architecture.md`?"

The document structure:

```markdown
# [Game Name] — Master Architecture

## Document Status
- Version: [N]
- Last Updated: [date]
- Engine: [name + version]
- GDDs Covered: [list]
- ADRs Referenced: [list]

## Engine Knowledge Gap Summary
[Condensed from Phase 0d inventory]

## System Layer Map
[From Phase 1]

## Module Ownership
[From Phase 2]

## Data Flow
[From Phase 3]

## API Boundaries
[From Phase 4]

## ADR Audit
[From Phase 5]

## Required ADRs
[From Phase 6]

## Architecture Principles
[3-5 key principles governing all technical decisions]

## Open Questions
[Decisions deferred — must be resolved before relevant layer is built]
```

---

## Phase 7b: Technical Director Sign-Off + Lead Programmer Feasibility Review

After writing the master architecture document, perform sign-off.

**Step 1 — Technical Director self-review** (this skill runs as cc-technical-director):
Self-apply the architecture review gate criteria.

**Review mode check** — apply before spawning cc-lead-programmer:
- `solo` → skip. Note: "LP-FEASIBILITY skipped — Solo mode." Proceed to Phase 8.
- `lean` → skip. Note: "LP-FEASIBILITY skipped — Lean mode." Proceed to Phase 8.
- `full` → spawn `cc-lead-programmer` via `runSubagent` with architecture document
  path, technical requirements baseline, ADR list. Collect feasibility verdict.

**Step 2 — Present both assessments to the user:**

Use `vscode_askQuestions` — "Technical Director and Lead Programmer have reviewed.
How would you like to proceed?"
Options: `Accept — proceed to handoff` / `Revise flagged items first` / `Discuss specific concerns`

**Step 3 — Record sign-off in the architecture document** (ask before writing).

---

## Phase 8: Handoff

After writing the document, provide a clear handoff:

1. **Run these ADRs next** (from Phase 6, prioritised): list the top 3
2. **Gate check**: "The master architecture document is complete. Run `/cc-gate-check
   pre-production` when all required ADRs are also written."
3. **Update session state**: Write a summary to `production/session-state/active.md`

---

## Collaborative Protocol

This skill follows the collaborative design principle at every phase:

1. **Load context silently** — do not narrate file reads
2. **Present findings** — show the knowledge gap inventory and layer proposals
3. **Ask before deciding** — present options for each architectural choice via `vscode_askQuestions`
4. **Get approval before writing** — each phase section is written only after user approves
5. **Incremental writing** — write each approved section immediately; do not
   accumulate everything. This survives session crashes.

Never make a binding architectural decision without user input. If the user is
unsure, present 2-4 options with pros/cons before asking them to decide.

---

## Recommended Next Steps

- Run `/cc-architecture-decision [title]` for each required ADR listed in Phase 6 — Foundation layer ADRs first
---
name: cc-create-architecture
description: "Guided architecture document authoring"
---

# Create Architecture

This skill produces `docs/architecture/architecture.md` — the master architecture
document that translates all approved GDDs into a concrete technical blueprint.
It sits between design and implementation, and must exist before sprint planning begins.

**Distinct from architecture decisions**: ADRs record individual point decisions.
This skill creates the whole-system blueprint that gives ADRs their context.

Resolve the review mode (once, store for all gate spawns this run):
1. If `--review [full|lean|solo]` was passed → use that
2. Else use `file_search` to find `**/review-mode.txt`, then `read_file` → use that value
3. Else → default to `lean`

**Argument modes:**
- **No argument / `full`**: Full guided walkthrough — all sections, start to finish
- **`layers`**: Focus on the system layer diagram only
- **`data-flow`**: Focus on data flow between modules only
- **`api-boundaries`**: Focus on API boundary definitions only
- **`adr-audit`**: Audit existing ADRs for engine compatibility gaps only

---

## Phase 0: Load All Context

Before anything else, load the full project context in this order:

### 0a. Engine Context (Critical)

Read the engine reference library completely:

1. Use `read_file` on `docs/engine-reference/[engine]/VERSION.md`
   → Extract: engine name, version, LLM cutoff, post-cutoff risk levels
2. Use `read_file` on `docs/engine-reference/[engine]/breaking-changes.md`
   → Extract: all HIGH and MEDIUM risk changes
3. Use `read_file` on `docs/engine-reference/[engine]/deprecated-apis.md`
   → Extract: APIs to avoid
4. Use `read_file` on `docs/engine-reference/[engine]/current-best-practices.md`
   → Extract: post-cutoff best practices that differ from training data
5. Use `file_search` for `docs/engine-reference/[engine]/modules/*.md` and read all
   → Extract: current API patterns per domain

If no engine is configured, stop and prompt:
> "No engine is configured. Run `/cc-setup-engine` first. Architecture cannot be
> written without knowing which engine and version you are targeting."

### 0b. Design Context + Technical Requirements Extraction

Read all approved design documents and extract technical requirements from each:

1. Use `read_file` on `design/gdd/game-concept.md` — game pillars, genre, core loop
2. Use `read_file` on `design/gdd/systems-index.md` — all systems, dependencies, priority tiers
3. Use `read_file` on project technical preferences file — naming conventions, performance budgets,
   allowed libraries, forbidden patterns
4. **Every GDD in `design/gdd/`** — use `file_search` for `design/gdd/*.md`, then for each, extract:
   - Data structures implied by the game rules
   - Performance constraints stated or implied
   - Engine capabilities the system requires
   - Cross-system communication patterns
   - State that must persist (save/load implications)
   - Threading or timing requirements

Build a **Technical Requirements Baseline** — a flat list of all extracted
requirements across all GDDs, numbered `TR-[gdd-slug]-[NNN]`:

```
## Technical Requirements Baseline
Extracted from [N] GDDs | [X] total requirements

| Req ID | GDD | System | Requirement | Domain |
|--------|-----|--------|-------------|--------|
| TR-combat-001 | combat.md | Combat | Hitbox detection per-frame | Physics |
| TR-combat-002 | combat.md | Combat | Combo state machine | Core |
| TR-inventory-001 | inventory.md | Inventory | Item persistence | Save/Load |
```

This baseline feeds into every subsequent phase.

### 0c. Existing Architecture Decisions

Use `file_search` for `docs/architecture/*.md` to find existing ADRs. Read all and list their domains.

### 0d. Generate Knowledge Gap Inventory

Before proceeding, display a structured summary:

```
## Engine Knowledge Gap Inventory
Engine: [name + version]
LLM Training Covers: up to approximately [version]
Post-Cutoff Versions: [list]

### HIGH RISK Domains (must verify against engine reference before deciding)
- [Domain]: [Key changes]

### MEDIUM RISK Domains (verify key APIs)
- [Domain]: [Key changes]

### LOW RISK Domains (in training data, likely reliable)
- [Domain]: [no significant post-cutoff changes]

### Systems from GDD that touch HIGH/MEDIUM risk domains:
- [GDD system name] → [domain] → [risk level]
```

Ask: "This inventory identifies [N] systems in HIGH RISK engine domains. Shall I
continue building the architecture with these warnings flagged throughout?"

---

## Phase 1: System Layer Mapping

Map every system from `systems-index.md` into an architecture layer:

```
┌─────────────────────────────────────────────┐
│  PRESENTATION LAYER                         │  ← UI, HUD, menus, VFX, audio
├─────────────────────────────────────────────┤
│  FEATURE LAYER                              │  ← gameplay systems, AI, quests
├─────────────────────────────────────────────┤
│  CORE LAYER                                 │  ← physics, input, combat, movement
├─────────────────────────────────────────────┤
│  FOUNDATION LAYER                           │  ← engine integration, save/load,
│                                             │    scene management, event bus
├─────────────────────────────────────────────┤
│  PLATFORM LAYER                             │  ← OS, hardware, engine API surface
└─────────────────────────────────────────────┘
```

For each GDD system, ask:
- Which layer does it belong to?
- What are its module boundaries?
- What does it own exclusively? (data, state, behaviour)

Present the proposed layer assignment and ask for approval via `vscode_askQuestions` before
proceeding. Write the approved layer map immediately to the skeleton file.

**Engine awareness check**: For each system in Core and Foundation layers, flag if it
touches a HIGH or MEDIUM risk engine domain.

---

## Phase 2: Module Ownership Map

For each module defined in Phase 1, define ownership:

- **Owns**: what data and state this module is solely responsible for
- **Exposes**: what other modules may read or call
- **Consumes**: what it reads from other modules
- **Engine APIs used**: which specific engine classes/nodes/signals this module
  calls directly (with version and risk level noted)

Format as a table per layer, then as an ASCII dependency diagram.

**Engine awareness check**: For every engine API listed, verify against the relevant
module reference doc. If post-cutoff, flag it:

```
⚠️  [ClassName.method()] — [Engine] [version] (post-cutoff, HIGH risk)
    Verified against: docs/engine-reference/[engine]/modules/[domain].md
    Behaviour confirmed: [yes / NEEDS VERIFICATION]
```

Get user approval on the ownership map via `vscode_askQuestions` before writing.

---

## Phase 3: Data Flow

Define how data moves between modules during key game scenarios. Cover at minimum:

1. **Frame update path**: Input → Core systems → State → Rendering
2. **Event/signal path**: How systems communicate without tight coupling
3. **Save/load path**: What state is serialised, which module owns serialisation
4. **Initialisation order**: Which modules must boot before others

Use ASCII sequence diagrams where helpful. For each data flow:
- Name the data being transferred
- Identify the producer and consumer
- State whether this is synchronous call, signal/event, or shared state
- Flag any data flows that cross thread boundaries

Get user approval per scenario via `vscode_askQuestions` before writing.

---

## Phase 4: API Boundaries

Define the public contracts between modules. For each boundary:

- What is the interface a module exposes to the rest of the system?
- What are the entry points (functions/signals/properties)?
- What invariants must callers respect?
- What must the module guarantee to callers?

Write in pseudocode or the project's actual language (from technical preferences).
These become the contracts programmers implement against.

**Engine awareness check**: If any interface uses engine-specific types, flag the
version and verify the type exists and has not changed signature.

---

## Phase 5: ADR Audit + Traceability Check

Review all existing ADRs against the architecture built in Phases 1-4 AND the
Technical Requirements Baseline from Phase 0b.

### ADR Quality Check

For each ADR:
- [ ] Does it have an Engine Compatibility section?
- [ ] Is the engine version recorded?
- [ ] Are post-cutoff APIs flagged?
- [ ] Does it have a "GDD Requirements Addressed" section?
- [ ] Does it conflict with the layer/ownership decisions made in this session?
- [ ] Is it still valid for the pinned engine version?

| ADR | Engine Compat | Version | GDD Linkage | Conflicts | Valid |
|-----|--------------|---------|-------------|-----------|-------|
| ADR-0001: [title] | ✅/❌ | ✅/❌ | ✅/❌ | None/[conflict] | ✅/⚠️ |

### Traceability Coverage Check

Map every requirement from the Technical Requirements Baseline to existing ADRs:

| Req ID | Requirement | ADR Coverage | Status |
|--------|-------------|--------------|--------|
| TR-combat-001 | Hitbox detection per-frame | ADR-0003 | ✅ |
| TR-combat-002 | Combo state machine | — | ❌ GAP |

Count: X covered, Y gaps. Each gap becomes a **Required New ADR**.

### Required New ADRs

List all uncovered Technical Requirements. Group by layer — Foundation first:

**Foundation Layer (must create before coding):**
- Architecture decision needed → covers: TR-[id], TR-[id]

**Core Layer:**
- Architecture decision needed → covers: TR-[id]

---

## Phase 6: Missing ADR List

Based on the full architecture, produce a complete list of ADRs needed but missing.
Group by priority:

**Must have before coding starts (Foundation & Core):**
- [e.g. "Scene management and scene loading strategy"]
- [e.g. "Event bus vs direct signal architecture"]

**Should have before the relevant system is built:**
- [e.g. "Inventory serialisation format"]

**Can defer to implementation:**
- [e.g. "Specific shader technique for water"]

---

## Phase 7: Write the Master Architecture Document

Once all sections are approved, write the complete document to
`docs/architecture/architecture.md`.

Ask via `vscode_askQuestions`: "May I write the master architecture document to
`docs/architecture/architecture.md`?"

The document structure:

```markdown
# [Game Name] — Master Architecture

## Document Status
- Version: [N]
- Last Updated: [date]
- Engine: [name + version]
- GDDs Covered: [list]
- ADRs Referenced: [list]

## Engine Knowledge Gap Summary
[Condensed from Phase 0d inventory]

## System Layer Map
[From Phase 1]

## Module Ownership
[From Phase 2]

## Data Flow
[From Phase 3]

## API Boundaries
[From Phase 4]

## ADR Audit
[From Phase 5]

## Required ADRs
[From Phase 6]

## Architecture Principles
[3-5 key principles governing all technical decisions]

## Open Questions
[Decisions deferred — must be resolved before the relevant layer is built]
```

---

## Phase 7b: Technical Director Sign-Off + Lead Programmer Feasibility Review

After writing the master architecture document, perform an explicit sign-off.

**Step 1 — Technical Director self-review** (this skill runs as cc-technical-director):
Apply gate **TD-ARCHITECTURE** as a self-review.

**Review mode check** — apply before spawning cc-lead-programmer:
- `solo` → skip. Note: "LP-FEASIBILITY skipped — Solo mode."
- `lean` → skip (not a PHASE-GATE). Note: "LP-FEASIBILITY skipped — Lean mode."
- `full` → spawn `cc-lead-programmer` via `runSubagent` for gate LP-FEASIBILITY.
  Pass: architecture document path, technical requirements summary, ADR list.

**Step 3 — Present assessments and ask via `vscode_askQuestions`:**
"Technical Director and Lead Programmer have reviewed the architecture. How would you like to proceed?"
Options: `Accept — proceed to handoff` / `Revise flagged items first` / `Discuss specific concerns`

**Step 4 — Record sign-off in the architecture document.**

---

## Phase 8: Handoff

After writing the document, provide a clear handoff:

1. **Run these ADRs next** (from Phase 6, prioritised): list the top 3
2. **Gate check**: "The master architecture document is complete. Run `/cc-gate-check
   pre-production` when all required ADRs are also written."
3. **Update session state**: Write a summary to `production/session-state/active.md`

---

## Collaborative Protocol

This skill follows the collaborative design principle at every phase:

1. **Load context silently** — do not narrate file reads
2. **Present findings** — show the knowledge gap inventory and layer proposals
3. **Ask before deciding** — present options for each architectural choice using `vscode_askQuestions`
4. **Get approval before writing** — each phase section is written only after user approves
5. **Incremental writing** — write each approved section immediately

Never make a binding architectural decision without user input. If unsure,
present 2-4 options with pros/cons before asking.

---

## Recommended Next Steps

- Run `/cc-architecture-decision [title]` for each required ADR listed in Phase 6 — Foundation layer ADRs first
- Run `/cc-gate-check pre-production` when all required ADRs are written
- Run `/cc-create-control-manifest` to extract actionable programmer rules from accepted ADRs
