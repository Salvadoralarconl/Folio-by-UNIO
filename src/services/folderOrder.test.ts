import {describe,expect,it} from 'vitest';
import {reorderSiblingFolders} from './folderOrder';
import type {Entry} from '../types';

const folders=(...paths:string[]):Entry[]=>paths.map(path=>({path,name:path.split('/').pop()!,kind:'folder',size:0,modified:0}));

describe('manual folder ordering',()=>{
  it('reorders root folders without changing nested folder order',()=>{
    const entries=folders('Alpha','Bravo','Charlie','Alpha/One','Alpha/Two');
    const order=reorderSiblingFolders(entries,['Alpha/One','Alpha/Two'],'Charlie','Alpha',true);
    expect(order).toEqual(['Alpha/One','Alpha/Two','Charlie','Alpha','Bravo']);
  });
  it('requires Move to for a different parent',()=>{
    const entries=folders('Alpha','Bravo','Alpha/Child');
    expect(()=>reorderSiblingFolders(entries,[],'Alpha/Child','Bravo',true)).toThrow('Move to');
  });
});
