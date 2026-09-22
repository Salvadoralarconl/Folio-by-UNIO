import { useState } from 'react';
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => { try { return JSON.parse(localStorage.getItem('folio.' + key) || 'null') ?? initial; } catch { return initial; } });
  const update = (next: T | ((previous: T) => T)) => setValue(previous => { const result = typeof next === 'function' ? (next as (p: T) => T)(previous) : next; try { localStorage.setItem('folio.' + key, JSON.stringify(result)); } catch { /* Storage may be unavailable in private browsing. */ } return result; });
  return [value, update] as const;
}
