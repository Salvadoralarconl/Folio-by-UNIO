import {useRef,useState} from 'react';
import {FilePlus2,FileText,Pencil,Presentation,Table2,Trash2,Upload} from 'lucide-react';
import {templateLabel,type DocumentTemplate,type TemplateKind} from '../services/templates';
import {formatSize} from '../types';

export default function TemplateSettings({templates,onCreate,onUpload,onEdit,onRemove}:{templates:DocumentTemplate[];onCreate:(name:string,kind:TemplateKind)=>Promise<void>;onUpload:(files:File[])=>Promise<void>;onEdit:(template:DocumentTemplate)=>void;onRemove:(id:string)=>Promise<void>}){
  const [name,setName]=useState('');const [kind,setKind]=useState<TemplateKind>('docx');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const input=useRef<HTMLInputElement>(null);
  const icon=(value:TemplateKind)=>value==='xlsx'?<Table2 size={17}/>:value==='pptx'?<Presentation size={17}/>:<FileText size={17}/>;
  async function create(){setBusy(true);setError('');try{await onCreate(name,kind);setName('');}catch(reason){setError((reason as Error).message);}finally{setBusy(false);}}
  async function upload(files:File[]){setBusy(true);setError('');try{await onUpload(files);}catch(reason){setError((reason as Error).message);}finally{setBusy(false);}}
  return <div className="settings-section template-settings"><div className="section-heading"><div><h3>Templates</h3><p>Create reusable Office files. Choosing one from + makes an ordinary editable copy.</p></div><button className="secondary-button" disabled={busy} onClick={()=>input.current?.click()}><Upload size={14}/>Upload template</button></div>
    <input ref={input} hidden multiple type="file" accept=".docx,.xlsx,.pptx" onChange={event=>{void upload(Array.from(event.target.files||[]));event.target.value='';}}/>
    <div className="template-create"><input aria-label="Template name" placeholder="Template name" value={name} onChange={event=>setName(event.target.value)}/><select aria-label="Template type" value={kind} onChange={event=>setKind(event.target.value as TemplateKind)}><option value="docx">Word document</option><option value="xlsx">Excel workbook</option><option value="pptx">PowerPoint presentation</option></select><button className="primary-button" disabled={busy||!name.trim()} onClick={()=>void create()}><FilePlus2 size={14}/>Create</button></div>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <div className="template-list">{templates.map(template=><div className="template-row" key={template.id}><span className={`template-kind kind-${template.kind}`}>{icon(template.kind)}</span><div><strong>{templateLabel(template)}</strong><span>{template.kind.toUpperCase()} · {formatSize(template.file.size)}</span></div><button className="secondary-button template-edit" onClick={()=>onEdit(template)}><Pencil size={13}/>Edit</button><button className="icon-button danger" aria-label={`Remove ${templateLabel(template)}`} onClick={()=>void onRemove(template.id)}><Trash2 size={15}/></button></div>)}{!templates.length&&<div className="template-empty">No templates yet. Create a blank one or upload an existing Office file.</div>}</div>
  </div>;
}
