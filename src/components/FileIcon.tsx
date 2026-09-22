import { FileText, File, Image } from 'lucide-react';
import { extension } from '../types';
export default function FileIcon({ name, small = false }: { name: string; small?: boolean }) {
  const ext = extension(name);
  const label = ({ pdf:'PDF', doc:'DOC', docx:'DOC', xls:'XLS', xlsx:'XLS', csv:'CSV', ppt:'PPT', pptx:'PPT' } as Record<string,string>)[ext];
  return label ? <span className={`file-icon type-${ext} ${small ? 'small' : ''}`}><span>{label}</span></span> : <span className={`plain-file ${small ? 'small' : ''}`}>{['png','jpg','jpeg','webp','gif','svg'].includes(ext) ? <Image/> : ['txt','md','json'].includes(ext) ? <FileText/> : <File/>}</span>;
}
