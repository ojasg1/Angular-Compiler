# iMocha Angular Assessment Platform — Workflow & Technology Reference

> A comprehensive workflow prompt that documents how the platform is designed and which technologies power each layer.

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend Framework** | Angular | 21.1.0 | Standalone components, Signals, OnPush change detection |
| **Code Editor** | Monaco Editor | 0.55.1 | VS Code's editor core — syntax highlighting, IntelliSense, multi-file tabs |
| **In-Browser Runtime** | WebContainer API | 1.6.1 | WASM-based Node.js — runs npm, Vite, and test runner entirely in the browser |
| **Dev Server (in-browser)** | Vite | 5.4.11 | HMR dev server inside WebContainer on port 3000 |
| **Candidate App Framework** | Angular | 19.0.0 | The Angular version candidates code against inside WebContainer |
| **Backend Server** | Express | 5.1.0 | Session management, HMAC verification, LLM proxy, anti-cheat logging |
| **Server Runtime** | tsx | latest | TypeScript execution for Express server (watch mode in dev) |
| **AI — Code Review** | Claude Sonnet | claude-sonnet-4-20250514 | Holistic code quality evaluation on submission |
| **AI — Hints** | Claude Haiku | claude-haiku-4-5-20251001 | Fast, contextual progressive hints (levels 2–3) |
| **CSS Framework** | Bootstrap | 5.3.8 | Layout utilities, form components, responsive grid |
| **Icons** | Bootstrap Icons | 1.13.1 | UI iconography throughout the workspace |
| **Markdown Rendering** | marked | 17.0.3 | Problem description rendering |
| **Language** | TypeScript | 5.9.2 | Strict mode across client and server |
| **Reactive Primitives** | RxJS | 7.8.0 | Observable streams for WebContainer process output |
| **Bundler (host app)** | Angular CLI + esbuild | 21.1.3 | Production builds via `@angular/build:application` |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser Tab (localhost:4200)                                       │
│                                                                     │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────┐ │
│  │  Left Sidebar │  │  Center Panel    │  │  Right Panel          │ │
│  │              │  │                  │  │                       │ │
│  │  Problem     │  │  Monaco Editor   │  │  Live Preview iframe  │ │
│  │  (markdown)  │  │  (multi-file)    │  │  (Vite HMR @ :3000)  │ │
│  │              │  │                  │  │                       │ │
│  │  File        │  ├──────────────────┤  │  ↕ postMessage bridge │ │
│  │  Explorer    │  │  Bottom Panel    │  │    (DOM test commands) │ │
│  │              │  │  Console | Tests │  │                       │ │
│  │              │  │  | Errors        │  │                       │ │
│  └──────────────┘  └──────────────────┘  └───────────────────────┘ │
│       ↕ drag resize      ↕ drag resize        ↕ drag resize       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  WebContainer (WASM Node.js Runtime)                            ││
│  │  ├─ npm install (Angular 19, Vite 5.4.11, zone.js)             ││
│  │  ├─ vite dev server (port 3000, custom angular-inline plugin)   ││
│  │  ├─ node run-tests.js (custom Jasmine-like test framework)      ││
│  │  └─ File system (mount/read/write via WebContainer API)         ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
         │
         │ /api proxy (Angular CLI → Express)
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Express Backend (localhost:3001)                                    │
│                                                                     │
│  Middleware Chain:                                                   │
│  ┌─ CORS (origins: 4200, 4201) ─┐                                  │
│  ├─ JSON body parser (5MB limit) ─┤                                 │
│  └─ Rate limiter (60 req/min/session) ─┘                            │
│                                                                     │
│  Routes:                                                            │
│  ├─ POST /api/session/start      → Create session + nonce + HMAC key│
│  ├─ POST /api/session/heartbeat  → Timer sync (15s interval)        │
│  ├─ POST /api/session/event      → Anti-cheat event logging         │
│  ├─ POST /api/submit             → HMAC verify + score recalculate  │
│  ├─ POST /api/llm/evaluate       → Claude Sonnet code review        │
│  ├─ POST /api/llm/hint           → Claude Haiku progressive hint    │
│  ├─ GET  /api/session/:id/result → Session audit trail retrieval    │
│  └─ GET  /api/health             → Health check                     │
│                                                                     │
│  Services:                                                          │
│  ├─ SessionStore    — In-memory Map, 2-hour auto-cleanup            │
│  ├─ CryptoService   — HMAC-SHA256, nonce gen, timing-safe compare   │
│  └─ ScoringService  — Weighted difficulty calculation                │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ HTTPS (optional — graceful degradation without API key)
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Anthropic API                                                      │
│  ├─ Claude Sonnet → Code quality evaluation (512 tokens, on submit) │
│  └─ Claude Haiku  → Progressive hints (100 tokens, during coding)   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## End-to-End Workflow

