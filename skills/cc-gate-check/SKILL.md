---
name: cc-gate-check
description: "Validate readiness to advance between development phases"
---

# Phase Gate Validation

This skill validates whether the project is ready to advance to the next development
phase. It checks for required artifacts, quality standards, and blockers.

**Distinct from `/cc-project-stage-detect`**: That skill is diagnostic ("where are we?").
This skill is prescriptive ("are we ready to advance?" with a formal verdict).

## Production Stages (7)

1. **Concept** — Brainstorming, game concept document
2. **Systems Design** — Mapping systems, writing GDDs
3. **Technical Setup** — Engine config, architecture decisions
4. **Pre-Production** — Prototyping, vertical slice validation
5. **Production** — Feature development (Epic/Feature/Task tracking active)
6. **Polish** — Performance, playtesting, bug fixing
7. **Release** — Launch prep, certification

**When a gate passes**, write the new stage name to `production/stage.txt`
(single line, e.g. `Production`). Always ask before writing.

---

## 1. Parse Arguments

**Target phase:** first argument (blank = auto-detect current stage, then validate next transition)

Also resolve the review mode:
1. If `--review [full|lean|solo]` was passed → use that
2. Else use `file_search` to find `**/review-mode.txt`, then `read_file` → use that value
3. Else → default to `lean`

Note: in `solo` mode, director spawns are skipped — gate-check becomes artifact-existence checks only. In `lean` mode, all four directors still run (phase gates are the purpose of lean mode).

- **With argument**: `/cc-gate-check production` — validate readiness for that specific phase
- **No argument**: Auto-detect current stage, then **confirm with the user before running**:

  Use `vscode_askQuestions`:
  - Prompt: "Detected stage: **[current stage]**. Running gate for [Current] → [Next] transition. Is this correct?"
  - Options:
    - `[A] Yes — run this gate`
    - `[B] No — pick a different gate` (if selected, show a second widget listing all gate options)

---

## 2. Phase Gate Definitions

### Gate: Concept → Systems Design

**Required Artifacts:**
- [ ] `design/gdd/game-concept.md` exists and has content
- [ ] Game pillars defined (in concept doc or `design/gdd/game-pillars.md`)
- [ ] Visual Identity Anchor section exists in `design/gdd/game-concept.md`

**Quality Checks:**
- [ ] Game concept has been reviewed (design-review verdict not MAJOR REVISION NEEDED)
- [ ] Core loop is described and understood
- [ ] Target audience is identified
- [ ] Visual Identity Anchor contains a one-line visual rule and at least 2 supporting visual principles

---

### Gate: Systems Design → Technical Setup

**Required Artifacts:**
- [ ] Systems index exists at `design/gdd/systems-index.md` with at least MVP systems enumerated
- [ ] All MVP-tier GDDs exist in `design/gdd/` and individually pass design review
- [ ] A cross-GDD review report exists in `design/gdd/` (from `/cc-review-all-gdds`)

**Quality Checks:**
- [ ] All MVP GDDs pass individual design review (8 required sections, no MAJOR REVISION NEEDED)
- [ ] `/cc-review-all-gdds` verdict is not FAIL
- [ ] All cross-GDD consistency issues are resolved or explicitly accepted
- [ ] System dependencies are mapped and bidirectionally consistent
- [ ] MVP priority tier is defined
- [ ] No stale GDD references flagged

---

### Gate: Technical Setup → Pre-Production

**Required Artifacts:**
- [ ] Engine chosen (Technology Stack is not `[CHOOSE]`)
- [ ] Technical preferences configured
- [ ] Art bible exists at `design/art/art-bible.md` with at least Sections 1–4
- [ ] At least 3 ADRs in `docs/architecture/` covering Foundation-layer systems
- [ ] Engine reference docs exist in `docs/engine-reference/[engine]/`
- [ ] Test framework initialized: `tests/unit/` and `tests/integration/` exist
- [ ] CI/CD test workflow exists
- [ ] At least one example test file exists
- [ ] Master architecture document exists at `docs/architecture/architecture.md`
- [ ] Architecture traceability index exists at `docs/architecture/architecture-traceability.md`
- [ ] `/cc-architecture-review` has been run (report exists)
- [ ] `design/accessibility-requirements.md` exists with tier committed
- [ ] `design/ux/interaction-patterns.md` exists (pattern library initialized)

