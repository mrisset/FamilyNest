import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useThemeStore } from '../store/theme';
import { ArrowLeft, User, Lock, Trash2, AlertTriangle, Palette, Sun, Moon } from 'lucide-react';
import FormError from '../components/ui/FormError';
import FormSuccess from '../components/ui/FormSuccess';

type Section = 'profile' | 'password' | 'appearance' | 'delete';

export default function ProfilePage() {
  const { user, setAuth, logout } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('profile');

  // ── Profil ──────────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({ displayName: user?.displayName ?? '', email: user?.email ?? '' });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const profileMutation = useMutation({
    mutationFn: () => api.patch('/me', profile),
    onSuccess: (res) => {
      setAuth({ ...user!, ...res.data }, localStorage.getItem('fn_token')!);
      setProfileError(null);
      setProfileSuccess('Profil mis à jour avec succès.');
    },
    onError: (e: any) => {
      setProfileSuccess(null);
      setProfileError(e.response?.data?.error ?? 'Une erreur est survenue.');
    },
  });

  // ── Mot de passe ─────────────────────────────────────────────────────────────
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  const passwordMutation = useMutation({
    mutationFn: () => api.patch('/me/password', {
      currentPassword: pwd.currentPassword,
      newPassword: pwd.newPassword,
    }),
    onSuccess: (res) => {
      if (res.data?.token) {
        localStorage.setItem('fn_token', res.data.token);
        api.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      }
      setPwdError(null);
      setPwdSuccess('Mot de passe modifié. Les autres appareils ont été déconnectés.');
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
    },
    onError: (e: any) => {
      setPwdSuccess(null);
      setPwdError(e.response?.data?.error ?? 'Une erreur est survenue.');
    },
  });

  const submitPassword = () => {
    setPwdError(null);
    setPwdSuccess(null);
    if (!pwd.currentPassword) { setPwdError('Veuillez saisir votre mot de passe actuel.'); return; }
    if (pwd.newPassword.length < 8) { setPwdError('Le nouveau mot de passe doit faire au moins 8 caractères.'); return; }
    if (pwd.newPassword !== pwd.confirm) { setPwdError('Les deux mots de passe ne correspondent pas.'); return; }
    passwordMutation.mutate();
  };

  // ── Suppression ───────────────────────────────────────────────────────────────
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete('/me', { data: { password: deletePassword } }),
    onSuccess: () => { logout(); navigate('/login'); },
    onError: (e: any) => setDeleteError(e.response?.data?.error ?? 'Mot de passe incorrect.'),
  });

  const tabs = [
    { key: 'profile'    as Section, icon: User,    label: 'Profil' },
    { key: 'password'   as Section, icon: Lock,    label: 'Mot de passe' },
    { key: 'appearance' as Section, icon: Palette, label: 'Apparence' },
    { key: 'delete'     as Section, icon: Trash2,  label: 'Supprimer le compte' },
  ];

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900">
      <header className="bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Mon compte</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 flex gap-6">
        {/* Sidebar */}
        <nav className="w-44 flex-shrink-0 space-y-1">
          {tabs.map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setSection(key)}
              className={[
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all',
                section === key
                  ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700',
                key === 'delete' ? 'mt-4' : '',
              ].join(' ')}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 animate-fade-in">

          {/* ── Profil ── */}
          {section === 'profile' && (
            <div className="card p-6">
              <h2 className="text-xl text-stone-900 dark:text-stone-50 mb-5">Informations personnelles</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">Prénom / Pseudo</label>
                  <input className="input" value={profile.displayName}
                    onChange={e => { setProfile(p => ({ ...p, displayName: e.target.value })); setProfileError(null); setProfileSuccess(null); }} />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">Adresse email</label>
                  <input className="input" type="email" value={profile.email}
                    onChange={e => { setProfile(p => ({ ...p, email: e.target.value })); setProfileError(null); setProfileSuccess(null); }} />
                </div>
                <FormError message={profileError} />
                <FormSuccess message={profileSuccess} />
                <button className="btn-primary" onClick={() => profileMutation.mutate()}
                  disabled={profileMutation.isPending}>
                  {profileMutation.isPending ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          )}

          {/* ── Mot de passe ── */}
          {section === 'password' && (
            <div className="card p-6">
              <h2 className="text-xl text-stone-900 dark:text-stone-50 mb-5">Changer le mot de passe</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">Mot de passe actuel</label>
                  <input className="input" type="password" value={pwd.currentPassword}
                    onChange={e => { setPwd(p => ({ ...p, currentPassword: e.target.value })); setPwdError(null); setPwdSuccess(null); }}
                    placeholder="••••••••" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">Nouveau mot de passe</label>
                  <input className="input" type="password" value={pwd.newPassword}
                    onChange={e => { setPwd(p => ({ ...p, newPassword: e.target.value })); setPwdError(null); setPwdSuccess(null); }}
                    placeholder="8 caractères minimum" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">Confirmer le nouveau mot de passe</label>
                  <input className="input" type="password" value={pwd.confirm}
                    onChange={e => { setPwd(p => ({ ...p, confirm: e.target.value })); setPwdError(null); setPwdSuccess(null); }}
                    placeholder="••••••••" />
                </div>
                <FormError message={pwdError} />
                <FormSuccess message={pwdSuccess} />
                <button className="btn-primary" onClick={submitPassword}
                  disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending ? 'Modification…' : 'Changer le mot de passe'}
                </button>
              </div>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-4">
                Les autres appareils connectés seront déconnectés après ce changement.
              </p>
            </div>
          )}

          {/* ── Apparence ── */}
          {section === 'appearance' && (
            <div className="card p-6">
              <h2 className="text-xl text-stone-900 dark:text-stone-50 mb-5">Apparence</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">Choisissez le thème de l'interface.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => theme === 'dark' && toggle()}
                  className={[
                    'flex-1 flex flex-col items-center gap-2 px-4 py-5 rounded-xl border-2 transition-all',
                    theme === 'light'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600',
                  ].join(' ')}
                >
                  <Sun size={22} className={theme === 'light' ? 'text-amber-600' : 'text-stone-400 dark:text-stone-500'} />
                  <span className={`text-sm font-medium ${theme === 'light' ? 'text-amber-700 dark:text-amber-400' : 'text-stone-500 dark:text-stone-400'}`}>Clair</span>
                </button>
                <button
                  onClick={() => theme === 'light' && toggle()}
                  className={[
                    'flex-1 flex flex-col items-center gap-2 px-4 py-5 rounded-xl border-2 transition-all',
                    theme === 'dark'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600',
                  ].join(' ')}
                >
                  <Moon size={22} className={theme === 'dark' ? 'text-amber-500' : 'text-stone-400 dark:text-stone-500'} />
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-amber-700 dark:text-amber-400' : 'text-stone-500 dark:text-stone-400'}`}>Sombre</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Supprimer ── */}
          {section === 'delete' && (
            <div className="card p-6 border-red-200 dark:border-red-900">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-red-500" />
                <h2 className="text-xl text-stone-900 dark:text-stone-50">Supprimer mon compte</h2>
              </div>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">
                Cette action est <strong>irréversible</strong>. Toutes vos données seront supprimées.
                Vos maisons resteront si d'autres membres en font partie.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">
                    Tapez <span className="font-mono bg-stone-100 dark:bg-stone-700 px-1 rounded">SUPPRIMER</span> pour confirmer
                  </label>
                  <input className="input" value={deleteConfirm}
                    onChange={e => { setDeleteConfirm(e.target.value); setDeleteError(null); }}
                    placeholder="SUPPRIMER" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">Votre mot de passe</label>
                  <input className="input" type="password" value={deletePassword}
                    onChange={e => { setDeletePassword(e.target.value); setDeleteError(null); }}
                    placeholder="••••••••" />
                </div>
                <FormError message={deleteError} />
                <button className="btn-danger"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteConfirm !== 'SUPPRIMER' || !deletePassword || deleteMutation.isPending}>
                  {deleteMutation.isPending ? 'Suppression…' : 'Supprimer définitivement mon compte'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
