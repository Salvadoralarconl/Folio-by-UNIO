import { parent, type Entry } from '../types';

export function compareFolderOrder(a:Entry,b:Entry,order:string[]){
  const first=order.indexOf(a.path),second=order.indexOf(b.path);
  if(first>=0&&second>=0)return first-second;
  if(first>=0)return -1;
  if(second>=0)return 1;
  return a.name.localeCompare(b.name);
}

export function reorderSiblingFolders(entries:Entry[],order:string[],from:string,target:string,before:boolean){
  const source=entries.find(entry=>entry.path===from&&entry.kind==='folder');
  const destination=entries.find(entry=>entry.path===target&&entry.kind==='folder');
  if(!source||!destination)throw new Error('That folder is no longer available.');
  if(parent(from)!==parent(target))throw new Error('Use Move to… to place a folder in another location.');
  const siblingParent=parent(target);
  const siblings=entries.filter(entry=>entry.kind==='folder'&&parent(entry.path)===siblingParent).sort((a,b)=>compareFolderOrder(a,b,order)).map(entry=>entry.path);
  const reordered=siblings.filter(path=>path!==from);
  let index=reordered.indexOf(target);if(!before)index++;
  reordered.splice(index,0,from);
  return [...order.filter(path=>parent(path)!==siblingParent),...reordered];
}
