import { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { api } from './api';

// ─── TYPES ──────────────────────────────────────────────────────────────────
interface UserData {
  id: number;
  username: string;
  name: string;
  avatar_url: string | null;
  bio: string;
  badge: string | null;
  badge_label: string | null;
  is_developer: boolean;
  avatar_border: string | null;
  is_banned: boolean;
  ban_until: string | null;
  created_at: string;
  last_seen: string;
}

interface MessageData {
  id: number;
  conversation_id: number;
  sender_id: number;
  text: string;
  is_read: boolean;
  removed: boolean;
  edited: boolean;
  created_at: string;
}

interface ConversationData {
  id: number;
  partner: UserData;
  last_message: MessageData | null;
  unread_count: number;
}

// ─── BADGE CONFIG ────────────────────────────────────────────────────────────
const BADGE_CONFIG: Record<string, { color: string; emoji: string }> = {
  red_black: { color: '#e01d1d', emoji: '✦' },
  blue:      { color: '#3b82f6', emoji: '✓' },
  green:     { color: '#22c55e', emoji: '✓' },
  gold:      { color: '#f59e0b', emoji: '★' },
  silver:    { color: '#94a3b8', emoji: '✓' },
  purple:    { color: '#a855f7', emoji: '✓' },
  pink:      { color: '#ec4899', emoji: '✓' },
  orange:    { color: '#f97316', emoji: '✓' },
  grey_67:   { color: '#6b7280', emoji: '67' },
};

const BADGE_OPTIONS = [
  { value: 'red_black', label: 'Красно-чёрная ✦', color: '#e01d1d' },
  { value: 'blue',      label: 'Синяя ✓',          color: '#3b82f6' },
  { value: 'green',     label: 'Зелёная ✓',         color: '#22c55e' },
  { value: 'gold',      label: 'Золотая ★',         color: '#f59e0b' },
  { value: 'silver',    label: 'Серебряная ✓',      color: '#94a3b8' },
  { value: 'purple',    label: 'Фиолетовая ✓',      color: '#a855f7' },
  { value: 'pink',      label: 'Розовая ✓',         color: '#ec4899' },
  { value: 'orange',    label: 'Оранжевая ✓',       color: '#f97316' },
  { value: 'grey_67',   label: 'Серая 67',          color: '#6b7280' },
];

// ─── BADGE COMPONENT ─────────────────────────────────────────────────────────
function Badge({ badge, label }: { badge: string; label?: string | null }) {
  const cfg = BADGE_CONFIG[badge];
  if (!cfg) return null;
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ml-1 flex-shrink-0"
      style={{ background: cfg.color, color: '#fff', lineHeight: 1 }}
      title={label || badge}
    >
      {cfg.emoji}
    </span>
  );
}

// ─── AVATAR ──────────────────────────────────────────────────────────────────
function UserAvatar({ user, size = 40 }: { user: UserData; size?: number }) {
  const initials = user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const borderStyle = user.avatar_border === 'gold'
    ? { boxShadow: '0 0 0 2px #f59e0b, 0 0 12px rgba(245,158,11,0.4)' }
    : user.avatar_border === 'red'
    ? { boxShadow: '0 0 0 2px #e01d1d' }
    : {};

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full flex items-center justify-center font-oswald font-semibold overflow-hidden"
        style={{
          background: user.avatar_url ? 'transparent' : 'linear-gradient(135deg, #8b1010, #e01d1d)',
          fontSize: size * 0.3,
          color: 'white',
          ...borderStyle,
        }}
      >
        {user.avatar_url
          ? <img src={user.avatar_url} className="w-full h-full object-cover" alt={user.name} />
          : initials}
      </div>
    </div>
  );
}

