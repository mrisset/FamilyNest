import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import FormError from '../components/ui/FormError';
import Logo from '../components/Logo';

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setError(null);
  };

  const submit = async () => {
    if (!form.displayName || !form.email || !form.password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    if (form.password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      setAuth(data.user, data.token);
      const pendingInvite = sessionStorage.getItem('pending_invite');
      if (pendingInvite) {
        sessionStorage.removeItem('pending_invite');
        navigate(`/join/${pendingInvite}`);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Erreur lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center flex flex-col items-center gap-2">
          <Logo size="lg" />
          <p className="text-stone-500 dark:text-stone-400 text-sm">Créez votre compte</p>
        </div>
        <div className="card p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">Prénom / Pseudo</label>
            <input
              className="input"
              value={form.displayName}
              onChange={set('displayName')}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Marie Dupont"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={set('email')}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="vous@exemple.fr"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">Mot de passe</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={set('password')}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="8 caractères minimum"
              autoComplete="new-password"
            />
          </div>
          <FormError message={error} />
          <button className="btn-primary w-full" onClick={submit} disabled={loading}>
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </div>
        <p className="text-center text-sm text-stone-500 dark:text-stone-400 mt-4">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-stone-800 dark:text-stone-200 font-medium underline underline-offset-2">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
