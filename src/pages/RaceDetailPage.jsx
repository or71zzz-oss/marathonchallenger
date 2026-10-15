import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatDateLong, participantCountClass, totalParticipantCount, toTimeMask } from '../format.js';
import Shell from '../Shell.jsx';

export default function RaceDetailPage({ user, onLogout }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const seededRace = location.state?.race?.id === id ? location.state.race : null;
  const [race, setRace] = useState(seededRace);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (seededRace) {
      setRace(seededRace);
      return;
    }
    setRace(null);
    api(`/api/races/${id}`)
      .then((data) => setRace(data.race))
      .catch((err) => {
        if (err.status === 401) navigate('/login', { replace: true });
        else if (err.status === 404) setError('대회를 찾을 수 없습니다.');
        else setError(err.message);
      });
  }, [id, navigate, seededRace]);

  return (
    <Shell user={user} onLogout={onLogout}>
      <Link className="back-link" to="/" state={{ restoreList: true }}>목록으로</Link>
      {error ? <p className="form-error">{error}</p> : null}
      {!race && !error ? <p className="status-line">대회를 불러오는 중</p> : null}
      {race ? (
        <>
          <p className="race-date">
            {formatDateLong(race.date)}
            {race.startTime ? ` ${race.startTime}` : ''}
          </p>
          <h1 className={race.official ? 'official-race-title' : undefined}>
            {race.name}
            <span className={participantCountClass(totalParticipantCount(race))}>
              {totalParticipantCount(race)}명
            </span>
            {race.official ? <span className="official-badge">공식대회</span> : null}
          </h1>
          {race.place ? <p className="race-meta">{race.place}</p> : null}
          {race.homepage ? (
            <p className="race-meta">
              <a href={race.homepage} target="_blank" rel="noreferrer">{race.homepage}</a>
            </p>
          ) : null}
          <div className="detail-list">
            {race.distances.map((distance) => {
              const entries = race.entries.filter((entry) => entry.distanceId === distance.id);
              return (
                <section className="card" key={distance.id}>
                  <h2>{distance.label}</h2>
                  {entries.length === 0 ? (
                    <p className="muted">아직 참가한 팀원이 없습니다.</p>
                  ) : (
                    <ol className="entry-list">
                      {entries.map((entry) => (
                        <li key={`${entry.userId}:${entry.distanceId}`}>
                          <span className="entry-name">{entry.userName}</span>
                          <span className="entry-time">{entry.goalTime ? toTimeMask(entry.goalTime) : '시간 미입력'}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              );
            })}
          </div>
        </>
      ) : null}
    </Shell>
  );
}
