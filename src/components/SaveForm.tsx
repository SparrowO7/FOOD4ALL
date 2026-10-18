'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export default function SaveForm({action,children,className='surface p-6 space-y-4'}:{action:(form:FormData)=>Promise<{error?:string;ok?:boolean}>;children:React.ReactNode;className?:string}){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const router=useRouter();
 async function submit(form:FormData){setBusy(true);setMessage('');try{const result=await action(form);setMessage(result.error??'Saved successfully.');if(!result.error)router.refresh();}catch{setMessage('Could not save your changes. Please try again.');}finally{setBusy(false);}}
 return <form action={submit} className={className}><fieldset disabled={busy} className="space-y-4">{children}<button className="food-button primary" disabled={busy}>{busy?'Saving…':'Save changes'}</button></fieldset>{message&&<p role="status" className="notice">{message}</p>}</form>;
}
