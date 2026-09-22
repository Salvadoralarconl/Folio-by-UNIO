import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Download, Expand, FileQuestion, LoaderCircle, Minus, Plus, Star, X, FileText } from 'lucide-react';
import { extension, formatSize, type Entry, type Repository } from '../types';
import FileIcon from './FileIcon';
import Papa from 'papaparse';
import DocxPreview from './DocxPreview';
import SpreadsheetPreview from './SpreadsheetPreview';
import OfficePreview from './OfficePreview';
import PresentationPreview from './PresentationPreview';
import ZoomSurface from './ZoomSurface';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
interface Props { entry?: Entry; repo: Repository | null; theme: 'light'|'dark'; starred: boolean; canEdit:boolean; onStar: () => void; onOpen: () => void; onDownload: () => void; onError: (s: string) => void; onEdit: () => void; }
export default function PreviewPanel({ entry, repo, theme, starred, canEdit, onStar, onOpen, onDownload, onError, onEdit }: Props) {
  const [blob, setBlob] = useState<Blob>(); const [url, setUrl] = useState(''); const [text, setText] = useState(''); const [table, setTable] = useState<string[][]>([]);
  const [pdf, setPdf] = useState<PDFDocumentProxy>(); const [page, setPage] = useState(1); const [zoom, setZoom] = useState(1); const [loading,setLoading] = useState(false); const [error,setError] = useState(''); const [fullscreen,setFullscreen] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null); const viewport = useRef<HTMLDivElement>(null); const [width,setWidth] = useState(720);
  const ext = entry ? extension(entry.name) : '';
  const isSpreadsheet = ['xlsx','xls','xlsm','xlsb','ods'].includes(ext);
  const isOfficePreview = isSpreadsheet || ext === 'docx';
  const [docxPages,setDocxPages] = useState(0); const [xlsxFallback,setXlsxFallback] = useState(false); const [spreadsheetView,setSpreadsheetView] = useState<'workbook'|'print'>('workbook');
  const pageCount = pdf?.numPages || (['docx','pptx'].includes(ext) ? docxPages : 0);
  useEffect(() => {
    const el = viewport.current; if (!el) return;
    const observer = new ResizeObserver(([size]) => setWidth(size.contentRect.width)); observer.observe(el); return () => observer.disconnect();
  },[]);
  useEffect(() => { const handler = (e: KeyboardEvent) => { if(e.key === 'Escape') setFullscreen(false); }; window.addEventListener('keydown',handler); return () => window.removeEventListener('keydown',handler); },[]);
  useEffect(() => {
    let cancelled = false; let objectUrl = ''; let pdfTask: { destroy(): Promise<void> } | undefined;
    setPdf(undefined); setBlob(undefined); setUrl(''); setText(''); setTable([]); setPage(1); setDocxPages(0); setZoom(1); setError(''); setXlsxFallback(false);
    if (!entry || !repo) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      const content = await repo.read(entry.path); if(cancelled) return;
      if(content.size > 100 * 1024 * 1024) throw new Error('This file is too large for an inline preview. Open it in your desktop app.');
      setBlob(content); objectUrl = URL.createObjectURL(content); setUrl(objectUrl);
      const openPdf = async (data:ArrayBuffer) => { const lib = await import('pdfjs-dist'); lib.GlobalWorkerOptions.workerSrc = workerUrl; const task = lib.getDocument({ data }); pdfTask = task; const document = await task.promise; if(cancelled) { await task.destroy(); return; } setPdf(document); };
      if (ext === 'pdf') await openPdf(await content.arrayBuffer());
      else if (isSpreadsheet && spreadsheetView==='print') { try { const response=await fetch('http://localhost:1421/convert',{method:'POST',headers:{'X-Folio-Request':'preview','X-Folio-Name':encodeURIComponent(entry.name),'Content-Type':'application/octet-stream'},body:content}); if(!response.ok) throw Error((await response.text())||'LibreOffice could not convert this workbook.'); await openPdf(await (await response.blob()).arrayBuffer()); } catch { if(!cancelled) setXlsxFallback(true); } }
      else if (['txt','md','json','log','xml','css','js','ts','tsx','jsx','yaml','yml','toml','ini','sql','py','html','htm'].includes(ext)) { const value = await content.text(); if(!cancelled) setText(value.slice(0,500000)); }
      else if (ext === 'csv') { const result = Papa.parse<string[]>(await content.text(), { skipEmptyLines: true, preview: 501 }); if(!cancelled) setTable(result.data); }

    })().catch(e => { if(!cancelled) setError(String(e.message || e)); }).finally(() => { if(!cancelled) setLoading(false); });
    return () => { cancelled = true; if(objectUrl) URL.revokeObjectURL(objectUrl); if(pdfTask) void pdfTask.destroy(); };
  },[entry?.path, entry?.modified, repo, spreadsheetView]);
  useEffect(() => { setSpreadsheetView('workbook'); }, [entry?.path]);
  useEffect(() => {
    if(!pdf || !canvas.current || loading) return;
    let cancelled = false; let task: { cancel(): void; promise: Promise<void> } | undefined;
    pdf.getPage(page).then(p => {
      if(cancelled || !canvas.current) return;
      const base = p.getViewport({scale:1}); const scale = Math.max(0.2,(width - 64) / base.width) * zoom; const ratio = Math.min(window.devicePixelRatio || 1,2);
      const view = p.getViewport({scale:scale * ratio}); const el = canvas.current; el.width=view.width; el.height=view.height; el.style.width=`${view.width/ratio}px`; el.style.height=`${view.height/ratio}px`;
      task = p.render({ canvas: el, canvasContext: el.getContext('2d')!, viewport:view }); return task.promise;
    }).catch(e => { if(!cancelled && e.name !== 'RenderingCancelledException') setError('Unable to render this page. Try opening the original file.'); });
    return () => { cancelled = true; task?.cancel(); };
  },[pdf,page,zoom,width,loading]);
  const image = ['png','jpg','jpeg','webp','gif','bmp','svg','avif'].includes(ext);
  return <section className={`preview-panel ${fullscreen ? 'fullscreen' : ''}`}><div className="panel-heading preview-heading"><div><h1>Preview</h1><span className="preview-heading-note">A closer look, without the extra tabs.</span></div><div className="preview-actions">{entry && <><button className={`icon-button ${starred ? 'is-starred' : ''}`} aria-label={starred ? 'Remove from favorites' : 'Add to favorites'} onClick={onStar}><Star size={18} fill={starred ? 'currentColor' : 'none'}/></button>{canEdit&&['docx','xlsx','pptx'].includes(ext) && <button className="open-button" onClick={onEdit}>Edit</button>}<button className="open-button" onClick={onOpen}>Open file <ArrowUpRight size={15}/></button></>}{fullscreen && <button className="icon-button" aria-label="Close fullscreen" onClick={() => setFullscreen(false)}><X size={20}/></button>}</div></div>
    <div className="preview-frame"><div className="preview-toolbar"><div className="preview-filename">{entry && <><FileIcon name={entry.name} small/><span title={entry.name}>{entry.name}</span></>}</div>{entry && <div className="document-controls">{isOfficePreview && <div className="preview-view-switch" role="group" aria-label={`${ext==='docx'?'Document':'Spreadsheet'} preview mode`}><button className={spreadsheetView==='workbook'?'active':''} onClick={() => setSpreadsheetView('workbook')}>{ext==='docx'?'Document':'Workbook'}</button><button className={spreadsheetView==='print'?'active':''} onClick={() => setSpreadsheetView('print')}>Print</button></div>}{pageCount > 0 && <><button className="icon-button" aria-label="Previous page" disabled={page<=1} onClick={() => setPage(p => p-1)}><ChevronLeft size={18}/></button><span className="page-number">{page} <span>/ {pageCount}</span></span><button className="icon-button" aria-label="Next page" disabled={page>=pageCount} onClick={() => setPage(p => p+1)}><ChevronRight size={18}/></button><span className="toolbar-divider"/></>}{(!isOfficePreview || spreadsheetView==='print') && <><button className="icon-button" aria-label="Zoom out" disabled={zoom<=0.25} onClick={() => setZoom(z => Math.max(.25,Math.round((z-.25)*100)/100))}><Minus size={16}/></button><button className="zoom-label" title="Fit to width" aria-label="Reset zoom to fit" onClick={() => setZoom(1)}>{Math.round(zoom*100)}%</button><button className="icon-button" aria-label="Zoom in" disabled={zoom>=3} onClick={() => setZoom(z => Math.min(3,Math.round((z+.25)*100)/100))}><Plus size={16}/></button><span className="toolbar-divider"/></>}<button className="icon-button" aria-label={fullscreen ? "Exit fullscreen preview" : "Fullscreen preview"} title={fullscreen ? "Exit fullscreen preview (Esc)" : "Fullscreen preview — more room to read"} onClick={() => setFullscreen(f => !f)}>{fullscreen ? <X size={17}/> : <Expand size={17}/>}</button></div>}</div>
      <div className={`document-viewport ${image ? 'image-viewport' : ''}`} ref={viewport}>
        {!entry ? <div className="preview-empty"><div className="empty-icon"><FileText size={30}/></div><h2>A little room to focus.</h2><p>Select a file to see it here.</p><span>Your documents, right where you left them.</span></div> : loading ? <div className="preview-empty"><LoaderCircle className="spinner" size={27}/><p>Opening your document…</p></div> : error ? <div className="preview-empty"><FileQuestion size={34}/><h2>Couldn’t preview this file</h2><p>{error}</p><button className="open-button" onClick={onOpen}>Open original <ArrowUpRight size={15}/></button></div> : pdf ? <canvas className="pdf-page" ref={canvas} aria-label={`Page ${page} of ${pdf.numPages}`}/> : isSpreadsheet && blob && spreadsheetView==='workbook' ? <OfficePreview key={`${entry.path}-${entry.modified}-${theme}`} entry={entry} repo={repo!} theme={theme} fallback={<SpreadsheetPreview blob={blob} zoom={zoom} width={width} onError={setError}/>} /> : ext==='docx' && blob && spreadsheetView==='workbook' ? <OfficePreview key={`${entry.path}-${entry.modified}-${theme}`} entry={entry} repo={repo!} theme={theme} fallback={<DocxPreview key={entry.path} blob={blob} zoom={zoom} width={width} page={page} onPageCount={setDocxPages} onError={setError}/>} /> : isSpreadsheet && blob ? xlsxFallback ? <SpreadsheetPreview blob={blob} zoom={zoom} width={width} onError={setError}/> : <div className="docx-loading">Rendering workbook preview…</div> : ext === 'pptx' && blob ? <PresentationPreview key={entry.path} blob={blob} page={page} zoom={zoom} width={width} onPageCount={setDocxPages} onError={setError}/> : ext === 'docx' && blob ? <DocxPreview key={entry.path} blob={blob} zoom={zoom} width={width} page={page} onPageCount={setDocxPages} onError={setError}/> : image ? <img className="image-preview" src={url} style={{width:`${zoom*85}%`}} alt={entry.name} onError={() => setError('This image format could not be displayed.')}/> : ext === 'csv' ? <ZoomSurface zoom={zoom} availableWidth={width} naturalWidth={Math.max(600,width-40)} fit={false}><div className="spreadsheet-wrap"><table className="spreadsheet"><thead><tr><th/> {table[0]?.map((_,i) => <th key={i}>{String.fromCharCode(65+i)}</th>)}</tr></thead><tbody>{table.map((row,i) => <tr key={i}><th>{i+1}</th>{row.map((cell,j) => <td key={j} className={i===0 ? 'table-header' : ''}>{cell}</td>)}</tr>)}</tbody></table>{table.length>=501 && <p className="preview-limit">Showing the first 500 rows.</p>}</div></ZoomSurface> : text || ['txt','md','json','log','xml','css','js','ts','tsx','jsx','yaml','yml','toml','ini','sql','py','html','htm'].includes(ext) ? <ZoomSurface zoom={zoom} availableWidth={width} naturalWidth={Math.max(300,width-40)} fit={false}><div className="text-document"><pre>{text || 'This document is empty.'}</pre></div></ZoomSurface> : <div className="preview-empty"><FileIcon name={entry.name}/><h2>Preview unavailable</h2><p>This file is safely stored in your workspace.<br/>Open it in its usual app to take a look.</p>{['docx','xlsx','pptx'].includes(ext) && <button className="open-button" onClick={onEdit}>Edit</button>}<button className="open-button" onClick={onOpen}>Open file <ArrowUpRight size={15}/></button></div>}
      </div><div className="preview-status"><span><span className="status-dot"/>{entry ? repo?.storageKey?.startsWith('server:')?'Stored on Folio server':'Stored locally' : 'Private by default'}</span>{entry && <span>{formatSize(blob?.size ?? entry.size)}<span className="footer-dot">·</span><button onClick={onDownload} title="Download original"><Download size={13}/> Download</button></span>}</div>
    </div><div className="preview-bottom-note">A place for your files. Space for your thoughts.</div>
  </section>;
}
