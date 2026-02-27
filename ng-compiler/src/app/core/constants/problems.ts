import { Problem, DomTestSpec } from '../models/problem.model';

// --- DOM Test Specs for Task Board (3 tests: 1 easy, 1 medium, 1 hard) ---
const TASK_BOARD_DOM_TESTS: DomTestSpec[] = [
  {
    name: 'DOM: Adding a task renders a task card',
    difficulty: 'easy',
    testType: 'positive',
    hidden: true,
    steps: [
      { command: 'type', selector: 'input', value: 'Buy groceries' },
      { command: 'click', selector: 'button' },
      { command: 'wait', delay: 500 },
      { command: 'querySelectorAll', selector: 'app-task-card', assert: { countGte: 1 } },
    ],
  },
  {
    name: 'DOM: Task card displays the entered title',
    difficulty: 'medium',
    testType: 'positive',
    hidden: true,
    steps: [
      { command: 'type', selector: 'input', value: 'Walk the dog' },
      { command: 'click', selector: 'button' },
      { command: 'wait', delay: 500 },
      { command: 'querySelector', selector: 'app-task-card', assert: { exists: true, textContains: 'Walk the dog' } },
    ],
  },
  {
    name: 'DOM: Full add-delete lifecycle',
    difficulty: 'hard',
    testType: 'positive',
    hidden: true,
    steps: [
      // Add one task
      { command: 'type', selector: 'input', value: 'Task One' },
      { command: 'click', selector: 'button' },
      { command: 'wait', delay: 600 },
      // Verify 1 task card rendered
      { command: 'querySelectorAll', selector: 'app-task-card', assert: { countEquals: 1 } },
      // Click the delete button inside the task card (last button = Delete)
      { command: 'click', selector: 'app-task-card button:last-of-type' },
      { command: 'wait', delay: 600 },
      // Verify 0 task cards remain
      { command: 'querySelectorAll', selector: 'app-task-card', assert: { countEquals: 0 } },
    ],
  },
];

// --- Problem definitions (Task Board) ---
export const PROBLEMS: Problem[] = [
  {
    id: 'task-board',
    title: 'Task Board',
    description: `# Task Board

## Objective
Build a fully functional **Task Board** in Angular that lets users create, complete, and delete tasks with priority levels.

## What to Build

### Task Interface (\`task.service.ts\`)
Define a \`Task\` interface with:
- \`id\`: number
- \`title\`: string
- \`priority\`: \`'low' | 'medium' | 'high'\`
- \`completed\`: boolean

### TaskService (\`task.service.ts\`)
- A writable signal initialized with an empty \`Task[]\`
- A computed signal that returns the count of incomplete (pending) tasks
- \`addTask(title, priority)\` — add a new task with a unique ID and \`completed: false\`; ignore empty/whitespace-only titles
- \`removeTask(id)\` — remove a task by its ID
- \`toggleComplete(id)\` — flip a task's \`completed\` status

### TaskCardComponent (\`task-card/\`)
- Selector: \`app-task-card\`
- Accept a \`task\` input using \`input()\` or \`input.required()\`
- Emit \`toggleComplete\` and \`delete\` events using \`output()\`
- Display the task title and priority
- Show visual distinction for completed vs pending tasks
- Provide buttons/controls to toggle completion and delete

### AppComponent (\`app.component.ts/html\`)
- Inject \`TaskService\`
- Render an \`<app-task-card>\` for each task using \`@for\` with \`track task.id\`
- Show an empty state message using \`@empty\` when there are no tasks
- Provide inputs to add new tasks (title + priority)
- Handle \`toggleComplete\` and \`delete\` events from child components
- Display the pending task count

## Expected Output

<div class="preview-mockup">
    <div class="mockup-badge">Pending Tasks: 2</div>
    <div class="mockup-controls">
      <div class="mockup-input">Enter task title...</div>
      <div class="mockup-select">Low ▼</div>
      <div class="mockup-btn">Add Task</div>
    </div>
    <div class="mockup-card">
      <div class="mockup-card-top">
        <span class="mockup-card-title">Buy groceries</span>
        <span class="mockup-priority mockup-p-medium">Medium</span>
      </div>
      <div class="mockup-card-actions">
        <span class="mockup-act-complete">✓ Complete</span>
        <span class="mockup-act-delete">✗ Delete</span>
      </div>
    </div>
    <div class="mockup-card">
      <div class="mockup-card-top">
        <span class="mockup-card-title">Walk the dog</span>
        <span class="mockup-priority mockup-p-low">Low</span>
      </div>
      <div class="mockup-card-actions">
        <span class="mockup-act-complete">✓ Complete</span>
        <span class="mockup-act-delete">✗ Delete</span>
      </div>
    </div>
  </div>
`,
    starterFiles: [
      {
        path: 'src/app/app.component.ts',
        content: `import { Component } from '@angular/core';
import { TaskCardComponent } from './task-card/task-card.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TaskCardComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {}
`,
        language: 'typescript',
        readOnly: false,
        dirty: false,
      },
      {
        path: 'src/app/app.component.html',
        content: `<p>Task Board works!</p>
`,
        language: 'html',
        readOnly: false,
        dirty: false,
      },
      {
        path: 'src/app/app.component.css',
        content: `/* Add your styles here */
`,
        language: 'css',
        readOnly: false,
        dirty: false,
      },
      {
        path: 'src/app/task.service.ts',
        content: `import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TaskService {
  // Implement the task service
}
`,
        language: 'typescript',
        readOnly: false,
        dirty: false,
      },
      {
        path: 'src/app/task-card/task-card.component.ts',
        content: `import { Component } from '@angular/core';

@Component({
  selector: 'app-task-card',
  standalone: true,
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.css',
})
export class TaskCardComponent {
  // Implement the task card component
}
`,
        language: 'typescript',
        readOnly: false,
        dirty: false,
      },
      {
        path: 'src/app/task-card/task-card.component.html',
        content: `<!-- Implement the task card template -->
`,
        language: 'html',
        readOnly: false,
        dirty: false,
      },
      {
        path: 'src/app/task-card/task-card.component.css',
        content: `/* Add your styles here */
`,
        language: 'css',
        readOnly: false,
        dirty: false,
      },
    ],
    testFiles: [
      {
        path: 'test-specs.json',
        content: '',
        language: 'json',
        readOnly: true,
        dirty: false,
      },
    ],
    maxScore: 25,
    timeLimit: 1800,
    domTests: TASK_BOARD_DOM_TESTS,
  },
];

// Test specs are now server-side only (server/data/test-specs.ts)
// They are encrypted per-session and sent to the client as test-specs.enc.json
// The run-tests.js decrypts them at execution time using the session's encryption key
