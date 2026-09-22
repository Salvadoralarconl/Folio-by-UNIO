import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// Reserve the scaled dimensions so zoom never clips the left edge or overlaps
// the next page. The source layout remains unchanged while magnification changes.
export default function ZoomSurface({ children, zoom, availableWidth, naturalWidth = 816, fit = true }: {
  children: ReactNode; zoom: number; availableWidth: number; naturalWidth?: number; fit?: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  const [height,setHeight] = useState(0);
  const scale = (fit ? Math.min(1, Math.max(180,availableWidth - 40) / naturalWidth) : 1) * zoom;
  useLayoutEffect(() => {
    if(!content.current) return;
    const observer = new ResizeObserver(() => setHeight(content.current?.offsetHeight || 0));
    observer.observe(content.current); return () => observer.disconnect();
  },[]);
  return <div className="zoom-surface" style={{width:naturalWidth * scale,height:height * scale}}>
    <div ref={content} className="zoom-content" style={{width:naturalWidth,transform:`scale(${scale})`}}>{children}</div>
  </div>;
}
