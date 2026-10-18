import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { ImpactSummary } from '@/types/database';

export default async function HomePage() {
  let impact: ImpactSummary | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('public_impact').single();
    if (!error && data) impact = data as ImpactSummary;
  } catch { /* Unavailable counters must never be shown as invented impact. */ }
  return <div className="home-refresh">
    <section className="food-hero">
      <div className="hero-story">
        <span className="eyebrow"><span className="green-dot" /> GOOD FOOD. SHARED WITH CARE.</span>
        <h1>A little extra.<br />A whole lot of<br /><em>difference.</em></h1>
        <p>That extra meal can be someone’s next meal. Connect surplus food with local NGOs who collect it and distribute it with care.</p>
        <div className="hero-actions"><Link className="food-button primary" href="/donations/new">Share food <span aria-hidden>↗</span></Link><Link className="food-button secondary" href="/donations">Find food <span aria-hidden>→</span></Link></div>
        <div className="hero-footnote"><span className="mini-heart" aria-hidden>♡</span><span>For restaurants, communities & people who care.<br /><strong>A small action is a good place to start.</strong></span></div>
      </div>
      <div className="hero-photo-wrap">
        {/* Editorial photograph, never presented as a real donation or beneficiary. */}
        <img className="hero-food-photo" src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=85" alt="A colourful bowl of fresh vegetables and a prepared meal" fetchPriority="high" />
        <span className="photo-caption">GOOD FOOD DESERVES A SECOND CHANCE</span>
        <div className="meal-note"><span className="meal-note-icon" aria-hidden>↗</span><div><strong>From surplus to shared.</strong><p>One meal. One pickup. One connection.</p></div></div>
        <span className="hero-stamp" aria-hidden>less waste<br /><b>more care</b><span>✳</span></span>
      </div>
    </section>
    <div className="values-strip"><span>Food worth sharing</span><span aria-hidden>✳</span><span>People helping people</span><span aria-hidden>✳</span><span>Every handoff matters</span></div>
    <section className="home-section" id="how-it-works">
      <div className="section-heading"><div><span className="eyebrow">A SIMPLE WAY TO HELP</span><h2>Good intentions.<br />Real connections.</h2></div><p>You bring the food, your time, or your community.<br />Together, we help it go further.</p></div>
      <div className="journey-grid">
        {[{n:'01',icon:'↗',title:'Share what you have',text:'Post the food, quantity and pickup window. Let a local organisation know what’s available.',link:'Donate food',href:'/donations/new',tone:'peach'}, {n:'02',icon:'⌘',title:'Connect with an NGO',text:'NGOs claim a batch, check its label and collect directly from the lawn or donor.',link:'Join as an NGO',href:'/auth/signup',tone:'sage'}, {n:'03',icon:'♡',title:'Make the last mile count',text:'The NGO scans the QR and records servings, people reached and the distribution area.',link:'Join as an NGO',href:'/auth/signup',tone:'sand'}].map(x=><article className={`journey-card ${x.tone}`} key={x.n}><div className="journey-top"><span className="journey-icon" aria-hidden>{x.icon}</span><span>{x.n}</span></div><h3>{x.title}</h3><p>{x.text}</p><Link href={x.href}>{x.link}<span aria-hidden>↗</span></Link></article>)}
      </div>
    </section>
    <section className="purpose-section">
      <div className="purpose-visual"><img src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1000&q=80" alt="Fresh vegetables arranged at a food market" loading="lazy" /><span className="purpose-label">A little care goes a long way.</span></div>
      <div className="purpose-copy"><span className="eyebrow">BUILT AROUND PEOPLE</span><h2>More than a meal.<br />A bridge between us.</h2><p>Food4All India starts with a simple belief: good food and people who need it shouldn’t be so far apart.</p><p>We’re building a place for lawns, food donors and NGOs to find each other—and turn that belief into a collection, a recorded distribution, and a shared meal.</p><Link className="food-button primary" href="/auth/signup">Find your part <span aria-hidden>↗</span></Link><div className="care-detail"><span>✓ Clear pickup windows</span><span>✓ Private pickup addresses</span><span>✓ Recorded handovers</span></div></div>
    </section>
    <section className="impact-ribbon"><div><span className="eyebrow">SMALL ACTIONS ADD UP</span><h2>Our journey, so far.</h2><Link href="/impact">See the impact record →</Link></div>{impact ? <div className="impact-numbers">{[[impact.meals_served,'Servings recorded'],[impact.partner_ngos,'NGOs in handovers'],[impact.active_volunteers,'Volunteers on pickups']].map(([n,label])=><div key={label}><strong>{Number(n ?? 0).toLocaleString('en-IN')}</strong><span>{label}</span></div>)}</div>:<p className="impact-unavailable">The impact record is temporarily unavailable.<br />Every journey starts with a first meal.</p>}</section>
    <section className="closing-invite"><span className="eyebrow">THERE’S A PLACE FOR YOU HERE</span><h2>Let’s put good food<br />to <em>good use.</em></h2><Link className="food-button primary" href="/donations/new">Share your first meal <span aria-hidden>↗</span></Link><p>Run a community organisation? <Link href="/auth/signup">Join as an NGO →</Link></p></section>
    <p className="editorial-credit">Food photography: Unsplash. Images are illustrative, not live donation listings.</p>
  </div>;
}