### Phase 1: Authentication

```
User lands on localhost:4200
         │
         ▼
┌─────────────────────────┐
│  Auth Modal             │
│  ├─ Name (required)     │
│  ├─ Email (validated)   │
│  └─ Privacy consent ☑   │
└─────────┬───────────────┘
          │ canAuthenticate = name + valid email + consent
          ▼
    authenticate()
          │
          ▼
    startAssessment(problemId)
```

**Validation**: Email regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`, all three fields required.

---

### Phase 2: Boot Sequence (~15–30s)

```
startAssessment(problemId)
│
├─ 1. Load problem metadata from PROBLEMS constant
│     └─ Set: currentProblem, reset state
│
├─ 2. Start server session (non-blocking, graceful fail)
│     POST /api/session/start { problemId, candidateId }
│     └─ Receive: sessionId, nonce, hmacKey, serverStartTime, timeLimit
│
├─ 3. Boot WebContainer                    ← Stage: "Booting"
│     └─ WebContainer.boot() — initializes WASM runtime
│
├─ 4. Build file system tree
│     ├─ Start with DEFAULT_ANGULAR_PROJECT template
│     ├─ Inject HMAC credentials into run-tests.js:
│     │   __NONCE_PLACEHOLDER__  → actual nonce
│     │   __HMAC_KEY_PLACEHOLDER__ → actual hmacKey
│     ├─ Mount candidate starter files
│     ├─ Inline templateUrl/styleUrl in .component.ts files
│     └─ Mount test-specs.json from problem definition
│
├─ 5. Mount to WebContainer
│     └─ webContainer.mount(fileSystemTree)
│
├─ 6. Load starter files into Monaco editor
│
├─ 7. Start timer (countdown from problem.timeLimit)
│     └─ Auto-submit callback on expiry
│
├─ 8. Start heartbeat (every 15 seconds)
│     POST /api/session/heartbeat { clientRemaining }
│     └─ Sync timer, detect >3s drift
│
├─ 9. Start anti-cheat monitoring
│     └─ Attach event listeners (see Phase 6)
│
└─ 10. Bootstrap dev server (background)    ← Stage: "Installing"
       ├─ npm install --prefer-offline --no-audit
       ├─ Start Vite dev server on port 3000  ← Stage: "Starting"
       └─ Preview iframe connects             ← Stage: "Ready"
