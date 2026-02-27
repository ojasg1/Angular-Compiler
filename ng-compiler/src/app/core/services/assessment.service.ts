import { Injectable, signal, inject } from '@angular/core';
import { Problem, TestSuite } from '../models/problem.model';
import { VirtualFile } from '../models/virtual-file.model';
import { PROBLEMS } from '../constants/problems';
// Note: PROBLEM_TEST_SPECS removed from client — now server-side only (encrypted per session)
import { DEFAULT_ANGULAR_PROJECT } from '../constants/default-angular-project';
import { WebContainerService } from './webcontainer.service';
import { FileSystemService } from '../../features/editor/editor.service';
import { TestRunnerService } from './test-runner.service';
import { TimerService } from './timer.service';
import { LlmEvaluatorService } from './llm-evaluator.service';
import { HintService } from './hint.service';
import { SessionService } from './session.service';
import { AntiCheatService } from './anti-cheat.service';
import { FileSystemTree } from '@webcontainer/api';

@Injectable({ providedIn: 'root' })
export class AssessmentService {
  private webContainer = inject(WebContainerService);
  private fileSystem = inject(FileSystemService);
  private testRunner = inject(TestRunnerService);
  private timer = inject(TimerService);
  private llmEvaluator = inject(LlmEvaluatorService);
  private hintService = inject(HintService);
  private sessionService = inject(SessionService);
  private antiCheat = inject(AntiCheatService);

  readonly currentProblem = signal<Problem | null>(null);
  readonly isSubmitted = signal(false);
  readonly isEvaluatingLlm = signal(false);
  readonly finalScore = signal<TestSuite | null>(null);
  readonly problems = signal<Problem[]>(PROBLEMS);

  async initialize(problemId: string): Promise<void> {
    const problem = PROBLEMS.find((p) => p.id === problemId);
    if (!problem) throw new Error(`Problem not found: ${problemId}`);

    this.currentProblem.set(problem);
    this.isSubmitted.set(false);
    this.finalScore.set(null);
    this.testRunner.reset();

    // Start server session (generates nonce + hmacKey + privateKey + encryptionKey)
    try {
      await this.sessionService.startSession(problemId);
    } catch (err) {
      console.warn('Server session unavailable, running in client-only mode:', err);
    }

    // Connect FileSystemService to WebContainerService
    this.fileSystem.setWebContainerService(this.webContainer);

    // Boot WebContainer (quick ~2s)
    await this.webContainer.boot();

    // Build the file system tree: default project + starter files + encrypted test specs
    const tree = this.buildFileSystemTree(problem);
    await this.webContainer.mountFiles(tree);

    // Load files into editor immediately so user can start coding
    this.fileSystem.loadFiles(problem.starterFiles);

    // Start timer
    this.timer.start(problem.timeLimit, () => this.submit());

    // Start server heartbeat for timer sync + anti-cheat monitoring
    this.sessionService.startHeartbeat();
    this.antiCheat.startMonitoring();

    // Run npm install + dev server in background (non-blocking)
    this.bootstrapDevServer();
  }

  private async bootstrapDevServer(): Promise<void> {
    try {
      const success = await this.webContainer.installDependencies();
      if (!success) {
        console.error('npm install failed');
        return;
      }
      await this.webContainer.startDevServer();
    } catch (err) {
      console.error('Background dev server bootstrap failed:', err);
    }
  }

  private buildFileSystemTree(problem: Problem): FileSystemTree {
    // Start with the default Angular project
    const tree: FileSystemTree = JSON.parse(JSON.stringify(DEFAULT_ANGULAR_PROJECT));

    // Inject signing credentials + encryption key into run-tests.js
    const runTestsNode = tree['run-tests.js'];
    if (runTestsNode && 'file' in runTestsNode && 'contents' in runTestsNode.file) {
      let content = runTestsNode.file.contents as string;

      // Inject nonce
      if (this.sessionService.nonce()) {
        content = content.replace("'__NONCE_PLACEHOLDER__'", `'${this.sessionService.nonce()}'`);
      }

      // Inject HMAC key (backward compat)
      if (this.sessionService.hmacKey()) {
        content = content.replace("'__HMAC_KEY_PLACEHOLDER__'", `'${this.sessionService.hmacKey()}'`);
      }

      // Inject Ed25519 private key for signing
      if (this.sessionService.privateKey()) {
        content = content.replace("'__PRIVATE_KEY_PLACEHOLDER__'", JSON.stringify(this.sessionService.privateKey()));
      }

      // Inject encryption key for decrypting test specs
      if (this.sessionService.encryptionKey()) {
        content = content.replace("'__ENCRYPTION_KEY_PLACEHOLDER__'", `'${this.sessionService.encryptionKey()}'`);
      }

      (runTestsNode.file as { contents: string }).contents = content;
    }

    // Mount all starter files (including HTML/CSS for test specs to read)
    for (const file of problem.starterFiles) {
      this.setFileInTree(tree, file.path, file.content);
    }

    // For .component.ts files with templateUrl/styleUrl, also mount an inlined version
    for (const file of problem.starterFiles) {
      if (file.path.endsWith('.component.ts') && (file.content.includes('templateUrl') || file.content.includes('styleUrl'))) {
        const inlined = this.inlineTemplateAndStyles(file, problem.starterFiles);
        this.setFileInTree(tree, file.path, inlined);
      }
    }

    // Mount encrypted test specs (if available from server)
    const encryptedSpecs = this.sessionService.encryptedSpecs();
    if (encryptedSpecs) {
      this.setFileInTree(tree, 'test-specs.enc.json', JSON.stringify(encryptedSpecs));
    }

    return tree;
  }

