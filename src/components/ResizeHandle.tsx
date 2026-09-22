import type { PointerEvent } from 'react';
export default function ResizeHandle({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  function start(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault(); const x = e.clientX, initial = value; e.currentTarget.setPointerCapture(e.pointerId);
    const target = e.currentTarget;
    const move = (event: globalThis.PointerEvent) => onChange(Math.min(420, Math.max(190, initial + event.clientX - x)));
    const end = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', end); target.removeEventListener('pointercancel', end); };
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', end); target.addEventListener('pointercancel', end);
  }
  return <div className="resize-handle" role="separator" aria-label={label} aria-orientation="vertical" aria-valuenow={value} aria-valuemin={190} aria-valuemax={420} tabIndex={0} onPointerDown={start} onKeyDown={e => { if (['ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); onChange(Math.max(190,Math.min(420,value + (e.key === 'ArrowLeft' ? -10 : 10)))); } }}/>
}
