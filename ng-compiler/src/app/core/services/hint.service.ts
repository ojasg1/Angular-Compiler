import { Injectable, signal, inject } from '@angular/core';
import { SessionService } from './session.service';

interface HintState {
  testName: string;
  currentLevel: 0 | 1 | 2 | 3;
  hints: string[];
  isLoading: boolean;
}

const HINT_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /Expected undefined/, hint: 'Make sure the property mentioned in the test exists on your component class.' },
  { pattern: /is not a function/, hint: 'The test expects a method. Check you defined it as a method, not a property.' },
  { pattern: /toMatch.*signal/, hint: "Use Angular's signal() function. Example: myProp = signal<Type>(initialValue)" },
  { pattern: /toMatch.*@for/, hint: "Use Angular's @for syntax in your template to loop through items. Example: @for (item of items(); track item) { ... }" },
  { pattern: /Expected 0 to be/, hint: "Your method runs but doesn't change state. Check you're calling .set() or .update() on your signal." },
  { pattern: /toMatch.*computed/, hint: "Use Angular's computed() function. Example: myComputed = computed(() => this.mySignal() * 2)" },
  { pattern: /toMatch.*inject/, hint: 'Use inject() to get a service instance. Example: private myService = inject(MyService)' },
  { pattern: /toMatch.*input\s*[<(]/, hint: 'Use the input() function for component inputs. Example: user = input.required<User>()' },
  { pattern: /toMatch.*output\s*[<(]/, hint: 'Use the output() function for component outputs. Example: toggle = output<void>()' },
  { pattern: /toMatch.*<input/, hint: 'Add an <input> element to your template for user text entry.' },
  { pattern: /toMatch.*<button/, hint: 'Add a <button> element with a (click) handler in your template.' },
  { pattern: /to contain.*increment/i, hint: 'Add a button labeled "Increment" with a (click) handler that calls the increment method.' },
  { pattern: /to contain.*decrement/i, hint: 'Add a button labeled "Decrement" with a (click) handler that calls the decrement method.' },
  { pattern: /to contain.*reset/i, hint: 'Add a button labeled "Reset" with a (click) handler that calls the reset method.' },
  { pattern: /toMatch.*interface\s+User/, hint: 'Define a User interface with name, email, role (strings) and active (boolean) properties.' },
  { pattern: /Expected false.*truthy/, hint: 'A required condition is not being met. Check that you implemented the expected pattern.' },
  { pattern: /toBe (true|false)/, hint: 'The return value does not match the expected boolean. Double-check your logic and conditional expressions.' },
  { pattern: /Expected.*to be ''|Expected.*to equal ''/, hint: "After the action, the input field should be cleared. Try calling .set('') on your signal." },
  { pattern: /toMatch.*\\(click\\)/, hint: 'Bind a click event in your template: <button (click)="myMethod()">Label</button>' },
  { pattern: /requireTS.*failed/, hint: 'There may be a syntax error in your TypeScript file. Check for missing imports, brackets, or semicolons.' },
];

@Injectable({ providedIn: 'root' })
export class HintService {
  private sessionService = inject(SessionService);
  readonly hintStates = signal<Map<string, HintState>>(new Map());
  readonly totalHintsUsed = signal(0);

  async requestHint(
    testName: string,
    errorMessage: string,
    code: string,
    problemDesc: string
  ): Promise<void> {
    const states = new Map(this.hintStates());
    let state = states.get(testName);

    if (!state) {
      state = { testName, currentLevel: 0, hints: [], isLoading: false };
    }

    if (state.currentLevel >= 3 || state.isLoading) return;

    const nextLevel = (state.currentLevel + 1) as 1 | 2 | 3;
    state = { ...state, isLoading: true };
    states.set(testName, state);
    this.hintStates.set(new Map(states));

    try {
      let hint: string;

      if (nextLevel === 1) {
        // Level 1: pattern matching for instant hints
        hint = this.getPatternHint(errorMessage);
      } else {
        // Level 2-3: Claude API
        hint = await this.getLlmHint(testName, errorMessage, code, problemDesc, nextLevel);
      }

      const updatedStates = new Map(this.hintStates());
      const updatedState = updatedStates.get(testName)!;
      updatedStates.set(testName, {
        ...updatedState,
        currentLevel: nextLevel,
        hints: [...updatedState.hints, hint],
        isLoading: false,
      });
      this.hintStates.set(updatedStates);
      this.totalHintsUsed.update(n => n + 1);
    } catch {
      const updatedStates = new Map(this.hintStates());
      const updatedState = updatedStates.get(testName)!;
      updatedStates.set(testName, { ...updatedState, isLoading: false });
      this.hintStates.set(updatedStates);
    }
  }

  private getPatternHint(errorMessage: string): string {
    for (const { pattern, hint } of HINT_PATTERNS) {
      if (pattern.test(errorMessage)) {
        return hint;
      }
    }
    return 'Review the test name for clues about what the test expects. Check that all required properties and methods are defined.';
  }

  private async getLlmHint(
    testName: string,
    errorMessage: string,
    code: string,
    problemDesc: string,
    level: 2 | 3
  ): Promise<string> {
    try {
      return await this.sessionService.requestLlmHint({
        testName,
        errorMessage,
        code: code.substring(0, 1000),
        problemDesc: problemDesc.substring(0, 500),
        level,
      });
    } catch {
      return level === 2
        ? 'Check the Angular documentation for the specific API mentioned in the test name.'
        : 'Look at the test error message carefully — it tells you exactly what value or pattern is expected.';
    }
  }

  getHintState(testName: string): HintState | undefined {
    return this.hintStates().get(testName);
  }

  resetHints(): void {
    this.hintStates.set(new Map());
    this.totalHintsUsed.set(0);
  }
}
