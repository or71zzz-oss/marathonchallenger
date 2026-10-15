import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api, getToken, setToken } from './api.js';
import LoginPage from './pages/LoginPage.jsx';
import RaceDetailPage from './pages/RaceDetailPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import RaceListPage from './pages/RaceListPage.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [preloadedRaces, setPreloadedRaces] = useState(null);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api('/api/bootstrap')
      .then((data) => {
        setUser(data.user);
        setPreloadedRaces(data.races);
      })
      .catch(() => {
        setUser(null);
        setPreloadedRaces(null);
      })
      .finally(() => setReady(true));
  }, []);

  function handleLogin(nextUser, races) {
    setUser(nextUser);
    setPreloadedRaces(races ?? null);
  }

  async function logout() {
    try {
      await api('/api/logout', { method: 'POST' });
    } catch {
      // 세션이 이미 없어도 화면에서는 로그아웃으로 처리합니다.
    }
    sessionStorage.removeItem('marathon-list-restore');
    setToken(null);
    setUser(null);
    setPreloadedRaces(null);
  }

  if (!ready) {
    return <p className="status-line">불러오는 중</p>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />}
      />
      <Route
        path="/"
        element={
          user
            ? (
              <RaceListPage
                user={user}
                onLogout={logout}
                initialRaces={preloadedRaces}
                onRacesLoaded={setPreloadedRaces}
              />
            )
            : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/admin"
        element={user ? <AdminPage user={user} onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/races/:id"
        element={user ? <RaceDetailPage user={user} onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}
