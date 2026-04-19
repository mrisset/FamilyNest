import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { HouseDetail } from '../lib/api';
import { Crown, Users, Link2, Copy, UserMinus, Shield, ShieldOff, LogOut, KeyRound, Mail, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

interface Props { house: HouseDetail }

export default function MembersPanel({ house }: Props) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isOwner = house.myRole === 'owner';
  const isAdmin = house.myRole === 'admin' || house.myRole === 'owner';
  const qc = useQueryClient();
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const inviteMutation = useMutation({
    mutationFn: () => api.post(`/houses/${house.id}/invite`, { role: inviteRole }).then(r => r.data),
    onSuccess: (data) => {
      const link = `${window.location.origin}/join/${data.token}`;
      setInviteLink(link);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  const shareByEmail = () => {
    if (!inviteLink) return;
    const subject = encodeURIComponent(`Invitation à rejoindre "${house.name}" sur FamilyNest`);
    const body = encodeURIComponent(
      `Bonjour,\n\nTu es invité(e) à rejoindre la maison "${house.name}" sur FamilyNest.\n\nClique sur ce lien pour accepter l'invitation :\n${inviteLink}\n\nLe lien expire dans 7 jours.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const shareNative = async () => {
    if (!inviteLink) return;
    await navigator.share({
      title: `Rejoins "${house.name}" sur FamilyNest`,
      text: `Tu es invité(e) à rejoindre la maison "${house.name}" sur FamilyNest.`,
      url: inviteLink,
    });
  };

  const kickMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/houses/${house.id}/members/${userId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['house', house.id] }); toast.success('Membre retiré'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'member' }) =>
      api.patch(`/houses/${house.id}/members/${userId}`, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['house', house.id] }); toast.success('Rôle mis à jour'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  const transferMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/houses/${house.id}/transfer`, { userId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['house', house.id] }); toast.success('Titre de propriétaire cédé'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  const leaveMutation = useMutation({
    mutationFn: () => api.delete(`/houses/${house.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['houses'] });
      toast.success('Vous avez quitté la maison');
      navigate('/');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  const copyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    toast.success('Lien copié !');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 flex items-center gap-2">
        <Users size={16} className="text-stone-500 dark:text-stone-400" />
        <span className="font-medium text-stone-900 dark:text-stone-50">Membres</span>
        <span className="text-xs text-stone-400 dark:text-stone-500 ml-auto">
          {house.members.length} membre{house.members.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Invite */}
        {isAdmin && (
          <div className="card p-4">
            <p className="text-sm font-medium text-stone-800 dark:text-stone-100 mb-1">Inviter quelqu'un</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">Génère un lien valable 7 jours, à partager comme tu veux.</p>
            <div className="flex items-center gap-2">
              <select
                value={inviteRole}
                onChange={e => { setInviteRole(e.target.value as 'member' | 'admin'); setInviteLink(null); }}
                className="input text-sm py-1.5 w-auto"
              >
                <option value="member">Membre</option>
                {isOwner && <option value="admin">Admin</option>}
              </select>
              <button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}
                className="btn-secondary flex items-center gap-2 text-sm whitespace-nowrap">
                <Link2 size={14} />
                {inviteMutation.isPending ? 'Génération…' : 'Générer un lien'}
              </button>
            </div>
            {inviteLink && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2">
                  <span className="text-xs text-stone-600 dark:text-stone-300 truncate flex-1 font-mono">{inviteLink}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={copyLink}
                    className="btn-secondary flex items-center gap-1.5 text-xs">
                    <Copy size={12} /> Copier le lien
                  </button>
                  <button onClick={shareByEmail}
                    className="btn-secondary flex items-center gap-1.5 text-xs">
                    <Mail size={12} /> Envoyer par e-mail
                  </button>
                  {typeof navigator.share === 'function' && (
                    <button onClick={shareNative}
                      className="btn-secondary flex items-center gap-1.5 text-xs">
                      <Share2 size={12} /> Partager…
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Members list */}
        <div className="card divide-y divide-stone-100 dark:divide-stone-700 overflow-hidden">
          {house.members.map(m => {
            const isMe = m.user.id === user?.id;
            const isMemberOwner = m.role === 'owner';
            const isMemberAdmin = m.role === 'admin';
            const canKick = isAdmin && !isMe && !isMemberOwner && (isOwner || m.role === 'member');
            const canChangeRole = isOwner && !isMe && !isMemberOwner;
            const canTransfer = isOwner && !isMe && isMemberAdmin;
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-sm font-semibold text-stone-700 dark:text-stone-200 flex-shrink-0">
                  {m.user.displayName[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 dark:text-stone-50 truncate">
                    {m.user.displayName} {isMe && <span className="text-stone-400 dark:text-stone-500 font-normal">(vous)</span>}
                  </p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 truncate">{m.user.email}</p>
                </div>

                {isMemberOwner && (
                  <span className="flex items-center gap-1 text-xs bg-stone-800 text-amber-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                    <Crown size={10} /> Propriétaire
                  </span>
                )}
                {isMemberAdmin && (
                  <span className="flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                    <Shield size={10} /> Admin
                  </span>
                )}

                <div className="flex items-center gap-1 flex-shrink-0">
                  {canTransfer && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Céder le titre de propriétaire à ${m.user.displayName} ? Vous deviendrez administrateur.`)) {
                          transferMutation.mutate(m.user.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-stone-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                      title="Céder le titre de propriétaire"
                    >
                      <KeyRound size={14} />
                    </button>
                  )}
                  {canChangeRole && (
                    <button
                      onClick={() => roleMutation.mutate({ userId: m.user.id, role: isMemberAdmin ? 'member' : 'admin' })}
                      className={clsx('p-1.5 rounded-lg transition-colors',
                        isMemberAdmin
                          ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                          : 'text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-700 dark:hover:text-stone-200')}
                      title={isMemberAdmin ? 'Rétrograder en membre' : 'Promouvoir administrateur'}
                    >
                      {isMemberAdmin ? <ShieldOff size={14} /> : <Shield size={14} />}
                    </button>
                  )}
                  {canKick && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Expulser ${m.user.displayName} ?`)) {
                          kickMutation.mutate(m.user.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-stone-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                      title="Expulser"
                    >
                      <UserMinus size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quitter la maison */}
        <div className="pt-2">
          {!confirmLeave ? (
            <button onClick={() => setConfirmLeave(true)}
              className="flex items-center gap-2 text-sm text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 transition-colors">
              <LogOut size={14} /> Quitter cette maison
            </button>
          ) : (
            <div className="card p-4 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium mb-3">
                Confirmer ? Vous n'aurez plus accès à cette maison.
              </p>
              <div className="flex gap-2">
                <button onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending}
                  className="btn-danger text-sm">
                  {leaveMutation.isPending ? 'Départ…' : 'Oui, quitter'}
                </button>
                <button onClick={() => setConfirmLeave(false)} className="btn-secondary text-sm">Annuler</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
