# Angular Skill Assessment Platform

A production-grade, browser-based coding assessment tool that evaluates Angular developer proficiency in real-time. Candidates write code in a VS Code-like IDE that compiles and runs a real Angular application entirely in the browser using WebContainer API.

## Key Features

- **In-Browser Angular Compilation** — Real Angular 21 + Vite dev server running via WebContainer (WASM). No backend compilation needed.
- **VS Code-Like IDE** — Monaco Editor with file tree, tabs, syntax highlighting, and resizable panels.
- **Live Preview** — Hot module replacement updates the running app in < 1 second.
- **Three-Layer Testing** — Behavioral (logic), Structural (AST patterns), and DOM (rendered output) tests.
- **Weighted Scoring** — Easy (1x), Medium (2x), Hard (3x) difficulty multipliers with server-side recalculation.
- **AI Code Review** — Claude Sonnet evaluates code quality post-submission; Claude Haiku powers progressive hints.
- **Anti-Cheat Monitoring** — Tab switching, DevTools detection, large paste detection, keyboard shortcut blocking, and more.
- **Server-Side Verification** — Ed25519 signed test results, AES-256-GCM encrypted test specs, and independent server-side test re-execution.
- **Reporting Engine** — SQLite-backed analytics: candidate reports, leaderboard, cohort analytics with percentile distributions and discrimination indices, CSV/JSON/HTML exports.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Angular 21   │  │ Monaco Editor│  │  WebContainer API  │  │
│  │ Host App     │  │ (VS Code)    │  │  ┌──────────────┐  │  │
│  │              │  │              │  │  │ Angular 19    │  │  │
│  │ - Assessment │  │ - File Tree  │  │  │ Candidate App │  │  │
│  │ - Timer      │  │ - Tabs       │  │  │ + Vite HMR    │  │  │
│  │ - Anti-Cheat │  │ - Preview    │  │  │ + Test Runner │  │  │
│  └─────────────┘  └──────────────┘  │  └──────────────┘  │  │
│                                      └────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ /api/*
┌──────────────────────────▼──────────────────────────────────┐
│  Express 5 Backend (localhost:3001)                           │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Session   │ │ Crypto    │ │ Scoring  │ │ Test          │  │
│  │ Store     │ │ Ed25519   │ │ Weighted │ │ Re-Execution  │  │
│  │ Redis/Mem │ │ AES-GCM   │ │ + Penalty│ │ AST + Behav.  │  │
│  └──────────┘ └───────────┘ └──────────┘ └───────────────┘  │
│  ┌──────────┐ ┌───────────┐ ┌──────────────────────────────┐│
│  │ SQLite   │ │ Reporting │ │ Claude API (Sonnet + Haiku)  ││
│  │ (sql.js) │ │ + Export  │ │ Code Review + Hints          ││
│  └──────────┘ └───────────┘ └──────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
cd ng-compiler
npm install
npm start          # Starts client (:4200) + server (:3001)
```

Open http://localhost:4200 in your browser.

### Environment Variables

Copy and configure `server/.env`:

```env
ANTHROPIC_API_KEY=           # Claude API key (optional — LLM features degrade gracefully)
PORT=3001                    # Express server port
REDIS_URL=redis://localhost:6379  # Redis session store (optional — falls back to in-memory)
DB_PATH=server/data/assessments.db  # SQLite database path
EVALUATOR_API_KEY=           # API key for report endpoints (optional)
```

The platform works fully without any API keys — AI code review and hints simply won't be available.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Angular 21, Signals | Host application, standalone components |
| Editor | Monaco Editor 0.55 | VS Code-like code editing |
| Runtime | WebContainer API 1.6 | In-browser Node.js (WASM) |
| Candidate App | Angular 19 + Vite | What candidates code against |
| Backend | Express 5, TypeScript | Session management, security, LLM proxy |
| AI | Claude Sonnet + Haiku | Code review + progressive hints |
| Database | sql.js (SQLite WASM) | Persistent reporting & analytics |
| Session Store | ioredis / in-memory | Redis with graceful fallback |
| UI | Bootstrap 5 | Layout and components |

## Project Structure

```
ng-compiler/
├── src/app/
│   ├── core/
│   │   ├── constants/       # Problem definitions, WebContainer project template
│   │   ├── models/          # TypeScript interfaces
│   │   └── services/        # Assessment, timer, test runner, anti-cheat, session, hints
│   ├── features/
│   │   ├── editor/          # Monaco code editor + file system service
│   │   ├── file-explorer/   # File tree sidebar
│   │   ├── preview/         # Live app preview + console capture
│   │   ├── problem/         # Problem description panel (markdown)
│   │   ├── test-results/    # Test results + hints UI
│   │   └── workspace/       # Main layout with resizable panels
│   └── shared/              # Reusable components (tabs, split pane, loading overlay)
├── server/
│   ├── routes/              # session, submit, llm, reports
│   ├── services/            # crypto, scoring, test-executor, database, reporting, export
│   ├── middleware/           # session-auth, rate-limit, evaluator-auth
│   └── data/                # Server-side test specs, SQLite database
└── scripts/                 # WebContainer snapshot builder
```

## API Endpoints

### Session Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/session/start` | Create session (returns Ed25519 key + encrypted specs) |
| POST | `/api/session/heartbeat` | Timer sync (15s interval) |
| POST | `/api/session/event` | Anti-cheat event logging |
| POST | `/api/session/challenge` | Fresh execution nonce |
| POST | `/api/submit` | Submit + server-side verification |
| GET | `/api/session/:id/result` | Session result |

### LLM Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/llm/evaluate` | Claude Sonnet code review |
| POST | `/api/llm/hint` | Claude Haiku progressive hint |

### Reporting & Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/candidate/:sessionId` | Full candidate report |
| GET | `/api/reports/candidate/:sessionId/pdf` | HTML report (printable) |
| GET | `/api/reports/leaderboard/:problemId` | Ranked leaderboard |
| GET | `/api/reports/analytics/:problemId` | Cohort analytics + percentiles |
| GET | `/api/reports/analytics/:problemId/tests` | Per-test discrimination analysis |
| GET | `/api/reports/analytics/:problemId/trends` | Trends over time |
| GET | `/api/reports/export/:problemId/csv` | CSV export |
| GET | `/api/reports/export/:problemId/json` | JSON export |
| GET | `/api/reports/anti-cheat/:sessionId` | Anti-cheat audit trail |

## Security Architecture

```
Ed25519 Integrity Chain:
├─ Server generates Ed25519 keypair per session
├─ Private key injected into WebContainer run-tests.js
├─ run-tests.js signs results with private key
└─ Server verifies with public key (HMAC fallback for compat)

Encrypted Test Specs:
├─ AES-256-GCM encryption per session
├─ Mounted as test-specs.enc.json (not plaintext)
└─ Decrypted at runtime inside WebContainer

Server-Side Re-Execution:
├─ AST structural validation (TypeScript Compiler API)
├─ Behavioral tests re-run on code snapshot
├─ Client vs server results compared
└─ Mismatches flagged as warnings

Anti-Cheat (7 mechanisms):
├─ Keyboard shortcut blocking (F12, Ctrl+Shift+I/J/C)
├─ Large paste detection (>200 chars)
├─ Console.debug DevTools trick
├─ Frequent tab-switch detection (3+ in 30s)
├─ Screen capture detection
├─ Tab visibility + window blur/focus
└─ Server-side penalty engine (configurable, 50% max cap)
```

## Scripts

```bash
npm start              # Start client + server (development)
npm run start:client   # Angular dev server only
npm run start:server   # Express backend only (with watch)
npm run build          # Production build
npm run lint           # ESLint
npm run test           # Vitest
npm run build:snapshot # Pre-build WebContainer dependency snapshot
```


