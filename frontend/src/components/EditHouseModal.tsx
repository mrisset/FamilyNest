import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { HouseDetail } from '../lib/api';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import RichEditor from './RichEditor';

interface Props {
  house: HouseDetail;
  onClose: () => void;
}

export default function EditHouseModal({ house, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: house.name,
    description: house.description ?? '',
    richDescription: (house as any).richDescription ?? '',
    address: house.address ?? '',
  });

  const mutation = useMutation({
    mutationFn: () => api.patch(`/houses/${house.id}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['house', house.id] });
      qc.invalidateQueries({ queryKey: ['houses'] });
      toast.success('Maison mise à jour');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl w-full max-w-2xl my-4 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-700">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Modifier la maison</h2>
          <button onClick={onClose} className="text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">Nom *</label>
            <input className="input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">Résumé court</label>
            <input className="input" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Affiché sur la carte de la maison" />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1.5 block">Description détaillée</label>
            <RichEditor
              content={form.richDescription}
              onChange={html => setForm(f => ({ ...f, richDescription: html }))}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">Adresse</label>
            <input className="input" value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="12 rue de la Paix, Paris" />
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button className="btn-primary flex-1" onClick={() => mutation.mutate()}
            disabled={!form.name.trim() || mutation.isPending}>
            {mutation.isPending ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
