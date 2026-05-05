// Floating UI controls — search bar, control rail, layers picker, avatar menu, scrubber, overview card

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ── Brand mark ──
function BrandMark() {
  return (
    <div className="brand glass">
      <div className="brand-mark">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18 L12 4 L20 18" />
          <path d="M8 14 L16 14" />
        </svg>
      </div>
      <div className="brand-name">Arc<span>Hive</span></div>
    </div>
  );
}

// ── Search bar with results ──
function SearchBar({ pins, docs, onSelectPin, onSelectDoc, baseKm }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        ref.current?.querySelector("input")?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const matches = useMemo(() => {
    const norm = q.trim().toLowerCase();
    if (!norm) return { pins: pins.slice(0, 5), docs: docs.slice(0, 3) };
    const pinHits = pins.filter((p) => p.label.toLowerCase().includes(norm) || String(p.chainage_km).includes(norm)).slice(0, 6);
    const docHits = docs.filter((d) => d.filename.toLowerCase().includes(norm)).slice(0, 6);
    return { pins: pinHits, docs: docHits };
  }, [q, pins, docs]);

  const showResults = open && (matches.pins.length || matches.docs.length);

  return (
    <div className="searchbar glass" ref={ref}>
      <Icons.Search size={16} stroke="var(--ink-3)" />
      <input
        type="text"
        placeholder="Search pins, KP labels, documents…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      <span className="kbd">⌘K</span>
      {showResults ? (
        <div className="search-results glass-strong">
          {matches.pins.length ? (
            <>
              <div className="search-section-label">Chainage Pins</div>
              {matches.pins.map((p) => (
                <div key={`p-${p.id}`} className="search-result" onClick={() => { onSelectPin(p); setOpen(false); setQ(""); }}>
                  <div className="icon"><Icons.Pin size={18} /></div>
                  <div className="search-result-info">
                    <div className="search-result-title">{p.label}</div>
                    <div className="search-result-meta">{p.doc_count} document{p.doc_count !== 1 ? "s" : ""} · {p.status.replace("-", " ")}</div>
                  </div>
                </div>
              ))}
            </>
          ) : null}
          {matches.docs.length ? (
            <>
              <div className="search-section-label">Documents</div>
              {matches.docs.map((d) => {
                const pin = pins.find((p) => p.id === d.pin_id);
                return (
                  <div key={`d-${d.id}`} className="search-result doc" onClick={() => { onSelectDoc(d); setOpen(false); setQ(""); }}>
                    <div className="icon"><Icons.Doc size={18} /></div>
                    <div className="search-result-info">
                      <div className="search-result-title">{d.filename}</div>
                      <div className="search-result-meta">{pin?.label} · {d.uploaded_by}</div>
                    </div>
                  </div>
                );
              })}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Avatar menu ──
function AvatarMenu({ user, theme, setTheme, onSignOut, onSwitchUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="avatar-btn glass" style={{ position: "relative" }} ref={ref}>
      <button className="avatar" onClick={() => setOpen(!open)}>{user.initials}</button>
      {open ? (
        <div className="menu glass-strong">
          <div className="menu-header">
            <div className="avatar">{user.initials}</div>
            <div className="menu-header-info">
              <div className="menu-header-name">{user.name}</div>
              <div className="menu-header-email">{user.email}</div>
              <span className={`role-chip ${user.role}`}>{user.role}</span>
            </div>
          </div>
          <div className="theme-toggle">
            {[
              { id: "light", icon: <Icons.Sun size={13} />, label: "Light" },
              { id: "dark", icon: <Icons.Moon size={13} />, label: "Dark" },
              { id: "auto", icon: <Icons.Auto size={13} />, label: "Auto" },
            ].map((t) => (
              <button key={t.id} className={theme === t.id ? "active" : ""} onClick={() => setTheme(t.id)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <button className="menu-item"><Icons.User size={15} /> Profile & access</button>
          <button className="menu-item"><Icons.Bell size={15} /> Notifications</button>
          <button className="menu-item"><Icons.Settings size={15} /> Preferences</button>
          <div className="menu-divider" />
          <button className="menu-item danger" onClick={onSignOut}><Icons.Logout size={15} /> Sign out</button>
        </div>
      ) : null}
    </div>
  );
}

// ── Control rail (zoom, compass, layers, locate, ruler, legend) ──
function ControlRail({ map, mapStyle, setMapStyle, onLocate, bearing, onResetBearing, measureOn, setMeasureOn, legendOn, setLegendOn }) {
  const [layersOpen, setLayersOpen] = useState(false);
  const layersRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (layersRef.current && !layersRef.current.contains(e.target)) setLayersOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="control-rail">
      <div className="control-stack">
        <button className="control-btn" data-tip="Zoom in" onClick={() => map?.zoomIn({ duration: 250 })}>
          <Icons.Plus size={18} />
        </button>
        <button className="control-btn" data-tip="Zoom out" onClick={() => map?.zoomOut({ duration: 250 })}>
          <Icons.Minus size={18} />
        </button>
        <button className="control-btn" data-tip="Reset bearing" onClick={onResetBearing}>
          <div className="compass-needle" style={{ transform: `rotate(${-bearing}deg)` }} />
        </button>
      </div>
      <div className="control-stack" style={{ position: "relative" }} ref={layersRef}>
        <button className={`control-btn ${layersOpen ? "active" : ""}`} data-tip="Map style" onClick={() => setLayersOpen(!layersOpen)}>
          <Icons.Layers size={18} />
        </button>
        <button className="control-btn" data-tip="Locate / fit pipeline" onClick={onLocate}>
          <Icons.Locate size={18} />
        </button>
        {layersOpen ? (
          <div className="layers-popover glass-strong">
            <div className="layers-title">Map Style</div>
            <div className="layers-grid">
              {MockData.MAP_STYLES.map((s) => (
                <div
                  key={s.id}
                  className={`layer-tile ${mapStyle === s.id ? "active" : ""}`}
                  onClick={() => { setMapStyle(s.id); setLayersOpen(false); }}
                >
                  <div className="layer-tile-bg" style={{ background: s.preview }} />
                  <div className="layer-tile-label">{s.label}</div>
                  <div className="layer-tile-check"><Icons.Check size={12} sw={3} /></div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="control-stack">
        <button className={`control-btn ${measureOn ? "active" : ""}`} data-tip="Measure distance" onClick={() => setMeasureOn(!measureOn)}>
          <Icons.Ruler size={18} />
        </button>
        <button className={`control-btn ${legendOn ? "active" : ""}`} data-tip="Legend" onClick={() => setLegendOn(!legendOn)}>
          <Icons.Legend size={18} />
        </button>
      </div>
    </div>
  );
}

// ── Pipeline overview card ──
function OverviewCard({ pins, pipeline }) {
  const stats = useMemo(() => {
    const total = pins.length;
    const complete = pins.filter((p) => p.status === "complete").length;
    const inProgress = pins.filter((p) => p.status === "in-progress").length;
    const pending = pins.filter((p) => p.status === "pending").length;
    const blocked = pins.filter((p) => p.status === "blocked").length;
    const docs = pins.reduce((s, p) => s + p.doc_count, 0);
    return { total, complete, inProgress, pending, blocked, docs };
  }, [pins]);

  const pct = (n) => (stats.total ? (n / stats.total) * 100 : 0);

  return (
    <div className="overview-card glass-strong">
      <div className="overview-head">
        <div className="overview-icon"><Icons.Pipeline size={18} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="overview-title">{pipeline?.name || "Pipeline"}</div>
          <div className="overview-sub">{MockData.TOTAL_KM > 0 ? `${MockData.TOTAL_KM.toFixed(1)} km` : pipeline?.description || ""}</div>
        </div>
      </div>
      <div className="overview-stats">
        <div className="stat-block">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Pins</div>
        </div>
        <div className="stat-block">
          <div className="stat-value">{stats.docs}</div>
          <div className="stat-label">Docs</div>
        </div>
        <div className="stat-block">
          <div className="stat-value">{stats.total ? Math.round((stats.complete / stats.total) * 100) : 0}%</div>
          <div className="stat-label">Complete</div>
        </div>
      </div>
      <div className="health-bar">
        <div className="health-bar-segment" style={{ width: `${pct(stats.complete)}%`, background: "var(--good)" }} />
        <div className="health-bar-segment" style={{ width: `${pct(stats.inProgress)}%`, background: "var(--warn)" }} />
        <div className="health-bar-segment" style={{ width: `${pct(stats.pending)}%`, background: "var(--ink-4)" }} />
        <div className="health-bar-segment" style={{ width: `${pct(stats.blocked)}%`, background: "var(--danger)" }} />
      </div>
      <div className="overview-foot">
        <span><span className="dot" style={{ background: "var(--good)" }} />{stats.complete}</span>
        <span><span className="dot" style={{ background: "var(--warn)" }} />{stats.inProgress}</span>
        <span><span className="dot" style={{ background: "var(--ink-4)" }} />{stats.pending}</span>
        <span><span className="dot" style={{ background: "var(--danger)" }} />{stats.blocked}</span>
      </div>
    </div>
  );
}

// ── KP scrubber ──
function Scrubber({ pins, activePin, onPick, sideCardOpen, minKm = 42, maxKm = 52 }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [hoverKm, setHoverKm] = useState(null);

  const currentKm = activePin ? activePin.chainage_km : (hoverKm ?? minKm);
  const pct = ((currentKm - minKm) / (maxKm - minKm)) * 100;

  const kmFromEvent = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return minKm + t * (maxKm - minKm);
  };

  const onMove = (e) => {
    if (!dragging) return;
    const km = kmFromEvent(e.clientX);
    setHoverKm(km);
    // Snap to nearest pin within 0.4 km
    const nearest = pins.reduce((best, p) => Math.abs(p.chainage_km - km) < Math.abs(best.chainage_km - km) ? p : best, pins[0]);
    if (Math.abs(nearest.chainage_km - km) < 0.4) onPick(nearest);
  };
  const onUp = () => setDragging(false);
  useEffect(() => {
    if (!dragging) return;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  const statusColor = (s) => ({
    complete: "var(--good)",
    "in-progress": "var(--warn)",
    pending: "var(--ink-4)",
    blocked: "var(--danger)",
  })[s] || "var(--ink-4)";

  return (
    <div className={`scrubber glass-strong ${sideCardOpen ? "with-side-card" : ""}`}>
      <div className="scrubber-head">
        <div className="scrubber-title">Chainage</div>
        <div className="scrubber-current mono">
          {activePin ? activePin.label : `KP ${currentKm.toFixed(1).replace(".", "+")}00`}
        </div>
      </div>
      <div className="scrubber-track" ref={trackRef} onMouseDown={(e) => { setDragging(true); onMove(e); }}>
        <div className="scrubber-rail" />
        <div className="scrubber-fill" style={{ width: `${pct}%` }} />
        {pins.map((p) => {
          const t = ((p.chainage_km - minKm) / (maxKm - minKm)) * 100;
          return (
            <div
              key={p.id}
              className={`scrubber-tick ${activePin?.id === p.id ? "active" : ""}`}
              style={{ left: `${t}%`, background: activePin?.id === p.id ? "var(--accent)" : statusColor(p.status) }}
              onClick={(e) => { e.stopPropagation(); onPick(p); }}
              title={p.label}
            />
          );
        })}
        <div className="scrubber-thumb" style={{ left: `${pct}%` }} />
      </div>
      <div className="scrubber-axis mono">
        {[minKm, (minKm + maxKm) / 2, maxKm].map((km) => {
          const int = Math.floor(km);
          const dec = String(Math.round((km - int) * 1000)).padStart(3, "0");
          return <span key={km}>{`KP ${int}+${dec}`}</span>;
        })}
      </div>
    </div>
  );
}

// ── Action banner (move/add pin instructions) ──
function Banner({ text, onCancel }) {
  return (
    <div className="banner glass-strong">
      <div className="banner-dot" />
      <span>{text}</span>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

// ── Toasts ──
function Toasts({ toasts }) {
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind || ""}`}>
          <div className="toast-icon">
            {t.kind === "error" ? <Icons.Close size={14} sw={3} /> : <Icons.Check size={14} sw={3} />}
          </div>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// ── Legend popover ──
function Legend({ onClose }) {
  return (
    <div className="glass-strong" style={{ position: "absolute", right: 80, top: 230, padding: 14, borderRadius: 18, width: 220, zIndex: 25 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)" }}>Legend</div>
        <button onClick={onClose} style={{ color: "var(--ink-3)" }}><Icons.Close size={14} /></button>
      </div>
      {[
        { c: "var(--good)", l: "Complete" },
        { c: "var(--warn)", l: "In progress" },
        { c: "var(--ink-4)", l: "Pending" },
        { c: "var(--danger)", l: "Blocked / NCR" },
      ].map((r) => (
        <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 12.5 }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: r.c, border: "2px solid white", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
          {r.l}
        </div>
      ))}
      <div style={{ height: 0.5, background: "var(--hairline)", margin: "8px 0" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", fontSize: 12, color: "var(--ink-2)" }}>
        <span style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)", boxShadow: "0 0 6px var(--accent-glow)" }} />
        Pipeline route
      </div>
    </div>
  );
}

Object.assign(window, { BrandMark, SearchBar, AvatarMenu, ControlRail, OverviewCard, Scrubber, Banner, Toasts, Legend });
