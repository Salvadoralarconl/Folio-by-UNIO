import { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import ZoomSurface from './ZoomSurface';

const frameDocument = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; font-src data: blob:; style-src 'unsafe-inline';"><style>
html,body{margin:0;padding:0;background:transparent;overflow:hidden}#document{width:max-content;min-width:100%}
.folio-word-wrapper{background:transparent!important;padding:0!important;display:flex!important;flex-direction:column;align-items:flex-start;gap:24px}
.folio-word-wrapper>section.folio-word{margin:0!important;box-shadow:none!important;flex-shrink:0;background:#fff}
</style></head><body><div id="styles"></div><main id="document"></main></body></html>`;

export default function DocxPreview({ blob, zoom, width, page, onPageCount, onError }: {blob:Blob;zoom:number;width:number;page:number;onPageCount:(count:number)=>void;onError:(message:string)=>void}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready,setReady] = useState(false); const [loading,setLoading] = useState(true);
  const currentPage = useRef(page); currentPage.current = page;
  const [dimensions,setDimensions] = useState({width:816,height:1056});
  useEffect(() => {
    if(!ready || !frame.current?.contentDocument) return;
    let cancelled = false;
    const doc = frame.current.contentDocument;
    const body = doc.getElementById('document')!; const styles = doc.getElementById('styles')!;
    setLoading(true);
    const observer = new ResizeObserver(() => {
      if(cancelled) return;
      const sections = Array.from(body.querySelectorAll<HTMLElement>('section.folio-word'));
      const naturalWidth = Math.max(1,...sections.map(el => el.offsetWidth));
      setDimensions({width:naturalWidth > 1 ? naturalWidth : 816,height:Math.max(body.scrollHeight,body.offsetHeight,1)});
    });
    const stopNavigation = (event: MouseEvent) => { if((event.target as Element)?.closest('a')) event.preventDefault(); };
    doc.addEventListener('click',stopNavigation);
    (async () => {
      const {renderAsync} = await import('docx-preview');
      const data = await blob.arrayBuffer(); if(cancelled) return;
      await renderAsync(data,body,styles,{
        className:'folio-word', inWrapper:true, ignoreWidth:false, ignoreHeight:false,
        ignoreFonts:false, breakPages:true, ignoreLastRenderedPageBreak:false,
        renderHeaders:true, renderFooters:true, renderFootnotes:true, renderEndnotes:true,
        renderAltChunks:false, useBase64URL:true, experimental:true,
      });
      if(cancelled) return;
      const sections = Array.from(body.querySelectorAll<HTMLElement>('section.folio-word'));
      sections.forEach((section,index) => {
        // OOXML permits omitted page settings; use Word's letter-page defaults.
        if(!section.style.width) section.style.width = '816px';
        if(!section.style.minHeight && !section.style.height) section.style.minHeight = '1056px';
        if(!section.style.padding && !section.style.paddingTop) section.style.padding = '72px';
        section.style.display = index === currentPage.current - 1 ? '' : 'none';
      });
      onPageCount(Math.max(1,sections.length));
      await doc.fonts.ready;
      observer.observe(body); setLoading(false);
    })().catch(e => { if(!cancelled) onError(`Unable to render this Word document: ${e.message || e}`); });
    return () => { cancelled=true; observer.disconnect(); doc.removeEventListener('click',stopNavigation); };
  },[blob,ready]);
  useEffect(() => {
    frame.current?.contentDocument?.querySelectorAll<HTMLElement>('section.folio-word').forEach((section,index) => {
      section.style.display = index === page - 1 ? '' : 'none';
    });
  },[page]);
  return <div className="docx-preview">
    {loading && <div className="docx-loading" role="status"><LoaderCircle size={24} className="spinner"/> Rendering document…</div>}
    <div style={{visibility:loading?'hidden':'visible'}}><ZoomSurface zoom={zoom} availableWidth={width} naturalWidth={dimensions.width}>
      <iframe ref={frame} title="Formatted Word document" className="docx-frame" sandbox="allow-same-origin" srcDoc={frameDocument} onLoad={() => setReady(true)} style={{width:dimensions.width,height:dimensions.height}}/>
    </ZoomSurface></div>
  </div>;
}
