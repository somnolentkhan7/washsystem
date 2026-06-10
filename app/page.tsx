"use client";

import { useEffect, useState } from "react";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
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

/* ---------------- PAGE ---------------- */
export default function Home() {
  console.log("ENV CHECK:", {
  supabase: process.env.NEXT_PUBLIC_SUPABASE_URL,
  maps: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });
  const [tab, setTab] = useState<"dashboard" | "jobs" | "map">("dashboard");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobFilter, setJobFilter] = useState<"all" | "pending" | "done">(
    "all"
  );
  const [routeMode] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    price: "",
    date: "",
    notes: "",
    services: [] as string[],
  });

  console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("GOOGLE KEY:", process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);


  /* ---------------- LOAD ---------------- */
  async function loadCustomers() {
    const { data, error } = await supabase.from("customers").select("*");

    if (error) {
      console.log(error);
      return;
    }

    setCustomers(data || []);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  /* ---------------- GEO ---------------- */
  const geocodeAddress = async (address: string) => {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    );

    const data = await res.json();
    if (!data.results?.length) return null;

    const loc = data.results[0].geometry.location;

    return {
      lat: loc.lat,
      lng: loc.lng,
    };
  };

  /* ---------------- ADD ---------------- */
  async function addCustomer() {
    if (!form.name || !form.address) return;

    const coords = await geocodeAddress(form.address);

    const { error } = await supabase.from("customers").insert({
      id: crypto.randomUUID(),
      name: form.name,
      phone: form.phone,
      address: form.address,
      price: Number(form.price),
      date: form.date,
      completed: false,
      services: form.services,
      notes: form.notes,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    });

    if (error) {
      console.log(error);
      return;
    }

    loadCustomers();

    setForm({
      name: "",
      phone: "",
      address: "",
      price: "",
      date: "",
      notes: "",
      services: [],
    });
  }

  /* ---------------- UPDATE ---------------- */
  async function toggleComplete(customer: Customer) {
    const { error } = await supabase
      .from("customers")
      .update({ completed: !customer.completed })
      .eq("id", customer.id);

    if (error) {
      console.log(error);
      return;
    }

    loadCustomers();
  }

  /* ---------------- DELETE ---------------- */
  async function deleteCustomer(id: string) {
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) {
      console.log(error);
      return;
    }

    loadCustomers();
  }

  /* ---------------- SERVICES ---------------- */
  function toggleService(service: string) {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service],
    }));
  }

  /* ---------------- ROUTE ---------------- */
  const optimizedRoute = customers
    .filter((c) => !c.completed && c.lat && c.lng)
    .sort(() => Math.random() - 0.5);

  /* ---------------- METRICS ---------------- */
  const revenue = customers
    .filter((c) => c.completed)
    .reduce((sum, c) => sum + c.price, 0);

  const completed = customers.filter((c) => c.completed).length;
  const pending = customers.length - completed;

  /* ---------------- MAP ---------------- */
  function MapView({ customers }: { customers: Customer[] }) {
    const { isLoaded } = useLoadScript({
      googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    });

    if (!isLoaded) return <p>Loading map...</p>;

    const center = { lat: 30.2672, lng: -97.7431 };

    return (
      <div style={{ height: 500, width: "100%", marginTop: 20 }}>
        <GoogleMap
          zoom={11}
          center={center}
          mapContainerStyle={{ height: "100%", width: "100%" }}
        >
          {customers.map((c) =>
            c.lat && c.lng ? (
              <Marker
                key={c.id}
                position={{ lat: c.lat, lng: c.lng }}
              />
            ) : null
          )}
        </GoogleMap>
      </div>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>Strong Powerwashing</h2>
      </div>

      {/* TABS */}
      <div style={styles.tabs}>
        {["dashboard", "jobs", "map"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            style={tab === t ? styles.activeTab : styles.tab}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && (
        <div style={styles.grid}>
          <Card title="Total Jobs" value={customers.length} />
          <Card title="Completed" value={completed} />
          <Card title="Pending" value={pending} />
          <Card title="Revenue" value={`$${revenue}`} />
        </div>
      )}

      {/* JOBS */}
      {tab === "jobs" && (
        <div>
          <div style={styles.card}>
            <h3>Add Job</h3>

            <input
              placeholder="Name"
              style={styles.input}
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />

            <input
              placeholder="Address"
              style={styles.input}
              value={form.address}
              onChange={(e) =>
                setForm({ ...form, address: e.target.value })
              }
            />

            <input
              type="date"
              style={styles.input}
              value={form.date}
              onChange={(e) =>
                setForm({ ...form, date: e.target.value })
              }
            />

            <input
              placeholder="Price"
              type="number"
              style={styles.input}
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: e.target.value })
              }
            />

            <div style={styles.serviceWrap}>
              {["Driveway", "Sidewalks", "Trash", "Patio"].map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => toggleService(s)}
                    style={{
                      ...styles.serviceBtn,
                      background: form.services.includes(s)
                        ? "#111"
                        : "#eee",
                      color: form.services.includes(s)
                        ? "white"
                        : "black",
                    }}
                  >
                    {s}
                  </button>
                )
              )}
            </div>

            <textarea
              placeholder="Notes"
              style={styles.textarea}
              value={form.notes}
              onChange={(e) =>
                setForm({ ...form, notes: e.target.value })
              }
            />

            <button style={styles.addBtn} onClick={addCustomer}>
              Add Job
            </button>
          </div>

          <div style={styles.filters}>
            {["all", "pending", "done"].map((f) => (
              <button
                key={f}
                onClick={() => setJobFilter(f as any)}
                style={
                  jobFilter === f
                    ? styles.activeFilter
                    : styles.filter
                }
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {(routeMode ? optimizedRoute : customers)
            .filter((c) => {
              if (jobFilter === "all") return true;
              if (jobFilter === "done") return c.completed;
              if (jobFilter === "pending") return !c.completed;
              return true;
            })
            .map((c) => (
              <div key={c.id} style={styles.item}>
                <div style={styles.name}>{c.name}</div>
                <div style={styles.sub}>{c.address}</div>
                <div style={styles.price}>${c.price}</div>

                <div style={styles.row}>
                  <button onClick={() => toggleComplete(c)}>
                    {c.completed ? "Undo" : "Complete"}
                  </button>

                  <button onClick={() => deleteCustomer(c.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* MAP */}
      {tab === "map" && <MapView customers={customers} />}
    </main>
  );
}

/* ---------------- CARD ---------------- */
function Card({ title, value }: any) {
  return (
    <div style={styles.cardBox}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={styles.cardValue}>{value}</div>
    </div>
  );
}

const styles: any = {
  page: {
    padding: 28,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, SF Pro Display, SF Pro Text, Inter, sans-serif",
    background: "#f5f5f7",
    minHeight: "100vh",
    maxWidth: 980,
    margin: "0 auto",
    color: "#1d1d1f",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  title: {
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: -0.3,
  },

  tabs: {
    display: "flex",
    gap: 8,
    marginTop: 12,
    marginBottom: 18,
  },

  tab: {
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    fontSize: 13,
  },

  activeTab: {
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#1d1d1f",
    color: "white",
    cursor: "pointer",
    fontSize: 13,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },

  cardBox: {
    background: "rgba(255,255,255,0.8)",
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.06)",
  },

  cardTitle: {
    fontSize: 12,
    opacity: 0.6,
  },

  cardValue: {
    fontSize: 22,
    fontWeight: 600,
  },

  card: {
    background: "white",
    padding: 16,
    borderRadius: 18,
    marginTop: 16,
    border: "1px solid rgba(0,0,0,0.06)",
  },

  input: {
    width: "100%",
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.1)",
  },

  textarea: {
    width: "100%",
    height: 80,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.1)",
  },

  addBtn: {
    width: "100%",
    padding: 12,
    marginTop: 10,
    background: "#1d1d1f",
    color: "white",
    borderRadius: 12,
    border: "none",
  },

  item: {
    background: "white",
    padding: 14,
    marginTop: 10,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.06)",
  },

  name: {
    fontWeight: 600,
  },

  sub: {
    opacity: 0.6,
    fontSize: 13,
  },

  price: {
    marginTop: 6,
    fontWeight: 600,
  },

  row: {
    display: "flex",
    gap: 10,
    marginTop: 10,
  },
};