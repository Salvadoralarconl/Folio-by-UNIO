export type SearchMatchType = 'folder' | 'file' | 'text';
export interface Entry { path: string; name: string; kind: 'file' | 'folder'; size: number; modified: number; department?: string; searchType?: SearchMatchType; searchContext?: string; }
export interface Repository {
  label: string; mode: 'demo' | 'browser' | 'desktop'; storageKey?: string;
  list(): Promise<Entry[]>; read(path: string): Promise<Blob>;
  mkdir(path: string): Promise<void>; write(path: string, file: Blob): Promise<void>;
  move(from: string, to: string): Promise<void>; remove(path: string): Promise<void>;
  replace?(path: string, file: Blob): Promise<void>;
  open?(path: string): Promise<void>; reveal?(path: string): Promise<void>;
}
export const parent = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
export const basename = (path: string) => path.split('/').pop() || '';
export const extension = (path: string) => basename(path).split('.').pop()?.toLowerCase() || '';
export const join = (a: string, b: string) => a ? `${a}/${b}` : b;
export const validName = (s: string) => !!s.trim() && s === s.trim() && !/[<>:"/\\|?*\x00-\x1f]/.test(s) && !/[. ]$/.test(s) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s) && s !== '.' && s !== '..';
export function validateMove(from: string, to: string, entries: Entry[]) {
  if (!to.split('/').every(validName)) throw new Error('Choose a valid file or folder name.');
  if (from === to || to.startsWith(from + '/')) throw new Error('Choose a different location outside this folder.');
  if (entries.some(e => e.path.toLowerCase() === to.toLowerCase())) throw new Error('An item with this name already exists.');
}
export const formatSize = (size: number) => size < 1024 ? `${size} B` : size < 1048576 ? `${Math.round(size / 1024)} KB` : `${(size / 1048576).toFixed(1)} MB`;
