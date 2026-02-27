const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.js': 'javascript',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.json': 'json',
  '.md': 'markdown',
};

export function getLanguageFromPath(path: string): string {
  const ext = path.substring(path.lastIndexOf('.'));
  return EXTENSION_LANGUAGE_MAP[ext] || 'plaintext';
}

export function getFileIcon(path: string): string {
  const ext = path.substring(path.lastIndexOf('.'));
  switch (ext) {
    case '.ts': return 'bi-filetype-tsx';
    case '.js': return 'bi-filetype-js';
    case '.html': return 'bi-filetype-html';
    case '.css':
    case '.scss': return 'bi-filetype-css';
    case '.json': return 'bi-filetype-json';
    default: return 'bi-file-earmark-text';
  }
}
