import {describe,expect,it} from 'vitest';
import {searchRepository} from './search';
import type {Repository} from '../types';

function repository():Repository{
  const data=new Map<string,Blob|null>([
    ['Clients/St Thomas',null],
    ['Clients/St Thomas/Enrollment form.pdf',new Blob(['not indexed as a binary PDF in this fixture'])],
    ['Meeting notes.txt',new Blob(['The next appointment is at St Thomas on Friday.'])],
  ]);
  return {label:'Test',mode:'demo',storageKey:'search-test',async list(){return [...data].map(([path,file])=>({path,name:path.split('/').pop()!,kind:file?'file' as const:'folder' as const,size:file?.size||0,modified:1}));},async read(path){return data.get(path)!;},async mkdir(){},async write(){},async move(){},async remove(){}};
}

describe('workspace search',()=>{
  it('classifies folder, file name, and document text matches',async()=>{
    const repo=repository();
    expect((await searchRepository(repo,'General','Clients')).map(result=>result.searchType)).toContain('folder');
    expect((await searchRepository(repo,'General','Enrollment')).map(result=>result.searchType)).toEqual(['file']);
    const text=await searchRepository(repo,'General','appointment');
    expect(text).toHaveLength(1);expect(text[0].searchType).toBe('text');expect(text[0].searchContext).toContain('appointment');
  });
});
