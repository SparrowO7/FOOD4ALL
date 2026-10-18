import {useState} from 'react';
import {db,unwrap} from './data';

export default function Auth(){
  const [role,setRole]=useState('donor'),[signup,setSignup]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setMessage('');const f=new FormData(e.currentTarget);
    try{
      const email=String(f.get('email')).trim(),password=String(f.get('password'));
      sessionStorage.setItem('food4all-login-role',role);if(role==='admin')window.location.hash='/home';
      if(signup){
        if(role==='admin')throw Error('Admin accounts are assigned by the platform owner.');
        const result=await db.auth.signUp({email,password,options:{data:{role,full_name:String(f.get('name')).trim()}}});unwrap(result);
        if(!result.data.session)setMessage('Account created. Confirm your email, then sign in. NGOs need administrator verification before claiming.');
      }else unwrap(await db.auth.signInWithPassword({email,password}));
    }catch(e:any){setMessage(e.message);}finally{setBusy(false);}
  }
  return <div className="auth"><div className="auth-art"><span className="flower">✳</span><p className="eyebrow">GOOD FOOD. SHARED WITH CARE.</p><h1>A little extra.<br/><em>A whole lot of good.</em></h1><p>Lawns share. NGOs collect.<br/>A scanned label connects the journey.</p><span className="veg">VEGETARIAN-ONLY PILOT</span></div>
    <form onSubmit={submit} className="panel"><h2>{signup?'Join the community':'Welcome back'}</h2>
      <fieldset disabled={busy}><div className="login-roles" role="group" aria-label="Account type">{[['donor','Lawn / donor'],['ngo','NGO'],['admin','Admin']].map(([value,label])=><button type="button" key={value} aria-pressed={role===value} onClick={()=>{setRole(value);setSignup(false);setMessage('');}}>{label}</button>)}</div>
      <p>{role==='admin'?'Platform administration. Sign in with an account assigned the admin role.':signup?'Create your organisation account.':'Sign in to your organisation workspace.'}</p>
      {signup&&<label className="field"><span>Your name / organisation</span><input name="name" required maxLength={150} autoComplete="name"/></label>}
      <label className="field"><span>{role==='admin'?'Admin email':'Email'}</span><input name="email" type="email" required autoComplete="email"/></label>
      <label className="field"><span>Password</span><input name="password" type="password" required minLength={signup?8:1} autoComplete={signup?'new-password':'current-password'}/></label>
      <button className="primary full">{busy?'Please wait…':signup?'Create account':role==='admin'?'Sign in as admin':'Sign in'}</button></fieldset>
      {message&&<p role="alert" className="notice">{message}</p>}
      {role!=='admin'&&<button type="button" disabled={busy} className="text-button" onClick={()=>{setSignup(!signup);setMessage('');}}>{signup?'Already a member? Sign in':'New here? Create an account'}</button>}
      <p className="micro">{role==='admin'?'Admin registration is not public. Selecting this option does not grant permissions; the server checks your account role.':'Check ingredients and food condition at handover. Labels and distribution counts are reported by the donor and NGO.'}</p>
    </form></div>;
}
