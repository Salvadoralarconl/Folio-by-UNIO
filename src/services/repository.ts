import { invoke, isTauri } from '@tauri-apps/api/core';
import { basename, parent, join, validateMove, type Entry, type Repository } from '../types';
import { loadWorkspace, saveWorkspace } from './workspaceStorage';

const mime = (name: string) => ({ pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' }[name.split('.').pop()!] || 'application/octet-stream');
export const native = isTauri();
export function desktopRepository(): Repository {
  return { label: 'Folio', mode: 'desktop', replace: async (path, file) => invoke('replace_file', { path, bytes: Array.from(new Uint8Array(await file.arrayBuffer())) }), list: () => invoke('list_entries'), read: async path => new Blob([new Uint8Array(await invoke<number[]>('read_file', { path }))], { type: mime(path) }), mkdir: path => invoke('create_folder', { path }), write: async (path, file) => invoke('write_file', { path, bytes: Array.from(new Uint8Array(await file.arrayBuffer())) }), move: (from, to) => invoke('move_entry', { from, to }), remove: path => invoke('delete_entry', { path }), open: path => invoke('open_file', { path }), reveal: path => invoke('reveal_file', { path }) };
}

// Browser File System Access implementation. Handles stay in memory; files stay on disk.
type Dir = FileSystemDirectoryHandle & { values(): AsyncIterableIterator<FileSystemHandle> };
type Writable = FileSystemFileHandle & { createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> };
export async function chooseRepository(): Promise<Repository> {
  const picker = (window as unknown as { showDirectoryPicker?: (options: object) => Promise<Dir> }).showDirectoryPicker;
  if (!picker) throw new Error('Use Chrome or Edge to connect a local folder, or run the desktop app.');
  const root = await picker({ mode: 'readwrite', id: 'folio-repository' });
  const directory = async (path: string, create = false): Promise<Dir> => {
    let current = root;
    for (const part of path.split('/').filter(Boolean)) current = await current.getDirectoryHandle(part, { create }) as Dir;
    return current;
  };
  const repo: Repository = {
    label: root.name, mode: 'browser',
    async replace(path,file) {
      const handle = await (await directory(parent(path))).getFileHandle(basename(path)) as Writable;
      const stream = await handle.createWritable(); await stream.write(file); await stream.close();
    },
    async list() {
      const result: Entry[] = [];
      async function walk(dir: Dir, prefix: string) {
        for await (const handle of dir.values()) {
          if (handle.name.startsWith('.')) continue;
          const path = join(prefix, handle.name);
          if (handle.kind === 'directory') { result.push({ path, name: handle.name, kind: 'folder', size: 0, modified: 0 }); await walk(handle as Dir, path); }
          else { const file = await (handle as FileSystemFileHandle).getFile(); result.push({ path, name: handle.name, kind: 'file', size: file.size, modified: file.lastModified }); }
        }
      }
      await walk(root, ''); return result;
    },
    async read(path) { return (await (await directory(parent(path))).getFileHandle(basename(path))).getFile(); },
    async mkdir(path) { const entries = await repo.list(); if (entries.some(e => e.path.toLowerCase() === path.toLowerCase())) throw new Error('That folder already exists.'); await directory(path, true); },
    async write(path, file) {
      const dir = await directory(parent(path), true);
      try { await dir.getFileHandle(basename(path)); throw new Error('A file with this name already exists. Rename it before importing.'); } catch (e) { if (!(e instanceof DOMException && e.name === 'NotFoundError')) throw e; }
      const handle = await dir.getFileHandle(basename(path), { create: true }) as Writable;
      const stream = await handle.createWritable(); await stream.write(file); await stream.close();
    },
    async move(from, to) {
      const entries = await repo.list(); validateMove(from, to, entries);
      const source = entries.find(e => e.path === from); if (!source) throw new Error('This item is no longer available.');
      if (source.kind === 'file') await repo.write(to, await repo.read(from));
      else {
        await directory(to, true);
        for (const entry of entries.filter(e => e.path.startsWith(from + '/')).sort((a,b) => a.path.length - b.path.length)) {
          const target = to + entry.path.slice(from.length);
          if (entry.kind === 'folder') await directory(target, true); else await repo.write(target, await repo.read(entry.path));
        }
      }
      await repo.remove(from);
    },
    async remove(path) { await (await directory(parent(path))).removeEntry(basename(path), { recursive: true }); }
  };
  return repo;
}

export const PERSONAL_DEPARTMENT = 'Personal';
export const departmentStorageKey = (department: string, userId?: string) => department === PERSONAL_DEPARTMENT
  ? `files:personal:${userId || 'unassigned'}`
  : department === 'General' ? 'files' : `files:${department}`;
export async function demoRepository(department = 'General', userId?: string): Promise<Repository> {
  if (department === PERSONAL_DEPARTMENT && !userId) throw new Error('Sign in to open your Personal workspace.');
  const storageKey = departmentStorageKey(department,userId);
  const saved = await loadWorkspace(storageKey);
  let data = new Map<string, Blob | null>(saved?.map(item => [item.path,item.file]));
  if (department !== 'General' && saved?.length) {
    const markerPath = `${department}/${department} overview.txt`;
    const marker = data.get(markerPath);
    if (marker && (await marker.text()).startsWith(department.toUpperCase())) {
      data.delete(markerPath);
      for (const path of [...data.keys()].sort((a,b) => b.length - a.length)) {
        if (!data.get(path) && ![...data.keys()].some(child => child.startsWith(path + '/'))) data.delete(path);
      }
      await saveWorkspace([...data].map(([path,file]) => ({path,file})), storageKey);
    }
  }
  if (!saved) {
  if (department === 'General') {
    ['Documents', 'Documents/Projects', 'Documents/Projects/Website redesign', 'Documents/Projects/Brand identity', 'Documents/Finance', 'Documents/Personal', 'Resources', 'Archive'].forEach(p => data.set(p, null));
    const base = 'Documents/Projects/Website redesign/';
    const pdf = await fetch('/samples/Project_Proposal.pdf');
    if (pdf.ok) data.set(base + 'Project_Proposal.pdf', await pdf.blob());
    const doc = await fetch('/samples/Creative_Brief.docx');
    if (doc.ok) data.set(base + 'Creative_Brief.docx', await doc.blob());
    data.set(base + 'Project_Budget.csv', new Blob(['Category,Description,Amount,Status\nStrategy,Discovery and research,2400,Approved\nDesign,Interface and visual design,4800,Approved\nDevelopment,Website development,7200,In progress\nContent,Copywriting and migration,1800,Planned\nLaunch,Testing and deployment,1200,Planned\nTotal,,17400,'], { type: 'text/csv' }));
    data.set(base + 'Meeting_Notes.txt', new Blob(['WEBSITE REDESIGN\nKickoff meeting · April 15, 2026\n\nA fresh start for a familiar brand.\n\nGoals\n— Make our work easier to discover.\n— Create a calm, clear experience on every screen.\n— Give the team a simple way to publish updates.\n\nNext steps\n1. Share the existing content inventory.\n2. Review the first visual direction together.\n3. Confirm the sitemap and project milestones.\n\nNext check-in: Thursday at 10:00 AM'], { type: 'text/plain' }));
    data.set('Documents/Finance/Expenses.csv', new Blob(['Date,Item,Amount\n2026-04-10,Software,49\n2026-04-12,Office supplies,24'], { type: 'text/csv' }));
    data.set('Resources/Read me.txt', new Blob(['Welcome to Folio.\n\nFiles and folders added here are saved in this browser, including after a reload or restart. The included documents are examples you can replace.\n\nChoose “Connect folder” to work with ordinary files directly on your computer. Browser storage belongs to this browser and site address; clearing site data removes its files. Keep important originals in a connected folder.'], { type: 'text/plain' }));
  }
  await saveWorkspace([...data].map(([path,file]) => ({path,file})), storageKey);
  }
  const commit = async (update: (draft: Map<string, Blob | null>) => void) => {
    const draft = new Map(data); update(draft);
    await saveWorkspace([...draft].map(([path,file]) => ({path,file})), storageKey);
    data = draft;
  };
  const repo: Repository = { label: `${department} workspace`, mode: 'demo', storageKey,
    async replace(path,file) { if(!data.get(path)) throw new Error('The original file is missing. Export your edited copy.'); await commit(draft => draft.set(path,file)); },
    async list() { return [...data].map(([path, file]) => ({ path, name: basename(path), kind: file ? 'file' : 'folder', size: file?.size || 0, modified: new Date('2026-04-15T10:00:00').getTime() })); },
    async read(path) { const file = data.get(path); if (!file) throw new Error('File missing. It may have been moved or deleted.'); return file; },
    async mkdir(path) { if (data.has(path)) throw new Error('That folder already exists.'); await commit(draft => draft.set(path, null)); },
    async write(path, file) { if (data.has(path)) throw new Error('A file with this name already exists.'); await commit(draft => { const parts = parent(path).split('/'); for (let i = 1; i <= parts.length; i++) { const p = parts.slice(0,i).join('/'); if(p && !draft.has(p)) draft.set(p, null); } draft.set(path, file); }); },
    async remove(path) { await commit(draft => { for (const key of draft.keys()) if (key === path || key.startsWith(path + '/')) draft.delete(key); }); },
    async move(from, to) { validateMove(from, to, await repo.list()); const moved = [...data].filter(([key]) => key === from || key.startsWith(from + '/')); if (!moved.length) throw new Error('Item missing.'); await commit(draft => { for(const [key,value] of moved) { draft.delete(key); draft.set(to + key.slice(from.length),value); } }); }
  }; return repo;
}
