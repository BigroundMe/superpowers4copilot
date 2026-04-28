---
name: cc-story-done
description: "End-of-story completion review. Reads the story file, verifies each acceptance criterion against the implementation, checks for GDD/ADR deviations, prompts code review, updates story status to Complete, and surfaces the next ready story from the sprint."
---

# Story Done

This skill closes the loop between design and implementation. Run it at the end of implementing any story. It ensures every acceptance criterion is verified before the story is marked done, GDD and ADR deviations are explicitly documented rather than silently introduced, code review is prompted rather than forgotten, and the story file reflects actual completion status.

**Output:** Updated story file (Status: Complete) + surfaced next story.

---

## Phase 1: Find the Story

Resolve the review mode (once, store for all gate spawns this run):
1. If `--review [full|lean|solo]` was passed → use that
2. Else use `file_search` to find `**/review-mode.txt`, then `read_file` → use that value
3. Else → default to `lean`

**If a file path is provided**: read that file directly using `read_file`.

**If no argument is provided:**

1. Check `production/session-state/active.md` for the currently active story.
2. If not found there, read the most recent file in `production/sprints/` and look for stories marked IN PROGRESS.
3. If multiple in-progress stories are found, use `vscode_askQuestions`:
   - "Which story are we completing?"
   - Options: list the in-progress story file names.
4. If no story can be found, ask the user to provide the path.

---

## Phase 2: Read the Story

Read the full story file using `read_file`. Extract and hold in context:

- **Story name and ID**
- **GDD Requirement TR-ID(s)** referenced (e.g., `TR-combat-001`)
- **Manifest Version** embedded in the story header
- **ADR reference(s)**
- **Acceptance Criteria** — the complete list (every checkbox item)
- **Implementation files** — files listed under "files to create/modify"
- **Story Type** — the `Type:` field from the story header (Logic / Integration / Visual/Feel / UI / Config/Data)
- **Engine notes** — any engine-specific constraints noted
- **Definition of Done** — if present, the story-level DoD
- **Estimated vs actual scope**

Also read:
- `docs/architecture/tr-registry.yaml` — look up each TR-ID in the story. Read the *current* `requirement` text from the registry entry. This is the source of truth for what the GDD required.
- The referenced GDD section — just the acceptance criteria and key rules
- The referenced ADR(s) — just the Decision and Consequences sections
- `docs/architecture/control-manifest.md` header — extract the current `Manifest Version:` date

---

## Phase 3: Verify Acceptance Criteria

For each acceptance criterion in the story, attempt verification using one of three methods:

### Automatic verification (run without asking)

- **File existence check**: use `file_search` for files the story said would be created.
- **Test pass check**: if a test file path is mentioned, run it via `run_in_terminal`.
- **No hardcoded values check**: use `grep_search` for numeric literals in gameplay code paths that should be in config files.
- **No hardcoded strings check**: use `grep_search` for player-facing strings in `src/` that should be in localization files.
- **Dependency check**: if a criterion says "depends on X", check that X exists.

### Manual verification with confirmation (use `vscode_askQuestions`)

- Criteria about subjective qualities ("feels responsive", "animations play correctly")
- Criteria about gameplay behaviour ("player takes damage when...", "enemy responds to...")
- Performance criteria ("completes within Xms") — ask if profiled or accept as assumed

Batch up to 4 manual verification questions into a single `vscode_askQuestions` call.

### Unverifiable (flag without blocking)

- Criteria that require a full game build to test (end-to-end gameplay scenarios)
- Mark as: `DEFERRED — requires playtest session`

### Test-Criterion Traceability

After completing the pass/fail/deferred check above, map each acceptance criterion to the test that covers it:

```
| Criterion | Test | Status |
|-----------|------|--------|
| AC-1: [criterion text] | tests/unit/test_foo.gd::test_bar | COVERED |
| AC-2: [criterion text] | Manual playtest confirmation | COVERED |
| AC-3: [criterion text] | — | UNTESTED |
```