  private inlineTemplateAndStyles(tsFile: VirtualFile, allFiles: VirtualFile[]): string {
    let result = tsFile.content;
    const dir = tsFile.path.substring(0, tsFile.path.lastIndexOf('/'));

    const templateMatch = result.match(/templateUrl\s*:\s*['"]\.\/([^'"]+)['"]/);
    if (templateMatch) {
      const htmlPath = dir + '/' + templateMatch[1];
      const htmlFile = allFiles.find((f) => f.path === htmlPath);
      if (htmlFile) {
        const escaped = htmlFile.content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        result = result.replace(templateMatch[0], 'template: `' + escaped + '`');
      }
    }

    const styleMatch = result.match(/styleUrl\s*:\s*['"]\.\/([^'"]+)['"]/);
    if (styleMatch) {
      const cssPath = dir + '/' + styleMatch[1];
      const cssFile = allFiles.find((f) => f.path === cssPath);
      if (cssFile) {
        const escaped = cssFile.content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        result = result.replace(styleMatch[0], 'styles: [`' + escaped + '`]');
      }
    }

    return result;
  }

  private setFileInTree(tree: FileSystemTree, filePath: string, content: string): void {
    const parts = filePath.split('/');
    let current: FileSystemTree = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { directory: {} };
      }
      const node = current[part];
      if ('directory' in node) {
        current = node.directory;
      }
    }

    const fileName = parts[parts.length - 1];
    current[fileName] = { file: { contents: content } };
  }

  async runTests(): Promise<TestSuite> {
    const problem = this.currentProblem();
    if (!problem) throw new Error('No problem loaded');

    // Flush pending file writes (handles inlining templateUrl/styleUrl)
    await this.fileSystem.flushAll();

    return this.testRunner.runTests(problem.maxScore, problem);
  }

  async submit(): Promise<TestSuite> {
    this.timer.stop();
    this.sessionService.stopHeartbeat();
    this.antiCheat.stopMonitoring();
    const suite = await this.runTests();
    this.isSubmitted.set(true);
    this.finalScore.set(suite);

    // Submit results to server for verification
    const codeFiles = this.fileSystem.files().map(f => ({
      path: f.path,
      content: f.content,
    }));

    try {
      const serverResponse = await this.sessionService.submitResults({
        testResults: {
          total: suite.total,
          passed: suite.passed,
          failed: suite.failed,
          results: suite.results.filter(r => r.category !== 'dom'),
        },
        domTestResults: suite.results.filter(r => r.category === 'dom'),
        signature: suite.signature || '',
        nonce: suite.nonce || '',
        clientTimestamp: Date.now(),
        codeSnapshot: codeFiles,
      });

      // Use server-verified score
      const verifiedSuite: TestSuite = {
        ...suite,
        score: serverResponse.serverScore,
        serverVerified: true,
      };
      this.finalScore.set(verifiedSuite);
    } catch (err) {
      console.warn('Server submission failed, using client score:', err);
    }

    // Run LLM evaluation via server proxy
    const problem = this.currentProblem();
    if (problem) {
      this.isEvaluatingLlm.set(true);
      try {
        const evaluation = await this.llmEvaluator.evaluate(
          problem.description,
          codeFiles,
          suite,
          problem.maxScore,
          this.hintService.totalHintsUsed()
        );

        if (evaluation) {
          const currentScore = this.finalScore();
          const updatedSuite: TestSuite = {
            ...(currentScore || suite),
            llmEvaluation: evaluation,
            finalScore: evaluation.adjustedScore,
          };
          this.finalScore.set(updatedSuite);
          return updatedSuite;
        }
      } catch (err) {
        console.error('LLM evaluation failed, using base score:', err);
      } finally {
        this.isEvaluatingLlm.set(false);
      }
    }

    return this.finalScore() || suite;
  }

  async reset(): Promise<void> {
    const problem = this.currentProblem();
    if (!problem) return;

    this.isSubmitted.set(false);
    this.finalScore.set(null);
    this.testRunner.reset();

    // Restore starter files
    for (const file of problem.starterFiles) {
      await this.webContainer.writeFile(file.path, file.content);
    }
    this.fileSystem.loadFiles(problem.starterFiles);

    // Restart timer
    this.timer.start(problem.timeLimit, () => this.submit());
  }
}
