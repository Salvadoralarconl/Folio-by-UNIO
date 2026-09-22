import 'fake-indexeddb/auto';
import {beforeEach,describe,expect,it} from 'vitest';
import {deleteTemplate,loadTemplates,replaceTemplate,saveTemplate} from './templates';
import {saveWorkspace} from './workspaceStorage';

describe('template library',()=>{
  beforeEach(()=>saveWorkspace([],'folio.templates.v1'));

  it('persists uploaded templates and removes them',async()=>{
    const created=await saveTemplate([],'SOP.docx',new Blob(['template bytes']));
    expect(created[0].name).toBe('SOP.docx');
    const restored=await loadTemplates();
    expect(restored.map(item=>item.name)).toEqual(['SOP.docx']);
    const edited=await replaceTemplate(restored,restored[0].id,new Blob(['edited template']));
    expect(await edited[0].file.text()).toBe('edited template');
    await deleteTemplate(edited,edited[0].id);
    expect(await loadTemplates()).toEqual([]);
  });

  it('rejects unsupported template formats',async()=>{
    await expect(saveTemplate([],'Notes.txt',new Blob(['text']))).rejects.toThrow('Templates must be');
  });
});
