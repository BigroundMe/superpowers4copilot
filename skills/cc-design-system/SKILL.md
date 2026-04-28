---
name: cc-design-system
description: "Guided GDD authoring for a single game system"
---

When this skill is invoked:

## 1. Parse Arguments & Validate

Resolve the review mode (once, store for all gate spawns this run):
1. If `--review [full|lean|solo]` was passed → use that
2. Else use `file_search` to find `**/review-mode.txt`, then `read_file` → use that value
3. Else → default to `lean`

A system name or retrofit path is **required**. If missing:

1. Check if `design/gdd/systems-index.md` exists.
2. If it exists: read it, find the highest-priority system with status "Not Started" or equivalent, and use `vscode_askQuestions`:
   - Prompt: "The next system in your design order is **[system-name]** ([priority] | [layer]). Start designing it?"
   - Options: `[A] Yes — design [system-name]` / `[B] Pick a different system` / `[C] Stop here`
   - If [A]: proceed with that system name. If [B]: ask which system to design (plain text). If [C]: exit.
3. If no systems index exists, fail with:
   > "Usage: `/cc-design-system <system-name>` — e.g., `/cc-design-system movement`
   > Or to fill gaps in an existing GDD: `/cc-design-system retrofit design/gdd/[system-name].md`
   > No systems index found. Run `/cc-map-systems` first to map your systems and get the design order."

**Detect retrofit mode:**
If the argument starts with `retrofit` or the argument is a file path to an
existing `.md` file in `design/gdd/`, enter **retrofit mode**:

1. Use `read_file` to read the existing GDD file.
2. Identify which of the 8 required sections are present (scan for section headings).
   Required sections: Overview, Player Fantasy, Detailed Design/Rules, Formulas,
   Edge Cases, Dependencies, Tuning Knobs, Acceptance Criteria.
3. Identify which sections contain only placeholder text (`[To be designed]` or
   equivalent — blank, a single line, or obviously incomplete).
4. Present to the user before doing anything:
   ```
   ## Retrofit: [System Name]
   File: design/gdd/[filename].md

   Sections already written (will not be touched):
   ✓ [section name]
   ✓ [section name]

   Missing or incomplete sections (will be authored):
   ✗ [section name] — missing
   ✗ [section name] — placeholder only
   ```
5. Ask: "Shall I fill the [N] missing sections? I will not modify any existing content."
6. If yes: proceed to **Phase 2 (Gather Context)** as normal, but in **Phase 3**
   skip creating the skeleton (file already exists) and in **Phase 4** skip
   sections that are already complete. Only run the section cycle for missing/
   incomplete sections.
7. **Never overwrite existing section content.** Use `replace_string_in_file` to replace only
   `[To be designed]` placeholders or empty section bodies.

If NOT in retrofit mode, normalize the system name to kebab-case for the
filename (e.g., "combat system" becomes `combat-system`).

---

## 2. Gather Context (Read Phase)

Read all relevant context **before** asking the user anything. This is the skill's
primary advantage over ad-hoc design — it arrives informed.

### 2a: Required Reads

- **Game concept**: Use `read_file` to read `design/gdd/game-concept.md` — fail if missing:
  > "No game concept found. Run `/cc-brainstorm` first."
- **Systems index**: Use `read_file` to read `design/gdd/systems-index.md` — fail if missing:
  > "No systems index found. Run `/cc-map-systems` first to map your systems."
- **Target system**: Find the system in the index. If not listed, warn:
  > "[system-name] is not in the systems index. Would you like to add it, or
  > design it as an off-index system?"
- **Entity registry**: Use `read_file` to read `design/registry/entities.yaml` if it exists.
  Extract all entries referenced by or relevant to this system (use `grep_search`
  for `referenced_by.*[system-name]` and `source.*[system-name]`). Hold these
  in context as **known facts** — values that other GDDs have already
  established and this GDD must not contradict.
- **Reflexion log**: Use `read_file` to read `docs/consistency-failures.md` if it exists.
  Extract entries whose Domain matches this system's category. These are
  recurring conflict patterns — present them under "Past failure patterns"
  in the Phase 2d context summary so the user knows where mistakes have
  occurred before in this domain.

### 2b: Dependency Reads

From the systems index, identify:
- **Upstream dependencies**: Systems this one depends on. Read their GDDs if they
  exist (these contain decisions this system must respect).
- **Downstream dependents**: Systems that depend on this one. Read their GDDs if
  they exist (these contain expectations this system must satisfy).

For each dependency GDD that exists, extract and hold in context:
- Key interfaces (what data flows between the systems)
- Formulas that reference this system's outputs
- Edge cases that assume this system's behavior
- Tuning knobs that feed into this system

### 2c: Optional Reads

- **Game pillars**: Use `read_file` to read `design/gdd/game-pillars.md` if it exists
- **Existing GDD**: Use `read_file` to read `design/gdd/[system-name].md` if it exists (resume, don't
  restart from scratch)
- **Related GDDs**: Use `file_search` for `design/gdd/*.md` and read any that are thematically related

### 2d: Present Context Summary

Before starting design work, present a brief summary to the user:

> **Designing: [System Name]**
> - Priority: [from index] | Layer: [from index]
> - Depends on: [list, noting which have GDDs vs. undesigned]
> - Depended on by: [list, noting which have GDDs vs. undesigned]
> - Existing decisions to respect: [key constraints from dependency GDDs]
> - Pillar alignment: [which pillar(s) this system primarily serves]
> - **Known cross-system facts (from registry):**
>   - [entity_name]: [attribute]=[value], [attribute]=[value] (owned by [source GDD])
>   *(These values are locked — if this GDD needs different values, surface
>   the conflict before writing. Do not silently use different numbers.)*

If any upstream dependencies are undesigned, warn:
> "[dependency] doesn't have a GDD yet. We'll need to make assumptions about
> its interface. Consider designing it first, or we can define the expected
> contract and flag it as provisional."

### 2e: Technical Feasibility Pre-Check

Before asking the user to begin designing, load engine context and surface any
constraints or knowledge gaps that will shape the design.

**Step 1 — Determine the engine domain for this system:**
Map the system's category (from systems-index.md) to an engine domain:

| System Category | Engine Domain |
|----------------|--------------|
| Combat, physics, collision | Physics |
| Rendering, visual effects, shaders | Rendering |
| UI, HUD, menus | UI |
| Audio, sound, music | Audio |
| AI, pathfinding, behavior trees | Navigation / Scripting |
| Animation, IK, rigs | Animation |
| Networking, multiplayer, sync | Networking |
| Input, controls, keybinding | Input |
| Save/load, persistence, data | Core |
| Dialogue, quests, narrative | Scripting |

