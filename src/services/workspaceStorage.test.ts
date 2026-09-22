import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { loadWorkspace, saveWorkspace } from './workspaceStorage';
import { demoRepository } from './repository';
describe('persistent browser workspace', () => {
  it('restores files, their bytes, and empty folders in a new repository instance', async () => {
    await saveWorkspace([]);
    const first = await demoRepository();
    await first.mkdir('Resumes'); await first.mkdir('Empty folder');
    await first.write('Resumes/Resume.docx',new Blob([new Uint8Array([80,75,3,4,255,0])],{type:'application/test'}));
    const reopened = await demoRepository();
    expect((await reopened.list()).map(e=>e.path)).toEqual(['Resumes','Empty folder','Resumes/Resume.docx']);
    expect(Array.from(new Uint8Array(await (await reopened.read('Resumes/Resume.docx')).arrayBuffer()))).toEqual([80,75,3,4,255,0]);
    await reopened.move('Resumes','Applications');
    expect((await (await demoRepository()).list()).some(e=>e.path==='Applications/Resume.docx')).toBe(true);
  });
  it('keeps an intentionally empty workspace empty after restarting', async () => {
    await saveWorkspace([]);
    expect(await (await demoRepository()).list()).toEqual([]);
  });
  it('persists edited content over the same file without creating duplicates', async () => {
    await saveWorkspace([{path:'Draft.docx',file:new Blob(['original'])}]);
    const repo=await demoRepository();
    await repo.replace!('Draft.docx',new Blob(['edited']));
    const reopened=await demoRepository();
    expect((await reopened.list()).length).toBe(1);
    expect(await (await reopened.read('Draft.docx')).text()).toBe('edited');
  });
  it('keeps department files in independent workspaces', async () => {
    await saveWorkspace([], 'files:Finance');
    await saveWorkspace([], 'files:Human Resources');
    const finance=await demoRepository('Finance');
    const hr=await demoRepository('Human Resources');
    await finance.write('Budget.xlsx',new Blob(['finance']));
    await hr.write('Handbook.docx',new Blob(['hr']));
    expect((await (await demoRepository('Finance')).list()).map(entry=>entry.path)).toEqual(['Budget.xlsx']);
    expect((await (await demoRepository('Human Resources')).list()).map(entry=>entry.path)).toEqual(['Handbook.docx']);
  });

  it('keeps each user personal workspace private', async () => {
    const firstUser=await demoRepository('Personal','user-a');
    const secondUser=await demoRepository('Personal','user-b');
    await firstUser.write('Private notes.txt',new Blob(['only user a']));
    expect((await (await demoRepository('Personal','user-a')).list()).map(entry=>entry.path)).toEqual(['Private notes.txt']);
    expect(await secondUser.list()).toEqual([]);
  });
  it('rejects unsuccessful storage transactions instead of reporting a save', async () => {
    await saveWorkspace([{path:'Keep.txt',file:new Blob(['Keep me'])}]);
    const repo = await demoRepository();
    const put = vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(() => { throw new DOMException('Quota exceeded','QuotaExceededError'); });
    await expect(repo.write('New.txt',new Blob(['New']))).rejects.toThrow();
    put.mockRestore();
    expect((await repo.list()).map(e=>e.path)).toEqual(['Keep.txt']);
    expect((await loadWorkspace())?.map(e=>e.path)).toEqual(['Keep.txt']);
  });
});
