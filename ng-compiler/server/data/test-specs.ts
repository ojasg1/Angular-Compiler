// Server-side copy of test specs — authoritative source for:
// 1. Encrypting specs before sending to client
// 2. Server-side test re-execution
// 3. AST structural validation definitions

export interface TestSpecFile {
  name: string;
  content: string;
}

export interface StructuralCheck {
  name: string;
  file: string;
  checks: {
    type: 'signal' | 'computed' | 'forBlock' | 'emptyBlock' | 'componentTag' | 'track';
    args?: string;
  }[];
  difficulty: 'easy' | 'medium' | 'hard';
  testType: 'positive' | 'negative' | 'edge';
}

export const PROBLEM_TEST_SPECS: Record<string, TestSpecFile[]> = {
  'task-board': [
    {
      name: 'task-board-tests.spec',
      content: `
describe('TaskBoard', function() {

  // Helper: get tasks array from the service
  function getTasks(svc) {
    var props = ['tasks', 'taskList', 'items'];
    for (var i = 0; i < props.length; i++) {
      var p = svc[props[i]];
      if (p !== undefined) {
        return typeof p === 'function' ? p() : p;
      }
    }
    return undefined;
  }

  // Helper: get pending count from the service
  function getPendingCount(svc) {
    var props = ['pendingCount', 'pendingTasks', 'incompleteCount', 'activeCount'];
    for (var i = 0; i < props.length; i++) {
      var p = svc[props[i]];
      if (p !== undefined) {
        return typeof p === 'function' ? p() : p;
      }
    }
    return undefined;
  }

  // Helper: get addTask method
  function getAddMethod(svc) {
    var names = ['addTask', 'add', 'createTask'];
    for (var i = 0; i < names.length; i++) {
      if (typeof svc[names[i]] === 'function') return svc[names[i]];
    }
    return undefined;
  }

  // Helper: get removeTask method
  function getRemoveMethod(svc) {
    var names = ['removeTask', 'remove', 'deleteTask'];
    for (var i = 0; i < names.length; i++) {
      if (typeof svc[names[i]] === 'function') return svc[names[i]];
    }
    return undefined;
  }

  // Helper: get toggleComplete method
  function getToggleMethod(svc) {
    var names = ['toggleComplete', 'toggle', 'toggleTask'];
    for (var i = 0; i < names.length; i++) {
      if (typeof svc[names[i]] === 'function') return svc[names[i]];
    }
    return undefined;
  }

  // ===================================================================
  // BEHAVIORAL TESTS via requireTS (8 tests: 3 easy, 3 medium, 2 hard)
  // ===================================================================

  // #1 — Easy, Hidden
  it('TaskService tasks signal initializes as empty array', { difficulty: 'easy', testType: 'positive', category: 'behavioral', hidden: true }, function() {
    var mod = requireTS('src/app/task.service.ts');
    var svc = new mod.TaskService();

    var tasks = getTasks(svc);
    if (tasks === undefined) throw new Error('Tasks property on TaskService is not yet implemented');
    expect(Array.isArray(tasks)).toBeTruthy();
    expect(tasks.length).toBe(0);
  });

  // #2 — Easy, Hidden
  it('addTask() creates a task with correct structure', { difficulty: 'easy', testType: 'positive', category: 'behavioral', hidden: true }, function() {
    var mod = requireTS('src/app/task.service.ts');
    var svc = new mod.TaskService();

    var addFn = getAddMethod(svc);
    if (!addFn) throw new Error('addTask() method on TaskService is not yet implemented');

    addFn.call(svc, 'Buy groceries', 'medium');

    var tasks = getTasks(svc);
    if (tasks === undefined) throw new Error('Tasks property on TaskService is not yet implemented');
    expect(tasks.length).toBe(1);

    var task = tasks[0];
    expect(task.title).toBe('Buy groceries');
    expect(task.priority).toBe('medium');
    expect(task.completed).toBe(false);
    if (task.id === undefined) throw new Error('id property on Task object is not yet implemented');
  });

  // #3 — Easy, Hidden
  it('addTask() rejects empty and whitespace-only titles', { difficulty: 'easy', testType: 'negative', category: 'behavioral', hidden: true }, function() {
    var mod = requireTS('src/app/task.service.ts');
    var svc = new mod.TaskService();

    var addFn = getAddMethod(svc);
    if (!addFn) throw new Error('addTask() method on TaskService is not yet implemented');

    addFn.call(svc, '', 'low');
    addFn.call(svc, '   ', 'high');

    var tasks = getTasks(svc);
    if (tasks === undefined) throw new Error('Tasks property on TaskService is not yet implemented');
    expect(tasks.length).toBe(0);
  });

  // #4 — Medium, VISIBLE
  it('toggleComplete() correctly flips completed status', { difficulty: 'medium', testType: 'positive', category: 'behavioral' }, function() {
    var mod = requireTS('src/app/task.service.ts');
    var svc = new mod.TaskService();

    var addFn = getAddMethod(svc);
    var toggleFn = getToggleMethod(svc);
    if (!addFn) throw new Error('addTask() method on TaskService is not yet implemented');
    if (!toggleFn) throw new Error('toggleComplete() method on TaskService is not yet implemented');

    addFn.call(svc, 'Test task', 'low');
    var tasks = getTasks(svc);
    var taskId = tasks[0].id;
    expect(tasks[0].completed).toBe(false);

    // Toggle to completed
    toggleFn.call(svc, taskId);
    tasks = getTasks(svc);
    expect(tasks[0].completed).toBe(true);

    // Toggle back to pending
    toggleFn.call(svc, taskId);
    tasks = getTasks(svc);
    expect(tasks[0].completed).toBe(false);
  });

  // #5 — Medium, Hidden
  it('removeTask() removes the correct task by id', { difficulty: 'medium', testType: 'positive', category: 'behavioral', hidden: true }, function() {
    var mod = requireTS('src/app/task.service.ts');
    var svc = new mod.TaskService();

    var addFn = getAddMethod(svc);
    var removeFn = getRemoveMethod(svc);
    if (!addFn) throw new Error('addTask() method on TaskService is not yet implemented');
    if (!removeFn) throw new Error('removeTask() method on TaskService is not yet implemented');

    addFn.call(svc, 'Task A', 'low');
    addFn.call(svc, 'Task B', 'medium');
    addFn.call(svc, 'Task C', 'high');

    var tasks = getTasks(svc);
    expect(tasks.length).toBe(3);

    // Remove the middle task (Task B)
    var removeId = tasks[1].id;
    removeFn.call(svc, removeId);

    tasks = getTasks(svc);
    expect(tasks.length).toBe(2);
    expect(tasks[0].title).toBe('Task A');
    expect(tasks[1].title).toBe('Task C');
  });

  // #6 — Medium, Hidden
  it('pendingCount tracks number of incomplete tasks', { difficulty: 'medium', testType: 'positive', category: 'behavioral', hidden: true }, function() {
    var mod = requireTS('src/app/task.service.ts');
    var svc = new mod.TaskService();

    var addFn = getAddMethod(svc);
    var toggleFn = getToggleMethod(svc);
    if (!addFn) throw new Error('addTask() method on TaskService is not yet implemented');
    if (!toggleFn) throw new Error('toggleComplete() method on TaskService is not yet implemented');

    // Initially 0
    expect(getPendingCount(svc)).toBe(0);

    // Add 3 tasks — all pending
    addFn.call(svc, 'Task 1', 'low');
    addFn.call(svc, 'Task 2', 'medium');
    addFn.call(svc, 'Task 3', 'high');
    expect(getPendingCount(svc)).toBe(3);

    // Complete 1 task
    var tasks = getTasks(svc);
    toggleFn.call(svc, tasks[0].id);
    expect(getPendingCount(svc)).toBe(2);
  });

  // #7 — Hard, VISIBLE
  it('addTask() assigns unique IDs and supports all priority levels', { difficulty: 'hard', testType: 'positive', category: 'behavioral' }, function() {
    var mod = requireTS('src/app/task.service.ts');
    var svc = new mod.TaskService();

    var addFn = getAddMethod(svc);
    if (!addFn) throw new Error('addTask() method on TaskService is not yet implemented');

    addFn.call(svc, 'Low task', 'low');
    addFn.call(svc, 'Medium task', 'medium');
    addFn.call(svc, 'High task', 'high');

    var tasks = getTasks(svc);
    expect(tasks.length).toBe(3);

    // All IDs must be unique
    var ids = tasks.map(function(t) { return t.id; });
    var uniqueIds = ids.filter(function(id, idx) { return ids.indexOf(id) === idx; });
    expect(uniqueIds.length).toBe(3);

    // Verify priorities
    expect(tasks[0].priority).toBe('low');
    expect(tasks[1].priority).toBe('medium');
    expect(tasks[2].priority).toBe('high');
  });

  // #8 — Hard, VISIBLE
  it('Multi-operation scenario maintains consistent state', { difficulty: 'hard', testType: 'positive', category: 'behavioral' }, function() {
    var mod = requireTS('src/app/task.service.ts');
    var svc = new mod.TaskService();

    var addFn = getAddMethod(svc);
    var removeFn = getRemoveMethod(svc);
    var toggleFn = getToggleMethod(svc);
    if (!addFn) throw new Error('addTask() method on TaskService is not yet implemented');
    if (!removeFn) throw new Error('removeTask() method on TaskService is not yet implemented');
    if (!toggleFn) throw new Error('toggleComplete() method on TaskService is not yet implemented');

    // Add 4 tasks
    addFn.call(svc, 'Alpha', 'low');
    addFn.call(svc, 'Beta', 'medium');
    addFn.call(svc, 'Gamma', 'high');
    addFn.call(svc, 'Delta', 'low');

    var tasks = getTasks(svc);
    expect(tasks.length).toBe(4);
    expect(getPendingCount(svc)).toBe(4);

    // Toggle Alpha and Gamma to completed
    toggleFn.call(svc, tasks[0].id);
    toggleFn.call(svc, tasks[2].id);
    expect(getPendingCount(svc)).toBe(2);

    // Remove completed Alpha
    removeFn.call(svc, tasks[0].id);
    tasks = getTasks(svc);
    expect(tasks.length).toBe(3);
    expect(getPendingCount(svc)).toBe(2);

    // Remove pending Beta
    removeFn.call(svc, tasks[0].id);
    tasks = getTasks(svc);
    expect(tasks.length).toBe(2);
    expect(getPendingCount(svc)).toBe(1);
  });

  // ===================================================================
  // STRUCTURAL TESTS via fs.readFileSync (3 tests: 2 easy, 1 medium)
  // ===================================================================

  // #9 — Easy, Hidden
  it('TaskService uses signal() and computed() for reactive state', { difficulty: 'easy', testType: 'positive', category: 'structural', hidden: true }, function() {
    var fs = require('fs');
    var source = fs.readFileSync('src/app/task.service.ts', 'utf-8');
    if (!(/signal\\s*[<(]/).test(source)) throw new Error('signal() usage in TaskService is not yet implemented');
    if (!(/computed\\s*\\(/).test(source)) throw new Error('computed() usage in TaskService is not yet implemented');
  });

  // #10 — Easy, Hidden
  it('App template uses app-task-card with @for and track', { difficulty: 'easy', testType: 'positive', category: 'structural', hidden: true }, function() {
    var fs = require('fs');
    var template = fs.readFileSync('src/app/app.component.html', 'utf-8');
    if (!(/<app-task-card/).test(template)) throw new Error('<app-task-card> usage in app template is not yet implemented');
    if (!(/(@for\\s*\\()/).test(template)) throw new Error('@for loop in app template is not yet implemented');
    if (!(/track/).test(template)) throw new Error('track expression in @for loop is not yet implemented');
  });

  // #11 — Medium, Hidden
  it('App template uses @empty for empty state message', { difficulty: 'medium', testType: 'positive', category: 'structural', hidden: true }, function() {
    var fs = require('fs');
    var template = fs.readFileSync('src/app/app.component.html', 'utf-8');
    if (!(/@empty/).test(template)) throw new Error('@empty block in app template is not yet implemented');
  });

});
`,
    },
  ],
};

// Structural check definitions for AST validation (server-side)
export const STRUCTURAL_CHECKS: Record<string, StructuralCheck[]> = {
  'task-board': [
    {
      name: 'TaskService uses signal() and computed()',
      file: 'src/app/task.service.ts',
      checks: [
        { type: 'signal' },
        { type: 'computed' },
      ],
      difficulty: 'easy',
      testType: 'positive',
    },
    {
      name: 'App template uses <app-task-card> with @for and track',
      file: 'src/app/app.component.html',
      checks: [
        { type: 'componentTag', args: 'app-task-card' },
        { type: 'forBlock' },
        { type: 'track' },
      ],
      difficulty: 'easy',
      testType: 'positive',
    },
    {
      name: 'App template uses @empty',
      file: 'src/app/app.component.html',
      checks: [
        { type: 'emptyBlock' },
      ],
      difficulty: 'medium',
      testType: 'positive',
    },
  ],
};
