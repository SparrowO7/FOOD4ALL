import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS',name);}
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
alter default privileges in schema public grant all on tables to anon,authenticated;`);
// Supabase storage objects are supplied by the platform, not application migrations.
await db.exec(`create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(text)returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;`);
for(const file of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort()){
 const sql=readFileSync('supabase/migrations/'+file,'utf8').replace(/create extension if not exists pgcrypto;/,'');
 try{await db.exec(sql);}catch(e){throw new Error('Migration '+file+': '+e.message);}
 // Check repeatability at that migration's own schema version. Later migrations
 // extend its views, so replaying an older view definition after them is invalid.
 if(file==='0015_access_hardening.sql')await check('hardening migration can be applied again at its schema version',()=>db.exec(sql));
}
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
for(const [n,role] of [[1,'donor'],[2,'ngo'],[3,'volunteer'],[4,'donor'],[5,'ngo'],[6,'donor']])
 await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2)',[uid(n),JSON.stringify({role,full_name:role})]);
async function as(n,sql,args=[]){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?uid(n):'']);await db.exec(n?'set role authenticated':'set role anon');return db.query(sql,args);}
async function denied(n,sql,args=[]){await assert.rejects(()=>as(n,sql,args));}
const donation=uid(100);
await as(1,`insert into donations(id,donor_id,title,food_type,is_cooked,quantity_desc,best_before,pickup_address,pickup_lat,pickup_lng,pickup_window_start,pickup_window_end,not_previously_served,vegetarian_confirmed)
 values($1,$2,'Test food','veg',false,'10 meals',now()+interval '4 hour','Secret street',28.612345,77.212345,now(),now()+interval '2 hour',true,true)`,[donation,uid(1)]);
const transition=(n,to)=>as(n,'select (transition_donation($1,$2)).status',[donation,to]);
await check('unrelated donor cannot cancel draft with null assignment',()=>denied(4,"select transition_donation($1,'cancelled')",[donation]));
await check('donor cannot directly forge lifecycle',()=>denied(1,"update donations set status='available' where id=$1",[donation]));
await check('donor can edit their draft',()=>as(1,"update donations set title='Edited food' where id=$1",[donation]));
await check('donor publishes',()=>transition(1,'available'));
await check('anonymous base table has no donation rows',async()=>assert.equal((await as(null,'select * from donations')).rows.length,0));
await check('unrelated raw query hides address',async()=>assert.equal((await as(4,'select * from donations')).rows.length,0));
await check('discovery masks exact location',async()=>{const r=(await as(2,'select * from donations_public where id=$1',[donation])).rows[0];assert.equal(r.pickup_address,null);assert.equal(Number(r.pickup_lat),28.61);assert.equal(r.address_revealed,false);});
await check('register excludes unrelated donation',async()=>assert.equal((await as(4,'select * from surplus_food_register')).rows.length,0));
await check('anonymous board enumeration is forbidden',()=>denied(null,'select * from donations_public'));
await check('unverified NGO cannot claim',()=>denied(2,"select transition_donation($1,'claimed')",[donation]));
await db.exec('reset role');
await db.exec("select set_config('request.jwt.claim.sub','',false)");
await db.query("update ngos set verification_status='verified' where id=$1",[uid(2)]);
await check('NGO claims',()=>transition(2,'claimed'));
await check('volunteer can discover claimed pickup',async()=>assert.equal((await as(3,"select * from donations_public where status='claimed'")).rows.length,1));
await check('different NGO cannot assign volunteer',()=>denied(5,"select transition_donation($1,'pickup_scheduled',null,$2)",[donation,uid(3)]));
await check('volunteer self accepts',()=>transition(3,'pickup_scheduled'));
await check('unrelated user cannot enumerate volunteer locations',async()=>assert.equal((await as(4,'select * from volunteers')).rows.length,0));
await check('assigned volunteer sees exact address',async()=>assert.equal((await as(3,'select pickup_address from donations where id=$1',[donation])).rows[0].pickup_address,'Secret street'));
await check('unrelated user cannot mark pickup',()=>denied(4,"select transition_donation($1,'picked_up')",[donation]));
await check('assigned pickup and delivery',async()=>{await transition(3,'picked_up');await transition(3,'delivered');});
await check('completion requires delivered servings',()=>denied(2,"select transition_donation($1,'completed')",[donation]));
await check('delivery cannot name wrong NGO',()=>denied(3,'insert into deliveries(donation_id,volunteer_id,ngo_id) values($1,$2,$3)',[donation,uid(3),uid(5)]));
await check('assigned volunteer records delivery',()=>as(3,'insert into deliveries(donation_id,volunteer_id,ngo_id,servings_delivered) values($1,$2,$3,10)',[donation,uid(3),uid(2)]));
await check('claiming NGO can read donor record',async()=>assert.equal((await as(2,'select donor_name from surplus_food_register where donation_id=$1',[donation])).rows[0].donor_name,'donor'));
await check('claiming NGO confirms receipt',()=>transition(2,'completed'));
await check('anonymous QR works after completion',async()=>assert.equal((await as(null,'select * from public_trace($1)',[donation])).rows[0].status,'completed'));
await check('anonymous sweep is forbidden',()=>denied(null,'select expire_stale_donations()'));
await check('nonadmin sweep wrapper is forbidden',()=>denied(4,'select admin_expire_stale_donations()'));
await check('cannot self verify profile',()=>denied(4,"update profiles set is_verified=true where id=$1",[uid(4)]));
await db.exec('reset role');await db.exec("select set_config('request.jwt.claim.sub','',false)");
await db.query(`insert into donations(id,donor_id,title,food_type,is_cooked,quantity_desc,best_before,pickup_address,pickup_lat,pickup_lng,pickup_window_start,pickup_window_end,status)
 values($1,$2,'Expired','veg',false,'1 meal',now(),'Private',1,1,now()-interval '2 hour',now()-interval '1 hour','expired')`,[uid(101),uid(1)]);
await check('unrelated user cannot annotate unclaimed expiry',()=>denied(4,"select annotate_outcome($1,'no_volunteer')",[uid(101)]));
await check('donor can annotate own expiry',()=>as(1,"select annotate_outcome($1,'no_volunteer')",[uid(101)]));
await check('outcome remains write-once',()=>denied(1,"select annotate_outcome($1,'no_volunteer')",[uid(101)]));
await check('donor cannot promote themselves to admin',()=>denied(4,"update profiles set role='admin' where id=$1",[uid(4)]));
await check('NGO cannot verify itself',()=>denied(5,"update ngos set verification_status='verified' where id=$1",[uid(5)]));
await check('donor cannot review another organisation',async()=>assert.equal((await as(4,"update ngos set verification_status='verified' where id=$1 returning id",[uid(5)])).rows.length,0));
await db.exec('reset role');await db.exec("select set_config('request.jwt.claim.sub','',false)");
await db.query("update profiles set role='admin' where id=$1",[uid(6)]);
await check('assigned admin sees pending organisations',async()=>assert.equal((await as(6,"select id from ngos where verification_status='pending'")).rows.length,1));
await check('admin reviews a pending NGO and records attribution',async()=>assert.equal((await as(6,"update ngos set verification_status='verified',verified_by=$2,verified_at=now() where id=$1 and verification_status='pending' returning id",[uid(5),uid(6)])).rows.length,1));
await check('stale second review cannot overwrite first decision',async()=>assert.equal((await as(6,"update ngos set verification_status='rejected' where id=$1 and verification_status='pending' returning id",[uid(5)])).rows.length,0));
await check('saved NGO decision has admin identity and timestamp',async()=>{const n=(await as(6,'select * from ngos where id=$1',[uid(5)])).rows[0];assert.equal(n.verification_status,'verified');assert.equal(n.verified_by,uid(6));assert.ok(n.verified_at);});
await db.exec('reset role');
await db.exec("select set_config('request.jwt.claim.sub','',false)");
await db.close();console.log(`${passed} database checks passed.`);
