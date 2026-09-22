import {useEffect,useState} from 'react';
import {BookmarkPlus,File,Folder,LoaderCircle,TextSearch} from 'lucide-react';
import type {Entry,SearchMatchType} from '../types';

type Filter='all'|SearchMatchType;
const labels:Record<Filter,string>={all:'All',folder:'Folders',file:'Files',text:'Text'};

export default function SearchDropdown({query,results,loading,onChoose,onSave}:{query:string;results:Entry[];loading:boolean;onChoose:(entry:Entry)=>void;onSave?:()=>void}){
  const [filter,setFilter]=useState<Filter>('all');
  useEffect(()=>setFilter('all'),[query]);
  const count=(type:Filter)=>type==='all'?results.length:results.filter(entry=>entry.searchType===type).length;
  const visible=filter==='all'?results:results.filter(entry=>entry.searchType===filter);
  return <section className="search-dropdown" aria-label="Search results">
    <div className="search-tabs" role="tablist">{(['all','folder','file','text'] as Filter[]).map(type=><button type="button" role="tab" aria-selected={filter===type} className={filter===type?'active':''} key={type} onClick={()=>setFilter(type)}>{labels[type]} <span>{count(type)}</span></button>)}</div>
    <div className="search-results">
      {loading&&<div className="search-message"><LoaderCircle className="spinner" size={18}/>Searching accessible workspaces…</div>}
      {!loading&&!visible.length&&<div className="search-message">No {filter==='all'?'results':labels[filter].toLowerCase()} found for “{query}”.</div>}
      {!loading&&visible.map(entry=><button type="button" className="search-result" key={`${entry.department}:${entry.searchType}:${entry.path}`} onClick={()=>onChoose(entry)}>
        <span className={`search-result-icon result-${entry.searchType}`}>{entry.searchType==='folder'?<Folder size={18}/>:entry.searchType==='text'?<TextSearch size={18}/>:<File size={18}/>}</span>
        <span className="search-result-copy"><strong>{entry.name}</strong><span>{entry.searchType==='text'&&entry.searchContext?entry.searchContext:`${entry.department} · ${entry.path}`}</span>{entry.searchType==='text'&&<small>{entry.department} · {entry.path}</small>}</span>
      </button>)}
    </div>{onSave&&<button type="button" className="save-search" onClick={onSave}><BookmarkPlus size={14}/>Save this search</button>}
  </section>;
}