**Quality Checks:**
- [ ] Architecture decisions cover core systems
- [ ] Technical preferences have naming conventions and performance budgets set
- [ ] Accessibility tier is defined and documented
- [ ] At least one screen's UX spec started
- [ ] All ADRs have Engine Compatibility sections with version stamped
- [ ] All ADRs have GDD Requirements Addressed sections
- [ ] No ADR references deprecated APIs
- [ ] All HIGH RISK engine domains are addressed in architecture or flagged as open questions
- [ ] Architecture traceability matrix has zero Foundation layer gaps

**ADR Circular Dependency Check**: Build dependency graph from ADR "Depends On" sections.
If cycle detected → **FAIL**.

---

### Gate: Pre-Production → Production

**Required Artifacts:**
- [ ] At least 1 prototype in `prototypes/` with a README
- [ ] First sprint plan exists in `production/sprints/`
- [ ] Art bible is complete (all 9 sections) with sign-off recorded
- [ ] Character visual profiles exist for key characters
- [ ] All MVP-tier GDDs complete
- [ ] Master architecture document exists
- [ ] At least 3 Foundation-layer ADRs exist
- [ ] Control manifest exists at `docs/architecture/control-manifest.md`
- [ ] Epics defined in `production/epics/` (Foundation + Core layers)
- [ ] Vertical Slice build exists and is playable
- [ ] At least 3 playtest sessions documented
- [ ] UX specs for key screens (main menu, core gameplay HUD, pause menu)
- [ ] HUD design document exists at `design/ux/hud.md` (if applicable)
- [ ] All key screen UX specs have passed review

**Quality Checks:**
- [ ] **Core loop fun is validated** — playtest data confirms it
- [ ] UX specs cover all UI Requirements from MVP GDDs
- [ ] Accessibility tier addressed in all key screen UX specs
- [ ] Sprint plan references real story file paths from `production/epics/`
- [ ] **Vertical Slice is COMPLETE** — demonstrates full core loop end-to-end
- [ ] Architecture document has no unresolved Foundation/Core open questions
- [ ] All ADRs have Engine Compatibility and Dependencies sections
- [ ] **Core fantasy is delivered** — at least one playtester described matching experience

**Vertical Slice Validation** (FAIL if any is NO):
- [ ] A human has played through the core loop without developer guidance
- [ ] The game communicates what to do within 2 minutes
- [ ] No critical fun blocker bugs
- [ ] The core mechanic feels good to interact with (subjective — ask the user)

---

### Gate: Production → Polish

**Required Artifacts:**
- [ ] `src/` has active code organized into subsystems
- [ ] All core mechanics from GDD are implemented
- [ ] Main gameplay path is playable end-to-end
- [ ] Test files exist in `tests/unit/` and `tests/integration/`
- [ ] All Logic stories have corresponding unit tests
- [ ] Smoke check has been run with PASS verdict
- [ ] QA plan exists in `production/qa/`
- [ ] QA sign-off report exists
- [ ] At least 3 distinct playtest sessions documented

**Quality Checks:**
- [ ] Tests are passing (run test suite via `run_in_terminal`)
- [ ] No critical/blocker bugs
- [ ] Core loop plays as designed (compare to GDD acceptance criteria)
- [ ] Performance is within budget
- [ ] Playtest findings reviewed and critical issues addressed
- [ ] Difficulty curve matches design doc (if exists)
- [ ] All implemented screens have UX specs
- [ ] Accessibility compliance verified against committed tier

---

### Gate: Polish → Release

**Required Artifacts:**
- [ ] All features from milestone plan are implemented
- [ ] Content is complete (all levels, assets, dialogue)
- [ ] Localization strings are externalized (no hardcoded text in `src/`)
- [ ] QA test plan exists
- [ ] QA sign-off report exists (APPROVED)
- [ ] All Must Have story test evidence is present
- [ ] Smoke check passes cleanly on release candidate build
- [ ] No test regressions
- [ ] Balance data reviewed (`/cc-balance-check` run)
- [ ] Release checklist completed
- [ ] Store metadata prepared (if applicable)
- [ ] Changelog / patch notes drafted