**Step 2 — Read engine context (if available):**
- Use `read_file` to read `.claude/docs/technical-preferences.md` (or project equivalent) to identify the engine and version
- If engine is configured, read `docs/engine-reference/[engine]/VERSION.md`
- Read `docs/engine-reference/[engine]/modules/[domain].md` if it exists
- Read `docs/engine-reference/[engine]/breaking-changes.md` for domain-relevant entries
- Use `file_search` for `docs/architecture/adr-*.md` and read any ADRs whose domain matches

**Step 3 — Present the Feasibility Brief:**

If engine reference docs exist, present before starting design:

```
## Technical Feasibility Brief: [System Name]
Engine: [name + version]
Domain: [domain]

### Known Engine Capabilities (verified for [version])
- [capability relevant to this system]

### Engine Constraints That Will Shape This Design
- [constraint from engine-reference or existing ADR]

### Knowledge Gaps (verify before committing to these)
- [post-cutoff feature this design might rely on — mark HIGH/MEDIUM risk]

### Existing ADRs That Constrain This System
- ADR-XXXX: [decision summary] — means [implication for this GDD]
  (or "None yet")
```

If no engine reference docs exist (engine not yet configured), show a short note:
> "No engine configured yet — skipping technical feasibility check. Run
> `/cc-setup-engine` before moving to architecture if you haven't already."

**Step 4 — Ask before proceeding:**

Use `vscode_askQuestions`:
- "Any constraints to add before we begin, or shall we proceed with these noted?"
  - Options: "Proceed with these noted", "Add a constraint first", "I need to check the engine docs — pause here"

Use `vscode_askQuestions`:
- "Ready to start designing [system-name]?"
  - Options: "Yes, let's go", "Show me more context first", "Design a dependency first"

---

## 3. Create File Skeleton

Once the user confirms, **immediately** create the GDD file with empty section
headers. This ensures incremental writes have a target.

```markdown
# [System Name]

> **Status**: In Design
> **Author**: [user + agents]
> **Last Updated**: [today's date]
> **Implements Pillar**: [from context]

## Overview

[To be designed]

## Player Fantasy

[To be designed]

## Detailed Design

### Core Rules

[To be designed]

### States and Transitions

[To be designed]

### Interactions with Other Systems

[To be designed]

## Formulas

[To be designed]

## Edge Cases

[To be designed]

## Dependencies

[To be designed]

## Tuning Knobs

[To be designed]

## Visual/Audio Requirements

[To be designed]

## UI Requirements

[To be designed]

## Acceptance Criteria

[To be designed]

## Open Questions

[To be designed]
```

Ask: "May I create the skeleton file at `design/gdd/[system-name].md`?"

After writing, update `production/session-state/active.md`:
- Use `file_search` to check if the file exists.
- If it **does not exist**: use `create_file` to create it. Never attempt edit on a file that may not exist.
- If it **already exists**: use `replace_string_in_file` to update the relevant fields.

File content:
- Task: Designing [system-name] GDD
- Current section: Starting (skeleton created)
- File: design/gdd/[system-name].md

---

## 4. Section-by-Section Design

Walk through each section in order. For **each section**, follow this cycle:

### The Section Cycle

```
Context  ->  Questions  ->  Options  ->  Decision  ->  Draft  ->  Approval  ->  Write
```

1. **Context**: State what this section needs to contain, and surface any relevant
   decisions from dependency GDDs that constrain it.

2. **Questions**: Ask clarifying questions specific to this section. Use
   `vscode_askQuestions` for constrained questions, conversational text for open-ended
   exploration.

3. **Options**: Where the section involves design choices (not just documentation),
   present 2-4 approaches with pros/cons. Explain reasoning in conversation text,
   then use `vscode_askQuestions` to capture the decision.

4. **Decision**: User picks an approach or provides custom direction.

5. **Draft**: Write the section content in conversation text for review. Flag any
   provisional assumptions about undesigned dependencies.

6. **Approval**: Immediately after the draft — in the SAME response — use
   `vscode_askQuestions`. **NEVER use plain text. NEVER skip this step.**
   - Prompt: "Approve the [Section Name] section?"
   - Options: `[A] Approve — write it to file` / `[B] Make changes — describe what to fix` / `[C] Start over`

   **The draft and the approval widget MUST appear together in one response.**

7. **Write**: Use `replace_string_in_file` to replace the placeholder with the approved content.
   **CRITICAL**: Always include the section heading in the `oldString` to ensure
   uniqueness — never match `[To be designed]` alone, as multiple sections use the
   same placeholder and the tool requires a unique match. Use this pattern:
   ```
   oldString: "## [Section Name]\n\n[To be designed]"
   newString: "## [Section Name]\n\n[approved content]"
   ```
   Confirm the write.

8. **Registry conflict check** (Sections C and D only — Detailed Design and Formulas):
   After writing, scan the section content for entity names, item names, formula
   names, and numeric constants that appear in the registry. For each match:
   - Compare the value just written against the registry entry.
   - If they differ: **surface the conflict immediately** before starting the next section.
   - If new (not in registry): flag it as a candidate for registry registration
     (will be handled in Phase 5).

After writing each section, update `production/session-state/active.md` with the
completed section name.

### Section-Specific Guidance

Each section has unique design considerations and may benefit from specialist agents:

---

### Section A: Overview

**Goal**: One paragraph a stranger could read and understand.

**Derive recommended options before building the widget**: Read the system's category and layer from the systems index, then determine the recommended option for each question.

**Framing questions (ask BEFORE drafting)**: Use `vscode_askQuestions` with options:
- "How should the overview frame this system?" Options: `[A] As a data/infrastructure layer (technical framing)` / `[B] Through its player-facing effect (design framing)` / `[C] Both`
- "Should the overview reference the existing ADR for this system?" Options: `[A] Yes — cite the ADR` / `[B] No — keep at pure design level`
- "Does this system have a player fantasy worth stating?" Options: `[A] Yes — players feel it directly` / `[B] No — pure infrastructure`

**Questions to ask**:
- What is this system in one sentence?
- How does a player interact with it? (active/passive/automatic)
- Why does this system exist — what would the game lose without it?

