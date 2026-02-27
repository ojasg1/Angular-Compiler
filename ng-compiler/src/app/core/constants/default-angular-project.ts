import { FileSystemTree } from '@webcontainer/api';

// Vite config with Angular inline plugin.
// Uses String.raw to avoid escaping issues with regex patterns and backticks.
// The ${''} breaks are used to prevent the TS compiler from interpreting
// backticks and ${} inside String.raw as template literal syntax.
const VITE_CONFIG_CONTENT: string = (() => {
  const imports = [
    'import { defineConfig } from "vite";',
    'import fs from "fs";',
    'import path from "path";',
  ].join('\n');

  // The replace chain for escaping content before wrapping in backticks
  const escChain = String.raw`.replace(/\\/g, '\\\\').replace(/` + '`' + String.raw`/g, '\\` + '`' + String.raw`').replace(/\$/g, '\\$')`;

  const plugin = [
    'function angularInlinePlugin() {',
    '  return {',
    '    name: "angular-inline",',
    '    enforce: "pre",',
    '    transform(code, id) {',
    '      if (!id.endsWith(".ts") || id.includes("node_modules")) return null;',
    '      if (code.indexOf("templateUrl") === -1 && code.indexOf("styleUrl") === -1) return null;',
    '      var result = code;',
    '      var dir = path.dirname(id);',
    '',
    String.raw`      var tmplMatch = result.match(/templateUrl\s*:\s*['"]\.\/([^'"]+)['"]/);`,
    '      if (tmplMatch) {',
    '        try {',
    '          var html = fs.readFileSync(path.join(dir, tmplMatch[1]), "utf-8");',
    '          var escaped = html' + escChain + ';',
    '          result = result.replace(tmplMatch[0], "template: `" + escaped + "`");',
    '        } catch(e) { console.warn("Failed to inline template:", e.message); }',
    '      }',
    '',
    String.raw`      var styleMatch = result.match(/styleUrl\s*:\s*['"]\.\/([^'"]+)['"]/);`,
    '      if (styleMatch) {',
    '        try {',
    '          var css = fs.readFileSync(path.join(dir, styleMatch[1]), "utf-8");',
    '          var esc2 = css' + escChain + ';',
    '          result = result.replace(styleMatch[0], "styles: [`" + esc2 + "`]");',
    '        } catch(e) { console.warn("Failed to inline style:", e.message); }',
    '      }',
    '',
    String.raw`      var suMatch = result.match(/styleUrls\s*:\s*\[\s*['"]\.\/([^'"]+)['"]\s*\]/);`,
    '      if (suMatch) {',
    '        try {',
    '          var css2 = fs.readFileSync(path.join(dir, suMatch[1]), "utf-8");',
    '          var esc3 = css2' + escChain + ';',
    '          result = result.replace(suMatch[0], "styles: [`" + esc3 + "`]");',
    '        } catch(e) { console.warn("Failed to inline styleUrls:", e.message); }',
    '      }',
    '',
    '      if (result !== code) return { code: result, map: null };',
    '      return null;',
    '    }',
    '  };',
    '}',
  ].join('\n');

  const config = [
    'export default defineConfig({',
    '  root: "src",',
    '  build: { outDir: "../dist" },',
    '  plugins: [angularInlinePlugin()],',
    '  esbuild: {',
    '    target: "es2022",',
    '    tsconfigRaw: {',
    '      compilerOptions: {',
    '        experimentalDecorators: true,',
    '        useDefineForClassFields: false,',
    '      }',
    '    }',
    '  },',
    '  optimizeDeps: {',
    '    include: [',
    '      "@angular/core",',
    '      "@angular/common",',
    '      "@angular/compiler",',
    '      "@angular/platform-browser",',
    '      "@angular/platform-browser-dynamic",',
    '      "@angular/forms",',
    '      "rxjs",',
    '      "zone.js",',
    '    ],',
    '    esbuildOptions: {',
    '      tsconfigRaw: {',
    '        compilerOptions: {',
    '          experimentalDecorators: true,',
    '          useDefineForClassFields: false,',
    '        }',
    '      }',
    '    }',
    '  },',
    '  server: {',
    '    hmr: true,',
    '    watch: { usePolling: true, interval: 500 },',
    '  },',
    '});',
  ].join('\n');

  return imports + '\n\n' + plugin + '\n\n' + config;
})();

