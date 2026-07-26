'use client';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

export default function DeleteButton({ id }: { id: number }) {
  const router = useRouter();
  const del = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm('Supprimer cette surveillance et tout son historique ?')) return;
    await fetch(`/api/watches?id=${id}`, { method: 'DELETE' });
    router.refresh();
  };
  return (
    <button onClick={del} className="p-1.5 rounded-lg hover:bg-[#FF453A]/10 text-[#FF453A]" aria-label="Supprimer">
      <Trash2 size={14} />
    </button>
  );
}