Escalation rules:
- If **>50% of criteria are UNTESTED**: escalate to **BLOCKING** — test coverage is insufficient. Verdict cannot be COMPLETE.
- If **some (≤50%) criteria are UNTESTED**: remain ADVISORY — does not block completion.
- If **all criteria are COVERED**: no action needed.

### Test Evidence Requirement

Based on the Story Type extracted in Phase 2, check for required evidence:

| Story Type | Required Evidence | Gate Level |
|---|---|---|
| **Logic** | Automated unit test in `tests/unit/[system]/` — must exist and pass | BLOCKING |
| **Integration** | Integration test in `tests/integration/[system]/` OR playtest doc | BLOCKING |
| **Visual/Feel** | Screenshot + sign-off in `production/qa/evidence/` | ADVISORY |
| **UI** | Manual walkthrough doc OR interaction test in `production/qa/evidence/` | ADVISORY |
| **Config/Data** | Smoke check pass report in `production/qa/smoke-*.md` | ADVISORY |

Any BLOCKING test evidence gap prevents the COMPLETE verdict in Phase 6.

---

## Phase 4: Check for Deviations

Compare the implementation against the design documents. Run these checks automatically:

1. **GDD rules check**: Using the current requirement text from `tr-registry.yaml`, check that the implementation reflects what the GDD actually requires now. Use `grep_search` on the implemented files for key function names, data structures, or class names mentioned in the current GDD section.

2. **Manifest version staleness check**: Compare the `Manifest Version:` date embedded in the story header against the current `docs/architecture/control-manifest.md` header.
   - If they match → pass silently.
   - If the story's version is older → flag as ADVISORY.
   - If control-manifest.md does not exist → skip this check.

3. **ADR constraints check**: Read the referenced ADR's Decision section. Check for forbidden patterns from the control manifest (if it exists). Use `grep_search` for patterns explicitly forbidden in the ADR.

4. **Hardcoded values check**: Use `grep_search` on the implemented files for numeric literals in gameplay logic that should be in data files.

5. **Scope check**: Did the implementation touch files outside the story's stated scope?

For each deviation found, categorize:
- **BLOCKING** — implementation contradicts the GDD or ADR (must fix)
- **ADVISORY** — implementation drifts slightly from spec but is functionally equivalent
- **OUT OF SCOPE** — additional files were touched beyond the story's stated boundary

---

## Phase 4b: QA Coverage Gate

**Review mode check** — apply before spawning QL-TEST-COVERAGE:
- `solo` → skip. Note: "QL-TEST-COVERAGE skipped — Solo mode." Proceed to Phase 5.
- `lean` → skip. Note: "QL-TEST-COVERAGE skipped — Lean mode." Proceed to Phase 5.
- `full` → spawn via `runSubagent` as normal.

Spawn `cc-qa-lead` via `runSubagent` using gate **QL-TEST-COVERAGE**.

Pass: story file path and story type, test file paths found during Phase 3, the story's `## QA Test Cases` section, the story's `## Acceptance Criteria` list.

Apply the verdict:
- **ADEQUATE** → proceed to Phase 5
- **GAPS** → flag as **ADVISORY**
- **INADEQUATE** → flag as **BLOCKING**

---

## Phase 5: Lead Programmer Code Review Gate

**Review mode check** — apply before spawning LP-CODE-REVIEW:
- `solo` → skip. Note: "LP-CODE-REVIEW skipped — Solo mode." Proceed to Phase 6.
- `lean` → skip. Note: "LP-CODE-REVIEW skipped — Lean mode." Proceed to Phase 6.
- `full` → spawn via `runSubagent` as normal.

Spawn `cc-lead-programmer` via `runSubagent` using gate **LP-CODE-REVIEW**.

Pass: implementation file paths, story file path, relevant GDD section, governing ADR.

Present the verdict. If CONCERNS, surface them via `vscode_askQuestions`:
- Options: `Revise flagged issues` / `Accept and proceed` / `Discuss further`
If REJECT, do not proceed to Phase 6 until the issues are resolved.

---

## Phase 6: Present the Completion Report

Before updating any files, present the full report:

