import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { House } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useThemeStore } from '../store/theme';
import toast from 'react-hot-toast';
import { Plus, LogOut, Home, MapPin, Crown, UserCircle, Moon, Sun } from 'lucide-react';
import Logo from '../components/Logo';

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', address: '' });

  const { data: houses = [], isLoading } = useQuery<House[]>({
    queryKey: ['houses'],
    queryFn: () => api.get('/houses').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/houses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['houses'] });
      setShowCreate(false);
      setForm({ name: '', description: '', address: '' });
      toast.success('Maison créée !');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {});
    logout();
    qc.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900">
      <header className="bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 px-6 py-4 flex items-center justify-between">
        <Logo size="sm" />
        <div className="flex items-center gap-2">
          <button onClick={toggle}
            className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => navigate('/profile')}
            className="flex items-center gap-1.5 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-50 px-3 py-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-700 transition-all">
            <UserCircle size={16} />
            <span className="font-medium">{user?.displayName}</span>
          </button>
          <button onClick={handleLogout} className="btn-secondary flex items-center gap-1.5 !py-1.5">
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl text-stone-900 dark:text-stone-50">Mes maisons</h2>
            <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">Gérez vos espaces familiaux</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nouvelle maison
          </button>
        </div>

        {showCreate && (
          <div className="card p-6 mb-6 animate-fade-in">
            <h3 className="font-semibold text-stone-800 dark:text-stone-100 mb-4">Créer une maison</h3>
            <div className="space-y-3">
              <input className="input" placeholder="Nom de la maison *" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <input className="input" placeholder="Description" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <input className="input" placeholder="Adresse" value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              <div className="flex gap-2 pt-1">
                <button className="btn-primary" onClick={() => createMutation.mutate(form)}
                  disabled={!form.name.trim() || createMutation.isPending}>
                  {createMutation.isPending ? 'Création…' : 'Créer'}
                </button>
                <button className="btn-secondary" onClick={() => setShowCreate(false)}>Annuler</button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16 text-stone-400 dark:text-stone-500">Chargement…</div>
        ) : houses.length === 0 ? (
          <div className="text-center py-16">
            <Home size={40} className="mx-auto text-stone-300 dark:text-stone-600 mb-3" />
            <p className="text-stone-500 dark:text-stone-400">Aucune maison pour l'instant.</p>
            <p className="text-stone-400 dark:text-stone-500 text-sm mt-1">Créez-en une ou rejoignez-en une via un lien d'invitation.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {houses.map(house => (
              <button key={house.id} onClick={() => navigate(`/houses/${house.id}`)}
                className="card p-5 text-left hover:shadow-md hover:border-stone-300 dark:hover:border-stone-600 transition-all duration-200 animate-fade-in">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-stone-900 dark:text-stone-50 text-lg leading-tight">{house.name}</h3>
                  {house.role === 'owner' && (
                    <span className="flex items-center gap-1 text-xs bg-stone-800 text-amber-400 px-2 py-0.5 rounded-full font-medium">
                      <Crown size={10} /> Propriétaire
                    </span>
                  )}
                  {house.role === 'admin' && (
                    <span className="flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                      <Crown size={10} /> Admin
                    </span>
                  )}
                </div>
                {house.description && <p className="text-stone-500 dark:text-stone-400 text-sm mb-2 line-clamp-2">{house.description}</p>}
                {house.address && (
                  <div className="flex items-center gap-1 text-xs text-stone-400 dark:text-stone-500">
                    <MapPin size={11} /> {house.address}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
