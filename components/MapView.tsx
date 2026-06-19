"use client";

import {
  GoogleMap,
  Marker,
  useLoadScript,
} from "@react-google-maps/api";
import { useEffect, useMemo, useState } from "react";

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
  lat?: number | null;
  lng?: number | null;
};

type DoorPinStatus =
  | "not_home"
  | "not_interested"
  | "callback"
  | "never_knock";

type DateFilter = "today" | "two_days" | "week";

type DoorPin = {
  id: string;
  lat: number;
  lng: number;
  status: DoorPinStatus;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type SelectedPin =
  | { type: "customer"; customer: Customer }
  | { type: "door"; pin: DoorPin };

/* ---------------- CONSTANTS ---------------- */
const START_LOCATION = {
  lat: 30.2032,
  lng: -97.85231,
};

const STORAGE_KEY = "strong-powerwashing-door-pins";

const PIN_META: Record<
  DoorPinStatus,
  { label: string; short: string; color: string; labelColor: string }
> = {
  not_home: {
    label: "Not Home",
    short: "NH",
    color: "#6b7280",
    labelColor: "#ffffff",
  },
  not_interested: {
    label: "Not Interested",
    short: "NI",
    color: "#dc2626",
    labelColor: "#ffffff",
  },
  callback: {
    label: "Callback",
    short: "CB",
    color: "#facc15",
    labelColor: "#111827",
  },
  never_knock: {
    label: "Never Knock",
    short: "NK",
    color: "#111827",
    labelColor: "#ffffff",
  },
};

const STATUS_ORDER: DoorPinStatus[] = [
  "not_home",
  "not_interested",
  "callback",
  "never_knock",
];

const DATE_FILTERS: { key: DateFilter; label: string; days: number }[] = [
  { key: "today", label: "Today", days: 1 },
  { key: "two_days", label: "Last 2 Days", days: 2 },
  { key: "week", label: "Last Week", days: 7 },
];

/* ---------------- HELPERS ---------------- */
function getCustomerPosition(customer: Customer) {
  if (typeof customer.lat !== "number" || typeof customer.lng !== "number") {
    return null;
  }

  return { lat: customer.lat, lng: customer.lng };
}

function getDateKey(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
}

function getDateFilterStart(filter: DateFilter) {
  const filterConfig = DATE_FILTERS.find((item) => item.key === filter);
  const days = filterConfig?.days || 1;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function isIsoDateInFilter(value: string | undefined, filter: DateFilter) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date >= getDateFilterStart(filter);
}

function isDateKeyInFilter(value: string | undefined, filter: DateFilter) {
  if (!value) return false;

  const today = new Date();
  const start = getDateFilterStart(filter);
  const date = new Date(`${value}T12:00:00`);
  return date >= start && getDateKey(date) <= getDateKey(today);
}

function loadDoorPins(): DoorPin[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((pin) => typeof pin.lat === "number" && typeof pin.lng === "number")
      .map((pin) => ({
        id: pin.id || crypto.randomUUID(),
        lat: pin.lat,
        lng: pin.lng,
        status: normalizePinStatus(pin.status),
        address: pin.address || "",
        notes: pin.notes || "",
        createdAt: pin.createdAt || pin.updatedAt || new Date().toISOString(),
        updatedAt: pin.updatedAt || pin.createdAt || new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

function normalizePinStatus(status: string): DoorPinStatus {
  if (status === "not_home") return "not_home";
  if (status === "not_interested") return "not_interested";
  if (status === "callback" || status === "follow_up" || status === "interested") {
    return "callback";
  }
  if (status === "never_knock" || status === "do_not_knock") return "never_knock";

  return "not_home";
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const res = await fetch(`/api/places/geocode?latlng=${lat},${lng}`);
    const data = await res.json();
    return data.results?.[0]?.formatted_address || "";
  } catch {
    return "";
  }
}

/* ---------------- COMPONENT ---------------- */
export default function MapView({
  customers,
  refreshCustomers: _refreshCustomers,
}: {
  customers: Customer[];
  refreshCustomers: () => void;
}) {
  const [doorPins, setDoorPins] = useState<DoorPin[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [selected, setSelected] = useState<SelectedPin | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  useEffect(() => {
    setDoorPins(loadDoorPins());
    setPinsLoaded(true);
  }, []);

  useEffect(() => {
    if (!pinsLoaded) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doorPins));
  }, [doorPins, pinsLoaded]);

  const customerPins = useMemo(() => {
    return customers
      .filter((customer) => isDateKeyInFilter(customer.date, dateFilter))
      .map((customer) => ({ customer, position: getCustomerPosition(customer) }))
      .filter((item): item is { customer: Customer; position: { lat: number; lng: number } } =>
        Boolean(item.position)
      );
  }, [customers, dateFilter]);

  const visibleDoorPins = useMemo(() => {
    return doorPins.filter((pin) => isIsoDateInFilter(pin.createdAt, dateFilter));
  }, [doorPins, dateFilter]);

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

  async function addDoorPin(lat: number, lng: number) {
    const now = new Date().toISOString();
    const pin: DoorPin = {
      id: crypto.randomUUID(),
      lat,
      lng,
      status: "not_home",
      notes: "",
      address: "",
      createdAt: now,
      updatedAt: now,
    };

    setDoorPins((current) => [pin, ...current]);
    setSelected({ type: "door", pin });

    const address = await reverseGeocode(lat, lng);
    if (!address) return;

    setDoorPins((current) =>
      current.map((item) =>
        item.id === pin.id
          ? { ...item, address, updatedAt: new Date().toISOString() }
          : item
      )
    );
    setSelected((current) =>
      current?.type === "door" && current.pin.id === pin.id
        ? { type: "door", pin: { ...current.pin, address } }
        : current
    );
  }

  function updateDoorPin(id: string, fields: Partial<DoorPin>) {
    setDoorPins((current) =>
      current.map((pin) =>
        pin.id === id
          ? { ...pin, ...fields, updatedAt: new Date().toISOString() }
          : pin
      )
    );
    setSelected((current) =>
      current?.type === "door" && current.pin.id === id
        ? { type: "door", pin: { ...current.pin, ...fields } }
        : current
    );
  }

  function deleteDoorPin(id: string) {
    setDoorPins((current) => current.filter((pin) => pin.id !== id));
    setSelected(null);
  }

  if (!isLoaded) {
    return (
      <div style={styles.loading}>
        Loading map...
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <GoogleMap
        zoom={17}
        center={START_LOCATION}
        mapContainerStyle={styles.map}
        options={mapOptions}
        onClick={(event) => {
          if (!event.latLng) return;
          addDoorPin(event.latLng.lat(), event.latLng.lng());
        }}
      >
        <Marker
          position={START_LOCATION}
          icon={{
            url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
          }}
          title="Starting point"
        />

        {visibleDoorPins.map((pin) => {
          const meta = PIN_META[pin.status] || PIN_META.not_home;
          const isSelected = selected?.type === "door" && selected.pin.id === pin.id;
          return (
            <Marker
              key={pin.id}
              position={{ lat: pin.lat, lng: pin.lng }}
              onClick={() => setSelected({ type: "door", pin })}
              label={{
                text: meta.short,
                color: meta.labelColor,
                fontSize: "10px",
                fontWeight: "700",
              }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: meta.color,
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeOpacity: 1,
                strokeWeight: isSelected ? 3 : 2,
                scale: isSelected ? 17 : 13,
              }}
            />
          );
        })}

        {customerPins.map(({ customer, position }) => (
          <Marker
            key={`customer-${customer.id}`}
            position={position}
            onClick={() => setSelected({ type: "customer", customer })}
            label={{
              text: "$",
              color: "white",
              fontSize: "14px",
              fontWeight: "900",
            }}
            icon={{
              url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
              scaledSize: new window.google.maps.Size(
                selected?.type === "customer" && selected.customer.id === customer.id ? 46 : 36,
                selected?.type === "customer" && selected.customer.id === customer.id ? 46 : 36
              ),
            }}
            title={`Made Sale: ${customer.name}`}
          />
        ))}
      </GoogleMap>

      <div style={styles.dateFilter}>
        {DATE_FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => {
              setDateFilter(filter.key);
              setSelected(null);
            }}
            style={dateFilter === filter.key ? styles.activeDateFilterButton : styles.dateFilterButton}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {selected?.type === "door" && (
        <div style={styles.sheet}>
          <div style={styles.sheetHeader}>
            <div>
              <div style={styles.eyebrow}>House Pin</div>
              <div style={styles.sheetTitle}>{PIN_META[selected.pin.status].label}</div>
            </div>
            <button onClick={() => setSelected(null)} style={styles.closeButton}>
              x
            </button>
          </div>

          <div style={styles.addressText}>
            {selected.pin.address || "Address loading..."}
          </div>

          <select
            value={selected.pin.status}
            onChange={(e) =>
              updateDoorPin(selected.pin.id, { status: e.target.value as DoorPinStatus })
            }
            style={styles.select}
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {PIN_META[status].label}
              </option>
            ))}
          </select>

          <textarea
            value={selected.pin.notes || ""}
            onChange={(e) => updateDoorPin(selected.pin.id, { notes: e.target.value })}
            placeholder="Notes, name, gate code, follow-up time..."
            rows={3}
            style={styles.textarea}
          />

          <button
            onClick={() => deleteDoorPin(selected.pin.id)}
            style={styles.deleteButton}
          >
            Delete Pin
          </button>
        </div>
      )}

      {selected?.type === "customer" && (
        <div style={styles.sheet}>
          <div style={styles.sheetHeader}>
            <div>
              <div style={styles.eyebrow}>Made Sale</div>
              <div style={styles.sheetTitle}>{selected.customer.name}</div>
            </div>
            <button onClick={() => setSelected(null)} style={styles.closeButton}>
              x
            </button>
          </div>

          <div style={styles.addressText}>{selected.customer.address}</div>
          <div style={styles.infoGrid}>
            <div>
              <span>Phone</span>
              <strong>{selected.customer.phone || "No phone"}</strong>
            </div>
            <div>
              <span>Price</span>
              <strong>${selected.customer.price || 0}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{selected.customer.completed ? "Completed" : "Pending"}</strong>
            </div>
            <div>
              <span>Services</span>
              <strong>{selected.customer.services?.join(", ") || "None"}</strong>
            </div>
          </div>
          {selected.customer.notes && (
            <div style={styles.customerNotes}>{selected.customer.notes}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- STYLES ---------------- */
const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: "72vh",
    overflow: "hidden",
    borderRadius: 16,
    background: "#f3f4f6",
  },
  map: {
    width: "100%",
    height: "100%",
    minHeight: "72vh",
  },
  loading: {
    height: "72vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff",
    borderRadius: 16,
    color: "#6b7280",
  },
  dateFilter: {
    position: "absolute",
    top: 12,
    left: 12,
    display: "flex",
    gap: 6,
    maxWidth: "calc(100% - 24px)",
    overflowX: "auto",
    padding: 6,
    borderRadius: 999,
    background: "rgba(255,255,255,0.94)",
    border: "1px solid rgba(17,24,39,0.08)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.14)",
    zIndex: 2,
  },
  dateFilterButton: {
    border: "1px solid transparent",
    borderRadius: 999,
    background: "transparent",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
    color: "#374151",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  activeDateFilterButton: {
    border: "1px solid #111827",
    borderRadius: 999,
    background: "#111827",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
    color: "#ffffff",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0,
    color: "#6b7280",
  },
  sheet: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: "min(360px, calc(100% - 24px))",
    background: "#fff",
    border: "1px solid rgba(17,24,39,0.08)",
    borderRadius: 16,
    padding: 14,
    zIndex: 3,
    boxShadow: "0 18px 44px rgba(15,23,42,0.24)",
  },
  sheetHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: 800,
    color: "#111827",
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    cursor: "pointer",
    fontWeight: 800,
  },
  addressText: {
    marginTop: 8,
    marginBottom: 12,
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 1.35,
  },
  select: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontSize: 14,
    marginBottom: 10,
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    resize: "vertical",
    fontSize: 14,
    fontFamily: "inherit",
    marginBottom: 10,
  },
  deleteButton: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #fecaca",
    background: "#fff5f5",
    color: "#dc2626",
    fontWeight: 800,
    cursor: "pointer",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  customerNotes: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    background: "#f9fafb",
    color: "#374151",
    fontSize: 13,
    lineHeight: 1.35,
  },
};
