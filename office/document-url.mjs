const unexpected=()=>new Error('Unexpected document download URL');

export function internalDocumentUrl(value){
  let source;
  try{source=new URL(String(value));}catch{throw unexpected();}
  if(source.username||source.password||source.hash)throw unexpected();

  const internal=source.protocol==='http:'&&source.hostname==='documentserver'&&!source.port;
  const local=source.protocol==='http:'&&['localhost','127.0.0.1'].includes(source.hostname)&&source.port==='8080';
  const production=source.protocol==='https:'&&source.hostname==='office.getunio.dev'&&!source.port;
  if(!internal&&!local&&!production)throw unexpected();

  if(!internal){source.protocol='http:';source.hostname='documentserver';source.port='';}
  return source;
}
