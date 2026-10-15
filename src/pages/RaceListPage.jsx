import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { api } from '../api.js';
import CalendarPicker, { isoToSlash } from '../CalendarPicker.jsx';
import {
  DISTANCE_OPTIONS,
  dateToIso,
  formatDate,
  participantCountClass,
  totalParticipantCount,
  isStrictGoalTime,
  maskDate,
  maskFromDigits,
  popTimeDigit,
  pushTimeDigit,
  toTimeMask,
} from '../format.js';
import { isAdminUser } from '../auth.js';
import Shell from '../Shell.jsx';

const emptyForm = {
  date: '',
  name: '',
  types: [],
  customLabel: '',
  official: false,
};

const LIST_RESTORE_KEY = 'marathon-list-restore';

function saveListRestore({ yearFilter, monthFilter, view, raceId }) {
  sessionStorage.setItem(
    LIST_RESTORE_KEY,
    JSON.stringify({
      yearFilter,
      monthFilter,
      view,
      raceId,
      scrollY: window.scrollY,
    }),
  );
}

export default function RaceListPage({ user, onLogout, initialRaces, onRacesLoaded }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [races, setRaces] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!initialRaces);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [view, setView] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [savingRace, setSavingRace] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [timeErrors, setTimeErrors] = useState({});
  const [saved, setSaved] = useState({});
  const [yearFilter, setYearFilter] = useState(null);
  const [monthFilter, setMonthFilter] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingScroll, setPendingScroll] = useState(null);
  const focused = useRef(null);
  const restoreApplied = useRef(false);
  const canManage = isAdminUser(user);
  const today = new Date();
  const todayKey = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

  async function loadRaces() {
    const data = await api('/api/races');
    setRaces(data.races);
    onRacesLoaded?.(data.races);
    return data.races;
  }

  useEffect(() => {
    if (initialRaces) {
      setRaces(initialRaces);
      setLoading(false);
      return;
    }
    loadRaces()
      .catch((err) => {
        if (err.status === 401) navigate('/login', { replace: true });
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [navigate, initialRaces]);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const race of races) {
        for (const entry of race.entries) {
          if (entry.userId !== user.id) continue;
          const key = `${race.id}:${entry.distanceId}`;
          if (focused.current !== key) next[key] = toTimeMask(entry.goalTime);
        }
      }
      return next;
    });
  }, [races, user.id]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (loading || restoreApplied.current) return;
    const shouldRestore = navigationType === 'POP' || location.state?.restoreList;
    if (!shouldRestore) return;
    const raw = sessionStorage.getItem(LIST_RESTORE_KEY);
    if (!raw) return;
    restoreApplied.current = true;
    sessionStorage.removeItem(LIST_RESTORE_KEY);
    try {
      const data = JSON.parse(raw);
      if (data.yearFilter !== undefined) setYearFilter(data.yearFilter);
      if (data.monthFilter !== undefined) setMonthFilter(data.monthFilter);
      if (data.view) setView(data.view);
      setPendingScroll({
        raceId: data.raceId || null,
        scrollY: typeof data.scrollY === 'number' ? data.scrollY : 0,
      });
    } catch {
      // ignore corrupt restore payload
    }
  }, [loading, navigationType, location.state]);

  function isPastRace(iso) {
    const [year, month, day] = iso.split('-').map(Number);
    return year * 10000 + month * 100 + day < todayKey;
  }

  function isPastMonth(year, month) {
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    if (year < currentYear) return true;
    if (year > currentYear) return false;
    return month < currentMonth;
  }

  function chooseYear(year) {
    setYearFilter(year);
    setMonthFilter(null);
  }

  async function cancelParticipation(race) {
    const current = myRaceEntry(race);
    if (!current) return;
    if (!window.confirm(`${race.name} 참가를 취소할까요?`)) return;
    setError('');
    try {
      const data = await api(`/api/races/${race.id}/entries`, {
        method: 'PUT',
        body: JSON.stringify({
          distanceId: current.distanceId,
          active: false,
          goalTime: '',
        }),
      });
      setRaces((list) => list.map((item) => (item.id === data.race.id ? data.race : item)));
      const prefix = `${race.id}:`;
      setDrafts((draft) => {
        const next = { ...draft };
        for (const key of Object.keys(next)) {
          if (key.startsWith(prefix)) delete next[key];
        }
        return next;
      });
      setSaved((state) => {
        const next = { ...state };
        for (const key of Object.keys(next)) {
          if (key.startsWith(prefix)) delete next[key];
        }
        return next;
      });
      setTimeErrors((state) => {
        const next = { ...state };
        for (const key of Object.keys(next)) {
          if (key.startsWith(prefix)) delete next[key];
        }
        return next;
      });
    } catch (err) {
      if (err.status === 401) navigate('/login', { replace: true });
      else setError(err.message);
    }
  }

  async function deleteRace(race) {
    if (!window.confirm(`${race.name} 대회를 삭제할까요?`)) return;
    setError('');
    try {
      await api(`/api/races/${race.id}`, { method: 'DELETE' });
      setRaces((current) => current.filter((item) => item.id !== race.id));
    } catch (err) {
      if (err.status === 401) navigate('/login', { replace: true });
      else setError(err.message);
    }
  }

  function myRaceEntry(race) {
    return race.entries.find((entry) => entry.userId === user.id);
  }

  function myEntry(race, distanceId) {
    const active = myRaceEntry(race);
    if (!active || active.distanceId !== distanceId) return undefined;
    return active;
  }

  function storedGoal(entry) {
    const text = String(entry?.goalTime || '').trim();
    if (!text) return '';
    const masked = toTimeMask(text);
    return isStrictGoalTime(masked) ? masked : '';
  }

  function changeDraft(key, next) {
    setDrafts((current) => ({ ...current, [key]: next }));
    setSaved((current) => ({ ...current, [key]: false }));
    setTimeErrors((current) => {
      const copy = { ...current };
      delete copy[key];
      return copy;
    });
  }

  async function toggleDistance(race, distance) {
    const current = myRaceEntry(race);
    const isActive = current?.distanceId === distance.id;
    if (current && !isActive) return;
    const key = `${race.id}:${distance.id}`;
    setError('');
    try {
      const data = await api(`/api/races/${race.id}/entries`, {
        method: 'PUT',
        body: JSON.stringify({
          distanceId: distance.id,
          active: !isActive,
          goalTime: '',
        }),
      });
      setRaces((current) => current.map((item) => (item.id === data.race.id ? data.race : item)));
      if (isActive) {
        setDrafts((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        setSaved((current) => ({ ...current, [key]: false }));
      } else {
        const prefix = `${race.id}:`;
        setDrafts((current) => {
          const next = { ...current };
          for (const d of race.distances) {
            if (d.id !== distance.id) delete next[`${prefix}${d.id}`];
          }
          next[key] = '00:00:00';
          return next;
        });
        setSaved((current) => {
          const next = { ...current };
          for (const d of race.distances) {
            if (d.id !== distance.id) delete next[`${prefix}${d.id}`];
          }
          return next;
        });
        setTimeErrors((current) => {
          const next = { ...current };
          for (const d of race.distances) {
            if (d.id !== distance.id) delete next[`${prefix}${d.id}`];
          }
          return next;
        });
      }
    } catch (err) {
      if (err.status === 401) navigate('/login', { replace: true });
      else setError(err.message);
    }
  }

  async function submitTime(race, distanceId, rawValue) {
    const key = `${race.id}:${distanceId}`;
    const goalTime = toTimeMask(rawValue ?? drafts[key] ?? '00:00:00');
    if (!isStrictGoalTime(goalTime)) {
      setTimeErrors((current) => ({
        ...current,
        [key]: '분과 초는 59까지 입력할 수 있습니다.',
      }));
      setSaved((current) => ({ ...current, [key]: false }));
      return;
    }
    try {
      const data = await api(`/api/races/${race.id}/entries`, {
        method: 'PUT',
        body: JSON.stringify({ distanceId, active: true, goalTime }),
      });
      setRaces((current) => current.map((item) => (item.id === data.race.id ? data.race : item)));
      setDrafts((current) => ({ ...current, [key]: goalTime }));
      setSaved((current) => ({ ...current, [key]: true }));
      setTimeErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    } catch (err) {
      if (err.status === 401) navigate('/login', { replace: true });
      else setTimeErrors((current) => ({ ...current, [key]: err.message }));
    }
  }

  function toggleType(type) {
    setForm((current) => {
      const exists = current.types.includes(type);
      return {
        ...current,
        types: exists ? current.types.filter((item) => item !== type) : [...current.types, type],
      };
    });
  }

  function openAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setFormError('');
    setCalendarOpen(false);
    setOpen(true);
  }

  function openEdit(race) {
    const custom = race.distances.find((distance) => distance.type === 'custom');
    setForm({
      date: isoToSlash(race.date),
      name: race.name,
      types: [...new Set(race.distances.map((distance) => distance.type))],
      customLabel: custom?.label || '',
      official: Boolean(race.official),
    });
    setEditingId(race.id);
    setFormError('');
    setCalendarOpen(false);
    setOpen(true);
  }

  async function saveRace(event) {
    event.preventDefault();
    setFormError('');
    const iso = dateToIso(form.date);
    if (!iso) {
      setFormError('날짜는 yyyy/mm/dd 형식으로 입력해 주세요.');
      return;
    }
    const distances = form.types.map((type) => {
      if (type === 'custom') return { type, label: form.customLabel.trim() };
      return { type, label: DISTANCE_OPTIONS.find((item) => item.type === type).label };
    });
    setSavingRace(true);
    try {
      const data = await api(editingId ? `/api/races/${editingId}` : '/api/races', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({
          date: iso,
          name: form.name.trim(),
          official: Boolean(form.official),
          distances,
        }),
      });
      if (data.race) {
        setRaces((current) => {
          const exists = current.some((item) => item.id === data.race.id);
          if (exists) {
            return current.map((item) => (item.id === data.race.id ? data.race : item));
          }
          return [...current, data.race].sort(
            (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'ko'),
          );
        });
      }
      await loadRaces();
      setForm(emptyForm);
      setEditingId(null);
      setCalendarOpen(false);
      setOpen(false);
    } catch (err) {
      if (err.status === 401) navigate('/login', { replace: true });
      else setFormError(err.message);
    } finally {
      setSavingRace(false);
    }
  }

  const myRaceCount = races.filter((race) =>
    race.entries.some((entry) => entry.userId === user.id),
  ).length;

  const myDistanceCounts = { full: 0, half: 0, '10k': 0 };
  for (const race of races) {
    const entry = race.entries.find((item) => item.userId === user.id);
    if (!entry) continue;
    const distance = race.distances.find((item) => item.id === entry.distanceId);
    if (distance && distance.type in myDistanceCounts) {
      myDistanceCounts[distance.type] += 1;
    }
  }

  const visibleRaces = (view === 'mine'
    ? races.filter((race) => race.entries.some((entry) => entry.userId === user.id))
    : races
  ).filter((race) => {
    if (!yearFilter) return true;
    const [year, month] = race.date.split('-').map(Number);
    if (year !== yearFilter) return false;
    if (monthFilter && month !== monthFilter) return false;
    return true;
  });

  useEffect(() => {
    if (!pendingScroll || loading) return;
    const { raceId, scrollY } = pendingScroll;
    requestAnimationFrame(() => {
      const el = raceId ? document.getElementById(`race-${raceId}`) : null;
      if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
      else window.scrollTo(0, scrollY);
    });
    setPendingScroll(null);
  }, [pendingScroll, loading, yearFilter, monthFilter, view, visibleRaces.length]);

  function openRaceDetail(race) {
    saveListRestore({ yearFilter, monthFilter, view, raceId: race.id });
  }

  return (
    <Shell
      user={user}
      onLogout={onLogout}
      pageShellClass={view === 'mine' ? 'view-mine' : 'view-list'}
      action={
        <>
          {isAdminUser(user) ? (
            <Link className="ghost" to="/admin">회원 관리</Link>
          ) : null}
          <button
            className={view === 'mine' ? 'primary' : 'ghost'}
            type="button"
            onClick={() => setView((current) => (current === 'mine' ? 'all' : 'mine'))}
          >
            내 대회
          </button>
          <button className="primary" type="button" onClick={openAdd}>
            대회 추가
          </button>
        </>
      }
    >
      <h1>{view === 'mine' ? '내 대회' : '대회 목록'}</h1>
      {view === 'mine' ? (
        <p className="my-race-summary">
          총 {myRaceCount}개 : 풀 {myDistanceCounts.full}개 / 하프 {myDistanceCounts.half}개 / 10k {myDistanceCounts['10k']}개
        </p>
      ) : null}
      <p className="muted">
        {view === 'mine'
          ? '내가 참가할 대회와 목표 기록입니다.'
          : '해당 대회 종목을 클릭 후 목표 시간을 입력하세요'}
      </p>
      <p className="guide">해당 대회를 클릭하시면 참가자 목록을 확인 할 수 있습니다.</p>
      <div className="filters">
        <div className="filter-row">
          <button type="button" className={yearFilter ? 'filter-button' : 'filter-button selected'} onClick={() => chooseYear(null)}>전체</button>
          <button type="button" className={yearFilter === 2026 ? 'filter-button selected' : 'filter-button'} onClick={() => chooseYear(2026)}>26년</button>
          <button type="button" className={yearFilter === 2027 ? 'filter-button selected' : 'filter-button'} onClick={() => chooseYear(2027)}>27년</button>
        </div>
        {yearFilter ? (
          <div className="month-row">
            {Array.from({ length: 12 }, (_, index) => {
              const month = index + 1;
              const past = isPastMonth(yearFilter, month);
              const selected = monthFilter === month;
              return (
                <button
                  key={month}
                  type="button"
                  className={['month-button', past ? 'past' : '', selected ? 'selected' : ''].filter(Boolean).join(' ')}
                  onClick={() => setMonthFilter(month)}
                >
                  {month}월
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="status-line">대회를 불러오는 중</p> : null}
      {!loading && visibleRaces.length === 0 ? (
        <section className="card empty">
          {view === 'mine' ? '아직 참가한 대회가 없습니다.' : monthFilter ? '이 달에 등록된 대회가 없습니다.' : '아직 등록된 대회가 없습니다.'}
        </section>
      ) : null}
      <div className="race-list">
        {visibleRaces.map((race) => (
          <article
            className={isPastRace(race.date) ? 'card race-card past' : 'card race-card'}
            id={`race-${race.id}`}
            key={race.id}
          >
            <div className="card-top">
              <p className="race-date">
                {formatDate(race.date)}
                {race.startTime ? ` ${race.startTime}` : ''}
                {race.official ? <span className="official-badge">공식대회</span> : null}
              </p>
              {canManage ? (
                <div className="card-actions">
                  <button type="button" className="edit-button" onClick={() => openEdit(race)}>대회 수정</button>
                  <button type="button" className="delete-button" onClick={() => deleteRace(race)}>대회 삭제</button>
                </div>
              ) : null}
            </div>
            <div className="race-title-row">
              <Link
                className={race.official ? 'race-name official-race' : 'race-name'}
                to={`/races/${race.id}`}
                onClick={() => openRaceDetail(race)}
              >
                {race.name}
                <span className={participantCountClass(totalParticipantCount(race))}>
                  {totalParticipantCount(race)}명
                </span>
              </Link>
              {view === 'mine' ? (
                <button
                  type="button"
                  className="withdraw-button"
                  onClick={() => cancelParticipation(race)}
                >
                  참가취소
                </button>
              ) : null}
            </div>
            <div className="distances">
              {race.distances
                .filter((distance) => view !== 'mine' || myEntry(race, distance.id))
                .map((distance) => {
                  const selected = myRaceEntry(race);
                  const entry = myEntry(race, distance.id);
                  const readOnlyChip = view === 'mine';
                  const locked = !readOnlyChip && Boolean(selected && selected.distanceId !== distance.id);
                  const key = `${race.id}:${distance.id}`;
                  const persisted = storedGoal(entry);
                  const timeValue = drafts[key] ?? (persisted || '00:00:00');
                  const isSaved = saved[key] ?? Boolean(persisted);
                  return (
                    <div className="distance-item" key={distance.id}>
                      <button
                        type="button"
                        className={[
                          'chip',
                          entry ? 'active' : '',
                          locked ? 'locked' : '',
                          readOnlyChip ? 'read-only' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => {
                          if (readOnlyChip) return;
                          toggleDistance(race, distance);
                        }}
                        disabled={readOnlyChip || locked}
                        aria-pressed={Boolean(entry)}
                        aria-disabled={readOnlyChip || locked}
                      >
                        {distance.label}
                      </button>
                      {entry ? (
                        <div className="time-wrap">
                          <div className={isSaved ? 'time-field saved' : 'time-field'}>
                            <input
                              value={timeValue}
                              aria-label={`${distance.label} 도전 시간`}
                              inputMode="numeric"
                              onFocus={() => { focused.current = key; }}
                              onBlur={() => { focused.current = null; }}
                              onChange={() => {}}
                              onKeyDown={(event) => {
                                if (/^\d$/.test(event.key)) {
                                  event.preventDefault();
                                  changeDraft(key, pushTimeDigit(timeValue, event.key));
                                } else if (event.key === 'Backspace') {
                                  event.preventDefault();
                                  changeDraft(key, popTimeDigit(timeValue));
                                } else if (event.key === 'Enter') {
                                  event.preventDefault();
                                  submitTime(race, distance.id, event.currentTarget.value);
                                }
                              }}
                              onPaste={(event) => {
                                event.preventDefault();
                                const digits = event.clipboardData.getData('text').replace(/\D/g, '');
                                changeDraft(key, maskFromDigits(digits));
                              }}
                              onBeforeInput={(event) => {
                                if (!event.data || !/^\d+$/.test(event.data)) return;
                                event.preventDefault();
                                const next = [...event.data].reduce((value, digit) => pushTimeDigit(value, digit), timeValue);
                                changeDraft(key, next);
                              }}
                            />
                            <button
                              type="button"
                              className={isSaved ? 'time-confirm saved' : 'time-confirm'}
                              onClick={(event) => {
                                const input = event.currentTarget.parentElement?.querySelector('input');
                                submitTime(race, distance.id, input?.value);
                              }}
                            >
                              {isSaved ? '입력됨' : '입력'}
                            </button>
                          </div>
                          {isSaved ? <p className="saved-note">입력되었습니다</p> : null}
                          {timeErrors[key] ? <p className="time-error">{timeErrors[key]}</p> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </article>
        ))}
      </div>

      {open ? (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <div
            className="card modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-race-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="add-race-title">{editingId ? '대회 수정' : '대회 추가'}</h2>
            <form className="stack" onSubmit={saveRace}>
              <label>
                날짜
                <div className="date-row">
                  <input
                    className="soft-placeholder"
                    value={form.date}
                    onChange={(event) => setForm((current) => ({ ...current, date: maskDate(event.target.value) }))}
                    placeholder="yyyy/mm/dd"
                    inputMode="numeric"
                    required
                  />
                  <button
                    type="button"
                    className="ghost calendar-toggle"
                    aria-expanded={calendarOpen}
                    onClick={() => setCalendarOpen((current) => !current)}
                  >
                    달력
                  </button>
                </div>
                {calendarOpen ? (
                  <CalendarPicker
                    value={form.date}
                    onSelect={(date) => {
                      setForm((current) => ({ ...current, date }));
                      setCalendarOpen(false);
                    }}
                  />
                ) : null}
              </label>
              <div className="form-field">
                <span className="field-label">대회명</span>
                <div className="name-official-row">
                  <input
                    className="soft-placeholder race-name-input"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="서울마라톤"
                    maxLength={40}
                    required
                  />
                  <label className="official-check">
                    <input
                      type="checkbox"
                      checked={form.official}
                      onChange={(event) => setForm((current) => ({ ...current, official: event.target.checked }))}
                    />
                    공식대회
                  </label>
                </div>
              </div>
              <fieldset>
                <legend>거리 <span className="legend-note">(해당되는 대회의 종목을 모두 선택해주세요)</span></legend>
                <div className="distances">
                  {DISTANCE_OPTIONS.map((option) => {
                    const selected = form.types.includes(option.type);
                    return (
                      <button
                        key={option.type}
                        type="button"
                        className={selected ? 'chip active' : 'chip'}
                        aria-pressed={selected}
                        onClick={() => toggleType(option.type)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {form.types.includes('custom') ? (
                  <label className="custom-label">
                    기타 거리
                    <input
                      value={form.customLabel}
                      onChange={(event) => setForm((current) => ({ ...current, customLabel: event.target.value }))}
                      placeholder="30km"
                      maxLength={20}
                      required
                    />
                  </label>
                ) : null}
              </fieldset>
              {formError ? <p className="form-error">{formError}</p> : null}
              <div className="modal-actions">
                <button type="button" className="ghost" onClick={() => setOpen(false)}>취소</button>
                <button type="submit" className="primary" disabled={savingRace}>
                  {savingRace ? '저장하는 중' : editingId ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
