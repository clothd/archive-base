// Top-level App — wires the UI to the real ArcHive backend API

const { useState: useStateApp, useEffect: useEffectApp, useMemo: useMemoApp, useCallback: useCallbackApp } = React;

function toUiUser(u) {
  const parts = (u.name || u.email.split("@")[0]).split(" ");
  const initials = parts.map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return { ...u, name: u.name || u.email.split("@")[0], initials };
}

function pinFromFeature(f) {
  const [lng, lat] = f.geometry.coordinates;
  return {
    id: f.properties.id,
    label: f.properties.label,
    chainage_km: f.properties.chainage_km,
    status: f.properties.status || "pending",
    doc_count: f.properties.doc_count || 0,
    lat,
    lng,
    route_km: MockData.snapToRoute(lng, lat).km,
  };
}

function App() {
  const [user, setUser] = useStateApp(null);
  const [pipeline, setPipeline] = useStateApp(null);
  const [pins, setPins] = useStateApp([]);
  const [routeCoords, setRouteCoords] = useStateApp(null);
  const [docsCache, setDocsCache] = useStateApp({});
  const [activity, setActivity] = useStateApp([]);
  const [loading, setLoading] = useStateApp(true);
  const [loadError, setLoadError] = useStateApp(null);

  // Theme
  const [theme, setTheme] = useStateApp(() => localStorage.getItem("archive_theme") || "dark");
  useEffectApp(() => {
    const sysDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const effective = theme === "auto" ? (sysDark ? "dark" : "light") : theme;
    document.documentElement.setAttribute("data-theme", effective);
    localStorage.setItem("archive_theme", theme);
  }, [theme]);

  // Map style
  const [mapStyle, setMapStyle] = useStateApp(() => localStorage.getItem("archive_mapstyle") || "satellite");
  useEffectApp(() => { localStorage.setItem("archive_mapstyle", mapStyle); }, [mapStyle]);

  // Map state
  const [map, setMap] = useStateApp(null);
  const [bearing, setBearing] = useStateApp(0);

  // Selection
  const [activePinId, setActivePinId] = useStateApp(null);
  const activePin = useMemoApp(() => pins.find((p) => p.id === activePinId) || null, [activePinId, pins]);

  // Modes
  const [mode, setMode] = useStateApp({ kind: "idle" });
  const [pendingCoords, setPendingCoords] = useStateApp(null);
  const [measurePoints, setMeasurePoints] = useStateApp([]);
  const [legendOn, setLegendOn] = useStateApp(false);
  const [toasts, setToasts] = useStateApp([]);

  const canEdit = user?.role === "admin" || user?.role === "editor";

  const docs = useMemoApp(
    () => (activePin ? (docsCache[activePin.id] || []) : []),
    [activePin, docsCache]
  );

  // Toasts
  const pushToast = (text, kind) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  };

  // Load pipeline + route + pins from API
  const loadAppData = useCallbackApp(async () => {
    try {
      const config = await API.getConfig().catch(() => ({}));
      if (config.maptiler_key) MockData.setMapKey(config.maptiler_key);

      const pipelines = await API.getPipelines();
      if (!pipelines.length) throw new Error("No pipelines found in database. Run the seed script.");
      const pl = pipelines[0];
      setPipeline(pl);

      const geojson = await API.getPipelineGeojson(pl.id);
      MockData.setupRoute(geojson.geometry.coordinates);
      setRouteCoords(geojson.geometry.coordinates);

      const fc = await API.getPipelinePins(pl.id);
      setPins(fc.features.map(pinFromFeature));
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: restore session or show login
  useEffectApp(() => {
    const token = API.getToken();
    if (!token) { setLoading(false); return; }
    API.me()
      .then((u) => { setUser(toUiUser(u)); return loadAppData(); })
      .catch(() => { API.setToken(null); setLoading(false); });
  }, []);

  const handleLogin = useCallbackApp(async (data) => {
    setUser(toUiUser(data.user));
    setLoading(true);
    setLoadError(null);
    await loadAppData();
  }, [loadAppData]);

  const handleLogout = useCallbackApp(() => {
    API.setToken(null);
    setUser(null);
    setPipeline(null);
    setPins([]);
    setDocsCache({});
    setActivity([]);
    setActivePinId(null);
  }, []);

  // Pin selection — lazy-load docs on first click
  const onPickPin = useCallbackApp(async (pin) => {
    setActivePinId(pin.id);
    if (map) map.flyTo({ center: [pin.lng, pin.lat], zoom: Math.max(11, map.getZoom()), duration: 700, padding: { left: 420 } });
    if (!docsCache[pin.id]) {
      try {
        const d = await API.getPinDocuments(pin.id);
        setDocsCache((c) => ({ ...c, [pin.id]: d }));
      } catch (e) { /* ignore — panel shows empty */ }
    }
  }, [map, docsCache]);

  const onUpload = useCallbackApp(async (pinId, file) => {
    try {
      const doc = await API.uploadDocument(pinId, file);
      setDocsCache((c) => ({ ...c, [pinId]: [...(c[pinId] || []), doc] }));
      setPins((ps) => ps.map((p) => p.id === pinId ? { ...p, doc_count: p.doc_count + 1 } : p));
      setActivity((a) => [{ id: Date.now(), text: `<strong>${user.name}</strong> uploaded <strong>${file.name}</strong>`, time: "Just now", muted: false }, ...a]);
      pushToast(`Uploaded ${file.name}`);
    } catch (e) {
      pushToast(`Upload failed: ${e.message}`, "error");
    }
  }, [user, docsCache]);

  const onDownload = useCallbackApp(async (doc) => {
    try {
      const { presigned_url } = await API.downloadDocument(doc.id);
      window.open(presigned_url, "_blank");
    } catch (e) {
      pushToast("Download failed", "error");
    }
  }, []);

  const onDelete = useCallbackApp(async () => {
    if (!activePin) return;
    if (!confirm(`Delete pin "${activePin.label}"? This will also remove all attached documents.`)) return;
    try {
      await API.deletePin(activePin.id);
      setPins((ps) => ps.filter((p) => p.id !== activePin.id));
      setDocsCache((c) => { const n = { ...c }; delete n[activePin.id]; return n; });
      setActivity((a) => [{ id: Date.now(), text: `<strong>${user.name}</strong> deleted <strong>${activePin.label}</strong>`, time: "Just now", muted: false }, ...a]);
      setActivePinId(null);
      pushToast(`Deleted ${activePin.label}`, "error");
    } catch (e) {
      pushToast(`Delete failed: ${e.message}`, "error");
    }
  }, [activePin, user]);

  const onMove = useCallbackApp(() => {
    if (!activePin) return;
    setMode((m) => m.kind === "move" ? { kind: "idle" } : { kind: "move" });
  }, [activePin]);

  const onMapClick = useCallbackApp(async (latlng) => {
    if (mode.kind === "move" && activePin) {
      try {
        const feat = await API.movePin(activePin.id, { lat: latlng.lat, lng: latlng.lng });
        const [lng, lat] = feat.geometry.coordinates;
        const p = feat.properties;
        setPins((ps) => ps.map((pin) => pin.id === p.id
          ? { ...pin, lat, lng, label: p.label, chainage_km: p.chainage_km, status: p.status, route_km: MockData.snapToRoute(lng, lat).km }
          : pin));
        setActivity((a) => [{ id: Date.now(), text: `<strong>${user.name}</strong> moved <strong>${activePin.label}</strong>`, time: "Just now", muted: false }, ...a]);
        setMode({ kind: "idle" });
        pushToast(`${activePin.label} snapped to route`);
      } catch (e) {
        pushToast(`Move failed: ${e.message}`, "error");
      }
    } else if (mode.kind === "add") {
      const snap = MockData.snapToRoute(latlng.lng, latlng.lat);
      setPendingCoords({ lat: snap.lat, lng: snap.lng, km: snap.km });
      setMode({ kind: "addModal" });
    } else if (mode.kind === "measure") {
      setMeasurePoints((pts) => [...pts, latlng]);
    }
  }, [mode, activePin, user]);

  const onAddPinConfirm = useCallbackApp(async (label, chainage_km) => {
    if (!pendingCoords || !pipeline) return;
    try {
      const feat = await API.createPin(pipeline.id, {
        label, chainage_km, lat: pendingCoords.lat, lng: pendingCoords.lng,
      });
      const newPin = pinFromFeature(feat);
      setPins((ps) => [...ps, newPin].sort((a, b) => a.chainage_km - b.chainage_km));
      setActivity((a) => [{ id: Date.now(), text: `<strong>${user.name}</strong> added <strong>${label}</strong>`, time: "Just now", muted: false }, ...a]);
      setMode({ kind: "idle" });
      setPendingCoords(null);
      pushToast(`Added ${label}`);
    } catch (e) {
      pushToast(`Create failed: ${e.message}`, "error");
    }
  }, [pendingCoords, pipeline, user]);

  const cursor = useMemoApp(() => {
    if (mode.kind === "move" || mode.kind === "add" || mode.kind === "measure") return "crosshair";
    return "";
  }, [mode]);

  const measureKm = useMemoApp(() => {
    if (measurePoints.length < 2) return 0;
    let d = 0;
    for (let i = 1; i < measurePoints.length; i++) {
      d += MockData.haversineKm([measurePoints[i - 1].lng, measurePoints[i - 1].lat], [measurePoints[i].lng, measurePoints[i].lat]);
    }
    return d;
  }, [measurePoints]);

  const scrubMinKm = useMemoApp(() => pins.length ? Math.min(...pins.map((p) => p.chainage_km)) : 42, [pins]);
  const scrubMaxKm = useMemoApp(() => pins.length ? Math.max(...pins.map((p) => p.chainage_km)) : 52, [pins]);

  if (!user) return <LoginPage onLogin={handleLogin} />;

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "var(--paper-2)" }}>
        <div style={{ textAlign: "center", color: "var(--ink-3)" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, opacity: 0.5 }}>
            <path d="M4 18 L12 4 L20 18" /><path d="M8 14 L16 14" />
          </svg>
          <div style={{ fontSize: 13 }}>Loading pipeline data…</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "var(--paper-2)" }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
          <div style={{ fontSize: 14, color: "var(--accent)", marginBottom: 8 }}>Failed to load pipeline data</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 16 }}>{loadError}</div>
          <button className="btn-primary" onClick={() => { setLoading(true); setLoadError(null); loadAppData(); }} style={{ width: "auto", padding: "10px 20px" }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app" data-map-style={mapStyle}>
      <PipelineMap
        theme={theme}
        mapStyle={mapStyle}
        pins={pins}
        routeCoords={routeCoords}
        activePin={activePin}
        onPickPin={onPickPin}
        onMapClick={onMapClick}
        cursor={cursor}
        bearing={bearing}
        setBearing={setBearing}
        measurePoints={measurePoints}
        registerMap={setMap}
      />

      <div className="topbar">
        <BrandMark />
        <SearchBar
          pins={pins}
          docs={docs}
          baseKm={scrubMinKm}
          onSelectPin={(p) => onPickPin(p)}
          onSelectDoc={(d) => { const p = pins.find((x) => x.id === d.pin_id); if (p) onPickPin(p); }}
        />
        {canEdit ? (
          <button
            className={`add-pin-pill glass ${mode.kind === "add" ? "active" : ""}`}
            onClick={() => setMode((m) => m.kind === "add" ? { kind: "idle" } : { kind: "add" })}
          >
            <Icons.Plus size={16} sw={2.4} />
            {mode.kind === "add" ? "Cancel" : "Add Pin"}
          </button>
        ) : null}
        <AvatarMenu
          user={user}
          theme={theme}
          setTheme={setTheme}
          onSignOut={handleLogout}
        />
      </div>

      <ControlRail
        map={map}
        mapStyle={mapStyle}
        setMapStyle={setMapStyle}
        bearing={bearing}
        onResetBearing={() => map?.easeTo({ bearing: 0, pitch: 30, duration: 500 })}
        onLocate={() => PipelineMap.fitToPipeline?.()}
        measureOn={mode.kind === "measure"}
        setMeasureOn={(on) => { setMode(on ? { kind: "measure" } : { kind: "idle" }); if (!on) setMeasurePoints([]); }}
        legendOn={legendOn}
        setLegendOn={setLegendOn}
      />

      {legendOn ? <Legend onClose={() => setLegendOn(false)} /> : null}

      {mode.kind === "add" ? (
        <Banner text="Click anywhere on the map to drop a new chainage pin." onCancel={() => setMode({ kind: "idle" })} />
      ) : mode.kind === "move" ? (
        <Banner text={`Click on the map to move ${activePin?.label}.`} onCancel={() => setMode({ kind: "idle" })} />
      ) : mode.kind === "measure" ? (
        <Banner text={`Measure: ${measurePoints.length} point${measurePoints.length === 1 ? "" : "s"}${measureKm ? ` · ${measureKm.toFixed(2)} km` : ""}. Click to add, button to clear.`} onCancel={() => { setMode({ kind: "idle" }); setMeasurePoints([]); }} />
      ) : null}

      <SideCard
        open={!!activePin}
        pin={activePin}
        docs={docs}
        activity={activity}
        canEdit={canEdit}
        onUpload={onUpload}
        onMove={onMove}
        onDelete={onDelete}
        moveActive={mode.kind === "move"}
        onClose={() => setActivePinId(null)}
        onDownload={onDownload}
      />

      <BottomSheet
        open={!!activePin}
        pin={activePin}
        docs={docs}
        activity={activity}
        canEdit={canEdit}
        onUpload={onUpload}
        onMove={onMove}
        onDelete={onDelete}
        moveActive={mode.kind === "move"}
        onClose={() => setActivePinId(null)}
        onDownload={onDownload}
      />

      <div className="right-col">
        <Scrubber pins={pins} activePin={activePin} onPick={onPickPin} minKm={scrubMinKm} maxKm={scrubMaxKm} />
        <OverviewCard pins={pins} pipeline={pipeline} />
      </div>

      {mode.kind === "addModal" && pendingCoords ? (
        <AddPinModal
          coords={pendingCoords}
          onCancel={() => { setMode({ kind: "idle" }); setPendingCoords(null); }}
          onConfirm={onAddPinConfirm}
        />
      ) : null}

      <Toasts toasts={toasts} />
    </div>
  );
}

function AddPinModal({ coords, onCancel, onConfirm }) {
  const [label, setLabel] = React.useState("KP 53+000");
  const [chainage, setChainage] = React.useState("53.0");
  const [err, setErr] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    const ch = parseFloat(chainage);
    if (!label.trim()) return setErr("Label is required.");
    if (isNaN(ch)) return setErr("Chainage must be a number.");
    setSaving(true);
    await onConfirm(label.trim(), ch);
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal glass-strong" onClick={(e) => e.stopPropagation()}>
        <div className="modal-eyebrow">New chainage pin</div>
        <div className="modal-title">Place pin on route</div>
        <div className="modal-sub">{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)} · snaps to alignment</div>
        <form onSubmit={submit}>
          <div className="field">
            <label>KP Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. KP 53+500" autoFocus />
          </div>
          <div className="field">
            <label>Chainage (km)</label>
            <input type="number" value={chainage} onChange={(e) => setChainage(e.target.value)} step="0.1" min="0" />
          </div>
          {err ? <div style={{ color: "var(--accent)", fontSize: 12 }}>{err}</div> : null}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Add Pin"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
