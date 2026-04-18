import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Reservation, HouseDetail } from '../lib/api';
import { useAuthStore } from '../store/auth';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, parseISO,
  addMonths, subMonths, isBefore, isAfter, isSameDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Check, X, CalendarDays, List, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  approved:  'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  rejected:  'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  cancelled: 'bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', approved: 'Approuvée', rejected: 'Refusée', cancelled: 'Annulée',
};
const BAR_COLORS: Record<string, string> = {
  pending:   'bg-amber-400 text-white',
  approved:  'bg-green-500 text-white',
  rejected:  'bg-red-300 text-white',
  cancelled: 'bg-stone-300 text-stone-500',
};
const LEGEND_COLORS: Record<string, string> = {
  pending: 'bg-amber-400', approved: 'bg-green-500',
  rejected: 'bg-red-300',  cancelled: 'bg-stone-300',
};

function getWeeks(month: Date): Date[][] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end   = endOfWeek(endOfMonth(month),   { weekStartsOn: 1 });
  const days  = eachDayOfInterval({ start, end });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function getBarCols(res: Reservation, week: Date[]): { start: number; end: number } {
  const s = parseISO(res.startDate);
  const e = parseISO(res.endDate);
  const cs = isBefore(s, week[0]) ? week[0] : s;
  const ce = isAfter(e, week[6])  ? week[6] : e;
  return {
    start: week.findIndex(d => isSameDay(d, cs)),
    end:   week.findIndex(d => isSameDay(d, ce)),
  };
}

function assignLanes(items: Array<{ res: Reservation; start: number; end: number }>) {
  const laneEnds: number[] = [];
  return items.map(item => {
    let lane = laneEnds.findIndex(e => e < item.start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(item.end); }
    else laneEnds[lane] = item.end;
    return { ...item, lane };
  });
}

interface Props { house: HouseDetail }

