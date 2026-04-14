// Main map logic — requires api.js to be loaded first
(async () => {
  // Auth guard
  const token = localStorage.getItem("archive_token");
  if (!token) {
    window.location.href = "/index.html";
    return;
  }

  const user = JSON.parse(localStorage.getItem("archive_user") || "{}");
  const isViewer = user.role === "viewer";

  // Populate nav
  document.getElementById("user-email").textContent = user.email || "";
  document.getElementById("user-role").textContent = user.role || "";

  // Logout
  document.getElementById("btn-logout").addEventListener("click", () => {
    localStorage.removeItem("archive_token");
    localStorage.removeItem("archive_user");
    window.location.href = "/index.html";
  });

  // ── Map init ─────────────────────────────────────────────
  const MAPTILER_KEY = "yWmb8yiKRTHxOjFuoso9";

  const map = new maplibregl.Map({
    container: "map",
    style: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
    center: [-114.0719, 51.0447],  // Calgary — centered on seed pipeline
    zoom: 9,
  });

  map.addControl(new maplibregl.NavigationControl(), "top-left");

  map.on("load", async () => {
    await loadPipeline();
    await loadPins();
  });

  // ── Pipeline route ────────────────────────────────────────
  async function loadPipeline() {
    try {
      const geojson = await getPipelineGeoJSON(1);
      if (!geojson) return;
      map.addSource("pipeline", { type: "geojson", data: geojson });
      map.addLayer({
        id: "pipeline-line",
        type: "line",
        source: "pipeline",
        paint: {
          "line-color": "#f59e0b",  // amber — visible on satellite
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });
    } catch (err) {
      console.error("Failed to load pipeline:", err);
    }
  }

  // ── Chainage pins ─────────────────────────────────────────
  async function loadPins() {
    try {
      const featureCollection = await getPipelinePins(1);
      if (!featureCollection) return;
      map.addSource("pins", { type: "geojson", data: featureCollection });
      map.addLayer({
        id: "pins-layer",
        type: "circle",
        source: "pins",
        paint: {
          "circle-radius": 8,
          "circle-color": "#ffffff",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#f59e0b",
        },
      });

      // Pin labels
      map.addLayer({
        id: "pins-labels",
        type: "symbol",
        source: "pins",
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Open Sans Regular"],
          "text-size": 11,
          "text-offset": [0, 1.6],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#1B2A4A",
          "text-halo-width": 1.5,
        },
      });

      // Click handler
      map.on("click", "pins-layer", (e) => {
        const pin = e.features[0].properties;
        openDocPanel(pin.id, pin.label, pin.chainage_km);
      });

      map.on("mouseenter", "pins-layer", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "pins-layer", () => {
        map.getCanvas().style.cursor = "";
      });
    } catch (err) {
      console.error("Failed to load pins:", err);
    }
  }

  // ── Document panel ────────────────────────────────────────
  let activePinId = null;

  const panel = document.getElementById("doc-panel");
  const panelLabel = document.getElementById("panel-label");
  const panelKp = document.getElementById("panel-kp");
  const docList = document.getElementById("doc-list");
  const uploadZone = document.getElementById("upload-zone");
  const fileInput = document.getElementById("file-input");
  const uploadMsg = document.getElementById("upload-msg");

  document.getElementById("panel-close").addEventListener("click", () => {
    panel.classList.remove("open");
    activePinId = null;
  });

  // Hide upload for viewers
  if (isViewer) {
    uploadZone.classList.add("hidden");
  }

  async function openDocPanel(pinId, label, chainageKm) {
    activePinId = pinId;
    panelLabel.textContent = label;
    panelKp.textContent = `KP ${chainageKm.toFixed(3)} km`;
    docList.innerHTML = '<li class="empty-state">Loading…</li>';
    panel.classList.add("open");
    await refreshDocs(pinId);
  }

  async function refreshDocs(pinId) {
    try {
      const docs = await getDocuments(pinId);
      if (!docs || docs.length === 0) {
        docList.innerHTML = '<li class="empty-state">No documents attached yet.</li>';
        return;
      }
      docList.innerHTML = docs.map((doc) => `
        <li class="doc-item">
          <span class="doc-icon">📄</span>
          <div class="doc-info">
            <div class="doc-name" title="${escHtml(doc.filename)}">${escHtml(doc.filename)}</div>
            <div class="doc-meta">${doc.content_type} · ${formatDate(doc.created_at)}</div>
          </div>
          <button class="btn-dl" onclick="downloadDoc(${doc.id})">Download</button>
        </li>
      `).join("");
    } catch (err) {
      docList.innerHTML = '<li class="empty-state">Failed to load documents.</li>';
    }
  }

  // Upload
  uploadZone.addEventListener("click", () => fileInput.click());
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = "#2E5090";
  });
  uploadZone.addEventListener("dragleave", () => {
    uploadZone.style.borderColor = "";
  });
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = "";
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) handleUpload(fileInput.files[0]);
  });

  async function handleUpload(file) {
    if (!activePinId) return;
    uploadMsg.textContent = "Uploading…";
    try {
      await uploadDocument(activePinId, file);
      uploadMsg.textContent = "Uploaded successfully.";
      fileInput.value = "";
      await refreshDocs(activePinId);
      setTimeout(() => { uploadMsg.textContent = ""; }, 3000);
    } catch (err) {
      uploadMsg.textContent = `Upload failed: ${err.message}`;
    }
  }

  // ── Add Pin ───────────────────────────────────────────────
  const addPinBtn = document.getElementById("btn-add-pin");
  const modalBackdrop = document.getElementById("pin-modal-backdrop");
  const modalCoords = document.getElementById("modal-coords");
  const pinLabelInput = document.getElementById("pin-label");
  const pinKpInput = document.getElementById("pin-kp-input");
  const pinModalConfirm = document.getElementById("pin-modal-confirm");
  const pinModalCancel = document.getElementById("pin-modal-cancel");
  const pinModalError = document.getElementById("pin-modal-error");

  // Show button for admin and editor
  if (!isViewer) {
    addPinBtn.classList.remove("hidden");
  }

  let addPinMode = false;
  let pendingCoords = null;

  // Snap preview source — shows where pin will land on the route
  map.addSource("snap-preview", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: "snap-preview-layer",
    type: "circle",
    source: "snap-preview",
    paint: {
      "circle-radius": 9,
      "circle-color": "#22d3ee",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fff",
      "circle-opacity": 0.9,
    },
  });

  addPinBtn.addEventListener("click", () => {
    addPinMode = !addPinMode;
    if (addPinMode) {
      addPinBtn.textContent = "✕ Cancel";
      addPinBtn.classList.add("active");
      map.getCanvas().style.cursor = "crosshair";
    } else {
      exitAddPinMode();
    }
  });

  // Show snap preview dot while moving in add-pin mode
  map.on("mousemove", (e) => {
    if (!addPinMode) return;
    map.getSource("snap-preview").setData({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [e.lngLat.lng, e.lngLat.lat] },
        properties: {},
      }],
    });
  });

  map.on("click", async (e) => {
    if (!addPinMode) return;
    pendingCoords = { lat: e.lngLat.lat, lng: e.lngLat.lng };
    modalCoords.textContent = `${e.lngLat.lat.toFixed(6)}, ${e.lngLat.lng.toFixed(6)} → snaps to route`;
    pinLabelInput.value = "";
    pinKpInput.value = "";
    pinModalError.textContent = "";
    modalBackdrop.classList.remove("hidden");
  });

  pinModalCancel.addEventListener("click", () => {
    modalBackdrop.classList.add("hidden");
  });

  pinModalConfirm.addEventListener("click", async () => {
    const label = pinLabelInput.value.trim();
    const chainage_km = parseFloat(pinKpInput.value);
    if (!label) { pinModalError.textContent = "KP label is required."; return; }
    if (isNaN(chainage_km)) { pinModalError.textContent = "Chainage must be a number."; return; }

    pinModalConfirm.disabled = true;
    pinModalConfirm.textContent = "Saving…";
    try {
      await createPin(1, label, chainage_km, pendingCoords.lat, pendingCoords.lng);
      modalBackdrop.classList.add("hidden");
      pinModalConfirm.disabled = false;
      pinModalConfirm.textContent = "Add Pin";
      exitAddPinMode();
      await reloadPins();
    } catch (err) {
      pinModalError.textContent = err.message;
      pinModalConfirm.disabled = false;
      pinModalConfirm.textContent = "Add Pin";
    }
  });

  function exitAddPinMode() {
    addPinMode = false;
    addPinBtn.textContent = "+ Add Pin";
    addPinBtn.classList.remove("active");
    map.getCanvas().style.cursor = "";
    map.getSource("snap-preview").setData({ type: "FeatureCollection", features: [] });
  }

  async function reloadPins() {
    try {
      const featureCollection = await getPipelinePins(1);
      if (!featureCollection) return;
      if (map.getSource("pins")) {
        map.getSource("pins").setData(featureCollection);
      }
    } catch (err) {
      console.error("Failed to reload pins:", err);
    }
  }

  // Expose to inline onclick handlers
  window.downloadDoc = async function (docId) {
    try {
      const data = await getDownloadUrl(docId);
      window.open(data.presigned_url, "_blank");
    } catch (err) {
      alert("Download failed: " + err.message);
    }
  };

  // Helpers
  function escHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-CA", {
      year: "numeric", month: "short", day: "numeric",
    });
  }
})();