```

**Loading overlay** displays progress through 4 stages: Booting → Installing → Starting → Ready.

---

### Phase 3: Coding Experience

```
┌─────────────────────────────────────────────────────────┐
│  File Edit Loop                                         │
│                                                         │
│  Monaco Editor                                          │
│       │ (keystroke)                                     │
│       ▼                                                 │
│  FileSystemService.updateFileContent(path, content)     │
│       │                                                 │
│       ▼                                                 │
│  WebContainer.writeFile(path, content)                  │
│       │                                                 │
│       ▼                                                 │
│  Vite detects change → HMR update (<1s)                 │
│       │                                                 │
│       ▼                                                 │
│  Preview iframe re-renders live                         │
│                                                         │
│  Console bridge captures console.log/warn/error         │
│  from iframe via postMessage → Console tab              │
│                                                         │
│  Compilation errors parsed from Vite/Angular output     │
│  → Errors tab with file:line:column info                │
└─────────────────────────────────────────────────────────┘
```

**Key features**:
- Multi-file tabs with close buttons
- Read-only markers on config files
- Syntax highlighting + IntelliSense via Monaco
- Dark/light theme toggle (persists via CSS class on `<body>`)
- Resizable panels (sidebar, bottom, preview) via drag handles + keyboard arrows

---

### Phase 4: Test Execution (3-Layer Architecture)

```
User clicks "Run Tests"
│
├─ Set bottomTab = 'tests'
│
▼
TestRunnerService.runTests()
│
├─── LAYER 1+2: Behavioral & Structural Tests ──────────────┐
│    WebContainer.spawn('node', ['run-tests.js'])            │
│    │                                                       │
│    │  run-tests.js loads test-specs.json                   │
│    │  For each test spec:                                  │
│    │  ├─ Structural: fs.readFileSync() + regex matching    │
│    │  │   └─ Checks: signal(), computed(), @for, @empty   │
│    │  │                                                    │
│    │  └─ Behavioral: requireTS() + eval                    │
│    │      ├─ Strip decorators & Angular imports             │
│    │      ├─ Replace with stubs (signal, computed, inject) │
│    │      ├─ Eval transpiled code                          │
│    │      └─ Run assertions (Jasmine-like matchers)        │
│    │                                                       │
│    │  Output:                                              │
│    │  __TEST_RESULTS_START__                               │
│    │  { total, passed, failed, results[], signature, nonce}│
│    │  __TEST_RESULTS_END__                                 │
│    │                                                       │
│    └─ Parse JSON → Extract HMAC signature                  │
│                                                            │
├─── LAYER 3: DOM Tests ─────────────────────────────────────┐
│    Wait 1000ms (let Vite HMR settle)                       │
│    │                                                       │
│    │  For each DomTestSpec:                                │
│    │  ├─ Execute steps sequentially:                       │
│    │  │   postMessage → iframe                             │
│    │  │   ├─ querySelector(selector)                       │
│    │  │   ├─ querySelectorAll(selector)                    │
│    │  │   ├─ click(selector)                               │
│    │  │   ├─ type(selector, value)                         │
│    │  │   └─ wait(ms)                                      │
│    │  │                                                    │
│    │  └─ Assert results:                                   │
│    │      ├─ exists / notExists                            │
│    │      ├─ textContains                                  │
│    │      ├─ countGte / countLte / countEquals             │
│    │      ├─ hasClass                                      │
│    │      └─ valueEquals                                   │
│    │                                                       │
│    └─ Collect DOM TestResults                              │
│                                                            │
├─── RESULT COMPOSITION ─────────────────────────────────────┐
│    Combine Layer 1+2 results + Layer 3 results             │
│    │                                                       │
│    ├─ Mask hidden tests for UI:                            │
│    │   name → "Hidden test case"                           │
│    │   errorMessage → undefined                            │
│    │                                                       │
│    ├─ Keep fullResults (unmasked) for LLM evaluation       │
│    │                                                       │
│    └─ Calculate weighted score:                            │
│        Easy × 1  +  Medium × 2  +  Hard × 3               │
│        Score = earned_weight / max_weight × 100            │
└────────────────────────────────────────────────────────────┘
```

**Test Distribution** (14 total):

| Difficulty | Weight | Count | Max Weight | Visibility |
|-----------|--------|-------|------------|------------|
| Easy | 1× | 6 | 6 | 2 visible, 4 hidden |
| Medium | 2× | 5 | 10 | 1 visible, 4 hidden |
| Hard | 3× | 3 | 9 | 0 visible, 3 hidden |
| **Total** | | **14** | **25** | **3 visible, 11 hidden** |

---

### Phase 5: Progressive Hint System

```
User clicks "Hint" on a failed test
│
▼
HintService.requestHint(testName, errorMessage, code, problemDesc)
│
├─ Level 1 (instant, no API call)
│  └─ Pattern match against 32 common Angular error patterns:
│     ├─ /Expected undefined/     → "Make sure the property exists"
│     ├─ /is not a function/      → "Check you defined it as a method"
│     ├─ /toMatch.*signal/        → "Use Angular's signal() function"
│     ├─ /toMatch.*@for/          → "Use @for syntax, not *ngFor"
│     ├─ /toMatch.*computed/      → "Use computed() for derived state"
│     └─ ... (27 more patterns)
│     └─ Fallback: "Review the test name for clues"
│
├─ Level 2 (Claude Haiku API, 100 tokens)
│  POST /api/llm/hint { testName, errorMessage, code, problemDesc, level: 2 }
│  └─ Prompt: "Give SPECIFIC hint with exact Angular API/method name"
│  └─ Returns: targeted API guidance without full answer
│
└─ Level 3 (Claude Haiku API, 100 tokens)
   POST /api/llm/hint { testName, errorMessage, code, problemDesc, level: 3 }
   └─ Prompt: "Give near-answer with code STRUCTURE to fill in"
   └─ Returns: skeleton/pattern showing approach without exact implementation
