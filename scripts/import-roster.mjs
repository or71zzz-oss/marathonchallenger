import crypto from 'crypto';
import { update } from '../server/store.js';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 32).toString('hex');
  return { passwordHash, salt };
}

function id() {
  return crypto.randomBytes(8).toString('hex');
}

function names(text) {
  return [...new Set(String(text || '').match(/[가-힣]{2,10}/g) || [])];
}

function distanceSpec(label) {
  const key = String(label).replace(/\s/g, '').toUpperCase();
  if (key === 'FULL' || key === '풀') return { type: 'full', label: '풀' };
  if (key === 'HALF' || key === '하프') return { type: 'half', label: '하프' };
  if (key === '10K') return { type: '10k', label: '10k' };
  if (key === '5K') return { type: '5k', label: '5k' };
  return { type: 'custom', label: String(label).replace(/\s/g, '') };
}

const races = [
  {
    date: '2026-10-17',
    name: '2026 경주마라톤',
    match: (race) => race.date === '2026-10-17' && race.name.includes('경주'),
    startTime: '08:00',
    homepage: 'https://www.gyeongjumarathon.com/home',
    distances: [
      ['FULL', '이규상, 박지윤, 박상제, 김동수, 장승원, 신태범, 박병진, 서평안, 진영곤 최정혁, 김성준, 박규태, 김수홍 이동윤, 남예진, 류동원, 박경태, 이광민, 이성길, 김성준, 전창일, 심지환, 김승훈 오석근 이창훈 김은지'],
      ['HALF', '배태건, 이청미, 김문주, 이준헌'],
      ['10K', '임성진, 남윤덕'],
    ],
  },
  {
    date: '2026-10-18',
    name: '전주 R1',
    startTime: '',
    distances: [['10K', '송윤우']],
  },
  {
    date: '2026-10-18',
    name: '창원 시민 건강 달리기 대회',
    distances: [['6k', '이종호']],
  },
  {
    date: '2026-10-24',
    name: '세종네이버마라톤대회',
    startTime: '09:00',
    place: '세종중앙공원',
    homepage: 'https://sejongrun26.com/',
    distances: [['10K', '박지윤']],
  },
  {
    date: '2026-10-24',
    name: '서울플러스',
    distances: [['10K', '이해원']],
  },
  {
    date: '2026-10-25',
    name: '2026 춘천마라톤',
    match: (race) => race.date === '2026-10-25' && race.name.includes('춘천'),
    startTime: '09:00',
    distances: [
      ['FULL', '정재진 박상제 김다해 김수현 박종확 김동근 김세인 박병진 이상영 박희상 김제훈 감진규 이종호 김건휘, 곽명재, 박규태 강무진, 남윤덕'],
      ['10K', '신지경 유지훈 최정혁'],
      ['서포터', '방태성'],
    ],
  },
  {
    date: '2026-10-25',
    name: '부산바다마라톤',
    startTime: '07:30',
    place: '벡스코',
    distances: [
      ['15K', '임성진 김승훈'],
      ['10K', '정성진, 박건규, 신태범, 이청미, 김수홍, 남예진, 송윤우, 배소희, 이준헌, 이광민, 심지환, 오석근, 이창훈, 김은지, 이소정'],
      ['5K', ''],
    ],
  },
  {
    date: '2026-10-25',
    name: '청도반시마라톤',
    startTime: '09:30',
    homepage: 'https://xn--hq1bo4en6bw9cp5mzkpmgi.kr/main.php',
    distances: [
      ['HALF', '손명진'],
      ['10K', '서평안'],
      ['5.9K', '배태건'],
    ],
  },
  {
    date: '2026-10-31',
    name: '사천노을마라톤',
    startTime: '16:40',
    homepage: 'https://www.sunset.or.kr/ko/sub1_1.html',
    distances: [
      ['HALF', '손명진'],
      ['10K', '송윤우'],
      ['5K', '배태건, 정성진'],
    ],
  },
  {
    date: '2026-10-31',
    name: '오티즘 레이스',
    distances: [['하프', '이해원']],
  },
  {
    date: '2026-11-01',
    name: '김천전국마라톤',
    startTime: '09:30',
    distances: [
      ['HALF', '배태건, 신지경'],
      ['10K', ''],
      ['5K', ''],
    ],
  },
  {
    date: '2026-11-01',
    name: 'JTBC 서울마라톤',
    distances: [
      ['풀', '배소희, 남예진, 임은빈, 전창일, 김승훈, 오석근, 정상휘'],
      ['10K', '신태범'],
    ],
  },
  {
    date: '2026-11-07',
    name: '해군진해 마라톤',
    startTime: '09:00',
    distances: [
      ['11.11K', '손명진, 이청미, 서평안'],
      ['5K', '배태건, 정성진, 박지윤'],
    ],
  },
  {
    date: '2026-11-08',
    name: '양산배내골애플런',
    official: true,
    startTime: '09:00',
    homepage: 'https://k-marathon.or.kr/sub02/sub01_01.php',
    distances: [
      ['10K', '박상제 임성진 유지은 김승훈 남윤덕 모재형 이상비, 이성길, 남윤덕, 서평안, 김승훈, 김은지'],
      ['5K', '배태건, 정성진'],
    ],
  },
  {
    date: '2026-11-08',
    name: '사상에코마라톤',
    match: (race) => race.date === '2026-11-08' && race.name.includes('사상'),
    startTime: '10:00',
    distances: [
      ['10K', '손명진, 정재진, 오석근'],
      ['5K', ''],
    ],
  },
  {
    date: '2026-11-08',
    name: '부산헤리티지런',
    startTime: '08:00',
    place: '다대포해수욕장',
    homepage: 'https://heritagerun.co.kr/',
    distances: [
      ['10K', '박건규, 이동윤, 박경태, 이건윤, 박희상, 이창훈, 이소정'],
      ['5K', '전창일'],
    ],
  },
  {
    date: '2026-11-08',
    name: '후쿠오카마라톤',
    distances: [['풀', '이준헌, 김동완']],
  },
  {
    date: '2026-11-08',
    name: '과천마라톤',
    distances: [['10K', '이해원']],
  },
  {
    date: '2026-11-14',
    name: '포항챔피언쉽마라톤',
    homepage: 'https://www.kormarathon.com/ko/races/2026-pohang-marathon-championship',
    distances: [
      ['10K', '이청미, 박건규, 공병호, 박상제, 김승훈'],
      ['5K', ''],
    ],
  },
  {
    date: '2026-11-15',
    name: '부산국제신문마라톤',
    official: true,
    startTime: '09:00',
    homepage: 'https://www.kjmarathon.com/ko/',
    distances: [
      ['HALF', '진영곤, 김성준 김동근 박건규 김동완 공병호 이재성 이종호 이동윤 이규상 이광민 김수현 남윤덕 이성길 조윤준 김태진 이동윤, 이광민, 임은빈, 남윤덕, 박희상, 김성준, 전창일, 오석근, 이창훈, 김은지'],
      ['10K', '신지경, 박지윤, 정성진 정문화 전주영 김수홍 정효진 서상훈 김건휘 최정혁 최지영 김세인 송윤우 서정민 이재관 감진규 김동수 심지환 이상비 김연근 박경태 김우진 강민수 박홍석 김태원 김수홍, 송윤우, 서평안, 심지환, 김승훈'],
      ['5K', ''],
    ],
  },
  {
    date: '2026-11-15',
    name: '영남알프스마라톤',
    startTime: '08:00',
    distances: [
      ['HALF', ''],
      ['10K', ''],
      ['5K', ''],
    ],
  },
  {
    date: '2026-11-15',
    name: '제주감귤국제마라톤',
    distances: [
      ['풀', '남승희'],
      ['하프', ''],
      ['10K', ''],
    ],
  },
  {
    date: '2026-11-15',
    name: '서울MBN마라톤',
    distances: [['하프', '이소정']],
  },
  {
    date: '2026-11-21',
    name: '서울신문 고프리런',
    distances: [['하프', '오석근']],
  },
  {
    date: '2026-11-21',
    name: '2026 가을바람 유러닝 페스타',
    startTime: '08:30',
    homepage: 'https://urfesta.com/register/',
    distances: [
      ['10K', ''],
      ['5K', '박지윤'],
    ],
  },
  {
    date: '2026-11-22',
    name: '인천마라톤',
    distances: [['풀', '이해원']],
  },
  {
    date: '2026-11-28',
    name: '남원춘향마라톤',
    startTime: '08:40',
    distances: [
      ['FULL', ''],
      ['하프', '김세인'],
      ['10K', ''],
      ['5K', '심지환, 박지윤, 이창훈'],
    ],
  },
  {
    date: '2026-11-29',
    name: '가야왕도 김해 전국어울림',
    match: (race) => race.date === '2026-11-29' && race.name.includes('가야'),
    startTime: '08:40',
    distances: [
      ['FULL', ''],
      ['하프', '배태건, 손명진, 이종호, 오석근'],
      ['10K', '신태범, 정재진, 강무진'],
      ['5K', ''],
    ],
  },
  {
    date: '2026-12-05',
    name: '금산골드런레이스',
    distances: [['하프', '이소정']],
  },
  {
    date: '2026-12-06',
    name: '부산브릿지마라톤',
    startTime: '07:30',
    homepage: 'https://busanmarathon.com/guide/mainpoints?gubun=mainpoints',
    distances: [
      ['풀', '임은빈, 박상제, 박지윤, 김동근, 송윤우, 이준헌, 류동원, 박희상, 김성준, 서평안, 전창일, 심지환 박동현 김승훈 정상휘 이창훈 김은지'],
      ['10K', '남승희 오석근 김세인'],
    ],
  },
  {
    date: '2026-12-06',
    name: '양산전국하프마라톤대회',
    match: (race) => race.date === '2026-12-06' && race.name.includes('양산') && race.name.includes('하프'),
    startTime: '09:00',
    homepage: 'https://ysmarathon.kr/info1',
    distances: [
      ['하프', '정재진, 이종호, 박건규'],
      ['10K', '남윤덕'],
    ],
  },
  {
    date: '2026-12-13',
    name: '진주마라톤대회',
    startTime: '09:30',
    homepage: 'https://www.jinma.co.kr/ko/sub1_2.html',
    distances: [
      ['풀', '강무진, 진영곤, 남윤덕, 이종호, 김승훈'],
      ['하프', '임은빈, 송윤우, 이건윤'],
    ],
  },
  {
    date: '2026-12-13',
    name: '기장육상연맹',
    distances: [['10K', '박규태, 정성진, 전창일, 오석근, 김은지, 이소정']],
  },
];

