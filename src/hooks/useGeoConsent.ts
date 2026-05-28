"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

async function requestAndSendGeo() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("cookie_consent") !== "accepted") return;
  if (!navigator.geolocation) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  if (sessionStorage.getItem("geo_sent")) return;

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        let city: string | undefined;
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { "Accept-Language": "fr" } }
          );
          const d = await r.json();
          city = d.address?.city || d.address?.town || d.address?.village;
        } catch {}

        const res = await fetch("/api/user/location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, city }),
        });

        if (res.ok) {
          sessionStorage.setItem("geo_sent", "1");
          window.dispatchEvent(new Event("geo_location_sent"));
        }
      } catch {}
    },
    () => {},
    { timeout: 30000, maximumAge: 3600000, enableHighAccuracy: false }
  );
}

export function useGeoConsent() {
  useEffect(() => {
    sessionStorage.removeItem("geo_sent");
    requestAndSendGeo();

    const onCookieAccept = () => {
      sessionStorage.removeItem("geo_sent");
      requestAndSendGeo();
    };
    window.addEventListener("cookie_consent_accepted", onCookieAccept);
    return () => window.removeEventListener("cookie_consent_accepted", onCookieAccept);
  }, []);
}
