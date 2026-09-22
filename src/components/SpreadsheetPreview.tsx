import { useEffect, useState, type CSSProperties } from 'react';
import type { Workbook, Worksheet, Cell } from 'exceljs';
import ZoomSurface from './ZoomSurface';

function color(value: {argb?:string} | undefined) { return value?.argb ? '#'+value.argb.slice(-6) : undefined; }
function cellStyle(cell: Cell): CSSProperties {
  const fill = cell.fill;
  return { fontWeight:cell.font?.bold ? 700:400,fontStyle:cell.font?.italic?'italic':undefined,
    color:color(cell.font?.color), background:fill?.type==='pattern'?color(fill.fgColor):undefined,
    textAlign:cell.alignment?.horizontal==='center'?'center':cell.alignment?.horizontal==='right'?'right':'left',
    whiteSpace:cell.alignment?.wrapText?'pre-wrap':'nowrap',fontSize:cell.font?.size?`${cell.font.size}px`:undefined };
}
function display(cell: Cell) {
  const value=cell.value;
  if(value instanceof Date) return value.toLocaleDateString();
  let number = typeof value==='number'?value:typeof value==='object' && value && 'result' in value && typeof value.result==='number'?value.result:undefined;
  if(number!==undefined) {
    if(cell.numFmt?.includes('%')) return (number*100).toLocaleString(undefined,{maximumFractionDigits:2})+'%';
    if(cell.numFmt?.includes('$')) return number.toLocaleString(undefined,{style:'currency',currency:'USD'});
    return number.toLocaleString(undefined,{maximumFractionDigits:8});
  }
  return cell.text || (typeof value==='object' && value && 'formula' in value ? '='+value.formula : '');
}
export default function SpreadsheetPreview({blob,zoom,width,onError}:{blob:Blob;zoom:number;width:number;onError:(s:string)=>void}) {
  const [book,setBook]=useState<Workbook>(); const [active,setActive]=useState(0);
  useEffect(()=>{let cancelled=false; (async()=>{ const lib=await import('exceljs'); const workbook=new lib.Workbook(); await workbook.xlsx.load(await blob.arrayBuffer()); if(!cancelled){setBook(workbook);setActive(0);} })().catch(e=>{if(!cancelled)onError('Unable to read this workbook: '+e.message);});return()=>{cancelled=true;};},[blob]);
  if(!book) return <div className="docx-loading">Opening workbook…</div>;
  const sheets=book.worksheets.filter(s=>s.state!=='veryHidden'); const sheet:Worksheet|undefined=sheets[active];
  if(!sheet)return <div className="preview-empty">This workbook has no worksheets.</div>;
  const rows=Math.min(sheet.rowCount,500), cols=Math.min(sheet.columnCount,50);
  const widths=Array.from({length:cols},(_,i)=>Math.max(75,Math.min(350,(sheet.getColumn(i+1).width||12)*7)));
  return <div className="workbook-preview"><div className="sheet-tabs" role="tablist" aria-label="Worksheets">{sheets.map((s,i)=><button role="tab" aria-selected={i===active} key={s.id} onClick={()=>setActive(i)}>{s.name}</button>)}</div>
    <ZoomSurface zoom={zoom} availableWidth={width} naturalWidth={Math.max(400,widths.reduce((a,b)=>a+b,40))} fit={false}><table className="spreadsheet workbook-table"><colgroup><col style={{width:40}}/>{widths.map((w,i)=><col key={i} style={{width:w}}/>)}</colgroup><thead><tr><th/>{widths.map((_,i)=><th key={i}>{sheet.getColumn(i+1).letter}</th>)}</tr></thead><tbody>{Array.from({length:rows},(_,r)=><tr key={r} style={{height:sheet.getRow(r+1).height ? sheet.getRow(r+1).height*1.33:undefined}}><th>{r+1}</th>{widths.map((_,c)=>{const cell=sheet.getCell(r+1,c+1);return <td key={c} title={cell.formula?'='+cell.formula:undefined} style={cellStyle(cell)}>{cell.isMerged && cell.master.address!==cell.address?'':display(cell)}</td>;})}</tr>)}</tbody></table></ZoomSurface>
    {(sheet.rowCount>500||sheet.columnCount>50)&&<p className="preview-limit">Preview limited to 500 rows and 50 columns.</p>}</div>;
}
