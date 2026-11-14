'use client';
import { useState } from 'react';
import { apiCall } from '../lib/api-client';
import type { User } from '../lib/contracts';

export default function PasswordAccount({user,onAuthenticated,onLogout}:{user:User|null;onAuthenticated:()=>Promise<void>;onLogout:()=>Promise<void>}) {
  const [pending,setPending]=useState(false),[error,setError]=useState('');
  if(user)return <><p className="muted">Signed in as {user.name}. Access is assigned by the server. Your reservations belong to your account.</p><button className="outline-btn" disabled={pending} onClick={async()=>{setPending(true);try{await onLogout();}catch(e){setError((e as Error).message);}finally{setPending(false);}}}>Sign out</button>{error&&<p role="alert" className="inline-error">{error}</p>}</>;
  return <form className="password-form" onSubmit={async e=>{
    e.preventDefault();const form=e.currentTarget,values=new FormData(form);setPending(true);setError('');
    try{await apiCall('/auth/login','POST',{email:values.get('email'),password:values.get('password')});form.reset();await onAuthenticated();}
    catch(e){setError((e as Error).message);}finally{setPending(false);}
  }}>
    <p className="muted">Educational prototype. Sign in with your pre-provisioned fictional test account.</p>
    <label>Email<input type="email" name="email" autoComplete="username" maxLength={254} required/></label>
    <label>Password<input type="password" name="password" autoComplete="current-password" minLength={12} maxLength={128} required/></label>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <button className="btn full" disabled={pending}>{pending?'Please wait…':'Sign in'}</button>
    <p className="fine-print">Use driver@test.local or operator@test.local. Ask the project owner for the locally generated credentials. Do not enter real personal information. Public registration is disabled.</p>
  </form>;
}
