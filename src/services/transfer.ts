import {basename,join,type Repository} from '../types';

export async function copyRepositoryEntry(source:Repository,target:Repository,sourcePath:string,targetParent:string){
  const sourceEntries=await source.list();const item=sourceEntries.find(entry=>entry.path===sourcePath);if(!item)throw new Error('The copied item is no longer available.');
  const destination=join(targetParent,basename(sourcePath));
  if(source===target&&(destination===sourcePath||destination.startsWith(sourcePath+'/')))throw new Error('Choose a destination outside the source folder.');
  const targetEntries=await target.list();if(targetEntries.some(entry=>entry.path.toLocaleLowerCase()===destination.toLocaleLowerCase()))throw new Error('An item with this name already exists in the destination.');
  const included=sourceEntries.filter(entry=>entry.path===sourcePath||entry.path.startsWith(sourcePath+'/')).sort((a,b)=>a.path.length-b.path.length);
  const files=new Map<string,Blob>();for(const entry of included)if(entry.kind==='file')files.set(entry.path,await source.read(entry.path));
  let created=false;
  try{
    for(const entry of included){const next=destination+entry.path.slice(sourcePath.length);if(entry.kind==='folder')await target.mkdir(next);else await target.write(next,files.get(entry.path)!);created=true;}
  }catch(error){if(created)await target.remove(destination).catch(()=>undefined);throw error;}
  return destination;
}

export async function moveRepositoryEntry(source:Repository,target:Repository,sourcePath:string,targetParent:string){
  const destination=join(targetParent,basename(sourcePath));
  if(source===target){await source.move(sourcePath,destination);return destination;}
  await copyRepositoryEntry(source,target,sourcePath,targetParent);await source.remove(sourcePath);return destination;
}
