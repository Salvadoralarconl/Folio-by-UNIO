import { ChevronDown, ChevronRight, Folder, FolderOpen, Plus, HardDrive, ArrowUpRight } from 'lucide-react';
import { parent, type Entry } from '../types';
import {compareFolderOrder} from '../services/folderOrder';
import {useRef,type MouseEvent,type DragEvent} from 'react';
interface Props { entries: Entry[]; order:string[]; selected: string; expanded: string[]; editable:boolean; canConnect:boolean; server:boolean; setExpanded: (p: string[]) => void; onSelect: (p: string) => void; onContext: (e: MouseEvent, entry: Entry) => void; onRootContext:(e:MouseEvent)=>void; onDrop: (e: DragEvent, path: string) => void; onReorder:(from:string,target:string,before:boolean)=>void; onAdd: () => void; onConnect: () => void; label: string; demo: boolean; }
export default function FolderPanel(p: Props) {
  const folders = p.entries.filter(e => e.kind === 'folder');
  const dragged=useRef('');
  const clearDrop=(element:HTMLElement)=>element.classList.remove('drop-target','drop-before','drop-after');
  function branch(path: string, depth = 0): React.ReactNode {
    return folders.filter(e => parent(e.path) === path).sort((a,b) => compareFolderOrder(a,b,p.order)).map(folder => {
      const children = folders.some(e => parent(e.path) === folder.path), open = p.expanded.includes(folder.path), selected = p.selected === folder.path;
      return <div key={folder.path} role="treeitem" aria-selected={selected} aria-expanded={children ? open : undefined}>
        <div className={`folder-row ${selected ? 'selected' : ''}`} style={{ paddingLeft: 13 + depth * 18 }} onContextMenu={e => {e.stopPropagation();p.onContext(e,folder);}} draggable={p.editable} onDragStart={e => {if(!p.editable)return;dragged.current=folder.path;e.dataTransfer.setData('application/folio',folder.path);e.dataTransfer.effectAllowed='move';}} onDragEnd={e=>{dragged.current='';clearDrop(e.currentTarget);}} onDragOver={e => {if(!p.editable)return;e.preventDefault();clearDrop(e.currentTarget);if(dragged.current&&parent(dragged.current)===parent(folder.path)){const before=e.clientY<e.currentTarget.getBoundingClientRect().top+e.currentTarget.clientHeight/2;e.currentTarget.classList.add(before?'drop-before':'drop-after');}else e.currentTarget.classList.add('drop-target');}} onDragLeave={e => clearDrop(e.currentTarget)} onDrop={e => {if(!p.editable)return;const from=e.dataTransfer.getData('application/folio');const reorder=from&&p.entries.some(entry=>entry.path===from&&entry.kind==='folder')&&parent(from)===parent(folder.path);const before=e.clientY<e.currentTarget.getBoundingClientRect().top+e.currentTarget.clientHeight/2;clearDrop(e.currentTarget);if(reorder){e.preventDefault();e.stopPropagation();if(from!==folder.path)p.onReorder(from,folder.path,before);}else p.onDrop(e,folder.path);}}>
          <button className={`tree-toggle ${children ? '' : 'invisible'}`} tabIndex={children ? 0 : -1} aria-label={`${open ? 'Collapse' : 'Expand'} ${folder.name}`} onClick={() => p.setExpanded(open ? p.expanded.filter(x => x !== folder.path) : [...p.expanded,folder.path])}>{open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>
          <button className="folder-select" onClick={() => p.onSelect(folder.path)}>{selected || open ? <FolderOpen size={21}/> : <Folder size={21}/>}<span>{folder.name}</span></button>
        </div>{children && open && <div role="group">{branch(folder.path,depth+1)}</div>}
      </div>;
    });
  }
  return <aside className="folder-panel"><div className="panel-heading"><h1>Folders</h1>{p.editable&&<button className="icon-button" aria-label="New folder" onClick={p.onAdd}><Plus size={19}/></button>}</div>
    <div className="folder-tree" role="tree" aria-label="Folders" onContextMenu={e=>{if(e.target===e.currentTarget)p.onRootContext(e);}}><button className={`root-folder ${p.selected === '' ? 'selected' : ''}`} onClick={() => p.onSelect('')} onContextMenu={e=>{e.stopPropagation();p.onRootContext(e);}} onDragOver={e => e.preventDefault()} onDrop={e => p.onDrop(e,'')}><HardDrive size={16}/><span>All documents</span></button>{branch('')}</div>
    <div className="repository-footer"><span className="status-dot"/><div><strong>{p.demo ? 'Saved in this browser' : p.label}</strong><span>{p.demo ? 'Files stay here after you reload' : p.server ? 'Shared securely by this Folio server' : 'Your files stay on this computer'}</span></div>{p.canConnect&&<button className="icon-button" aria-label="Connect local folder" title="Connect local folder" onClick={p.onConnect}><ArrowUpRight size={17}/></button>}</div>
  </aside>;
}