**Cross-reference**: Check that the description aligns with how the systems index
describes it. Flag discrepancies.

**Design vs. implementation boundary**: Overview questions must stay at the behavior
level — what the system *does*, not *how it is built*.

---

### Section B: Player Fantasy

**Goal**: The emotional target — what the player should *feel*.

**Framing question (ask BEFORE drafting)**: Use `vscode_askQuestions`:
- "Is this system something the player engages with directly, or infrastructure they experience indirectly?"
- Options: `[A] Direct — player actively uses or feels this system` / `[B] Indirect — player experiences the effects, not the system` / `[C] Both`

**Questions to ask**:
- What emotion or power fantasy does this serve?
- What reference games nail this feeling? What specifically creates it?
- Is this a "system you love engaging with" or "infrastructure you don't notice"?

**Agent delegation (MANDATORY)**: After the framing answer is given but before drafting,
spawn `cc-creative-director` via `runSubagent`:
- Provide: system name, framing answer, game pillars, any reference games the user mentioned, the game concept summary
- Ask: "Shape the Player Fantasy for this system. What emotion should it serve? What player moment to anchor to? Give 2-3 candidate framings."
- Present the `cc-creative-director`'s framings to the user alongside the draft.

**Do NOT draft Section B without first consulting `cc-creative-director`.**

**Cross-reference**: Must align with the game pillars.

---

### Section C: Detailed Design (Core Rules, States, Interactions)

**Goal**: Unambiguous specification a programmer could implement without questions.

Break it into sub-sections:

1. **Core Rules**: The fundamental mechanics. Use numbered rules for sequential
   processes, bullets for properties.
2. **States and Transitions**: If the system has states, map every state and
   every valid transition. Use a table.
3. **Interactions with Other Systems**: For each dependency, specify what data
   flows in, what flows out, and who owns the interface.

**Questions to ask**:
- Walk me through a typical use of this system, step by step
- What are the decision points the player faces?
- What can the player NOT do? (Constraints are as important as capabilities)

**Agent delegation (MANDATORY)**: Before drafting Section C, spawn specialist agents via `runSubagent` in parallel:
- Look up the system category in the routing table (Section 6)
- Spawn the Primary Agent AND Supporting Agent(s) listed for this category
- Provide each agent: system name, game concept summary, pillar set, dependency GDD excerpts
- Collect their findings before drafting
- Surface any disagreements between agents to the user via `vscode_askQuestions`

**Do NOT draft Section C without first consulting the appropriate specialists.**

**Cross-reference**: For each interaction listed, verify it matches what the
dependency GDD specifies. Flag conflicts.

---

### Section D: Formulas

**Goal**: Every mathematical formula, with variables defined, ranges specified.

**Completion Steering — always begin each formula with this exact structure:**

```
The [formula_name] formula is defined as:

`[formula_name] = [expression]`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| [name] | [sym] | float/int | [min–max] | [what it represents] |

**Output Range:** [min] to [max] under normal play; [behaviour at extremes]
**Example:** [worked example with real numbers]
```

Do NOT write `[Formula TBD]` or describe a formula in prose without the variable table.

**Questions to ask**:
- What are the core calculations this system performs?
- Should scaling be linear, logarithmic, or stepped?
- What should the output ranges be at early/mid/late game?

**Agent delegation (MANDATORY)**: Before proposing any formulas, spawn specialist agents via `runSubagent` in parallel:
- **Always spawn `cc-systems-designer`**: provide Core Rules from Section C, tuning goals, balance context.
- **For economy/cost systems, also spawn `cc-economy-designer`**: provide cost intent and progression goals.
- Present the specialists' proposals to the user via `vscode_askQuestions`

**Do NOT invent formula values or balance numbers without specialist input.**

**Cross-reference**: If a dependency GDD defines a formula whose output feeds into
this system, reference it explicitly. Don't reinvent — connect.

---

### Section E: Edge Cases

**Goal**: Explicitly handle unusual situations so they don't become bugs.

**Completion Steering — format each edge case as:**
- **If [condition]**: [exact outcome]. [rationale if non-obvious]

Do NOT write vague entries like "handle appropriately" — each must name the exact
condition and the exact resolution.

**Questions to ask**:
- What happens at zero? At maximum? At out-of-range values?
- What happens when two rules apply at the same time?
- What happens if a player finds an unintended interaction?

**Agent delegation (MANDATORY)**: Spawn `cc-systems-designer` via `runSubagent` before finalising edge cases. For narrative systems, also spawn `cc-narrative-director`. Present their findings and ask the user which to include.

**Cross-reference**: Check edge cases against dependency GDDs.

---

### Section F: Dependencies

**Goal**: Map every system connection with direction and nature.

This section is partially pre-filled from the context gathering phase. Present the
known dependencies from the systems index and ask:
- Are there dependencies I'm missing?
- For each dependency, what's the specific data interface?
- Which dependencies are hard vs. soft?

**Cross-reference**: This section must be bidirectionally consistent. Flag one-directional dependencies for correction.

---

### Section G: Tuning Knobs

**Goal**: Every designer-adjustable value, with safe ranges and extreme behaviors.

**Questions to ask**:
- What values should designers be able to tweak without code changes?
- For each knob, what breaks if it's set too high? Too low?
- Which knobs interact with each other?

**Agent delegation**: If formulas are complex, delegate to `cc-systems-designer`
to derive tuning knobs from the formula variables.

**Cross-reference**: If a dependency GDD lists tuning knobs that affect this system,
reference them here. Don't create duplicate knobs.

---

### Section H: Acceptance Criteria

**Goal**: Testable conditions that prove the system works as designed.

**Completion Steering — format each criterion as Given-When-Then:**
- **GIVEN** [initial state], **WHEN** [action or trigger], **THEN** [measurable outcome]

Include at least: one criterion per core rule from Section C, and one per formula
from Section D. Do NOT write "the system works as designed" — every criterion must
be independently verifiable.

**Agent delegation (MANDATORY)**: Spawn `cc-qa-lead` via `runSubagent` before finalising acceptance criteria. Provide: completed GDD sections C, D, E. Surface any gaps or untestable criteria to the user.

**Questions to ask**:
- What's the minimum set of tests that prove this works?
- What performance budget does this system get?
- What would a QA tester check first?

**Cross-reference**: Include criteria that verify cross-system interactions.

---

### Optional Sections: Visual/Audio, UI Requirements, Open Questions

