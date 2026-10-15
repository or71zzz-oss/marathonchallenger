const base = process.argv[2] || 'https://marathonchallenger.vercel.app';

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
}

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json; charset=utf-8';
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

try {
  const health = await request('/api/health');
  if (health.status === 200 && health.data.ok) pass('Health');
  else fail('Health', `status ${health.status}`);

  const login = await request('/api/login', {
    method: 'POST',
    body: { name: '관리자', password: '1234' },
  });
  const token = login.data.token;
  if (login.status === 200 && token && login.data.user?.role === 'admin') {
    pass('관리자 로그인', login.data.user.name);
  } else {
    fail('관리자 로그인', JSON.stringify(login.data));
  }

  if (!token) throw new Error('skip');

  const bootstrap = await request('/api/bootstrap', { token });
  const raceCount = bootstrap.data.races?.length ?? 0;
  if (bootstrap.status === 200 && raceCount > 0) {
    pass('Bootstrap / 대회 목록', `${raceCount}개`);
  } else {
    fail('Bootstrap / 대회 목록', `status ${bootstrap.status}, races ${raceCount}`);
  }

  const raceId = bootstrap.data.races?.[0]?.id;
  if (raceId) {
    const detail = await request(`/api/races/${raceId}`, { token });
    if (detail.status === 200 && detail.data.race?.id === raceId) {
      pass('대회 상세 API', detail.data.race.name);
    } else {
      fail('대회 상세 API', `status ${detail.status}`);
    }
  }

  const admin = await request('/api/admin/users', { token });
  const userCount = admin.data.users?.length ?? 0;
  if (admin.status === 200 && userCount > 0) {
    pass('회원 관리 API', `${userCount}명`);
  } else {
    fail('회원 관리 API', `status ${admin.status}`);
  }

  const badLogin = await request('/api/login', {
    method: 'POST',
    body: { name: '관리자', password: '0000' },
  });
  if (badLogin.status === 401) pass('잘못된 비밀번호 거부');
  else fail('잘못된 비밀번호 거부', `status ${badLogin.status}`);

  const member = await request('/api/login', {
    method: 'POST',
    body: { name: '큐에이', password: '9999' },
  });
  const memberToken = member.data.token;
  if (member.status === 200 && memberToken) pass('일반 회원 로그인(신규/기존)');
  else fail('일반 회원 로그인', JSON.stringify(member.data));

  if (memberToken) {
    const denied = await request('/api/admin/users', { token: memberToken });
    if (denied.status === 403) pass('일반 회원 관리자 API 차단');
    else fail('일반 회원 관리자 API 차단', `status ${denied.status}`);
  }

  await request('/api/logout', { method: 'POST', token });
  const afterLogout = await request('/api/me', { token });
  if (afterLogout.status === 401) pass('로그아웃 후 세션 무효');
  else fail('로그아웃 후 세션 무효', `status ${afterLogout.status}`);
} catch (error) {
  fail('테스트 실행', error.message);
}

let failed = 0;
for (const row of results) {
  const mark = row.ok ? 'OK' : 'FAIL';
  console.log(`${mark}  ${row.name}${row.detail ? ` — ${row.detail}` : ''}`);
  if (!row.ok) failed += 1;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
