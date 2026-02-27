import { TestResultPayload } from '../types.js';
import { getServerTestSpecs } from './test-specs-loader.js';
import { STRUCTURAL_CHECKS } from '../data/test-specs.js';
import { runStructuralCheck } from './ast-validator.js';

interface VirtualFS {
  [path: string]: string;
}

/**
 * Server-side test re-execution.
 * Runs behavioral + structural tests on the submitted codeSnapshot.
 * DOM tests are excluded (require a browser).
 */
export function executeTestsServerSide(
  codeSnapshot: { path: string; content: string }[],
  problemId: string,
): { results: TestResultPayload[]; error?: string } {
  const results: TestResultPayload[] = [];
  const virtualFs: VirtualFS = {};

  // Build virtual filesystem from snapshot
  for (const file of codeSnapshot) {
    virtualFs[file.path] = file.content;
  }

  // 1. Run AST-based structural checks
  const structuralChecks = STRUCTURAL_CHECKS[problemId];
  if (structuralChecks) {
    for (const check of structuralChecks) {
      const content = virtualFs[check.file];
      if (!content) {
        results.push({
          name: `TaskBoard > ${check.name}`,
          status: 'failed',
          duration: 0,
          errorMessage: `File not found: ${check.file}`,
          difficulty: check.difficulty,
          testType: check.testType,
          category: 'structural',
          hidden: true,
        });
        continue;
      }

      let allPassed = true;
      let failedCheck = '';
      for (const c of check.checks) {
        if (!runStructuralCheck(content, c.type, c.args)) {
          allPassed = false;
          failedCheck = c.type + (c.args ? `(${c.args})` : '');
          break;
        }
      }

      results.push({
        name: `TaskBoard > ${check.name}`,
        status: allPassed ? 'passed' : 'failed',
        duration: 0,
        errorMessage: allPassed ? undefined : `Structural check failed: ${failedCheck}`,
        difficulty: check.difficulty,
        testType: check.testType,
        category: 'structural',
        hidden: true,
      });
    }
  }

  // 2. Run behavioral tests using sandboxed eval
  const specs = getServerTestSpecs(problemId);
  if (!specs) {
    return { results, error: `No test specs found for problem: ${problemId}` };
  }

  try {
    const behavioralResults = runBehavioralTests(virtualFs, specs);
    results.push(...behavioralResults);
  } catch (err) {
    return { results, error: `Behavioral test execution failed: ${(err as Error).message}` };
  }

  return { results };
}

