"use client";

import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import { useState } from "react";
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

/* ---------------- COMPONENT ---------------- */
export default function MapView({
  customers,
  refreshCustomers,
}: {
  customers: Customer[];
  refreshCustomers: () => void;
}) {
  const [selected, setSelected] = useState<Customer | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  if (!isLoaded) return <p>Loading map...</p>;

  /* ---------------- PIN COLORS ---------------- */
  function getPinColor(c: Customer) {
    if (c.completed) return "green";
    if (c.date === new Date().toISOString().split("T")[0]) return "orange";
    return "red";
  }

  /* ---------------- TOGGLE COMPLETE (REAL DB UPDATE) ---------------- */
  async function toggleComplete(customer: Customer) {
    const { error } = await supabase
      .from("customers")
      .update({ completed: !customer.completed })
      .eq("id", customer.id);

    if (error) {
      console.log(error);
      return;
    }

    setSelected(null);     // close popup
    refreshCustomers();    // reload map data
  }

  return (
    <div style={{ position: "relative" }}>
      <GoogleMap
        zoom={12}
        center={{
          lat: customers.find((c) => c.lat)?.lat || 30.2672,
          lng: customers.find((c) => c.lng)?.lng || -97.7431,
        }}
        mapContainerStyle={{
          width: "100%",
          height: "80vh",
          borderRadius: 16,
        }}
      >
        {/* ---------------- PINS ---------------- */}
        {customers
          .filter((c) => c.lat && c.lng)
          .map((c) => (
            <Marker
              key={c.id}
              position={{ lat: c.lat!, lng: c.lng! }}
              onClick={() => setSelected(c)}
              icon={{
                url:
                  getPinColor(c) === "green"
                    ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                    : getPinColor(c) === "orange"
                    ? "http://maps.google.com/mapfiles/ms/icons/orange-dot.png"
                    : "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
              }}
            />
          ))}
      </GoogleMap>

      {/* ---------------- POPUP ---------------- */}
      {selected && (
        <div
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
          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {selected.name}
              </div>
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

          {/* INFO */}
          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
            <div>📞 {selected.phone || "No phone"}</div>
            <div>
              🧼{" "}
              {selected.services?.length
                ? selected.services.join(", ")
                : "No services"}
            </div>
            <div>💵 ${selected.price}</div>

            {selected.notes && (
              <div style={{ marginTop: 6, opacity: 0.6 }}>
                📝 {selected.notes}
              </div>
            )}
          </div>

          {/* BUTTONS */}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              onClick={() => toggleComplete(selected)}
              style={{
                flex: 1,
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

            <button
              onClick={() => setSelected(null)}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}