import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseRepository } from './repository';

// A minimal File System Access adapter exercises the same read/copy/delete
// sequence used by connected browser folders, without touching user files.
class TestDirectory {
  kind = 'directory';
  children = new Map<string, TestDirectory | TestFile>();
  constructor(public name: string) {}
  async *values() { yield* this.children.values(); }
  async getDirectoryHandle(name: string, options?: {create?: boolean}): Promise<TestDirectory> {
    let item = this.children.get(name);
    if(!item && options?.create) { item = new TestDirectory(name); this.children.set(name,item); }
    if(!(item instanceof TestDirectory)) throw new DOMException('Not found','NotFoundError');
    return item;
  }
  async getFileHandle(name: string, options?: {create?: boolean}): Promise<TestFile> {
    let item = this.children.get(name);
    if(!item && options?.create) { item = new TestFile(name,''); this.children.set(name,item); }
    if(!(item instanceof TestFile)) throw new DOMException('Not found','NotFoundError');
    return item;
  }
  async removeEntry(name: string) { this.children.delete(name); }
}
class TestFile {
  kind = 'file'; data: Blob;
  constructor(public name: string, text: string) { this.data = new Blob([text]); }
  async getFile() { return Object.assign(this.data,{lastModified:1}); }
  async createWritable() { return { write: async (blob: Blob) => {this.data=blob;}, close: async () => {} }; }
}
afterEach(() => vi.unstubAllGlobals());
async function setup() {
  const root = new TestDirectory('Test repository');
  root.children.set('Original.txt',new TestFile('Original.txt','Do not lose this.'));
  root.children.set('Archive',new TestDirectory('Archive'));
  vi.stubGlobal('window',{showDirectoryPicker:async()=>root});
  return {root,repo:await chooseRepository()};
}
describe('connected local folder operations', () => {
  it('moves a file while preserving the exact original content', async () => {
    const {repo}=await setup();
    await repo.move('Original.txt','Archive/Original.txt');
    expect(await (await repo.read('Archive/Original.txt')).text()).toBe('Do not lose this.');
    expect((await repo.list()).some(e=>e.path==='Original.txt')).toBe(false);
  });
  it('refuses to overwrite an existing destination', async () => {
    const {repo}=await setup();
    await expect(repo.write('Original.txt',new Blob(['Replacement']))).rejects.toThrow('already exists');
    expect(await (await repo.read('Original.txt')).text()).toBe('Do not lose this.');
  });
  it('retains the original if a destination write fails', async () => {
    const {repo,root}=await setup();
    const archive=await root.getDirectoryHandle('Archive');
    vi.spyOn(archive,'getFileHandle').mockRejectedValue(new DOMException('Disk full','QuotaExceededError'));
    await expect(repo.move('Original.txt','Archive/Original.txt')).rejects.toThrow();
    expect(await (await repo.read('Original.txt')).text()).toBe('Do not lose this.');
  });
  it('moves nested folders including their contents', async () => {
    const {repo}=await setup();
    await repo.mkdir('Project'); await repo.mkdir('Project/Notes');
    await repo.write('Project/Notes/Plan.txt',new Blob(['Plan']));
    await repo.move('Project','Archive/Project');
    expect(await (await repo.read('Archive/Project/Notes/Plan.txt')).text()).toBe('Plan');
    expect((await repo.list()).some(e=>e.path.startsWith('Project'))).toBe(false);
  });
});