**Visual/Audio is REQUIRED for visual system categories** (Combat, UI, Animation, VFX, Character, Dialogue, Level/world). For required systems: spawn `cc-art-director` via `runSubagent` before drafting. For all other categories, offer optionally via `vscode_askQuestions`.

> **Asset Spec Flag**: After Visual/Audio is written, output:
> "Asset Spec — Visual/Audio requirements are defined. After the art bible is approved, run `/cc-asset-spec system:[system-name]` to produce per-asset visual descriptions."

For **UI Requirements**: After writing, if real UI content exists, output:
> **UX Flag — [System Name]**: This system has UI requirements. In Pre-Production,
> run `/cc-ux-design` to create a UX spec before writing epics.

For **Open Questions**: Capture anything unresolved with owner and target date.

---

## 5. Post-Design Validation

### 5a: Self-Check

Use `read_file` to read back the complete GDD from file (not from conversation memory). Verify:
- All 8 required sections have real content
- Formulas reference defined variables
- Edge cases have resolutions
- Dependencies are listed with interfaces
- Acceptance criteria are testable

### 5a-bis: Creative Director Pillar Review

**Review mode check**:
- `solo` → skip. Note: "CD-GDD-ALIGN skipped — Solo mode."
- `lean` → skip (not a PHASE-GATE). Note: "CD-GDD-ALIGN skipped — Lean mode."
- `full` → spawn `cc-creative-director` via `runSubagent` for gate **CD-GDD-ALIGN**. Pass: completed GDD file path, game pillars, MDA aesthetics target.

### 5b: Update Entity Registry

Scan the completed GDD for cross-system facts that should be registered:
- Named entities with stats or drops
- Named items with values
- Named formulas with defined variables and output ranges
- Named constants referenced by value in more than one place

For each candidate, use `grep_search` to check `design/registry/entities.yaml`.

Present a summary of NEW entries and ALREADY REGISTERED entries.

Ask: "May I update `design/registry/entities.yaml` with these entries?"

### 5c: Offer Design Review

Present a completion summary:

> **GDD Complete: [System Name]**
> - Sections written: [list]
> - Provisional assumptions: [list]
> - Cross-system conflicts found: [list or "none"]

> **To validate this GDD, run `/cc-design-review design/gdd/[system-name].md` in a fresh session.**
>
> **Never run `/cc-design-review` in the same session as `/cc-design-system`.** The reviewing
> agent must be independent of the authoring context.

### 5d: Update Systems Index

After the GDD is complete:

- Use `read_file` to read the systems index
- Update the target system's status and link
- Ask: "May I update the systems index at `design/gdd/systems-index.md`?"

### 5e: Suggest Next Steps

Use `vscode_askQuestions`:
- "What's next?"
  - Options:
    - "Run `/cc-consistency-check`" — verify values don't conflict with existing GDDs
    - "Design next system ([next-in-order])"
    - "Fix review findings"
    - "Stop here for this session"
    - "Run `/cc-gate-check`" — if enough MVP systems are designed

---

## 6. Specialist Agent Routing

| System Category | Primary Agent | Supporting Agent(s) |
|----------------|---------------|---------------------|
| **Foundation/Infrastructure** | `cc-systems-designer` | `cc-gameplay-programmer`, `cc-engine-programmer` |
| Combat, damage, health | `cc-game-designer` | `cc-systems-designer`, `cc-ai-programmer`, `cc-art-director` |
| Economy, loot, crafting | `cc-economy-designer` | `cc-systems-designer`, `cc-game-designer` |
| Progression, XP, skills | `cc-game-designer` | `cc-systems-designer`, `cc-economy-designer` |
| Dialogue, quests, lore | `cc-game-designer` | `cc-narrative-director`, `cc-writer`, `cc-art-director` |
| UI systems (HUD, menus) | `cc-game-designer` | `cc-ux-designer`, `cc-ui-programmer`, `cc-art-director`, `cc-technical-artist` |
| Audio systems | `cc-game-designer` | `cc-audio-director`, `cc-sound-designer` |
| AI, pathfinding, behavior | `cc-game-designer` | `cc-ai-programmer`, `cc-systems-designer` |
| Level/world systems | `cc-game-designer` | `cc-level-designer`, `cc-world-builder` |
| Camera, input, controls | `cc-game-designer` | `cc-ux-designer`, `cc-gameplay-programmer` |
| Animation, character movement | `cc-game-designer` | `cc-art-director`, `cc-technical-artist`, `cc-gameplay-programmer` |
| Visual effects, particles, shaders | `cc-game-designer` | `cc-art-director`, `cc-technical-artist`, `cc-systems-designer` |
| Character systems | `cc-game-designer` | `cc-art-director`, `cc-narrative-director`, `cc-systems-designer` |

**When delegating via `runSubagent`**:
- Provide: system name, game concept summary, dependency GDD excerpts, the specific
  section being worked on, and what question needs expert input
- The agent returns analysis/proposals to the main session
- The main session presents the agent's output to the user via `vscode_askQuestions`
- The user decides; the main session writes to file
- Agents do NOT write to files directly — the main session owns all file writes

---

## 7. Recovery & Resume

If the session is interrupted:

1. Use `read_file` on `production/session-state/active.md` — it records the current system and
   which sections are complete
2. Use `read_file` on `design/gdd/[system-name].md` — sections with real content are done;
   sections with `[To be designed]` still need work
3. Resume from the next incomplete section

This is why incremental writing matters: every approved section survives any disruption.

---

## Collaborative Protocol

This skill follows the collaborative design principle at every step:

1. **Question -> Options -> Decision -> Draft -> Approval** for every section
2. **`vscode_askQuestions`** at every decision point
3. **"May I write to [filepath]?"** before the skeleton and before each section write
4. **Incremental writing**: Each section is written to file immediately after approval
5. **Session state updates**: After every section write
6. **Cross-referencing**: Every section checks existing GDDs for conflicts
7. **Specialist routing**: Complex sections get expert agent input, presented to
   the user for decision — never written silently

**Never** auto-generate the full GDD and present it as a fait accompli.
**Never** write a section without user approval.
**Never** contradict an existing approved GDD without flagging the conflict.
**Always** show where decisions come from (dependency GDDs, pillars, user choices).

## Context Window Awareness

After writing each section, check if context is at or above 70%. If so:

> **Context is approaching the limit (≥70%).** Your progress is saved — all approved
> sections are written to `design/gdd/[system-name].md`. When you're ready to continue,
> start a fresh session and run `/cc-design-system [system-name]` — it will
> detect which sections are complete and resume from the next one.

