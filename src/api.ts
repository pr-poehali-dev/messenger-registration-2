const AUTH_URL = 'https://functions.poehali.dev/75ef1504-050b-4c9c-b634-c059306a98d6';
const MESSAGES_URL = 'https://functions.poehali.dev/fe92fb78-1df8-4538-a730-b732855e2dbc';
const USERS_URL = 'https://functions.poehali.dev/7efd2e08-ce0e-4e56-9a84-51c777a37a9e';

function getToken() { return localStorage.getItem('void_token') || ''; }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

async function req(url: string, method = 'GET', body?: object) {
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// Auth
export const api = {
  auth: {
    register: (username: string, name: string, password: string) =>
      req(`${AUTH_URL}/register`, 'POST', { username, name, password }),
    login: (username: string, password: string) =>
      req(`${AUTH_URL}/login`, 'POST', { username, password }),
    logout: () => req(`${AUTH_URL}/logout`, 'POST'),
    me: () => req(`${AUTH_URL}/me`),
  },
  users: {
    search: (q: string) => req(`${USERS_URL}/search?q=${encodeURIComponent(q)}`),
    getUser: (id: number) => req(`${USERS_URL}/users/${id}`),
    updateMe: (data: { name?: string; bio?: string }) => req(`${USERS_URL}/me`, 'PUT', data),
    adminBan: (user_id: number, minutes: number) =>
      req(`${USERS_URL}/admin/ban`, 'POST', { user_id, minutes }),
    adminSetBadge: (user_id: number, badge: string, badge_label: string) =>
      req(`${USERS_URL}/admin/set-badge`, 'POST', { user_id, badge, badge_label }),
    adminSetLogin: (target_user_id: number, new_username: string) =>
      req(`${USERS_URL}/admin/set-login`, 'POST', { target_user_id, new_username }),
    adminRemoveUser: (user_id: number) =>
      req(`${USERS_URL}/admin/remove-user`, 'POST', { user_id }),
  },
  messages: {
    getConversations: () => req(`${MESSAGES_URL}/conversations`),
    getMessages: (conv_id: number) => req(`${MESSAGES_URL}/conversations/${conv_id}/messages`),
    createConversation: (partner_id: number) =>
      req(`${MESSAGES_URL}/conversations`, 'POST', { partner_id }),
    sendMessage: (conv_id: number, text: string) =>
      req(`${MESSAGES_URL}/conversations/${conv_id}/messages`, 'POST', { text }),
    markRead: (conv_id: number) =>
      req(`${MESSAGES_URL}/conversations/${conv_id}/read`, 'POST'),
    editMessage: (msg_id: number, text: string) =>
      req(`${MESSAGES_URL}/messages/${msg_id}`, 'PUT', { text }),
    removeMessage: (msg_id: number) =>
      req(`${MESSAGES_URL}/messages/${msg_id}/remove`, 'POST'),
  },
};