export default function ReservationsPanel({ house }: Props) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = house.myRole === 'admin' || house.myRole === 'owner';
  const [view, setView] = useState<'list' | 'calendar'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ startDate: '', endDate: '', guestCount: '', notes: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ startDate: '', endDate: '', guestCount: '', notes: '' });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedCalRes, setSelectedCalRes] = useState<Reservation | null>(null);
  const [formErrors, setFormErrors] = useState<{ startDate?: string; endDate?: string; guestCount?: string }>({});
  const [editFormErrors, setEditFormErrors] = useState<{ startDate?: string; endDate?: string; guestCount?: string }>({});

  function validateDates(startDate: string, endDate: string, guestCount: string) {
    const errors: { startDate?: string; endDate?: string; guestCount?: string } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!startDate) {
      errors.startDate = 'La date d\'arrivée est requise.';
    } else if (new Date(startDate) < today) {
      errors.startDate = 'La date d\'arrivée ne peut pas être dans le passé.';
    }
    if (!endDate) {
      errors.endDate = 'La date de départ est requise.';
    } else if (startDate && new Date(endDate) < new Date(startDate)) {
      errors.endDate = 'La date de départ doit être égale ou postérieure à la date d\'arrivée.';
    }
    if (!guestCount || parseInt(guestCount) < 1) {
      errors.guestCount = 'Le nombre de personnes est requis.';
    }
    return errors;
  }

  const { data: reservations = [], error } = useQuery<Reservation[]>({
    queryKey: ['reservations', house.id],
    queryFn: () => api.get(`/houses/${house.id}/reservations`).then(r => r.data),
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post(`/houses/${house.id}/reservations`, {
      ...data,
      guestCount: data.guestCount ? parseInt(data.guestCount) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations', house.id] });
      setShowForm(false);
      setForm({ startDate: '', endDate: '', guestCount: '', notes: '' });
      toast.success('Demande envoyée !');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  const editMutation = useMutation({
    mutationFn: (data: typeof editForm) => api.put(`/reservations/${editingId}`, {
      ...data,
      guestCount: data.guestCount ? parseInt(data.guestCount) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations', house.id] });
      setEditingId(null);
      toast.success('Réservation modifiée');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) =>
      api.patch(`/reservations/${id}`, { status, rejectionReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations', house.id] });
      setRejectingId(null);
      setRejectReason('');
      setSelectedCalRes(null);
      toast.success('Réservation mise à jour');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-2 text-stone-400 text-sm p-8">
        <span className="text-2xl">⚠️</span>
        <p>Impossible de charger les réservations.</p>
        <p className="text-xs text-stone-300">{(error as any)?.response?.data?.error ?? 'Erreur réseau'}</p>
      </div>
    );
  }

  const weeks = getWeeks(currentMonth);
  const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-stone-500 dark:text-stone-400" />
          <span className="font-medium text-stone-900 dark:text-stone-50">Réservations</span>
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-700 rounded-lg p-1">
            <button
              onClick={() => setView('calendar')}
              className={clsx('p-1.5 rounded-md transition-colors', view === 'calendar' ? 'bg-white dark:bg-stone-600 shadow-sm text-stone-900 dark:text-stone-50' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200')}
              title="Vue calendrier"
            >
              <CalendarDays size={14} />
            </button>
            <button
              onClick={() => setView('list')}
              className={clsx('p-1.5 rounded-md transition-colors', view === 'list' ? 'bg-white dark:bg-stone-600 shadow-sm text-stone-900 dark:text-stone-50' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200')}
              title="Vue liste"
            >
              <List size={14} />
            </button>
          </div>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary !py-1.5 flex items-center gap-1.5">
          <Plus size={14} /> Demander
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Formulaire */}
        {showForm && (
          <div className="card p-4 animate-fade-in space-y-3">
            <h3 className="font-medium text-stone-800 text-sm">Nouvelle demande</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Arrivée</label>
                <input type="date" className="input text-sm" value={form.startDate}
                  onChange={e => { setForm(f => ({ ...f, startDate: e.target.value })); setFormErrors(err => ({ ...err, startDate: undefined })); }} />
                {formErrors.startDate && <p className="text-xs text-red-500 mt-1">{formErrors.startDate}</p>}
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Départ</label>
                <input type="date" className="input text-sm" value={form.endDate}
                  onChange={e => { setForm(f => ({ ...f, endDate: e.target.value })); setFormErrors(err => ({ ...err, endDate: undefined })); }} />
                {formErrors.endDate && <p className="text-xs text-red-500 mt-1">{formErrors.endDate}</p>}
              </div>
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">Nombre de personnes</label>
              <input type="number" min={1} className="input text-sm" value={form.guestCount}
                onChange={e => { setForm(f => ({ ...f, guestCount: e.target.value })); setFormErrors(err => ({ ...err, guestCount: undefined })); }}
                placeholder="1" />
              {formErrors.guestCount && <p className="text-xs text-red-500 mt-1">{formErrors.guestCount}</p>}
            </div>
            <textarea className="input resize-none text-sm" rows={2}
              placeholder="Notes (optionnel)" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <div className="flex gap-2">
              <button className="btn-primary text-sm" onClick={() => {
                const errors = validateDates(form.startDate, form.endDate, form.guestCount);
                if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
                createMutation.mutate(form);
              }} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Envoi…' : 'Envoyer'}
              </button>
              <button className="btn-secondary text-sm" onClick={() => { setShowForm(false); setFormErrors({}); }}>Annuler</button>
            </div>
          </div>
        )}

        {/* ── VUE CALENDRIER ── */}
        {view === 'calendar' && (() => {
          const calendarReservations = reservations.filter(r => r.status !== 'cancelled' && r.status !== 'rejected');
          return (
          <div className="card overflow-hidden">
            {/* Navigation mois */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-700">
              <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
                className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="font-semibold text-stone-900 dark:text-stone-50 capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: fr })}
              </span>
              <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
                className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Légende */}
            <div className="flex flex-wrap gap-3 px-4 py-2 border-b border-stone-100 dark:border-stone-700">
              {(['pending', 'approved'] as const).map(key => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
                  <span className={clsx('w-3 h-3 rounded-sm flex-shrink-0', LEGEND_COLORS[key])} />
                  {STATUS_LABELS[key]}
                </div>
              ))}
            </div>

            {/* Jours de la semaine */}
            <div className="grid grid-cols-7 border-b border-stone-100 dark:border-stone-700">
              {DAY_LABELS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-stone-400 dark:text-stone-500 py-2">{d}</div>
              ))}
            </div>

            {/* Semaines */}
            {weeks.map((week, wi) => {
              const weekResItems = calendarReservations
                .filter(r => {
                  const s = parseISO(r.startDate);
                  const e = parseISO(r.endDate);
                  return !isAfter(s, week[6]) && !isBefore(e, week[0]);
                })
                .map(res => ({ res, ...getBarCols(res, week) }));

              const laned = assignLanes(weekResItems);
              const maxLane = laned.length > 0 ? Math.max(...laned.map(l => l.lane)) + 1 : 0;

              return (
                <div key={wi} className="border-b border-stone-100 dark:border-stone-700 last:border-b-0 min-h-[50px]">
                  {/* Numéros de jours */}
                  <div className="grid grid-cols-7">
                    {week.map((day, di) => (
                      <div
                        key={di}
                        className={clsx(
                          'text-left text-xs px-2 pt-2 pb-1 font-medium',
                          !isSameMonth(day, currentMonth) ? 'text-stone-300 dark:text-stone-600' : 'text-stone-700 dark:text-stone-200',
                          isToday(day) && 'text-amber-600 font-bold',
                        )}
                      >
                        {isToday(day) ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
                            {format(day, 'd')}
                          </span>
                        ) : (
                          format(day, 'd')
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Barres de réservation */}
                  {maxLane > 0 && (
                    <div
                      className="grid grid-cols-7 px-1 pb-1.5 gap-y-0.5"
                      style={{ gridTemplateRows: `repeat(${maxLane}, 20px)` }}
                    >
                      {laned.map(({ res, start, end, lane }) => (
                        <div
                          key={res.id}
                          onClick={() => setSelectedCalRes(res)}
                          className={clsx(
                            'rounded text-xs leading-5 px-1.5 truncate cursor-pointer select-none hover:brightness-95 transition-[filter]',
                            BAR_COLORS[res.status],
                            start > 0 ? 'rounded-l-none' : '',
                            end < 6 ? '' : 'rounded-r-none',
                          )}
                          style={{
                            gridRow: lane + 1,
                            gridColumnStart: start + 1,
                            gridColumnEnd: end + 2,
                            marginLeft: start > 0 ? 0 : 2,
                            marginRight: end < 6 ? 0 : 2,
                          }}
                        >
                          {res.requestedByUser?.displayName ?? '?'}
                          {res.guestCount ? ` · ${res.guestCount}p` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          </div>
          );
        })()}

        {/* ── VUE LISTE ── */}
        {view === 'list' && (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const upcoming = reservations.filter(r => parseISO(r.endDate) >= today);
          const past     = reservations.filter(r => parseISO(r.endDate) <  today);

          const renderCard = (res: Reservation) => {
            const requester = res.requestedByUser ?? { id: '', displayName: 'Compte supprimé' };
            const isRequester = requester.id === user?.id;
            const canEdit = isRequester && (res.status === 'pending' || res.status === 'approved') && parseISO(res.endDate) >= today;
            const isEditing = editingId === res.id;

            return (
              <div key={res.id} className="card p-4 animate-fade-in">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-stone-900 text-sm">
                      {format(parseISO(res.startDate), 'd MMM', { locale: fr })}
                      {' → '}
                      {format(parseISO(res.endDate), 'd MMM yyyy', { locale: fr })}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Demandé par{' '}
                      <span className={clsx('font-medium', !res.requestedByUser && 'italic text-stone-300')}>
                        {requester.displayName}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLES[res.status])}>
                      {STATUS_LABELS[res.status]}
                    </span>
                    {canEdit && !isEditing && (
                      <button
                        onClick={() => { setEditingId(res.id); setEditForm({ startDate: res.startDate, endDate: res.endDate, guestCount: res.guestCount?.toString() ?? '', notes: res.notes ?? '' }); }}
                        className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                        title="Modifier"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {!isEditing && res.guestCount && (
                  <p className="text-xs text-stone-500 mb-1">{res.guestCount} personne{res.guestCount > 1 ? 's' : ''}</p>
                )}
                {!isEditing && res.notes && <p className="text-xs text-stone-500 italic mb-2">{res.notes}</p>}
                {!isEditing && res.status === 'rejected' && res.rejectionReason && (
                  <p className="text-xs text-red-500 italic mb-2">Motif : {res.rejectionReason}</p>
                )}

                {/* Formulaire d'édition inline */}
                {isEditing && (
                  <div className="mt-2 space-y-2 border-t border-stone-100 pt-3">
                    {res.status === 'approved' && (
                      <p className="text-xs text-amber-600 font-medium">La réservation repassera en attente après modification.</p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-stone-500 mb-1 block">Arrivée</label>
                        <input type="date" className="input text-sm" value={editForm.startDate}
                          onChange={e => { setEditForm(f => ({ ...f, startDate: e.target.value })); setEditFormErrors(err => ({ ...err, startDate: undefined })); }} />
                        {editFormErrors.startDate && <p className="text-xs text-red-500 mt-1">{editFormErrors.startDate}</p>}
                      </div>
                      <div>
                        <label className="text-xs text-stone-500 mb-1 block">Départ</label>
                        <input type="date" className="input text-sm" value={editForm.endDate}
                          onChange={e => { setEditForm(f => ({ ...f, endDate: e.target.value })); setEditFormErrors(err => ({ ...err, endDate: undefined })); }} />
                        {editFormErrors.endDate && <p className="text-xs text-red-500 mt-1">{editFormErrors.endDate}</p>}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-stone-500 mb-1 block">Nombre de personnes</label>
                      <input type="number" min={1} className="input text-sm" value={editForm.guestCount}
                        onChange={e => { setEditForm(f => ({ ...f, guestCount: e.target.value })); setEditFormErrors(err => ({ ...err, guestCount: undefined })); }}
                        placeholder="1" />
                      {editFormErrors.guestCount && <p className="text-xs text-red-500 mt-1">{editFormErrors.guestCount}</p>}
                    </div>
                    <textarea className="input resize-none text-sm" rows={2}
                      placeholder="Notes (optionnel)" value={editForm.notes}
                      onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                    <div className="flex gap-2">
                      <button className="btn-primary text-sm"
                        onClick={() => {
                          const errors = validateDates(editForm.startDate, editForm.endDate, editForm.guestCount);
                          if (Object.keys(errors).length > 0) { setEditFormErrors(errors); return; }
                          editMutation.mutate(editForm);
                        }}
                        disabled={editMutation.isPending}>
                        {editMutation.isPending ? 'Envoi…' : 'Sauvegarder'}
                      </button>
                      <button className="btn-secondary text-sm" onClick={() => { setEditingId(null); setEditFormErrors({}); }}>Annuler</button>
                    </div>
                  </div>
                )}

                {!isEditing && isAdmin && res.status === 'pending' && rejectingId !== res.id && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => updateMutation.mutate({ id: res.id, status: 'approved' })}
                      className="btn-primary !py-1 !px-3 flex items-center gap-1 text-xs">
                      <Check size={12} /> Approuver
                    </button>
                    <button onClick={() => { setRejectingId(res.id); setRejectReason(''); }}
                      className="btn-danger !py-1 !px-3 flex items-center gap-1 text-xs">
                      <X size={12} /> Refuser
                    </button>
                  </div>
                )}
                {!isEditing && isAdmin && res.status === 'pending' && rejectingId === res.id && (
                  <div className="mt-2 space-y-2 border-t border-stone-100 pt-3">
                    <textarea
                      className="input resize-none text-sm"
                      rows={2}
                      placeholder="Motif du refus (optionnel)"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateMutation.mutate({ id: res.id, status: 'rejected', rejectionReason: rejectReason || undefined })}
                        disabled={updateMutation.isPending}
                        className="btn-danger text-sm !py-1 !px-3">
                        {updateMutation.isPending ? 'Envoi…' : 'Confirmer le refus'}
                      </button>
                      <button className="btn-secondary text-sm !py-1 !px-3" onClick={() => setRejectingId(null)}>Annuler</button>
                    </div>
                  </div>
                )}

                {!isEditing && isRequester && res.status === 'pending' && rejectingId !== res.id && (
                  <button onClick={() => updateMutation.mutate({ id: res.id, status: 'cancelled' })}
                    className="btn-secondary !py-1 !px-3 text-xs mt-1">
                    Annuler
                  </button>
                )}
              </div>
            );
          };

          if (reservations.length === 0) {
            return <div className="text-center py-12 text-stone-400 text-sm">Aucune réservation</div>;
          }

          return (
            <>
              {upcoming.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">À venir</p>
                  {upcoming.map(renderCard)}
                </div>
              )}
              {past.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Passées</p>
                  <div className="opacity-60 space-y-3">
                    {past.map(renderCard)}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Modal calendrier */}
      {selectedCalRes && (() => {
        const res = selectedCalRes;
        const isCalRejecting = rejectingId === res.id;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setSelectedCalRes(null); setRejectingId(null); setRejectReason(''); }}>
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
              {/* En-tête */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-stone-900">
                    {format(parseISO(res.startDate), 'd MMM', { locale: fr })}
                    {' → '}
                    {format(parseISO(res.endDate), 'd MMM yyyy', { locale: fr })}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Demandé par <span className="font-medium text-stone-600">{res.requestedByUser?.displayName ?? 'Compte supprimé'}</span>
                  </p>
                </div>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', STATUS_STYLES[res.status])}>
                  {STATUS_LABELS[res.status]}
                </span>
              </div>

              {/* Infos */}
              <div className="space-y-1">
                {res.guestCount && (
                  <p className="text-sm text-stone-600">{res.guestCount} personne{res.guestCount > 1 ? 's' : ''}</p>
                )}
                {res.notes && <p className="text-sm text-stone-500 italic">{res.notes}</p>}
                {res.status === 'rejected' && res.rejectionReason && (
                  <p className="text-sm text-red-500 italic">Motif : {res.rejectionReason}</p>
                )}
              </div>

              {/* Actions admin */}
              {isAdmin && res.status === 'pending' && !isCalRejecting && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => updateMutation.mutate({ id: res.id, status: 'approved' })}
                    disabled={updateMutation.isPending}
                    className="btn-primary !py-1.5 !px-3 flex items-center gap-1 text-sm">
                    <Check size={13} /> Approuver
                  </button>
                  <button
                    onClick={() => { setRejectingId(res.id); setRejectReason(''); }}
                    className="btn-danger !py-1.5 !px-3 flex items-center gap-1 text-sm">
                    <X size={13} /> Refuser
                  </button>
                </div>
              )}

              {isAdmin && res.status === 'pending' && isCalRejecting && (
                <div className="space-y-2 border-t border-stone-100 pt-3">
                  <textarea
                    className="input resize-none text-sm"
                    rows={2}
                    placeholder="Motif du refus (optionnel)"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateMutation.mutate({ id: res.id, status: 'rejected', rejectionReason: rejectReason || undefined })}
                      disabled={updateMutation.isPending}
                      className="btn-danger text-sm !py-1.5 !px-3">
                      {updateMutation.isPending ? 'Envoi…' : 'Confirmer le refus'}
                    </button>
                    <button className="btn-secondary text-sm !py-1.5 !px-3" onClick={() => setRejectingId(null)}>Annuler</button>
                  </div>
                </div>
              )}

              {!isAdmin && (
                <button className="btn-secondary text-sm w-full" onClick={() => { setSelectedCalRes(null); setRejectingId(null); }}>Fermer</button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