**Quality Checks:**
- [ ] Full QA pass signed off
- [ ] All tests passing
- [ ] Performance targets met across all target platforms
- [ ] No known critical, high, or medium-severity bugs
- [ ] Accessibility basics covered
- [ ] Localization verified for all target languages
- [ ] Legal requirements met
- [ ] Build compiles and packages cleanly

---

## 3. Run the Gate Check

**Before running artifact checks**, use `read_file` on `docs/consistency-failures.md` if it exists.
Extract entries whose Domain matches the target phase for increased scrutiny.

For each item in the target gate:

### Artifact Checks
- Use `file_search` and `read_file` to verify files exist and have meaningful content
- Don't just check existence — verify the file has real content
- For code checks, verify directory structure and file counts

### Quality Checks
- For test checks: Run the test suite via `run_in_terminal` if a test runner is configured
- For design review checks: Use `read_file` on the GDD and check for 8 required sections
- For performance checks: Read technical preferences and compare against profiling data
- For localization checks: Use `grep_search` for hardcoded strings in `src/`

### Cross-Reference Checks
- Compare `design/gdd/` documents against `src/` implementations
- Check that every system in architecture docs has corresponding code
- Verify sprint plans reference real work items

---

## 4. Collaborative Assessment

For items that can't be automatically verified, **ask the user** via `vscode_askQuestions`:

- "I can't automatically verify that the core loop plays well. Has it been playtested?"
- "No playtest report found. Has informal testing been done?"
- "Performance profiling data isn't available. Run `/cc-perf-profile`?"

**Never assume PASS for unverifiable items.** Mark them as MANUAL CHECK NEEDED.

---

## 4b. Director Panel Assessment

Before generating the final verdict, spawn all four directors as **parallel subagents** via `runSubagent`. Issue all four calls simultaneously.

**Spawn in parallel:**

1. **`cc-creative-director`** — gate **CD-PHASE-GATE**: creative vision alignment
2. **`cc-technical-director`** — gate **TD-PHASE-GATE**: technical readiness
3. **`cc-producer`** — gate **PR-PHASE-GATE**: scope and schedule readiness
4. **`cc-creative-director`** (art review) — gate **AD-PHASE-GATE**: visual identity readiness

Pass to each: target phase name, list of artifacts present.

**Collect all four responses, then present:**

```
## Director Panel Assessment

Creative Director:  [READY / CONCERNS / NOT READY]
  [feedback]

Technical Director: [READY / CONCERNS / NOT READY]
  [feedback]

Producer:           [READY / CONCERNS / NOT READY]
  [feedback]

Art Director:       [READY / CONCERNS / NOT READY]
  [feedback]
```

**Apply to the verdict:**
- Any director NOT READY → verdict is minimum FAIL (user may override)
- Any director CONCERNS → verdict is minimum CONCERNS
- All four READY → eligible for PASS

---

## 5. Output the Verdict

```
## Gate Check: [Current Phase] → [Target Phase]

**Date**: [date]
**Checked by**: cc-gate-check skill

### Required Artifacts: [X/Y present]
- [x] design/gdd/game-concept.md — exists, 2.4KB
- [ ] docs/architecture/ — MISSING
- [x] production/sprints/ — exists, 1 sprint plan

### Quality Checks: [X/Y passing]
- [x] GDD has 8/8 required sections
- [ ] Tests — FAILED (3 failures)
- [?] Core loop playtested — MANUAL CHECK NEEDED

### Blockers
1. **No Architecture Decision Records** — Run `/cc-architecture-decision`
2. **3 test failures** — Fix failing tests before advancing

### Recommendations
- [Priority actions to resolve blockers]
- [Optional improvements]

### Verdict: [PASS / CONCERNS / FAIL]
```

---

## 5a. Chain-of-Verification

After drafting the verdict in Phase 5, challenge it before finalising.

**Step 1 — Generate 5 challenge questions** designed to disprove the verdict:

