export type UserRole = 'admin' | 'editor' | 'reader';
export type FolioUser = { id:string; name:string; email:string; role:UserRole; departments:string[]; salt?:string; passwordHash?:string; createdAt:number };

// Versioned once to honor the requested local account reset without touching document storage.
const usersKey='folio.accounts.v2';
const persistentSessionKey='folio.session.v2';
const temporarySessionKey='folio.session.v2';

export function loadUsers():FolioUser[]{
  try{return JSON.parse(localStorage.getItem(usersKey)||'[]');}catch{return [];}
}
export function saveUsers(users:FolioUser[]){localStorage.setItem(usersKey,JSON.stringify(users));}
export function currentUser(users=loadUsers()):FolioUser|undefined{
  const id=sessionStorage.getItem(temporarySessionKey)||localStorage.getItem(persistentSessionKey);
  return users.find(user=>user.id===id);
}
export function saveSession(user:FolioUser,remember:boolean){
  clearSession();
  (remember?localStorage:sessionStorage).setItem(remember?persistentSessionKey:temporarySessionKey,user.id);
}
export function clearSession(){localStorage.removeItem(persistentSessionKey);sessionStorage.removeItem(temporarySessionKey);}
function bytesToBase64(bytes:Uint8Array){let value='';bytes.forEach(byte=>value+=String.fromCharCode(byte));return btoa(value);}
function base64ToBytes(value:string){return Uint8Array.from(atob(value),character=>character.charCodeAt(0));}
async function derive(password:string,salt:string){
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:base64ToBytes(salt),iterations:210000,hash:'SHA-256'},material,256);
  return bytesToBase64(new Uint8Array(bits));
}
export async function makeUser(input:{name:string;email:string;password:string;role:UserRole;departments:string[]}):Promise<FolioUser>{
  const saltBytes=crypto.getRandomValues(new Uint8Array(16));const salt=bytesToBase64(saltBytes);
  return {id:crypto.randomUUID(),name:input.name.trim(),email:input.email.trim().toLowerCase(),role:input.role,departments:[...new Set(input.departments)],salt,passwordHash:await derive(input.password,salt),createdAt:Date.now()};
}
export async function authenticate(email:string,password:string,users=loadUsers()){
  const user=users.find(item=>item.email===email.trim().toLowerCase());
  if(!user||!user.salt||await derive(password,user.salt)!==user.passwordHash)throw new Error('The email or password is incorrect.');
  return user;
}
export async function changePassword(user:FolioUser,password:string){
  const salt=bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  return {...user,salt,passwordHash:await derive(password,salt)};
}
