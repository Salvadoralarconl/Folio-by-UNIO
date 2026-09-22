import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';

const root='/tmp/folio-converter';
await mkdir(root,{recursive:true});
async function body(req,max=100*1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw Error('File too large');chunks.push(chunk);}return Buffer.concat(chunks);}
function run(input,output){return new Promise((resolve,reject)=>{const child=spawn('soffice',['--headless',`-env:UserInstallation=file://${output}/profile`,'--convert-to','pdf:calc_pdf_Export','--outdir',output,input],{env:{...process.env,HOME:'/tmp/folio-lo-home'}});let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('LibreOffice conversion timed out.'));},120000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);if(code===0)resolve();else reject(Error(stderr||`LibreOffice exited with code ${code}`));});});}
const server=http.createServer(async(req,res)=>{try{if(req.method!=='POST'||req.url!=='/convert'){res.writeHead(404);return res.end();}const name=String(req.headers['x-folio-name']||'workbook.xlsx').replace(/[^a-zA-Z0-9._-]/g,'_');const id=randomBytes(10).toString('hex');const dir=join(root,id);await mkdir(dir,{recursive:true});const input=join(dir,name);const output=join(dir,name.replace(/\.[^.]+$/i,'.pdf'));await writeFile(input,await body(req));await run(input,dir);const pdf=await readFile(output);res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':pdf.length,'Cache-Control':'no-store'});res.end(pdf);await rm(dir,{recursive:true,force:true});}catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}});
server.listen(1422,'0.0.0.0',()=>console.log('Folio LibreOffice converter ready'));
