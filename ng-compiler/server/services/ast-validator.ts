import ts from 'typescript';

/**
 * AST-based structural validation using the TypeScript Compiler API.
 * Replaces regex-based checks for authoritative server-side validation.
 */

function createSourceFile(source: string, fileName = 'file.ts'): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
}

function walkNodes(node: ts.Node, visitor: (node: ts.Node) => boolean | void): void {
  if (visitor(node) === true) return; // short-circuit if found
  ts.forEachChild(node, child => walkNodes(child, visitor));
}

/** Check if source code contains a call to `signal(...)` or `signal<...>(...)` */
export function hasSignalUsage(source: string): boolean {
  const sf = createSourceFile(source);
  let found = false;
  walkNodes(sf, (node) => {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      // signal(...)
      if (ts.isIdentifier(expr) && expr.text === 'signal') {
        found = true;
        return true;
      }
    }
  });
  return found;
}

/** Check if source code contains a call to `computed(...)` */
export function hasComputedUsage(source: string): boolean {
  const sf = createSourceFile(source);
  let found = false;
  walkNodes(sf, (node) => {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr) && expr.text === 'computed') {
        found = true;
        return true;
      }
    }
  });
  return found;
}

/** Check if template contains `@for (...)` block */
export function hasForBlock(template: string): boolean {
  return /@for\s*\(/.test(template);
}

/** Check if template contains `@empty` block */
export function hasEmptyBlock(template: string): boolean {
  return /@empty/.test(template);
}

/** Check if template contains a specific component tag like `<app-task-card` */
export function hasComponentTag(template: string, tag: string): boolean {
  return new RegExp(`<${tag}[\\s>/]`).test(template);
}

/** Check if template contains `track` expression (inside @for) */
export function hasTrackExpression(template: string): boolean {
  return /track\s+\S/.test(template);
}

/** Run all structural checks for a given file content */
export function runStructuralCheck(
  fileContent: string,
  checkType: string,
  args?: string,
): boolean {
  switch (checkType) {
    case 'signal':
      return hasSignalUsage(fileContent);
    case 'computed':
      return hasComputedUsage(fileContent);
    case 'forBlock':
      return hasForBlock(fileContent);
    case 'emptyBlock':
      return hasEmptyBlock(fileContent);
    case 'componentTag':
      return hasComponentTag(fileContent, args || '');
    case 'track':
      return hasTrackExpression(fileContent);
    default:
      return false;
  }
}
