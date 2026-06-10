"use client";

import MapView from "../components/MapView";
import { useEffect, useState } from "react";
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
const getStartOfWeek = (date = new Date(), offset = 0) => {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day + offset * 7);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getDateKey = (date: Date) => date.toISOString().split("T")[0];
export default function Home() {
console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const [directions, setDirections] = useState<any>(null);
  const [tab, setTab] = useState<"dashboard" | "jobs" | "map" | "calendar">("dashboard");
  const [weekOffset, setWeekOffset] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobFilter, setJobFilter] = useState<"all" | "pending" | "done">(
    "all"
  );
  const [routeMode] = useState(false);

async function getOptimizedRoute(customers: Customer[]) {
  if (typeof window === "undefined") return null;
  if (!window.google?.maps) return null;

  const stops = customers.filter((c) => c.lat && c.lng);
  if (stops.length === 0) return null;

  const service = new window.google.maps.DirectionsService();

  return new Promise((resolve, reject) => {
    service.route(
      {
        origin: "Austin, TX",
        destination: "Austin, TX",
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
        waypoints: stops.map((c) => ({
          location: { lat: c.lat!, lng: c.lng! },
          stopover: true,
        })),
      },
      (result, status) => {
        if (status === "OK") resolve(result);
        else reject(status);
      }
    );
  });
}

