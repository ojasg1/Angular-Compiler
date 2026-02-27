export interface VirtualFile {
  path: string;
  content: string;
  language: string;
  readOnly: boolean;
  dirty: boolean;
}
