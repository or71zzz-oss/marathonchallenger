export const DISTANCE_OPTIONS = [
  { type: 'full', label: '풀' },
  { type: 'half', label: '하프' },
  { type: '10k', label: '10k' },
  { type: '5k', label: '5k' },
  { type: 'custom', label: '기타' },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function weekdayOf(year, month, day) {
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${year}.${month}.${day}(${weekdayOf(year, month, day)})`;
}

export function formatDateLong(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일(${weekdayOf(year, month, day)})`;
}

export function maskDate(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join('/');
}

export function dateToIso(value) {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

export function maskFromDigits(digits) {
  const clean = String(digits || '').replace(/\D/g, '').slice(-6).padStart(6, '0');
  return `${clean.slice(0, 2)}:${clean.slice(2, 4)}:${clean.slice(4, 6)}`;
}

export function toTimeMask(value) {
  const text = String(value || '').trim();
  if (!text) return '00:00:00';
  const full = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(text);
  if (full) return `${full[1].padStart(2, '0')}:${full[2]}:${full[3]}`;
  const short = /^(\d{1,2}):([0-5]\d)$/.exec(text);
  if (short) return `00:${short[1].padStart(2, '0')}:${short[2]}`;
  return maskFromDigits(text);
}

export function isStrictGoalTime(value) {
  return /^(\d{2}):([0-5]\d):([0-5]\d)$/.test(value);
}

export function pushTimeDigit(current, digit) {
  const significant = toTimeMask(current).replace(/\D/g, '').replace(/^0+/, '');
  return maskFromDigits(significant + digit);
}

export function popTimeDigit(current) {
  const significant = toTimeMask(current).replace(/\D/g, '').replace(/^0+/, '').slice(0, -1);
  return maskFromDigits(significant);
}

/** 대회별 참가 인원(한 사람은 한 번만 집계) */
export function totalParticipantCount(race) {
  if (!race?.entries?.length) return 0;
  return new Set(race.entries.map((entry) => entry.userId)).size;
}

/** 참가자 수 구간별 표시 클래스 (0~9, 10~19, 20~29, 30+) */
export function participantCountClass(count) {
  const n = Number(count) || 0;
  if (n >= 30) return 'participant-total tier-30';
  if (n >= 20) return 'participant-total tier-20';
  if (n >= 10) return 'participant-total tier-10';
  return 'participant-total tier-0';
}
