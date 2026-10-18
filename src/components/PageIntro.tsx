import Link from 'next/link';
export default function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: { href: string; label: string } }) {
  return <header className="page-intro"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <Link className="food-button primary" href={action.href}>{action.label}<span aria-hidden>↗</span></Link>}</header>;
}
