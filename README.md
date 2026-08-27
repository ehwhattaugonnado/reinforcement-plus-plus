# Reinforcement++

Reinforcement++ is a browser-based pet-training simulation for learning
paired-stimulus preference assessment and positive reinforcement. It's a
10-20 minute, low-stakes, cute, constructive, punishment-free interactive
experience — you assess what a virtual creature likes, then practice
delivering it as reinforcement on different schedules and see the effects
play out.

**This is an educational toy, not clinical guidance or decision support.**
It is not a substitute for training, supervision, or credentialing in
behavior analysis, and its content has not yet had a qualified
behavior-analytic subject-matter review (see [Status](#status) below).

## Try it

▶ **[Live demo](https://ehwhattaugonnado.github.io/reinforcement-plus-plus/)**

No install, no account, no data collection — everything runs client-side and
nothing is saved between sessions.

## AI development disclaimer

This project's code, and most of its design documentation, were written
collaboratively with AI coding assistants (Claude Code), under human
direction and review. If you're evaluating this repository's engineering
practices, its commit history and `docs/adr/` reflect that process
honestly. Treat it as a personal/hobby project accordingly — it has not had
independent professional code review or a security audit.

## Status

V1 is under active development. The application currently includes:

- a deterministic, event-sourced simulation core with replay, controlled
  time, pause, and 0.5x/1x speed;
- the complete six-trial paired-stimulus assessment;
- baseline response generation and an experienced-consequence learning model;
- CRF delivery classification, acquisition gates, corrective coaching, and an
  accessible manual-delivery training screen;
- guided VR-3 maintenance: a seeded ratio-requirement sequence, live
  schedule-state derivation, the round-order completion gate, coaching, and
  the matching training screen UI;
- event-derived reinforcer-evidence and extinction-burst rules, including a
  live seeded extinction-transition model calibrated against a 150-seed
  cohort;
- project-owned cumulative-record and response-rate chart data and accessible
  visx chart views, wired into an Advanced-mode live training view with an
  accessible event table; and
- Vitest, React Testing Library, Playwright smoke, and automated accessibility
  coverage.

The complete learner path is not finished yet. The extinction round's own
UI/timing, the shared debrief screen, and release hardening remain. See the
[implementation roadmap](docs/roadmap.md) for the detailed status and
sequence.

## Running it locally

Requirements:

- Node.js 20 or newer
- npm 11 (the repository pins `npm@11.6.2` in `package.json`)

```sh
npm ci
npm run dev
```

Vite prints the local development URL. No backend or persistence setup is
needed; session state lives in memory only.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Preview the production build |
| `npm run format` | Format the repository with Prettier |
| `npm run format:check` | Check formatting without changing files |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript project checks |
| `npm run test` | Run all Vitest unit and integration tests |
| `npm run test:sim` | Run the simulation-core tests |
| `npm run test:e2e` | Run the Playwright browser suite |
| `npm run check` | Run formatting, lint, type-check, and Vitest gates |

## Architecture

`src/sim/` is plain TypeScript and owns simulation rules, the seeded RNG,
controlled clock, append-only event log, replay, learning behavior, and
event-derived projections. It has no React or DOM dependency.

`src/app/` is the React presentation shell. It observes immutable simulation
snapshots through `useSyncExternalStore` and sends typed commands back to the
simulation. Simple/Advanced mode changes presentation only and never changes
the simulation or event history.

The event log is the sole source of truth for metrics, charts, tables,
summaries, and replay. The intended schedule controls eligibility, while only
the consequences the creature actually experiences can change its future
behavior.

## Documentation

Start with:

- [Product specification](docs/product-spec.md)
- [Core learner loop](docs/core-loop.md)
- [Implementation roadmap and current status](docs/roadmap.md)
- [Architecture overview](docs/architecture/overview.md)
- [Simulation data model](docs/architecture/data-model.md)
- [Testing strategy](docs/testing-strategy.md)
- [Accessibility requirements](docs/accessibility.md)
- [Accepted architecture decisions](docs/adr/README.md)
- [ABA terminology and copy glossary](docs/aba-glossary.md)

Contributors and coding agents must also follow [AGENTS.md](AGENTS.md). Local
copyrighted reference material under `docs/ref/` is intentionally ignored and
must not be committed.

## Release boundary

Passing automated checks is not sufficient for public release as an
educational tool. V1 also requires qualified behavior-analytic
subject-matter review, representative learner usability sessions,
learning-objective checks, and manual keyboard, screen-reader, touch,
reduced-motion, and color/contrast review. None of that review has happened
yet — the live demo above is a development preview, not a finished,
reviewed product.

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free to use, modify, and share for
any noncommercial purpose (personal, educational, research). Commercial use
requires separate permission from the author.
