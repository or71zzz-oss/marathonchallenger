import { useState } from 'react';
import { api, setToken } from '../api.js';

export default function LoginPage({ onLogin }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const data = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), password }),
      });
      setToken(data.token);
      onLogin(data.user, data.races);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="page narrow">
      <section className="card login-card">
        <p className="brand">마라톤챌린저</p>
        <h1>팀 대회 보드</h1>
        <div className="login-intro muted">
          <p>한글 이름과 비밀번호 숫자 4자리로 로그인합니다.</p>
          <p>이름과 비밀번호는 암호화됩니다.</p>
          <p>즐거운 달리기 생활 합시다!</p>
        </div>
        <form onSubmit={submit} className="stack">
          <label>
            이름
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="홍길동"
              autoComplete="off"
              required
            />
          </label>
          <label>
            비밀번호
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="숫자 4자리"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary" type="submit" disabled={pending}>
            {pending ? '로그인 중' : '로그인'}
          </button>
        </form>
      </section>
    </main>
  );
}