function isOnline(lastSeen: string) {
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, onGoRegister }: {
  onLogin: (u: UserData) => void;
  onGoRegister: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!username || !password) { setError('Заполните все поля'); return; }
    setLoading(true);
    const res = await api.auth.login(username, password);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    localStorage.setItem('void_token', res.token);
    onLogin(res.user);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1/2 h-1 bg-[var(--red)]" />
      <div className="absolute bottom-0 right-0 w-1/3 h-1 bg-[var(--red)]" />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(#e01d1d 1px, transparent 1px), linear-gradient(90deg, #e01d1d 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />
      <div className="absolute top-20 -left-24 w-64 h-64 rounded-full opacity-5"
        style={{ background: 'radial-gradient(circle, #e01d1d, transparent)' }} />

      <div className="w-full max-w-sm mx-4 animate-fade-in z-10">
        <div className="mb-10 text-center">
          <h1 className="font-oswald text-6xl font-bold tracking-widest text-white animate-glitch red-glow-text">VOID</h1>
          <p className="font-mono text-xs text-[var(--grey-text)] tracking-[0.3em] mt-1">MESSENGER // v2.4</p>
        </div>
        <div className="p-8 rounded-sm" style={{ background: 'var(--black-mid)', border: '1px solid var(--grey-dim)' }}>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-5 bg-[var(--red)]" />
            <span className="font-oswald text-lg tracking-widest text-white uppercase">Вход</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-1 block">Логин</label>
              <input className="input-void w-full px-3 py-2.5 rounded-sm text-sm" placeholder="username"
                value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <div>
              <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-1 block">Пароль</label>
              <input type="password" className="input-void w-full px-3 py-2.5 rounded-sm text-sm" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
          </div>
          {error && (
            <div className="mt-3 px-3 py-2 text-xs text-[#ff6666] font-mono"
              style={{ background: 'rgba(224,29,29,0.08)', border: '1px solid rgba(224,29,29,0.2)' }}>
              ⚠ {error}
            </div>
          )}
          <button onClick={handleLogin} disabled={loading}
            className="btn-primary-void w-full py-3 mt-5 rounded-sm text-sm tracking-widest disabled:opacity-50">
            {loading ? '...' : 'ВОЙТИ'}
          </button>
          <div className="mt-4 text-center">
            <button onClick={onGoRegister}
              className="text-xs text-[var(--grey-text)] hover:text-[var(--red)] transition-colors font-mono">
              Нет аккаунта? Зарегистрироваться →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── REGISTER SCREEN ──────────────────────────────────────────────────────────
function RegisterScreen({ onBack, onRegister }: {
  onBack: () => void;
  onRegister: (u: UserData) => void;
}) {
  const [form, setForm] = useState({ name: '', username: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const checks = {
    length: form.password.length >= 6,
    match: form.password === form.confirm && form.password.length > 0,
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name) e.name = 'Введите имя';
    if (!form.username) e.username = 'Введите логин';
    if (!checks.length) e.password = 'Минимум 6 символов';
    if (!checks.match) e.confirm = 'Пароли не совпадают';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    const res = await api.auth.register(form.username, form.name, form.password);
    setLoading(false);
    if (res.error) { setServerError(res.error); return; }
    localStorage.setItem('void_token', res.token);
    onRegister(res.user);
  };

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] py-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1/2 h-1 bg-[var(--red)]" />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(#e01d1d 1px, transparent 1px), linear-gradient(90deg, #e01d1d 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />
      <div className="w-full max-w-sm mx-4 animate-fade-in z-10">
        <div className="mb-8 flex items-center gap-4">
          <button onClick={onBack} className="text-[var(--grey-text)] hover:text-white transition-colors">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div>
            <h1 className="font-oswald text-3xl font-bold tracking-widest text-white">VOID</h1>
            <p className="font-mono text-xs text-[var(--grey-text)] tracking-[0.2em]">РЕГИСТРАЦИЯ</p>
          </div>
        </div>
        <div className="p-8 rounded-sm" style={{ background: 'var(--black-mid)', border: '1px solid var(--grey-dim)' }}>
          <div className="space-y-3">
            {[
              { key: 'name', label: 'ИМЯ', placeholder: 'Алекс Волков', type: 'text' },
              { key: 'username', label: 'ЛОГИН', placeholder: 'username', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-1 block">{f.label}</label>
                <input type={f.type} className="input-void w-full px-3 py-2.5 rounded-sm text-sm"
                  placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setField(f.key, e.target.value)} />
                {errors[f.key] && <p className="text-xs text-[#ff6666] font-mono mt-1">{errors[f.key]}</p>}
              </div>
            ))}
            <div>
              <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-1 block">ПАРОЛЬ</label>
              <input type="password" className="input-void w-full px-3 py-2.5 rounded-sm text-sm" placeholder="••••••••"
                value={form.password} onChange={e => setField('password', e.target.value)} />
              {form.password && (
                <div className="mt-2 flex gap-3">
                  {[{ ok: checks.length, label: '6+ симв.' }, { ok: checks.match && form.confirm.length > 0, label: 'Совпадают' }].map(c => (
                    <span key={c.label} className={`text-xs font-mono flex items-center gap-1 ${c.ok ? 'text-green-500' : 'text-[var(--grey-text)]'}`}>
                      <span>{c.ok ? '✓' : '○'}</span> {c.label}
                    </span>
                  ))}
                </div>
              )}
              {errors.password && <p className="text-xs text-[#ff6666] font-mono mt-1">{errors.password}</p>}
            </div>
            <div>
              <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-1 block">ПОВТОРИТЕ</label>
              <input type="password" className="input-void w-full px-3 py-2.5 rounded-sm text-sm" placeholder="••••••••"
                value={form.confirm} onChange={e => setField('confirm', e.target.value)} />
            </div>
          </div>
          {serverError && (
            <div className="mt-3 px-3 py-2 text-xs text-[#ff6666] font-mono"
              style={{ background: 'rgba(224,29,29,0.08)', border: '1px solid rgba(224,29,29,0.2)' }}>
              ⚠ {serverError}
            </div>
          )}
          <button onClick={handleSubmit} disabled={loading}
            className="btn-primary-void w-full py-3 mt-6 rounded-sm text-sm tracking-widest disabled:opacity-50">
            {loading ? '...' : 'СОЗДАТЬ АККАУНТ'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SEARCH PANEL ─────────────────────────────────────────────────────────────
function SearchPanel({ onOpenChat }: { onOpenChat: (user: UserData) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await api.users.search(query);
      setLoading(false);
      if (Array.isArray(res)) setResults(res);
      else if (res && Array.isArray(res.users)) setResults(res.users);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4" style={{ borderBottom: '1px solid var(--grey-dim)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-[var(--red)]" />
          <span className="font-oswald text-sm tracking-widest text-white uppercase">Поиск</span>
        </div>
        <div className="relative">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--grey-text)]" />
          <input className="input-void w-full pl-9 pr-3 py-2 rounded-sm text-sm"
            placeholder="Имя или @username..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-4 text-center text-xs font-mono text-[var(--grey-text)]">поиск...</div>}
        {!loading && query && results.length === 0 && (
          <div className="p-8 text-center"><p className="text-[var(--grey-text)] font-mono text-xs">НЕ НАЙДЕНО</p></div>
        )}
        {!query && (
          <div className="p-8 text-center">
            <Icon name="Search" size={32} className="text-[var(--grey-dim)] mx-auto mb-3" />
            <p className="text-[var(--grey-text)] font-mono text-xs">Начните вводить имя</p>
          </div>
        )}
        {results.map(user => (
          <button key={user.id} onClick={() => onOpenChat(user)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--black-light)] transition-colors text-left"
            style={{ borderBottom: '1px solid var(--grey-dim)' }}>
            <UserAvatar user={user} size={40} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-sm text-white font-medium truncate">{user.name}</p>
                {user.badge && <Badge badge={user.badge} label={user.badge_label} />}
                {user.is_developer && <span className="text-xs font-mono text-[var(--red)] ml-1">DEV</span>}
              </div>
              <p className="text-xs text-[var(--grey-text)] font-mono">@{user.username}</p>
            </div>
            <span className={`text-xs font-mono ${isOnline(user.last_seen) ? 'text-green-400' : 'text-[var(--grey-text)]'}`}>
              {isOnline(user.last_seen) ? '● в сети' : '○'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── SETTINGS PANEL ───────────────────────────────────────────────────────────
function SettingsPanel({ currentUser, onUpdateUser }: {
  currentUser: UserData;
  onUpdateUser: (u: UserData) => void;
}) {
  const [privacy, setPrivacy] = useState({ lastSeen: true, readReceipts: true });
  const [notifications, setNotifications] = useState({ sounds: true, preview: false });
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [saving, setSaving] = useState(false);

  const Toggle = ({ on, toggle }: { on: boolean; toggle: () => void }) => (
    <button onClick={toggle} className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
      style={{ background: on ? 'var(--red)' : 'var(--grey-dim)' }}>
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }} />
    </button>
  );

  const saveProfile = async () => {
    setSaving(true);
    const res = await api.users.updateMe({ name, bio });
    setSaving(false);
    if (res.id) onUpdateUser(res);
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-4">
        <div className="w-1 h-4 bg-[var(--red)]" />
        <span className="font-oswald text-sm tracking-widest text-[var(--grey-text)] uppercase">{title}</span>
      </div>
      <div style={{ borderTop: '1px solid var(--grey-dim)', borderBottom: '1px solid var(--grey-dim)' }}>{children}</div>
    </div>
  );
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-sm text-[var(--white-soft)]">{label}</span>
      {children}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto py-4 h-full">
      <Section title="Профиль">
        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-1 block">Имя</label>
            <input className="input-void w-full px-3 py-2 rounded-sm text-sm" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-1 block">О себе</label>
            <textarea className="input-void w-full px-3 py-2 rounded-sm text-sm resize-none" rows={3}
              value={bio} onChange={e => setBio(e.target.value)} />
          </div>
          <button onClick={saveProfile} disabled={saving}
            className="btn-primary-void w-full py-2 rounded-sm text-sm tracking-widest disabled:opacity-50">
            {saving ? '...' : 'СОХРАНИТЬ'}
          </button>
        </div>
      </Section>
      <Section title="Конфиденциальность">
        <Row label="Последнее посещение">
          <Toggle on={privacy.lastSeen} toggle={() => setPrivacy(p => ({ ...p, lastSeen: !p.lastSeen }))} />
        </Row>
        <Row label="Уведомления о прочтении">
          <Toggle on={privacy.readReceipts} toggle={() => setPrivacy(p => ({ ...p, readReceipts: !p.readReceipts }))} />
        </Row>
      </Section>
      <Section title="Уведомления">
        <Row label="Звуки">
          <Toggle on={notifications.sounds} toggle={() => setNotifications(n => ({ ...n, sounds: !n.sounds }))} />
        </Row>
        <Row label="Предпросмотр">
          <Toggle on={notifications.preview} toggle={() => setNotifications(n => ({ ...n, preview: !n.preview }))} />
        </Row>
      </Section>
      <div className="px-4 pb-4">
        <div className="p-3 rounded-sm" style={{ background: 'var(--black-light)', border: '1px solid var(--grey-dim)' }}>
          <p className="text-xs font-mono text-[var(--grey-text)] mb-2">АККАУНТ</p>
          <div className="flex items-center gap-2">
            <UserAvatar user={currentUser} size={36} />
            <div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-white">{currentUser.name}</span>
                {currentUser.badge && <Badge badge={currentUser.badge} label={currentUser.badge_label} />}
              </div>
              <span className="text-xs text-[var(--grey-text)] font-mono">@{currentUser.username}</span>
            </div>
          </div>
          {currentUser.bio && <p className="text-xs text-[var(--grey-text)] mt-2">{currentUser.bio}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN CHEAT MENU ─────────────────────────────────────────────────────────
function AdminMenu({ targetUser, onClose, onRefresh }: {
  targetUser: UserData;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [newLogin, setNewLogin] = useState('');
  const [banMinutes, setBanMinutes] = useState('1');
  const [selBadge, setSelBadge] = useState(targetUser.badge || '');
  const [badgeLabel, setBadgeLabel] = useState(targetUser.badge_label || '');
  const [loading, setLoading] = useState('');
  const [msg, setMsg] = useState('');

  const action = async (name: string, fn: () => Promise<unknown>) => {
    setLoading(name); setMsg('');
    await fn();
    setLoading(''); setMsg('Готово ✓'); onRefresh();
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md mx-4 rounded-sm animate-fade-in max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--black-mid)', border: '2px solid var(--red)' }}>
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ borderBottom: '1px solid var(--grey-dim)', background: 'var(--black-mid)' }}>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-[var(--red)]" />
              <span className="font-oswald text-lg tracking-widest text-white uppercase">ЧИТ-МЕНЮ</span>
              <span className="font-mono text-xs text-[var(--red)] animate-pulse">DEV</span>
            </div>
            <p className="text-xs text-[var(--grey-text)] font-mono ml-3">@{targetUser.username} — {targetUser.name}</p>
          </div>
          <button onClick={onClose} className="text-[var(--grey-text)] hover:text-white">
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {msg && (
            <div className="text-xs text-green-400 font-mono px-3 py-2"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>{msg}</div>
          )}

          {/* change login */}
          <div>
            <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-2 block">Изменить логин</label>
            <div className="flex gap-2">
              <input className="input-void flex-1 px-3 py-2 rounded-sm text-sm" placeholder="new_username"
                value={newLogin} onChange={e => setNewLogin(e.target.value)} />
              <button onClick={() => action('login', () => api.users.adminSetLogin(targetUser.id, newLogin))}
                disabled={loading === 'login' || !newLogin}
                className="btn-primary-void px-4 py-2 rounded-sm text-xs tracking-widest disabled:opacity-50">
                {loading === 'login' ? '...' : 'OK'}
              </button>
            </div>
          </div>

          {/* ban */}
          <div>
            <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-2 block">Блокировка (минуты)</label>
            <div className="flex gap-2 flex-wrap">
              <input className="input-void w-24 px-3 py-2 rounded-sm text-sm" type="number" min="0"
                value={banMinutes} onChange={e => setBanMinutes(e.target.value)} />
              <button onClick={() => action('ban', () => api.users.adminBan(targetUser.id, parseInt(banMinutes) || 1))}
                disabled={loading === 'ban'}
                className="btn-primary-void px-4 py-2 rounded-sm text-xs tracking-widest disabled:opacity-50">
                {loading === 'ban' ? '...' : 'ЗАБЛОКИРОВАТЬ'}
              </button>
              <button onClick={() => action('unban', () => api.users.adminBan(targetUser.id, 0))}
                disabled={loading === 'unban'} className="btn-ghost-void px-3 py-2 rounded-sm text-xs">
                СНЯТЬ
              </button>
            </div>
          </div>

          {/* badge */}
          <div>
            <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-2 block">Галочка</label>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {BADGE_OPTIONS.map(b => (
                <button key={b.value} onClick={() => setSelBadge(b.value)}
                  className="text-xs py-1.5 px-2 rounded-sm font-mono transition-all text-white"
                  style={{
                    background: selBadge === b.value ? b.color : 'var(--black-light)',
                    border: selBadge === b.value ? `1px solid ${b.color}` : '1px solid var(--grey-dim)',
                  }}>
                  {b.label}
                </button>
              ))}
            </div>
            <input className="input-void w-full px-3 py-2 rounded-sm text-sm mb-2" placeholder="Подпись галочки"
              value={badgeLabel} onChange={e => setBadgeLabel(e.target.value)} />
            <button onClick={() => action('badge', () => api.users.adminSetBadge(targetUser.id, selBadge, badgeLabel))}
              disabled={loading === 'badge' || !selBadge}
              className="btn-primary-void w-full py-2 rounded-sm text-xs tracking-widest disabled:opacity-50">
              {loading === 'badge' ? '...' : 'ВЫДАТЬ ГАЛОЧКУ'}
            </button>
          </div>

          {/* remove user */}
          <div style={{ borderTop: '1px solid var(--grey-dim)', paddingTop: '1rem' }}>
            <button onClick={() => { action('remove', () => api.users.adminRemoveUser(targetUser.id)); onClose(); }}
              disabled={loading === 'remove'}
              className="w-full py-2 rounded-sm text-xs font-mono tracking-widest transition-all text-[#ff4444] hover:text-white hover:bg-[#ff4444]"
              style={{ border: '1px solid rgba(255,68,68,0.4)' }}>
              {loading === 'remove' ? '...' : 'УДАЛИТЬ АККАУНТ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MSG CONTEXT MENU ─────────────────────────────────────────────────────────
function MsgMenu({ isSent, isAdmin, onEdit, onRemove, onClose }: {
  isSent: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const canEdit = isSent || isAdmin;
  const canRemove = isSent || isAdmin;
  if (!canEdit && !canRemove) return null;
  return (
    <div className="absolute right-0 top-6 z-20 rounded-sm shadow-lg"
      style={{ background: 'var(--black-mid)', border: '1px solid var(--grey-dim)', minWidth: 150 }}>
      {canEdit && (
        <button onClick={() => { onEdit(); onClose(); }}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white hover:bg-[var(--black-light)] transition-colors">
          <Icon name="Pencil" size={12} /> Редактировать
        </button>
      )}
      {canRemove && (
        <button onClick={() => { onRemove(); onClose(); }}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#ff6666] hover:bg-[var(--black-light)] transition-colors">
          <Icon name="Trash2" size={12} /> Удалить
        </button>
      )}
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
function MainApp({ currentUser: initUser, onLogout }: {
  currentUser: UserData;
  onLogout: () => void;
}) {
  const [currentUser, setCurrentUser] = useState<UserData>(initUser);
  const [screen, setScreen] = useState<'chat' | 'search' | 'settings'>('chat');
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState('');
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [adminTarget, setAdminTarget] = useState<UserData | null>(null);
  const [msgMenu, setMsgMenu] = useState<number | null>(null);
  const [editingMsg, setEditingMsg] = useState<MessageData | null>(null);
  const [editText, setEditText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAdmin = currentUser.id === 1;

  const loadConversations = useCallback(async () => {
    const res = await api.messages.getConversations();
    if (Array.isArray(res)) setConversations(res);
    else if (res && Array.isArray(res.conversations)) setConversations(res.conversations);
    setLoadingConvs(false);
  }, []);

  const loadMessages = useCallback(async (convId: number) => {
    const res = await api.messages.getMessages(convId);
    const msgs = Array.isArray(res) ? res : (res.messages || []);
    setMessages(msgs);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!activeConv) return;
    loadMessages(activeConv.id);
    api.messages.markRead(activeConv.id);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      loadMessages(activeConv.id);
      loadConversations();
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeConv?.id]);

  const openChat = async (user: UserData) => {
    const existing = conversations.find(c => c.partner.id === user.id);
    if (existing) {
      setActiveConv(existing);
    } else {
      const res = await api.messages.createConversation(user.id);
      const newConv: ConversationData = {
        id: res.conversation_id,
        partner: user,
        last_message: null,
        unread_count: 0,
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveConv(newConv);
    }
    setScreen('chat');
    setMobileSidebar(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeConv) return;
    const text = input.trim();
    setInput('');
    const res = await api.messages.sendMessage(activeConv.id, text);
    if (res.error) { setInput(text); return; }
    await loadMessages(activeConv.id);
    await loadConversations();
  };

  const handleRemoveMsg = async (msgId: number) => {
    await api.messages.removeMessage(msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, removed: true, text: 'Сообщение удалено' } : m));
  };

  const handleEditMsg = async () => {
    if (!editingMsg || !editText.trim()) return;
    await api.messages.editMessage(editingMsg.id, editText.trim());
    setMessages(prev => prev.map(m =>
      m.id === editingMsg.id ? { ...m, text: editText.trim(), edited: true } : m
    ));
    setEditingMsg(null);
  };

  const navItems = [
    { id: 'chat' as const, icon: 'MessageCircle', label: 'Чаты' },
    { id: 'search' as const, icon: 'Search', label: 'Поиск' },
    { id: 'settings' as const, icon: 'Settings', label: 'Настройки' },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      {/* SIDEBAR */}
      <div className={`flex flex-col w-72 flex-shrink-0 h-full transition-transform duration-300 md:translate-x-0 ${mobileSidebar ? 'translate-x-0' : '-translate-x-full'} fixed md:relative z-30 md:z-auto`}
        style={{ background: 'var(--black-mid)', borderRight: '1px solid var(--grey-dim)' }}>

        <div className="p-4" style={{ borderBottom: '1px solid var(--grey-dim)' }}>
          <div className="flex items-center gap-1 mb-4">
            <span className="font-oswald text-2xl font-bold tracking-widest text-white red-glow-text">VOID</span>
            <span className="font-mono text-[var(--red)] ml-1 animate-pulse">●</span>
            {isAdmin && (
              <span className="font-mono text-[10px] text-[var(--red)] ml-1 border border-[var(--red)] px-1 py-0.5">ADMIN</span>
            )}
          </div>
          <div className="flex items-center gap-3 p-3 rounded-sm" style={{ background: 'var(--black-light)' }}>
            <UserAvatar user={currentUser} size={40} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-sm text-white font-medium truncate">{currentUser.name}</p>
                {currentUser.badge && <Badge badge={currentUser.badge} label={currentUser.badge_label} />}
              </div>
              <p className="text-xs text-[var(--grey-text)] font-mono truncate">@{currentUser.username}</p>
            </div>
            <button onClick={() => { api.auth.logout(); onLogout(); }}
              className="text-[var(--grey-text)] hover:text-[var(--red)] transition-colors flex-shrink-0">
              <Icon name="LogOut" size={16} />
            </button>
          </div>
          {currentUser.bio && <p className="text-xs text-[var(--grey-text)] mt-2 px-1 leading-relaxed">{currentUser.bio}</p>}
        </div>

        <div className="flex" style={{ borderBottom: '1px solid var(--grey-dim)' }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setScreen(item.id)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all ${screen === item.id ? 'text-[var(--red)]' : 'text-[var(--grey-text)] hover:text-white'}`}
              style={screen === item.id ? { background: 'rgba(224,29,29,0.08)', borderBottom: '2px solid var(--red)' } : {}}>
              <Icon name={item.icon} size={16} fallback="Circle" />
              <span className="font-mono text-[9px] tracking-widest uppercase">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {screen === 'chat' && (
            <div className="flex-1 overflow-y-auto">
              {loadingConvs && <div className="p-4 text-center text-xs font-mono text-[var(--grey-text)]">загрузка...</div>}
              {!loadingConvs && conversations.length === 0 && (
                <div className="p-8 text-center">
                  <Icon name="MessageCircle" size={32} className="text-[var(--grey-dim)] mx-auto mb-2" />
                  <p className="text-xs font-mono text-[var(--grey-text)]">НЕТ ЧАТОВ</p>
                  <p className="text-xs font-mono text-[var(--grey-text)] mt-1">Найдите пользователя в поиске</p>
                </div>
              )}
              {conversations.map(conv => (
                <button key={conv.id} onClick={() => { setActiveConv(conv); setMobileSidebar(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-left ${activeConv?.id === conv.id ? 'nav-item-active' : 'hover:bg-[var(--black-light)]'}`}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <UserAvatar user={conv.partner} size={42} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <p className="text-sm text-white font-medium truncate">{conv.partner.name}</p>
                        {conv.partner.badge && <Badge badge={conv.partner.badge} label={conv.partner.badge_label} />}
                      </div>
                      <span className="text-[10px] text-[var(--grey-text)] font-mono ml-2 flex-shrink-0">
                        {conv.last_message ? formatTime(conv.last_message.created_at) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-[var(--grey-text)] truncate">
                        {conv.last_message?.removed ? 'Сообщение удалено' : conv.last_message?.text || '...'}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="ml-2 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-oswald text-white"
                          style={{ background: 'var(--red)' }}>{conv.unread_count}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {screen === 'search' && <SearchPanel onOpenChat={openChat} />}
          {screen === 'settings' && <SettingsPanel currentUser={currentUser} onUpdateUser={setCurrentUser} />}
        </div>
      </div>

      {mobileSidebar && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setMobileSidebar(false)} />
      )}

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeConv ? (
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <button className="md:hidden absolute top-4 left-4 text-[var(--grey-text)] hover:text-white"
              onClick={() => setMobileSidebar(true)}>
              <Icon name="Menu" size={20} />
            </button>
            <h1 className="font-oswald text-5xl font-bold tracking-widest text-white red-glow-text animate-glitch mb-3">VOID</h1>
            <p className="font-mono text-xs text-[var(--grey-text)]">Выберите чат или найдите пользователя</p>
          </div>
        ) : (
          <>
            {/* chat header */}
            <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--grey-dim)', background: 'var(--black-mid)' }}>
              <button className="md:hidden text-[var(--grey-text)] hover:text-white mr-1" onClick={() => setMobileSidebar(true)}>
                <Icon name="Menu" size={20} />
              </button>
              <UserAvatar user={activeConv.partner} size={38} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-sm text-white font-medium">{activeConv.partner.name}</p>
                  {activeConv.partner.badge && <Badge badge={activeConv.partner.badge} label={activeConv.partner.badge_label} />}
                  {activeConv.partner.is_developer && (
                    <span className="text-[9px] font-mono text-[var(--red)] ml-1 border border-[var(--red)] px-1">DEV</span>
                  )}
                </div>
                <p className={`text-xs font-mono ${isOnline(activeConv.partner.last_seen) ? 'text-green-400' : 'text-[var(--grey-text)]'}`}>
                  {isOnline(activeConv.partner.last_seen) ? '● в сети' : '○ не в сети'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button onClick={() => setAdminTarget(activeConv.partner)}
                    className="font-mono text-xs text-[var(--red)] border border-[var(--red)] px-2 py-1 hover:bg-[var(--red)] hover:text-white transition-colors rounded-sm">
                    ЧИТ
                  </button>
                )}
                <button className="text-[var(--grey-text)] hover:text-white transition-colors">
                  <Icon name="Phone" size={18} />
                </button>
                <button className="text-[var(--grey-text)] hover:text-white transition-colors">
                  <Icon name="Video" size={18} />
                </button>
              </div>
            </div>

            {/* messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
              style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #0d0808 100%)' }}
              onClick={() => setMsgMenu(null)}>
              {messages.length > 0 && (
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px" style={{ background: 'var(--grey-dim)' }} />
                  <span className="text-[10px] font-mono text-[var(--grey-text)] px-2">переписка</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--grey-dim)' }} />
                </div>
              )}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Icon name="MessageCircle" size={48} className="text-[var(--grey-dim)] mb-3" />
                  <p className="text-[var(--grey-text)] font-mono text-xs">НЕТ СООБЩЕНИЙ</p>
                  <p className="text-[var(--grey-text)] font-mono text-xs mt-1">Начните переписку</p>
                </div>
              )}
              {messages.map((msg) => {
                const isSent = msg.sender_id === currentUser.id;
                return (
                  <div key={msg.id} className={`flex ${isSent ? 'justify-end' : 'justify-start'} animate-fade-in group`}>
                    {!isSent && (
                      <div className="w-6 h-6 rounded-full flex-shrink-0 mr-2 mt-1 flex items-center justify-center font-oswald text-[8px] font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #8b1010, #e01d1d)' }}>
                        {activeConv.partner.name[0]}
                      </div>
                    )}
                    <div className="relative max-w-xs lg:max-w-md">
                      <div className={`${isSent ? 'msg-bubble-sent' : 'msg-bubble-recv'} px-3 py-2 ${msg.removed ? 'opacity-40' : ''}`}>
                        <p className={`text-sm leading-relaxed ${msg.removed ? 'italic text-[var(--grey-text)]' : 'text-white'}`}>
                          {msg.text}
                        </p>
                        <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : 'justify-start'}`}>
                          {msg.edited && !msg.removed && (
                            <span className="text-[9px] font-mono text-[var(--grey-text)]">ред.</span>
                          )}
                          <span className="text-[10px] font-mono text-[var(--grey-text)]">{formatTime(msg.created_at)}</span>
                          {isSent && (
                            <Icon name={msg.is_read ? 'CheckCheck' : 'Check'} size={12}
                              className={msg.is_read ? 'text-[var(--red)]' : 'text-[var(--grey-text)]'} />
                          )}
                        </div>
                      </div>
                      {/* context menu trigger */}
                      {!msg.removed && (isSent || isAdmin) && (
                        <button
                          onClick={e => { e.stopPropagation(); setMsgMenu(msgMenu === msg.id ? null : msg.id); }}
                          className={`absolute top-1 ${isSent ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                          <Icon name="MoreVertical" size={14} className="text-[var(--grey-text)]" />
                        </button>
                      )}
                      {msgMenu === msg.id && (
                        <MsgMenu
                          isSent={isSent} isAdmin={isAdmin}
                          onEdit={() => { setEditingMsg(msg); setEditText(msg.text); setMsgMenu(null); }}
                          onRemove={() => { handleRemoveMsg(msg.id); setMsgMenu(null); }}
                          onClose={() => setMsgMenu(null)} />
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* edit bar */}
            {editingMsg && (
              <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0"
                style={{ borderTop: '1px solid var(--grey-dim)', background: 'rgba(224,29,29,0.08)' }}>
                <Icon name="Pencil" size={14} className="text-[var(--red)] flex-shrink-0" />
                <input className="input-void flex-1 px-3 py-1.5 rounded-sm text-sm" value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleEditMsg();
                    if (e.key === 'Escape') setEditingMsg(null);
                  }} />
                <button onClick={handleEditMsg} className="text-[var(--red)] hover:text-white transition-colors">
                  <Icon name="Check" size={16} />
                </button>
                <button onClick={() => setEditingMsg(null)} className="text-[var(--grey-text)] hover:text-white transition-colors">
                  <Icon name="X" size={16} />
                </button>
              </div>
            )}

            {/* input */}
            <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
              style={{ borderTop: '1px solid var(--grey-dim)', background: 'var(--black-mid)' }}>
              <button className="text-[var(--grey-text)] hover:text-[var(--red)] transition-colors flex-shrink-0">
                <Icon name="Paperclip" size={18} />
              </button>
              <input className="input-void flex-1 px-4 py-2.5 rounded-full text-sm"
                placeholder="Написать сообщение..."
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} />
              <button onClick={sendMessage} disabled={!input.trim()}
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: input.trim() ? 'var(--red)' : 'var(--grey-dim)' }}>
                <Icon name="Send" size={16} className="text-white" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* admin modal */}
      {adminTarget && (
        <AdminMenu targetUser={adminTarget} onClose={() => setAdminTarget(null)}
          onRefresh={() => { loadConversations(); if (activeConv) loadMessages(activeConv.id); }} />
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<'login' | 'register' | 'app'>('login');
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('void_token');
    if (!token) return;
    api.auth.me().then(res => {
      if (res && res.id) { setCurrentUser(res); setPage('app'); }
      else localStorage.removeItem('void_token');
    });
  }, []);

  const handleLogin = (user: UserData) => { setCurrentUser(user); setPage('app'); };
  const handleLogout = () => { localStorage.removeItem('void_token'); setCurrentUser(null); setPage('login'); };

  if (page === 'register') {
    return <RegisterScreen onBack={() => setPage('login')} onRegister={handleLogin} />;
  }
  if (page === 'app' && currentUser) {
    return <MainApp currentUser={currentUser} onLogout={handleLogout} />;
  }
  return <LoginScreen onLogin={handleLogin} onGoRegister={() => setPage('register')} />;
}
