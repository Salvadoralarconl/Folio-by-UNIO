import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('bridge status permits header-only reads while writes keep origin authorization',async t=>{
  const data=await mkdtemp(path.join(tmpdir(),'folio-bridge-'));
  const port=20000+Math.floor(Math.random()*10000),base=`http://127.0.0.1:${port}`;
  const bridge=spawn(process.execPath,['office/server.mjs'],{cwd:path.resolve('.'),env:{...process.env,JWT_SECRET:'integration-test-secret',FOLIO_EDITOR_DATA:data,PORT:String(port)},stdio:'ignore'});
  t.after(async()=>{bridge.kill();await rm(data,{recursive:true,force:true});});
  for(let attempt=0;attempt<50;attempt++){try{await fetch(base+'/not-found');break;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}

  const trustedOrigin='https://folio.getunio.dev';
  let response=await fetch(base+'/sessions',{method:'POST',headers:{Origin:trustedOrigin,'X-Folio-Request':'editor','X-Folio-Name':'test.docx','Content-Type':'application/octet-stream'},body:Buffer.from('test document')});
  assert.equal(response.status,200);
  const {id}=await response.json();

  response=await fetch(`${base}/status/${id}`,{headers:{'X-Folio-Request':'editor'}});
  assert.equal(response.status,200);
  assert.equal((await response.json()).revision,0);

  response=await fetch(`${base}/status/${id}`);
  assert.equal(response.status,403);
  assert.equal((await response.json()).error,'Request denied');

  response=await fetch(`${base}/status/${id}`,{headers:{Origin:'https://attacker.example','X-Folio-Request':'editor'}});
  assert.equal(response.status,403);
  assert.equal((await response.json()).error,'Origin denied');

  response=await fetch(`${base}/save/${id}`,{method:'POST',headers:{'X-Folio-Request':'editor'}});
  assert.equal(response.status,403);
  assert.equal((await response.json()).error,'Request denied');

  response=await fetch(`${base}/save/${id}`,{method:'POST',headers:{Origin:trustedOrigin}});
  assert.equal(response.status,403);
  assert.equal((await response.json()).error,'Request denied');

  response=await fetch(`${base}/save/${id}`,{method:'POST',headers:{Origin:'https://attacker.example','X-Folio-Request':'editor'}});
  assert.equal(response.status,403);
  assert.equal((await response.json()).error,'Origin denied');
});
