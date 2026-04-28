import { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/icon';

type Screen = 'login' | 'register' | 'chat' | 'search' | 'settings';

interface User {
  id: number;
  name: string;
  username: string;
  avatar: string;
  status: 'online' | 'offline' | 'away';
}

interface Message {
  id: number;
  text: string;
  sent: boolean;
  time: string;
  read: boolean;
}

interface Chat {
  id: number;
  user: User;
  messages: Message[];
  lastMsg: string;
  unread: number;
}

const MOCK_USERS: User[] = [
  { id: 1, name: 'Алекс Волков', username: 'alexvolkov', avatar: 'АВ', status: 'online' },
  { id: 2, name: 'Мария Лебедева', username: 'mlebed', avatar: 'МЛ', status: 'away' },
  { id: 3, name: 'Иван Черный', username: 'ivan_ch', avatar: 'ИЧ', status: 'offline' },
  { id: 4, name: 'Дина Соколова', username: 'dsokolova', avatar: 'ДС', status: 'online' },
  { id: 5, name: 'Павел Орлов', username: 'porlov', avatar: 'ПО', status: 'online' },
];

const MOCK_CHATS: Chat[] = [
  {
    id: 1,
    user: MOCK_USERS[0],
    messages: [
      { id: 1, text: 'Привет, как дела?', sent: false, time: '10:20', read: true },
      { id: 2, text: 'Всё отлично, работаю над проектом', sent: true, time: '10:21', read: true },
      { id: 3, text: 'Слушай, когда встретимся?', sent: false, time: '10:22', read: true },
      { id: 4, text: 'В пятницу подходит?', sent: true, time: '10:23', read: true },
      { id: 5, text: 'Отлично, договорились!', sent: false, time: '10:24', read: false },
    ],
    lastMsg: 'Отлично, договорились!',
    unread: 1,
  },
  {
    id: 2,
    user: MOCK_USERS[1],
    messages: [
      { id: 1, text: 'Отправила файлы на почту', sent: false, time: '09:15', read: true },
      { id: 2, text: 'Получила, спасибо!', sent: true, time: '09:16', read: true },
    ],
    lastMsg: 'Получила, спасибо!',
    unread: 0,
  },
  {
    id: 3,
    user: MOCK_USERS[2],
    messages: [
      { id: 1, text: 'Новый дизайн выглядит мощно', sent: false, time: 'вчера', read: true },
    ],
    lastMsg: 'Новый дизайн выглядит мощно',
    unread: 0,
  },
  {
    id: 4,
    user: MOCK_USERS[3],
    messages: [
      { id: 1, text: 'Задача выполнена', sent: false, time: 'вчера', read: true },
      { id: 2, text: 'Видела, молодец!', sent: true, time: 'вчера', read: true },
      { id: 3, text: 'Следующий спринт?', sent: false, time: 'вчера', read: false },
      { id: 4, text: 'Завтра обсудим', sent: false, time: 'вчера', read: false },
    ],
    lastMsg: 'Завтра обсудим',
    unread: 2,
  },
];

function StatusDot({ status }: { status: User['status'] }) {
  const colors = { online: '#22c55e', away: '#f59e0b', offline: '#444' };
  return (
    <span
      className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0a]"
      style={{ background: colors[status] }}
    />
  );
}

function Avatar({ user, size = 40 }: { user: User; size?: number }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full flex items-center justify-center font-oswald font-semibold"
        style={{
          background: 'linear-gradient(135deg, #8b1010, #e01d1d)',
          fontSize: size * 0.32,
          color: 'white',
        }}
      >
        {user.avatar}
      </div>
      <StatusDot status={user.status} />
    </div>
  );
}

