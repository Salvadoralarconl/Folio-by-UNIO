import {extension} from '../types';
import {loadWorkspace,saveWorkspace} from './workspaceStorage';

export type TemplateKind='docx'|'xlsx'|'pptx';
export type DocumentTemplate={id:string;name:string;kind:TemplateKind;file:Blob};
const storageKey='folio.templates.v1';
const allowed=new Set<TemplateKind>(['docx','xlsx','pptx']);

export function templateLabel(template:DocumentTemplate){return template.name.replace(/\.[^.]+$/,'');}

export async function loadTemplates():Promise<DocumentTemplate[]>{
  const saved=await loadWorkspace(storageKey);if(!saved)return [];
  return saved.flatMap(item=>{const kind=extension(item.path) as TemplateKind;return item.file&&allowed.has(kind)?[{id:item.path.toLocaleLowerCase(),name:item.path,kind,file:item.file}]:[];}).sort((a,b)=>a.name.localeCompare(b.name));
}

export async function saveTemplate(current:DocumentTemplate[],name:string,file:Blob):Promise<DocumentTemplate[]>{
  const kind=extension(name) as TemplateKind;if(!allowed.has(kind))throw new Error('Templates must be Word (.docx), Excel (.xlsx), or PowerPoint (.pptx) files.');
  const normalized=name.trim();if(!normalized)throw new Error('Enter a template name.');
  if(current.some(item=>item.name.toLocaleLowerCase()===normalized.toLocaleLowerCase()))throw new Error('A template with that name already exists.');
  const next=[...current,{id:normalized.toLocaleLowerCase(),name:normalized,kind,file}].sort((a,b)=>a.name.localeCompare(b.name));
  await saveWorkspace(next.map(item=>({path:item.name,file:item.file})),storageKey);return next;
}

export async function deleteTemplate(current:DocumentTemplate[],id:string):Promise<DocumentTemplate[]>{
  const next=current.filter(item=>item.id!==id);await saveWorkspace(next.map(item=>({path:item.name,file:item.file})),storageKey);return next;
}

export async function replaceTemplate(current:DocumentTemplate[],id:string,file:Blob):Promise<DocumentTemplate[]>{
  if(!current.some(item=>item.id===id))throw new Error('This template is no longer available.');
  const next=current.map(item=>item.id===id?{...item,file}:item);await saveWorkspace(next.map(item=>({path:item.name,file:item.file})),storageKey);return next;
}
