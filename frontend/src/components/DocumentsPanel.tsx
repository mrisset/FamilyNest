import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { HouseDetail } from '../lib/api';
import { FileText, Upload, Trash2, Download, File, ImageIcon, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Document {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedByUser?: { displayName: string } | null;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function DocIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') return <FileText size={20} className="text-red-500" />;
  if (mimeType.startsWith('image/')) return <ImageIcon size={20} className="text-blue-500" />;
  return <File size={20} className="text-stone-400 dark:text-stone-500" />;
}

interface Props { house: HouseDetail }

export default function DocumentsPanel({ house }: Props) {
  const qc = useQueryClient();
  const isAdmin = house.myRole === 'admin';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery<Document[]>({
    queryKey: ['documents', house.id],
    queryFn: () => api.get(`/houses/${house.id}/documents`).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => api.delete(`/documents/${docId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', house.id] });
      toast.success('Document supprimé');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (file.size > 20 * 1024 * 1024) {
      setUploadError('Fichier trop volumineux (max 20 Mo)');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/houses/${house.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      qc.invalidateQueries({ queryKey: ['documents', house.id] });
      toast.success('Document ajouté');
    } catch (err: any) {
      setUploadError(err.response?.data?.error ?? "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const download = (doc: Document) => {
    const token = localStorage.getItem('fn_token');
    const a = document.createElement('a');
    a.href = `/api/documents/${doc.id}/download`;
    fetch(`/api/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = doc.filename;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('Erreur lors du téléchargement'));
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-stone-500 dark:text-stone-400" />
          <span className="font-medium text-stone-900 dark:text-stone-50">Documents</span>
          {docs.length > 0 && (
            <span className="text-xs text-stone-400 dark:text-stone-500">({docs.length})</span>
          )}
        </div>
        {isAdmin && (
          <label className={clsx('btn-primary !py-1.5 flex items-center gap-1.5 cursor-pointer text-sm',
            uploading && 'opacity-50 pointer-events-none')}>
            <Upload size={14} />
            {uploading ? 'Envoi…' : 'Ajouter'}
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.gif"
              onChange={handleUpload}
            />
          </label>
        )}
      </div>

      <div className="p-4 space-y-3">
        {uploadError && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-3 py-2.5 rounded-xl">
            <AlertCircle size={14} />
            {uploadError}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-stone-400 dark:text-stone-500 text-sm">Chargement…</div>
        ) : docs.length === 0 ? (
          <div className="text-center py-12 text-stone-400 dark:text-stone-500 text-sm">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p>Aucun document</p>
            {isAdmin && <p className="text-xs mt-1 text-stone-300 dark:text-stone-600">Cliquez sur "Ajouter" pour déposer un fichier</p>}
          </div>
        ) : (
          docs.map(doc => (
            <div key={doc.id} className="card p-3 flex items-center gap-3 group animate-fade-in">
              <div className="flex-shrink-0">
                <DocIcon mimeType={doc.mimeType} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-900 dark:text-stone-50 truncate">{doc.filename}</p>
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  {formatBytes(doc.sizeBytes)}
                  {doc.uploadedByUser && ` · ${doc.uploadedByUser.displayName}`}
                  {' · '}{format(new Date(doc.createdAt), 'd MMM yyyy', { locale: fr })}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => download(doc)}
                  className="p-1.5 text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors"
                  title="Télécharger">
                  <Download size={14} />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer "${doc.filename}" ?`)) deleteMutation.mutate(doc.id);
                    }}
                    className="p-1.5 text-stone-400 dark:text-stone-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Supprimer">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        <p className="text-xs text-stone-300 dark:text-stone-600 text-center pt-2">
          Formats acceptés : PDF, Word, Excel, images, texte · Max 20 Mo
        </p>
      </div>
    </div>
  );
}
