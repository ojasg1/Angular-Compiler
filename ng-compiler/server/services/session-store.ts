import { Session, ProblemManifest } from '../types.js';

// Re-export store interface and factory for convenience
export { ISessionStore } from './session-store.interface.js';
export { createSessionStore } from './store-factory.js';

// Problem manifest — minimal metadata for validation (NOT test code)
export const PROBLEM_MANIFESTS: ProblemManifest[] = [
  { id: 'task-board', timeLimit: 1800, maxScore: 25, expectedTestCount: 11 },
];

export function getManifest(problemId: string): ProblemManifest | undefined {
  return PROBLEM_MANIFESTS.find(p => p.id === problemId);
}

export function getRemainingSeconds(session: Session): number {
  const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
  return Math.max(0, session.timeLimit - elapsed);
}

export function isExpired(session: Session): boolean {
  return getRemainingSeconds(session) <= 0;
}