```

**State tracking**: Each test maintains its own hint level (0→1→2→3 max). Total hints used is sent with submission for LLM evaluation.

---

### Phase 6: Anti-Cheat Monitoring

```
AntiCheatService.startMonitoring()
│
├─ document.visibilitychange
│  └─ document.hidden → report 'tab_blur' → increment tabBlurCount
│
├─ window.blur / window.focus
│  └─ report 'window_blur' / 'window_focus'
│
├─ document.copy
│  └─ report 'copy' { selectionLength } → increment copyCount
│
├─ document.paste
│  └─ report 'paste'
│
├─ document.contextmenu
│  └─ report 'context_menu' (logged, not blocked)
│
└─ DevTools detection (setInterval every 2000ms)
   └─ Heuristic: outerWidth - innerWidth > 160px
                OR outerHeight - innerHeight > 160px
   └─ report 'devtools_open' → set devToolsDetected signal
│
▼ All events sent to:
POST /api/session/event { type, timestamp, metadata }
     └─ Stored in session.events[] for audit trail
     └─ Non-critical: fetch errors silently ignored
```

---

### Phase 7: Submission Flow

```
User clicks "Submit" → Confirmation dialog → Confirm
│
▼
AssessmentService.submit()
│
├─ 1. Stop timer
├─ 2. Stop anti-cheat monitoring
├─ 3. Run final test suite (same 3-layer process)
├─ 4. Collect code snapshot (all editable files)
│
├─ 5. Submit to server
│     POST /api/submit
│     Headers: { x-session-id }
│     Body: {
│       testResults: { total, passed, failed, results[] },
│       domTestResults: [],
│       signature,          ← HMAC-SHA256 of test results
│       nonce,              ← Server-issued nonce
│       clientTimestamp,
│       codeSnapshot: [{ path, content }]
│     }
│
│     Server-side verification pipeline:
│     ├─ a. Check session not already submitted (409 if duplicate)
│     ├─ b. Check timing (30s grace period past timeLimit)
│     ├─ c. Verify HMAC signature (timing-safe comparison)
│     │     payload = nonce + JSON.stringify(testResults)
│     │     └─ Mismatch → warning flag (accepted but flagged)
│     ├─ d. Cross-validate test count vs expected
│     ├─ e. Detect suspicious DOM patterns (all pass + 0ms)
│     ├─ f. Recalculate weighted score server-side
│     └─ g. Store result + code snapshot in session
│
│     Response: {
│       serverScore, serverTimestamp, timeTaken,
│       warnings[], submissionId,
│       difficultyBreakdown[], testResults[]
│     }
│
├─ 6. Request LLM evaluation (optional, if API key set)
│     POST /api/llm/evaluate
│     Body: {
│       problemDescription, codeFiles[],
│       testSuite (full unmasked results),
│       maxScore, hintsUsed
│     }
│
│     Claude Sonnet evaluates:
│     ├─ Code correctness beyond pass/fail
│     ├─ Angular patterns (signals, standalone, OnPush)
│     ├─ Naming conventions and structure
│     ├─ Partial credit for good approaches
│     └─ Returns: {
│           adjustedScore (capped at serverScore + 2),
│           reasoning,
│           codeQuality: {
│             maintainability (1-10),
│             reliability (1-10),
│             cyclomaticComplexity (low|moderate|high)
│           }
│         }
│
└─ 7. Display final score overlay
      ├─ Server-verified score (or client score as fallback)
      ├─ Difficulty breakdown (easy/medium/hard)
      ├─ AI code quality feedback (if available)
      └─ isSubmitted = true
