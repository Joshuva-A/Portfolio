---
name: agentic-sdlc-playbook
description: Project-agnostic reference distilled from five Google whitepapers (May 2026) on agentic software development - context engineering (CLAUDE.md/AGENTS.md), harness/hook design, agent skill evaluation (EDD), tool-permission tiers, security guardrails, and spec-driven code review. Use when setting up or auditing a CLAUDE.md/AGENTS.md file, designing a new agent skill or hook, defining what tier (Read-Only/Draft-Only/Action-Allowed) an agent capability belongs to, writing evals or tests for agent behavior, setting up CI/CD security gates for AI-generated code, or deciding how much review infrastructure a team actually needs. Do NOT use for general coding help unrelated to agentic workflows, or as a source for enterprise-scale infrastructure (SPIFFE workload identity, agent gateways, OpenTelemetry agent tracing, knowledge-graph review agents) - section 7 lists what to deliberately skip on a small team/app.
---

# Agentic SDLC Playbook

Source: 5 Google whitepapers (May 2026), "vibe coding → agentic engineering" series —
*The New SDLC With Vibe Coding* (Osmani/Saboo/Kartakis) · *Agent Tools & Interoperability* ·
*Agent Skills* (Singhal et al.) · *Vibe Coding Agent Security and Evaluation*
(Kartakis/Eidelman/Bakkali/Subasioglu) · *Spec-Driven Production-Grade Development* (Boonstra).

This is a project-agnostic distillation — no project-specific detail lives here on purpose,
so it can be copied into any repo's `docs/` as a standing reference. It's organized as: the
five source documents' extractable ideas, then one consolidated checklist, then an honest
list of what's enterprise-scale-only and not worth adopting on a small team/app.

## 1. The New SDLC With Vibe Coding (mental models)

Vibe coding vs. agentic engineering are two ends of a spectrum, not a binary — rate any
AI-assisted workflow across: intent specification, verification, codebase understanding, error
handling, appropriate scope, risk profile. "Vibe coding" (loose intent, no verification) is fine
for throwaway prototypes; production code needs to sit at the "agentic engineering" end of
every dimension.

**Model + Harness = Agent.** The harness is everything around the model: rule files, tools,
sandboxes, orchestration logic, hooks, observability. Engineering effort should go into the
harness, not into cleverer prompting.

**Tests vs. evals** — a real distinction, not jargon:

- Tests check deterministic correctness (did it compile, does 2+2=4).
- Evals check non-deterministic quality/trajectory — rubrics or an LM-as-judge scoring
  whether the right thing happened, including how the agent got there (did it take sane
  steps, use the right tools), not just the final diff. Both are needed; a green test suite
  says nothing about whether the approach was sound.

**Context engineering** — six types of context to manage deliberately:

1. Instructions (system prompt / CLAUDE.md / AGENTS.md)
2. Knowledge (docs, architecture references)
3. Memory (session logs, prior decisions)
4. Examples (few-shot, style references)
5. Tools (what the agent can call)
6. Guardrails (what it must never do)

Static context (CLAUDE.md/AGENTS.md) should be reviewed, versioned, and treated as code —
not an append-only scratchpad.

**Harness engineering** — hooks are for things the agent should never forget. A hook is
deterministic code that runs before a tool call, after a file edit, or before a commit. Anything
you'd otherwise have to repeat in every prompt belongs in a hook, not a "please remember
to..." instruction.

**Known failure modes to design around:**

- The 80% problem — AI nails the common path, struggles with edge cases and error
  handling; concentrate human review there, not on the happy path.
- AI assistance can make experienced engineers slower net of verification overhead
  (METR finding) — verification cost is real cost, budget for it.
- Slopsquatting — agents hallucinate plausible-sounding package names; attackers
  register them. Pin versions, vet registries.

**Per-phase practices:** AI-as-first-pass-reviewer; a quality flywheel of evaluate → diagnose →
optimize → verify → monitor; treat previously "too risky to touch" legacy code as newly
tractable now that an agent can hold more of it in context at once.

## 2. Agent Tools & Interoperability

Mostly about multi-agent ecosystems (MCP, A2A, A2UI, agentic-commerce protocols) — skip
that if you're not building or consuming a fleet of third-party agents. The universally-applicable
parts:

**AGENTS.md discipline** (a reusable system-prompt policy regardless of the file's name):

- Think before coding; state assumptions explicitly rather than guessing.
- Halt and ask on genuine ambiguity instead of picking a default silently.
- Write the minimum code the task needs — no speculative abstractions.
- Make surgical diffs that preserve existing style; don't opportunistically reformat.
- Goal-driven execution: write a failing/reproducing test first, then loop until it passes.

**MCP / tool-consumption checklist** (applies to any external tool an agent can call):

- Audit third-party tool servers before granting filesystem or credential access.
- Never hardcode credentials — env vars only.
- Never point agent tooling at production data by default — read-only mode,
  non-production or obfuscated data unless a task explicitly requires otherwise.
- Scope access to the single project at hand, not a broad/global grant.
- Require human-in-the-loop confirmation before any tool call that could exfiltrate data
  or mutate shared state.
- Log tool usage for an audit trail.
- Debug a misbehaving agent via its tool-call trace/inspector, not by blindly rewording
  the prompt.

**Schema-validate-and-retry pattern** for any structured output an agent produces: validate
against a schema → on failure, retry with the validation error fed back to the model → after
N retries, fail closed (safe fallback), never let malformed output reach a consumer.

**Split agents by scope, not just by task** — fewer tools per agent means less hallucination
and easier failure attribution than one agent with every tool available.

## 3. Agent Skills (evaluation-driven development)

A Skill = a folder with `SKILL.md` (YAML frontmatter: name, description with explicit trigger
phrases and an explicit "do NOT use for" clause) plus optional `scripts/`, `references/`,
`assets/`. Progressive disclosure: metadata is always resident (~50–80 tokens), the body loads
only on a trigger match, bundled files load only when referenced — keeps context budget
under control as the skill library grows.

**Evaluation-Driven Development (EDD):** write eval cases — input, expected_tools,
expected_output, rubric — before writing the skill's instructions. This forces a functional spec
to exist before the "how" is written down.

**Five-pattern eval toolkit** (mix and match per what you're gating):

1. Eval-as-Unit-Test — CI-blocking, runs on every change.
2. Golden Dataset — versioned input/output pairs stored alongside the code.
3. LLM-as-Judge — swap reference/actual positions to cancel ordering bias; calibrate the
   judge against human agreement (target ≥90%) before trusting it.
4. Adversarial / Red-Team — one rephrase + one negative-boundary case per trigger.
5. Canary / Shadow — real traffic at small scale (e.g. 1%) before full rollout.

**Four failure modes to explicitly test for:**

- Trigger failure — wrong or no activation.
- Execution failure — wrong output or wrong tool calls.
- Token-budget failure — added context degrades unrelated turns.
- Regression — a new addition breaks existing routing/behavior. (Cited stat to take
  seriously, not literally: a meaningful fraction of tested skills performed worse than
  having no skill at all — evaluation is what separates capability from harm, not a
  nice-to-have.)

**pass^k over pass@1** — require success across k repeated runs of the same case, not one
lucky pass. Single-run gates hide flakiness that compounds in production.

**Tiered governance ladder** — classify every agent capability into one tier:

| Tier | Can do | Required evaluation bar |
|---|---|---|
| Read-Only | Query, cannot mutate anything | LLM-as-judge, ~90% trigger accuracy |
| Draft-Only | Produce content for human review; cannot send/commit/deploy | 20+ case golden dataset |
| Action-Allowed | Executes irreversible operations | Full red-team + sustained pass^k + zero rollbacks + explicit sign-off |

**"Shift intelligence left":** capital-letter ALWAYS/NEVER instructions accumulate as context
debt — models learn to deprioritize them as the prompt grows. Prefer a deterministic, testable
script/hook over a shouted instruction whenever one is possible.

**Deployment checklist for a new skill/capability:** frontmatter lint, description reviewed by
someone other than the author, CI eval gate with a minimum pass threshold, secret/dependency
security scan, cross-environment install test.

## 4. Vibe Coding Agent Security and Evaluation

Framed for organizations running autonomous agents with live production tool access — much
of the security-architecture half (SPIFFE-style workload identity, centralized agent gateways,
SOAR-based quarantine) is over-engineered for a small team. The evaluation section and the
CI/CD security recap are the high-value, broadly-applicable parts.

**Evaluation dimensions — what to actually score:**

- Intent satisfaction (did it do what was meant, not just what was said)
- Functional correctness
- Visual / behavioral correctness (for anything with a UI)
- Cost/efficiency (iteration count until convergence)
- Code quality / convention matching
- Trajectory quality (the path taken, not just the destination)
- Self-repair behavior (did it recover from its own mistake, or paper over it)

**How to evaluate each dimension — a method-to-dimension map:**

- Automated tests (unit/e2e runners) → functional correctness
- SAST/SCA (static analysis, dependency scanning, secret scanning) → security
- LLM-as-judge → intent, style, trajectory
- Screenshot + visual assertion tooling → visual/behavioral correctness
- Trace/session inspection → trajectory, cost/efficiency
- Human review → calibrating all of the above, biased toward high-cost or
  heavily-corrected sessions (those are where the signal is)

**"Shift the perimeter left, not the enforcement."** Advisory linting can live in the editor/IDE.
Hard, deterministic enforcement (SAST/SCA, dependency pinning, build provenance) belongs at
the commit/CI gate — never rely on an advisory check alone for anything that must actually
hold.

**Test-driven discipline for agents specifically:** don't let an agent edit the test and the
implementation in the same pass — the test is the specification; if the agent can rewrite it to
match whatever it produced, the gate is decorative.

**Supply chain:** vetted registries + pinned versions as the concrete mitigation for
slopsquatting (see §1) — cheap, mechanical, worth doing regardless of project size.

A pattern specifically worth naming: AI-generated code has an observed tendency to push
validation to the client and default to allow rather than deny — explicitly check for both in
review.

**Identity/scoping, minimally applied even without enterprise IAM:** deny-by-default for
secrets and build/deploy scripts; an explicit allowlist of what the agent's tools may touch,
rather than an implicit "everything not excluded."

## 5. Spec-Driven Production-Grade Development

Specs as the source of truth, checked into the repo (a `specs/` folder or equivalent), written
in a Given/When/Then style — for both the human and the agent to read, preventing context
fragmentation across chat history. A layered instruction hierarchy sits on top: ephemeral chat
prompt → per-project specs → reusable skills → global system prompt (user-level, then
cross-tool, then project-level) — each layer more durable and more widely scoped than the
one below it.

**Code review has to evolve, not disappear:**

- Every PR/change carries an AI-generated risk-assessment summary.
- Human review time shifts from style nitpicks (delegate those to linters) to architectural
  integrity.
- Conditional LGTM: auto-merge once all automated gates pass, rather than a human
  re-checking what the gates already checked.
- No-blame culture: attribute a shipped bug to a broken process step, not to the engineer
  who used the agent that pass.

**Evaluation vs. unit-test, stated precisely:** unit tests are binary pass/fail. Evaluation is a
scored judgment (e.g. 0–5 from an LLM-as-judge) with a tolerance band, built to catch
behavioral drift — a change that's still "passing" but has quietly gotten worse — which a
binary test cannot detect by construction.

**Zero-trust guardrails, in order of cost:**

1. Sandboxed execution for any agent-run command with side effects.
2. Human-in-the-loop checkpoints gated on risk, not on change size — a one-line schema
   migration needs a checkpoint; a 500-line refactor of a pure function doesn't.
3. Mandatory failing-test-first workflow before any bug fix.

**Policy Server pattern** — a two-layer gate for what an agent's role is allowed to do:

- Structural gate: deterministic, e.g. a `policies.yaml` mapping role × environment →
  allowed/blocked tools. Fast, cheap, no model call needed.
- Semantic gate: an LLM-based check on intent/content for the cases a structural rule
  can't express (e.g. blocking unmasked PII even from an otherwise-authorized role).
  Apply the cheap structural gate first; only invoke the semantic gate for what survives it.

**Context hygiene:** resolve placeholder tokens (env vars, runtime state) before they reach a
tool call, rather than trusting the model never to hallucinate or hardcode a secret/URL into an
action.

**A concrete 3-tier ladder for "how much reviewer infrastructure do we actually need":**

1. Managed — a generic SaaS PR bot. Zero setup, generic criteria.
2. Hybrid (right default for most teams) — a review prompt/skill committed to the repo,
   checking secrets/injection/logic-bugs/edge-cases, triggered non-interactively (a CI job,
   a pre-commit hook) and posting/logging its findings.
3. Custom — a dedicated review agent with cross-run memory and a knowledge graph of
   the codebase. Only worth it for large, long-lived, multi-team codebases — decide with
   three questions: how specific are the review criteria, is cross-run memory actually
   needed, and what's the worst-case blast radius of a miss.

## 6. Consolidated checklist (apply regardless of stack)

- [ ] A versioned, reviewed system-context file (CLAUDE.md/AGENTS.md) — not an
      append-only log; someone owns pruning it.
- [ ] Specs (or equivalent living docs) as source of truth, read before non-trivial work.
- [ ] Tests and evals — evals scored with a tolerance band, not just binary pass/fail.
- [ ] At least one deterministic hook (pre-commit or pre-tool-use) for anything you'd
      otherwise have to repeat as a prompt instruction.
- [ ] Every agent capability classified into a tier (Read-Only / Draft-Only / Action-Allowed)
      with an evaluation bar that scales with the tier.
- [ ] Deny-by-default tool/file access for secrets and destructive operations — explicit
      allowlist, not implicit "everything not excluded."
- [ ] Supply-chain check (audit/SCA) in the same gate that blocks on lint/test failure.
- [ ] Hard enforcement lives at the commit/CI gate; IDE-time checks are advisory only.
- [ ] An agent never edits the test and the implementation it's tested against in the same
      pass.
- [ ] A named owner (or explicit "no owner yet") for anything long-lived enough that
      you'll wonder in six months whether it's still accurate.

## 7. Explicitly enterprise-scale — don't cargo-cult these onto a small team/app

- SPIFFE-style workload identity, centralized agent gateways, SOAR-based quarantine
- A2A agent registries/marketplaces, Agent-as-a-Service monetization, agentic-commerce
  payment protocols (AP2/UCP)
- OpenTelemetry span-level agent observability (agent.session/agent.think/agent.tool) —
  valuable once you have enough traffic to need sampling; overhead-only below that
- Semantic (LLM-based) Policy Server gate — add only once the structural/deterministic
  gate has actually let something through it shouldn't have
- Knowledge-graph-backed review agents (Spanner Graph / ADK sub-agent
  decomposition) — a large, long-lived, multi-team codebase problem
- A parallel `specs/` folder if you already have living architecture/rules docs that serve
  the same purpose — don't fragment context across two places that both claim to be the
  source of truth
