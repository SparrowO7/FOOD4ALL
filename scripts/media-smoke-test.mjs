import {createClient} from '@supabase/supabase-js';import {readFileSync} from 'node:fs';
const env=Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const make=()=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const donor=make(),ngo=make();for(const [client,email] of [[donor,'demo.donor@food4all.dev'],[ngo,'demo.ngo@food4all.dev']]){const {error}=await client.auth.signInWithPassword({email,password:'Food4All!demo123'});if(error)throw error;}
const {data:{user}}=await donor.auth.getUser();const now=Date.now(),time=x=>new Date(now+x).toISOString();
const {data:d,error}=await donor.from('donations').insert({donor_id:user.id,title:'DEMO — photo upload verification',food_type:'veg',is_cooked:false,quantity_desc:'Test image only; no real food',servings_estimate:0,best_before:time(7200000),pickup_address:'DEMO campus location',pickup_lat:26.8467,pickup_lng:80.9462,pickup_window_start:time(0),pickup_window_end:time(3600000),vegetarian_confirmed:true,not_previously_served:true,status:'draft'}).select('id').single();if(error)throw error;
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYz8AAAAASUVORK5CYII=','base64');const path=`${d.id}/${crypto.randomUUID()}.png`;
const up=await donor.storage.from('donation-photos').upload(path,bytes,{contentType:'image/png'});if(up.error)throw up.error;console.log('PASS private draft photo upload');
const patch=await donor.from('donations').update({photo_url:path}).eq('id',d.id);if(patch.error)throw patch.error;
const own=await donor.storage.from('donation-photos').createSignedUrl(path,60);if(own.error)throw own.error;
if(!(await fetch(own.data.signedUrl)).ok)throw Error('Signed image did not load');console.log('PASS signed photo URL loads');
if(!(await ngo.storage.from('donation-photos').createSignedUrl(path,60)).error)throw Error('Unrelated NGO read a draft image');console.log('PASS unrelated viewer cannot sign draft photo');
const pub=await donor.rpc('transition_donation',{p_id:d.id,p_to:'available'});if(pub.error)throw pub.error;
const offered=await ngo.storage.from('donation-photos').createSignedUrl(path,60);if(offered.error)throw offered.error;console.log('PASS signed-in NGO can view offered food photo');
const can=await donor.rpc('can_upload_donation_photo',{p_donation:d.id});if(can.error)throw can.error;if(can.data)throw Error('Published photo remains writable');console.log('PASS published photo is frozen');
const overwrite=await donor.storage.from('donation-photos').upload(path,bytes,{contentType:'image/png',upsert:true});if(!overwrite.error)throw Error('Published image overwrite succeeded');console.log('PASS direct published-image overwrite denied');
const cancel=await donor.rpc('transition_donation',{p_id:d.id,p_to:'cancelled',p_reason:'other',p_note:'Automated storage verification only; no real food.'});if(cancel.error)throw cancel.error;console.log('PASS test listing closed; image retained as test record');
console.log('Photo verification donation:',d.id);
