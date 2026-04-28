---
description: "Game Studio global conventions. Applies when using cc-* game development agents. Covers collaboration protocol, coding standards, directory conventions."
applyTo: "**"
---

# Game Studio Global Instructions

The cc-* agent family implements a 48-agent game studio architecture for indie game development.
Each agent owns a specific domain (design, programming, art, QA, production). These instructions
define the shared conventions all cc-* agents must follow.

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question → Options → Decision → Draft → Approval**

### Core Rules

1. **Ask before writing.** Agents MUST ask "May I write this to [filepath]?" before creating or editing files.
2. **Show drafts first.** Present a summary or draft for review before requesting write approval.
3. **Multi-file changes require full changeset approval.** List all files that will be created/modified.
4. **No commits without user instruction.** Never auto-commit or auto-push.
5. **No unilateral cross-domain changes.** An agent must not modify files outside its designated directories without explicit delegation.

### Workflow Pattern

```
1. Agent asks clarifying questions
2. User provides context and constraints
3. Agent presents 2-3 options with trade-offs
4. User decides
5. Agent drafts based on decision
6. User reviews and refines
7. Agent updates draft
8. User approves → Agent writes to file
```

### Incremental File Writing

When creating multi-section documents (GDDs, architecture docs, lore entries):

1. Create the file immediately with a skeleton (all section headers, empty bodies)
2. Discuss and draft one section at a time
3. Write each section to file as soon as approved
4. Update the session state file after each section

## Project Directory Structure

```text
/
├── CLAUDE.md                    # Master configuration
├── src/                         # Game source code
│   ├── core/                    #   Engine-level systems
│   ├── gameplay/                #   Gameplay mechanics
│   ├── ai/                      #   AI systems
│   ├── networking/              #   Multiplayer/networking
│   ├── ui/                      #   User interface
│   └── tools/                   #   Editor tools
├── assets/                      # Game assets
│   ├── art/                     #   Sprites, models, textures
│   ├── audio/                   #   SFX, music, VO
│   ├── shaders/                 #   Shader files
│   └── data/                    #   Data-driven config (JSON/YAML)
├── design/                      # Design documents
│   ├── gdd/                     #   Game design documents
│   ├── narrative/               #   Story, lore, dialogue
│   └── levels/                  #   Level design docs
├── docs/                        # Technical documentation
│   ├── architecture/            #   ADRs, tr-registry
│   └── engine-reference/        #   Pinned engine API docs
├── tests/                       # Test suites
│   ├── unit/                    #   Unit tests
│   ├── integration/             #   Integration tests
│   └── performance/             #   Performance benchmarks
├── prototypes/                  # Throwaway prototypes (isolated from src/)
└── production/                  # Production management
    ├── sprints/                 #   Sprint plans
    ├── session-state/           #   Ephemeral session state (gitignored)
    └── qa/                      #   Bug reports, evidence
```

## Coding Standards

### Data-Driven Design (Mandatory)

Gameplay values MUST live in external config files (`assets/data/`), never hardcoded in source.

```
# ❌ WRONG — hardcoded gameplay values
func calculate_damage(base):
    return base * 1.5 * 0.8  # magic numbers

# ✅ RIGHT — data-driven
func calculate_damage(base, config: CombatConfig):
    return base * config.crit_multiplier * config.resistance_modifier
```

### Dependency Injection (No Singletons)

All public methods must be unit-testable. Use dependency injection, not global singletons.

```
# ❌ WRONG — singleton coupling
func apply_damage():
    var stats = GameManager.instance.player_stats
    stats.health -= damage

# ✅ RIGHT — injected dependency
func apply_damage(target_stats: CharacterStats, damage: float):
    target_stats.health -= damage
```

### Core Rules

- **Doc comments on all public APIs** — describe purpose, params, return values
- **Delta time for all time-based calculations** — never assume fixed frame rate
- **Commits reference the relevant design doc or task ID**
- **Every system has an ADR** in `docs/architecture/`
- **Verification-driven development** — write tests first for gameplay systems; verify with screenshots for UI

### Design Document Standard (8 Required Sections)

Every GDD in `design/gdd/` must include:

1. **Overview** — one-paragraph summary
2. **Player Fantasy** — intended feeling and experience
3. **Detailed Rules** — unambiguous mechanics
4. **Formulas** — all math with defined variables
5. **Edge Cases** — unusual situations handled
6. **Dependencies** — other systems referenced
7. **Tuning Knobs** — configurable values identified
8. **Acceptance Criteria** — testable success conditions

## Test Standards

### Naming Convention

- **Files**: `[system]_[feature]_test.[ext]`
- **Functions**: `test_[scenario]_[expected_result]`

### Test Rules

- **Arrange / Act / Assert** structure for every test
- **Deterministic** — same result every run, no random seeds or time-dependent assertions
- **Isolated** — each test sets up and tears down its own state; no execution order dependency
- **No shared mutable state** — test fixtures use constant files or factory functions
- **Unit tests never call external APIs, databases, or file I/O** — use dependency injection
- **Bug fixes must include a regression test** proving the fix works

### Test Evidence by Story Type

| Story Type | Required Evidence | Location |
|---|---|---|
| Logic (formulas, AI, state) | Automated unit test | `tests/unit/[system]/` |
| Integration (multi-system) | Integration test or playtest doc | `tests/integration/` |
| Visual/Feel (animation, VFX) | Screenshot + lead sign-off | `production/qa/evidence/` |
| UI (menus, HUD) | Walkthrough doc or interaction test | `production/qa/evidence/` |
| Config/Data (balance) | Smoke check pass | `production/qa/smoke-[date].md` |

### What NOT to Automate

Visual fidelity, "feel" qualities, platform-specific rendering, full gameplay sessions.

## Context Management

### File-Backed State

**The file is the memory, not the conversation.** Maintain `production/session-state/active.md`
as a living checkpoint. Update after each significant milestone (design approved, ADR created,
implementation milestone, test results).

The state file should contain: current task, progress checklist, key decisions, files being
worked on, and open questions.

### Context Budgets

| Task Type | Budget |
|---|---|
| Light (read/review) | ~3k tokens |
| Medium (implement feature) | ~8k tokens |
| Heavy (multi-system refactor) | ~15k tokens |

### Subagent Delegation

Use `runSubagent` for research and exploration to keep the main session clean. Subagents run
in their own context and return only summaries. Use subagents when investigating across
multiple files or doing research that would consume >5k tokens. Use direct reads when you
know exactly which 1-2 files to check.

### Recovery After Interruption

After any session restart or context loss:
1. Read `production/session-state/active.md` for full context
2. Read partially-completed files listed in the state
3. Continue from the next incomplete section or task

## Engine Configuration

The game engine is configured via the `/cc-setup-engine` skill, which populates:
- `CLAUDE.md` — engine and language in Technology Stack
- `.claude/docs/technical-preferences.md` — naming conventions, performance budgets, forbidden patterns
- `docs/engine-reference/` — version-pinned API documentation

Supported engines: **Godot 4**, **Unity**, **Unreal Engine 5**.
Engine-specialist agents are automatically routed based on the configured engine.

> **First session?** If no engine is configured, run `/cc-start` to begin guided onboarding.

## Agent Coordination

- **Vertical delegation**: Leadership → Department leads → Specialists. Never skip tiers.
- **Horizontal consultation**: Same-tier agents may consult but not make binding cross-domain decisions.
- **Conflict resolution**: Design conflicts → `cc-creative-director`. Technical conflicts → `cc-technical-director`.
- **Change propagation**: When a design change affects multiple domains, `cc-producer` coordinates.
