// Side card (desktop) + bottom sheet (mobile) for the document panel

const { useState: useStateSheet, useEffect: useEffectSheet, useRef: useRefSheet, useMemo: useMemoSheet } = React;

function DocPanelContents({ pin, docs, activity, canEdit, onUpload, onMove, onDelete, moveActive, onClose, onDownload }) {
  const [tab, setTab] = useStateSheet("docs");
  const [dragging, setDragging] = useStateSheet(false);
  const fileRef = useRefSheet(null);

  const pinDocs = useMemoSheet(() => docs.filter((d) => d.pin_id === pin?.id), [docs, pin]);

  const handleFile = (file) => {
    if (file && pin) onUpload(pin.id, file);
  };

  const fmtSize = (kb) => kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
  const fmtDate = (iso) => {
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  if (!pin) return null;

  return (
    <>
      <div className="card-header">
        <div className="card-eyebrow">Chainage Pin · {pin.status.replace("-", " ")}</div>
        <div className="card-title">{pin.label}</div>
        <div className="card-sub mono">
          <span>{pin.chainage_km.toFixed(3)} km</span>
          <span className="sep">·</span>
          <span>{pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</span>
        </div>
        <button className="card-close" onClick={onClose} aria-label="Close"><Icons.Close size={14} /></button>
      </div>

      <div className="card-quickactions">
        <button className="qa-btn" onClick={() => fileRef.current?.click()} disabled={!canEdit}>
          <span className="qa-icon"><Icons.Upload size={18} /></span>
          Upload
        </button>
        <button className={`qa-btn ${moveActive ? "active" : ""}`} onClick={onMove} disabled={!canEdit}>
          <span className="qa-icon"><Icons.Move size={18} /></span>
          Move
        </button>
        <button className="qa-btn" onClick={() => navigator.clipboard?.writeText(`${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}`)}>
          <span className="qa-icon"><Icons.Share size={18} /></span>
          Share
        </button>
        <button className="qa-btn danger" onClick={onDelete} disabled={!canEdit}>
          <span className="qa-icon"><Icons.Trash size={18} /></span>
          Delete
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "12px 16px 0", borderBottom: "0.5px solid var(--hairline)" }}>
        {[
          { id: "docs", label: `Documents (${pinDocs.length})` },
          { id: "activity", label: "Activity" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 12px",
              fontSize: 12.5,
              fontWeight: 600,
              color: tab === t.id ? "var(--ink-1)" : "var(--ink-3)",
              borderBottom: `2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card-body">
        {tab === "docs" ? (
          <>
            {pinDocs.length === 0 ? (
              <div className="empty">
                <div className="empty-icon"><Icons.Doc size={20} /></div>
                <div className="empty-title">No documents yet</div>
                <div className="empty-sub">{canEdit ? "Drop a file below to attach it to this pin." : "Ask an editor to upload reports here."}</div>
              </div>
            ) : (
              <>
                <div className="section-label">Attached files <span className="count">{pinDocs.length}</span></div>
                {pinDocs.map((d) => (
                  <div key={d.id} className="doc-item" onClick={() => onDownload(d)}>
                    <div className={`doc-thumb ${d.type}`}>{d.type.toUpperCase()}</div>
                    <div className="doc-info">
                      <div className="doc-name">{d.filename}</div>
                      <div className="doc-meta">
                        <span>{fmtSize(d.size_kb)}</span>
                        <span className="sep">·</span>
                        <span>{d.uploaded_by}</span>
                        <span className="sep">·</span>
                        <span>{fmtDate(d.created_at)}</span>
                      </div>
                    </div>
                    <button className="doc-action" aria-label="Download"><Icons.Download size={14} /></button>
                  </div>
                ))}
              </>
            )}

            {canEdit ? (
              <>
                <div
                  className={`upload-zone ${dragging ? "dragging" : ""}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                >
                  <Icons.Upload size={22} stroke="currentColor" />
                  <div className="up-title">Drag a file here, or click to browse</div>
                  <div className="up-sub">PDF, DWG, images, spreadsheets up to 100 MB</div>
                </div>
                <input ref={fileRef} type="file" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
              </>
            ) : null}
          </>
        ) : (
          <>
            <div className="section-label">Recent at this pin</div>
            {activity.slice(0, 5).map((a) => (
              <div key={a.id} className="activity-item">
                <div className={`activity-dot ${a.muted ? "muted" : ""}`} />
                <div>
                  <div className="activity-text" dangerouslySetInnerHTML={{ __html: a.text }} />
                  <div className="activity-time">{a.time}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}

// Desktop side card
function SideCard({ open, ...props }) {
  return (
    <aside className={`side-card glass-strong ${open ? "open" : ""}`}>
      {props.pin ? <DocPanelContents {...props} /> : null}
    </aside>
  );
}

// Mobile bottom sheet — draggable
function BottomSheet({ open, ...props }) {
  const [phase, setPhase] = useStateSheet("hidden"); // hidden | peek | half | full
  const [drag, setDrag] = useStateSheet(null);
  const sheetRef = useRefSheet(null);

  useEffectSheet(() => {
    if (open && phase === "hidden") setPhase("half");
    if (!open) setPhase("hidden");
  }, [open]);

  const startDrag = (clientY) => {
    if (!sheetRef.current) return;
    setDrag({ startY: clientY, startTransform: sheetRef.current.getBoundingClientRect().top });
  };
  const moveDrag = (clientY) => {
    if (!drag || !sheetRef.current) return;
    const top = Math.max(window.innerHeight * 0.12, Math.min(window.innerHeight - 100, drag.startTransform + (clientY - drag.startY)));
    sheetRef.current.style.transform = `translateY(${top}px)`;
    sheetRef.current.style.top = "0";
    sheetRef.current.classList.add("dragging");
  };
  const endDrag = (clientY) => {
    if (!drag || !sheetRef.current) return;
    const finalTop = sheetRef.current.getBoundingClientRect().top;
    const h = window.innerHeight;
    sheetRef.current.style.transform = "";
    sheetRef.current.style.top = "";
    sheetRef.current.classList.remove("dragging");
    setDrag(null);
    if (finalTop > h * 0.7) setPhase("peek");
    else if (finalTop > h * 0.35) setPhase("half");
    else setPhase("full");
  };

  return (
    <div className={`sheet ${phase}`} ref={sheetRef}>
      <div
        className="sheet-handle"
        onMouseDown={(e) => startDrag(e.clientY)}
        onMouseMove={(e) => drag && moveDrag(e.clientY)}
        onMouseUp={(e) => drag && endDrag(e.clientY)}
        onMouseLeave={(e) => drag && endDrag(e.clientY)}
        onTouchStart={(e) => startDrag(e.touches[0].clientY)}
        onTouchMove={(e) => drag && moveDrag(e.touches[0].clientY)}
        onTouchEnd={(e) => drag && endDrag(e.changedTouches[0].clientY)}
        onClick={() => { if (phase === "peek") setPhase("half"); else if (phase === "half") setPhase("full"); else setPhase("peek"); }}
      >
        <div className="sheet-grabber" />
      </div>
      {props.pin ? <DocPanelContents {...props} /> : null}
    </div>
  );
}

Object.assign(window, { SideCard, BottomSheet, DocPanelContents });