export const DEFAULT_ANGULAR_PROJECT: FileSystemTree = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: 'candidate-app',
        version: '0.0.0',
        private: true,
        scripts: {
          start: 'npx vite --host 0.0.0.0 --port 3000',
          test: 'node run-tests.js',
        },
        dependencies: {
          '@angular/common': '19.0.0',
          '@angular/compiler': '19.0.0',
          '@angular/core': '19.0.0',
          '@angular/forms': '19.0.0',
          '@angular/platform-browser': '19.0.0',
          '@angular/platform-browser-dynamic': '19.0.0',
          'rxjs': '7.8.1',
          'tslib': '2.8.1',
          'zone.js': '0.15.0',
        },
        devDependencies: {
          'vite': '5.4.11',
        },
      }, null, 2),
    },
  },
  'vite.config.js': {
    file: {
      contents: VITE_CONFIG_CONTENT,
    },
  },
  'tsconfig.json': {
    file: {
      contents: JSON.stringify({
        compilerOptions: {
          strict: true,
          skipLibCheck: true,
          experimentalDecorators: true,
          useDefineForClassFields: false,
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          isolatedModules: true,
        },
      }, null, 2),
    },
  },
  src: {
    directory: {
      'main.ts': {
        file: {
          contents: `import 'zone.js';
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent)
  .then(() => console.info('Angular application initialized successfully'))
  .catch(err => console.error('Bootstrap failed:', err));
`,
        },
      },
      'styles.css': {
        file: {
          contents: `body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 16px; }
`,
        },
      },
      'index.html': {
        file: {
          contents: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Candidate App</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/styles.css">
  <script>
    (function() {
      var viteKeywords = ['[vite]','[hmr]','connecting','connected','hot updated','page reload','hmr update'];

      function isViteMessage(firstArg) {
        if (typeof firstArg !== 'string') return false;
        var l = firstArg.toLowerCase();
        for (var i = 0; i < viteKeywords.length; i++) {
          if (l.indexOf(viteKeywords[i]) !== -1) return true;
        }
        if (firstArg.indexOf('%c') === 0 && l.indexOf('vite') !== -1) return true;
        return false;
      }

      function send(method, args) {
        try {
          window.parent.postMessage({
            type: '__CONSOLE__',
            method: method,
            args: args,
            timestamp: Date.now()
          }, '*'); // '*' required: WebContainer iframe has dynamic origin
        } catch(e) { /* postMessage may fail if parent window is closed */ }
      }

      var methods = ['log', 'warn', 'error', 'info', 'debug'];
      methods.forEach(function(method) {
        var original = console[method];
        console[method] = function() {
          if (!isViteMessage(arguments[0])) {
            var args = Array.from(arguments).map(function(a) {
              try {
                if (a instanceof Error) return a.stack || a.message || String(a);
                if (typeof a === 'object') return JSON.stringify(a, null, 2);
                return String(a);
              } catch(e) { return String(a); }
            });
            send(method, args);
          }
          original.apply(console, arguments);
        };
      });

      window.addEventListener('error', function(e) {
        var msg = e.error ? (e.error.stack || e.error.message) : e.message;
        send('error', ['Uncaught Error: ' + msg]);
      });

      window.addEventListener('unhandledrejection', function(e) {
        var reason = e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : 'unknown';
        send('error', ['Unhandled Promise Rejection: ' + reason]);
      });

      send('info', ['Loading Angular application...']);

      // --- DOM Test Bridge: handle commands from parent ---
      window.addEventListener('message', function(event) {
        if (!event.data || event.data.type !== '__DOM_COMMAND__') return;
        var cmd = event.data;
        var id = cmd.id;
        var result = { found: false };

        try {
          switch(cmd.command) {
            case 'querySelector': {
              var el = document.querySelector(cmd.selector);
              if (el) {
                result = {
                  found: true,
                  tagName: el.tagName,
                  textContent: (el.textContent || '').substring(0, 500),
                  innerHTML: (el.innerHTML || '').substring(0, 500),
                  className: el.className || '',
                  value: el.value !== undefined ? el.value : undefined
                };
              }
              break;
            }
            case 'querySelectorAll': {
              var els = document.querySelectorAll(cmd.selector);
              result = {
                found: els.length > 0,
                count: els.length,
                items: Array.from(els).slice(0, 20).map(function(el) {
                  return {
                    tagName: el.tagName,
                    textContent: (el.textContent || '').substring(0, 200),
                    className: el.className || '',
                    value: el.value !== undefined ? el.value : undefined
                  };
                })
              };
              break;
            }
            case 'click': {
              var clickEl = document.querySelector(cmd.selector);
              if (clickEl) {
                clickEl.click();
                result = { found: true, clicked: true };
              }
              // Delay response to let Angular change detection settle
              setTimeout(function() {
                window.parent.postMessage({ type: '__DOM_RESULT__', id: id, result: result }, '*');
              }, cmd.delay || 300);
              return; // early return, response sent after delay
            }
            case 'type': {
              var inputEl = document.querySelector(cmd.selector);
              if (inputEl) {
                var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                  window.HTMLInputElement.prototype, 'value'
                );
                if (nativeInputValueSetter && nativeInputValueSetter.set) {
                  nativeInputValueSetter.set.call(inputEl, cmd.value || '');
                } else {
                  inputEl.value = cmd.value || '';
                }
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                result = { found: true, typed: true };
              }
              setTimeout(function() {
                window.parent.postMessage({ type: '__DOM_RESULT__', id: id, result: result }, '*');
              }, cmd.delay || 300);
              return;
            }
            case 'wait': {
              setTimeout(function() {
                window.parent.postMessage({ type: '__DOM_RESULT__', id: id, result: { found: true } }, '*');
              }, cmd.delay || 500);
              return;
            }
          }
        } catch(err) {
          result = { found: false, error: err.message };
        }

        window.parent.postMessage({ type: '__DOM_RESULT__', id: id, result: result }, '*');
      });
    })();
  </script>
</head>
<body>
  <app-root></app-root>
  <script type="module" src="/main.ts"></script>
</body>
</html>
`,
        },
      },
      app: {
        directory: {
          'app.component.ts': {
            file: {
              contents: `import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  template: \`<h1>Hello, Angular!</h1>\`,
})
export class AppComponent {
  title = 'candidate-app';
}
`,
            },
          },
        },
      },
    },
  },
  'run-tests.js': {
    file: {
      contents: `const fs = require('fs');
const path = require('path');

// Signing credentials (injected by server at mount time)
const __NONCE__ = '__NONCE_PLACEHOLDER__';
const __HMAC_KEY__ = '__HMAC_KEY_PLACEHOLDER__';
const __PRIVATE_KEY__ = '__PRIVATE_KEY_PLACEHOLDER__';
const __ENCRYPTION_KEY__ = '__ENCRYPTION_KEY_PLACEHOLDER__';

// --- AES-256-GCM Decryption for encrypted test specs ---
function decryptSpecs(keyHex, encrypted) {
  var crypto = require('crypto');
  var key = Buffer.from(keyHex, 'hex');
  var iv = Buffer.from(encrypted.iv, 'hex');
  var decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));
  var plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}

const suites = [];
let currentSuite = null;

globalThis.describe = function(name, fn) {
  currentSuite = { name, specs: [], beforeEach: null };
  suites.push(currentSuite);
  fn();
  currentSuite = null;
};

globalThis.it = function(name, optionsOrFn, maybeFn) {
  var fn, options = {};
  if (typeof optionsOrFn === 'function') {
    fn = optionsOrFn;
  } else {
    options = optionsOrFn || {};
    fn = maybeFn;
  }
  if (currentSuite) currentSuite.specs.push({
    name, fn,
    difficulty: options.difficulty || 'medium',
    testType: options.testType || 'positive',
    category: options.category || 'structural',
    hidden: options.hidden || false
  });
};

globalThis.beforeEach = function(fn) { if (currentSuite) currentSuite.beforeEach = fn; };

// --- Spy utility ---
globalThis.createSpy = function(name) {
  var calls = [];
  var spy = function() {
    var args = Array.from(arguments);
    calls.push(args);
    if (spy._returnValue !== undefined) return spy._returnValue;
  };
  spy.calls = calls;
  spy.spyName = name || 'anonymous';
  spy.andReturn = function(val) { spy._returnValue = val; return spy; };
  spy.reset = function() { calls.length = 0; };
  return spy;
};

// --- Expect + matchers ---
function makeExpect(actual, negated) {
  var matchers = {
    toBe: function(expected) {
      var pass = actual === expected;
      if (negated ? pass : !pass) throw new Error('Expected ' + JSON.stringify(actual) + (negated ? ' not ' : ' ') + 'to be ' + JSON.stringify(expected));
    },
    toEqual: function(expected) {
      var pass = JSON.stringify(actual) === JSON.stringify(expected);
      if (negated ? pass : !pass) throw new Error('Expected ' + JSON.stringify(actual) + (negated ? ' not ' : ' ') + 'to equal ' + JSON.stringify(expected));
    },
    toBeTruthy: function() {
      var pass = !!actual;
      if (negated ? pass : !pass) throw new Error('Expected ' + JSON.stringify(actual) + (negated ? ' not ' : ' ') + 'to be truthy');
    },
    toBeFalsy: function() {
      var pass = !actual;
      if (negated ? pass : !pass) throw new Error('Expected ' + JSON.stringify(actual) + (negated ? ' not ' : ' ') + 'to be falsy');
    },
    toContain: function(expected) {
      var pass = false;
      if (typeof actual === 'string') pass = actual.includes(expected);
      else if (Array.isArray(actual)) pass = actual.includes(expected);
      if (negated ? pass : !pass) throw new Error('Expected ' + (negated ? 'not ' : '') + 'to contain ' + JSON.stringify(expected));
    },
    toMatch: function(pattern) {
      var regex = (pattern instanceof RegExp) ? pattern : new RegExp(pattern);
      var pass = regex.test(actual);
      if (negated ? pass : !pass) throw new Error('Expected ' + JSON.stringify(actual) + (negated ? ' not ' : ' ') + 'to match ' + pattern);
    },
    toBeGreaterThan: function(expected) {
      var pass = actual > expected;
      if (negated ? pass : !pass) throw new Error('Expected ' + actual + (negated ? ' not ' : ' ') + '> ' + expected);
    },
    toBeLessThan: function(expected) {
      var pass = actual < expected;
      if (negated ? pass : !pass) throw new Error('Expected ' + actual + (negated ? ' not ' : ' ') + '< ' + expected);
    },
    toBeDefined: function() {
      var pass = actual !== undefined;
      if (negated ? pass : !pass) throw new Error('Expected value ' + (negated ? 'not ' : '') + 'to be defined');
    },
    toBeUndefined: function() {
      var pass = actual === undefined;
      if (negated ? pass : !pass) throw new Error('Expected ' + (negated ? 'not ' : '') + 'undefined but got ' + JSON.stringify(actual));
    },
    toBeNull: function() {
      var pass = actual === null;
      if (negated ? pass : !pass) throw new Error('Expected ' + (negated ? 'not ' : '') + 'null but got ' + JSON.stringify(actual));
    },
    toThrow: function(expectedMsg) {
      if (typeof actual !== 'function') throw new Error('Expected a function for toThrow');
      var threw = false, thrownMsg = '';
      try { actual(); } catch(e) { threw = true; thrownMsg = e.message || String(e); }
      var pass = threw && (expectedMsg === undefined || thrownMsg.includes(expectedMsg));
      if (negated ? pass : !pass) throw new Error('Expected function ' + (negated ? 'not ' : '') + 'to throw' + (expectedMsg ? ' "' + expectedMsg + '"' : '') + (threw ? ', but threw "' + thrownMsg + '"' : ', but it did not throw'));
    },
    toHaveLength: function(expected) {
      var len = actual && actual.length !== undefined ? actual.length : -1;
      var pass = len === expected;
      if (negated ? pass : !pass) throw new Error('Expected length ' + expected + (negated ? ' not' : '') + ' but got ' + len);
    },
    toBeInstanceOf: function(cls) {
      var pass = actual instanceof cls;
      if (negated ? pass : !pass) throw new Error('Expected ' + (negated ? 'not ' : '') + 'instance of ' + (cls.name || cls));
    },
    toBeCloseTo: function(expected, precision) {
      var p = precision !== undefined ? precision : 2;
      var pass = Math.abs(actual - expected) < Math.pow(10, -p) / 2;
      if (negated ? pass : !pass) throw new Error('Expected ' + actual + (negated ? ' not ' : ' ') + 'to be close to ' + expected);
    },
    toHaveBeenCalled: function() {
      if (!actual || !actual.calls) throw new Error('Expected a spy for toHaveBeenCalled');
      var pass = actual.calls.length > 0;
      if (negated ? pass : !pass) throw new Error('Expected spy ' + (actual.spyName || '') + (negated ? ' not' : '') + ' to have been called, but it was ' + (pass ? '' : 'not ') + 'called');
    },
    toHaveBeenCalledWith: function() {
      if (!actual || !actual.calls) throw new Error('Expected a spy for toHaveBeenCalledWith');
      var expectedArgs = Array.from(arguments);
      var pass = actual.calls.some(function(call) { return JSON.stringify(call) === JSON.stringify(expectedArgs); });
      if (negated ? pass : !pass) throw new Error('Expected spy ' + (actual.spyName || '') + (negated ? ' not' : '') + ' to have been called with ' + JSON.stringify(expectedArgs));
    },
  };
  if (!negated) {
    matchers.not = makeExpect(actual, true);
  }
  return matchers;
}

globalThis.expect = function(actual) { return makeExpect(actual, false); };

// --- requireTS: transpile + eval TS files for behavioral tests ---
globalThis.requireTS = function(filePath) {
  var fullPath = path.resolve(filePath);
  var source = fs.readFileSync(fullPath, 'utf-8');

  // Strip Angular decorators: @Component({...}), @Injectable({...}), etc.
  source = source.replace(/@(Component|Injectable|Directive|Pipe|NgModule|Input|Output)\\s*\\(\\s*\\{[^}]*\\}\\s*\\)/g, '');
  source = source.replace(/@(Component|Injectable|Directive|Pipe|NgModule|Input|Output)\\s*\\(\\s*\\)/g, '');

  // Replace @angular/* imports with lightweight stubs
  source = source.replace(/import\\s*\\{([^}]+)\\}\\s*from\\s*['"]@angular\\/[^'"]+['"];?/g, function(match, imports) {
    var names = imports.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    var stubs = [];
    names.forEach(function(name) {
      // Handle 'X as Y' aliases
      var parts = name.split(/\\s+as\\s+/);
      var localName = parts.length > 1 ? parts[1].trim() : parts[0].trim();
      switch(localName) {
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
          stubs.push('var input = function(opts) { var _v; var s = function() { return _v; }; s.set = function(v) { _v = v; }; if (opts && opts.required) { s.required = function() { return s; }; } return s; }; input.required = function() { var _v; var s = function() { return _v; }; s.set = function(v) { _v = v; }; return s; };');
          break;
        case 'output':
          stubs.push('var output = function() { var subs = []; var o = { emit: function(v) { subs.forEach(function(fn) { fn(v); }); }, subscribe: function(fn) { subs.push(fn); } }; return o; };');
          break;
        case 'effect':
          stubs.push('var effect = function(fn) { /* no-op in test */ };');
          break;
        default:
          stubs.push('var ' + localName + ' = function() {};');
      }
    });
    return stubs.join(' ');
  });

  // Remove remaining non-angular imports
  source = source.replace(/import\\s+.*?from\\s*['"][^'"]+['"];?/g, '');
  source = source.replace(/import\\s*['"][^'"]+['"];?/g, '');

  // Remove export keywords
  source = source.replace(/export\\s+(default\\s+)?/g, '');

  // --- Strip TypeScript-only syntax (eval only understands JS) ---
  // Remove interface declarations (multi-line, no nested braces)
  source = source.replace(/\\binterface\\s+\\w+\\s*\\{[^}]*\\}/g, '');
  // Remove type alias declarations
  source = source.replace(/\\btype\\s+\\w+\\s*=[^;]+;/g, '');
  // Remove generic type parameters before (: signal<Type>( → signal(
  source = source.replace(/(\\w)<[^>()]*>\\s*\\(/g, '$1(');
  // Remove access modifiers (private, protected, public, readonly)
  source = source.replace(/\\b(private|protected|public|readonly)\\s+/g, '');
  // Remove return type annotations: ): Type { → ) {
  source = source.replace(/\\)\\s*:\\s*\\w+(\\[\\])?\\s*\\{/g, ') {');
  // Remove simple type annotations: word: string, word: number, etc.
  source = source.replace(/(\\w+)\\s*:\\s*(string|number|boolean|void|any|never|unknown|object)\\b(\\[\\])*/g, '$1');
  // Remove string literal union type annotations: word: 'a' | 'b'
  source = source.replace(/(\\w+)\\s*:\\s*'[^']*'(\\s*\\|\\s*'[^']*')*/g, '$1');
  // Remove named type annotations in param position (before , or )): word: TypeName
  source = source.replace(/(\\w+)\\s*:\\s*[A-Z]\\w*(\\[\\])?\\s*(?=[,)\\s])/g, '$1');

  // Wrap in a function to capture class/function declarations
  var wrappedCode = '(function() { ' + source + '\\n';

  // Find all class declarations and return them
  var classMatches = source.match(/class\\s+(\\w+)/g) || [];
  var exportedNames = classMatches.map(function(m) { return m.replace('class ', ''); });

  // Also find standalone function declarations
  var funcMatches = source.match(/function\\s+(\\w+)/g) || [];
  var funcNames = funcMatches.map(function(m) { return m.replace('function ', ''); });
  exportedNames = exportedNames.concat(funcNames);

  if (exportedNames.length > 0) {
    wrappedCode += 'return { ' + exportedNames.map(function(n) { return n + ': ' + n; }).join(', ') + ' };';
  }
  wrappedCode += '})()';

  try {
    return eval(wrappedCode);
  } catch(e) {
    throw new Error('requireTS(' + filePath + ') failed: ' + e.message);
  }
};

// --- Run a single spec ---
async function runSpec(suite, spec) {
  var start = Date.now();
  var result = {
    name: suite.name + ' > ' + spec.name,
    difficulty: spec.difficulty,
    testType: spec.testType,
    category: spec.category,
    hidden: spec.hidden || false
  };

  try {
    if (suite.beforeEach) suite.beforeEach();

    var fnResult = spec.fn();
    // If the test returns a promise (async test), await it
    if (fnResult && typeof fnResult.then === 'function') {
      await fnResult;
    }

    result.status = 'passed';
    result.duration = Date.now() - start;
  } catch (e) {
    result.status = 'failed';
    result.duration = Date.now() - start;
    result.errorMessage = e.message;
  }
  return result;
}

async function runTests() {
  let specContents = [];

  // Try loading encrypted specs first, fall back to plaintext
  const encPath = path.join(__dirname, 'test-specs.enc.json');
  const plainPath = path.join(__dirname, 'test-specs.json');

  if (__ENCRYPTION_KEY__ !== '__ENCRYPTION_KEY_PLACEHOLDER__' && fs.existsSync(encPath)) {
    try {
      const encrypted = JSON.parse(fs.readFileSync(encPath, 'utf-8'));
      const decrypted = decryptSpecs(__ENCRYPTION_KEY__, encrypted);
      const manifest = JSON.parse(decrypted);
      specContents = manifest.map(s => ({ name: s.name, content: s.content }));
    } catch(e) { console.error('Decryption failed:', e.message); }
  } else if (fs.existsSync(plainPath)) {
    const manifest = JSON.parse(fs.readFileSync(plainPath, 'utf-8'));
    specContents = manifest.map(s => ({ name: s.name, content: s.content }));
  }

  for (const spec of specContents) {
    try {
      let code = spec.content.replace(/import\\s+.*?from\\s+['"][^'"]+['"]/g, '').replace(/export\\s+/g, '');
      eval(code);
    } catch (e) { console.error('Error loading spec ' + spec.name + ': ' + e.message); }
  }

  const testResults = [];
  for (const suite of suites) {
    for (const spec of suite.specs) {
      var result = await runSpec(suite, spec);
      testResults.push(result);
    }
  }

  const output = { total: testResults.length, passed: testResults.filter(r => r.status === 'passed').length, failed: testResults.filter(r => r.status === 'failed').length, results: testResults };

  // Sign results: try Ed25519 first, fall back to HMAC
  if (__NONCE__ !== '__NONCE_PLACEHOLDER__') {
    try {
      const crypto = require('crypto');
      const payload = __NONCE__ + JSON.stringify(output);

      if (__PRIVATE_KEY__ !== '__PRIVATE_KEY_PLACEHOLDER__') {
        // Ed25519 signing
        var privateKey = crypto.createPrivateKey(__PRIVATE_KEY__);
        output.signature = crypto.sign(null, Buffer.from(payload), privateKey).toString('hex');
      } else if (__HMAC_KEY__ !== '__HMAC_KEY_PLACEHOLDER__') {
        // HMAC fallback
        output.signature = crypto.createHmac('sha256', __HMAC_KEY__).update(payload).digest('hex');
      }
      output.nonce = __NONCE__;
    } catch(e) { console.error('Signing error:', e.message); }
  }

  console.log('__TEST_RESULTS_START__');
  console.log(JSON.stringify(output));
  console.log('__TEST_RESULTS_END__');
}

runTests().catch(e => {
  console.error('Test runner error:', e);
  console.log('__TEST_RESULTS_START__');
  console.log(JSON.stringify({ total: 0, passed: 0, failed: 0, results: [], error: e.message }));
  console.log('__TEST_RESULTS_END__');
});
`,
    },
  },
};
