const TOKEN_KEY = 'marathon_token';

function resolveApiRoot() {
  return (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
}

const API_ROOT = resolveApiRoot();

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    const url = `${API_ROOT}${path}`;
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new Error('서버에 연결하지 못했습니다.');
  }

  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/api/login') {
    setToken(null);
  }
  if (!response.ok) {
    const fallback = response.status === 404
      ? 'API 주소를 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.'
      : `요청을 처리하지 못했습니다. (${response.status})`;
    const error = new Error(data.error || fallback);
    error.status = response.status;
    throw error;
  }
  return data;
}
