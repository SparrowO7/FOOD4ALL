import Link from 'next/link';
export default function AuthFrame({children,signup=false}:{children:React.ReactNode;signup?:boolean}) {
 return <div className="auth-layout"><aside className="auth-story"><Link href="/" className="eyebrow">FOOD4ALL INDIA · THE COMMUNITY TABLE</Link><div><span className="auth-flower" aria-hidden>✳</span><h2>{signup ? 'Your small act.\nSomeone’s better day.' : 'Good to have\nyou back.'}</h2><p>Some of us have food to share. Some have time to give. Together, we can help a meal find its way.</p></div><span className="text-xs opacity-70">Share food. Give time. Build connections.</span></aside><section className="auth-content">{children}</section></div>;
}
