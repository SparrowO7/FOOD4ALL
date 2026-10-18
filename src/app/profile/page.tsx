import SaveForm from '@/components/SaveForm';
import PageIntro from '@/components/PageIntro';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { updateProfile, updateVolunteerLocation, updateNgoProfile } from '@/lib/actions';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const { data: volunteer } = await supabase.from('volunteers').select('*').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? 'donor';
  const {data:ngo}=role==='ngo'?await supabase.from('ngos').select('*').eq('id',user.id).single():{data:null};
  const inputCls = 'mt-1.5 w-full rounded-2xl border bg-white px-3.5 py-2.5 text-sm shadow-soft focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-slate-800 dark:text-white';
  return (
    <div className="workspace-page mx-auto max-w-3xl space-y-6"><PageIntro eyebrow="YOUR COMMUNITY PROFILE" title="A little about you." description="Keep your contact and pickup information up to date." />
      <div className="overflow-hidden rounded-[28px] border bg-white shadow-card dark:border-white/10 dark:bg-slate-900/70">
        <div className="h-1 bg-gradient-to-r from-brand-600 to-emerald-600" />
        <div className="p-6">
          <h1 className="font-display text-2xl font-extrabold tracking-tight dark:text-white">Profile</h1>
          <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-white/5">
            <div className="dark:text-slate-200"><span className="font-bold">Email:</span> {user.email}</div>
            <div className="dark:text-slate-200"><span className="font-bold">Role:</span> <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-white dark:bg-white dark:text-slate-900">{role}</span></div>
            <div className="break-all dark:text-slate-300"><span className="font-bold">User ID:</span> <code className="rounded bg-white px-1.5 py-0.5 text-xs dark:bg-slate-800 dark:text-slate-200">{user.id}</code></div>
          </div>
        </div>
      </div>
      <SaveForm action={updateProfile} className="rounded-[24px] border bg-white p-6 shadow-soft space-y-4 dark:border-white/10 dark:bg-slate-900/60">
        <h2 className="font-display font-extrabold dark:text-white">Edit profile</h2>
        <label className="block"><span className="text-sm font-bold dark:text-slate-200">Full name</span><input name="full_name" defaultValue={(profile as { full_name: string })?.full_name ?? ''} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-bold dark:text-slate-200">Phone</span><input name="phone" defaultValue={(profile as { phone: string | null })?.phone ?? ''} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-bold dark:text-slate-200">City</span><input name="city" defaultValue={(profile as { city: string | null })?.city ?? ''} className={inputCls} /></label>
        {role === 'volunteer' && (
          <label className="block"><span className="text-sm font-bold dark:text-slate-200">Vehicle</span>
            <select name="vehicle_type" defaultValue={(volunteer as { vehicle_type: string } | null)?.vehicle_type ?? 'none'} className={inputCls}>
              <option value="none">None (on foot)</option><option value="cycle">Cycle</option><option value="bike">Bike</option><option value="car">Car</option>
            </select>
          </label>
        )}
      </SaveForm>
      {role === 'volunteer' && (
        <SaveForm action={async (fd:FormData)=>{'use server';if(!String(fd.get('lat')??'').trim()||!String(fd.get('lng')??'').trim())return {error:'Enter both coordinates.'};return updateVolunteerLocation(Number(fd.get('lat')),Number(fd.get('lng')));}} className="rounded-[24px] border bg-white p-6 shadow-soft space-y-3 dark:border-white/10 dark:bg-slate-900/60">
          <h2 className="font-display font-extrabold dark:text-white">Update live location</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Set your pickup starting point. Your exact location is kept private.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-sm font-bold dark:text-slate-200">Lat</span><input name="lat" type="number" step="0.000001" defaultValue={(volunteer as { current_lat: number | null } | null)?.current_lat ?? ''} className={inputCls} /></label>
            <label className="block"><span className="text-sm font-bold dark:text-slate-200">Lng</span><input name="lng" type="number" step="0.000001" defaultValue={(volunteer as { current_lng: number | null } | null)?.current_lng ?? ''} className={inputCls} /></label>
          </div>
        </SaveForm>
      )}
      {role==='ngo'&&<SaveForm action={updateNgoProfile}><h2 className="section-title">Your organisation</h2><p className="text-sm text-slate-500">These details help an administrator review your organisation before you claim food.</p>{[{key:'org_name',label:'Organisation name',required:true},{key:'contact_person',label:'Contact person',required:true},{key:'contact_phone',label:'Contact phone',required:true},{key:'address',label:'Organisation address',required:true},{key:'registration_no',label:'Registration number'},{key:'fssai_licence_no',label:'Food licence number, if applicable'},{key:'licence_not_required_note',label:'If not applicable, explain why'}].map(f=><label className="block" key={f.key}><span className="text-sm font-semibold">{f.label}</span><input className={inputCls} name={f.key} required={f.required} defaultValue={ngo?.[f.key]??''}/></label>)}</SaveForm>}
    </div>
  );
}
