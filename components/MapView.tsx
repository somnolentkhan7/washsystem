"use client";

import { GoogleMap, Marker, InfoWindow, useLoadScript } from "@react-google-maps/api";
import { useState } from "react";

type Customer = {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  completed: boolean;
};

export default function MapView({ customers }: { customers: Customer[] }) {
  const [selected, setSelected] = useState<Customer | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  if (!isLoaded) return <p>Loading map...</p>;

  function getPinColor(c: Customer) {
    if (c.completed) return "green";
    return "red";
  }

  return (
    <GoogleMap
      zoom={12}
      center={{
        lat: customers[0]?.lat || 30.2672,
        lng: customers[0]?.lng || -97.7431,
      }}
      mapContainerStyle={{ width: "100%", height: "80vh" }}
    >
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
                  : "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
            }}
          />
        ))}

      {selected && (
        <InfoWindow
          position={{ lat: selected.lat!, lng: selected.lng! }}
          onCloseClick={() => setSelected(null)}
        >
          <div>
            <strong>{selected.name}</strong>
            <p>{selected.address}</p>
            <p>{selected.completed ? "Completed" : "Pending"}</p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}