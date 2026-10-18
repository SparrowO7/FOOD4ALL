'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {verifyNgo} from '@/lib/actions';
export default function NgoReview({id}:{id:string}) {
 const [busy,setBusy]=useState(false); const [error,setError]=useState('');const router=useRouter();
 async function review(approved:boolean){setBusy(true);setError('');try{const r=await verifyNgo(id,approved);if(r.error)setError(r.error);else router.refresh();}catch{setError('Could not save this review. Try again.');}finally{setBusy(false);}}
 return <div className="mt-4"><div className="flex gap-2"><button disabled={busy} onClick={()=>review(true)} className="food-button primary">Verify organisation</button><button disabled={busy} onClick={()=>review(false)} className="food-button secondary">Reject</button></div>{error&&<p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}</div>;
}
