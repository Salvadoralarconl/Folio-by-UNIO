import { describe, expect, it } from 'vitest';
import { validName, validateMove, parent, type Entry } from './types';
describe('repository operation guards', () => {
  it('rejects traversal, Windows reserved names, and invalid paths', () => {
    for(const name of ['..','.','a/b','a\\b','CON','com1.txt','a:stream','trailing.',' name','']) expect(validName(name),name).toBe(false);
    for(const name of ['Project proposal.pdf','2026 Budget','Notes.txt']) expect(validName(name),name).toBe(true);
  });
  it('prevents moving a folder into itself or overwriting an existing file', () => {
    expect(() => validateMove('Projects','Projects/Nested/Projects',[])).toThrow();
    expect(() => validateMove('A.txt','B.txt',[{path:'b.txt'} as Entry])).toThrow();
    expect(() => validateMove('A.txt','Archive/A.txt',[])).not.toThrow();
  });
  it('resolves the root and nested parent paths', () => { expect(parent('A.txt')).toBe(''); expect(parent('Projects/Alpha/A.txt')).toBe('Projects/Alpha'); });
});
