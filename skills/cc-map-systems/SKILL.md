---
name: cc-map-systems
description: "Decompose game concept into systems, map dependencies"
---

When this skill is invoked:

## Parse Arguments

Two modes:

- **No argument**: `/cc-map-systems` — Run the full decomposition workflow (Phases 1-5)
  to create or update the systems index.
- **`next`**: `/cc-map-systems next` — Pick the highest-priority undesigned system
  from the index and hand off to `/cc-design-system` (Phase 6).

Also resolve the review mode (once, store for all gate spawns this run):
1. If `--review [full|lean|solo]` was passed → use that
2. Else use `file_search` to find `**/review-mode.txt`, then `read_file` → use that value
3. Else → default to `lean`

---

## Phase 1: Read Concept (Required Context)

Read the game concept and any existing design work.

**Required:**
- Use `read_file` to read `design/gdd/game-concept.md` — **fail with a clear message if missing**:
  > "No game concept found at `design/gdd/game-concept.md`. Run `/cc-brainstorm` first
  > to create one, then come back to decompose it into systems."

**Optional (read if they exist):**
- Use `read_file` to read `design/gdd/game-pillars.md` — pillars constrain priority and scope
- Use `read_file` to read `design/gdd/systems-index.md` — if exists, **resume** (update, don't recreate)
- Use `file_search` for `design/gdd/*.md` — check which system GDDs already exist

**If the systems index already exists:**
- Read it and present current status to the user
- Use `vscode_askQuestions`:
  "The systems index already exists with [N] systems ([M] designed, [K] not started).
  What would you like to do?"
  - Options: "Update the index with new systems", "Design the next undesigned system",
    "Review and revise priorities"

---

## Phase 2: Systems Enumeration (Collaborative)

Extract and identify all systems the game needs. This is the creative core —
it requires human judgment because concept docs rarely enumerate every system.

### Step 2a: Extract Explicit Systems

Scan the game concept for directly mentioned systems and mechanics:
- Core Mechanics section (most explicit)
- Core Loop section (implies what systems drive each loop tier)
- Technical Considerations section (networking, procedural generation, etc.)
- MVP Definition section (required features = required systems)

### Step 2b: Identify Implicit Systems

For each explicit system, identify the **hidden systems** it implies. Games always
need more systems than the concept doc mentions. Use this inference pattern:

- "Inventory" implies: item database, equipment slots, weight/capacity rules,
  inventory UI, item serialization for save/load
- "Combat" implies: damage calculation, health system, hit detection, status effects,
  enemy AI, combat UI, death/respawn
- "Open world" implies: streaming/chunking, LOD system, fast travel, map/minimap,
  point of interest tracking, world state persistence
- "Multiplayer" implies: networking layer, lobby/matchmaking, state synchronization,
  anti-cheat, network UI
- "Crafting" implies: recipe database, ingredient gathering, crafting UI,
  success/failure mechanics, recipe discovery
- "Dialogue" implies: dialogue tree system, dialogue UI, choice tracking, NPC
  state management, localization hooks
- "Progression" implies: XP system, level-up mechanics, skill tree, unlock
  tracking, progression UI, progression save data

Explain in conversation text why each implicit system is needed.

### Step 2c: User Review

Present the enumeration organized by category. For each system, show:
- Name
- Category
- Brief description (1 sentence)
- Whether it was explicit (from concept) or implicit (inferred)

Then use `vscode_askQuestions`:
- "Are there systems missing from this list?"
- "Should any of these be combined or split?"
- "Are there systems listed that this game does NOT need?"

Iterate until the user approves the enumeration.

---

## Phase 3: Dependency Mapping (Collaborative)

For each system, determine what it depends on. A system "depends on" another if
it cannot function without that other system existing first.

### Step 3a: Map Dependencies

For each system, list its dependencies using these heuristics:
- **Input/output dependencies**: System A produces data System B needs
- **Structural dependencies**: System A provides the framework System B plugs into
- **UI dependencies**: Every gameplay system has a corresponding UI system

### Step 3b: Sort by Dependency Order

Arrange systems into layers:
1. **Foundation**: Systems with zero dependencies (designed and built first)
2. **Core**: Systems depending only on Foundation systems
3. **Feature**: Systems depending on Core systems
4. **Presentation**: UI and feedback systems that wrap gameplay systems
5. **Polish**: Meta-systems, tutorials, analytics, accessibility

### Step 3c: Detect Circular Dependencies

Check for cycles in the dependency graph. If found:
- Highlight them to the user
- Propose resolutions (interface abstraction, simultaneous design, breaking the
  cycle by defining a contract)

### Step 3d: Present to User

Show the dependency map as a layered list. Highlight:
- Any circular dependencies
- Any "bottleneck" systems (many others depend on them — high-risk)
- Any systems with no dependents (leaf nodes — lower risk)

Use `vscode_askQuestions`: "Does this dependency ordering look right? Any
dependencies I'm missing or that should be removed?"

**Review mode check** — apply before spawning cc-technical-director:
- `solo` → skip. Note: "TD-SYSTEM-BOUNDARY skipped — Solo mode."
- `lean` → skip (not a PHASE-GATE). Note: "TD-SYSTEM-BOUNDARY skipped — Lean mode."
- `full` → spawn `cc-technical-director` via `runSubagent` with the dependency map
  summary, layer assignments, bottleneck systems list. Present assessment.
  If REJECT, revise with the user. If CONCERNS, note inline.

---

## Phase 4: Priority Assignment (Collaborative)

Assign each system to a priority tier based on what milestone it's needed for.

### Step 4a: Auto-Assign Based on Concept

Use these heuristics:
- **MVP**: Systems mentioned in "Required for MVP" section, plus Foundation dependencies
- **Vertical Slice**: Systems needed for a complete experience in one area
- **Alpha**: All remaining gameplay systems
- **Full Vision**: Polish, meta, and nice-to-have systems

### Step 4b: User Review

Present the priority assignments in a table. For each tier, explain why systems
were placed there.

Use `vscode_askQuestions`: "Do these priority assignments match your vision?
Which systems should be higher or lower priority?"

**"Why" column guidance**: Mix technical necessity with player-experience reasoning.
Do not use purely technical justifications — connect to player experience where relevant.

**Review mode check** — apply before spawning cc-producer:
- `solo` → skip. Note: "PR-SCOPE skipped — Solo mode."
- `lean` → skip (not a PHASE-GATE). Note: "PR-SCOPE skipped — Lean mode."
- `full` → spawn `cc-producer` via `runSubagent` with total system count per tier,
  estimated implementation volume per tier, team size, timeline. Present assessment.
  If UNREALISTIC, revise priorities. If CONCERNS, note and continue.

### Step 4c: Determine Design Order

Combine dependency sort + priority tier to produce the final design order:
1. MVP Foundation systems first
2. MVP Core systems second
3. MVP Feature systems third
4. Vertical Slice Foundation/Core systems
5. ...and so on

---

## Phase 5: Create Systems Index (Write)

### Step 5a: Draft the Document

Populate the systems index with all data from Phases 2-4:
- Fill the enumeration table
- Fill the dependency map
- Fill the recommended design order
- Fill the high-risk systems
- Fill progress tracker (all "Not Started" initially, unless GDDs exist)

### Step 5b: Approval

Present a summary:
- Total systems count by category
- MVP system count
- First 3 systems in the design order
- Any high-risk items

Ask: "May I write the systems index to `design/gdd/systems-index.md`?"

Wait for approval. Write the file only after "yes."

**Review mode check** — apply before spawning cc-creative-director:
- `solo` → skip. Note: "CD-SYSTEMS skipped — Solo mode."
- `lean` → skip (not a PHASE-GATE). Note: "CD-SYSTEMS skipped — Lean mode."
- `full` → spawn `cc-creative-director` via `runSubagent` with systems index path,
  game pillars, core fantasy, MVP system list. Present assessment.
  If REJECT, revise. If CONCERNS, record as `> **Creative Director Note**`.

### Step 5c: Update Session State

After writing, create or update `production/session-state/active.md`:
- Task: Systems decomposition
- Status: Systems index created
- File: design/gdd/systems-index.md
- Next: Design individual system GDDs

**Verdict: COMPLETE** — systems index written to `design/gdd/systems-index.md`.

---

## Phase 6: Design Individual Systems (Handoff to /cc-design-system)

This phase is entered when:
- The user says "yes" to designing systems after creating the index
- The user invokes `/cc-map-systems [system-name]`
- The user invokes `/cc-map-systems next`

### Step 6a: Select the System

- If a system name was provided, find it in the systems index
- If `next` was used, pick the highest-priority undesigned system (by design order)
- If the user just finished the index, ask:
  "Would you like to start designing individual systems now? The first system in
  the design order is [name]."

Use `vscode_askQuestions`: "Start designing [system-name] now, pick a different
system, or stop here?"

### Step 6b: Hand Off to /cc-design-system

Once a system is selected, invoke the `/cc-design-system [system-name]` skill.

**Do not duplicate the /cc-design-system workflow here.** This skill owns the systems
*index*; `/cc-design-system` owns individual system *GDDs*.

### Step 6c: Loop or Stop

After `/cc-design-system` completes, use `vscode_askQuestions`:
- "Continue to the next system ([next system name])?"
- "Pick a different system?"
- "Stop here for this session?"

If continuing, return to Step 6a.

---

## Phase 7: Suggest Next Steps

After the systems index is created, present using `vscode_askQuestions`:

- "Systems index is written. What would you like to do next?"
  - [A] Start designing GDDs — run `/cc-design-system [first-system-in-order]`
  - [B] Ask a director to review the index first
  - [C] Stop here for this session

After any individual GDD is completed:
- "Run `/cc-design-review design/gdd/[system].md` in a fresh session to validate quality"
- "Run `/cc-gate-check systems-design` when all MVP GDDs are complete"

---

## Collaborative Protocol

This skill follows the collaborative design principle at every phase:

1. **Question -> Options -> Decision -> Draft -> Approval** at every step
2. **`vscode_askQuestions`** at every decision point:
   - Phase 2: "Missing systems? Combine or split?"
   - Phase 3: "Dependency ordering correct?"
   - Phase 4: "Priority assignments match your vision?"
   - Phase 5: "May I write the systems index?"
   - Phase 6: "Start designing, pick different, or stop?"
3. **"May I write to [filepath]?"** before every file write
4. **Incremental writing**: Update the systems index after each system is designed
5. **Handoff**: Individual GDD authoring is owned by `/cc-design-system`
6. **Session state updates**: Write to `production/session-state/active.md` after milestones

**Never** auto-generate the full systems list and write without review.
**Never** start designing a system without user confirmation.
**Always** show the enumeration, dependencies, and priorities for user validation.

## Context Window Awareness

If context reaches or exceeds 70%:

> **Context is approaching the limit (≥70%).** The systems index is saved to
> `design/gdd/systems-index.md`. Open a fresh session to continue
> designing individual GDDs — run `/cc-map-systems next` to pick up where you left off.

---

## Recommended Next Steps

- Run `/cc-design-system [first-system-in-order]` to author the first GDD
- Run `/cc-map-systems next` to always pick the highest-priority undesigned system
- Run `/cc-design-review design/gdd/[system].md` in a fresh session after each GDD
- Run `/cc-gate-check pre-production` when all MVP GDDs are authored and reviewed
