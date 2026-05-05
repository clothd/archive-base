// Login screen — uses real API auth

function LoginMap() {
  React.useEffect(() => {
    const style = MockData.MAP_STYLES.find((s) => s.id === "satellite");
    const map = new maplibregl.Map({
      container: "login-map",
      style: style.url,
      center: [-114.17, 51.41],
      zoom: 9,
      pitch: 40,
      bearing: 0,
      interactive: false,
      attributionControl: false,
    });
    let frame;
    const rotate = () => { map.setBearing(map.getBearing() + 0.02); frame = requestAnimationFrame(rotate); };
    map.on("load", () => { frame = requestAnimationFrame(rotate); });
    return () => { cancelAnimationFrame(frame); map.remove(); };
  }, []);
  return null;
}

function LoginPage({ onLogin }) {
  const [email, setEmail] = React.useState("admin@enbridge.com");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!password) return setErr("Password is required.");
    setErr("");
    setLoading(true);
    try {
      const data = await API.login(email, password);
      onLogin(data);
    } catch (e) {
      setErr(e.status === 401 ? "Invalid email or password." : `Error: ${e.message}`);
      setLoading(false);
    }
  };

  const quickLogin = (u) => {
    setEmail(u.email);
    setPassword(u.password);
    setErr("");
    setLoading(true);
    API.login(u.email, u.password)
      .then((data) => onLogin(data))
      .catch((e) => { setErr(e.message); setLoading(false); });
  };

  const DEMO = [
    { email: "admin@enbridge.com", password: "admin123", role: "admin", name: "Avery Reid" },
    { email: "editor@enbridge.com", password: "editor123", role: "editor", name: "Morgan Chen" },
    { email: "viewer@enbridge.com", password: "viewer123", role: "viewer", name: "Sam Patel" },
  ];

  return (
    <div className="login-page">
      <div id="login-map" />
      <LoginMap />
      <div className="login-card glass-strong">
        <div className="login-brand">
          <div className="brand-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18 L12 4 L20 18" />
              <path d="M8 14 L16 14" />
            </svg>
          </div>
          <div className="login-brand-name">Arc<span>Hive</span></div>
        </div>
        <div className="login-sub">Spatial document management for pipeline construction. Sign in to continue.</div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@enbridge.com" autoComplete="email" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
          </div>
          {err ? <div style={{ color: "var(--accent)", fontSize: 12, marginTop: 4, marginBottom: 8 }}>{err}</div> : null}
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", marginTop: 6 }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="login-quickrow">
          <div className="login-quickrow-label">Demo · pick a role</div>
          <div className="quick-grid">
            {DEMO.map((u) => (
              <button key={u.email} className="quick-card" onClick={() => quickLogin(u)} type="button">
                <div className="quick-role">{u.role}</div>
                <div className="quick-name">{u.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.LoginPage = LoginPage;
