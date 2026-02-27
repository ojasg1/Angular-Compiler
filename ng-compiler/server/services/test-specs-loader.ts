import { PROBLEM_TEST_SPECS, TestSpecFile } from '../data/test-specs.js';

export function getServerTestSpecs(problemId: string): TestSpecFile[] | undefined {
  return PROBLEM_TEST_SPECS[problemId];
}
