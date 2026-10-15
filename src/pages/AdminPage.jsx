import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAdminUser } from '../auth.js';
import { api } from '../api.js';
import Shell from '../Shell.jsx';

export default function AdminPage({ user, onLogout }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);

  async function load() {
    const data = await api('/api/admin/users');
    setUsers(data.users);
  }

  useEffect(() => {
    if (!isAdminUser(user)) {
      navigate('/', { replace: true });
      return;
    }
    load()
      .catch((err) => {
        if (err.status === 401) navigate('/login', { replace: true });
        else if (err.status === 403) setError('관리자만 접근할 수 있습니다. 로그아웃 후 관리자(1234)로 다시 로그인해 주세요.');
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [user, navigate]);

  async function ban(target) {
    if (!window.confirm(`"${target.name}" 사용자를 추방할까요?\n로그인·대회 참가가 모두 해제됩니다.`)) return;
    setPendingId(target.id);
    setError('');
    try {
      const data = await api(`/api/admin/users/${target.id}/ban`, { method: 'POST' });
      setUsers((prev) => prev.map((row) => (row.id === data.user.id ? data.user : row)));
    } catch (err) {
      if (err.status === 401) navigate('/login', { replace: true });
      else setError(err.message);
    } finally {
      setPendingId(null);
    }
  }

  const activeCount = users.filter((row) => !row.banned && row.role !== 'admin').length;
  const bannedCount = users.filter((row) => row.banned).length;

  return (
    <Shell
      user={user}
      onLogout={onLogout}
      action={<Link className="ghost" to="/">대회 목록</Link>}
    >
      <section className="card admin-card">
        <h1>회원 관리</h1>
        <p className="muted admin-summary">
          가입·로그인한 사용자 {users.length}명 · 활동 {activeCount}명 · 추방 {bannedCount}명
        </p>
        {error ? <p className="form-error">{error}</p> : null}
        {loading ? (
          <p className="status-line">불러오는 중</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>역할</th>
                  <th>비밀번호</th>
                  <th>로그인</th>
                  <th>참가</th>
                  <th>상태</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id} className={row.banned ? 'is-banned' : ''}>
                    <td>{row.name}</td>
                    <td>{row.role === 'admin' ? '관리자' : '회원'}</td>
                    <td>{row.passwordSet ? '설정됨' : '미설정'}</td>
                    <td>{row.activeSessions > 0 ? '접속 중' : '—'}</td>
                    <td>{row.raceEntries > 0 ? `${row.raceEntries}건` : '—'}</td>
                    <td>{row.banned ? '추방됨' : '정상'}</td>
                    <td>
                      {row.role !== 'admin' && !row.banned ? (
                        <button
                          type="button"
                          className="ghost danger-text"
                          disabled={pendingId === row.id}
                          onClick={() => ban(row)}
                        >
                          {pendingId === row.id ? '처리 중' : '추방'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Shell>
  );
}
