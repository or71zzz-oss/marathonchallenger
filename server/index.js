import express from 'express';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { read, update } from './store.js';

const app = express();
app.use(express.json());

const DISTANCE_LABELS = {
  full: '풀',
  half: '하프',
  '10k': '10k',
  '5k': '5k',
};

const DISTANCE_ORDER = ['full', 'half', '10k', '5k', 'custom'];

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const passwordHash = scryptSync(password, salt, 32).toString('hex');
  return { passwordHash, salt };
}

function verifyPassword(password, passwordHash, salt) {
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(passwordHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function goalSeconds(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const match = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(text);
  if (!match) return undefined;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (match[3] == null) return first * 60 + second;
  return first * 3600 + second * 60 + Number(match[3]);
}

function publicUser(user) {
  return { id: user.id, name: user.name };
}

function publicRace(db, race) {
  const names = new Map(db.users.map((user) => [user.id, user.name]));
  const entries = race.entries
    .map((entry) => ({
      userId: entry.userId,
      userName: names.get(entry.userId) || '알 수 없음',
      distanceId: entry.distanceId,
      goalTime: entry.goalTime || '',
    }))
    .sort((a, b) => {
      const aSeconds = goalSeconds(a.goalTime);
      const bSeconds = goalSeconds(b.goalTime);
      if (aSeconds == null && bSeconds == null) return a.userName.localeCompare(b.userName, 'ko');
      if (aSeconds == null) return 1;
      if (bSeconds == null) return -1;
      if (aSeconds !== bSeconds) return aSeconds - bSeconds;
      return a.userName.localeCompare(b.userName, 'ko');
    });

  return {
    id: race.id,
    date: race.date,
    name: race.name,
    startTime: race.startTime || '',
    place: race.place || '',
    homepage: race.homepage || '',
    official: Boolean(race.official),
    distances: race.distances,
    entries,
  };
}

function authUser(req, db) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const session = db.sessions.find((item) => item.token === token);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function requireUser(req, res, next) {
  read()
    .then((db) => {
      const user = authUser(req, db);
      if (!user) {
        res.status(401).json({ error: '다시 로그인해 주세요.' });
        return;
      }
      req.user = user;
      next();
    })
    .catch(next);
}

app.post('/api/login', (req, res, next) => {
  const name = String(req.body?.name || '').trim();
  const password = String(req.body?.password || '');

  if (!/^[가-힣]{2,10}$/.test(name)) {
    res.status(400).json({ error: '이름은 한글 2~10자로 입력해 주세요.' });
    return;
  }
  if (!/^\d{4}$/.test(password)) {
    res.status(400).json({ error: '비밀번호는 숫자 4자리로 입력해 주세요.' });
    return;
  }

  update((db) => {
    let user = db.users.find((item) => item.name === name);
    if (!user) {
      const { passwordHash, salt } = hashPassword(password);
      user = { id: randomBytes(8).toString('hex'), name, passwordHash, salt, passwordSet: true };
      db.users.push(user);
    } else if (user.passwordSet === false) {
      const hashed = hashPassword(password);
      user.passwordHash = hashed.passwordHash;
      user.salt = hashed.salt;
      user.passwordSet = true;
    } else if (!verifyPassword(password, user.passwordHash, user.salt)) {
      const error = new Error('비밀번호가 맞지 않습니다.');
      error.status = 401;
      throw error;
    }

    const token = randomBytes(24).toString('hex');
    db.sessions.push({ token, userId: user.id });
    return { token, user: publicUser(user) };
  })
    .then((result) => res.json(result))
    .catch(next);
});

app.get('/api/me', requireUser, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/logout', requireUser, (req, res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  update((db) => {
    db.sessions = db.sessions.filter((session) => session.token !== token);
  })
    .then(() => res.json({ ok: true }))
    .catch(next);
});

app.get('/api/races', requireUser, (req, res, next) => {
  read()
    .then((db) => {
      const races = [...db.races]
        .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'ko'))
        .map((race) => publicRace(db, race));
      res.json({ races });
    })
    .catch(next);
});