useEffect(() => {
  if (!routeMode) return;

  (async () => {
    try {
      const result = await getOptimizedRoute(customers);
      setDirections(result);
    } catch (err) {
      console.log("Route error:", err);
    }
  })();
}, [routeMode, customers]);

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
  console.log("INSERT START");
  console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("KEY EXISTS:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!form.name || !form.address) return;

  try {
    const coords = await geocodeAddress(form.address);

    console.log("GEOCODE RESULT:", coords);

    const { data, error } = await supabase.from("customers").insert([
      {
        name: form.name,
        phone: form.phone,
        address: form.address,
        price: Number(form.price || 0),
        date: form.date,
        completed: false,
        services: form.services,
        notes: form.notes,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      },
    ]);

    console.log("SUPABASE RESPONSE:", { data, error });

    if (error) {
      alert(error.message);
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
  } catch (err) {
    console.log("ADD CUSTOMER ERROR:", err);
  }
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


  /* ---------------- METRICS ---------------- */
  const getStartOfWeek = (date = new Date(), offset = 0) => {
  const start = new Date(date);
  const day = start.getDay();

  const diff = start.getDate() - day + offset * 7;
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  return start;
};

const getDateKey = (date: Date) => {
  return date.toISOString().split("T")[0];
};

const weekDays = Array.from({ length: 7 }).map((_, i) => {
  const start = getStartOfWeek(new Date(), weekOffset);
  const d = new Date(start);
  d.setDate(start.getDate() + i);
  return d;
});

const groupedByDate = customers.reduce((acc: any, customer) => {
  if (!customer.date) return acc;

  const date = customer.date;

  if (!acc[date]) acc[date] = [];
  acc[date].push(customer);

  return acc;
}, {});

  const revenue = customers
    .filter((c) => c.completed)
    .reduce((sum, c) => sum + c.price, 0);
  const completed = customers.filter((c) => c.completed).length;
  const pending = customers.length - completed;
  const getStartOfWeek = (date = new Date()) => {
  const start = new Date(date);
  const day = start.getDay(); // 0 = Sunday
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getDateKey = (date: Date) => {
  return date.toISOString().split("T")[0];
};




  /* ---------------- UI ---------------- */
  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>Strong Powerwashing</h2>
      </div>

      {/* TABS */}
      <div style={styles.tabs}>
        {["dashboard", "jobs", "map", "calendar"].map((t) => (
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

          {customers
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
      {/* CALENDAR */}
{tab === "calendar" && (
  <div>
    <div style={styles.card}>
      <h3>Weekly Calendar</h3>
      <p style={{ opacity: 0.6 }}>
        Your scheduled jobs for this week
      </p>
    </div>

    <div style={weekStyles.grid}>
      {weekDays.map((day, i) => {
        const key = getDateKey(day);

        const jobsForDay = customers.filter(
          (c) => c.date === key
        );

        return (
          <div key={i} style={weekStyles.day}>
            <div style={weekStyles.header}>
              {day.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </div>

            {jobsForDay.length === 0 ? (
              <div style={{ opacity: 0.4 }}>No jobs</div>
            ) : (
              jobsForDay.map((c) => (
                <div key={c.id} style={weekStyles.job}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    {c.address}
                  </div>
                  <div style={{ fontSize: 12 }}>
                    ${c.price}
                  </div>

                  <div style={{ marginTop: 5 }}>
                    <button onClick={() => toggleComplete(c)}>
                      {c.completed ? "Undo" : "Complete"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
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
    padding: 20,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, SF Pro Display, SF Pro Text, Inter, sans-serif",
    background: "#f5f5f7",
    minHeight: "100vh",
    maxWidth: 920,
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
    fontSize: 24,
    fontWeight: 600,
    letterSpacing: -0.4,
  },

  tabs: {
    display: "flex",
    gap: 10,
    marginTop: 10,
    marginBottom: 18,
    flexWrap: "wrap",
  },

  tab: {
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    fontSize: 13,
    transition: "all 0.2s ease",
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
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  cardBox: {
    background: "rgba(255,255,255,0.9)",
    backdropFilter: "blur(12px)",
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
  },

  cardTitle: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 6,
  },

  cardValue: {
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: -0.3,
  },

  card: {
    background: "rgba(255,255,255,0.9)",
    backdropFilter: "blur(12px)",
    padding: 16,
    borderRadius: 20,
    border: "1px solid rgba(0,0,0,0.06)",
    marginTop: 16,
    boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
  },

  input: {
    width: "100%",
    padding: 12,
    marginBottom: 10,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.8)",
    fontSize: 14,
    outline: "none",
  },

  textarea: {
    width: "100%",
    height: 90,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.8)",
    fontSize: 14,
    outline: "none",
  },

  addBtn: {
    width: "100%",
    padding: 12,
    marginTop: 12,
    background: "#1d1d1f",
    color: "white",
    borderRadius: 14,
    border: "none",
    fontWeight: 500,
    cursor: "pointer",
  },

  serviceWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10,
  },

  serviceBtn: {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.1)",
    fontSize: 12,
    cursor: "pointer",
  },

  filters: {
    display: "flex",
    gap: 8,
    marginTop: 14,
    flexWrap: "wrap",
  },

  filter: {
    padding: "7px 12px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.7)",
    fontSize: 12,
    cursor: "pointer",
  },

  activeFilter: {
    padding: "7px 12px",
    borderRadius: 999,
    border: "1px solid #1d1d1f",
    background: "#1d1d1f",
    color: "white",
    fontSize: 12,
    cursor: "pointer",
  },

  item: {
    background: "rgba(255,255,255,0.9)",
    backdropFilter: "blur(12px)",
    padding: 14,
    marginTop: 10,
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.03)",
  },

  name: {
    fontWeight: 600,
    fontSize: 15,
  },

  sub: {
    opacity: 0.6,
    fontSize: 13,
    marginTop: 2,
  },

  price: {
    marginTop: 6,
    fontWeight: 600,
  },

  row: {
    display: "flex",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },
};
  
  const weekStyles: any = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 10,
    marginTop: 20,
  },

  day: {
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(0,0,0,0.06)",
    borderRadius: 16,
    padding: 10,
    minHeight: 220,
  },

  header: {
    fontWeight: 600,
    fontSize: 12,
    marginBottom: 10,
    opacity: 0.7,
  },

  job: {
    background: "#f5f5f7",
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
};