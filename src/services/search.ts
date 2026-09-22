import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {extension,type Entry,type Repository,type SearchMatchType} from '../types';

const plainTextExtensions=new Set(['txt','md','csv','json','log','xml','css','js','ts','tsx','jsx','yaml','yml','toml','ini','sql','py','html','htm']);
const cache=new Map<string,Promise<string>>();

function clean(value:string){return value.replace(/\s+/g,' ').trim();}
function xmlText(value:string){return clean(value.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'"));}

async function extractPdf(blob:Blob){
  const lib=await import('pdfjs-dist');
  lib.GlobalWorkerOptions.workerSrc=workerUrl;
  const task=lib.getDocument({data:await blob.arrayBuffer()});
  try{
    const pdf=await task.promise;const pages:string[]=[];
    for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
      const page=await pdf.getPage(pageNumber);const content=await page.getTextContent();
      pages.push(content.items.map(item=>'str' in item?item.str:'').join(' '));
    }
    return clean(pages.join(' '));
  }finally{await task.destroy();}
}

async function extractDocx(blob:Blob){
  const mammoth=await import('mammoth');
  return clean((await mammoth.extractRawText({arrayBuffer:await blob.arrayBuffer()})).value);
}

async function extractWorkbook(blob:Blob){
  const excel=await import('exceljs');const workbook=new excel.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());const values:string[]=[];
  workbook.eachSheet(sheet=>sheet.eachRow(row=>row.eachCell({includeEmpty:false},cell=>{if(cell.text)values.push(cell.text);})));
  return clean(values.join(' '));
}

async function extractArchiveXml(blob:Blob,kind:'pptx'|'ods'){
  const {default:JSZip}=await import('jszip');const zip=await JSZip.loadAsync(await blob.arrayBuffer());
  const paths=Object.keys(zip.files).filter(path=>kind==='pptx'?/^ppt\/slides\/slide\d+\.xml$/.test(path):path==='content.xml').sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const values:string[]=[];for(const path of paths){const file=zip.file(path);if(file)values.push(xmlText(await file.async('string')));}return clean(values.join(' '));
}

export async function extractSearchText(blob:Blob,name:string){
  if(blob.size>50*1024*1024)return '';
  const ext=extension(name);
  if(plainTextExtensions.has(ext))return clean((await blob.text()).slice(0,2_000_000));
  if(ext==='pdf')return extractPdf(blob);
  if(ext==='docx')return extractDocx(blob);
  if(['xlsx','xlsm'].includes(ext))return extractWorkbook(blob);
  if(ext==='pptx')return extractArchiveXml(blob,'pptx');
  if(ext==='ods')return extractArchiveXml(blob,'ods');
  return '';
}

function excerpt(text:string,query:string){
  const index=text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());if(index<0)return '';
  const start=Math.max(0,index-55),end=Math.min(text.length,index+query.length+85);
  return `${start?'…':''}${text.slice(start,end)}${end<text.length?'…':''}`;
}

export async function searchRepository(repo:Repository,department:string,query:string):Promise<Entry[]>{
  const term=query.trim().toLocaleLowerCase();if(!term)return [];
  const entries=await repo.list();const results:Entry[]=[];
  for(const entry of entries){
    const pathMatch=entry.path.toLocaleLowerCase().includes(term);
    if(entry.kind==='folder'){
      if(pathMatch)results.push({...entry,department,searchType:'folder'});
      continue;
    }
    if(pathMatch){results.push({...entry,department,searchType:'file'});continue;}
    const key=`${repo.storageKey||repo.label}:${entry.path}:${entry.size}:${entry.modified}`;
    let content=cache.get(key);if(!content){content=repo.read(entry.path).then(blob=>extractSearchText(blob,entry.name)).catch(()=> '');cache.set(key,content);}
    const text=await content;if(text.toLocaleLowerCase().includes(term))results.push({...entry,department,searchType:'text',searchContext:excerpt(text,query.trim())});
  }
  return results;
}

export const searchOrder:Record<SearchMatchType,number>={folder:0,file:1,text:2};
