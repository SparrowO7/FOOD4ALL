import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DonationForm from '@/components/DonationForm';

export default async function EditDonationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const { data } = await supabase.from('donations').select('*').eq('id', id).single();
  if (!data) notFound();
  if ((data as { donor_id: string }).donor_id !== user.id) {
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if ((prof as { role: string } | null)?.role !== 'admin') redirect(`/donations/${id}`);
  }
  if ((data as { status: string }).status !== 'draft') redirect(`/donations/${id}`);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-black">Edit draft</h1>
      <DonationForm initial={data as never} donationId={id} />
    </div>
  );
}
