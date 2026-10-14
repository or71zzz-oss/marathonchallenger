import { useMemo, useState } from 'react';
import { dateToIso } from './format.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function monthStartWeekday(year, month) {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isoToSlash(iso) {
  const [year, month, day] = iso.split('-');
  return `${year}/${month}/${day}`;
}

export default function CalendarPicker({ value, onSelect }) {
  const selected = dateToIso(value);
  const start = useMemo(() => {
    if (selected) {
      const [year, month] = selected.split('-').map(Number);
      return { year, month };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, [selected]);
  const [cursor, setCursor] = useState(start);

  const blanks = monthStartWeekday(cursor.year, cursor.month);
  const days = daysInMonth(cursor.year, cursor.month);

  function shiftMonth(amount) {
    setCursor((current) => {
      const next = new Date(Date.UTC(current.year, current.month - 1 + amount, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 };
    });
  }

  return (
    <div className="calendar" role="dialog" aria-label="날짜 선택">
      <div className="calendar-nav">
        <button type="button" className="ghost calendar-nav-button" onClick={() => shiftMonth(-1)} aria-label="이전 달">‹</button>
        <strong>{cursor.year}년 {cursor.month}월</strong>
        <button type="button" className="ghost calendar-nav-button" onClick={() => shiftMonth(1)} aria-label="다음 달">›</button>
      </div>
      <div className="calendar-grid">
        {WEEKDAYS.map((label, index) => (
          <span key={label} className={index === 0 ? 'calendar-head sun' : index === 6 ? 'calendar-head sat' : 'calendar-head'}>
            {label}
          </span>
        ))}
        {Array.from({ length: blanks }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const weekday = (blanks + index) % 7;
          const iso = `${cursor.year}-${String(cursor.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const className = [
            'calendar-day',
            weekday === 0 ? 'sun' : '',
            weekday === 6 ? 'sat' : '',
            iso === selected ? 'selected' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={iso}
              type="button"
              className={className}
              onClick={() => onSelect(isoToSlash(iso))}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
