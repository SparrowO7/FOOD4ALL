import {createClient} from '@supabase/supabase-js';
import {shrinkImage} from '../../src/lib/image-client';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
if(!url||!key)throw new Error('Missing mobile Supabase configuration.');
export const db=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
export type Row=Record<string,any>;
export function unwrap(response:{data?:unknown;error: {message:string}|null}):any{if(response.error)throw new Error(response.error.message);return response.data;}
export async function rpc(name:string,params:Record<string,unknown>){return unwrap(await db.rpc(name,params));}
export async function photoUrl(path:string|null|undefined,proof=false){if(!path)return null;if(/^https:\/\//.test(path))return path;return unwrap(await db.storage.from(proof?'delivery-proofs':'donation-photos').createSignedUrl(path,1800))?.signedUrl??null;}
export async function uploadPhoto(id:string,file:File){const small=await shrinkImage(file);if(!['image/jpeg','image/png','image/webp'].includes(small.type)||small.size>5*1024*1024)throw new Error('Choose a JPEG, PNG or WebP photo under 5 MB.');const ext=small.type==='image/png'?'png':small.type==='image/webp'?'webp':'jpg';const path=`${id}/${crypto.randomUUID()}.${ext}`;unwrap(await db.storage.from('donation-photos').upload(path,small,{contentType:small.type}));unwrap(await db.from('donations').update({photo_url:path}).eq('id',id));}
export async function getBatch(id:string){let food=unwrap(await db.from('donations').select('*').eq('id',id).maybeSingle()) as Row|null;
if(!food)food=unwrap(await db.from('donations_public').select('*').eq('id',id).maybeSingle()) as Row|null;
const traceResponse=await db.rpc('public_trace',{p_id:id});const trace=traceResponse.error?null:traceResponse.data?.[0];
if(!food&&trace)food=trace;if(!food)throw new Error('Batch not found, not published, or not accessible to this account.');
const [events,delivery]=await Promise.all([db.from('donation_events').select('*').eq('donation_id',id).order('created_at'),db.from('deliveries').select('*').eq('donation_id',id).maybeSingle()]);
let timeline=events.data??[];if(!timeline.length){const r=await db.rpc('public_trace_events',{p_id:id});timeline=r.data??[];}
return {food,trace,timeline,delivery:delivery.data as Row|null};}
export {batchIdFromQr} from './qr';
export function batchQr(id:string){const base=import.meta.env.VITE_PUBLIC_TRACE_ORIGIN;return base&&/^https:\/\//.test(base)?`${base.replace(/\/$/,'')}/trace/${id}`:`food4all://batch/${id}`;}
export function fmt(value:string|null){return value?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(value))+' IST':'Not recorded';}
export function statusLabel(value:string){return ({draft:'Draft',available:'Available',claimed:'Claimed by NGO',picked_up:'Collected',delivered:'Distribution recorded',completed:'Completed',expired:'Expired',cancelled:'Cancelled',rejected:'Food refused',pickup_scheduled:'Pickup scheduled'} as Record<string,string>)[value]??value;}