function readRaceInput(body) {
  const date = String(body?.date || '');
  const name = String(body?.name || '').trim();
  const requested = Array.isArray(body?.distances) ? body.distances : [];

  if (!isValidDate(date)) return { error: '날짜를 선택해 주세요.' };
  if (!name || name.length > 40) return { error: '대회명은 1~40자로 입력해 주세요.' };

  const selected = new Map();
  for (const item of requested) {
    const type = String(item?.type || '');
    if (!DISTANCE_ORDER.includes(type)) return { error: '거리 선택이 올바르지 않습니다.' };
    if (type !== 'custom' && selected.has(type)) continue;
    const label = type === 'custom' ? String(item?.label || '').trim() : DISTANCE_LABELS[type];
    if (type === 'custom' && (!label || label.length > 20)) {
      return { error: '기타 거리는 1~20자로 입력해 주세요.' };
    }
    selected.set(type === 'custom' ? `custom:${label}` : type, { type, label });
  }

  const items = DISTANCE_ORDER.flatMap((type) => {
    if (type === 'custom') return [...selected.values()].filter((item) => item.type === 'custom');
    return selected.has(type) ? [selected.get(type)] : [];
  });
  if (items.length === 0) return { error: '거리를 하나 이상 선택해 주세요.' };
  return { date, name, items };
}

function buildDistances(items, previous = []) {
  const used = new Set();
  return items.map((item) => {
    const found = previous.find((distance) => {
      if (used.has(distance.id) || distance.type !== item.type) return false;
      return item.type !== 'custom' || distance.label === item.label;
    });
    if (found) {
      used.add(found.id);
      return { id: found.id, type: item.type, label: item.label };
    }
    return { id: randomBytes(6).toString('hex'), type: item.type, label: item.label };
  });
}

app.post('/api/races', requireUser, (req, res, next) => {
  const input = readRaceInput(req.body);
  if (input.error) {
    res.status(400).json({ error: input.error });
    return;
  }

  update((db) => {
    const race = {
      id: randomBytes(8).toString('hex'),
      date: input.date,
      name: input.name,
      distances: buildDistances(input.items),
      entries: [],
      createdBy: req.user.id,
    };
    db.races.push(race);
    return publicRace(db, race);
  })
    .then((race) => res.status(201).json({ race }))
    .catch(next);
});

app.put('/api/races/:id', requireUser, (req, res, next) => {
  if (req.user.name !== '정재진') {
    res.status(403).json({ error: '대회를 수정할 수 없습니다.' });
    return;
  }
  const input = readRaceInput(req.body);
  if (input.error) {
    res.status(400).json({ error: input.error });
    return;
  }

  update((db) => {
    const race = db.races.find((item) => item.id === req.params.id);
    if (!race) {
      const error = new Error('대회를 찾을 수 없습니다.');
      error.status = 404;
      throw error;
    }
    const distances = buildDistances(input.items, race.distances);
    const distanceIds = new Set(distances.map((distance) => distance.id));
    race.date = input.date;
    race.name = input.name;
    race.distances = distances;
    race.entries = race.entries.filter((entry) => distanceIds.has(entry.distanceId));
    return publicRace(db, race);
  })
    .then((race) => res.json({ race }))
    .catch(next);
});

app.delete('/api/races/:id', requireUser, (req, res, next) => {
  if (req.user.name !== '정재진') {
    res.status(403).json({ error: '대회를 삭제할 수 없습니다.' });
    return;
  }
  update((db) => {
    const index = db.races.findIndex((race) => race.id === req.params.id);
    if (index < 0) {
      const error = new Error('대회를 찾을 수 없습니다.');
      error.status = 404;
      throw error;
    }
    db.races.splice(index, 1);
    return { ok: true };
  })
    .then((result) => res.json(result))
    .catch(next);
});

app.put('/api/races/:id/entries', requireUser, (req, res, next) => {
  const distanceId = String(req.body?.distanceId || '');
  const active = Boolean(req.body?.active);
  const goalTime = String(req.body?.goalTime || '').trim();

  if (goalTime && goalSeconds(goalTime) == null) {
    res.status(400).json({ error: '도전 시간은 00:00:00 형식으로 입력해 주세요.' });
    return;
  }

  update((db) => {
    const race = db.races.find((item) => item.id === req.params.id);
    if (!race) {
      const error = new Error('대회를 찾을 수 없습니다.');
      error.status = 404;
      throw error;
    }
    if (!race.distances.some((distance) => distance.id === distanceId)) {
      const error = new Error('선택한 거리를 찾을 수 없습니다.');
      error.status = 400;
      throw error;
    }

    race.entries = race.entries.filter(
      (entry) => !(entry.userId === req.user.id && entry.distanceId === distanceId),
    );
    if (active) {
      race.entries.push({
        userId: req.user.id,
        distanceId,
        goalTime,
      });
    }
    return publicRace(db, race);
  })
    .then((race) => res.json({ race }))
    .catch(next);
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: error.status ? error.message : '요청을 처리하지 못했습니다.' });
});

const port = 3001;
app.listen(port, '127.0.0.1', () => {
  console.log(`API http://127.0.0.1:${port}`);
});