---

## Recommended Next Steps

- Run `/cc-design-review design/gdd/[system-name].md` in a **fresh session** to validate the completed GDD
- Run `/cc-consistency-check` to verify this GDD's values don't conflict with other GDDs
- Run `/cc-map-systems next` to move to the next highest-priority undesigned system
- Run `/cc-gate-check pre-production` when all MVP GDDs are authored and reviewed
---
name: cc-design-system
description: "Guided GDD authoring for a single game system"
---

When this skill is invoked:

## 1. Parse Arguments & Validate

Resolve the review mode (once, store for all gate spawns this run):
1. If `--review [full|lean|solo]` was passed → use that
2. Else use `file_search` to find `**/review-mode.txt`, then `read_file` → use that value
3. Else → default to `lean`

A system name or retrofit path is **required**. If missing:

1. Check if `design/gdd/systems-index.md` exists.
2. If it exists: read it, find the highest-priority system with status "Not Started" or equivalent, and use `vscode_askQuestions`:
   - Prompt: "The next system in your design order is **[system-name]** ([priority] | [layer]). Start designing it?"
   - Options: `[A] Yes — design [system-name]` / `[B] Pick a different system` / `[C] Stop here`
   - If [A]: proceed with that system name. If [B]: ask which system to design (plain text). If [C]: exit.
3. If no systems index exists, fail with:
   > "Usage: `/cc-design-system <system-name>` — e.g., `/cc-design-system movement`
   > Or to fill gaps in an existing GDD: `/cc-design-system retrofit design/gdd/[system-name].md`
   > No systems index found. Run `/cc-map-systems` first to map your systems and get the design order."

**Detect retrofit mode:**
If the argument starts with `retrofit` or the argument is a file path to an
existing `.md` file in `design/gdd/`, enter **retrofit mode**:

1. Use `read_file` to read the existing GDD file.
2. Identify which of the 8 required sections are present (scan for section headings).
   Required sections: Overview, Player Fantasy, Detailed Design/Rules, Formulas,
   Edge Cases, Dependencies, Tuning Knobs, Acceptance Criteria.
3. Identify which sections contain only placeholder text (`[To be designed]` or
   equivalent — blank, a single line, or obviously incomplete).
4. Present to the user before doing anything:
   ```
   ## Retrofit: [System Name]
   File: design/gdd/[filename].md

   Sections already written (will not be touched):
   ✓ [section name]
   ✓ [section name]

   Missing or incomplete sections (will be authored):
   ✗ [section name] — missing
   ✗ [section name] — placeholder only
   ```
5. Ask: "Shall I fill the [N] missing sections? I will not modify any existing content."
6. If yes: proceed to **Phase 2 (Gather Context)** as normal, but in **Phase 3**
   skip creating the skeleton (file already exists) and in **Phase 4** skip
   sections that are already complete. Only run the section cycle for missing/
   incomplete sections.
7. **Never overwrite existing section content.** Use `replace_string_in_file` to replace only
   `[To be designed]` placeholders or empty section bodies.

If NOT in retrofit mode, normalize the system name to kebab-case for the
filename (e.g., "combat system" becomes `combat-system`).

---

## 2. Gather Context (Read Phase)

Read all relevant context **before** asking the user anything. This is the skill's
primary advantage over ad-hoc design — it arrives informed.

### 2a: Required Reads

- **Game concept**: Use `read_file` to read `design/gdd/game-concept.md` — fail if missing:
  > "No game concept found. Run `/cc-brainstorm` first."
- **Systems index**: Use `read_file` to read `design/gdd/systems-index.md` — fail if missing:
  > "No systems index found. Run `/cc-map-systems` first to map your systems."
- **Target system**: Find the system in the index. If not listed, warn:
  > "[system-name] is not in the systems index. Would you like to add it, or
  > design it as an off-index system?"
- **Entity registry**: Use `read_file` to read `design/registry/entities.yaml` if it exists.
  Extract all entries referenced by or relevant to this system (use `grep_search`
  for `referenced_by.*[system-name]` and `source.*[system-name]`). Hold these
  in context as **known facts** — values that other GDDs have already
  established and this GDD must not contradict.
- **Reflexion log**: Use `read_file` to read `docs/consistency-failures.md` if it exists.
  Extract entries whose Domain matches this system's category. These are
  recurring conflict patterns — present them under "Past failure patterns"
  in the Phase 2d context summary so the user knows where mistakes have
  occurred before in this domain.

### 2b: Dependency Reads

From the systems index, identify:
- **Upstream dependencies**: Systems this one depends on. Read their GDDs if they
  exist (these contain decisions this system must respect).
- **Downstream dependents**: Systems that depend on this one. Read their GDDs if
  they exist (these contain expectations this system must satisfy).

For each dependency GDD that exists, extract and hold in context:
- Key interfaces (what data flows between the systems)
- Formulas that reference this system's outputs
- Edge cases that assume this system's behavior
- Tuning knobs that feed into this system

### 2c: Optional Reads

- **Game pillars**: Use `read_file` to read `design/gdd/game-pillars.md` if it exists
- **Existing GDD**: Use `read_file` to read `design/gdd/[system-name].md` if it exists (resume, don't
  restart from scratch)
- **Related GDDs**: Use `file_search` for `design/gdd/*.md` and read any that are thematically related

### 2d: Present Context Summary

Before starting design work, present a brief summary to the user:

> **Designing: [System Name]**
> - Priority: [from index] | Layer: [from index]
> - Depends on: [list, noting which have GDDs vs. undesigned]
> - Depended on by: [list, noting which have GDDs vs. undesigned]
> - Existing decisions to respect: [key constraints from dependency GDDs]
> - Pillar alignment: [which pillar(s) this system primarily serves]
> - **Known cross-system facts (from registry):**
>   - [entity_name]: [attribute]=[value], [attribute]=[value] (owned by [source GDD])
>   *(These values are locked — if this GDD needs different values, surface
>   the conflict before writing. Do not silently use different numbers.)*

If any upstream dependencies are undesigned, warn:
> "[dependency] doesn't have a GDD yet. We'll need to make assumptions about
> its interface. Consider designing it first, or we can define the expected
> contract and flag it as provisional."

### 2e: Technical Feasibility Pre-Check

Before asking the user to begin designing, load engine context and surface any
constraints or knowledge gaps that will shape the design.

