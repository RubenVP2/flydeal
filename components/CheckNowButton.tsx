'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export default function CheckNowButton({ id }: { id: number }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const run = async () => {
    setLoading(true);
    await fetch(`/api/check-now?id=${id}`, { method: 'POST' });
    router.refresh();
    setLoading(false);
  };
  return (
    <button onClick={run} disabled={loading}
      className="flex items-center gap-1.5 bg-accent text-white text-sm font-medium px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition">
      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      {loading ? 'Vérification…' : 'Vérifier maintenant'}
    </button>
  );
}
