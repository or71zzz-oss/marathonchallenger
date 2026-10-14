export default function Shell({ user, onLogout, action, pageShellClass, children }) {
  const shellClass = pageShellClass ? `page-shell ${pageShellClass}` : 'page-shell';
  return (
    <div className={shellClass}>
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
    </div>
  );
}