// LOGIN SCREEN
function LoginScreen({ onLogin, onGoRegister }: { onLogin: () => void; onGoRegister: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setError('');
    if (!username || !password) { setError('Заполните все поля'); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (username === 'demo' && password === '12345') {
        onLogin();
      } else {
        setError('Неверный логин или пароль');
      }
    }, 900);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1/2 h-1 bg-[var(--red)]" />
      <div className="absolute bottom-0 right-0 w-1/3 h-1 bg-[var(--red)]" />
      <div className="absolute top-20 -left-24 w-64 h-64 rounded-full opacity-5"
        style={{ background: 'radial-gradient(circle, #e01d1d, transparent)' }} />
      <div className="absolute bottom-20 -right-24 w-96 h-96 rounded-full opacity-5"
        style={{ background: 'radial-gradient(circle, #e01d1d, transparent)' }} />
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#e01d1d 1px, transparent 1px), linear-gradient(90deg, #e01d1d 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />

      <div className="w-full max-w-sm mx-4 animate-fade-in z-10">
        <div className="mb-10 text-center">
          <h1 className="font-oswald text-6xl font-bold tracking-widest text-white animate-glitch red-glow-text">
            VOID
          </h1>
          <p className="font-mono text-xs text-[var(--grey-text)] tracking-[0.3em] mt-1">
            MESSENGER // v2.4
          </p>
        </div>

        <div className="p-8 rounded-sm" style={{ background: 'var(--black-mid)', border: '1px solid var(--grey-dim)' }}>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-5 bg-[var(--red)]" />
            <span className="font-oswald text-lg tracking-widest text-white uppercase">Вход</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-1 block">Логин</label>
              <input
                className="input-void w-full px-3 py-2.5 rounded-sm text-sm"
                placeholder="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-1 block">Пароль</label>
              <input
                type="password"
                className="input-void w-full px-3 py-2.5 rounded-sm text-sm"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 px-3 py-2 text-xs text-[#ff6666] font-mono"
              style={{ background: 'rgba(224,29,29,0.08)', border: '1px solid rgba(224,29,29,0.2)' }}>
              ⚠ {error}
            </div>
          )}

          <div className="mt-2 text-right">
            <span className="text-xs text-[var(--grey-text)] font-mono">демо: demo / 12345</span>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn-primary-void w-full py-3 mt-5 rounded-sm text-sm tracking-widest disabled:opacity-50"
          >
            {loading ? '...' : 'ВОЙТИ'}
          </button>

          <div className="mt-4 text-center">
            <button onClick={onGoRegister} className="text-xs text-[var(--grey-text)] hover:text-[var(--red)] transition-colors font-mono">
              Нет аккаунта? Зарегистрироваться →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// REGISTER SCREEN
