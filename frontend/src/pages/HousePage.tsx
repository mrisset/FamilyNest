import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, FLAG_ICONS, FLAG_LABELS } from '../lib/api';
import type { HouseDetail, Channel, ChannelFlag } from '../lib/api';
import ChatPanel from '../components/ChatPanel';
import ReservationsPanel from '../components/ReservationsPanel';
import MembersPanel from '../components/MembersPanel';
import EditHouseModal from '../components/EditHouseModal';
import { ArrowLeft, Plus, Hash, CalendarDays, Users, X, Settings, Pencil, Trash2, Info, LogOut, UserCircle, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useThemeStore } from '../store/theme';
import RichEditor from '../components/RichEditor';
import clsx from 'clsx';
import toast from 'react-hot-toast';

type Tab = 'chat' | 'reservations' | 'members' | 'info';

export default function HousePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { logout } = useAuthStore();
  const { theme, toggle } = useThemeStore();

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {});
    logout();
    qc.clear();
    navigate('/login');
  };

  const [activeTab, setActiveTab] = useState<Tab>('reservations');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: '', flag: 'discussion' as ChannelFlag });
  const [showEditHouse, setShowEditHouse] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editChannelForm, setEditChannelForm] = useState({ name: '', flag: 'discussion' as ChannelFlag });

  const { data: house, isLoading } = useQuery<HouseDetail>({
    queryKey: ['house', id],
    queryFn: () => api.get(`/houses/${id}`).then(r => r.data),
  });

  const selectedChannel = useMemo(() => {
    if (!house?.channels?.length) return null;
    if (selectedChannelId) {
      const found = house.channels.find(c => c.id === selectedChannelId);
      if (found) return found;
    }
    return house.channels[0];
  }, [house?.channels, selectedChannelId]);

  const createChannelMutation = useMutation({
    mutationFn: (data: typeof newChannel) => api.post(`/houses/${id}/channels`, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['house', id] });
      setSelectedChannelId(res.data.id);
      setShowNewChannel(false);
      setNewChannel({ name: '', flag: 'discussion' });
      toast.success('Canal créé !');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  const editChannelMutation = useMutation({
    mutationFn: () => api.patch(`/channels/${editingChannel!.id}`, editChannelForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['house', id] });
      setEditingChannel(null);
      toast.success('Canal mis à jour');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  const deleteChannelMutation = useMutation({
    mutationFn: (channelId: string) => api.delete(`/channels/${channelId}`),
    onSuccess: (_, channelId) => {
      if (selectedChannelId === channelId) setSelectedChannelId(null);
      qc.invalidateQueries({ queryKey: ['house', id] });
      toast.success('Canal supprimé');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  if (isLoading) return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center text-stone-400 dark:text-stone-500">
      Chargement…
    </div>
  );

  if (!house) return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center">
      <div className="text-center">
        <p className="text-stone-500 dark:text-stone-400 mb-3">Maison introuvable ou accès refusé.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Retour</button>
      </div>
    </div>
  );

  const flags: ChannelFlag[] = ['discussion', 'problem', 'maintenance', 'announcement', 'other'];

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex flex-col">
      {/* Top bar */}
      <header className="bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        {/* Gauche : retour + nom de la maison */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button onClick={() => navigate('/')} className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors flex-shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-50 leading-tight truncate">{house.name}</h1>
              {(house.myRole === 'admin' || house.myRole === 'owner') && (
                <button onClick={() => setShowEditHouse(true)}
                  className="text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 transition-colors flex-shrink-0 p-0.5">
                  <Settings size={14} />
                </button>
              )}
            </div>
            {house.address && <p className="text-xs text-stone-400 dark:text-stone-500 truncate">{house.address}</p>}
          </div>
        </div>

        {/* Centre : navigation par onglets */}
        <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-700 rounded-xl p-1 flex-shrink-0">
          {([
            { key: 'reservations', icon: CalendarDays,  label: 'Réservations' },
            { key: 'info',         icon: Info,          label: 'Infos' },
            { key: 'chat',         icon: Hash,          label: 'Chat' },
            { key: 'members',      icon: Users,         label: 'Membres' },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                activeTab === key
                  ? 'bg-white dark:bg-stone-600 text-stone-900 dark:text-stone-50 shadow-sm'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              )}>
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Droite : thème + profil + déconnexion */}
        <div className="flex items-center gap-1 flex-1 justify-end">
          <button onClick={toggle}
            className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => navigate('/profile')}
            className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
            title="Paramètres du compte">
            <UserCircle size={18} />
          </button>
          <button onClick={handleLogout}
            className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Déconnexion">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar canaux */}
        {activeTab === 'chat' && (
          <aside className="w-52 flex-shrink-0 bg-stone-900 dark:bg-stone-950 flex flex-col">
            <div className="px-3 pt-4 pb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Canaux</span>
              {house.myRole === 'admin' || house.myRole === 'owner' && (
                <button onClick={() => { setShowNewChannel(v => !v); setEditingChannel(null); }}
                  className="text-stone-400 hover:text-white transition-colors">
                  <Plus size={14} />
                </button>
              )}
            </div>

            {showNewChannel && (
              <div className="mx-2 mb-2 p-2 bg-stone-800 rounded-xl space-y-2 animate-fade-in">
                <input
                  className="w-full bg-stone-700 text-white text-xs px-2 py-1.5 rounded-lg placeholder:text-stone-500 focus:outline-none"
                  placeholder="Nom du canal"
                  value={newChannel.name}
                  onChange={e => setNewChannel(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && createChannelMutation.mutate(newChannel)}
                  autoFocus
                />
                <select
                  className="w-full bg-stone-700 text-white text-xs px-2 py-1.5 rounded-lg focus:outline-none"
                  value={newChannel.flag}
                  onChange={e => setNewChannel(f => ({ ...f, flag: e.target.value as ChannelFlag }))}>
                  {flags.map(f => <option key={f} value={f}>{FLAG_ICONS[f]} {FLAG_LABELS[f]}</option>)}
                </select>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => createChannelMutation.mutate(newChannel)}
                    disabled={!newChannel.name.trim() || createChannelMutation.isPending}
                    className="flex-1 bg-amber-500 text-white text-xs py-1.5 rounded-lg font-medium hover:bg-amber-400 transition-colors disabled:opacity-50">
                    Créer
                  </button>
                  <button onClick={() => setShowNewChannel(false)}
                    className="bg-stone-700 text-stone-400 text-xs px-2 py-1.5 rounded-lg hover:text-white transition-colors">
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}

            {editingChannel && (
              <div className="mx-2 mb-2 p-2 bg-stone-800 rounded-xl space-y-2 animate-fade-in">
                <p className="text-xs text-stone-400 font-medium">Modifier le canal</p>
                <input
                  className="w-full bg-stone-700 text-white text-xs px-2 py-1.5 rounded-lg focus:outline-none"
                  value={editChannelForm.name}
                  onChange={e => setEditChannelForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
                <select
                  className="w-full bg-stone-700 text-white text-xs px-2 py-1.5 rounded-lg focus:outline-none"
                  value={editChannelForm.flag}
                  onChange={e => setEditChannelForm(f => ({ ...f, flag: e.target.value as ChannelFlag }))}>
                  {flags.map(f => <option key={f} value={f}>{FLAG_ICONS[f]} {FLAG_LABELS[f]}</option>)}
                </select>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => editChannelMutation.mutate()}
                    disabled={!editChannelForm.name.trim() || editChannelMutation.isPending}
                    className="flex-1 bg-amber-500 text-white text-xs py-1.5 rounded-lg font-medium hover:bg-amber-400 disabled:opacity-50">
                    Sauver
                  </button>
                  <button onClick={() => setEditingChannel(null)}
                    className="bg-stone-700 text-stone-400 text-xs px-2 py-1.5 rounded-lg hover:text-white transition-colors">
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
              {house.channels.map(ch => (
                <div key={ch.id}
                  className={clsx(
                    'group flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all cursor-pointer',
                    selectedChannel?.id === ch.id ? 'bg-stone-700' : 'hover:bg-stone-800'
                  )}
                  onClick={() => {
                    setSelectedChannelId(ch.id);
                    setEditingChannel(null);
                    setShowNewChannel(false);
                  }}>
                  <span className="text-xs w-4 text-center flex-shrink-0">{FLAG_ICONS[ch.flag]}</span>
                  <span className={clsx(
                    'flex-1 truncate text-sm',
                    selectedChannel?.id === ch.id ? 'text-white' : 'text-stone-400 group-hover:text-stone-200'
                  )}>
                    {ch.name}
                  </span>
                  {house.myRole === 'admin' || house.myRole === 'owner' && (
                    <div className="hidden group-hover:flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setEditingChannel(ch);
                          setEditChannelForm({ name: ch.name, flag: ch.flag });
                          setShowNewChannel(false);
                        }}
                        className="p-1 text-stone-500 hover:text-white transition-colors rounded">
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Supprimer #${ch.name} et tous ses messages ?`)) {
                            deleteChannelMutation.mutate(ch.id);
                          }
                        }}
                        className="p-1 text-stone-500 hover:text-red-400 transition-colors rounded">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Contenu principal */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'chat' && (
            selectedChannel
              ? <ChatPanel key={selectedChannel.id} channel={selectedChannel} />
              : (
                <div className="flex-1 flex items-center justify-center text-stone-400 dark:text-stone-500 text-sm flex-col gap-2">
                  <Hash size={28} className="opacity-30" />
                  <p>Aucun canal dans cette maison</p>
                </div>
              )
          )}
          {activeTab === 'reservations' && <ReservationsPanel house={house} />}
          {activeTab === 'members' && <MembersPanel house={house} />}
          {activeTab === 'info' && (
            <div className="flex-1 overflow-y-auto p-6">
              {(house as any).richDescription ? (
                <RichEditor
                  content={(house as any).richDescription}
                  onChange={() => {}}
                  editable={false}
                />
              ) : (
                <div className="text-center py-16 text-stone-400 dark:text-stone-500 text-sm">
                  <Info size={32} className="mx-auto mb-2 opacity-30" />
                  <p>Aucune description détaillée</p>
                  {house.myRole === 'admin' || house.myRole === 'owner' && (
                    <p className="text-xs mt-1 text-stone-300 dark:text-stone-600">
                      Ajoutez-en une via le bouton ⚙ en haut
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {showEditHouse && <EditHouseModal house={house} onClose={() => setShowEditHouse(false)} />}
    </div>
  );
}