```

---

### Phase 8: Security Architecture

```
┌─── HMAC Integrity Chain ───────────────────────────────────────┐
│                                                                │
│  Server creates session:                                       │
│  ├─ nonce = crypto.randomBytes(32).toString('hex')             │
│  └─ hmacKey = crypto.randomBytes(32).toString('hex')           │
│         │                                                      │
│         ▼ sent to client                                       │
│  Client injects into WebContainer run-tests.js:                │
│  ├─ __NONCE__ = '<actual nonce>'                               │
│  └─ __HMAC_KEY__ = '<actual hmacKey>'                          │
│         │                                                      │
│         ▼ after test execution                                 │
│  run-tests.js signs results:                                   │
│  ├─ payload = nonce + JSON.stringify(testOutput)                │
│  └─ signature = HMAC-SHA256(hmacKey, payload)                  │
│         │                                                      │
│         ▼ on submission                                        │
│  Server verifies:                                              │
│  ├─ Reconstruct payload from submitted data                    │
│  ├─ Recompute expected signature                               │
│  ├─ crypto.timingSafeEqual(expected, received)                 │
│  └─ Flag warning on mismatch (accept but audit)                │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌─── Server-Side Safeguards ─────────────────────────────────────┐
│  ├─ Rate limiting: 60 req/min per session (sliding window)     │
│  ├─ Session auth middleware: validates x-session-id header     │
│  ├─ Auto-expiry: sessions expire after timeLimit + 30s grace   │
│  ├─ Score recalculation: server independently computes score   │
│  ├─ Test count validation: flags mismatched result counts      │
│  ├─ DOM test anomaly detection: flags all-pass + 0ms patterns  │
│  ├─ Session store cleanup: purge sessions >2 hours old (5min)  │
│  └─ LLM score cap: adjusted score ≤ serverScore + 2           │
└────────────────────────────────────────────────────────────────┘

┌─── Client-Side Monitoring ─────────────────────────────────────┐
│  ├─ Tab visibility changes (visibilitychange API)              │
│  ├─ Window blur/focus events                                   │
│  ├─ Copy/paste interception (with selection metadata)          │
│  ├─ Context menu detection                                     │
│  ├─ DevTools detection (window dimension heuristic, 160px)     │
│  └─ All events reported to server audit trail                  │
└────────────────────────────────────────────────────────────────┘

