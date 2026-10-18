"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Map as MapLibreMap, Marker as MapLibreMarker, setWorkerUrl } from "maplibre-gl";
import { MapPin, Mail, Clock, MapPinOff } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

interface UserMarker {
  id: string;
  name: string;
  email: string;
  status: string;
  lat: number;
  lng: number;
  role: "admin" | "parent" | "child";
  city?: string;
  lastActive?: string;
  isOnline?: boolean;
}

const ROLE_COLOR: Record<string, string> = {
  admin:  "#ef4444",
  parent: "#22c55e",
  child:  "#3b82f6",
};

// Style Carto Voyager — beau, sans API key
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

// Évite que plusieurs utilisateurs au même endroit (même ville/IP) se superposent.
// On applique un TRÈS petit décalage géographique (quelques dizaines de mètres) :
// assez pour les distinguer quand on zoome, mais assez petit pour qu'ils se
// regroupent (« stack ») quand on dézoome. L'ancien rayon (0.04° ≈ 4 km) étalait
// les points sur toute une ville.
function spreadOverlaps(users: UserMarker[]): UserMarker[] {
  const groups = new globalThis.Map<string, UserMarker[]>();
  for (const u of users) {
    const key = `${u.lat.toFixed(4)},${u.lng.toFixed(4)}`;
    const group = groups.get(key);
    if (group) group.push(u);
    else groups.set(key, [u]);
  }

  const result: UserMarker[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    // ~0.00012° ≈ 13 m, +3 m par point du cluster.
    const radius = 0.00012 + group.length * 0.00003;
    group.forEach((u, i) => {
      const angle = (2 * Math.PI * i) / group.length;
      result.push({
        ...u,
        lat: u.lat + radius * Math.sin(angle),
        lng: u.lng + radius * Math.cos(angle),
      });
    });
  }
  return result;
}

/** Pastille d'un utilisateur sur la carte + infobulle au survol. */
function MarkerBody({ user }: { user: UserMarker }) {
  return (
    <div title={`${user.name} : ${user.city || ""}`} className="group cursor-pointer relative">
      {/* Point animé si online */}
      <span className="relative flex h-3.5 w-3.5">
        {user.isOnline && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ background: ROLE_COLOR[user.role] }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-white shadow-md"
          style={{ background: ROLE_COLOR[user.role] }}
        />
      </span>

      {/* Tooltip hover */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-white rounded-xl shadow-xl border border-gray-100 p-3 min-w-[190px] z-50 text-xs pointer-events-none">
        <p className="font-bold text-[var(--greek-blue)] mb-1">{user.name}</p>
        <div className="flex items-center gap-1.5 text-gray-500 mb-1">
          <Mail size={10} /> <span className="truncate max-w-[150px]">{user.email}</span>
        </div>
        {user.city && (
          <div className="flex items-center gap-1.5 text-gray-500 mb-1">
            <MapPin size={10} /> {user.city}
          </div>
        )}
        {user.lastActive && (
          <div className="flex items-center gap-1.5 text-gray-400">
            <Clock size={10} />
            {new Date(user.lastActive).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
        <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex items-center justify-between">
          <span className="capitalize text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: ROLE_COLOR[user.role] + "20", color: ROLE_COLOR[user.role] }}>
            {user.role}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${user.isOnline ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {user.isOnline ? "En ligne" : "Hors ligne"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Carte des utilisateurs. maplibre-gl est piloté directement : react-map-gl (8.1.x) remplace `map.transform` par sa
 * propre copie, ce que maplibre-gl 6 interdit (propriété en lecture seule) — la carte plantait avec « e.center ».
 * On reste en maplibre-gl 6 car les versions <= 6.4 ont une faille critique.
 */
export default function UserMap({ users }: { users: UserMarker[] }) {
  const spread = useMemo(() => spreadOverlaps(users), [users]);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new globalThis.Map<string, { marker: MapLibreMarker; el: HTMLDivElement }>());
  const [mapFailed, setMapFailed] = useState(false);
  // Les pastilles sont des éléments DOM créés ici et remplis par React via des portails.
  const [markerEls, setMarkerEls] = useState<globalThis.Map<string, HTMLDivElement>>(() => new globalThis.Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapFailed) return;
    const markers = markersRef.current;
    let map: MapLibreMap;
    try {
      // Worker servi depuis public/ (copié à l'installation, voir scripts/copy-maplibre-worker.cjs).
      setWorkerUrl("/maplibre-gl-worker.mjs");
      map = new MapLibreMap({ container, style: MAP_STYLE, center: [2, 46], zoom: 4, attributionControl: false });
    } catch {
      setMapFailed(true);
      return;
    }
    mapRef.current = map;
    map.on("error", () => setMapFailed(true));
    return () => {
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [mapFailed]);

  // Synchronise les pastilles avec la liste des utilisateurs.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const wanted = new Set(spread.map((u) => u.id));
    markers.forEach(({ marker }, id) => {
      if (wanted.has(id)) return;
      marker.remove();
      markers.delete(id);
    });
    for (const user of spread) {
      const existing = markers.get(user.id);
      if (existing) {
        existing.marker.setLngLat([user.lng, user.lat]);
        continue;
      }
      const el = document.createElement("div");
      const marker = new MapLibreMarker({ element: el, anchor: "center" }).setLngLat([user.lng, user.lat]).addTo(map);
      markers.set(user.id, { marker, el });
    }
    setMarkerEls(new globalThis.Map(Array.from(markers, ([id, { el }]) => [id, el] as [string, HTMLDivElement])));
  }, [spread, mapFailed]);

  if (mapFailed) {
    return (
      <div
        id="user-map-container"
        className="h-full w-full rounded-[20px] overflow-hidden border border-[rgba(197,161,72,0.25)] shadow-sm relative flex flex-col items-center justify-center gap-2 bg-gray-50 text-gray-400"
      >
        <MapPinOff size={32} />
        <p className="text-sm font-medium">Carte indisponible</p>
        <p className="text-xs">{users.length} position{users.length !== 1 ? "s" : ""} non affichée{users.length !== 1 ? "s" : ""}</p>
      </div>
    );
  }

  return (
    <div
      id="user-map-container"
      className="h-full w-full rounded-[20px] overflow-hidden border border-[rgba(197,161,72,0.25)] shadow-sm relative"
    >
      <div ref={containerRef} className="h-full w-full" />
      {spread.map((user) => {
        const el = markerEls.get(user.id);
        return el ? createPortal(<MarkerBody user={user} />, el, user.id) : null;
      })}

      {/* Légende */}
      <div className="absolute bottom-4 right-4 z-10 bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow border border-gray-100 flex flex-col gap-1.5 text-[10px]">
        {(["admin", "parent", "child"] as const).map(role => (
          <div key={role} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm" style={{ background: ROLE_COLOR[role] }} />
            <span className="font-medium text-gray-700 capitalize">{role === "child" ? "Enfant" : role === "parent" ? "Parent" : "Admin"}</span>
          </div>
        ))}
      </div>

      {/* Compteur */}
      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow border border-gray-100 text-xs font-semibold text-[var(--greek-blue)]">
        {users.length} position{users.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
