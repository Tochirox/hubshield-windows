import { ShieldCheck } from 'lucide-react';
export default function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="brand"><span className="brand-mark"><ShieldCheck size={compact ? 17 : 20} strokeWidth={2.2}/></span>{!compact && <span className="brand-word">HUB<span>SHIELD</span></span>}</span>;
}