┌─── Test Obfuscation ──────────────────────────────────────────┐
│  ├─ 11/14 tests are hidden (name + error masked in UI)         │
│  ├─ Full results kept internally for LLM evaluation            │
│  ├─ Test specs stored as JSON (not visible in file explorer)   │
│  └─ requireTS() strips types/decorators → prevents TS errors   │
└────────────────────────────────────────────────────────────────┘
```

---

## File Reference

### Frontend (Angular 21)

| File | Role |
|------|------|
| `src/app/app.ts` | Root component — auth gate, 3-column layout, drag resize, confirmation dialogs |
| `src/app/app.html` | Template — auth modal, workspace grid, loading overlay |
| `src/app/app.scss` | Styles — panel layout, drag handles, theme variables |
| `src/app/app.config.ts` | Angular providers (change detection, animations) |
| `src/app/core/services/assessment.service.ts` | **Orchestrator** — boot, test, submit lifecycle |
| `src/app/core/services/test-runner.service.ts` | 3-layer test execution + weighted scoring |
| `src/app/core/services/dom-test-bridge.service.ts` | iframe postMessage protocol for DOM tests |
| `src/app/core/services/hint.service.ts` | 3-level progressive hints (pattern + LLM) |
| `src/app/core/services/session.service.ts` | Server communication (session, heartbeat, events) |
| `src/app/core/services/anti-cheat.service.ts` | Tab blur, copy/paste, DevTools monitoring |
| `src/app/core/services/timer.service.ts` | Countdown timer with server sync |
| `src/app/core/services/llm-evaluator.service.ts` | LLM evaluation proxy |
| `src/app/core/services/webcontainer.service.ts` | WebContainer boot, mount, spawn, teardown |
| `src/app/core/services/file-system.service.ts` | Virtual file system management |
| `src/app/core/services/compilation.service.ts` | Error parsing from Vite/Angular output |
| `src/app/core/services/app-console.service.ts` | Console output aggregation |
| `src/app/core/constants/default-angular-project.ts` | WebContainer file tree template |
| `src/app/core/constants/problems.ts` | Problem definition + 14 test specifications |
| `src/app/core/models/problem.model.ts` | TypeScript interfaces (Test, Problem, Score) |
| `src/app/features/editor/code-editor.component.ts` | Monaco editor wrapper |
| `src/app/features/file-explorer/file-tree.component.ts` | File explorer tree |
| `src/app/features/preview/preview-panel.component.ts` | Live preview iframe |
| `src/app/features/preview/app-console.component.ts` | Console output display |
| `src/app/features/preview/console-output.component.ts` | Console line rendering |
| `src/app/features/problem/problem-panel.component.ts` | Problem description (markdown) |
| `src/app/features/test-results/test-results-panel.component.ts` | Test results + hints UI |
| `src/app/features/workspace/workspace-header.component.ts` | Header bar — timer, buttons, toggles |
| `src/app/shared/components/loading-overlay.component.ts` | Boot stage progress display |
| `src/app/shared/components/tab-bar.component.ts` | Editor file tabs |

### Backend (Express 5)

| File | Role |
|------|------|
| `server/index.ts` | Express app — CORS, middleware, route mounting, health check |
| `server/types.ts` | Shared TypeScript interfaces |
| `server/routes/session.routes.ts` | Session start, heartbeat, event logging, result retrieval |
| `server/routes/submit.routes.ts` | HMAC verification + server-side score recalculation |
| `server/routes/llm.routes.ts` | Claude API proxy (evaluate + hint) |
| `server/services/session-store.ts` | In-memory session storage with auto-cleanup |
| `server/services/crypto.service.ts` | HMAC-SHA256, nonce generation, timing-safe comparison |
| `server/services/scoring.service.ts` | Weighted score calculation |
| `server/middleware/session-auth.ts` | Session validation + auto-expiry middleware |
| `server/middleware/rate-limit.ts` | Sliding window rate limiter (60/min) |

### Configuration

| File | Role |
|------|------|
| `angular.json` | Build config, proxy, COOP/COEP headers, assets |
| `proxy.conf.json` | `/api` → `http://localhost:3001` |
| `tsconfig.json` | Strict TypeScript, path mappings |
| `tsconfig.app.json` | Client compilation (excludes server) |
| `server/tsconfig.json` | Server compilation (ESNext modules) |
| `server/.env` | `ANTHROPIC_API_KEY`, `PORT` (optional) |
| `eslint.config.js` | TypeScript-ESLint flat config |

---

## How to Run

```bash
cd ng-compiler
npm install                    # First time only
npm start                      # Starts client (:4200) + server (:3001)
```

Optional: Create `server/.env` with `ANTHROPIC_API_KEY=sk-ant-...` to enable AI features (code review + LLM hints). The platform works fully without it — LLM features gracefully degrade.

---

## Key Design Decisions

1. **WebContainer over remote compilation** — Zero infrastructure. No Docker, no CI runners. Everything runs in the candidate's browser tab via WASM.

2. **3-layer testing** — Behavioral tests (eval) catch logic errors, structural tests (regex) verify Angular feature usage, DOM tests (postMessage) validate the running UI. Each layer catches different failure modes.

3. **Hidden tests (11/14)** — Candidates see 3 test names and errors for debugging. The other 11 are masked to prevent reverse-engineering expected behavior.

4. **HMAC chain of trust** — Server issues nonce + key → injected into WebContainer → run-tests.js signs results → server verifies on submit. Prevents result tampering without server-side test execution.

5. **Server-side score recalculation** — Client score is never trusted. Server independently computes weighted score from individual test results.

6. **LLM score cap (+2)** — Claude can award up to 2 points above the test score for code quality, but never more. Prevents AI from inflating scores arbitrarily.

7. **Progressive hints (3 levels)** — Level 1 is instant pattern matching (no API cost). Levels 2–3 use Claude Haiku (fast, cheap). Guides without giving away answers.

8. **Graceful degradation** — No API key? LLM features disabled, everything else works. Server down? Client-only mode with local scoring. Network issues? Heartbeat failures silently ignored.