**Step 1 — Determine the engine domain for this system:**
Map the system's category (from systems-index.md) to an engine domain:

| System Category | Engine Domain |
|----------------|--------------|
| Combat, physics, collision | Physics |
| Rendering, visual effects, shaders | Rendering |
| UI, HUD, menus | UI |
| Audio, sound, music | Audio |
| AI, pathfinding, behavior trees | Navigation / Scripting |
| Animation, IK, rigs | Animation |
| Networking, multiplayer, sync | Networking |
| Input, controls, keybinding | Input |
| Save/load, persistence, data | Core |
| Dialogue, quests, narrative | Scripting |

**Step 2 — Read engine context (if available):**
- Use `read_file` on `docs/engine-reference/[engine]/VERSION.md`
- Use `read_file` on `docs/engine-reference/[engine]/modules/[domain].md` if it exists
- Use `read_file` on `docs/engine-reference/[engine]/breaking-changes.md` for domain-relevant entries
- Use `file_search` for `docs/architecture/adr-*.md` and read any ADRs whose domain matches

**Step 3 — Present the Feasibility Brief** (if engine reference docs exist):

```
## Technical Feasibility Brief: [System Name]
Engine: [name + version]
Domain: [domain]

### Known Engine Capabilities (verified for [version])
- [capability relevant to this system]

### Engine Constraints That Will Shape This Design
- [constraint from engine-reference or existing ADR]

### Knowledge Gaps (verify before committing to these)
- [post-cutoff feature this design might rely on — mark HIGH/MEDIUM risk]

### Existing ADRs That Constrain This System
- ADR-XXXX: [decision summary] — means [implication for this GDD]
```

If no engine reference docs exist, show:
> "No engine configured yet — skipping technical feasibility check. Run
> `/cc-setup-engine` before moving to architecture if you haven't already."

**Step 4 — Ask before proceeding:**

Use `vscode_askQuestions`:
- "Any constraints to add before we begin, or shall we proceed with these noted?"
  - Options: "Proceed with these noted", "Add a constraint first", "I need to check the engine docs — pause here"

Use `vscode_askQuestions`:
- "Ready to start designing [system-name]?"
  - Options: "Yes, let's go", "Show me more context first", "Design a dependency first"

---

## 3. Create File Skeleton

Once the user confirms, **immediately** create the GDD file with empty section
headers. This ensures incremental writes have a target.

```markdown
# [System Name]

> **Status**: In Design
> **Author**: [user + agents]
> **Last Updated**: [today's date]
> **Implements Pillar**: [from context]

## Overview

[To be designed]

## Player Fantasy

[To be designed]

## Detailed Design

### Core Rules

[To be designed]

### States and Transitions

[To be designed]

### Interactions with Other Systems

[To be designed]

## Formulas

[To be designed]

## Edge Cases

[To be designed]

## Dependencies

[To be designed]

## Tuning Knobs

[To be designed]

## Visual/Audio Requirements

[To be designed]

## UI Requirements

[To be designed]

## Acceptance Criteria

[To be designed]

## Open Questions

[To be designed]
```

Ask: "May I create the skeleton file at `design/gdd/[system-name].md`?"

After writing, update `production/session-state/active.md`:
- Use `file_search` to check if the file exists.
- If it **does not exist**: use `create_file` to create it.
- If it **already exists**: use `replace_string_in_file` to update the relevant fields.

File content:
- Task: Designing [system-name] GDD
- Current section: Starting (skeleton created)
- File: design/gdd/[system-name].md

---

## 4. Section-by-Section Design

Walk through each section in order. For **each section**, follow this cycle:

### The Section Cycle

```
Context  ->  Questions  ->  Options  ->  Decision  ->  Draft  ->  Approval  ->  Write
```

1. **Context**: State what this section needs to contain, and surface any relevant
   decisions from dependency GDDs that constrain it.

2. **Questions**: Ask clarifying questions specific to this section. Use
   `vscode_askQuestions` for constrained questions, conversational text for open-ended
   exploration.

3. **Options**: Where the section involves design choices (not just documentation),
   present 2-4 approaches with pros/cons. Explain reasoning in conversation text,
   then use `vscode_askQuestions` to capture the decision.

4. **Decision**: User picks an approach or provides custom direction.

5. **Draft**: Write the section content in conversation text for review. Flag any
   provisional assumptions about undesigned dependencies.

6. **Approval**: Immediately after the draft — in the SAME response — use
   `vscode_askQuestions`. **NEVER use plain text. NEVER skip this step.**
   - Prompt: "Approve the [Section Name] section?"
   - Options: `[A] Approve — write it to file` / `[B] Make changes — describe what to fix` / `[C] Start over`

   **The draft and the approval widget MUST appear together in one response.**

7. **Write**: Use `replace_string_in_file` to replace the placeholder with the approved content.
   **CRITICAL**: Always include the section heading in the `oldString` to ensure
   uniqueness — never match `[To be designed]` alone, as multiple sections use the
   same placeholder. Use this pattern:
   ```
   oldString: "## [Section Name]\n\n[To be designed]"
   newString: "## [Section Name]\n\n[approved content]"
   ```
   Confirm the write.

8. **Registry conflict check** (Sections C and D only — Detailed Design and Formulas):
   After writing, scan the section content for entity names, item names, formula
   names, and numeric constants that appear in the registry. For each match:
   - Compare the value just written against the registry entry.
   - If they differ: **surface the conflict immediately** before starting the next section.
   - If new (not in registry): flag it as a candidate for registry registration.

After writing each section, update `production/session-state/active.md`.

### Section-Specific Guidance

Each section has unique design considerations:

---

### Section A: Overview

**Goal**: One paragraph a stranger could read and understand.

**Derive recommended options before building the widget**: Read the system's category and layer from the systems index, then determine:
- **Framing tab**: Foundation/Infrastructure layer → `[A]` recommended. Player-facing categories → `[C] Both` recommended.
- **ADR ref tab**: Use `file_search` for `docs/architecture/adr-*.md` and `grep_search` for the system name. If found → `[A] Yes` recommended. If none → `[B] No` recommended.
- **Fantasy tab**: Foundation/Infrastructure layer → `[B] No` recommended. All others → `[A] Yes` recommended.

