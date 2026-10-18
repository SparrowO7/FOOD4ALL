import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {markNotificationRead} from '@/lib/actions';
import {signedMediaUrlMap} from '@/lib/media';
import PageIntro from '@/components/PageIntro';
import FoodCard,{type FoodCardData} from '@/components/FoodCard';
import NgoReview from '@/components/NgoReview';

export default async function DashboardPage(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/auth/login');
 const {data:profile}=await db.from('profiles').select('*').eq('id',user.id).single();
 if(!profile)return <div className="surface p-8">Your profile could not be loaded. Please refresh or sign in again.</div>;
 const role=profile.role as string;
 let own=db.from('donations').select('*').order('updated_at',{ascending:false}).limit(30);
 if(role==='donor')own=own.eq('donor_id',user.id);
 else if(role==='ngo')own=own.eq('claimed_by_ngo',user.id);
 else if(role==='volunteer')own=own.eq('assigned_volunteer',user.id);
 const {data:tasks,error:taskError}=await own;
 const {data:available,error:availableError}=role==='ngo'||role==='volunteer'?await db.from('donations_public').select('*').eq('status',role==='volunteer'?'claimed':'available').gt('best_before',new Date().toISOString()).order('best_before').limit(12):{data:[],error:null};
 const {data:ngo}=role==='ngo'?await db.from('ngos').select('verification_status').eq('id',user.id).single():{data:null};
 const {data:pending,error:reviewError}=role==='admin'?await db.from('ngos').select('*').eq('verification_status','pending'):{data:[],error:null};
 const {data:notifications,error:inboxError}=await db.from('notifications').select('*').order('created_at',{ascending:false}).limit(12);
 const rows=(tasks??[]) as FoodCardData[];
 const availableRows=(available??[]) as FoodCardData[];
 // One batched signing call for both lists. Forty cards signing individually
 // would be forty sequential storage requests inside a single render.
 const photoUrls=await signedMediaUrlMap(db,'donation',[...rows,...availableRows].map(d=>d.photo_url));
 const active=rows.filter(d=>!['draft','completed','expired','cancelled','rejected'].includes(d.status));
 const sections=[{title:role==='donor'?'Your donations':role==='ngo'?'Your claimed food':role==='admin'?'Recent donations':'Your assigned pickups',items:rows},...(role==='ngo'||role==='volunteer'?[{title:role==='ngo'?'Available to claim':'Pickups needing a volunteer',items:availableRows}]:[])];
 return <div className="workspace-page"><PageIntro eyebrow={`${role.toUpperCase()} WORKSPACE`} title={`Welcome, ${profile.full_name?.split(' ')[0]||'neighbour'}.`} description={role==='donor'?'Your extra food can make someone’s day. Keep track of every meal you share.':role==='ngo'?'Find food for your community and follow each handover.':role==='volunteer'?'A little of your time can take a meal a long way.':'Review organisations and keep the community running.'} action={{href:role==='donor'?'/donations/new':'/donations',label:role==='donor'?'Share food':'Browse food'}}/>
 <div className="workspace-tabs"><Link href="/dashboard" aria-current="page">Overview</Link><Link href="/profile">Your profile</Link><Link href="/records">Food records</Link><Link href="/impact">Community impact</Link></div>
 {ngo && ngo.verification_status!=='verified'&&<div className="notice">{ngo.verification_status==='rejected'?'Your organisation was not approved. Update your organisation details and contact the project administrator.':'Your organisation is awaiting review. Complete its details in your profile; claiming unlocks after administrator verification.'}</div>}
 <div className="workspace-summary">{[[active.length,'In progress'],[rows.filter(x=>x.status==='completed').length,'Completed'],[rows.filter(x=>x.status==='draft').length,'Drafts']].map(([n,label])=><div key={label}><span>{label}</span><strong>{n}</strong></div>)}<div><span>Your next step</span><Link href={role==='donor'?'/donations/new':'/profile'}>{role==='donor'?'Post a new donation ↗':'Keep your profile up to date ↗'}</Link></div></div>
 <p className="text-xs text-slate-500">Summary of the latest {rows.length} accessible donations, not lifetime totals.</p>
 {(taskError||availableError)&&<p role="alert" className="notice">Some donations could not be loaded. Refresh to try again.</p>}
 <div className="workspace-columns"><div className="space-y-8">
 {role==='admin'&&<section className="surface p-6"><h2 className="section-title">Organisation reviews</h2><p className="mt-2 text-sm text-slate-500">Review organisation details before allowing food claims.</p>{reviewError?<p className="notice">Reviews could not be loaded.</p>:pending?.length?pending.map(n=><article key={n.id} className="mt-5 border-t pt-5"><h3 className="font-semibold">{n.org_name||'Organisation name not provided'}</h3><p className="mt-2 text-sm">{n.address||'Address not provided'} · {n.contact_phone||'Phone not provided'}</p><p className="mt-1 text-xs text-slate-500">Registration: {n.registration_no||'Not provided'} · Food licence: {n.fssai_licence_no||'Not provided'}</p><NgoReview id={n.id}/></article>):<p className="empty-copy">No organisations are waiting for review.</p>}</section>}
 {sections.map(section=><section key={section.title}><div className="flex items-center justify-between gap-3"><h2 className="section-title">{section.title}</h2><span className="text-xs text-slate-500">{section.items.length} shown</span></div>{section.items.length?<div className="mt-5 grid gap-4 sm:grid-cols-2">{section.items.map(food=><FoodCard key={food.id} food={food} photoUrl={photoUrls.get(food.photo_url??'')}/>)}</div>:<div className="surface mt-5 p-8"><span className="empty-mark" aria-hidden>✳</span><h3 className="mt-4 font-semibold">Your next connection starts here.</h3><p className="empty-copy">No food in this section yet. Browse listings or share a new donation when you’re ready.</p></div>}</section>)}
 </div><aside className="space-y-5"><section className="surface p-5"><span className="eyebrow">KEEP IN THE LOOP</span><h2 className="section-title mt-3">Your updates</h2><p className="mt-2 text-xs text-slate-500">Updates appear here when you load or refresh this page.</p>{inboxError?<p className="empty-copy">Updates are temporarily unavailable.</p>:notifications?.length?notifications.map(n=><div key={n.id} className="activity-item"><Link href={`/donations/${n.donation_id}`} className="text-sm font-semibold">Donation {String(n.status).replaceAll('_',' ')} ↗</Link><p className="mt-1 text-xs text-slate-500">{new Date(n.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p>{!n.read_at&&<form action={async()=>{'use server';await markNotificationRead(n.id);}}><button className="mt-2 text-xs underline">Mark as read</button></form>}</div>):<p className="empty-copy">Claim, pickup and delivery updates will appear here.</p>}</section><section className="workspace-tip"><span aria-hidden className="text-3xl">♡</span><h3 className="mt-4 font-semibold">Care travels with the food.</h3><p>Check the pickup window, keep food appropriately stored, and record what actually reaches the receiving organisation.</p><Link href="/records">View your food records →</Link></section></aside></div>
 </div>;
}
