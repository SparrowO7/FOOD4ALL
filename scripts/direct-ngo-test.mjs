import {PGlite} from '@electric-sql/pglite';import {readFileSync,readdirSync} from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;alter default privileges in schema public grant all on tables to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;create function storage.foldername(text)returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;`);
for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8').replace('create extension if not exists pgcrypto;',''));
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
for(const[n,role]of[[1,'donor'],[2,'ngo'],[3,'ngo']])await db.query('insert into auth.users(id,raw_user_meta_data)values($1,$2)',[uid(n),JSON.stringify({role,full_name:role})]);await db.exec("update ngos set verification_status='verified'");
async function as(n,sql,args=[]){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?uid(n):'']);await db.exec(n?'set role authenticated':'set role anon');return db.query(sql,args);}
let passed=0;async function check(name,fn){await fn();console.log('PASS',name);passed++;}
async function make(n){const id=uid(n);await as(1,`insert into donations(id,donor_id,title,food_type,is_cooked,quantity_desc,best_before,pickup_address,pickup_lat,pickup_lng,pickup_window_start,pickup_window_end,not_previously_served,vegetarian_confirmed)values($1,$2,'Packed batch','veg',false,'20 packs',now()+interval '3 hour','Lawn',1,1,now(),now()+interval '2 hour',true,true)`,[id,uid(1)]);await as(1,"select transition_donation($1,'available')",[id]);await as(2,"select transition_donation($1,'claimed')",[id]);return id;}
const id=await make(100);
await check('anonymous scan cannot mark collected',()=>assert.rejects(()=>as(null,'select ngo_collect($1)',[id])));
await check('different NGO cannot collect',()=>assert.rejects(()=>as(3,'select ngo_collect($1)',[id])));
await check('cannot complete before collection',()=>assert.rejects(()=>as(2,"select ngo_distribute($1,20,18,'Area',null)",[id])));
await check('claiming NGO collects without volunteer',()=>as(2,'select ngo_collect($1)',[id]));
await check('duplicate collection is rejected',()=>assert.rejects(()=>as(2,'select ngo_collect($1)',[id])));
await check('different NGO cannot report distribution',()=>assert.rejects(()=>as(3,"select ngo_distribute($1,20,18,'Area',null)",[id])));
await check('invalid counts are rejected',()=>assert.rejects(()=>as(2,"select ngo_distribute($1,0,18,'Area',null)",[id])));
await check('area is required',()=>assert.rejects(()=>as(2,"select ngo_distribute($1,20,18,' ',null)",[id])));
await check('NGO records actual servings and people',()=>as(2,"select ngo_distribute($1,20,18,'Test centre',null)",[id]));
await check('one immutable distribution record exists',async()=>{const r=(await as(2,'select * from deliveries where donation_id=$1',[id])).rows;assert.equal(r.length,1);assert.equal(r[0].servings_delivered,20);assert.equal(r[0].people_reached,18);assert.equal(r[0].volunteer_id,null);});
await check('batch reaches completed status',async()=>assert.equal((await as(1,'select status from donations where id=$1',[id])).rows[0].status,'completed'));
await check('repeat QR completion does not count twice',()=>assert.rejects(()=>as(2,"select ngo_distribute($1,20,18,'Test centre',null)",[id])));
await check('all direct handovers are in the audit trail',async()=>assert.equal((await as(1,'select * from donation_events where donation_id=$1',[id])).rows.length,5));
await check('public QR still resolves the completed batch',async()=>assert.equal((await as(null,'select * from public_trace($1)',[id])).rows[0].status,'completed'));
const expired=await make(101);await db.exec('reset role');await db.exec("select set_config('request.jwt.claim.sub','',false)");await db.query("update donations set best_before=now()-interval '1 minute' where id=$1",[expired]);
await check('expired batch cannot be collected',()=>assert.rejects(()=>as(2,'select ngo_collect($1)',[expired])));
await db.close();console.log(`${passed} direct NGO workflow checks passed.`);