function runBehavioralTests(
  virtualFs: VirtualFS,
  specs: { name: string; content: string }[],
): TestResultPayload[] {
  const results: TestResultPayload[] = [];
  const suites: { name: string; specs: any[]; beforeEach: any }[] = [];
  let currentSuite: any = null;

  // Test framework stubs
  const describe = (name: string, fn: () => void) => {
    currentSuite = { name, specs: [], beforeEach: null };
    suites.push(currentSuite);
    fn();
    currentSuite = null;
  };

  const it = (name: string, optionsOrFn: any, maybeFn?: any) => {
    let fn: any, options: any = {};
    if (typeof optionsOrFn === 'function') {
      fn = optionsOrFn;
    } else {
      options = optionsOrFn || {};
      fn = maybeFn;
    }
    if (currentSuite) {
      currentSuite.specs.push({
        name, fn,
        difficulty: options.difficulty || 'medium',
        testType: options.testType || 'positive',
        category: options.category || 'structural',
        hidden: options.hidden || false,
      });
    }
  };

  const beforeEach = (fn: any) => { if (currentSuite) currentSuite.beforeEach = fn; };

  // Expect + matchers (simplified version)
  function makeExpect(actual: any, negated = false): any {
    const matchers: any = {
      toBe(expected: any) {
        const pass = actual === expected;
        if (negated ? pass : !pass) throw new Error(`Expected ${JSON.stringify(actual)}${negated ? ' not ' : ' '}to be ${JSON.stringify(expected)}`);
      },
      toEqual(expected: any) {
        const pass = JSON.stringify(actual) === JSON.stringify(expected);
        if (negated ? pass : !pass) throw new Error(`Expected ${JSON.stringify(actual)}${negated ? ' not ' : ' '}to equal ${JSON.stringify(expected)}`);
      },
      toBeTruthy() {
        const pass = !!actual;
        if (negated ? pass : !pass) throw new Error(`Expected ${JSON.stringify(actual)}${negated ? ' not ' : ' '}to be truthy`);
      },
      toBeFalsy() {
        const pass = !actual;
        if (negated ? pass : !pass) throw new Error(`Expected ${JSON.stringify(actual)}${negated ? ' not ' : ' '}to be falsy`);
      },
      toContain(expected: any) {
        let pass = false;
        if (typeof actual === 'string') pass = actual.includes(expected);
        else if (Array.isArray(actual)) pass = actual.includes(expected);
        if (negated ? pass : !pass) throw new Error(`Expected ${negated ? 'not ' : ''}to contain ${JSON.stringify(expected)}`);
      },
      toHaveLength(expected: any) {
        const len = actual?.length ?? -1;
        const pass = len === expected;
        if (negated ? pass : !pass) throw new Error(`Expected length ${expected}${negated ? ' not' : ''} but got ${len}`);
      },
    };
    if (!negated) matchers.not = makeExpect(actual, true);
    return matchers;
  }

  const expect = (actual: any) => makeExpect(actual);

  // requireTS stub for server-side — operates on virtual filesystem
  const requireTS = (filePath: string) => {
    const source = virtualFs[filePath];
    if (!source) throw new Error(`File not found in snapshot: ${filePath}`);

    let processed = source;

    // Strip Angular decorators
    processed = processed.replace(/@(Component|Injectable|Directive|Pipe|NgModule|Input|Output)\s*\(\s*\{[^}]*\}\s*\)/g, '');
    processed = processed.replace(/@(Component|Injectable|Directive|Pipe|NgModule|Input|Output)\s*\(\s*\)/g, '');

    // Replace @angular imports with stubs
    processed = processed.replace(/import\s*\{([^}]+)\}\s*from\s*['"]@angular\/[^'"]+['"];?/g, (_match: string, imports: string) => {
      const names = imports.split(',').map((s: string) => s.trim()).filter(Boolean);
      const stubs: string[] = [];
      for (const name of names) {
        const parts = name.split(/\s+as\s+/);
        const localName = parts.length > 1 ? parts[1].trim() : parts[0].trim();
        switch (localName) {
          case 'signal':
            stubs.push('var signal = function(init) { var _v = init; var s = function() { return _v; }; s.set = function(v) { _v = v; }; s.update = function(fn) { _v = fn(_v); }; s.asReadonly = function() { return function() { return _v; }; }; return s; };');
            break;
          case 'computed':
            stubs.push('var computed = function(fn) { return fn; };');
            break;
          case 'inject':
            stubs.push('var inject = function(cls) { return new cls(); };');
            break;
          case 'input':
            stubs.push('var input = function() { var _v; var s = function() { return _v; }; s.set = function(v) { _v = v; }; return s; }; input.required = function() { var _v; var s = function() { return _v; }; s.set = function(v) { _v = v; }; return s; };');
            break;
          case 'output':
            stubs.push('var output = function() { var subs = []; return { emit: function(v) { subs.forEach(function(fn) { fn(v); }); }, subscribe: function(fn) { subs.push(fn); } }; };');
            break;
          case 'effect':
            stubs.push('var effect = function() {};');
            break;
          default:
            stubs.push(`var ${localName} = function() {};`);
        }
      }
      return stubs.join(' ');
    });

    // Remove remaining imports and exports
    processed = processed.replace(/import\s+.*?from\s*['"][^'"]+['"];?/g, '');
    processed = processed.replace(/import\s*['"][^'"]+['"];?/g, '');
    processed = processed.replace(/export\s+(default\s+)?/g, '');

    // Strip TypeScript-only syntax
    processed = processed.replace(/\binterface\s+\w+\s*\{[^}]*\}/g, '');
    processed = processed.replace(/\btype\s+\w+\s*=[^;]+;/g, '');
    processed = processed.replace(/(\w)<[^>()]*>\s*\(/g, '$1(');
    processed = processed.replace(/\b(private|protected|public|readonly)\s+/g, '');
    processed = processed.replace(/\)\s*:\s*\w+(\[\])?\s*\{/g, ') {');
    processed = processed.replace(/(\w+)\s*:\s*(string|number|boolean|void|any|never|unknown|object)\b(\[\])*/g, '$1');
    processed = processed.replace(/(\w+)\s*:\s*'[^']*'(\s*\|\s*'[^']*')*/g, '$1');
    processed = processed.replace(/(\w+)\s*:\s*[A-Z]\w*(\[\])?\s*(?=[,)\s])/g, '$1');

    // Wrap and execute
    let wrappedCode = '(function() { ' + processed + '\n';
    const classMatches = processed.match(/class\s+(\w+)/g) || [];
    const exportedNames = classMatches.map((m: string) => m.replace('class ', ''));
    const funcMatches = processed.match(/function\s+(\w+)/g) || [];
    exportedNames.push(...funcMatches.map((m: string) => m.replace('function ', '')));

    if (exportedNames.length > 0) {
      wrappedCode += 'return { ' + exportedNames.map((n: string) => n + ': ' + n).join(', ') + ' };';
    }
    wrappedCode += '})()';

    try {
      return eval(wrappedCode);
    } catch (e) {
      throw new Error(`requireTS(${filePath}) failed: ${(e as Error).message}`);
    }
  };

  // Load spec files (only behavioral tests — skip structural which use fs.readFileSync)
  for (const spec of specs) {
    try {
      let code = spec.content
        .replace(/import\s+.*?from\s+['"][^'"]+['"]/g, '')
        .replace(/export\s+/g, '');

      // Create a context with our framework functions
      const execFn = new Function(
        'describe', 'it', 'beforeEach', 'expect', 'requireTS', 'createSpy', 'require',
        code,
      );

      // Provide a mock require that handles 'fs' for structural tests
      const mockRequire = (mod: string) => {
        if (mod === 'fs') {
          return {
            readFileSync: (path: string) => {
              const content = virtualFs[path];
              if (!content) throw new Error(`ENOENT: ${path}`);
              return content;
            },
          };
        }
        if (mod === 'path') {
          return {
            resolve: (...args: string[]) => args.join('/'),
            join: (...args: string[]) => args.join('/'),
            dirname: (p: string) => p.substring(0, p.lastIndexOf('/')),
          };
        }
        throw new Error(`Cannot require '${mod}' in server-side tests`);
      };

      const createSpy = (name?: string) => {
        const calls: any[][] = [];
        const spy: any = function(...args: any[]) {
          calls.push(args);
          if (spy._returnValue !== undefined) return spy._returnValue;
        };
        spy.calls = calls;
        spy.spyName = name || 'anonymous';
        spy.andReturn = (val: any) => { spy._returnValue = val; return spy; };
        spy.reset = () => { calls.length = 0; };
        return spy;
      };

      execFn(describe, it, beforeEach, expect, requireTS, createSpy, mockRequire);
    } catch (e) {
      console.error(`Error loading spec ${spec.name}:`, (e as Error).message);
    }
  }

  // Run collected tests (only behavioral — skip structural tests that use fs)
  for (const suite of suites) {
    for (const spec of suite.specs) {
      // Skip structural tests (they're handled by AST validator)
      if (spec.category === 'structural') continue;

      const start = Date.now();
      try {
        if (suite.beforeEach) suite.beforeEach();

        const result = spec.fn();
        // Support async tests
        if (result && typeof result.then === 'function') {
          // Server-side: skip async tests (they typically need browser context)
          results.push({
            name: `${suite.name} > ${spec.name}`,
            status: 'failed',
            duration: 0,
            errorMessage: 'Async tests not supported in server-side re-execution',
            difficulty: spec.difficulty,
            testType: spec.testType,
            category: spec.category,
            hidden: spec.hidden,
          });
          continue;
        }

        results.push({
          name: `${suite.name} > ${spec.name}`,
          status: 'passed',
          duration: Date.now() - start,
          difficulty: spec.difficulty,
          testType: spec.testType,
          category: spec.category,
          hidden: spec.hidden,
        });
      } catch (e) {
        results.push({
          name: `${suite.name} > ${spec.name}`,
          status: 'failed',
          duration: Date.now() - start,
          errorMessage: (e as Error).message,
          difficulty: spec.difficulty,
          testType: spec.testType,
          category: spec.category,
          hidden: spec.hidden,
        });
      }
    }
  }

  return results;
}
