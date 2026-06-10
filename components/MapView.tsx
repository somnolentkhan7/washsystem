"use client";

import {
  GoogleMap,
  Marker,
  DirectionsRenderer,
  useLoadScript,
} from "@react-google-maps/api";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/* ---------------- TYPES ---------------- */
type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  price: number;
  date: string;
  completed: boolean;
  services: string[];
  notes: string;
  lat?: number;
  lng?: number;
};

/* ---------------- HOUSE ---------------- */
const START_LOCATION = {
  lat: 30.176466,
  lng: -97.868778,
};

/* ---------------- COMPONENT ---------------- */
export default function MapView({
  customers,
  refreshCustomers,
}: {
  customers: Customer[];
  refreshCustomers: () => void;
}) {
  const [selected, setSelected] = useState<Customer | null>(null);
  const [directions, setDirections] = useState<any>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  /* ---------------- CLEAN MAP OPTIONS ---------------- */
  const mapOptions = useMemo(
    () => ({
      clickableIcons: false,
      disableDefaultUI: true,
      gestureHandling: "greedy",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    }),
    []
  );

  /* ---------------- PIN COLORS ---------------- */
  function getPinColor(c: Customer) {
    if (c.completed) return "green";
    if (c.date === new Date().toISOString().split("T")[0]) return "orange";
    return "red";
  }

  /* ---------------- TODAY ---------------- */
  const todayKey = useMemo(
    () => new Date().toISOString().split("T")[0],
    []
  );

  const todayStops = useMemo(() => {
    return customers.filter(
      (c) => c.date === todayKey && c.lat && c.lng
    );
  }, [customers, todayKey]);

  /* ---------------- ORDER STOPS ---------------- */
  const orderedStops = useMemo(() => {
    if (todayStops.length === 0) return [];

    return [...todayStops].sort((a, b) => {
      const aDist = Math.hypot(
        (a.lat! - START_LOCATION.lat),
        (a.lng! - START_LOCATION.lng)
      );
      const bDist = Math.hypot(
        (b.lat! - START_LOCATION.lat),
        (b.lng! - START_LOCATION.lng)
      );
      return aDist - bDist;
    });
  }, [todayStops]);

  /* ---------------- ROUTE ---------------- */
  useEffect(() => {
    if (!isLoaded) return;
    if (!window.google?.maps) return;
    if (orderedStops.length === 0) return;

    const waypoints = orderedStops.map((c) => ({
      location: new window.google.maps.LatLng(c.lat!, c.lng!),
      stopover: true,
    }));

    const service = new window.google.maps.DirectionsService();

    service.route(
      {
        origin: new window.google.maps.LatLng(
          START_LOCATION.lat,
          START_LOCATION.lng
        ),
        destination: new window.google.maps.LatLng(
          orderedStops[orderedStops.length - 1].lat!,
          orderedStops[orderedStops.length - 1].lng!
        ),
        waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result) {
          setDirections(result);
        } else {
          console.log("Directions error:", status);
        }
      }
    );
  }, [orderedStops, isLoaded]);

  /* ---------------- TOGGLE COMPLETE ---------------- */
  async function toggleComplete(customer: Customer) {
    await supabase
      .from("customers")
      .update({ completed: !customer.completed })
      .eq("id", customer.id);

    setSelected(null);
    refreshCustomers();
  }

  /* ---------------- CLOSE POPUP ON BACKDROP CLICK ---------------- */
  function closePopup() {
    setSelected(null);
  }

  /* ---------------- LOADING ---------------- */
  if (!isLoaded) return <p>Loading map...</p>;

  return (
    <div style={{ position: "relative" }}>
      <GoogleMap
        zoom={12}
        center={START_LOCATION}
        mapContainerStyle={{
          width: "100%",
          height: "80vh",
          borderRadius: 16,
        }}
        options={mapOptions}
        onClick={() => closePopup()}
      >
        {/* ROUTE */}
        {directions && <DirectionsRenderer directions={directions} />}

        {/* HOUSE */}
        <Marker
          position={START_LOCATION}
          icon={{
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          }}
        />

        {/* NUMBERED CUSTOMER PINS */}
        {orderedStops.map((c, index) => {
          const isSelected = selected?.id === c.id;

          return (
            <Marker
              key={c.id}
              position={{ lat: c.lat!, lng: c.lng! }}
              onClick={() => setSelected(c)}
              label={{
                text: String(index + 1),
                color: "white",
                fontWeight: "bold",
              }}
              icon={{
                url:
                  getPinColor(c) === "green"
                    ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                    : getPinColor(c) === "orange"
                    ? "http://maps.google.com/mapfiles/ms/icons/orange-dot.png"
                    : "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
                scaledSize: isSelected
                  ? new window.google.maps.Size(45, 45)
                  : new window.google.maps.Size(32, 32),
              }}
              opacity={selected && !isSelected ? 0.5 : 1}
            />
          );
        })}
      </GoogleMap>

      {/* POPUP */}
      {selected && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            width: 340,
            background: "#fff",
            borderRadius: 18,
            padding: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, Inter, sans-serif",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{selected.name}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {selected.address}
              </div>
            </div>

            <div
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 999,
                background: selected.completed ? "#dcfce7" : "#fef9c3",
                color: selected.completed ? "#166534" : "#92400e",
              }}
            >
              {selected.completed ? "DONE" : "PENDING"}
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 13 }}>
            <div>📞 {selected.phone || "No phone"}</div>
            <div>🧼 {selected.services?.join(", ")}</div>
            <div>💵 ${selected.price}</div>
            {selected.notes && (
              <div style={{ opacity: 0.7 }}>📝 {selected.notes}</div>
            )}
          </div>

          <button
            onClick={() => toggleComplete(selected)}
            style={{
              marginTop: 12,
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "none",
              background: selected.completed ? "#999" : "#1d1d1f",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {selected.completed ? "Mark Incomplete" : "Mark Complete"}
          </button>
        </div>
      )}
    </div>
  );
}