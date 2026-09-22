import {Component,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {LoaderCircle} from 'lucide-react';
import type {Entry,Repository} from '../types';

const endpoint=window.location.hostname==='tauri.localhost'?'http://localhost:1421':'/bridge';
const documentServer='https://office.getunio.dev';
const headers={'X-Folio-Request':'editor'};
type EditorInstance={destroyEditor():void};
type Session={config:Record<string,unknown>};
declare global { interface Window {DocsAPI?:{DocEditor:new(id:string,config:Record<string,unknown>)=>EditorInstance};} }
async function request(path:string,options:RequestInit={}){const response=await fetch(endpoint+path,{...options,headers:{...headers,...options.headers}});const result=await response.json();if(!response.ok)throw Error(result.error||'The local editor is unavailable.');return result;}
let scriptPromise:Promise<void>|undefined;
function loadEditor(){if(window.DocsAPI)return Promise.resolve();return scriptPromise ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=documentServer+'/web-apps/apps/api/documents/api.js';script.onload=()=>resolve();script.onerror=()=>{scriptPromise=undefined;script.remove();reject(Error('ONLYOFFICE is unavailable.'));};document.head.appendChild(script);});}

type Props={entry:Entry;repo:Repository;theme:'light'|'dark';fallback:ReactNode};
function OfficePreviewInner({entry,repo,theme,fallback}:Props){
  const id=`folio-office-preview-${useId().replace(/:/g,'')}`;const [error,setError]=useState('');const [ready,setReady]=useState(false);const target=useRef<HTMLDivElement>(null);
  useEffect(()=>{let cancelled=false;let editor:EditorInstance|undefined;
    (async()=>{const blob=await repo.read(entry.path);const session:Session=await request('/sessions?mode=view',{method:'POST',headers:{'X-Folio-Name':encodeURIComponent(entry.name),'Content-Type':'application/octet-stream'},body:blob});if(cancelled)return;await loadEditor();if(cancelled)return;const config=session.config;const documentConfig=(config.document as Record<string,unknown>|undefined)||{};const permissions=(documentConfig.permissions as Record<string,unknown>|undefined)||{};const editorConfig=(config.editorConfig as Record<string,unknown>|undefined)||{};const customization=(editorConfig.customization as Record<string,unknown>|undefined)||{};editor=new window.DocsAPI!.DocEditor(id,{...config,document:{...documentConfig,permissions:{...permissions,edit:false}},editorConfig:{...editorConfig,mode:'view',customization:{...customization,uiTheme:theme==='dark'?'theme-dark':'theme-light'}},events:{onAppReady:()=>{if(!cancelled)setReady(true);},onError:(event:{data?:{errorDescription?:string}})=>{if(!cancelled)setError(event.data?.errorDescription||'The workbook editor reported an error.');}}});
    })().catch(e=>{if(!cancelled)setError((e as Error).message);});
    return()=>{cancelled=true;editor?.destroyEditor();};
  },[entry.path,entry.modified,repo,theme,id]);
  if(error)return <div className="office-preview-fallback"><p>Live workbook preview unavailable.</p>{fallback}</div>;
  return <div className="office-preview">{!ready&&<div className="office-preview-loading"><LoaderCircle className="spinner" size={18}/>Opening workbook…</div>}<div id={id} ref={target}/></div>;
}

export default class OfficePreview extends Component<Props,{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed ? <div className="office-preview-fallback"><p>Live workbook preview unavailable.</p>{this.props.fallback}</div> : <OfficePreviewInner {...this.props}/>;}
}
