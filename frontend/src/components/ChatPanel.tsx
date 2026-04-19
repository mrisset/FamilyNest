import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, FLAG_COLORS, FLAG_ICONS, FLAG_LABELS } from '../lib/api';
import type { Channel, Message } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Send, Wifi, WifiOff } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';

interface Props { channel: Channel }

type WsStatus = 'connecting' | 'connected' | 'disconnected';

const DELETED_AUTHOR = { id: '', displayName: 'Compte supprimé', avatarUrl: undefined };

function formatDay(date: Date) {
  if (isToday(date)) return "Aujourd'hui";
  if (isYesterday(date)) return 'Hier';
  return format(date, 'd MMMM yyyy', { locale: fr });
}

export default function ChatPanel({ channel }: Props) {
  const { user, token } = useAuthStore();
  const [input, setInput] = useState('');
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: history = [], error: historyError } = useQuery<Message[]>({
    queryKey: ['messages', channel.id],
    queryFn: () => api.get(`/channels/${channel.id}/messages`).then(r => r.data),
    retry: 1,
  });

  useEffect(() => { setLiveMessages([]); }, [channel.id]);

  const connect = useCallback(() => {
    if (!token) return;
    setWsStatus('connecting');
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // Le token n'est plus dans l'URL — il est envoyé dans le premier message
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/channels/${channel.id}`);
    wsRef.current = ws;
    ws.onopen = () => {
      // Authentification par premier message (token hors URL)
      ws.send(JSON.stringify({ type: 'auth', token }));
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'auth_ok') { setWsStatus('connected'); return; }
        if (data.type === 'error') { console.warn('[WS]', data.message); return; }
        if (data.type === 'message') {
          const msg: Message = data;
          setLiveMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        }
      } catch (_) {}
    };
    ws.onclose = () => {
      setWsStatus('disconnected');
      reconnectTimer.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();
  }, [channel.id, token]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history.length, liveMessages.length]);

  const send = () => {
    const content = input.trim();
    if (!content || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ content }));
    setInput('');
  };

  const seen = new Set<string>();
  const allMessages = [...history, ...liveMessages].filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  const groups: { day: string; messages: Message[] }[] = [];
  for (const msg of allMessages) {
    const day = formatDay(new Date(msg.sentAt));
    const last = groups[groups.length - 1];
    if (last?.day === day) last.messages.push(msg);
    else groups.push({ day, messages: [msg] });
  }

  if (historyError) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-2 text-stone-400 dark:text-stone-500 text-sm p-8">
        <span className="text-2xl">⚠️</span>
        <p>Impossible de charger ce canal.</p>
        <p className="text-xs text-stone-300 dark:text-stone-600">
          {(historyError as any)?.response?.data?.error ?? 'Erreur réseau'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-stone-50 dark:bg-stone-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 flex items-center gap-2">
        <span className="text-base">{FLAG_ICONS[channel.flag]}</span>
        <span className="font-medium text-stone-900 dark:text-stone-50">{channel.name}</span>
        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', FLAG_COLORS[channel.flag])}>
          {FLAG_LABELS[channel.flag]}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {wsStatus === 'connected' && <Wifi size={13} className="text-green-500" />}
          {wsStatus === 'connecting' && <Wifi size={13} className="text-amber-400 animate-pulse" />}
          {wsStatus === 'disconnected' && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <WifiOff size={13} /> Reconnexion…
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {allMessages.length === 0 && (
          <div className="text-center py-12 text-stone-400 dark:text-stone-500 text-sm">
            <div className="text-3xl mb-2">{FLAG_ICONS[channel.flag]}</div>
            Aucun message — lancez la conversation !
          </div>
        )}

        {groups.map(group => (
          <div key={group.day}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
              <span className="text-xs text-stone-400 dark:text-stone-500 font-medium">{group.day}</span>
              <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
            </div>

            <div className="space-y-2">
              {group.messages.map((msg, i) => {
                const author = msg.author ?? DELETED_AUTHOR;
                const isMe = author.id === user?.id;
                const prevAuthorId = (group.messages[i - 1]?.author ?? DELETED_AUTHOR).id;
                const sameAuthor = prevAuthorId === author.id && author.id !== '';

                return (
                  <div key={msg.id} className={clsx(
                    'flex gap-2 animate-fade-in',
                    isMe && 'flex-row-reverse',
                    sameAuthor && 'mt-0.5'
                  )}>
                    <div className={clsx(
                      'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold mt-0.5',
                      isMe ? 'bg-stone-900 dark:bg-stone-600 text-white' : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200',
                      sameAuthor && 'opacity-0 pointer-events-none'
                    )}>
                      {author.displayName[0]?.toUpperCase() ?? '?'}
                    </div>

                    <div className={clsx('max-w-[70%]', isMe && 'items-end flex flex-col')}>
                      {!sameAuthor && (
                        <div className={clsx('text-xs text-stone-400 dark:text-stone-500 mb-0.5', isMe && 'text-right')}>
                          {isMe ? 'Vous' : author.displayName}
                          {' · '}
                          {format(new Date(msg.sentAt), 'HH:mm')}
                        </div>
                      )}
                      <div className={clsx(
                        'px-3 py-2 rounded-2xl text-sm leading-relaxed break-words',
                        isMe
                          ? 'bg-stone-900 dark:bg-stone-600 text-white rounded-tr-sm'
                          : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-100 rounded-tl-sm shadow-sm',
                        !author.id && 'opacity-60 italic'
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800">
        <div className="flex gap-2 items-center">
          <input
            className="input flex-1"
            placeholder={`Message dans #${channel.name}…`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          />
          <button
            onClick={send}
            disabled={!input.trim() || wsStatus !== 'connected'}
            className="btn-primary !px-3 disabled:opacity-30 flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
