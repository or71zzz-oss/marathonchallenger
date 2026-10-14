const TOKEN_KEY = 'marathon_token';

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
    response = await fetch(path, { ...options, headers });
  } catch {
    throw new Error('서버에 연결하지 못했습니다.');
  }

  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/api/login') {
    setToken(null);
  }
  if (!response.ok) {
    const error = new Error(data.error || '요청을 처리하지 못했습니다.');
    error.status = response.status;
    throw error;
  }
  return data;
}