**Framing questions (ask BEFORE drafting)**: Use `vscode_askQuestions`:
- Tab "Framing" — "How should the overview frame this system?" Options: `[A] As a data/infrastructure layer (technical framing)` / `[B] Through its player-facing effect (design framing)` / `[C] Both`
- Tab "ADR ref" — "Should the overview reference the existing ADR for this system?" Options: `[A] Yes — cite the ADR` / `[B] No — keep pure design level`
- Tab "Fantasy" — "Does this system have a player fantasy worth stating?" Options: `[A] Yes — players feel it directly` / `[B] No — pure infrastructure`

**Questions to ask**:
- What is this system in one sentence?
- How does a player interact with it? (active/passive/automatic)
- Why does this system exist — what would the game lose without it?

**Cross-reference**: Check that the description aligns with how the systems index describes it.

**Design vs. implementation boundary**: Overview questions must stay at the behavior
level — what the system *does*, not *how it is built*. Implementation patterns belong
in architecture decisions, not the GDD.

---

### Section B: Player Fantasy

**Goal**: The emotional target — what the player should *feel*.

**Derive recommended option**: Read the system's category and layer:
- Player-facing categories (Combat, UI, Dialogue, Character, Animation, Audio, Level/World) → `[A] Direct` recommended
- Foundation/Infrastructure layer → `[B] Indirect` recommended
- Mixed categories → `[C] Both` recommended

**Framing question (ask BEFORE drafting)**: Use `vscode_askQuestions`:
- "Is this system something the player engages with directly, or infrastructure they experience indirectly?"
- Options: `[A] Direct — player actively uses or feels this system` / `[B] Indirect — player experiences the effects` / `[C] Both`

**Questions to ask**:
- What emotion or power fantasy does this serve?
- What reference games nail this feeling? What specifically creates it?
- Is this a "system you love engaging with" or "infrastructure you don't notice"?

**Agent delegation (MANDATORY)**: After the framing answer is given but before drafting,
spawn `cc-creative-director` via `runSubagent`:
- Provide: system name, framing answer, game pillars, reference games, game concept summary
- Ask: "Shape the Player Fantasy for this system. What emotion or power fantasy should it serve? Be specific — give me 2-3 candidate framings."
- Present the creative-director's framings to the user alongside the draft.

**Do NOT draft Section B without first consulting `cc-creative-director`.**

---

### Section C: Detailed Design (Core Rules, States, Interactions)

**Goal**: Unambiguous specification a programmer could implement without questions.

Break into sub-sections:

1. **Core Rules**: The fundamental mechanics. Use numbered rules for sequential
   processes, bullets for properties.
2. **States and Transitions**: If the system has states, map every state and
   every valid transition. Use a table.
3. **Interactions with Other Systems**: For each dependency, specify what data flows in,
   what flows out, and who owns the interface.

**Questions to ask**:
- Walk me through a typical use of this system, step by step
- What are the decision points the player faces?
- What can the player NOT do? (Constraints are as important as capabilities)

**Agent delegation (MANDATORY)**: Before drafting Section C, spawn specialist agents via
`runSubagent` in parallel (see Section 6 routing table for which agents to use).

**Cross-reference**: For each interaction listed, verify it matches what the
dependency GDD specifies. Flag conflicts.

---

### Section D: Formulas

**Goal**: Every mathematical formula, with variables defined, ranges specified,
and edge cases noted.

**Completion Steering — always begin each formula with this structure:**

```
The [formula_name] formula is defined as:

`[formula_name] = [expression]`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| [name] | [sym] | float/int | [min–max] | [what it represents] |

**Output Range:** [min] to [max] under normal play; [behaviour at extremes]
**Example:** [worked example with real numbers]
```

Do NOT write `[Formula TBD]` or describe a formula in prose without the variable table.

**Questions to ask**:
- What are the core calculations this system performs?
- Should scaling be linear, logarithmic, or stepped?
- What should the output ranges be at early/mid/late game?

**Agent delegation (MANDATORY)**: Before proposing formulas or balance values, spawn via `runSubagent`:
- **Always spawn `cc-game-designer`**: provide Core Rules from Section C, tuning goals, balance context from dependency GDDs. Ask them to propose formulas with variable tables and output ranges.
- **For economy/cost systems, also spawn economy specialist**: provide costs, upgrade intent, progression goals.
- Present proposals to the user for review via `vscode_askQuestions`.
- **Do NOT invent formula values without specialist input.**

---

### Section E: Edge Cases

**Goal**: Explicitly handle unusual situations so they don't become bugs.

**Completion Steering — format each edge case as:**
- **If [condition]**: [exact outcome]. [rationale if non-obvious]

Do NOT write vague entries like "handle appropriately" — each must name the exact
condition and the exact resolution.

**Questions to ask**:
- What happens at zero? At maximum? At out-of-range values?
- What happens when two rules apply at the same time?
- What happens if a player finds an unintended interaction?

**Agent delegation (MANDATORY)**: Spawn specialist via `runSubagent` before finalising edge cases.
Provide completed Sections C and D, ask them to identify edge cases from the formula and rule space.

---

### Section F: Dependencies

**Goal**: Map every system connection with direction and nature.

This section is partially pre-filled from context gathering. Present known dependencies and ask:
- Are there dependencies I'm missing?
- For each dependency, what's the specific data interface?
- Which dependencies are hard vs. soft?

**Cross-reference**: Must be bidirectionally consistent with other GDDs.

---

### Section G: Tuning Knobs

**Goal**: Every designer-adjustable value, with safe ranges and extreme behaviors.

**Questions to ask**:
- What values should designers be able to tweak without code changes?
- For each knob, what breaks if it's set too high? Too low?
- Which knobs interact with each other?

---

### Section H: Acceptance Criteria

**Goal**: Testable conditions that prove the system works as designed.

**Completion Steering — format each criterion as Given-When-Then:**
- **GIVEN** [initial state], **WHEN** [action or trigger], **THEN** [measurable outcome]

Include at least: one criterion per core rule from Section C, and one per formula
from Section D. Do NOT write "the system works as designed" — every criterion must
be independently verifiable by a QA tester.

**Agent delegation (MANDATORY)**: Spawn `cc-producer` via `runSubagent` before finalising.
Provide completed GDD sections C, D, E, and ask them to validate criteria are testable and cover all core rules.

---

### Optional Sections: Visual/Audio, UI Requirements, Open Questions

**Visual/Audio is REQUIRED for visual system categories:**
- Combat, damage, health
- UI systems (HUD, menus)
- Animation, character movement
- Visual effects, particles, shaders
- Character systems
- Dialogue, quests, lore
- Level/world systems

