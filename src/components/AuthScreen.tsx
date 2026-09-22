import {useState,type FormEvent} from 'react';
import {Eye,EyeOff,LockKeyhole} from 'lucide-react';
import {authenticate,makeUser,saveSession,saveUsers,type FolioUser} from '../services/auth';

type Props={users:FolioUser[];departments:string[];theme:'light'|'dark';setup?:boolean;onServerSubmit?:(input:{setup:boolean;name:string;email:string;password:string;remember:boolean})=>Promise<{user:FolioUser;users:FolioUser[]}>;onAuthenticated:(user:FolioUser,users:FolioUser[])=>void};

export default function AuthScreen({users,departments,theme,setup:setupOverride,onServerSubmit,onAuthenticated}:Props){
  const setup=setupOverride??users.length===0;
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [remember,setRemember]=useState(true);
  const [visible,setVisible]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('');setBusy(true);
    try{
      if(onServerSubmit){const result=await onServerSubmit({setup,name,email,password,remember});onAuthenticated(result.user,result.users);return;}
      if(setup){
        if(!name.trim())throw Error('Enter the administrator’s name.');
        if(password.length<8)throw Error('Use at least 8 characters for the password.');
        const user=await makeUser({name,email,password,role:'admin',departments});const next=[user];
        saveUsers(next);saveSession(user,true);onAuthenticated(user,next);
      }else{
        const user=await authenticate(email,password,users);saveSession(user,remember);onAuthenticated(user,users);
      }
    }catch(reason){setError((reason as Error).message);}finally{setBusy(false);}
  }

  return <main className={`auth-screen theme-${theme}`}>
    <form className="auth-card" method="post" autoComplete="on" onSubmit={submit}>
      <div className="auth-symbol"><LockKeyhole size={22}/></div>
      <h1>{setup?'Create your administrator':'Welcome back'}</h1>
      <p>{setup?'Set up the first account for this Folio workspace.':'Access your documents and workspace.'}</p>
      {setup&&<label>Name<input name="name" value={name} onChange={event=>setName(event.target.value)} autoComplete="name" placeholder="Administrator name"/></label>}
      <label>Email<input name="username" value={email} onChange={event=>setEmail(event.target.value)} type="email" inputMode="email" autoComplete="username" required placeholder="you@domain.com"/></label>
      <label>Password<div className="password-field"><input name="password" value={password} onChange={event=>setPassword(event.target.value)} type={visible?'text':'password'} autoComplete={setup?'new-password':'current-password'} required placeholder={setup?'At least 8 characters':'Enter your password'}/><button type="button" aria-label={visible?'Hide password':'Show password'} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
      {!setup&&<label className="remember"><input type="checkbox" checked={remember} onChange={event=>setRemember(event.target.checked)}/>Remember me</label>}
      {error&&<p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" disabled={busy}>{busy?'Please wait…':setup?'Create administrator':'Sign in'}</button>
    </form>
    <div className="auth-footer"><strong>Local first. Yours, always.</strong><span>Your accounts and files stay on this Folio installation.</span></div>
  </main>;
}