function RegisterScreen({ onBack, onRegister }: { onBack: () => void; onRegister: () => void }) {
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', confirm: '' });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const checks = {
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    number: /\d/.test(form.password),
    match: form.password === form.confirm && form.password.length > 0,
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name) e.name = 'Введите имя';
    if (!form.username) e.username = 'Введите логин';
    if (!form.email.includes('@')) e.email = 'Некорректный email';
    if (!checks.length) e.password = 'Пароль слишком короткий';
    if (!checks.match) e.confirm = 'Пароли не совпадают';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = () => { if (validate()) onRegister(); };
  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] py-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1/2 h-1 bg-[var(--red)]" />
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
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
          <div className="flex justify-center mb-6">
            <button onClick={() => fileRef.current?.click()} className="relative group">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden transition-all"
                style={{ background: avatar ? 'transparent' : 'var(--black-light)', border: '2px dashed var(--grey-mid)' }}
              >
                {avatar
                  ? <img src={avatar} className="w-full h-full object-cover rounded-full" alt="avatar" />
                  : <Icon name="Camera" size={28} className="text-[var(--grey-text)] group-hover:text-[var(--red)] transition-colors" />
                }
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[var(--red)] rounded-full flex items-center justify-center">
                <Icon name="Plus" size={12} className="text-white" />
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </button>
          </div>
          <p className="text-center text-xs text-[var(--grey-text)] font-mono mb-6">аватар (необязательно)</p>

          <div className="space-y-3">
            {[
              { key: 'name', label: 'ИМЯ', placeholder: 'Алекс Волков', type: 'text' },
              { key: 'username', label: 'ЛОГИН', placeholder: '@username', type: 'text' },
              { key: 'email', label: 'EMAIL', placeholder: 'you@example.com', type: 'email' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-1 block">{f.label}</label>
                <input
                  type={f.type}
                  className="input-void w-full px-3 py-2.5 rounded-sm text-sm"
                  placeholder={f.placeholder}
                  value={(form as Record<string, string>)[f.key]}
                  onChange={e => setField(f.key, e.target.value)}
                />
                {errors[f.key] && <p className="text-xs text-[#ff6666] font-mono mt-1">{errors[f.key]}</p>}
              </div>
            ))}

            <div>
              <label className="text-xs text-[var(--grey-text)] uppercase tracking-widest font-mono mb-1 block">ПАРОЛЬ</label>
              <input
                type="password"
                className="input-void w-full px-3 py-2.5 rounded-sm text-sm"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setField('password', e.target.value)}
              />
              {form.password && (
                <div className="mt-2 flex gap-3">
                  {[
                    { ok: checks.length, label: '8+ симв.' },
                    { ok: checks.upper, label: 'Заглавная' },
                    { ok: checks.number, label: 'Цифра' },
                  ].map(c => (
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
              <input
                type="password"
                className="input-void w-full px-3 py-2.5 rounded-sm text-sm"
                placeholder="••••••••"
                value={form.confirm}
                onChange={e => setField('confirm', e.target.value)}
              />
              {form.confirm && (
                <p className={`text-xs font-mono mt-1 ${checks.match ? 'text-green-500' : 'text-[#ff6666]'}`}>
                  {checks.match ? '✓ Совпадают' : '✗ Не совпадают'}
                </p>
              )}
            </div>
          </div>

          <button onClick={handleSubmit} className="btn-primary-void w-full py-3 mt-6 rounded-sm text-sm tracking-widest">
            СОЗДАТЬ АККАУНТ
          </button>
        </div>
      </div>
    </div>
  );
}

// SEARCH PANEL
function SearchPanel({ onOpenChat }: { onOpenChat: (user: User) => void }) {
  const [query, setQuery] = useState('');
  const results = query.length > 0
    ? MOCK_USERS.filter(u =>
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.username.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4" style={{ borderBottom: '1px solid var(--grey-dim)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-[var(--red)]" />
          <span className="font-oswald text-sm tracking-widest text-white uppercase">Поиск</span>
        </div>
        <div className="relative">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--grey-text)]" />
          <input
            className="input-void w-full pl-9 pr-3 py-2 rounded-sm text-sm"
            placeholder="Имя или @username..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query && results.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-[var(--grey-text)] font-mono text-xs">ПОЛЬЗОВАТЕЛИ НЕ НАЙДЕНЫ</p>
          </div>
        )}
        {!query && (
          <div className="p-8 text-center">
            <Icon name="Search" size={32} className="text-[var(--grey-dim)] mx-auto mb-3" />
            <p className="text-[var(--grey-text)] font-mono text-xs">Начните вводить имя</p>
          </div>
        )}
        {results.map((user, i) => (
          <button
            key={user.id}
            onClick={() => onOpenChat(user)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--black-light)] transition-colors text-left animate-fade-in"
            style={{ animationDelay: `${i * 0.05}s`, borderBottom: '1px solid var(--grey-dim)' }}
          >
            <Avatar user={user} size={40} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{user.name}</p>
              <p className="text-xs text-[var(--grey-text)] font-mono">@{user.username}</p>
            </div>
            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
              user.status === 'online' ? 'text-green-400' :
              user.status === 'away' ? 'text-yellow-500' : 'text-[var(--grey-text)]'
            }`} style={{ background: 'var(--black-light)' }}>
              {user.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// SETTINGS PANEL
function SettingsPanel() {
  const [privacy, setPrivacy] = useState({ lastSeen: true, avatar: true, readReceipts: true });
  const [notifications, setNotifications] = useState({ sounds: true, preview: false });
  const [theme, setTheme] = useState<'void' | 'blood' | 'steel'>('void');

  const Toggle = ({ on, toggle }: { on: boolean; toggle: () => void }) => (
    <button
      onClick={toggle}
      className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
      style={{ background: on ? 'var(--red)' : 'var(--grey-dim)' }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-4">
        <div className="w-1 h-4 bg-[var(--red)]" />
        <span className="font-oswald text-sm tracking-widest text-[var(--grey-text)] uppercase">{title}</span>
      </div>
      <div style={{ borderTop: '1px solid var(--grey-dim)', borderBottom: '1px solid var(--grey-dim)' }}>
        {children}
      </div>
    </div>
  );

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-sm text-[var(--white-soft)]">{label}</span>
      {children}
    </div>
  );

  const themes = [
    { id: 'void', label: 'VOID', color: '#e01d1d' },
    { id: 'blood', label: 'BLOOD', color: '#7f1d1d' },
    { id: 'steel', label: 'STEEL', color: '#475569' },
  ];

  return (
    <div className="flex-1 overflow-y-auto py-4 h-full">
      <Section title="Конфиденциальность">
        <Row label="Последнее посещение">
          <Toggle on={privacy.lastSeen} toggle={() => setPrivacy(p => ({ ...p, lastSeen: !p.lastSeen }))} />
        </Row>
        <Row label="Видимость аватара">
          <Toggle on={privacy.avatar} toggle={() => setPrivacy(p => ({ ...p, avatar: !p.avatar }))} />
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

      <Section title="Тема">
        <div className="px-4 py-4 flex gap-3">
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as typeof theme)}
              className="flex-1 py-3 rounded-sm font-oswald text-xs tracking-widest transition-all text-white"
              style={{
                background: theme === t.id ? t.color : 'var(--black-light)',
                border: theme === t.id ? `1px solid ${t.color}` : '1px solid var(--grey-dim)',
                boxShadow: theme === t.id ? `0 0 12px ${t.color}66` : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Аккаунт">
        <Row label="Изменить пароль">
          <Icon name="ChevronRight" size={16} className="text-[var(--grey-text)]" />
        </Row>
        <Row label="2FA">
          <Icon name="ChevronRight" size={16} className="text-[var(--grey-text)]" />
        </Row>
        <Row label="Удалить аккаунт">
          <Icon name="ChevronRight" size={16} className="text-[#ff4444]" />
        </Row>
      </Section>
    </div>
  );
}

// MAIN APP
function MainApp({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<Screen>('chat');
  const [chats, setChats] = useState<Chat[]>(MOCK_CHATS);
  const [activeChat, setActiveChat] = useState<Chat>(MOCK_CHATS[0]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat.id, activeChat.messages.length]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const msg: Message = {
      id: Date.now(),
      text: input.trim(),
      sent: true,
      time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    const updatedChats = chats.map(c =>
      c.id === activeChat.id ? { ...c, messages: [...c.messages, msg], lastMsg: msg.text } : c
    );
    setChats(updatedChats);
    setActiveChat(prev => ({ ...prev, messages: [...prev.messages, msg], lastMsg: msg.text }));
    setInput('');
  };

  const openChat = (user: User) => {
    const existing = chats.find(c => c.user.id === user.id);
    if (existing) {
      setActiveChat(existing);
    } else {
      const newChat: Chat = { id: Date.now(), user, messages: [], lastMsg: '', unread: 0 };
      const newChats = [newChat, ...chats];
      setChats(newChats);
      setActiveChat(newChat);
    }
    setScreen('chat');
    setMobileSidebar(false);
  };

  const navItems = [
    { id: 'chat' as Screen, icon: 'MessageCircle', label: 'Чаты' },
    { id: 'search' as Screen, icon: 'Search', label: 'Поиск' },
    { id: 'settings' as Screen, icon: 'Settings', label: 'Настройки' },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      {/* SIDEBAR */}
      <div
        className={`flex flex-col w-72 flex-shrink-0 h-full transition-transform duration-300 md:translate-x-0 ${mobileSidebar ? 'translate-x-0' : '-translate-x-full'} fixed md:relative z-30 md:z-auto`}
        style={{ background: 'var(--black-mid)', borderRight: '1px solid var(--grey-dim)' }}
      >
        {/* profile */}
        <div className="p-4" style={{ borderBottom: '1px solid var(--grey-dim)' }}>
          <div className="flex items-center gap-1 mb-4">
            <span className="font-oswald text-2xl font-bold tracking-widest text-white red-glow-text">VOID</span>
            <span className="font-mono text-[var(--red)] ml-1 animate-pulse">●</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-sm" style={{ background: 'var(--black-light)' }}>
            <div className="relative">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-oswald font-semibold text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #8b1010, #e01d1d)' }}>
                Я
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#111] bg-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">Алекс Волков</p>
              <p className="text-xs text-[var(--grey-text)] font-mono">@alexvolkov</p>
            </div>
            <button onClick={onLogout} className="text-[var(--grey-text)] hover:text-[var(--red)] transition-colors">
              <Icon name="LogOut" size={16} />
            </button>
          </div>
        </div>

        {/* nav tabs */}
        <div className="flex" style={{ borderBottom: '1px solid var(--grey-dim)' }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all ${
                screen === item.id ? 'text-[var(--red)]' : 'text-[var(--grey-text)] hover:text-white'
              }`}
              style={screen === item.id ? {
                background: 'rgba(224,29,29,0.08)',
                borderBottom: '2px solid var(--red)'
              } : {}}
            >
              <Icon name={item.icon} size={16} fallback="Circle" />
              <span className="font-mono text-[9px] tracking-widest uppercase">{item.label}</span>
            </button>
          ))}
        </div>

        {/* panel */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {screen === 'chat' && (
            <div className="flex-1 overflow-y-auto">
              {chats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => { setActiveChat(chat); setMobileSidebar(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-left ${
                    activeChat.id === chat.id ? 'nav-item-active' : 'hover:bg-[var(--black-light)]'
                  }`}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <Avatar user={chat.user} size={42} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white font-medium truncate">{chat.user.name}</p>
                      <span className="text-[10px] text-[var(--grey-text)] font-mono ml-2 flex-shrink-0">
                        {chat.messages[chat.messages.length - 1]?.time}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-[var(--grey-text)] truncate">{chat.lastMsg || '...'}</p>
                      {chat.unread > 0 && (
                        <span className="ml-2 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-oswald text-white"
                          style={{ background: 'var(--red)' }}>
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {screen === 'search' && <SearchPanel onOpenChat={openChat} />}
          {screen === 'settings' && <SettingsPanel />}
        </div>
      </div>

      {/* mobile overlay */}
      {mobileSidebar && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setMobileSidebar(false)} />
      )}

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* header */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--grey-dim)', background: 'var(--black-mid)' }}>
          <button className="md:hidden text-[var(--grey-text)] hover:text-white mr-1" onClick={() => setMobileSidebar(true)}>
            <Icon name="Menu" size={20} />
          </button>
          <Avatar user={activeChat.user} size={38} />
          <div className="flex-1">
            <p className="text-sm text-white font-medium">{activeChat.user.name}</p>
            <p className={`text-xs font-mono ${
              activeChat.user.status === 'online' ? 'text-green-400' :
              activeChat.user.status === 'away' ? 'text-yellow-500' : 'text-[var(--grey-text)]'
            }`}>
              {activeChat.user.status === 'online' ? '● в сети' :
               activeChat.user.status === 'away' ? '● отошёл' : '○ не в сети'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-[var(--grey-text)] hover:text-white transition-colors"><Icon name="Phone" size={18} /></button>
            <button className="text-[var(--grey-text)] hover:text-white transition-colors"><Icon name="Video" size={18} /></button>
            <button className="text-[var(--grey-text)] hover:text-white transition-colors"><Icon name="MoreVertical" size={18} /></button>
          </div>
        </div>

        {/* messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
          style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #0d0808 100%)' }}>

          {activeChat.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Icon name="MessageCircle" size={48} className="text-[var(--grey-dim)] mb-3" />
              <p className="text-[var(--grey-text)] font-mono text-xs">НЕТ СООБЩЕНИЙ</p>
              <p className="text-[var(--grey-text)] font-mono text-xs mt-1">Начните переписку</p>
            </div>
          )}

          {activeChat.messages.length > 0 && (
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px" style={{ background: 'var(--grey-dim)' }} />
              <span className="text-[10px] font-mono text-[var(--grey-text)] px-2">сегодня</span>
              <div className="flex-1 h-px" style={{ background: 'var(--grey-dim)' }} />
            </div>
          )}

          {activeChat.messages.map((msg, i) => (
            <div
              key={msg.id}
              className={`flex ${msg.sent ? 'justify-end' : 'justify-start'} animate-fade-in`}
              style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}
            >
              {!msg.sent && (
                <div className="w-6 h-6 rounded-full flex-shrink-0 mr-2 mt-1 flex items-center justify-center font-oswald text-[8px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #8b1010, #e01d1d)' }}>
                  {activeChat.user.avatar[0]}
                </div>
              )}
              <div className={`max-w-xs lg:max-w-md ${msg.sent ? 'msg-bubble-sent' : 'msg-bubble-recv'} px-3 py-2`}>
                <p className="text-sm text-white leading-relaxed">{msg.text}</p>
                <div className={`flex items-center gap-1 mt-1 ${msg.sent ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-[10px] font-mono text-[var(--grey-text)]">{msg.time}</span>
                  {msg.sent && (
                    <Icon name={msg.read ? 'CheckCheck' : 'Check'} size={12}
                      className={msg.read ? 'text-[var(--red)]' : 'text-[var(--grey-text)]'} />
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* input */}
        <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--grey-dim)', background: 'var(--black-mid)' }}>
          <button className="text-[var(--grey-text)] hover:text-[var(--red)] transition-colors flex-shrink-0">
            <Icon name="Paperclip" size={18} />
          </button>
          <input
            className="input-void flex-1 px-4 py-2.5 rounded-full text-sm"
            placeholder="Написать сообщение..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: input.trim() ? 'var(--red)' : 'var(--grey-dim)' }}
          >
            <Icon name="Send" size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ROOT
export default function App() {
  const [page, setPage] = useState<'login' | 'register' | 'app'>('login');

  if (page === 'register') {
    return <RegisterScreen onBack={() => setPage('login')} onRegister={() => setPage('login')} />;
  }
  if (page === 'app') {
    return <MainApp onLogout={() => setPage('login')} />;
  }
  return <LoginScreen onLogin={() => setPage('app')} onGoRegister={() => setPage('register')} />;
}
