import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('server sessions, permissions, document workflows, and recovery',async t=>{
  const data=await mkdtemp(path.join(tmpdir(),'folio-server-')),port=19000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
  const process=spawn(globalThis.process.execPath,['server/server.mjs'],{cwd:path.resolve('.'),env:{...globalThis.process.env,FOLIO_DATA:data,PORT:String(port)},stdio:'ignore'});
  t.after(async()=>{process.kill();await rm(data,{recursive:true,force:true});});
  for(let attempt=0;attempt<50;attempt++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}
  let cookie='';
  async function call(route,options={}){const response=await fetch(base+route,{...options,headers:{...(options.body instanceof Blob?{}:{'content-type':'application/json'}),...(cookie?{cookie}:{}),...options.headers}}),setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];const contentType=response.headers.get('content-type')||'',value=contentType.includes('json')?await response.json():await response.text();return {response,value};}
  let result=await call('/api/setup',{method:'POST',body:JSON.stringify({name:'Admin',email:'admin@example.com',password:'password123'})});assert.equal(result.response.status,201);
  result=await call('/api/users',{method:'POST',body:JSON.stringify({name:'Finance editor',email:'finance@example.com',password:'password123',role:'editor',departments:['Finance']})});assert.equal(result.response.status,201);
  await call('/api/logout',{method:'POST'});cookie='';result=await call('/api/login',{method:'POST',body:JSON.stringify({email:'finance@example.com',password:'password123',remember:false})});assert.equal(result.response.status,200);
  result=await call('/api/files?department=General');assert.equal(result.response.status,403);
  result=await call('/api/files/content?department=Finance&path=Budget.txt',{method:'PUT',headers:{'content-type':'text/plain'},body:'first'});assert.equal(result.response.status,201);
  result=await call('/api/folders',{method:'POST',body:JSON.stringify({department:'Finance',path:'Client Website'})});assert.equal(result.response.status,201);
  result=await call('/api/files/content?department=Finance&path=Client%20Website%2FNotes.txt',{method:'PUT',headers:{'content-type':'text/plain'},body:'nested content'});assert.equal(result.response.status,201);
  result=await call('/api/files/move',{method:'POST',body:JSON.stringify({fromDepartment:'Finance',toDepartment:'Finance',from:'Client Website',to:'Client Portal'})});assert.equal(result.response.status,200);
  result=await call('/api/files/content?department=Finance&path=Client%20Portal%2FNotes.txt');assert.equal(result.value,'nested content');
  await call('/api/files/content?department=Finance&path=Budget.txt&replace=1',{method:'PUT',headers:{'content-type':'text/plain'},body:'second'});
  await call('/api/metadata',{method:'PUT',body:JSON.stringify({department:'Finance',path:'Budget.txt',metadata:{tags:[],description:'Annual plan',status:'draft'}})});
  result=await call('/api/versions?department=Finance&path=Budget.txt');assert.equal(result.value.versions.length,1);
  const versionId=result.value.versions[0].id;
  result=await call(`/api/versions/${versionId}`);assert.equal(result.value,'first');
  result=await call('/api/tags',{method:'POST',body:JSON.stringify({department:'Finance',name:'Budget',color:'#123456'})});assert.equal(result.value.tags[0].name,'Budget');
  const tagId=result.value.tags[0].id;
  result=await call(`/api/tags/${tagId}`,{method:'PATCH',body:JSON.stringify({department:'Finance',name:'Planning',color:'#654321'})});assert.equal(result.value.tags[0].name,'Planning');
  result=await call('/api/tags',{method:'POST',body:JSON.stringify({department:'Finance',name:'Forecast',color:'#abcdef'})});const mergedTagId=result.value.tags.find(tag=>tag.name==='Forecast').id;
  result=await call(`/api/tags/${mergedTagId}`,{method:'PATCH',body:JSON.stringify({department:'Finance',name:'Planning'})});assert.equal(result.value.tags.length,1);
  result=await call('/api/comments',{method:'POST',body:JSON.stringify({department:'Finance',path:'Budget.txt',text:'Please review this plan.'})});assert.equal(result.response.status,201);
  const commentId=result.value.comment.id;
  result=await call(`/api/comments/${commentId}`,{method:'PATCH',body:JSON.stringify({text:'Reviewed note.',resolved:true})});assert.equal(result.value.comment.resolved,true);
  result=await call(`/api/comments/${commentId}`,{method:'DELETE',body:'{}'});assert.equal(result.response.status,200);
  result=await call('/api/approvals',{method:'POST',body:JSON.stringify({department:'Finance',path:'Budget.txt'})});assert.equal(result.value.approval.status,'pending');
  const approvalId=result.value.approval.id;
  await call('/api/logout',{method:'POST'});cookie='';await call('/api/login',{method:'POST',body:JSON.stringify({email:'admin@example.com',password:'password123',remember:false})});
  result=await call('/api/approval-config?department=Finance');assert.equal(result.value.config.dueDays,7);
  result=await call(`/api/approvals/${approvalId}`,{method:'PATCH',body:JSON.stringify({status:'approved',response:'Approved in integration test.'})});assert.equal(result.value.approval.status,'approved');
  result=await call(`/api/tags/${tagId}`,{method:'DELETE',body:JSON.stringify({department:'Finance'})});assert.equal(result.value.tags.length,0);
  await call('/api/files',{method:'DELETE',body:JSON.stringify({department:'Finance',path:'Budget.txt'})});result=await call('/api/trash');assert.equal(result.value.trash.length,1);
  await call(`/api/trash/${result.value.trash[0].id}/restore`,{method:'POST'});result=await call('/api/files/content?department=Finance&path=Budget.txt');assert.equal(result.value,'second');
  result=await call('/api/files/move',{method:'POST',body:JSON.stringify({fromDepartment:'Personal',toDepartment:'Personal',from:'Client Portal',to:'SCORA'})});
  assert.equal(result.response.status,404);assert.match(result.value.error,/Refresh the folder list/);
  result=await call('/api/files/content?department=Finance&path=Client%20Portal%2FNotes.txt');assert.equal(result.value,'nested content');
  // Renaming preserves storage, document history, and department access.
  await call('/api/tags',{method:'POST',body:JSON.stringify({department:'Finance',name:'Retained'})});
  await call('/api/comments',{method:'POST',body:JSON.stringify({department:'Finance',path:'Budget.txt',text:'Retained comment'})});
  await call('/api/approval-config',{method:'PUT',body:JSON.stringify({department:'Finance',dueDays:12,stages:[{name:'Review',role:'admin'}]})});
  result=await call('/api/departments/Finance',{method:'PATCH',body:JSON.stringify({name:'SCORA'})});assert.equal(result.response.status,200);
  result=await call('/api/files/content?department=SCORA&path=Budget.txt');assert.equal(result.value,'second');
  result=await call('/api/metadata?department=SCORA');assert.equal(result.value.metadata['Budget.txt'].description,'Annual plan');assert.equal(result.value.tags[0].name,'Retained');
  result=await call('/api/versions?department=SCORA&path=Budget.txt');assert.equal(result.value.versions.length,1);
  result=await call('/api/comments?department=SCORA&path=Budget.txt');assert.equal(result.value.comments[0].text,'Retained comment');
  result=await call('/api/approvals?department=SCORA&path=Budget.txt');assert.equal(result.value.approvals[0].status,'approved');
  result=await call('/api/approval-config?department=SCORA');assert.equal(result.value.config.dueDays,12);
  const persisted=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));
  assert.equal(persisted.departmentStorage.SCORA,Buffer.from('Finance').toString('base64url'));
  assert.ok(persisted.users.find(user=>user.role==='editor').departments.includes('SCORA'));
  assert.ok((await stat(path.join(data,'files','departments',persisted.departmentStorage.SCORA,'Budget.txt'))).isFile());
  result=await call('/api/departments/SCORA',{method:'PATCH',body:JSON.stringify({name:'Personal'})});assert.equal(result.response.status,409);
  result=await call('/api/departments/SCORA',{method:'PATCH',body:JSON.stringify({name:'SCORA'})});assert.equal(result.response.status,200);
  result=await call('/api/departments',{method:'POST',body:JSON.stringify({name:'Finance'})});assert.equal(result.response.status,201);
  result=await call('/api/files?department=Finance');assert.deepEqual(result.value.entries,[]);

});
