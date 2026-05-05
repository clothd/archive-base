// Map component — wraps MapLibre GL JS with React state for pins, route, animated flow,
// custom HTML pin markers (so they're styled/animated as React elements).

const { useState: useStateMap, useEffect: useEffectMap, useRef: useRefMap, useMemo: useMemoMap } = React;

function PipelineMap({
  theme,
  mapStyle,
  pins,
  routeCoords,
  activePin,
  onPickPin,
  onMapClick,
  cursor,
  bearing,
  setBearing,
  measurePoints,
  registerMap,
}) {
  const containerRef = useRefMap(null);
  const mapRef = useRefMap(null);
  const markersRef = useRefMap({});
  const [mapReady, setMapReady] = useStateMap(false);

  // Init map once
  useEffectMap(() => {
    if (mapRef.current || !containerRef.current) return;
    const styleObj = MockData.MAP_STYLES.find((s) => s.id === mapStyle);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleObj?.url,
      center: [-114.0, 51.13],
      zoom: 9.6,
      bearing: 0,
      pitch: 30,
      attributionControl: false,
    });
    mapRef.current = map;
    registerMap(map);

    map.on("load", () => {
      addPipelineLayers(map);
      setMapReady(true);
      // Fit to pipeline
      fitToPipeline(map);
    });

    map.on("rotate", () => setBearing(map.getBearing()));

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Switch map style on demand — re-add all layers after style loads
  useEffectMap(() => {
    if (!mapRef.current || !mapReady) return;
    const styleObj = MockData.MAP_STYLES.find((s) => s.id === mapStyle);
    mapRef.current.setStyle(styleObj?.url);
    mapRef.current.once("styledata", () => {
      addPipelineLayers(mapRef.current);
      // Re-hydrate sources after style wipe
      const routeSrc = mapRef.current.getSource("pipeline-route");
      if (routeSrc && routeCoords?.length) {
        routeSrc.setData({
          type: "FeatureCollection",
          features: [{ type: "Feature", geometry: { type: "LineString", coordinates: routeCoords }, properties: {} }],
        });
      }
      const segSrc = mapRef.current.getSource("pipeline-segments");
      if (segSrc) segSrc.setData(buildSegmentFC(pins));
    });
  }, [mapStyle, mapReady]);

  // Map click handler
  useEffectMap(() => {
    if (!mapRef.current) return;
    const handler = (e) => onMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    mapRef.current.on("click", handler);
    return () => mapRef.current?.off("click", handler);
  }, [onMapClick]);

  // Cursor
  useEffectMap(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = cursor || "";
  }, [cursor]);

  // Animated flow line — animate the dash offset
  useEffectMap(() => {
    if (!mapReady) return;
    let raf;
    let offset = 0;
    const tick = () => {
      offset = (offset - 0.5) % 100;
      if (mapRef.current?.getLayer("pipeline-flow")) {
        try {
          mapRef.current.setPaintProperty("pipeline-flow", "line-dasharray", [0, 2, 4, offset / 100]);
        } catch (e) { /* style swap mid-animation */ }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [mapReady]);

  // HTML markers for pins (gives us full CSS styling)
  useEffectMap(() => {
    if (!mapRef.current || !mapReady) return;
    // Reconcile markers
    const seen = new Set();
    pins.forEach((pin) => {
      seen.add(pin.id);
      const isActive = activePin?.id === pin.id;
      if (markersRef.current[pin.id]) {
        const { marker, el, wrapper } = markersRef.current[pin.id];
        marker.setLngLat([pin.lng, pin.lat]);
        el.className = `pin-marker ${isActive ? "active" : ""} ${pin.doc_count > 0 ? "has-doc" : ""}`;
        wrapper.style.zIndex = isActive ? "10" : "";
      } else {
        // 0×0 wrapper: MapLibre positions this div at the coordinate via style.transform.
        // The inner .pin-marker uses CSS translate(-50%,-50%) which MapLibre never touches.
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "width:0;height:0;position:absolute;";
        if (isActive) wrapper.style.zIndex = "10";

        const el = document.createElement("div");
        el.className = `pin-marker ${isActive ? "active" : ""} ${pin.doc_count > 0 ? "has-doc" : ""}`;
        const num = pin.label.match(/(\d+)\+/)?.[1] ?? "";
        const col = ({ complete: "#4ea36e", "in-progress": "#d9a13a", pending: "#7a7d8a", blocked: "#c95a48" })[pin.status] || "#7a7d8a";
        el.style.setProperty("--pin-color", col);
        el.innerHTML = `<div class="pin-pulse"></div><div class="pin-disc">${num}</div>`;
        el.addEventListener("click", (e) => { e.stopPropagation(); onPickPin(pin); });
        wrapper.appendChild(el);

        const marker = new maplibregl.Marker({ element: wrapper }).setLngLat([pin.lng, pin.lat]).addTo(mapRef.current);
        markersRef.current[pin.id] = { marker, el, wrapper };
      }
    });
    // Remove markers not in current pins
    Object.keys(markersRef.current).forEach((id) => {
      if (!seen.has(Number(id))) {
        markersRef.current[id].marker.remove();
        delete markersRef.current[id];
      }
    });
  }, [pins, activePin, mapReady]);

  // Measure preview line
  useEffectMap(() => {
    if (!mapRef.current || !mapReady) return;
    const m = mapRef.current;
    const fc = {
      type: "FeatureCollection",
      features: measurePoints.length > 1 ? [{
        type: "Feature",
        geometry: { type: "LineString", coordinates: measurePoints.map((p) => [p.lng, p.lat]) },
        properties: {},
      }] : [],
    };
    if (m.getSource("measure")) m.getSource("measure").setData(fc);
  }, [measurePoints, mapReady]);

  function addPipelineLayers(m) {
    // Full route base line — drawn from GeoJSON geometry, always visible
    if (!m.getSource("pipeline-route")) {
      m.addSource("pipeline-route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    }
    if (!m.getLayer("pipeline-route-shadow")) {
      m.addLayer({
        id: "pipeline-route-shadow",
        type: "line",
        source: "pipeline-route",
        paint: { "line-color": "rgba(0,0,0,0.45)", "line-width": 12, "line-blur": 10 },
      });
    }
    if (!m.getLayer("pipeline-route-base")) {
      m.addLayer({
        id: "pipeline-route-base",
        type: "line",
        source: "pipeline-route",
        paint: { "line-color": "rgba(255,255,255,0.22)", "line-width": 6, "line-cap": "round" },
      });
    }

    // Status-colored segments between pins (drawn on top of route base)
    if (!m.getSource("pipeline-segments")) {
      m.addSource("pipeline-segments", { type: "geojson", data: buildSegmentFC(pins) });
    }
    if (!m.getLayer("pipeline-shadow")) {
      m.addLayer({
        id: "pipeline-shadow",
        type: "line",
        source: "pipeline-segments",
        paint: { "line-color": "rgba(0,0,0,0.4)", "line-width": 10, "line-blur": 8 },
      });
    }
    if (!m.getLayer("pipeline-base")) {
      m.addLayer({
        id: "pipeline-base",
        type: "line",
        source: "pipeline-segments",
        paint: { "line-color": ["get", "color"], "line-width": 5, "line-opacity": 0.95 },
      });
    }
    if (!m.getLayer("pipeline-flow")) {
      m.addLayer({
        id: "pipeline-flow",
        type: "line",
        source: "pipeline-segments",
        paint: {
          "line-color": "#fff",
          "line-width": 1.5,
          "line-opacity": 0.6,
          "line-dasharray": [0, 2, 4, 0],
        },
      });
    }
    if (!m.getSource("measure")) {
      m.addSource("measure", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "measure-line",
        type: "line",
        source: "measure",
        paint: { "line-color": "#ff8866", "line-width": 2, "line-dasharray": [2, 2] },
      });
    }
  }

  function statusColor(s) {
    return ({ complete: "#4ea36e", "in-progress": "#d9a13a", pending: "#7a7d8a", blocked: "#c95a48" })[s] || "#7a7d8a";
  }

  function buildSegmentFC(pinList) {
    // Sort pins by route_km, slice the polyline between consecutive pins
    const sorted = [...pinList].sort((a, b) => (a.route_km ?? 0) - (b.route_km ?? 0));
    const features = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      const coords = sliceRoute(a.route_km ?? 0, b.route_km ?? 0);
      if (coords.length >= 2) {
        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
          properties: { color: statusColor(a.status) },
        });
      }
    }
    return { type: "FeatureCollection", features };
  }

  function sliceRoute(km1, km2) {
    const out = [];
    out.push(MockData.coordAtKm(km1));
    for (let i = 0; i < MockData.ROUTE_CUMKM.length; i++) {
      if (MockData.ROUTE_CUMKM[i] > km1 && MockData.ROUTE_CUMKM[i] < km2) {
        out.push(MockData.PIPELINE_ROUTE[i]);
      }
    }
    out.push(MockData.coordAtKm(km2));
    return out;
  }

  // Update full route layer when route geometry arrives
  useEffectMap(() => {
    if (!mapReady || !mapRef.current || !routeCoords || !routeCoords.length) return;
    const src = mapRef.current.getSource("pipeline-route");
    if (src) {
      src.setData({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          geometry: { type: "LineString", coordinates: routeCoords },
          properties: {},
        }],
      });
    }
  }, [routeCoords, mapReady]);

  // Re-render status segments when pins change
  useEffectMap(() => {
    if (!mapReady || !mapRef.current) return;
    const src = mapRef.current.getSource("pipeline-segments");
    if (src) src.setData(buildSegmentFC(pins));
  }, [pins, mapReady]);

  // Resize map on container changes
  useEffectMap(() => {
    if (!mapRef.current) return;
    const ro = new ResizeObserver(() => mapRef.current?.resize());
    if (containerRef.current) ro.observe(containerRef.current);
    setTimeout(() => mapRef.current?.resize(), 100);
    setTimeout(() => mapRef.current?.resize(), 500);
    return () => ro.disconnect();
  }, []);

  function fitToPipeline(m) {
    const coords = MockData.PIPELINE_ROUTE;
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    m.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: { top: 100, right: 380, bottom: 200, left: 420 }, duration: 700, pitch: 35 }
    );
  }

  PipelineMap.fitToPipeline = () => mapRef.current && fitToPipeline(mapRef.current);

  return <div id="map" ref={containerRef} />;
}

window.PipelineMap = PipelineMap;
