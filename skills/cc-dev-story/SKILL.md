---
name: cc-dev-story
description: "Read a story file and implement it"
---

# Dev Story

This skill bridges planning and code. It reads a story file in full, assembles
all the context a programmer needs, routes to the correct specialist agent, and
drives implementation to completion — including writing the test.

**The loop for every story:**
```
/cc-qa-plan sprint           ← define test requirements before sprint begins
/cc-story-readiness [path]   ← validate before starting
/cc-dev-story [path]         ← implement it  (this skill)
/cc-code-review [files]      ← review it
/cc-story-done [path]        ← verify and close it
```

**After all sprint stories are done:** run `/cc-team-qa sprint` for the full QA cycle.

**Output:** Source code + test file in the project's `src/` and `tests/` directories.

---

## Phase 1: Find the Story

**If a path is provided**: use `read_file` to read that file directly.

**If no argument**: use `read_file` on `production/session-state/active.md` for the
active story. If found, confirm: "Continuing work on [story title] — is that correct?"
If not found, ask: "Which story are we implementing?" Use `file_search` for
`production/epics/**/*.md` and list stories with Status: Ready.

---

## Phase 2: Load Full Context

**Before loading any context, verify required files exist.** Extract the ADR path
from the story's `ADR Governing Implementation` field, then check:

| File | Path | If missing |
|------|------|------------|
| TR registry | `docs/architecture/tr-registry.yaml` | **STOP** — "TR registry not found. Run `/cc-create-epics` to generate it." |
| Governing ADR | path from story's ADR field | **STOP** — "ADR file [path] not found. Run `/cc-architecture-decision` to create it." |
| Control manifest | `docs/architecture/control-manifest.md` | **WARN and continue** — "Control manifest not found. Run `/cc-create-control-manifest`." |

If the TR registry or governing ADR is missing, set story status to **BLOCKED**
and do not spawn any programmer agent.

Read all of the following simultaneously — do not start implementation until all
context is loaded:

### The story file
Extract and hold:
- **Story title, ID, layer, type** (Logic / Integration / Visual/Feel / UI / Config/Data)
- **TR-ID** — the GDD requirement identifier
- **Governing ADR** reference
- **Manifest Version** embedded in story header
- **Acceptance Criteria** — every checkbox item, verbatim
- **Implementation Notes** — the ADR guidance section
- **Out of Scope** boundaries
- **Test Evidence** — the required test file path
- **Dependencies** — what must be DONE before this story

### The TR registry
Use `read_file` on `docs/architecture/tr-registry.yaml`. Look up the story's TR-ID.
Read the current `requirement` text — this is the source of truth.

### The governing ADR
Use `read_file` on `docs/architecture/[adr-file].md`. Extract:
- The full Decision section
- The Implementation Guidelines section
- The Engine Compatibility section
- The ADR Dependencies section

### The control manifest
Use `read_file` on `docs/architecture/control-manifest.md`. Extract rules for this story's layer:
- Required patterns
- Forbidden patterns
- Performance guardrails

Check: does the story's embedded Manifest Version match the current manifest header date?
If they differ, use `vscode_askQuestions`:
- Prompt: "Story was written against manifest v[story-date]. Current manifest is v[current-date]. New rules may apply."
- Options:
  - `[A] Update story manifest version and implement with current rules (Recommended)`
  - `[B] Implement with old rules — I accept the risk`
  - `[C] Stop here — I want to review the manifest diff first`

### Dependency validation

After extracting **Dependencies** from the story file, validate each:

1. Use `file_search` for `production/epics/**/*.md` to find each dependency story file.
2. Use `read_file` to check its `Status:` field.
3. If any dependency is not `Complete` or `Done`:
   - Use `vscode_askQuestions`:
     - Prompt: "Story depends on '[dependency title]' which is [status], not Complete."
     - Options:
       - `[A] Proceed anyway — I accept the dependency risk`
       - `[B] Stop — I'll complete the dependency first`
       - `[C] The dependency is done but status wasn't updated — mark it Complete`
   - If [B]: set story to **BLOCKED** and stop.
   - If [C]: ask "May I update [dependency path] Status to Complete?"

### Engine reference
Use `read_file` on project technical preferences:
- `Engine:` value — determines which programmer agents to use
- Naming conventions
- Performance budgets
- Forbidden patterns

---

## Phase 3: Route to the Right Programmer

Based on the story's **Layer**, **Type**, and **system name**, determine which
specialist to spawn via `runSubagent`.

**Config/Data stories — skip agent spawning entirely:**
If Type is `Config/Data`, jump directly to Phase 4 (Config/Data note).

### Primary agent routing table

| Story context | Primary agent |
|---|---|
| Foundation layer — any type | `cc-engine-programmer` |
| Any layer — Type: UI | `cc-ui-programmer` |
| Any layer — Type: Visual/Feel | `cc-gameplay-programmer` (implements) |
| Core or Feature — gameplay mechanics | `cc-gameplay-programmer` |
| Core or Feature — AI behaviour, pathfinding | `cc-ai-programmer` |
| Core or Feature — networking, replication | `cc-network-programmer` |
| Config/Data — no code | No agent needed (see Phase 4 Config note) |

### Engine specialist — always spawn as secondary for code stories

