import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import FormError from '../components/ui/FormError';
import Logo from '../components/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const submit = async () => {
    if (!email || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.user, data.token);
      const pendingInvite = sessionStorage.getItem('pending_invite');
      if (pendingInvite) {
        sessionStorage.removeItem('pending_invite');
        navigate(`/join/${pendingInvite}`);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center flex flex-col items-center gap-2">
          <Logo size="lg" />
          <p className="text-stone-500 dark:text-stone-400 text-sm">Connectez-vous à votre espace</p>
        </div>
        <div className="card p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1 block">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); }}
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
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <FormError message={error} />
          <button
            className="btn-primary w-full"
            onClick={submit}
            disabled={loading}
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </div>
        <p className="text-center text-sm text-stone-500 dark:text-stone-400 mt-4">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-stone-800 dark:text-stone-200 font-medium underline underline-offset-2">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}
