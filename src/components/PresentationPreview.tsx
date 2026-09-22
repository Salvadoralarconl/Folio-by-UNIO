import {useEffect,useState} from 'react';
import ZoomSurface from './ZoomSurface';
type Shape={x:number;y:number;w:number;h:number;text?:string;image?:string;fontSize?:number;color?:string;bold?:boolean;align?:'left'|'center'|'right'};
type Slide={width:number;height:number;shapes:Shape[];background:string};
const elements=(root:Document|Element,name:string)=>Array.from(root.getElementsByTagNameNS('*',name));
export default function PresentationPreview({blob,page,zoom,width,onPageCount,onError}:{blob:Blob;page:number;zoom:number;width:number;onPageCount:(n:number)=>void;onError:(s:string)=>void}){
  const [slides,setSlides]=useState<Slide[]>([]);
  useEffect(()=>{let cancelled=false;const urls:string[]=[];(async()=>{
    const {default:JSZip}=await import('jszip');const zip=await JSZip.loadAsync(await blob.arrayBuffer());
    const xml=async(path:string)=>new DOMParser().parseFromString(await zip.file(path)!.async('string'),'application/xml');
    const presentation=await xml('ppt/presentation.xml');const size=elements(presentation,'sldSz')[0];
    const w=Number(size?.getAttribute('cx')||9144000)/9525,h=Number(size?.getAttribute('cy')||6858000)/9525;
    const presentationRels=await xml('ppt/_rels/presentation.xml.rels');const lookup=new Map(elements(presentationRels,'Relationship').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')!]));
    const paths=elements(presentation,'sldId').map(e=>lookup.get(e.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'))).filter(Boolean).map(p=>'ppt/'+p);
    const result:Slide[]=[];
    for(const path of paths){const doc=await xml(path);const shapes:Shape[]=[];const relPath=path.replace(/([^/]+)$/,'_rels/$1.rels');const rels=zip.file(relPath)?await xml(relPath):null;
      for(const shape of [...elements(doc,'sp'),...elements(doc,'pic')]){
        const transform=elements(shape,'xfrm')[0];if(!transform)continue;const pos=elements(transform,'off')[0],ext=elements(transform,'ext')[0];
        const box={x:Number(pos?.getAttribute('x')||0)/9525,y:Number(pos?.getAttribute('y')||0)/9525,w:Number(ext?.getAttribute('cx')||0)/9525,h:Number(ext?.getAttribute('cy')||0)/9525};
        const blip=elements(shape,'blip')[0];if(blip&&rels){const id=blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','embed');const rel=elements(rels,'Relationship').find(e=>e.getAttribute('Id')===id&&e.getAttribute('TargetMode')!=='External');if(rel){const target=rel.getAttribute('Target')!;const resolved=new URL(target,'https://local/'+path).pathname.slice(1);const asset=zip.file(resolved);if(asset){const bytes=await asset.async('uint8array');const extension=resolved.split('.').pop();const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:extension==='svg'?'image/svg+xml':extension==='jpg'?'image/jpeg':'image/'+extension}));urls.push(url);shapes.push({...box,image:url});}}}
        else {const paragraphs=elements(shape,'p');const text=paragraphs.map(p=>elements(p,'t').map(t=>t.textContent).join('')).join('\n');const run=elements(shape,'rPr')[0];const rgb=run&&elements(run,'srgbClr')[0]?.getAttribute('val');const alignment=elements(shape,'pPr')[0]?.getAttribute('algn');shapes.push({...box,text,fontSize:Number(run?.getAttribute('sz')||1800)/75,color:rgb?'#'+rgb:'#222',bold:run?.getAttribute('b')==='1',align:alignment==='ctr'?'center':alignment==='r'?'right':'left'});}
      }
      result.push({width:w,height:h,shapes,background:'#fff'});
    }
    if(!cancelled){setSlides(result);onPageCount(result.length);}
  })().catch(e=>{if(!cancelled)onError('Unable to preview this presentation: '+e.message);});return()=>{cancelled=true;urls.forEach(URL.revokeObjectURL);};},[blob]);
  const slide=slides[page-1];if(!slide)return <div className="docx-loading">Opening slides…</div>;
  return <div><div className="preview-limit">Slide preview · Complex themes, charts, and animations may differ.</div><ZoomSurface zoom={zoom} availableWidth={width} naturalWidth={slide.width}><div className="slide-page" style={{width:slide.width,height:slide.height,background:slide.background}}>{slide.shapes.map((s,i)=><div key={i} style={{position:'absolute',left:s.x,top:s.y,width:s.w,height:s.h,fontSize:s.fontSize,color:s.color,fontWeight:s.bold?700:400,textAlign:s.align,whiteSpace:'pre-wrap',overflow:'hidden'}}>{s.image?<img src={s.image} style={{width:'100%',height:'100%',objectFit:'contain'}} alt="Slide illustration"/>:s.text}</div>)}</div></ZoomSurface></div>;
}
