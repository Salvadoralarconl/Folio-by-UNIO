import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { demoRepository } from './repository';
import { copyRepositoryEntry, moveRepositoryEntry } from './transfer';
import { saveWorkspace } from './workspaceStorage';

const sourceDepartment = 'Transfer source';
const targetDepartment = 'Transfer target';

describe('copying and moving entries between departments', () => {
  beforeEach(async () => {
    await saveWorkspace([], `files:${sourceDepartment}`);
    await saveWorkspace([], `files:${targetDepartment}`);
  });

  it('copies a nested folder and keeps the original', async () => {
    const source = await demoRepository(sourceDepartment);
    const target = await demoRepository(targetDepartment);
    await source.mkdir('Client');
    await source.mkdir('Client/Notes');
    await source.write('Client/Notes/Plan.txt', new Blob(['Exact plan contents']));
    await target.mkdir('Archive');

    const destination = await copyRepositoryEntry(source, target, 'Client', 'Archive');

    expect(destination).toBe('Archive/Client');
    expect(await (await target.read('Archive/Client/Notes/Plan.txt')).text()).toBe('Exact plan contents');
    expect(await (await source.read('Client/Notes/Plan.txt')).text()).toBe('Exact plan contents');
  });

  it('moves a file to another department and removes the source', async () => {
    const source = await demoRepository(sourceDepartment);
    const target = await demoRepository(targetDepartment);
    await source.write('Budget.xlsx', new Blob(['workbook bytes']));

    const destination = await moveRepositoryEntry(source, target, 'Budget.xlsx', '');

    expect(destination).toBe('Budget.xlsx');
    expect(await (await target.read('Budget.xlsx')).text()).toBe('workbook bytes');
    expect((await source.list()).some(entry => entry.path === 'Budget.xlsx')).toBe(false);
  });

  it('refuses a conflicting paste without changing either workspace', async () => {
    const source = await demoRepository(sourceDepartment);
    const target = await demoRepository(targetDepartment);
    await source.write('Notes.txt', new Blob(['source']));
    await target.write('Notes.txt', new Blob(['destination']));

    await expect(moveRepositoryEntry(source, target, 'Notes.txt', '')).rejects.toThrow('already exists');

    expect(await (await source.read('Notes.txt')).text()).toBe('source');
    expect(await (await target.read('Notes.txt')).text()).toBe('destination');
  });

  it('prevents a folder from being pasted inside itself', async () => {
    const repository = await demoRepository(sourceDepartment);
    await repository.mkdir('Parent');
    await repository.mkdir('Parent/Child');

    await expect(copyRepositoryEntry(repository, repository, 'Parent', 'Parent/Child')).rejects.toThrow('outside the source folder');
  });
});
