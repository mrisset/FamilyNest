import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';
import { Home, Users, Calendar } from 'lucide-react';

interface Preview {
  houseName: string;
  houseDescription?: string;
  membersCount: number;
  expiresAt: string;
  valid: boolean;
}

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const called = useRef(false);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [joinStatus, setJoinStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    api.get(`/invitations/${token}/preview`)
      .then(res => setPreview(res.data))
      .catch(e => setPreviewError(e.response?.data?.error ?? 'Invitation introuvable ou expirée'));
  }, [token]);

  useEffect(() => {
    if (!user || !preview?.valid || called.current) return;
    called.current = true;
    setJoinStatus('loading');

    api.post(`/invitations/${token}/accept`)
      .then(res => {
        setJoinStatus('success');
        toast.success(`Bienvenue dans "${preview.houseName}" !`);
        setTimeout(() => navigate(`/houses/${res.data.houseId}`), 1200);
      })
      .catch(e => {
        const err = e.response?.data?.error ?? 'Erreur inconnue';
        if (e.response?.status === 409) {
          setJoinStatus('success');
          toast('Vous êtes déjà membre de cette maison.');
          setTimeout(() => navigate('/'), 1000);
        } else {
          setJoinStatus('error');
          setJoinError(err);
        }
      });
  }, [user, preview, token]);

  if (previewError) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center p-4">
        <div className="text-center animate-fade-in max-w-sm">
          <div className="text-4xl mb-3">❌</div>
          <h2 className="text-2xl text-stone-900 dark:text-stone-50 mb-1">Invitation invalide</h2>
          <p className="text-stone-500 dark:text-stone-400 mb-5">{previewError}</p>
          <Link to="/" className="btn-primary">Retour à l'accueil</Link>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center p-4">
        <p className="text-stone-400 dark:text-stone-500 animate-pulse">Chargement de l'invitation…</p>
      </div>
    );
  }

  if (joinStatus === 'loading' || joinStatus === 'success') {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center p-4">
        <div className="text-center animate-fade-in">
          <div className="text-4xl mb-3">{joinStatus === 'success' ? '🏠' : '⏳'}</div>
          <h2 className="text-2xl text-stone-900 dark:text-stone-50 mb-1">
            {joinStatus === 'success' ? 'Bienvenue !' : 'Rejoindre…'}
          </h2>
          <p className="text-stone-500 dark:text-stone-400">
            {joinStatus === 'success' ? 'Redirection en cours…' : `Accès à "${preview.houseName}"…`}
          </p>
        </div>
      </div>
    );
  }

  if (joinStatus === 'error') {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center p-4">
        <div className="text-center animate-fade-in max-w-sm">
          <div className="text-4xl mb-3">❌</div>
          <h2 className="text-2xl text-stone-900 dark:text-stone-50 mb-1">Impossible de rejoindre</h2>
          <p className="text-stone-500 dark:text-stone-400 mb-5">{joinError}</p>
          <Link to="/" className="btn-primary">Retour à l'accueil</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-6 text-center">
          <h1 className="text-3xl text-stone-900 dark:text-stone-50 mb-1">FamilyNest</h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm">Vous avez été invité</p>
        </div>

        <div className="card p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              <Home size={22} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900 dark:text-stone-50 text-lg">{preview.houseName}</h2>
              {preview.houseDescription && (
                <p className="text-stone-500 dark:text-stone-400 text-sm">{preview.houseDescription}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-stone-500 dark:text-stone-400 border-t border-stone-100 dark:border-stone-700 pt-4">
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              {preview.membersCount} membre{preview.membersCount > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              Expire le {new Date(preview.expiresAt).toLocaleDateString('fr-FR')}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Link
            to="/login"
            onClick={() => sessionStorage.setItem('pending_invite', token ?? '')}
            className="btn-primary w-full block text-center"
          >
            Se connecter pour rejoindre
          </Link>
          <Link
            to="/register"
            onClick={() => sessionStorage.setItem('pending_invite', token ?? '')}
            className="btn-secondary w-full block text-center"
          >
            Créer un compte
          </Link>
        </div>
      </div>
    </div>
  );
}
