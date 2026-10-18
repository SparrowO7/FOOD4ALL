import {useEffect,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {db,unwrap,fmt,statusLabel,type Row} from './data';

export default function AdminPanel({profile,refresh,onRefresh,initial='overview'}:{profile:Row;refresh:number;onRefresh:()=>void;initial?:string}){
  const [tab,setTab]=useState(initial),[filter,setFilter]=useState('all'),[page,setPage]=useState(0),[rows,setRows]=useState<Row[]>([]),[counts,setCounts]=useState<Record<string,number>>({}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[review,setReview]=useState<{ngo:Row;approve:boolean}|null>(null);
  useEffect(()=>{let active=true;setRows([]);setError('');setLoading(true);
    async function load(){
      if(profile.role!=='admin')throw Error('Administrator access required.');
      // These are authenticated queries. Database policies independently enforce admin access.
      if(tab==='overview'){
        const specs=[['Available','donations','status','available'],['In collection','donations','status','claimed'],['Collected','donations','status','picked_up'],['Completed','donations','status','completed'],['Expired','donations','status','expired'],['NGOs pending','ngos','verification_status','pending']];
        const results=await Promise.all(specs.map(async([name,table,column,value])=>{const r=await db.from(table).select('id',{count:'exact',head:true}).eq(column,value);unwrap(r);return [name,r.count??0] as const;}));if(active)setCounts(Object.fromEntries(results));return;
      }
      let result;
      if(tab==='ngos'){let q=db.from('ngos').select('*').order('id');if(filter!=='all')q=q.eq('verification_status',filter);result=await q.range(page*50,page*50+49);}
      else if(tab==='batches'){let q=db.from('donations').select('*').order('created_at',{ascending:false}).order('id');if(filter!=='all')q=q.eq('status',filter);result=await q.range(page*50,page*50+49);}
      else if(tab==='reports')result=await db.from('deliveries').select('*').order('delivered_at',{ascending:false}).order('id').range(page*50,page*50+49);
      else result=await db.from('donation_events').select('*').order('created_at',{ascending:false}).order('id').range(page*50,page*50+49);
      const data=unwrap(result) as Row[];if(active)setRows(data);
    }
    load().catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
  },[profile.id,profile.role,refresh,tab,filter,page]);
  function choose(value:string){setTab(value);setFilter('all');setPage(0);setReview(null);setError('');}
  async function saveReview(){if(!review||profile.role!=='admin')return;setBusy(true);setError('');
    try{const {ngo,approve}=review;const changed=unwrap(await db.from('ngos').update({verification_status:approve?'verified':'rejected',verified_by:profile.id,verified_at:new Date().toISOString()}).eq('id',ngo.id).eq('verification_status','pending').select('id').maybeSingle());if(!changed)throw Error('This request was already reviewed or your access changed. Refresh and check.');setReview(null);onRefresh();}
    catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  async function exportCsv(){setBusy(true);setError('');try{
    const keys=['donation_id','servings_delivered','people_reached','distribution_area','delivered_at'];
    const csv=[keys.join(','),...rows.map(r=>keys.map(k=>{let v=String(r[k]??'');if(/^[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';}).join(','))].join('\r\n');
    if(Capacitor.isNativePlatform()){const file=await Filesystem.writeFile({path:'food4all-distribution-report.csv',data:csv,encoding:Encoding.UTF8,directory:Directory.Cache});await Share.share({title:'Food4All India distribution report',files:[file.uri]});}
    else{const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='food4all-distribution-report.csv';a.click();URL.revokeObjectURL(url);}
  }catch(e:any){setError(e.message);}finally{setBusy(false);}}
  if(profile.role!=='admin')return <p role="alert" className="notice">Administrator access required.</p>;
  return <><div className="intro compact"><span className="eyebrow">PLATFORM ADMINISTRATION</span><h1>Care behind<br/><em>every connection.</em></h1><p>Review organisations, monitor food batches and check reported distribution.</p></div>
    <div className="admin-tabs" role="group" aria-label="Admin sections">{[['overview','Overview'],['ngos','NGO reviews'],['batches','Food batches'],['reports','Reports'],['activity','Batch history']].map(([value,label])=><button key={value} aria-pressed={tab===value} onClick={()=>choose(value)}>{label}</button>)}</div>
    {error&&<p role="alert" className="notice">{error}</p>}{loading&&<p className="empty">Loading admin records…</p>}
    {!loading&&!error&&tab==='overview'&&<><div className="stats admin-stats">{Object.entries(counts).map(([label,value])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div><p className="micro">Exact current status counts. A listed batch may pass its use-before time before the expiry sweep updates its status.</p><button className="primary full" onClick={()=>{choose('ngos');setFilter('pending');}}>Review pending NGOs</button><section className="panel"><h2>Accountability first</h2><p>Distribution counts are reported by NGOs. Admin can inspect records and their history. Counts cannot be silently edited or deleted from this panel.</p></section></>}
    {['ngos','batches'].includes(tab)&&<label className="field"><span>{tab==='ngos'?'Verification status':'Batch status'}</span><select value={filter} disabled={loading} onChange={e=>{setFilter(e.target.value);setPage(0);setReview(null);}}>{(tab==='ngos'?['all','pending','verified','rejected']:['all','draft','available','claimed','picked_up','completed','expired','cancelled','rejected','pickup_scheduled','delivered']).map(s=><option key={s} value={s}>{s==='all'?'All':tab==='ngos'?s[0].toUpperCase()+s.slice(1):statusLabel(s)}</option>)}</select></label>}
    {!loading&&!error&&tab==='ngos'&&rows.map(n=><section className="panel" key={n.id}><div className="card-top"><h2>{n.org_name||'Unnamed organisation'}</h2><span className="status">{n.verification_status}</span></div><p>{n.contact_person||'Contact not recorded'} · {n.contact_phone||'Phone not recorded'}</p><p>{n.address||'Address not recorded'}</p><p>Registration: {n.registration_no||'Not recorded'}<br/>Food licence: {n.fssai_licence_no||'Not recorded'}</p>{n.licence_not_required_note&&<p>Licence explanation: {n.licence_not_required_note}</p>}{n.verified_at&&<small>Last review: {fmt(n.verified_at)}</small>}{n.verification_status==='pending'&&<div className="two"><button className="primary" disabled={busy} onClick={()=>setReview({ngo:n,approve:true})}>Verify NGO</button><button className="secondary" disabled={busy} onClick={()=>setReview({ngo:n,approve:false})}>Reject NGO</button></div>}{review&&review.ngo.id===n.id&&<div className="notice"><p>{review.approve?'Verify':'Reject'} {n.org_name}? Verify registration and contact details before deciding. Your admin ID and review time will be recorded.</p><div className="two"><button className="primary" disabled={busy} onClick={saveReview}>{busy?'Saving…':'Confirm review'}</button><button className="secondary" disabled={busy} onClick={()=>setReview(null)}>Back</button></div></div>}</section>)}
    {!loading&&!error&&tab==='batches'&&rows.map(d=><button className="record" key={d.id} onClick={()=>{window.location.hash='/batch/'+d.id;}}><strong>{d.title}</strong><span>{statusLabel(d.status)} · {d.quantity_desc}</span><small>Use before: {fmt(d.best_before)}</small><small>Created: {fmt(d.created_at)}</small></button>)}
    {!loading&&!error&&tab==='reports'&&<><p className="micro">Showing this page of reported distributions (up to 50). These are NGO-reported counts, not independently verified outcomes.</p><button className="secondary full" disabled={busy||!rows.length} onClick={exportCsv}>Export this page CSV</button>{rows.map(d=><button className="record" key={d.id} onClick={()=>{window.location.hash='/batch/'+d.donation_id;}}><strong>{d.servings_delivered??'Not recorded'} servings · {d.people_reached??'Not recorded'} people reached</strong><span>{d.distribution_area||'Area not recorded'}</span><small>{fmt(d.delivered_at)}</small><code className="break">{d.donation_id}</code></button>)}</>}
    {!loading&&!error&&tab==='activity'&&rows.map(e=><button className="record" key={e.id} onClick={()=>{window.location.hash='/batch/'+e.donation_id;}}><strong>{statusLabel(e.from_status||'draft')} → {statusLabel(e.to_status)}</strong><span>{e.actor_role||'System'} · {fmt(e.created_at)}</span>{e.reason&&<small>{String(e.reason).replaceAll('_',' ')}</small>}{e.note&&<small>{e.note}</small>}<code className="break">{e.donation_id}</code></button>)}
    {!loading&&!error&&tab!=='overview'&&<><p className="micro">Page {page+1} · {rows.length} records</p>{!rows.length&&<p className="empty">No records in this view.</p>}<div className="two"><button className="secondary" disabled={page===0||busy} onClick={()=>setPage(p=>p-1)}>Previous</button><button className="secondary" disabled={rows.length<50||busy} onClick={()=>setPage(p=>p+1)}>Next</button></div></>}
  </>;
}
