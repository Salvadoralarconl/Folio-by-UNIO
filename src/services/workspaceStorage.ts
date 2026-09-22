import type { Repository } from '../types';
export type SavedItem = { path: string; file: Blob | null };
const database = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('folio-workspace', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('workspace');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('Browser storage is unavailable. Connect a local folder to save your files.'));
});
export async function loadWorkspace(key = 'files'): Promise<SavedItem[] | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('workspace', 'readonly');
    const request = transaction.objectStore('workspace').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}
export async function listWorkspaceKeys():Promise<string[]>{const db=await database();return new Promise((resolve,reject)=>{const transaction=db.transaction('workspace','readonly'),request=transaction.objectStore('workspace').getAllKeys();request.onsuccess=()=>resolve(request.result.map(String));request.onerror=()=>reject(request.error);transaction.oncomplete=()=>db.close();});}
export async function saveWorkspace(items: SavedItem[], key = 'files'): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('workspace', 'readwrite');
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(new Error('Could not save your workspace. Browser storage may be full. Download your files or connect a folder.')); };
    try { transaction.objectStore('workspace').put(items, key); }
    catch(error) { transaction.abort(); db.close(); reject(error); }
  });
}
export async function renameWorkspace(fromKey: string, toKey: string): Promise<void> {
  if (fromKey === toKey) return;
  const items = await loadWorkspace(fromKey);
  await saveWorkspace(items || [], toKey);
  await saveWorkspace([], fromKey);
}
// Migrates an already-open, in-memory workspace during this update.
export async function preserveOpenWorkspace(repo: Repository) {
  if(repo.mode !== 'demo') return;
  const entries = await repo.list();
  const items = await Promise.all(entries.map(async entry => ({path:entry.path,file:entry.kind === 'file' ? await repo.read(entry.path) : null})));
  await saveWorkspace(items, repo.storageKey);
}