```markdown
## Story Done: [Story Name]
**Story**: [file path]
**Date**: [today]

### Acceptance Criteria: [X/Y passing]
- [x] [Criterion 1] — auto-verified (test passes)
- [x] [Criterion 2] — confirmed
- [ ] [Criterion 3] — FAILS: [reason]
- [?] [Criterion 4] — DEFERRED: requires playtest

### Test-Criterion Traceability
| Criterion | Test | Status |
|-----------|------|--------|
| AC-1: [text] | [test file::test name] | COVERED |
| AC-2: [text] | Manual confirmation | COVERED |
| AC-3: [text] | — | UNTESTED |

### Test Evidence
**Story Type**: [Logic | Integration | Visual/Feel | UI | Config/Data | Not declared]
**Required evidence**: [unit test file | integration test or playtest | screenshot + sign-off | walkthrough doc | smoke check pass]
**Evidence found**: [YES — `[path]` | NO — BLOCKING | NO — ADVISORY]

### Deviations
[NONE] OR:
- BLOCKING: [description] — [GDD/ADR reference]
- ADVISORY: [description] — user accepted / flagged for tech debt

### Scope
[All changes within stated scope] OR:
- Extra files touched: [list] — [note whether valid or scope creep]

### Verdict: COMPLETE / COMPLETE WITH NOTES / BLOCKED
```

**Verdict definitions:**
- **COMPLETE**: all criteria pass, no blocking deviations
- **COMPLETE WITH NOTES**: all criteria pass, advisory deviations documented
- **BLOCKED**: failing criteria or blocking deviations must be resolved first

If the verdict is **BLOCKED**: do not proceed to Phase 7. List what must be fixed.

---

## Phase 7: Update Story Status

Ask before writing: "May I update the story file to mark it Complete and log the completion notes?"

If yes, use `replace_string_in_file` to edit the story file:

1. Update the status field: `Status: Complete`
2. Add a `## Completion Notes` section at the bottom:

```markdown
## Completion Notes
**Completed**: [date]
**Criteria**: [X/Y passing] ([any deferred items listed])
**Deviations**: [None] or [list of advisory deviations]
**Test Evidence**: [Logic: test file at path | Visual/Feel: evidence doc at path | None required (Config/Data)]
**Code Review**: [Pending / Complete / Skipped]
```

3. If advisory deviations exist, ask: "Should I log these as tech debt in `docs/tech-debt-register.md`?"

4. **Update `production/sprint-status.yaml`** (if it exists):
   - Find the entry matching this story's file path or ID
   - Set `status: done` and `completed: [today's date]`
   - Update the top-level `updated` field
   - This is a silent update — no extra approval needed

### Session State Update

After updating the story file, silently append to `production/session-state/active.md`:

    ## Session Extract — /cc-story-done [date]
    - Verdict: [COMPLETE / COMPLETE WITH NOTES / BLOCKED]
    - Story: [story file path] — [story title]
    - Tech debt logged: [N items, or "None"]
    - Next recommended: [next ready story title and path, or "None identified"]

If `active.md` does not exist, use `create_file` to create it with this block as the initial content. Confirm in conversation: "Session state updated."

---

## Phase 8: Surface the Next Story

After completion, help the developer keep momentum:

1. Read the current sprint plan from `production/sprints/`.
2. Find stories that are: Status READY or NOT STARTED, not blocked by other incomplete stories, in Must Have or Should Have tier.

Present:

```
### Next Up
The following stories are ready to pick up:
1. [Story name] — [1-line description] — Est: [X hrs]
2. [Story name] — [1-line description] — Est: [X hrs]

Run `/cc-story-readiness [path]` to confirm a story is implementation-ready before starting.
```

If no more Must Have stories remain in this sprint:

```
### Sprint Close-Out Sequence

All Must Have stories are complete. QA sign-off is required before advancing.
Run these in order:

1. `/cc-smoke-check sprint` — verify the critical path still works end-to-end
2. `/cc-team-qa sprint` — full QA cycle: test case execution, bug triage, sign-off report
3. `/cc-gate-check` — advance to the next phase once QA approves

Do not run `/cc-gate-check` until `/cc-team-qa` returns APPROVED or APPROVED WITH CONDITIONS.
```
