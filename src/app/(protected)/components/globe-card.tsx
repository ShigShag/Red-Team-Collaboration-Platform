"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { COUNTRY_COORDINATES } from "@/lib/country-coordinates";
import { getUserColor } from "@/lib/user-colors";

const Globe = dynamic(() => import("./globe"), {
  ssr: false,
  loading: () => <GlobeSkeleton />,
});

interface GlobeCardProps {
  engagementId: string;
  globeWidth?: number;
  globeHeight?: number;
  memberIds?: string[];
}

interface GeoContributor {
  userId: string;
  username: string;
  displayName: string | null;
  hasAvatar: boolean;
  ipCount: number;
}

interface GeoEntry {
  countryCode: string | null;
  countryName: string | null;
  ipCount: number;
  contributors?: GeoContributor[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoFeature = any;

export function GlobeCard({ engagementId, globeWidth, globeHeight, memberIds = [] }: GlobeCardProps) {
  const [data, setData] = useState<GeoEntry[]>([]);
  const [polygons, setPolygons] = useState<GeoFeature[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch engagement IP data + GeoJSON in parallel
  useEffect(() => {
    Promise.all([
      fetch(`/api/engagements/${engagementId}/ip-geolocations`).then((r) =>
        r.json()
      ),
      fetch("/datasets/ne_110m_admin_0_countries.geojson").then((r) =>
        r.json()
      ),
    ])
      .then(([geoData, geoJson]) => {
        setData(geoData);
        // Exclude Antarctica
        setPolygons(
          geoJson.features.filter(
            (f: GeoFeature) => f.properties?.ISO_A2 !== "AQ"
          )
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [engagementId]);

  const resolved = useMemo(
    () => data.filter(
      (d): d is GeoEntry & { countryCode: string } => !!d.countryCode
    ),
    [data]
  );

  // Build markers with per-user colors
  const markers = useMemo(() => resolved.flatMap((d) => {
    const coords = COUNTRY_COORDINATES[d.countryCode];
    if (!coords) return [];

    const contributors = d.contributors ?? [];

    if (contributors.length <= 1) {
      // Single contributor or none: one marker
      const c = contributors[0];
      const color = c ? getUserColor(c.userId, memberIds) : "#e8735a";
      return [
        {
          countryCode: d.countryCode,
          lat: coords[0],
          lng: coords[1],
          size: d.ipCount,
          label: d.countryName ?? d.countryCode,
          color,
          userId: c?.userId,
          username: c?.displayName || c?.username,
          hasAvatar: c?.hasAvatar ?? false,
        },
      ];
    }

    // Multiple contributors: ring of offset markers
    const offsetRadius = 0.8;
    return contributors.map((c, i) => {
      const angle = (2 * Math.PI * i) / contributors.length;
      return {
        countryCode: d.countryCode,
        lat: coords[0] + offsetRadius * Math.cos(angle),
        lng: coords[1] + offsetRadius * Math.sin(angle),
        size: c.ipCount,
        label: `${d.countryName ?? d.countryCode} — ${c.displayName || c.username}: ${c.ipCount} IP${c.ipCount !== 1 ? "s" : ""}`,
        color: getUserColor(c.userId, memberIds),
        userId: c.userId,
        username: c.displayName || c.username,
        hasAvatar: c.hasAvatar,
      };
    });
  }), [resolved, memberIds]);

  const activeCountryCodes = useMemo(
    () => new Set(resolved.map((d) => d.countryCode)),
    [resolved]
  );
  const ipCountByCountry = useMemo(
    () => new Map(resolved.map((d) => [d.countryCode, d.ipCount])),
    [resolved]
  );

  const totalIps = data.reduce((sum, d) => sum + d.ipCount, 0);
  const countries = activeCountryCodes.size;

  if (loading) return <GlobeSkeleton />;

  if (polygons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-text-muted">Failed to load globe data</p>
      </div>
    );
  }

  const isFullscreen = !!globeWidth && !!globeHeight && Math.min(globeWidth, globeHeight) > 600;

  return (
    <div className="relative">
      <div className="flex items-center justify-center">
        <Globe
          markers={markers}
          polygonsData={polygons}
          activeCountryCodes={activeCountryCodes}
          ipCountByCountry={ipCountByCountry}
          width={globeWidth ?? 520}
          height={globeHeight ?? 520}
        />
      </div>

      {/* Inline stats — only in non-fullscreen */}
      {!isFullscreen && totalIps > 0 && (
        <div className="flex flex-col items-center mt-4">
          <div className="flex items-center gap-6">
            <span className="text-xs text-text-muted">
              <span className="text-accent font-mono font-semibold">
                {totalIps}
              </span>{" "}
              IP{totalIps !== 1 && "s"}
            </span>
            <span className="text-xs text-text-muted">
              <span className="text-accent font-mono font-semibold">
                {countries}
              </span>{" "}
              countr{countries !== 1 ? "ies" : "y"}
            </span>
          </div>
          <div className="mt-3 w-full max-w-sm">
            <div className="grid gap-1">
              {resolved
                .sort((a, b) => b.ipCount - a.ipCount)
                .map((d) => (
                  <div
                    key={d.countryCode}
                    className="flex items-center justify-between px-3 py-1.5 rounded bg-bg-elevated/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent" />
                      <span className="text-xs text-text-secondary">
                        {d.countryName ?? d.countryCode}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">
                        {d.countryCode}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-text-muted ml-4">
                      {d.ipCount} IP{d.ipCount !== 1 && "s"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {!isFullscreen && totalIps === 0 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-text-muted">No geolocated IPs yet</p>
          <p className="text-[11px] text-text-muted/50 mt-1">
            IPs are extracted from resources and actions
          </p>
        </div>
      )}
    </div>
  );
}

function GlobeSkeleton() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-[300px] h-[300px] rounded-full bg-bg-elevated/15 border border-border-default/20 animate-pulse" />
    </div>
  );
}
