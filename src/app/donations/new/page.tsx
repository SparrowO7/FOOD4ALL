import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DonationForm from '@/components/DonationForm';

export default async function NewDonationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-black">Create a donation (draft)</h1>
      <p className="text-sm text-slate-600">Save as draft, then publish when ready. Publish requires <code>best_before</code> in the future.</p>
      <DonationForm />
    </div>
  );
}