For required systems: spawn `cc-creative-director` via `runSubagent` before drafting.

For **all other categories**, offer optional sections after required ones via `vscode_askQuestions`:
- "The 8 required sections are complete. Define Visual/Audio, UI requirements, or open questions?"
  - Options: "Yes, all three", "Just open questions", "Skip — I'll add these later"

> **Asset Spec Flag**: After Visual/Audio is written with real content:
> "📌 **Asset Spec** — Visual/Audio requirements are defined. After the art bible is approved, run `/cc-asset-spec system:[system-name]` to produce per-asset specs."

> **📌 UX Flag — [System Name]**: If UI requirements have real content:
> "This system has UI requirements. Run `/cc-ux-design` to create a UX spec for each screen/HUD element before writing epics."

---

## 5. Post-Design Validation

After all sections are written:

### 5a: Self-Check

Use `read_file` to read back the complete GDD from file (not from conversation memory). Verify:
- All 8 required sections have real content (not placeholders)
- Formulas reference defined variables
- Edge cases have resolutions
- Dependencies are listed with interfaces
- Acceptance criteria are testable

### 5a-bis: Creative Director Pillar Review

**Review mode check**:
- `solo` → skip. Note: "CD-GDD-ALIGN skipped — Solo mode." Proceed to Step 5b.
- `lean` → skip (not a PHASE-GATE). Note: "CD-GDD-ALIGN skipped — Lean mode." Proceed to Step 5b.
- `full` → spawn `cc-creative-director` via `runSubagent` for pillar alignment review.

### 5b: Update Entity Registry

Scan the completed GDD for cross-system facts that should be registered:
- Named entities with stats or drops
- Named items with values, weights, or categories
- Named formulas with defined variables and output ranges
- Named constants referenced by value in more than one place

For each candidate, check if already in `design/registry/entities.yaml` via `grep_search`.

Present a summary and ask: "May I update `design/registry/entities.yaml` with these entries?"

### 5c: Offer Design Review

Present a completion summary:

> **GDD Complete: [System Name]**
> - Sections written: [list]
> - Provisional assumptions: [list any assumptions about undesigned dependencies]
> - Cross-system conflicts found: [list or "none"]

> **To validate this GDD, run `/cc-design-review design/gdd/[system-name].md` in a fresh session.**
> **Never run design review in the same session as design authoring.**

### 5d: Update Systems Index

After the GDD is complete:
- Use `read_file` to read the systems index
- Update the target system's row:
  - Status → "Designed" (pending review)
  - Design Doc: link to `design/gdd/[system-name].md`
- Update the Progress Tracker counts

Ask: "May I update the systems index at `design/gdd/systems-index.md`?"

### 5e: Suggest Next Steps

Use `vscode_askQuestions`:
- "What's next?"
  - Options:
    - "Run `/cc-consistency-check` — verify this GDD's values don't conflict with existing GDDs"
    - "Design next system ([next-in-order])"
    - "Stop here for this session"
    - "Run `/cc-gate-check`" — if enough MVP systems are designed

---

## 6. Specialist Agent Routing

This skill delegates to specialist agents for domain expertise. The main session
orchestrates; agents provide expert content.

| System Category | Primary Agent | Supporting Agent(s) |
|----------------|---------------|---------------------|
| **Foundation/Infrastructure** | `cc-game-designer` | `cc-lead-programmer` (feasibility) |
| Combat, damage, health | `cc-game-designer` | `cc-creative-director` (hit feedback) |
| Economy, loot, crafting | `cc-game-designer` | — |
| Progression, XP, skills | `cc-game-designer` | — |
| Dialogue, quests, lore | `cc-game-designer` | `cc-creative-director` (story) |
| UI systems (HUD, menus) | `cc-game-designer` | `cc-creative-director` (visual style) |
| Audio systems | `cc-game-designer` | `cc-creative-director` (direction) |
| AI, pathfinding, behavior | `cc-game-designer` | `cc-lead-programmer` (implementation) |
| Level/world systems | `cc-game-designer` | `cc-creative-director` (lore) |
| Camera, input, controls | `cc-game-designer` | `cc-lead-programmer` (feasibility) |
| Animation, character movement | `cc-game-designer` | `cc-creative-director` (animation style) |
| Visual effects, particles | `cc-game-designer` | `cc-creative-director` (VFX direction) |
| Character systems | `cc-game-designer` | `cc-creative-director` (character archetype) |

**When delegating via `runSubagent`**:
- Provide: system name, game concept summary, dependency GDD excerpts, the specific
  section being worked on, and what question needs expert input
- The agent returns analysis/proposals to the main session
- The main session presents the agent's output to the user via `vscode_askQuestions`
- The user decides; the main session writes to file
- Agents do NOT write to files directly

---

## 7. Recovery & Resume

If the session is interrupted:

1. Use `read_file` on `production/session-state/active.md` — it records the current system and
   which sections are complete
2. Use `read_file` on `design/gdd/[system-name].md` — sections with real content are done;
   sections with `[To be designed]` still need work
3. Resume from the next incomplete section

This is why incremental writing matters: every approved section survives any disruption.

---

## Collaborative Protocol

This skill follows the collaborative design principle at every step:

1. **Question -> Options -> Decision -> Draft -> Approval** for every section
2. **`vscode_askQuestions`** at every decision point
3. **"May I write to [filepath]?"** before every file write
4. **Incremental writing**: Each section is written to file immediately after approval
5. **Session state updates**: After every section write
6. **Cross-referencing**: Every section checks existing GDDs for conflicts
7. **Specialist routing**: Complex sections get expert agent input via `runSubagent`

**Never** auto-generate the full GDD and present it as a fait accompli.
**Never** write a section without user approval.
**Never** contradict an existing approved GDD without flagging the conflict.

## Context Window Awareness

After writing each section, check context usage. If at or above 70%:

> **Context is approaching the limit (≥70%).** Your progress is saved — all approved
> sections are written to `design/gdd/[system-name].md`. Open a fresh session and
> run `/cc-design-system [system-name]` — it will detect which sections are complete
> and resume from the next one.

---

## Recommended Next Steps

- Run `/cc-design-review design/gdd/[system-name].md` in a **fresh session** to validate independently
- Run `/cc-consistency-check` to verify values don't conflict with other GDDs
- Run `/cc-map-systems next` to move to the next undesigned system
- Run `/cc-gate-check pre-production` when all MVP GDDs are authored and reviewed