| Engine | Specialist agents available |
|--------|----------------------------|
| Godot 4 | `cc-godot-specialist`, `cc-godot-gdscript-specialist`, `cc-godot-shader-specialist` |
| Unity | `cc-unity-specialist`, `cc-unity-ui-specialist`, `cc-unity-shader-specialist` |
| Unreal Engine | `cc-unreal-specialist`, `cc-ue-gas-specialist`, `cc-ue-blueprint-specialist` |

**When engine risk is HIGH**: always spawn the engine specialist, even for
non-engine-facing stories.

---

## Phase 4: Implement

Spawn the chosen programmer agent(s) via `runSubagent` with the full context package:

Provide the agent with:
1. The complete story file content
2. The current GDD requirement text (from TR registry)
3. The ADR Decision + Implementation Guidelines (verbatim)
4. The control manifest rules for this layer
5. The engine naming conventions and performance budgets
6. Engine-specific notes from the ADR Engine Compatibility section
7. The test file path that must be created
8. Explicit instruction: **implement this story and write the test**

The agent should:
- Create or modify files in `src/` following the ADR guidelines
- Respect all Required and Forbidden patterns from the control manifest
- Stay within the story's Out of Scope boundaries
- Write clean, doc-commented public APIs

### Config/Data stories (no agent needed)

For Type: Config/Data, no programmer agent is required. Read the story's acceptance
criteria and make the specified changes to the data file directly.

### Visual/Feel stories

Spawn `cc-gameplay-programmer` via `runSubagent`. Note that Visual/Feel acceptance criteria cannot
be auto-verified — the "does it feel right?" check happens in `/cc-story-done`.

---

## Phase 5: Write the Test

For **Logic** and **Integration** stories, the test must be written as part of
implementation — not deferred.

Remind the programmer agent:

> "The test file for this story is required at: `[path from Test Evidence section]`.
> The story cannot be closed via `/cc-story-done` without it."

Test requirements:
- File name: `[system]_[feature]_test.[ext]`
- Function names: `test_[scenario]_[expected_outcome]`
- Each acceptance criterion must have at least one test function
- No random seeds, no time-dependent assertions, no external I/O
- Test the formula bounds from the GDD Formulas section

For **Visual/Feel** and **UI** stories: no automated test. Note manual evidence path:
"Evidence doc required at `production/qa/evidence/[slug]-evidence.md`."

For **Config/Data** stories: no test file. Smoke check serves as evidence.

---

## Phase 6: Collect and Summarise

After the programmer agent(s) complete, collect:

- Files created or modified (with paths)
- Test file created (path and number of test functions)
- Any deviations from Out of Scope boundary
- Any questions or blockers the agent surfaced
- Any engine-specific risks flagged

Present a concise implementation summary:

```
## Implementation Complete: [Story Title]

**Files changed**:
- `src/[path]` — created / modified ([brief description])
- `tests/[path]` — test file ([N] test functions)

**Acceptance criteria covered**:
- [x] [criterion] — implemented in [file:function]
- [x] [criterion] — covered by test [test_name]
- [ ] [criterion] — DEFERRED: requires playtest (Visual/Feel)

**Deviations from scope**: [None] or [list]
**Engine risks flagged**: [None] or [specialist finding]
**Blockers**: [None] or [describe]

Ready for: `/cc-code-review [file1] [file2]` then `/cc-story-done [story-path]`
```

---

## Phase 7: Update Session State

Update `production/session-state/active.md`:

```
## Session Extract — /cc-dev-story [date]
- Story: [story-path] — [story title]
- Files changed: [comma-separated list]
- Test written: [path, or "None — Visual/Feel/Config story"]
- Blockers: [None, or description]
- Next: /cc-code-review [files] then /cc-story-done [story-path]
```

Use `file_search` to check if `active.md` exists. Use `create_file` if absent,
`replace_string_in_file` if present.

---

## Error Recovery Protocol

If any spawned agent returns BLOCKED, errors, or cannot complete:

1. **Surface immediately**: Report "[AgentName]: BLOCKED — [reason]"
2. **Assess dependencies**: Check whether the blocked agent's output is required by later phases
3. **Offer options** via `vscode_askQuestions`:
   - Skip this agent and note the gap
   - Retry with narrower scope
   - Stop here and resolve the blocker first
4. **Always produce a partial report** — never discard work because one agent blocked

Common blockers:
- Input file missing → redirect to the skill that creates it
- ADR status is Proposed → run `/cc-architecture-decision` first
- Scope too large → split into two stories via `/cc-create-stories`
- Conflicting instructions → surface the conflict, do not guess
- Manifest version mismatch → show diff, ask user

## Collaborative Protocol

- **File writes are delegated** — source code, tests, evidence docs written by sub-agents via `runSubagent`
- **Load before implementing** — do not start coding until all context is loaded
- **The ADR is the law** — follow Implementation Guidelines; flag conflicts in summary
- **Stay in scope** — if implementation requires out-of-scope changes, surface it:
  "Implementing [criterion] requires modifying [file], which is out of scope."
- **Test is not optional for Logic/Integration** — do not mark complete without test
- **Visual/Feel criteria are deferred, not skipped** — mark DEFERRED in summary
- **Ask before large structural decisions** — if the story requires a pattern not in the ADR, ask first

---

## Recommended Next Steps

- Run `/cc-code-review [file1] [file2]` to review the implementation
- Run `/cc-story-done [story-path]` to verify acceptance criteria and close
- After all sprint stories: run `/cc-team-qa sprint` for QA cycle before advancing stage
