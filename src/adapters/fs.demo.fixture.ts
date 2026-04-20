/**
 * Demo-mode fixture data. Seeds the in-memory VFS so a fresh browser load
 * lands the visitor on a believable home tree.
 *
 * Persona: senior engineer at a large tech company working on a feed
 * ranker and the company's experimentation platform. Everything leans
 * into big-monorepo problems — SLOs, on-call, experiments, rollouts,
 * proto schema churn — so the demo resonates with that audience.
 */

export interface FixtureFile {
  path: string
  content: string
}

const md = (frontmatter: Record<string, unknown>, body: string): string => {
  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: [${v.map((x) => `"${x}"`).join(', ')}]`
      if (typeof v === 'string') return `${k}: ${v.includes(':') || v.includes('\n') ? JSON.stringify(v) : v}`
      return `${k}: ${v}`
    })
    .join('\n')
  return `---\n${yaml}\n---\n\n${body}`
}

const jsonl = (entries: unknown[]): string =>
  entries.map((e) => JSON.stringify(e)).join('\n') + '\n'

// Helper for conversation message lines. Matches the shape the
// parser in conversationAdapter.ts expects: content is an array of
// typed blocks, each message carries a uuid.
let _uuidCounter = 0
const uuid = () => `demo-msg-${String(++_uuidCounter).padStart(4, '0')}`

const userMsg = (timestamp: string, text: string) => ({
  type: 'user',
  uuid: uuid(),
  isSidechain: false,
  timestamp,
  message: {
    role: 'user',
    content: [{ type: 'text', text }],
  },
})

const assistantMsg = (
  timestamp: string,
  text: string,
  tokens: { input: number; output: number },
  toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [],
) => ({
  type: 'assistant',
  uuid: uuid(),
  isSidechain: false,
  timestamp,
  message: {
    role: 'assistant',
    content: [
      { type: 'text', text },
      ...toolUses.map((t) => ({ type: 'tool_use', ...t })),
    ],
    usage: { input_tokens: tokens.input, output_tokens: tokens.output },
  },
})

const HOME = '/Users/demo'
const FEED_RANKER = `${HOME}/code/feed-ranker`
const EXP_PLATFORM = `${HOME}/code/experiment-platform`

const encode = (p: string): string => p.replace(/[\/\\:]/g, '-')

// User ~/.claude.json — projects list + user-scope MCP servers (MCP
// at user scope lives here, not in settings.json).
const claudeJson = JSON.stringify(
  {
    projects: {
      [FEED_RANKER]: {},
      [EXP_PLATFORM]: {},
    },
    mcpServers: {
      'github-search': {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
      },
      'linear-bridge': {
        type: 'stdio',
        command: 'uvx',
        args: ['linear-mcp@latest'],
        env: { LINEAR_API_KEY: '${LINEAR_API_KEY}' },
      },
      'oncall-pager': {
        type: 'http',
        url: 'https://mcp.internal.example.com/pager',
      },
    },
  },
  null,
  2,
)

const userSettings = JSON.stringify(
  {
    theme: 'dark',
    hooks: {
      PostToolUse: [
        {
          matcher: 'Edit|Write',
          hooks: [
            {
              type: 'command',
              command: 'scripts/ci/lint-changed.sh --staged >/dev/null 2>&1 || true',
            },
          ],
        },
      ],
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: 'scripts/ci/audit-command.sh "$CLAUDE_TOOL_INPUT"',
            },
          ],
        },
      ],
    },
  },
  null,
  2,
)

// Project-level .mcp.json — MCP at project scope lives at <project>/.mcp.json
const rankerMcp = JSON.stringify(
  {
    mcpServers: {
      'feature-store': {
        type: 'stdio',
        command: 'internal-cli',
        args: ['mcp', 'feature-store', '--env=dev'],
      },
      'experiment-registry': {
        type: 'stdio',
        command: 'internal-cli',
        args: ['mcp', 'xp-registry', '--env=dev'],
      },
    },
  },
  null,
  2,
)

const rankerSettings = JSON.stringify(
  {
    hooks: {
      PostToolUse: [
        {
          matcher: 'Write',
          hooks: [
            { type: 'command', command: 'bazel build //... --check_visibility' },
          ],
        },
      ],
    },
  },
  null,
  2,
)

// Marketplaces file — lives at ~/.claude/plugins/known_marketplaces.json
const knownMarketplaces = JSON.stringify(
  {
    'anthropic-official': {
      source: { repo: 'anthropic/claude-plugin-marketplace' },
      installLocation: `${HOME}/.claude/plugins/marketplaces/anthropic-official`,
      lastUpdated: '2026-04-18T10:15:00Z',
    },
    'internal-eng': {
      source: { url: 'https://git.internal.example.com/eng-tools/plugin-marketplace' },
      installLocation: `${HOME}/.claude/plugins/marketplaces/internal-eng`,
      lastUpdated: '2026-04-19T07:22:00Z',
    },
  },
  null,
  2,
)

// Installed plugins registry — ~/.claude/plugins/installed_plugins.json
const installedPlugins = JSON.stringify(
  {
    version: 2,
    plugins: {
      'perf-profiler@internal-eng': [
        {
          scope: 'user',
          installPath: `${HOME}/.claude/plugins/cache/internal-eng/perf-profiler`,
          version: '1.4.2',
          installedAt: '2026-03-02T12:01:00Z',
          lastUpdated: '2026-04-10T09:30:00Z',
        },
      ],
      'security-linter@anthropic-official': [
        {
          scope: 'user',
          installPath: `${HOME}/.claude/plugins/cache/anthropic-official/security-linter`,
          version: '0.8.1',
          installedAt: '2026-02-14T14:45:00Z',
          lastUpdated: '2026-04-12T11:20:00Z',
        },
      ],
    },
  },
  null,
  2,
)

// Marketplace catalogs — listed plugins (available + installed)
const anthropicCatalog = JSON.stringify(
  {
    name: 'anthropic-official',
    plugins: [
      {
        name: 'security-linter',
        description: 'Flag common secret leaks, SSRF patterns, and insecure defaults in diffs.',
        author: { name: 'Anthropic', url: 'https://anthropic.com' },
        category: 'security',
        keywords: ['security', 'linter', 'secrets'],
        version: '0.8.1',
        license: 'MIT',
      },
      {
        name: 'claude-tutor',
        description: 'Guided walkthroughs of Claude Code features for new users.',
        author: { name: 'Anthropic' },
        category: 'learning',
        keywords: ['tutorial', 'onboarding'],
      },
    ],
  },
  null,
  2,
)

const internalCatalog = JSON.stringify(
  {
    name: 'internal-eng',
    plugins: [
      {
        name: 'perf-profiler',
        description: 'Run flame graph captures against staging and diff versus baseline.',
        author: { name: 'Eng Productivity' },
        category: 'performance',
        keywords: ['profiling', 'flamegraph', 'latency'],
        version: '1.4.2',
      },
      {
        name: 'monorepo-navigator',
        description: 'Jump between OWNERS files, BUILD deps, and cross-team call graphs.',
        author: { name: 'Eng Productivity' },
        category: 'navigation',
        keywords: ['monorepo', 'owners', 'bazel'],
      },
      {
        name: 'incident-scribe',
        description: 'Draft postmortem skeletons from oncall pager events.',
        author: { name: 'SRE Guild' },
        category: 'reliability',
        keywords: ['postmortem', 'oncall', 'incidents'],
      },
    ],
  },
  null,
  2,
)

// Plugin manifests live at <installPath>/.claude-plugin/plugin.json
const perfProfilerManifest = JSON.stringify(
  {
    name: 'perf-profiler',
    description: 'Run flame graph captures against staging and diff versus baseline.',
    author: { name: 'Eng Productivity', email: 'eng-prod@internal.example.com' },
    repository: 'https://git.internal.example.com/eng-tools/perf-profiler',
    keywords: ['profiling', 'flamegraph', 'latency'],
    license: 'Apache-2.0',
  },
  null,
  2,
)

const securityLinterManifest = JSON.stringify(
  {
    name: 'security-linter',
    description: 'Flag common secret leaks, SSRF patterns, and insecure defaults in diffs.',
    author: { name: 'Anthropic', url: 'https://anthropic.com' },
    repository: 'https://github.com/anthropics/claude-security-linter',
    keywords: ['security', 'linter', 'secrets'],
    license: 'MIT',
  },
  null,
  2,
)

const files: FixtureFile[] = [
  // ── user home ───────────────────────────────────────────────────────────
  { path: `${HOME}/.claude.json`, content: claudeJson },
  { path: `${HOME}/.claude/settings.json`, content: userSettings },
  {
    path: `${HOME}/.claude/CLAUDE.md`,
    content: `# Global instructions

I work in a very large monorepo. Assume:

- Every change touches code owned by at least one other team.
- Any file outside my org's directories needs explicit cross-team review.
- Performance regressions matter down to the p99.

## Response style

No preamble. No filler. Lead with the answer, then the reasoning.
When a request is ambiguous, pick the reading a senior engineer
would pick and say so in one sentence.

## Code review expectations

Any diff I'm about to send must clear a mental checklist:

1. Does it break any existing SLO or latency budget?
2. Is it backwards-compatible for every live client?
3. Does it need a feature flag? If yes, is the rollout plan written down?
4. Is there a test that would catch a regression six months from now?

Don't let me skip those.
`,
  },

  // ── user agents ─────────────────────────────────────────────────────────
  {
    path: `${HOME}/.claude/agents/code-reviewer.md`,
    content: md(
      {
        name: 'code-reviewer',
        description: 'Reviews diffs with monorepo-scale rigor: SLO impact, backwards compatibility, rollout safety.',
        tools: ['Read', 'Grep', 'Glob', 'Bash'],
        model: 'sonnet',
        color: 'blue',
      },
      `# Code Reviewer

Read the diff and flag issues from the perspective of a senior engineer
on a mature team. Focus on:

- **SLO / latency**: any added RPC, lock contention, N+1 query, large
  allocation in a hot path.
- **Backwards compatibility**: every proto field must be additive; no
  renumbered tags, no removed enum values, no newly-required fields on
  messages that existing clients still send.
- **Rollout safety**: new behavior behind a flag; flag defaults OFF;
  kill-switch exists and is documented.
- **Test coverage**: at minimum, one regression test per branch of new
  behavior. Property tests for anything data-shape-sensitive.
- **Ownership**: does the diff touch directories owned by other teams?
  If yes, call it out and name the OWNERS file.

Lead the review with the highest-severity finding. One paragraph, then
a numbered list.
`,
    ),
  },
  {
    path: `${HOME}/.claude/agents/oncall-triager.md`,
    content: md(
      {
        name: 'oncall-triager',
        description: 'Digests pager alerts and dashboards into a ranked list of probable root causes.',
        tools: ['Read', 'Grep', 'Bash'],
        model: 'sonnet',
      },
      `# On-Call Triager

Given an alert name, a timestamp, and the dashboards linked in the
runbook, produce a prioritized triage report:

1. What's the observable symptom? (latency / error rate / saturation)
2. Which subsystem is the leading suspect, and why?
3. What's the safest action right now — rollback, flag-flip, scale-up,
   or "investigate further"?
4. What information is still missing to be confident?

If the alert matches a known incident pattern in the team's postmortem
index, link it and note the resolution.
`,
    ),
  },
  {
    path: `${HOME}/.claude/agents/experiment-designer.md`,
    content: md(
      {
        name: 'experiment-designer',
        description: 'Helps design AB tests: hypothesis, metrics, sample size, guardrails.',
        tools: ['Read', 'Grep', 'WebFetch'],
        model: 'opus',
      },
      `# Experiment Designer

Turn a vague "we should try X" into a shippable experiment spec.

Output sections, in order:

- **Hypothesis**: one sentence, falsifiable.
- **Primary metric**: the metric this experiment is powered to move,
  with direction and minimum detectable effect.
- **Guardrail metrics**: what we refuse to regress while chasing the
  primary. Default set: latency p99, error rate, revenue per user.
- **Sample size**: computed from historical variance of the primary
  metric. Show the math.
- **Ramp plan**: 1% → 5% → 25% → 50% → 100%, with a check-in at each
  stage.
- **Rollback criteria**: explicit thresholds that auto-revert.
`,
    ),
  },
  {
    path: `${HOME}/.claude/agents/load-test-runner.md`,
    content: md(
      {
        name: 'load-test-runner',
        description: 'Orchestrates synthetic-load runs against staging and summarizes the result.',
        tools: ['Bash', 'Read'],
        model: 'haiku',
      },
      `# Load Test Runner

Run the service's standard load profile against staging. Produce a
one-page summary:

- throughput achieved vs target
- p50 / p95 / p99 / p999 latency
- error breakdown by code
- CPU / memory saturation at the top of the ramp

Flag any regression versus the last tagged run.
`,
    ),
  },

  // ── user commands ───────────────────────────────────────────────────────
  {
    path: `${HOME}/.claude/commands/submit.md`,
    content: md(
      {
        name: 'submit',
        description: 'Prepare the current branch for code review.',
        argumentHint: '[--draft]',
      },
      `Prepare the current branch for review:

1. Run the precommit linter and autoformatter.
2. Verify every new proto field has a tag number higher than any field
   ever used in that message (check the \`reserved\` block).
3. Regenerate the dependency graph if any BUILD file changed.
4. Draft a review description: what, why, risk, rollout plan.
5. If \`--draft\`, mark the review as draft; otherwise add default
   reviewers from \`OWNERS\`.

Never \`submit\` on Friday after 3pm local.
`,
    ),
  },
  {
    path: `${HOME}/.claude/commands/runbook.md`,
    content: md(
      {
        name: 'runbook',
        description: 'Generate or update a runbook page for the given alert.',
        argumentHint: '<alert-name>',
      },
      `Pull the alert definition, the firing dashboard, and the last three
incidents tagged with this alert. Produce or update the runbook page
with:

- symptom description
- triage steps, in order, with the command to run at each
- known false-positive patterns
- escalation path
`,
    ),
  },
  {
    path: `${HOME}/.claude/commands/flag.md`,
    content: md(
      {
        name: 'flag',
        description: 'Scaffold a new feature flag with defaults, owner, and expiry.',
        argumentHint: '<flag-name>',
      },
      `Create a new feature flag named $ARGUMENTS with these defaults:

- \`default_value\`: false
- \`owner\`: my team alias
- \`expiry\`: 90 days from today — if the flag hasn't been cleaned up
  by then, CI starts failing on any file that references it

Register it in the flag registry and wire the kill-switch into the
standard rollback command.
`,
    ),
  },

  // ── user skills ─────────────────────────────────────────────────────────
  {
    path: `${HOME}/.claude/skills/rollout-planner/SKILL.md`,
    content: md(
      {
        name: 'rollout-planner',
        description: 'Plan staged rollouts for risky changes: flag gating, canary, ramp, rollback.',
      },
      `# Rollout Planner

Design a rollout plan for any behavior-changing diff.

## When to activate

- A new feature is being enabled for users.
- Behavior of an existing API changes in a way a client could notice.
- A migration touches data owned by live services.

## Standard plan

1. **Flag**: ship dark behind a flag defaulted OFF.
2. **Internal dogfood**: flip for engineering only, bake for 48 hours.
3. **Canary**: 1% of requests in a single region, bake 24 hours.
4. **Ramp**: 5% → 25% → 50% → 100%, 24 hours between stages, rollback
   criteria explicit at each stage.
5. **Cleanup**: once at 100% for 7 days, remove the flag and the dead
   branch.

Skip stages only with explicit owner sign-off, and only for changes
with no user-visible behavior.
`,
    ),
  },
  {
    path: `${HOME}/.claude/skills/proto-schema-diff/SKILL.md`,
    content: md(
      {
        name: 'proto-schema-diff',
        description: 'Diff two proto files and classify changes by wire-compatibility risk.',
      },
      `# Proto Schema Diff

Compare two .proto files and classify each change:

- **Safe**: new optional field with a new tag, new enum value added at
  the end, comment-only edits.
- **Risky**: field rename (tag preserved), message rename, package
  change, option changes that affect codegen.
- **Breaking**: tag renumber, field type change, removed enum value,
  required→optional or vice versa, reserved block changes.

Output a table: field name, tag, classification, one-line explanation.
Breaking changes get a "❌ reserved block required" note with the exact
line to add.
`,
    ),
  },

  // ── user rules ──────────────────────────────────────────────────────────
  {
    path: `${HOME}/.claude/rules/no-cross-team-edits.md`,
    content: md(
      {
        name: 'no-cross-team-edits',
        description: "Don't silently edit files in other teams' directories.",
      },
      `Any edit outside my own team's directories needs explicit cross-team
review.

**Why:** monorepo etiquette. Other teams own their SLOs, tests, and
release cadence. A drive-by edit that breaks their CI burns hours of
their time.

**How to apply:** before editing, check \`OWNERS\` at the file's
directory or any parent. If the owner isn't my team, surface the
cross-team review path instead of just editing.
`,
    ),
  },
  {
    path: `${HOME}/.claude/rules/explain-why-in-commits.md`,
    content: md(
      {
        name: 'explain-why-in-commits',
        description: 'Commit messages describe the why, not the what.',
      },
      `Commit messages focus on **why**, not **what**.

**Why:** the diff already shows what. The commit message is the only
place the motivation survives — readable by someone doing a
\`git blame\` two years from now on an incident call.

**How to apply:** each commit message has (a) a one-line summary, (b)
the motivation — link the bug, design doc, or incident — and (c) any
non-obvious decision. "Refactor X" without a reason gets rejected.
`,
    ),
  },
  {
    path: `${HOME}/.claude/rules/strict-nulls.md`,
    content: md(
      {
        name: 'strict-nulls',
        description: 'Null and undefined must be explicit at every boundary.',
      },
      `Every API, proto message, and TypeScript type must be explicit about
which fields can be null / absent.

**Why:** most outages at this scale trace to "I thought this was always
set" — especially at service boundaries where one team's invariants
aren't the other's.

**How to apply:** no implicit \`any\`, no optional without a comment
explaining why it's optional, no \`!.\` non-null assertions outside
tests.
`,
    ),
  },

  // ── user plugins (marketplaces + registry + manifests) ─────────────────
  {
    path: `${HOME}/.claude/plugins/known_marketplaces.json`,
    content: knownMarketplaces,
  },
  {
    path: `${HOME}/.claude/plugins/installed_plugins.json`,
    content: installedPlugins,
  },
  {
    path: `${HOME}/.claude/plugins/marketplaces/anthropic-official/.claude-plugin/marketplace.json`,
    content: anthropicCatalog,
  },
  {
    path: `${HOME}/.claude/plugins/marketplaces/internal-eng/.claude-plugin/marketplace.json`,
    content: internalCatalog,
  },
  {
    path: `${HOME}/.claude/plugins/cache/internal-eng/perf-profiler/.claude-plugin/plugin.json`,
    content: perfProfilerManifest,
  },
  {
    path: `${HOME}/.claude/plugins/cache/anthropic-official/security-linter/.claude-plugin/plugin.json`,
    content: securityLinterManifest,
  },

  // ── feed-ranker project ─────────────────────────────────────────────────
  {
    path: `${FEED_RANKER}/CLAUDE.md`,
    content: `# feed-ranker

The serving-path ranker for the primary feed. Python control plane,
C++ hot path for scoring, Bazel build.

## SLOs

- p99 scoring latency: **< 35ms** at 500 RPS per replica
- p999 scoring latency: **< 80ms**
- Error rate: **< 0.05%** sustained

Breaking any of those pages on-call within 5 minutes.

## Stack

- \`py/\`: candidate generation, feature fetching, experiment wiring
- \`cc/\`: scoring model (C++ inference), request pipeline
- \`proto/\`: the \`ranker.v2\` API contract — every change needs
  backwards-compatibility review
- \`eval/\`: offline evaluation notebooks, golden datasets

## Running

\`\`\`bash
bazel run //py/server:main -- --env=dev
bazel test //... --test_tag_filters=-slow
\`\`\`

## Deploys

Every diff ships behind a feature flag. Canary is \`us-east-1\` @ 1% for
24h before ramp. See [the rollout runbook](docs/rollout.md).
`,
  },
  { path: `${FEED_RANKER}/.mcp.json`, content: rankerMcp },
  { path: `${FEED_RANKER}/.claude/settings.json`, content: rankerSettings },
  {
    path: `${FEED_RANKER}/.claude/agents/feature-store-lookup.md`,
    content: md(
      {
        name: 'feature-store-lookup',
        description: 'Resolves feature names to their feature-store definitions, with freshness and owner metadata.',
        tools: ['Read', 'Grep', 'Bash'],
      },
      `# Feature Store Lookup

Given a feature name, return:

- definition path in the feature store
- freshness SLA (real-time / hourly / daily)
- owner team
- downstream ranker versions that read it

If the feature is deprecated or ramping down, say so loudly.
`,
    ),
  },
  {
    path: `${FEED_RANKER}/.claude/commands/score.md`,
    content: md(
      {
        name: 'score',
        description: 'Score a sample request against the current ranker build.',
      },
      `Build the ranker locally and run it against the canonical sample
request set (\`eval/samples/\`). Report any score drift vs the last
tagged build over a threshold of 0.5%.
`,
    ),
  },
  {
    path: `${FEED_RANKER}/.claude/skills/p99-latency-debugger/SKILL.md`,
    content: md(
      {
        name: 'p99-latency-debugger',
        description: 'Narrows a p99 latency regression to a subsystem using tracing + profiling.',
      },
      `# P99 Latency Debugger

Step 1: pull the last hour of traces from the latency-spike window,
bucketed by request path. Identify the hot path.

Step 2: compare the CPU profile from the spike window against a
week-ago baseline. Diff the flame graph.

Step 3: if the regression correlates with a recent deploy, bisect the
last N tagged builds in staging under synthetic load.
`,
    ),
  },

  // ── experiment-platform project ─────────────────────────────────────────
  {
    path: `${EXP_PLATFORM}/CLAUDE.md`,
    content: `# experiment-platform

Internal AB testing + feature-flag platform. Go service, Spanner-like
store for assignments, Kafka for event stream.

## Architecture

- \`cmd/api\`: the public REST + gRPC entrypoint
- \`internal/assign\`: assignment logic (deterministic hashing on user
  id + salt)
- \`internal/metrics\`: aggregation pipeline, reads from Kafka
- \`internal/ui\`: admin dashboard (Vue)

Every experiment has:

1. a registered spec (primary metric, guardrails, sample size)
2. a rollout plan (staged ramp percentages + auto-rollback criteria)
3. an owner alias and a review gate

## Adding a new experiment type

New types land in \`internal/assign/types/\`. Each one implements
the \`AssignmentStrategy\` interface and registers a proto for its
parameters. See existing types for the shape.

## Release cadence

Daily builds tagged, weekly release to prod. Feature flags gate every
new capability until it's been live internally for at least 48 hours.
`,
  },
  {
    path: `${EXP_PLATFORM}/.claude/agents/assignment-auditor.md`,
    content: md(
      {
        name: 'assignment-auditor',
        description: 'Verifies that an experiment assignment is deterministic, balanced, and non-leaking.',
        tools: ['Read', 'Bash'],
      },
      `# Assignment Auditor

For a given experiment id, check:

- **Determinism**: same user gets the same bucket across two
  independent invocations.
- **Balance**: assignment ratios match spec within 0.5% over the
  eligible population.
- **No leakage**: bucket membership isn't observable from any
  non-experiment-owning service's logs.

Fail loudly if any of those is off.
`,
    ),
  },
  {
    path: `${EXP_PLATFORM}/.claude/commands/sample-size.md`,
    content: md(
      {
        name: 'sample-size',
        description: 'Compute required sample size for a proposed experiment.',
        argumentHint: '<primary-metric> <mde>',
      },
      `Given a primary metric and a minimum detectable effect, compute
required sample size per arm assuming:

- two-sided test at α = 0.05
- power = 0.8
- variance drawn from the last 30 days of the metric

Report the size in users and the estimated ramp duration given
current traffic.
`,
    ),
  },

  // ── Memories (project scope) ────────────────────────────────────────────
  {
    path: `${HOME}/.claude/projects/${encode(FEED_RANKER)}/memory/MEMORY.md`,
    content: `- [P99 spike 2025-10-14 was feature-store timeout](project_p99_oct_incident.md) — root cause + mitigation that stuck
- [Feature \`user_embedding_v3\` has 6h freshness](reference_feature_freshness.md) — despite what its config says
- [Don't regenerate scoring model in-process](feedback_model_load_pattern.md) — blocks the request loop; use the sidecar loader
`,
  },
  {
    path: `${HOME}/.claude/projects/${encode(FEED_RANKER)}/memory/project_p99_oct_incident.md`,
    content: md(
      {
        name: 'P99 spike 2025-10-14 was feature-store timeout',
        description: 'Root cause of the 2025-10-14 incident and the fix that stuck.',
        type: 'project',
      },
      `The 2025-10-14 p99 incident was a feature-store client retry loop
triggered by a single hot feature (\`user_embedding_v3\`) whose backing
store was failing over.

**Why:** the client's per-feature circuit breaker wasn't engaging
because the default threshold of 50 consecutive errors was never
reached — the feature store was alternating errors with slow
successes.

**How to apply:** any feature-store client reuse in this repo should
set circuit-breaker on time-in-flight rather than error count. Same
fix landed in \`py/feature_store/client.py\` — don't paper over it
with a different pattern.
`,
    ),
  },
  {
    path: `${HOME}/.claude/projects/${encode(FEED_RANKER)}/memory/reference_feature_freshness.md`,
    content: md(
      {
        name: 'Feature `user_embedding_v3` has 6h freshness',
        description: 'Actual freshness of user_embedding_v3, despite its config claim of 1h.',
        type: 'reference',
      },
      `\`user_embedding_v3\` is documented as 1-hour-fresh but actually
updates on a 6-hour cadence because the upstream pipeline runs daily
with a 6-hour stagger.

Trust the 6h figure when computing staleness budgets; the config
field is a lie and there's a ticket to fix it (FS-4812).
`,
    ),
  },
  {
    path: `${HOME}/.claude/projects/${encode(FEED_RANKER)}/memory/feedback_model_load_pattern.md`,
    content: md(
      {
        name: "Don't regenerate scoring model in-process",
        description: 'Model reload must happen in the sidecar, not the serving process.',
        type: 'feedback',
      },
      `Never reload the scoring model in the request-serving process.

**Why:** the reload path allocates ~1.5GB and mmaps a weights file;
doing this in the serving process blocks the request loop for 200+ms
and causes a p999 spike every model refresh.

**How to apply:** reload happens in the sidecar (\`cc/sidecar/\`), which
hands the serving process a file descriptor via unix socket. Don't
import the weights loader anywhere under \`cc/server/\`.
`,
    ),
  },
  {
    path: `${HOME}/.claude/projects/${encode(EXP_PLATFORM)}/memory/MEMORY.md`,
    content: `- [Assignment salt rotation is forbidden](feedback_no_salt_rotation.md) — rotating the salt invalidates every in-flight experiment
- [Kafka retention is 7 days](reference_kafka_retention.md) — any metric computation must complete within that window
`,
  },
  {
    path: `${HOME}/.claude/projects/${encode(EXP_PLATFORM)}/memory/feedback_no_salt_rotation.md`,
    content: md(
      {
        name: 'Assignment salt rotation is forbidden',
        description: 'Rotating the assignment salt invalidates every in-flight experiment.',
        type: 'feedback',
      },
      `Never rotate the assignment salt in \`internal/assign\`.

**Why:** assignment is \`hash(user_id || salt) mod N\` — change the
salt and every user gets a new bucket, which invalidates every
currently-running experiment's results.

**How to apply:** the salt is a build-time constant. Any PR that
proposes changing it needs platform-team sign-off and a coordinated
halt of all in-flight experiments. Don't even suggest it casually.
`,
    ),
  },
  {
    path: `${HOME}/.claude/projects/${encode(EXP_PLATFORM)}/memory/reference_kafka_retention.md`,
    content: md(
      {
        name: 'Kafka retention is 7 days',
        description: 'The metric event stream retains 7 days; computation must complete within that window.',
        type: 'reference',
      },
      `The metric event Kafka topic (\`xp.events.v2\`) retains 7 days of
data. Any metric aggregation that can't complete within 7 days of the
event timestamp will silently drop rows.

This matters for long-tail metrics where a conversion can happen
weeks after assignment — for those, the pipeline has to snapshot
state rather than replay from Kafka.
`,
    ),
  },

  // ── Conversations ───────────────────────────────────────────────────────
  {
    path: `${HOME}/.claude/projects/${encode(FEED_RANKER)}/conv-p99-debug.jsonl`,
    content: jsonl([
      { type: 'ai-title', aiTitle: 'Debugging the p99 spike in us-east-1' },
      userMsg(
        '2026-04-17T02:18:22Z',
        'We got paged at 02:14 UTC — p99 jumped from 32ms to 78ms in us-east-1. Walk me through triage.',
      ),
      assistantMsg(
        '2026-04-17T02:18:28Z',
        "Pulling the latency-spike window now. First pass: looking at traces bucketed by request path to find the hot path, then the CPU profile diff against last week's baseline.",
        { input: 540, output: 220 },
        [
          {
            id: 'tool-1',
            name: 'Bash',
            input: {
              command:
                'internal-cli trace query --service feed-ranker --region us-east-1 --window 02:10-02:25 --bucket-by endpoint',
            },
          },
        ],
      ),
      userMsg('2026-04-17T02:21:10Z', 'Is it feature-store again, or is this something new?'),
      assistantMsg(
        '2026-04-17T02:21:19Z',
        `Same signature as the October incident. Feature-store client is holding requests for ~45ms on \`user_embedding_v3\` fetches — the circuit breaker still isn't engaging because errors are interleaved with slow successes.

**Recommended action now:** flip \`feature_store_conservative_client\` to ON in us-east-1. That swaps to the time-in-flight breaker config that stuck after October. Safe to enable without a ramp.

**Follow-up:** page the feature-store team; their upstream SSD pool is almost certainly the source.`,
        { input: 980, output: 340 },
      ),
      userMsg('2026-04-17T02:23:04Z', 'Flipping now. What do I write in the incident doc?'),
      assistantMsg(
        '2026-04-17T02:23:11Z',
        `Lead with the timeline, then the mitigation, then the follow-up. Draft:

> **Summary:** p99 scoring latency regressed from 32ms → 78ms in us-east-1 at 02:14 UTC. Root cause was feature-store client queuing on slow \`user_embedding_v3\` fetches (same pattern as 2025-10-14). Mitigated by flipping \`feature_store_conservative_client\` ON at 02:23 UTC; p99 returned to 34ms within 4 minutes.
>
> **Follow-up:** confirm feature-store team is aware of the upstream SSD saturation. File a ticket to make the conservative client the default — the October fix should never have been opt-in.`,
        { input: 1120, output: 410 },
      ),
    ]),
  },
  {
    path: `${HOME}/.claude/projects/${encode(EXP_PLATFORM)}/conv-experiment-spec.jsonl`,
    content: jsonl([
      { type: 'ai-title', aiTitle: 'Designing the ranker-v2 experiment' },
      userMsg(
        '2026-04-18T15:02:01Z',
        'Help me spec an experiment for the ranker-v2 rollout. Primary metric is session depth.',
      ),
      assistantMsg(
        '2026-04-18T15:02:04Z',
        `Two things before I can size this:

1. **MDE** you care about on session depth? Smaller MDE = longer experiment. 0.5% is typical for primary ranker changes; 0.3% is defensible if the change is large; below 0.2% I'd push back.
2. **Guardrails.** My default recommendation: p99 scoring latency, error rate, and ad revenue per session. Any you want to add or drop?`,
        { input: 380, output: 160 },
      ),
      userMsg(
        '2026-04-18T15:03:40Z',
        '0.3% MDE. Keep your default guardrails and also hold ad revenue per user flat within 0.2%.',
      ),
      assistantMsg(
        '2026-04-18T15:03:47Z',
        `Here's the spec.

### Hypothesis

Ranker-v2's refreshed feature mix increases session depth by ≥0.3% versus the v1 control, without regressing latency, error rate, or ad revenue.

### Metrics

- **Primary:** session depth (events/session), MDE 0.3%, direction +.
- **Guardrails:**
  - p99 scoring latency: must stay < 35ms (existing SLO).
  - Error rate: no regression > 0.01% absolute.
  - Ad revenue per session: no regression > 0.2%.
  - Ad revenue per user: held flat within ±0.2%.

### Sample size

At 0.3% MDE, power = 0.8, α = 0.05, using the last-30-day variance of session depth, required sample size is **~2.1M users per arm**. At current eligible traffic (~380k eligible users/day after holdout exclusions), the experiment reaches full statistical power in **~11 days**.

### Ramp plan

- **Day 0:** 1% → us-east-1 only. Bake 24h. Check guardrails hourly.
- **Day 1:** 5% → all regions. Bake 48h.
- **Day 3:** 25%. Check for regional skew.
- **Day 6:** 50%.
- **Day 9:** 100%. Continue collecting until day 11 for final readout.

### Auto-rollback criteria

Any of these trips a rollback in < 5 minutes:
- p99 latency > 40ms sustained 10 min.
- Error rate > 0.1% absolute.
- Ad revenue per session regresses > 0.5% over a 30-min window.

Want me to register this in the experiment-platform registry?`,
        { input: 720, output: 820 },
      ),
      userMsg('2026-04-18T15:05:12Z', 'Yes — register it and give me the review link.'),
      assistantMsg(
        '2026-04-18T15:05:18Z',
        'Registered. Review gate is waiting for platform-team approval; link: xp://registry/exp/ranker-v2-session-depth. Note: guardrail thresholds are below the conservative defaults, so platform review will explicitly confirm those are intentional.',
        { input: 1460, output: 180 },
        [
          {
            id: 'tool-2',
            name: 'Bash',
            input: {
              command:
                'xp-cli experiment register --spec ./ranker-v2-session-depth.yaml --owner ranker-team',
            },
          },
        ],
      ),
    ]),
  },
]

export const fixtureFiles = files
export const fixtureHome = HOME
