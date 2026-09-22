import http from 'node:http';
import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
const secret=process.env.JWT_SECRET;
if(!secret)throw new Error('JWT_SECRET is required');
const origins=new Set(['https://folio.getunio.dev','http://localhost:1420','http://127.0.0.1:1420','http://tauri.localhost','tauri://localhost']);
const base='/data';await mkdir(base,{recursive:true});
const sign=payload=>{const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const body=Buffer.from(JSON.stringify(payload)).toString('base64url');const data=header+'.'+body;return data+'.'+createHmac('sha256',secret).update(data).digest('base64url');};
function verify(token){const parts=String(token||'').split('.');if(parts.length!==3)throw Error('Invalid signature');const expected=createHmac('sha256',secret).update(parts[0]+'.'+parts[1]).digest();const received=Buffer.from(parts[2],'base64url');if(received.length!==expected.length||!timingSafeEqual(received,expected))throw Error('Invalid signature');const header=JSON.parse(Buffer.from(parts[0],'base64url'));if(header.alg!=='HS256')throw Error('Invalid algorithm');return JSON.parse(Buffer.from(parts[1],'base64url'));}
async function body(req,max=100*1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw Error('File too large');chunks.push(chunk);}return Buffer.concat(chunks);}
async function atomic(path,data){const temp=path+'.'+randomBytes(8).toString('hex')+'.tmp';await writeFile(temp,data);await rename(temp,path);}
const metaPath=id=>`${base}/${id}.json`, filePath=id=>`${base}/${id}.bin`;
async function session(id){if(!/^[a-f0-9]{48}$/.test(id))throw Error('Invalid session');return JSON.parse(await readFile(metaPath(id),'utf8'));}
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://bridge:1421');const origin=req.headers.origin;
  const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
    if(origin){if(!origins.has(origin))return json({error:'Origin denied'},403);res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Folio-Request,X-Folio-Name,X-Folio-Theme');res.writeHead(204);return res.end();}
    if(url.pathname==='/health'){const response=await fetch('http://documentserver/healthcheck',{signal:AbortSignal.timeout(4000)});return json({ready:response.ok&&(await response.text()).trim()==='true'});}
    if(url.pathname==='/convert'&&req.method==='POST'){
      if(!origin||req.headers['x-folio-request']!=='preview')return json({error:'Request denied'},403);
      const name=decodeURIComponent(String(req.headers['x-folio-name']||'workbook.xlsx'));const ext=name.split('.').pop()?.toLowerCase();
      if(!['xlsx','xls','xlsm','xlsb','ods'].includes(ext))return json({error:'Only spreadsheet files can be converted.'},400);
      const response=await fetch('http://converter:1422/convert',{method:'POST',headers:{'X-Folio-Name':name,'Content-Type':'application/octet-stream'},body:await body(req)});
      if(!response.ok)throw Error((await response.text())||'LibreOffice could not convert this workbook.');
      const pdf=Buffer.from(await response.arrayBuffer());res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':pdf.length,'Cache-Control':'no-store'});return res.end(pdf);
    }
    if(url.pathname==='/sessions'&&req.method==='POST'){
      if(!origin||req.headers['x-folio-request']!=='editor')return json({error:'Request denied'},403);
      const name=decodeURIComponent(String(req.headers['x-folio-name']||''));const ext=name.split('.').pop()?.toLowerCase();const viewOnly=url.searchParams.get('mode')==='view';const editorTheme=String(req.headers['x-folio-theme']||'light')==='dark'?'theme-dark':'theme-light';
      if(!['docx','xlsx','pptx'].includes(ext))throw Error('Editing currently supports DOCX, XLSX and PPTX');
      const bytes=await body(req);const id=randomBytes(24).toString('hex');const meta={id,name,ext,key:randomBytes(24).toString('hex'),revision:0};
      await atomic(filePath(id),bytes);await atomic(metaPath(id),JSON.stringify(meta));
      const config={document:{fileType:ext,key:meta.key,title:name,url:`http://bridge:1421/document/${id}`,permissions:{edit:!viewOnly,download:true,print:true}},documentType:ext==='xlsx'?'cell':ext==='pptx'?'slide':'word',editorConfig:{mode:viewOnly?'view':'edit',lang:'en',callbackUrl:`http://bridge:1421/callback/${id}`,user:{id:'folio-local',name:'Folio'},customization:{forcesave:true,autosave:true,uiTheme:editorTheme}},height:'100%',width:'100%'};
      return json({id,config:{...config,token:sign(config)}});
    }
    const match=url.pathname.match(/^\/(document|callback|status|saved|save)\/([a-f0-9]{48})$/);if(!match)return json({error:'Not found'},404);
    const [,action,id]=match;let meta=await session(id);
    if(action==='callback'&&req.method==='POST'){
      const raw=JSON.parse((await body(req,1024*1024)).toString());const token=raw.token||String(req.headers.authorization||'').replace(/^Bearer /,'');const signed=verify(token);const data=signed.payload||signed;
      if(data.key!==meta.key)throw Error('Document key mismatch');
      if([2,6].includes(data.status)){
        const source=new URL(data.url);if(source.protocol!=='http:')throw Error('Unexpected document download URL');
        if(['localhost','127.0.0.1'].includes(source.hostname)&&source.port==='8080'){source.hostname='documentserver';source.port='';}
        if(source.hostname!=='documentserver'||source.port)throw Error('Unexpected document download URL');
        const response=await fetch(source,{redirect:'error',signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Document download failed');
        const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>100*1024*1024)throw Error('Saved file exceeds limit');
        await atomic(filePath(id),bytes);meta.revision++;meta.savedAt=Date.now();await atomic(metaPath(id),JSON.stringify(meta));
      }
      return json({error:0});
    }
    if(action==='document'||action==='saved'){const bytes=await readFile(filePath(id));res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});return res.end(bytes);}
    if(!origin||req.headers['x-folio-request']!=='editor')return json({error:'Request denied'},403);
    if(action==='status')return json({revision:meta.revision,savedAt:meta.savedAt});
    if(action==='save'&&req.method==='POST'){const command={c:'forcesave',key:meta.key};const response=await fetch('http://documentserver/coauthoring/CommandService.ashx',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...command,token:sign(command)})});return json(await response.json());}
    return json({error:'Not found'},404);
  }catch(error){console.error(error.message);return json({error:error.message},500);}
});
server.listen(1421,'0.0.0.0',()=>console.log('Folio editor bridge ready'));
