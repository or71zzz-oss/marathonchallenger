export default function Shell({ user, onLogout, action, children }) {
  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="brand">마라톤챌린저</p>
          <p className="who">{user.name}</p>
        </div>
        <div className="top-actions">
          {action}
          <button className="ghost" type="button" onClick={onLogout}>로그아웃</button>
        </div>
      </header>
      {children}
    </main>
  );
}
