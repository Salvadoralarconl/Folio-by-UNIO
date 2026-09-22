import type {FolioUser,UserRole} from './auth';
import type {Entry,Repository} from '../types';

type Bootstrap={user:FolioUser;users:FolioUser[];departments:string[]};
async function request<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{credentials:'same-origin',...init,headers:{...(init?.body instanceof Blob?{}:{'content-type':'application/json'}),...init?.headers}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'The Folio server is unavailable.');
  return data as T;
}
export async function serverStatus(){try{return await request<{needsSetup:boolean;authenticated:boolean}>('/api/status');}catch{return null;}}
export const serverBootstrap=()=>request<Bootstrap>('/api/bootstrap');
export const serverLogin=(email:string,password:string,remember:boolean)=>request<{user:FolioUser}>('/api/login',{method:'POST',body:JSON.stringify({email,password,remember})});
export const serverSetup=(name:string,email:string,password:string)=>request<Bootstrap>('/api/setup',{method:'POST',body:JSON.stringify({name,email,password})});
export const serverLogout=()=>request<{ok:boolean}>('/api/logout',{method:'POST'});
export async function serverCreateUser(input:{name:string;email:string;password:string;role:UserRole;departments:string[]}){return (await request<{user:FolioUser}>('/api/users',{method:'POST',body:JSON.stringify(input)})).user;}
export async function serverUpdateUser(id:string,input:{name:string;email:string;password?:string;role:UserRole;departments:string[]}){return (await request<{user:FolioUser}>(`/api/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(input)})).user;}
export const serverRemoveUser=(id:string)=>request<{ok:boolean}>(`/api/users/${encodeURIComponent(id)}`,{method:'DELETE'});
export const serverTransferEntry=(fromDepartment:string,toDepartment:string,from:string,to:string,copy=false)=>request<{ok:boolean}>('/api/files/move',{method:'POST',body:JSON.stringify({fromDepartment,toDepartment,from,to,copy})});
export async function serverAddDepartment(name:string){return (await request<{departments:string[]}>('/api/departments',{method:'POST',body:JSON.stringify({name})})).departments;}
export async function serverRenameDepartment(previous:string,name:string){return (await request<{departments:string[]}>(`/api/departments/${encodeURIComponent(previous)}`,{method:'PATCH',body:JSON.stringify({name})})).departments;}
export async function serverRemoveDepartment(name:string){return (await request<{departments:string[]}>(`/api/departments/${encodeURIComponent(name)}`,{method:'DELETE'})).departments;}

export function serverRepository(department:string):Repository{
  const query=(path?:string)=>`department=${encodeURIComponent(department)}${path===undefined?'':`&path=${encodeURIComponent(path)}`}`;
  const repo:Repository={label:`${department} workspace`,mode:'demo',storageKey:`server:${department}`,
    async list(){return (await request<{entries:Entry[]}>(`/api/files?${query()}`)).entries;},
    async read(path){const response=await fetch(`/api/files/content?${query(path)}`,{credentials:'same-origin'});if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'File unavailable.');return response.blob();},
    async mkdir(path){await request('/api/folders',{method:'POST',body:JSON.stringify({department,path})});},
    async write(path,file){await request(`/api/files/content?${query(path)}`,{method:'PUT',body:file});},
    async replace(path,file){await request(`/api/files/content?${query(path)}&replace=1`,{method:'PUT',body:file});},
    async move(from,to){await request('/api/files/move',{method:'POST',body:JSON.stringify({fromDepartment:department,toDepartment:department,from,to})});},
    async remove(path){await request('/api/files',{method:'DELETE',body:JSON.stringify({department,path})});}
  };return repo;
}
