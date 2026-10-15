import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { read, update } from './store.js';

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === 'http://localhost:5173' || origin === 'http://localhost:5174') return true;
  if (origin === 'https://or71zzz-oss.github.io') return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    if (hostname.endsWith('.vercel.app')) return true;
  } catch {
    return false;
  }
  return false;
}

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

const ADMIN_NAME = '관리자';

function isAdmin(user) {
  return user?.role === 'admin' || user?.name === ADMIN_NAME;
}

function canManageRaces(user) {
  return isAdmin(user);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    role: isAdmin(user) ? 'admin' : 'member',
  };
}

function ensureAdminUser(db) {
  const { passwordHash, salt } = hashPassword('1234');
  let user = db.users.find((item) => item.name === ADMIN_NAME);
  if (!user) {
    db.users.push({
      id: randomBytes(8).toString('hex'),
      name: ADMIN_NAME,
      passwordHash,
      salt,
      passwordSet: true,
      role: 'admin',
      banned: false,
    });
    return;
  }
  user.role = 'admin';
  user.banned = false;
  user.passwordSet = true;
  user.passwordHash = passwordHash;
  user.salt = salt;
}

function adminUserSummary(db, user) {
  const activeSessions = db.sessions.filter((session) => session.userId === user.id).length;
  let raceEntries = 0;
  for (const race of db.races) {
    raceEntries += race.entries.filter((entry) => entry.userId === user.id).length;
  }
  return {
    id: user.id,
    name: user.name,
    role: isAdmin(user) ? 'admin' : 'member',
    banned: Boolean(user.banned),
    passwordSet: user.passwordSet !== false,
    activeSessions,
    raceEntries,
  };
}

function banUser(db, targetId, actorId) {
  if (targetId === actorId) {
    const error = new Error('자기 자신은 추방할 수 없습니다.');
    error.status = 400;
    throw error;
  }
  const user = db.users.find((item) => item.id === targetId);
  if (!user) {
    const error = new Error('사용자를 찾을 수 없습니다.');
    error.status = 404;
    throw error;
  }
  if (isAdmin(user)) {
    const error = new Error('관리자는 추방할 수 없습니다.');
    error.status = 403;
    throw error;
  }
  user.banned = true;
  db.sessions = db.sessions.filter((session) => session.userId !== targetId);
  for (const race of db.races) {
    race.entries = race.entries.filter((entry) => entry.userId !== targetId);
  }
  return adminUserSummary(db, user);
}

function normalizeRaceEntries(race) {
  const byUser = new Map();
  for (const entry of race.entries) {
    byUser.set(entry.userId, entry);
  }
  race.entries = [...byUser.values()];
}

function listPublicRaces(db) {
  for (const race of db.races) normalizeRaceEntries(race);
  return [...db.races]
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'ko'))
    .map((race) => publicRace(db, race));
}

function publicRace(db, race) {
  normalizeRaceEntries(race);
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

export function createApp({ serveStatic = false } = {}) {
  const app = express();

  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json());

  function requireUser(req, res, next) {
    read()
      .then((db) => {
        const user = authUser(req, db);
        if (!user) {
          res.status(401).json({ error: '다시 로그인해 주세요.' });
          return;
        }
        if (user.banned) {
          res.status(403).json({ error: '접근이 제한된 사용자입니다.' });
          return;
        }
        req.user = user;
        next();
      })
      .catch(next);
  }

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

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
      ensureAdminUser(db);
      let user = db.users.find((item) => item.name === name);
      if (!user) {
        const { passwordHash, salt } = hashPassword(password);
        user = {
          id: randomBytes(8).toString('hex'),
          name,
          passwordHash,
          salt,
          passwordSet: true,
          role: 'member',
          banned: false,
        };
        db.users.push(user);
      } else if (user.banned) {
        const error = new Error('접근이 제한된 사용자입니다.');
        error.status = 403;
        throw error;
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
      return { token, user: publicUser(user), races: listPublicRaces(db) };
    })
      .then((result) => res.json(result))
      .catch(next);
  });

  app.get('/api/me', requireUser, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  app.get('/api/bootstrap', (req, res, next) => {
    read()
      .then((db) => {
        const user = authUser(req, db);
        if (!user) {
          res.status(401).json({ error: '다시 로그인해 주세요.' });
          return;
        }
        if (user.banned) {
          res.status(403).json({ error: '접근이 제한된 사용자입니다.' });
          return;
        }
        res.json({ user: publicUser(user), races: listPublicRaces(db) });
      })
      .catch(next);
  });

  app.get('/api/admin/users', requireUser, (req, res, next) => {
    if (!isAdmin(req.user)) {
      res.status(403).json({ error: '권한이 없습니다.' });
      return;
    }
    read()
      .then((db) => {
        const users = db.users
          .map((user) => adminUserSummary(db, user))
          .sort((a, b) => {
            if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
            if (a.banned !== b.banned) return a.banned ? 1 : -1;
            return a.name.localeCompare(b.name, 'ko');
          });
        res.json({ users });
      })
      .catch(next);
  });

  app.post('/api/admin/users/:id/ban', requireUser, (req, res, next) => {
    if (!isAdmin(req.user)) {
      res.status(403).json({ error: '권한이 없습니다.' });
      return;
    }
    update((db) => {
      const user = banUser(db, req.params.id, req.user.id);
      return { user };
    })
      .then((result) => res.json(result))
      .catch(next);
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
        res.json({ races: listPublicRaces(db) });
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
    const official = Boolean(body?.official);
    return { date, name, items, official };
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
        official: input.official,
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
    if (!canManageRaces(req.user)) {
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
      race.official = input.official;
      race.distances = distances;
      race.entries = race.entries.filter((entry) => distanceIds.has(entry.distanceId));
      return publicRace(db, race);
    })
      .then((race) => res.json({ race }))
      .catch(next);
  });

  app.delete('/api/races/:id', requireUser, (req, res, next) => {
    if (!canManageRaces(req.user)) {
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

      normalizeRaceEntries(race);

      const existing = race.entries.find((entry) => entry.userId === req.user.id);

      if (active) {
        if (existing && existing.distanceId !== distanceId) {
          const error = new Error('선택한 종목을 먼저 취소한 뒤 다른 종목을 선택해 주세요.');
          error.status = 409;
          throw error;
        }
        if (existing) {
          existing.goalTime = goalTime || existing.goalTime || '';
        } else {
          race.entries.push({
            userId: req.user.id,
            distanceId,
            goalTime,
          });
        }
      } else {
        race.entries = race.entries.filter((entry) => entry.userId !== req.user.id);
      }

      normalizeRaceEntries(race);
      return publicRace(db, race);
    })
      .then((race) => res.json({ race }))
      .catch(next);
  });

  if (serveStatic) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use((error, req, res, next) => {
    const origin = req.get('origin');
    if (origin && isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    const status = error.status || 500;
    if (status === 500) console.error(error);
    res.status(status).json({ error: error.status ? error.message : '요청을 처리하지 못했습니다.' });
  });

  return app;
}
