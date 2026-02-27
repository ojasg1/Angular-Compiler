# Angular Skill Assessment Platform — Hackathon Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Tech Stack & Why We Chose It](#3-tech-stack--why-we-chose-it)
4. [Architecture Overview](#4-architecture-overview)
5. [How It Works — End-to-End Flow](#5-how-it-works--end-to-end-flow)
6. [Core Services Deep Dive](#6-core-services-deep-dive)
7. [Testing Engine](#7-testing-engine)
8. [AI-Powered Features](#8-ai-powered-features)
9. [UI/UX Design](#9-uiux-design)
10. [Project Structure](#10-project-structure)
11. [Key Design Decisions](#11-key-design-decisions)
12. [Challenges & How We Solved Them](#12-challenges--how-we-solved-them)
13. [Future Scope](#13-future-scope)

---

## 1. Project Overview

**Angular Skill Assessment Platform** is a browser-based coding assessment tool that evaluates Angular developer proficiency in real-time. Candidates write Angular code in a full-featured IDE, compile and preview it live, and get scored through automated tests and AI-powered code review — all running entirely in the browser with zero backend.

### Key Highlights

- **Zero Backend** — Everything runs client-side using WebContainer API (Node.js in the browser)
- **Real Angular Environment** — Not a sandbox or mock; actual Angular 21 compilation with Vite
- **Three-Layer Testing** — Behavioral (logic), Structural (code patterns), DOM (rendered output)
- **Weighted Scoring** — Easy/Medium/Hard difficulty tiers with proportional point values
- **AI Code Review** — Claude API evaluates code quality, provides partial credit, and generates progressive hints
- **VS Code-Like IDE** — Monaco Editor with file tree, tabs, live preview, console, and resizable panels

---

## 2. Problem Statement

Traditional coding assessments for Angular developers have critical limitations:

| Problem | Our Solution |
|---------|-------------|
| Simple text-based code editors with no compilation | Full Angular compilation environment with Vite |
| Tests run on a remote server (latency, security risks) | Tests run entirely in the browser via WebContainer |
| Binary pass/fail scoring | Weighted scoring by difficulty + AI partial credit |
| No feedback during assessment | Progressive hint system + live preview + error panel |
| Easy to game with hardcoded answers | Hidden tests + structural checks + AI code review |
| Cannot test DOM rendering behavior | DOM tests via iframe bridge that interact with the running app |

---

## 3. Tech Stack & Why We Chose It

### Core Framework

| Technology | Version | Why We Chose It |
|-----------|---------|-----------------|
| **Angular 21** | ^21.1.0 | We're building an Angular assessment tool — it makes sense to use the latest Angular with signals, standalone components, and new control flow (`@for`, `@if`, `@empty`). This also demonstrates our proficiency with cutting-edge Angular features. |
| **TypeScript** | ~5.9.2 | Type safety, better DX, and required by Angular. Strict mode enabled for production-quality code. |

### In-Browser Runtime

| Technology | Version | Why We Chose It |
|-----------|---------|-----------------|
| **WebContainer API** | ^1.6.1 | **The core innovation.** WebContainer runs a full Node.js environment inside the browser using WebAssembly. This eliminates the need for any backend server — npm install, Vite dev server, and test execution all happen client-side. No Docker, no VMs, no server costs. |
| **Vite** | (bundled) | Angular's default build tool. Blazing fast HMR (Hot Module Replacement) gives candidates instant feedback as they code. Vite compiles TypeScript + Angular templates in milliseconds. |

**Why WebContainer over alternatives?**

| Alternative | Drawback | WebContainer Advantage |
|------------|----------|----------------------|
| Remote server compilation | Latency, scaling costs, security | Zero latency, zero cost, fully isolated |
| StackBlitz SDK | Limited API, no test execution control | Full Node.js access, custom test runner |
| CodeSandbox | Requires backend, API limitations | Completely client-side |
| iframe + transpiler (Babel) | No real Angular compilation | Full Angular compiler with decorators, DI, signals |

### Code Editor

| Technology | Version | Why We Chose It |
|-----------|---------|-----------------|
| **Monaco Editor** | ^0.55.1 | The same editor that powers VS Code. Provides syntax highlighting, IntelliSense, error squiggles, multi-file support, and theme switching. Candidates feel at home because it looks and behaves like their daily IDE. |

**Why Monaco over alternatives?**

- **CodeMirror**: Lighter but lacks Angular/TypeScript IntelliSense
- **Ace Editor**: Older, less feature-rich
- **Custom textarea**: No syntax highlighting, terrible DX

### UI Framework

| Technology | Version | Why We Chose It |
|-----------|---------|-----------------|
| **Bootstrap 5** | ^5.3.8 | Rapid prototyping for a hackathon. Provides grid system, utility classes, and responsive components out of the box. No time to build a custom design system. |
| **Bootstrap Icons** | ^1.13.1 | Consistent icon set that pairs with Bootstrap. 1,800+ icons for file types, status indicators, and UI controls. |
| **SCSS** | (built-in) | Angular's inline style support with SCSS gives us variables, nesting, and mixins for component styles. |

### AI Integration

| Technology | Why We Chose It |
|-----------|-----------------|
| **Claude API (Anthropic)** | Powers two features: (1) **AI Code Review** — evaluates code quality, maintainability, and correctness after submission; (2) **Progressive Hints** — generates contextual hints for failing tests. Claude Sonnet for evaluation (better reasoning), Claude Haiku for hints (faster, cheaper). |

**Why Claude over alternatives?**

- **GPT-4**: Good but Claude's structured output parsing is more reliable for JSON responses
- **Gemini**: Less mature function calling
- **Local LLM**: Too slow for real-time hint generation, requires GPU

### Other Libraries

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Marked** | ^17.0.3 | Renders problem descriptions from Markdown to HTML. Supports code blocks, tables, and formatting. |
| **RxJS** | ~7.8.0 | Required by Angular. Used for reactive event handling and async operations. |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (Client-Side Only)            │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Monaco       │  │  Preview     │  │  Test Results  │  │
│  │  Editor       │  │  (iframe)    │  │  Panel         │  │
│  │              │  │              │  │               │  │
│  │  TypeScript   │  │  Live Angular│  │  Pass/Fail    │  │
│  │  HTML / CSS   │  │  App Output  │  │  Weighted Pts │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│         ▼                 ▼                   ▼          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Angular Service Layer                   │ │
│  │                                                      │ │
│  │  AssessmentService ← orchestrates everything         │ │
│  │  FileSystemService ← virtual files + debounced sync  │ │
│  │  CompilationService ← parses TS/Angular errors       │ │
│  │  TestRunnerService ← 3-layer test execution          │ │
│  │  TimerService ← countdown timer                      │ │
│  │  HintService ← progressive hints (pattern + AI)      │ │
│  │  LlmEvaluatorService ← AI code review                │ │
│  │  AppConsoleService ← captures console.log             │ │
│  │  DomTestBridgeService ← iframe DOM commands           │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              WebContainer (WASM)                     │ │
│  │                                                      │ │
│  │  Node.js Runtime ──► npm install                     │ │
│  │                  ──► Vite Dev Server (port 3000)     │ │
│  │                  ──► node run-tests.js               │ │
│  │                                                      │ │
│  │  Virtual File System:                                │ │
│  │    /src/app/*.ts    (candidate's code)               │ │
│  │    /package.json    (Angular + Vite deps)            │ │
│  │    /vite.config.ts  (Angular JIT compilation)        │ │
│  │    /run-tests.js    (custom test framework)          │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌──────────────────────┐  ┌────────────────────────┐    │
│  │  Claude API (Sonnet)  │  │  Claude API (Haiku)     │   │
│  │  Code Review +        │  │  Progressive Hints      │   │
│  │  Partial Credit       │  │  (Level 2 & 3)          │   │
│  └──────────────────────┘  └────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Types Code
      │
      ▼
Monaco Editor ──(content change)──► FileSystemService
      │                                    │
      │                         (debounce 1.5s)
      │                                    │
      │                                    ▼
      │                          WebContainer.writeFile()
      │                                    │
      │                                    ▼
      │                            Vite HMR Rebuild
      │                                    │
      ├────────────────────────────────────►│
      │                                    ▼
      │                          Preview iframe updates
      │
      ▼
User Clicks "Run Tests"
      │
      ▼
AssessmentService.runTests()
      │
      ├──► Phase 1: node run-tests.js (WebContainer)
      │         │
      │         ├── Behavioral tests: requireTS() → eval()
      │         ├── Structural tests: fs.readFileSync() → regex
      │         └── Output: JSON results
      │
      ├──► Phase 2: DOM tests (iframe bridge)
      │         │
      │         ├── querySelector, click, type commands
      │         └── postMessage ↔ iframe communication
      │
      ▼
TestRunnerService.calculateWeightedScore()
      │
      ├── Easy (1x) │ Medium (2x) │ Hard (3x)
      ▼
Score + DifficultyBreakdown → UI
```

---

## 5. How It Works — End-to-End Flow

### Step 1: Problem Selection
- User sees a card with available problems (currently: Task Board)
- Each problem shows: title, time limit, max score, number of starter files
- User clicks a problem to begin

### Step 2: Environment Bootstrap (15-30s)
1. **WebContainer boots** — Initializes WASM-based Node.js runtime
2. **File system mounts** — Merges default Angular project scaffold + problem starter files + test specs
3. **npm install** — Installs Angular, Vite, and dependencies inside WebContainer
4. **Vite dev server starts** — Compiles Angular app, serves on localhost:3000
5. **Preview iframe connects** — Shows the running Angular app
6. **Loading overlay** — Shows progress with step indicators (Booting → Installing → Starting → Ready)

### Step 3: Coding
- **Monaco Editor** — Full TypeScript/HTML/CSS editing with syntax highlighting
- **File Tree** — Navigate between files (app.component.ts/html/css, task.service.ts, task-card/*)
- **Tab Bar** — Up to 5 open file tabs with dirty indicators
- **Live Preview** — Vite HMR updates the preview iframe within ~1s of saving
- **Error Panel** — Real-time TypeScript and Angular compilation errors parsed from Vite output
- **Console** — Captures console.log/warn/error from the running app

### Step 4: Testing
- User clicks **"Run Tests"** → switches to Tests tab
- **Phase 1**: WebContainer runs `node run-tests.js`
  - 8 behavioral tests evaluate TypeScript logic via `requireTS()`
  - 3 structural tests check code patterns via `fs.readFileSync()`
- **Phase 2**: DOM test bridge runs 3 tests against the live preview iframe
  - Types into inputs, clicks buttons, waits for rendering, asserts DOM state
- Results displayed with:
  - Total score (weighted pts)
  - Progress bar
  - Difficulty breakdown (easy/medium/hard with per-tier points)
  - Individual test results with pass/fail, duration, and point value
  - Hidden tests show masked names ("Hidden Test #N")

### Step 5: Hints (Optional)
- Failed visible tests show a **"Get Hint"** button
- Progressive 3-level hint system:
  - **Level 1**: Pattern-matched hints (instant, no API call) — matches common Angular error patterns
  - **Level 2**: Specific API guidance from Claude Haiku (fast, contextual)
  - **Level 3**: Near-answer structural hint from Claude (detailed, last resort)
- Hint usage is tracked and may affect AI-adjusted score

### Step 6: Submission
- User clicks **"Submit"** → confirmation dialog
- Final test run executes
- **AI Code Review** (if API key configured):
  - Sends problem description, all code files, and test results to Claude Sonnet
  - Claude evaluates: correctness, code quality, maintainability, reliability, complexity
  - Returns an adjusted score with reasoning
- **Submission Overlay** shows:
  - Test Score (weighted) with difficulty breakdown
  - AI Code Review with quality ratings (maintainability, reliability, complexity)
  - Final Score (AI-adjusted if available)

---

## 6. Core Services Deep Dive

### AssessmentService — The Orchestrator
**File**: `core/services/assessment.service.ts` (215 lines)

The central service that coordinates the entire assessment lifecycle:

```
initialize(problemId)
  ├── Find problem from PROBLEMS array
  ├── Load starter files into FileSystemService
  ├── Boot WebContainer
  ├── Build file system tree (default project + starter files + test specs)
  ├── Mount files into WebContainer
  ├── Start timer
  └── Bootstrap dev server (npm install + vite)

runTests()
  ├── Flush pending file writes
  └── Delegate to TestRunnerService

submit()
  ├── Run final tests
  ├── Invoke LlmEvaluatorService (if API key present)
  └── Compute final score
```

**Key method — `buildFileSystemTree()`**:
Merges three sources into a single WebContainer file tree:
1. `DEFAULT_ANGULAR_PROJECT` — package.json, vite.config, tsconfig, run-tests.js, main.ts
2. Problem starter files — candidate's editable code (app.component.ts, task.service.ts, etc.)
3. Test specs — `PROBLEM_TEST_SPECS[problemId]` serialized as `test-specs.json`

**Key method — `inlineTemplateAndStyles()`**:
Angular's JIT compiler in Vite mode needs inline templates. This method converts:
```typescript
// Before
@Component({ templateUrl: './app.component.html', styleUrl: './app.component.css' })

// After (at mount time)
@Component({ template: `<actual html content>`, styles: [`actual css content`] })
```

### WebContainerService — The Runtime
**File**: `core/services/webcontainer.service.ts` (157 lines)

Manages the WebContainer lifecycle:
- **boot()** — Initialize the WASM-based Node.js runtime
- **mountFiles(tree)** — Write the entire file system tree
- **installDependencies()** — Run `npm install` inside the container
- **startDevServer()** — Start Vite, listen for 'server-ready' event on port 3000
- **spawn(command, args)** — Execute commands (e.g., `node run-tests.js`)
- **writeFile/readFile** — Individual file operations for debounced syncing

**Stage signal**: `booting → installing → starting → ready → idle | error`

### FileSystemService — Virtual File System
**File**: `features/editor/editor.service.ts` (150+ lines)

Manages the in-memory file state and syncs changes to WebContainer:
- Maintains a signal of `VirtualFile[]` with path, content, language, readOnly, dirty flags
- **Debounced writes** (1500ms) — Prevents overwhelming WebContainer with rapid keystrokes
- **Template/style inlining** — When a `.component.ts` file changes, resolves its `templateUrl` and `styleUrl` to inline content before writing to WebContainer
- **Tab management** — Max 5 open tabs with active file tracking

### CompilationService — Error Parser
**File**: `core/services/compilation.service.ts` (208 lines)

Watches Vite's build output and extracts structured errors:
- Parses TypeScript errors: `file.ts:10:5 - error TS2339: Property 'x' does not exist`
- Parses Angular template errors: `NG8002: Can't bind to 'ngModel'`
- Parses Vite/esbuild errors: `ERROR: No matching export in "file.ts"`
- Maps error codes to friendly messages
- Powers the **Problems** tab in the bottom panel

---

## 7. Testing Engine

### Three-Layer Testing Architecture

We designed a three-layer testing approach to comprehensively evaluate Angular skills:

```
┌─────────────────────────────────────────────┐
│  Layer 1: BEHAVIORAL TESTS (requireTS)       │
│  Tests the LOGIC of the code                 │
│  • Instantiates classes, calls methods       │
│  • Verifies return values and state changes  │
│  • Runs inside WebContainer via eval()       │
│  • 8 tests (3 easy, 3 medium, 2 hard)        │
├─────────────────────────────────────────────┤
│  Layer 2: STRUCTURAL TESTS (fs.readFileSync) │
│  Tests the CODE PATTERNS used                │
│  • Reads source files as strings             │
│  • Regex matching for required patterns      │
│  • Verifies: signal(), computed(), @for, etc │
│  • 3 tests (2 easy, 1 medium)                │
├─────────────────────────────────────────────┤
│  Layer 3: DOM TESTS (iframe bridge)          │
│  Tests the RENDERED OUTPUT                   │
│  • Interacts with the live Angular app       │
│  • Types into inputs, clicks buttons         │
│  • Asserts DOM state after interactions      │
│  • 3 tests (1 easy, 1 medium, 1 hard)        │
└─────────────────────────────────────────────┘
```

### Why Three Layers?

| Layer | What It Catches | What It Misses |
|-------|----------------|----------------|
| Behavioral | Logic errors, wrong algorithms | Template binding issues |
| Structural | Missing Angular features (signals, @for) | Runtime behavior |
| DOM | Visual/interaction bugs | Internal code quality |

Together, they cover:
- Does the logic work? (behavioral)
- Does the code use Angular properly? (structural)
- Does the app actually render and respond? (DOM)

### requireTS() — Custom TypeScript Evaluator

Since WebContainer's Node.js can't directly `require()` TypeScript files, we built `requireTS()`:

```
TypeScript Source
      │
      ▼
Strip @Component/@Injectable decorators
      │
      ▼
Strip import/export statements
      │
      ▼
Strip TypeScript syntax (interface, generics, type annotations, access modifiers)
      │
      ▼
Wrap in function with Angular stubs (signal, computed, inject, input, output)
      │
      ▼
eval() → Returns exported class
      │
      ▼
Test instantiates class and calls methods
```

**Angular stubs** provide mock implementations:
- `signal(initial)` → Returns a callable function with `.set()` and `.update()` methods
- `computed(fn)` → Returns the function itself (evaluated on call)
- `inject(token)` → Returns `new token()` (simplified DI)
- `input()` / `output()` → Signal-like stubs

### DOM Test Bridge

The DOM test bridge enables testing the live Angular app in the preview iframe:

```
Test Runner                    Preview iframe
    │                               │
    │──── postMessage ─────────────►│
    │     { command: 'click',       │
    │       selector: 'button' }    │
    │                               │
    │◄─── postMessage ──────────────│
    │     { found: true,            │
    │       clicked: true }         │
    │                               │
```

Supported commands: `querySelector`, `querySelectorAll`, `click`, `type`, `wait`
Assertions: `exists`, `textContains`, `countGte/Lte/Equals`, `hasClass`, `valueEquals`

### Weighted Scoring

```
Points per test = (difficulty_weight / total_weighted_possible) × maxScore

Example (14 tests, maxScore = 100):
┌──────────┬────────┬───────┬──────────────┬────────────┐
│Difficulty │ Weight │ Count │ Total Weight │ Pts/Test   │
├──────────┼────────┼───────┼──────────────┼────────────┤
│ Easy      │ 1x     │ 6     │ 6            │ 4 pts      │
│ Medium    │ 2x     │ 5     │ 10           │ 8 pts      │
│ Hard      │ 3x     │ 3     │ 9            │ 12 pts     │
├──────────┼────────┼───────┼──────────────┼────────────┤
│ Total     │        │ 14    │ 25           │ 100 pts    │
└──────────┴────────┴───────┴──────────────┴────────────┘
```

### Hidden vs Visible Tests

- **3 visible tests**: Candidates see the test name and error message → helps them debug
- **11 hidden tests**: Names masked as "Hidden Test #N", error messages hidden → prevents gaming

---

## 8. AI-Powered Features

### AI Code Review (Post-Submission)
**Service**: `LlmEvaluatorService` | **Model**: Claude Sonnet

After submission, the candidate's code is sent to Claude for evaluation:

**Input**: Problem description, all code files, test results, hints used
**Output**:
- **Adjusted Score** — Can give partial credit for correct approach with minor bugs
- **Reasoning** — Explanation of score adjustment
- **Code Quality Ratings**:
  - Maintainability (1-10)
  - Reliability (1-10)
  - Cyclomatic Complexity (low/moderate/high)

**Why AI scoring matters**:
- A candidate might fail 2 tests but have excellent code structure → partial credit
- A candidate might pass all tests with terrible code (hardcoded values) → score reduction
- Hint usage penalty — heavy hint usage suggests less independent problem-solving

### Progressive Hint System
**Service**: `HintService` | **Model**: Claude Haiku (Levels 2-3)

Three escalating hint levels for each failing test:

| Level | Source | Speed | Detail |
|-------|--------|-------|--------|
| 1 | Pattern matching (20+ regex rules) | Instant | "Check if signal is initialized correctly" |
| 2 | Claude Haiku API | ~1-2s | "The addTask method needs to validate the title parameter" |
| 3 | Claude Haiku API | ~2-3s | "Create a method that uses signal.update() to append a new object with id, title, priority, completed fields" |

**Pattern examples** (Level 1, no API call needed):
- `is not a function` → "Make sure you're defining the method in your service class"
- `undefined` → "The property or method might not be defined yet"
- `signal` error → "Use signal() from @angular/core to create reactive state"

---

## 9. UI/UX Design

### VS Code-Inspired Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Task Board]  [Status: Ready ●]  [Timer 28:45]  [Actions] │  ← Header
├────────┬──────────────────────────────────┬──────────────────┤
│        │  [app.component.ts] [task.svc]   │                  │
│Problem │  ┌──────────────────────────┐    │   Preview        │
│  or    │  │                          │    │   ┌──────────┐   │
│ Files  │  │   Monaco Code Editor     │    │   │ Live App │   │
│        │  │                          │    │   │          │   │
│        │  │                          │    │   └──────────┘   │
│        │  └──────────────────────────┘    │                  │
│        │  ═══════════════════════════     │                  │  ← Resize
│        │  [Console] [Tests] [Problems]   │                  │
│        │  ┌──────────────────────────┐   │                  │
│        │  │  Test Results / Console   │   │                  │
│        │  └──────────────────────────┘   │                  │
└────────┴──────────────────────────────────┴──────────────────┘
     ↕           ↕                              ↕
  Resizable   Resizable                     Resizable
```

### Resizable Panels

All three dividers (sidebar, bottom panel, preview) are draggable:
- **Sidebar**: 180px–600px (drag horizontal)
- **Bottom Panel**: 36px–500px (drag vertical, 6px handle with invisible 8px hit area)
- **Preview**: 200px–800px (drag horizontal)

### Dark Theme

Default dark theme matching VS Code's color palette:
- Background: `#1e1e1e` (editor), `#252526` (panels), `#2d2d2d` (headers)
- Text: `#d4d4d4` (body), `#e0e0e0` (emphasis), `#888` (muted)
- Accents: `#007acc` (active tabs, resize hover), `#4ec9b0` (activity dots)

---

## 10. Project Structure

```
ng-compiler/
├── src/
│   ├── app/
│   │   ├── app.ts                          # Root component (layout, drag, events)
│   │   ├── app.html                        # Root template (selector, workspace, overlay)
│   │   ├── app.scss                        # Root styles (panels, tabs, resize handles)
│   │   ├── app.config.ts                   # Angular app config
│   │   │
│   │   ├── core/
│   │   │   ├── constants/
│   │   │   │   ├── problems.ts             # Problem definitions + test specs + DOM tests
│   │   │   │   └── default-angular-project.ts  # WebContainer file tree (657 lines)
│   │   │   ├── models/
│   │   │   │   ├── problem.model.ts        # Types: Problem, TestResult, TestSuite, etc.
│   │   │   │   ├── compilation-error.model.ts  # CompilationError type
│   │   │   │   └── virtual-file.model.ts   # VirtualFile type
│   │   │   └── services/
│   │   │       ├── assessment.service.ts   # Orchestrator (init, test, submit, reset)
│   │   │       ├── webcontainer.service.ts # WebContainer lifecycle
│   │   │       ├── compilation.service.ts  # Error parsing from build output
│   │   │       ├── test-runner.service.ts  # 3-layer test execution + scoring
│   │   │       ├── timer.service.ts        # Countdown timer
│   │   │       ├── app-console.service.ts  # Console log capture
│   │   │       ├── llm-evaluator.service.ts # AI code review (Claude Sonnet)
│   │   │       ├── hint.service.ts         # Progressive hints (pattern + Claude Haiku)
│   │   │       └── dom-test-bridge.service.ts # iframe DOM command bridge
│   │   │
│   │   ├── features/
│   │   │   ├── editor/
│   │   │   │   ├── code-editor.component.ts  # Monaco Editor wrapper
│   │   │   │   └── editor.service.ts         # Virtual file system + sync
│   │   │   ├── file-explorer/
│   │   │   │   └── file-tree.component.ts    # File browser sidebar
│   │   │   ├── preview/
│   │   │   │   ├── preview-panel.component.ts  # Live app preview iframe
│   │   │   │   ├── app-console.component.ts    # App console.log viewer
│   │   │   │   └── console-output.component.ts # Build output terminal
│   │   │   ├── problem/
│   │   │   │   └── problem-panel.component.ts  # Markdown problem description
│   │   │   ├── test-results/
│   │   │   │   └── test-results-panel.component.ts # Test results + hints
│   │   │   └── workspace/
│   │   │       └── workspace-header.component.ts # Top bar (timer, actions)
│   │   │
│   │   └── shared/
│   │       ├── components/
│   │       │   ├── loading-overlay.component.ts # Boot progress screen
│   │       │   ├── tab-bar.component.ts         # File tabs
│   │       │   └── split-pane.component.ts      # Resizable split pane
│   │       └── utils/
│   │           ├── file-language.ts    # File extension → language mapping
│   │           └── debounce.ts         # Generic debounce utility
│   │
│   ├── environments/
│   │   └── environment.ts              # API keys
│   ├── main.ts                         # Bootstrap
│   ├── index.html                      # Entry HTML
│   └── styles.scss                     # Global styles
│
├── angular.json                        # Angular CLI config
├── package.json                        # Dependencies
├── tsconfig.json                       # TypeScript config
└── DOCUMENTATION.md                    # This file
```

**File count**: ~35 source files | **Lines of code**: ~3,500+

---

## 11. Key Design Decisions

### 1. Standalone Components Only
**Decision**: Every component uses `standalone: true` with no NgModules.
**Why**: Angular's modern pattern. Faster compilation, tree-shakeable, simpler imports. Shows we follow current Angular best practices.

### 2. Signals Over RxJS for State
**Decision**: All component state uses Angular signals (`signal()`, `computed()`), not BehaviorSubjects.
**Why**: Signals are Angular's recommended reactive primitive. Simpler than RxJS for component state, automatic change detection, no subscription management.

### 3. `requireTS()` with eval() for Behavioral Tests
**Decision**: Strip TypeScript syntax and eval() the JavaScript to test class logic.
**Why**: WebContainer's Node.js can't import TypeScript directly. Alternatives like ts-node or esbuild would add 30s+ to install time. Our regex-based stripping handles all common TypeScript patterns (interfaces, generics, type annotations, access modifiers) in milliseconds.

### 4. Three-Layer Testing
**Decision**: Behavioral + Structural + DOM tests instead of just unit tests.
**Why**: Each layer catches different issues. A candidate who hardcodes test answers (passes behavioral) will fail structural checks. A candidate who writes correct logic but wrong template (passes behavioral) will fail DOM tests. This makes cheating nearly impossible.

### 5. Weighted Scoring by Difficulty
**Decision**: Easy=1x, Medium=2x, Hard=3x point multiplier.
**Why**: Rewards deeper Angular knowledge. A candidate who solves all easy tests (24 pts) scores less than one who solves the hard tests (36 pts). This differentiates junior from senior candidates.

### 6. Hidden Tests (11/14 hidden)
**Decision**: Most tests are hidden with masked names and errors.
**Why**: Prevents candidates from reverse-engineering test expectations. Only 3 visible tests provide enough debugging guidance without revealing the full test suite.

### 7. Template Reference Variables over ngModel
**Decision**: The Task Board solution uses `#titleInput` template refs instead of `[(ngModel)]`.
**Why**: Avoids importing FormsModule. Reads DOM value directly at click time, which is compatible with the DOM test bridge's type/click commands.

### 8. Client-Side AI Calls
**Decision**: Call Claude API directly from the browser (with CORS header).
**Why**: No backend needed. The `anthropic-dangerous-direct-browser-access` header enables browser-side API calls. For a hackathon demo, this eliminates the need for a proxy server. In production, this would go through a backend.

---

## 12. Challenges & How We Solved Them

### Challenge 1: TypeScript in eval()
**Problem**: `requireTS()` uses `eval()` which only understands JavaScript, but candidate code has TypeScript syntax (`interface`, generics, type annotations, `private`).
**Symptom**: Only 3/14 tests passed (the 3 structural tests that use fs.readFileSync).
**Solution**: Added 8 regex passes to strip TypeScript syntax before eval:
- Remove `interface` declarations
- Remove generic type parameters (`<Task[]>`)
- Remove access modifiers (`private`, `public`)
- Remove type annotations (`: string`, `: number`)
- Remove return type annotations (`): void {`)
- Remove string literal union types (`: 'low' | 'medium' | 'high'`)

### Challenge 2: DOM Test Button Selector Ambiguity
**Problem**: DOM test added 2 tasks, then tried `querySelector('button')` for the second add — but after the first task card rendered, there were now multiple buttons and `querySelector` returned the wrong one.
**Solution**: Simplified the test to add 1 task → verify → delete → verify 0. Eliminates the button ambiguity.

### Challenge 3: WebContainer CORS Headers
**Problem**: WebContainer requires Cross-Origin Isolation (`COEP: require-corp`, `COOP: same-origin`) headers.
**Solution**: Configured in `angular.json` dev server headers. Without these, `SharedArrayBuffer` (needed by WASM) is unavailable and WebContainer won't boot.

### Challenge 4: File Write Debouncing
**Problem**: Writing to WebContainer on every keystroke caused compilation thrashing and high CPU usage.
**Solution**: 1500ms debounce on file writes. Changes are batched — if the user types continuously, only the final state is written.

### Challenge 5: Template/Style URL Inlining
**Problem**: Angular's JIT compiler in Vite mode can't resolve `templateUrl` and `styleUrl` at runtime — it needs inline templates.
**Solution**: When writing `.component.ts` files to WebContainer, automatically inline the referenced HTML/CSS files into the `@Component` decorator.

### Challenge 6: Reserved Word as Output Name
**Problem**: Using `delete` as an Angular `output()` name causes JavaScript syntax errors (reserved word).
**Solution**: Renamed to `remove` — the test helpers check for multiple method name conventions (`removeTask`, `remove`, `deleteTask`).

---

## 13. Future Scope

| Feature | Description |
|---------|-------------|
| **Multiple Problems** | Add more problem types (form builder, HTTP service, pipe creation, directive, routing) |
| **Difficulty Tiers** | Easy/Medium/Hard problems with different time limits and complexity |
| **Proctoring** | Tab-switch detection, copy-paste monitoring, keystroke analytics |
| **Leaderboard** | Real-time scoring comparison across candidates |
| **Backend Integration** | Store results in database, generate reports, integrate with ATS |
| **Custom Test Builder** | Admin UI to create new problems and test cases without code |
| **Multi-Language** | Extend to React, Vue, or vanilla JS assessments using the same WebContainer infrastructure |
| **Collaboration** | Multiple candidates solving the same problem for pair programming assessment |
| **Offline Mode** | Pre-cache WebContainer and dependencies for low-bandwidth environments |

---

## Credits

Built for the iMocha Hackathon using:
- **Angular 21** — Google's web framework
- **WebContainer API** — StackBlitz's in-browser Node.js runtime
- **Monaco Editor** — Microsoft's code editor (VS Code core)
- **Claude API** — Anthropic's AI for code review and hints
- **Bootstrap 5** — Twitter's UI framework
