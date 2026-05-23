"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Maximize2, Minimize2, Mail, Clock, MapPin, User as UserIcon } from "lucide-react";

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

// Function to create colored markers
const getMarkerIcon = (role: string) => {
  let color = "#3b82f6"; // Default blue
  if (role === 'admin') color = "#ef4444"; // Red
  if (role === 'parent') color = "#22c55e"; // Green

  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
    className: 'custom-div-icon',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

function MapController() {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.scrollWheelZoom.enable();
      // Ensure the map can receive focus for keyboard/wheel events
      const container = map.getContainer();
      container.style.outline = "none";
      container.tabIndex = 0;
    }
  }, [map]);
  return null;
}

export default function UserMap({ users }: { users: UserMarker[] }) {
  const toggleFullScreen = () => {
    const mapElement = document.getElementById("user-map-container");
    if (!mapElement) return;

    if (!document.fullscreenElement) {
      mapElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div id="user-map-container" className="h-full w-full rounded-[20px] overflow-hidden border border-[rgba(197,161,72,0.25)] shadow-sm relative bg-white z-0">
       <button 
          onClick={toggleFullScreen}
          className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-md p-2 rounded-lg shadow-sm border border-[rgba(197,161,72,0.25)] hover:bg-white transition-colors text-gray-600 hover:text-[var(--greek-blue)]"
          title="Plein écran"
       >
          <Maximize2 size={18} />
       </button>

      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
        doubleClickZoom={true}
      >
        <MapController />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {users.map((user) => (
          <Marker 
            key={user.id} 
            position={[user.lat, user.lng]}
            icon={getMarkerIcon(user.role)}
          >
            <Popup>
              <div className="text-sm p-1 min-w-[180px]">
                <div className="flex items-center justify-between gap-4 mb-2 border-b border-[rgba(197,161,72,0.25)] pb-2">
                  <p className="font-bold flex items-center gap-2 text-[var(--greek-blue)]">
                    <span className={`w-2.5 h-2.5 rounded-full border border-white shadow-sm ${
                      user.role === 'admin' ? 'bg-red-500' : 
                      user.role === 'parent' ? 'bg-green-500' : 'bg-blue-500'
                    }`}></span>
                    {user.name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {user.isOnline && (
                      <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                      </span>
                    )}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                      user.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.isOnline ? 'En ligne' : 'Hors ligne'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2 text-gray-600 text-[11px]">
                  <div className="flex items-center gap-2">
                    <Mail size={12} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                    <span className="truncate max-w-[140px]" title={user.email}>{user.email}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-gray-400" />
                    <span>{user.city || "Localisation inconnue"}</span>
                  </div>

                  {user.lastActive && (
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-gray-400" />
                      <span>Activité: {new Date(user.lastActive).toLocaleDateString("fr-FR", { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>

                <div className="mt-2 pt-2 border-t border-[rgba(197,161,72,0.25)] flex items-center justify-between">
                   <span className="text-[9px] text-gray-400 capitalize bg-gray-50 px-2 py-0.5 rounded italic">
                      {user.role}
                   </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-16 right-4 z-[1000] bg-white/90 backdrop-blur-md p-2 rounded-lg shadow-sm border border-[rgba(197,161,72,0.25)] flex flex-col gap-1.5 text-[10px]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white"></div>
            <span className="font-medium text-gray-700">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-white"></div>
            <span className="font-medium text-gray-700">Parent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white"></div>
            <span className="font-medium text-gray-700">Enfant</span>
          </div>
      </div>
    </div>
  );
}
