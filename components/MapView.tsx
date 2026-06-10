"use client";

import { GoogleMap, Marker, useLoadScript, DirectionsRenderer } from "@react-google-maps/api";

export default function MapView({ customers, directions }: any) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  if (!isLoaded) return <p>Loading map...</p>;

  return (
    <div style={{ height: 500, width: "100%" }}>
      <GoogleMap
        zoom={11}
        center={{ lat: 30.2672, lng: -97.7431 }}
        mapContainerStyle={{ height: "100%", width: "100%" }}
      >
        {directions && <DirectionsRenderer directions={directions} />}

        {customers.map((c: any) =>
          c.lat && c.lng ? (
            <Marker key={c.id} position={{ lat: c.lat, lng: c.lng }} />
          ) : null
        )}
      </GoogleMap>
    </div>
  );
}