For a **PASS** draft:
- "Which quality checks did I verify by actually reading a file, vs. inferring?"
- "Are there MANUAL CHECK NEEDED items I marked PASS without confirmation?"
- "Did I confirm all artifacts have real content, not just empty headers?"
- "Could any blocker I dismissed as minor actually prevent the phase from succeeding?"
- "Which single check am I least confident in?"

For a **CONCERNS** draft:
- "Could any listed CONCERN be elevated to a blocker?"
- "Is the concern resolvable within the next phase, or does it compound?"
- "Did I soften any FAIL condition into a CONCERN to avoid a harder verdict?"
- "Are there unchecked artifacts that could reveal additional blockers?"
- "Do all the CONCERNS together create a blocking problem?"

For a **FAIL** draft:
- "Have I accurately separated hard blockers from strong recommendations?"
- "Are there any PASS items I was too lenient about?"
- "Am I missing additional blockers?"
- "Can I provide a minimal path to PASS — the specific 3 things that must change?"
- "Is the fail condition resolvable, or does it indicate a deeper problem?"

**Step 2 — Answer each question** independently. Re-check specific files if needed.

**Step 3 — Revise if needed:**
- If answer reveals missed blocker → upgrade verdict
- If answer reveals over-stated blocker → downgrade only if citing evidence
- If answers consistent → confirm verdict unchanged

**Step 4 — Note:** `Chain-of-Verification: [N] questions checked — verdict [unchanged | revised from X to Y]`

---

## 6. Update Stage on PASS

When verdict is **PASS** and user confirms:

1. Write the new stage name to `production/stage.txt` (single line)

**Always ask before writing** via `vscode_askQuestions`: "Gate passed. May I update
`production/stage.txt` to '[NewPhase]'?"

---

## 7. Closing Next-Step Widget

After verdict, close with structured next steps via `vscode_askQuestions`.

**Tailor options to the gate that just ran:**

For **systems-design PASS**:
```
Gate passed. What would you like to do next?
[A] Run /cc-create-architecture — produce the master architecture blueprint (recommended)
[B] Design more GDDs first
[C] Stop here for this session
```

For **technical-setup PASS**:
```
Gate passed. What would you like to do next?
[A] Start Pre-Production — begin prototyping the Vertical Slice
[B] Write more ADRs first — run /cc-architecture-decision [next-system]
[C] Stop here for this session
```

For all other gates, offer the two most logical next steps plus "Stop here".

---

## 8. Follow-Up Actions

Based on the verdict, suggest specific next steps:

- **No game concept?** → `/cc-brainstorm` to create one
- **No systems index?** → `/cc-map-systems` to decompose the concept
- **Missing design docs?** → `/cc-design-system` to author GDDs
- **Small design change?** → `/cc-quick-design` for changes under ~4 hours
- **GDDs not cross-reviewed?** → `/cc-review-all-gdds`
- **No test framework?** → `/cc-test-setup` to scaffold
- **Missing ADRs?** → `/cc-architecture-decision` for individual decisions
- **No master architecture doc?** → `/cc-create-architecture` for the full blueprint
- **Missing control manifest?** → `/cc-create-control-manifest`
- **Missing epics?** → `/cc-create-epics layer: foundation`
- **Missing stories?** → `/cc-create-stories [epic-slug]`
- **Stories not ready?** → `/cc-story-readiness`
- **Tests failing?** → delegate to `cc-lead-programmer`
- **No playtest data?** → `/cc-playtest-report`
- **Performance unknown?** → `/cc-perf-profile`
- **Not localized?** → `/cc-localize`
- **Ready for release?** → `/cc-launch-checklist`

---

## Collaborative Protocol

1. **Scan first**: Check all artifacts and quality gates
2. **Ask about unknowns**: Don't assume PASS for things you can't verify
3. **Present findings**: Show the full checklist with status
4. **User decides**: The verdict is a recommendation — the user makes the final call
5. **Get approval**: "May I write this gate check report to production/gate-checks/?"

**Never** block a user from advancing — the verdict is advisory. Document the risks
and let the user decide whether to proceed despite concerns.
