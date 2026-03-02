"use client";

import GlobeGL from "react-globe.gl";
import { useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from "react";

interface GlobeMarker {
  countryCode: string;
  lat: number;
  lng: number;
  size: number;
  label: string;
  color: string;
  userId?: string;
  username?: string;
  hasAvatar?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoFeature = any;

/** Natural Earth uses ISO_A2="-99" for countries with overseas territories (France, Norway, etc).
 *  Fall back to first 2 chars of GU_A3 which reliably gives the correct ISO 2-letter code. */
function getCountryCode(d: GeoFeature): string | undefined {
  const iso = d.properties?.ISO_A2;
  if (iso && iso !== "-99") return iso;
  const gu = d.properties?.GU_A3;
  return gu ? gu.slice(0, 2) : undefined;
}

interface GlobeProps {
  markers: GlobeMarker[];
  polygonsData: GeoFeature[];
  activeCountryCodes: Set<string>;
  ipCountByCountry: Map<string, number>;
  width?: number;
  height?: number;
}

function createAvatarElement(m: GlobeMarker): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "pointer-events: none; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);";

  const el = document.createElement("div");
  const size = 24;
  el.style.cssText = `
    width: ${size}px; height: ${size}px; border-radius: 50%;
    border: 2px solid ${m.color};
    box-shadow: 0 0 6px ${m.color}60;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden; background: #0f1219;
  `;

  if (m.hasAvatar && m.userId) {
    const img = document.createElement("img");
    img.src = `/api/avatar/${m.userId}`;
    img.alt = "";
    img.style.cssText =
      "width: 100%; height: 100%; border-radius: 50%; object-fit: cover;";
    el.appendChild(img);
  } else {
    const initial = m.username?.[0]?.toUpperCase() ?? "?";
    el.style.backgroundColor = `${m.color}30`;
    const span = document.createElement("span");
    span.textContent = initial;
    span.style.cssText = `
      font-family: 'DM Sans', sans-serif; font-size: 10px;
      font-weight: 600; color: ${m.color}; line-height: 1;
    `;
    el.appendChild(span);
  }

  wrapper.appendChild(el);
  return wrapper;
}

const Globe = forwardRef<unknown, GlobeProps>(
  (
    {
      markers,
      polygonsData,
      activeCountryCodes,
      ipCountByCountry,
      width = 500,
      height = 500,
    },
    ref
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globeRef = useRef<any>(null);

    useImperativeHandle(ref, () => globeRef.current);

    useEffect(() => {
      if (!globeRef.current) return;
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;
      controls.enableZoom = true;
      controls.minDistance = 200;
      controls.maxDistance = 500;

      const stopAutoRotate = () => {
        controls.autoRotate = false;
      };
      controls.addEventListener("start", stopAutoRotate);
      return () => controls.removeEventListener("start", stopAutoRotate);
    }, []);

    const renderHtmlElement = useCallback(
      (d: object) => createAvatarElement(d as GlobeMarker),
      []
    );

    const polygonCapColor = useCallback(
      (d: GeoFeature) => {
        const code = getCountryCode(d);
        return code && activeCountryCodes.has(code)
          ? "rgba(232, 115, 90, 0.35)"
          : "rgba(30, 38, 50, 0.7)";
      },
      [activeCountryCodes]
    );

    const polygonSideColor = useCallback(
      () => "rgba(20, 28, 40, 0.4)",
      []
    );

    const polygonStrokeColor = useCallback(
      () => "rgba(255, 255, 255, 0.12)",
      []
    );

    const polygonAltitude = useCallback(
      (d: GeoFeature) => {
        const code = getCountryCode(d);
        return code && activeCountryCodes.has(code) ? 0.01 : 0.004;
      },
      [activeCountryCodes]
    );

    const polygonLabel = useCallback(
      (d: GeoFeature) => {
        const code = getCountryCode(d);
        const name = d.properties?.ADMIN || d.properties?.NAME;
        const count = code ? ipCountByCountry.get(code) : undefined;
        if (count) {
          return `<div style="font-family: 'DM Sans', sans-serif; font-size: 12px; color: #e8e0d8; background: rgba(15,18,25,0.9); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(232,115,90,0.3)">
              <strong style="color: #e8735a">${name}</strong><br/>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px">${count} IP${count !== 1 ? "s" : ""}</span>
            </div>`;
        }
        return `<div style="font-family: 'DM Sans', sans-serif; font-size: 11px; color: #9a928a; background: rgba(15,18,25,0.85); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08)">${name}</div>`;
      },
      [ipCountByCountry]
    );

    const pointColor = useCallback(
      (d: object) => (d as GlobeMarker).color || "#e8735a",
      []
    );

    const pointRadius = useCallback(
      (d: object) => Math.min(0.8, 0.2 + (d as GlobeMarker).size * 0.1),
      []
    );

    const pointLabel = useCallback(
      (d: object) => {
        const m = d as GlobeMarker;
        const c = m.color || "#e8735a";
        return `<div style="font-family: 'DM Sans', sans-serif; font-size: 12px; color: #e8e0d8; background: rgba(15,18,25,0.9); padding: 6px 10px; border-radius: 6px; border: 1px solid ${c}50">
            <strong style="color: ${c}">${m.label}</strong><br/>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px">${m.size} IP${m.size !== 1 ? "s" : ""}</span>
          </div>`;
      },
      []
    );

    return (
      <GlobeGL
        ref={globeRef}
        width={width}
        height={height}
        globeImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg"
        backgroundColor="rgba(0,0,0,0)"
        showAtmosphere={true}
        atmosphereColor="#e8735a"
        atmosphereAltitude={0.12}
        animateIn={true}
        // Country polygons
        polygonsData={polygonsData}
        polygonCapColor={polygonCapColor}
        polygonSideColor={polygonSideColor}
        polygonStrokeColor={polygonStrokeColor}
        polygonAltitude={polygonAltitude}
        polygonLabel={polygonLabel}
        // Point markers (subtle glow underneath avatars)
        pointsData={markers}
        pointLat="lat"
        pointLng="lng"
        pointColor={pointColor}
        pointAltitude={0.06}
        pointRadius={pointRadius}
        pointLabel={pointLabel}
        // HTML avatar icons on globe surface
        htmlElementsData={markers}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={0.1}
        htmlElement={renderHtmlElement}
        htmlTransitionDuration={300}
      />
    );
  }
);

Globe.displayName = "Globe";
export default Globe;