function ensureUser(db, name, password) {
  if (!/^[가-힣]{2,10}$/.test(name)) {
    throw new Error(`잘못된 이름: ${name}`);
  }
  let user = db.users.find((item) => item.name === name);
  if (!user) {
    user = password
      ? { id: id(), name, ...hashPassword(password), passwordSet: true }
      : { id: id(), name, passwordHash: '', salt: '', passwordSet: false };
    db.users.push(user);
  }
  return user;
}

function ensureDistance(race, spec) {
  let distance = race.distances.find((item) => item.type === spec.type && item.label === spec.label);
  if (!distance) {
    distance = { id: id(), type: spec.type, label: spec.label };
    race.distances.push(distance);
  }
  return distance;
}

function ensureEntry(race, user, distance, goalTime) {
  const existing = race.entries.find((entry) => entry.userId === user.id && entry.distanceId === distance.id);
  if (existing) {
    if (goalTime && !existing.goalTime) existing.goalTime = goalTime;
    return existing;
  }
  const entry = { userId: user.id, distanceId: distance.id, goalTime: goalTime || '' };
  race.entries.push(entry);
  return entry;
}

const summary = await update((db) => {
  const createdUsers = [];
  const hong = ensureUser(db, '홍길동', '1234');
  let addedRaces = 0;
  let updatedRaces = 0;

  for (const item of races) {
    let race = item.match ? db.races.find(item.match) : db.races.find((row) => row.date === item.date && row.name === item.name);
    if (!race) {
      race = {
        id: id(),
        date: item.date,
        name: item.name,
        distances: [],
        entries: [],
        createdBy: hong.id,
      };
      db.races.push(race);
      addedRaces += 1;
    } else {
      updatedRaces += 1;
    }

    race.name = item.name;
    race.startTime = item.startTime || '';
    race.place = item.place || '';
    race.homepage = item.homepage || '';
    race.official = Boolean(item.official);

    for (const [label, people] of item.distances) {
      const distance = ensureDistance(race, distanceSpec(label));
      for (const person of names(people)) {
        const user = ensureUser(db, person);
        if (user.passwordSet === false && !createdUsers.includes(person) && db.users.filter((row) => row.name === person).length === 1) {
          createdUsers.push(person);
        }
        ensureEntry(race, user, distance, '');
      }
    }

    const ten = ensureDistance(race, distanceSpec('10K'));
    const entry = ensureEntry(race, hong, ten, '00:40:00');
    entry.goalTime = '00:40:00';
  }

  const pending = db.users.filter((user) => user.passwordSet === false).map((user) => user.name);
  return {
    races: db.races.length,
    addedRaces,
    updatedRaces,
    users: db.users.length,
    pending: pending.length,
    hongRaces: db.races.filter((race) => race.entries.some((entry) => entry.userId === hong.id && entry.goalTime === '00:40:00')).length,
  };
});

console.log(JSON.stringify(summary, null, 2));
