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

/* ---------------- HELPERS ---------------- */
const getDateKey = (date: Date) => date.toISOString().split("T")[0];

/* ---------------- PAGE ---------------- */
export default function Home() {
  const [tab, setTab] = useState<
    "dashboard" | "jobs" | "map" | "calendar"
  >("dashboard");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const todayKey = getDateKey(new Date());

const todayJobs = customers.filter(
  (c) => c.date === todayKey
);

const start = todayJobs[0];

const routeJobs = !start
  ? []
  : [...todayJobs].sort((a, b) => {
      const distA = Math.hypot(
        (a.lat ?? 0) - (start.lat ?? 0),
        (a.lng ?? 0) - (start.lng ?? 0)
      );

      const distB = Math.hypot(
        (b.lat ?? 0) - (start.lat ?? 0),
        (b.lng ?? 0) - (start.lng ?? 0)
      );

      return distA - distB;
    });

  const [jobFilter, setJobFilter] = useState<"all" | "pending" | "done">(
    "all"
  );

  const [weekOffset] = useState(0);

 const [hoverDate, setHoverDate] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    price: "",
    date: "",
    notes: "",
    services: [] as string[],
  });

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

    try {
      const coords = await geocodeAddress(form.address);

      const { error } = await supabase.from("customers").insert([
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
      console.log(err);
    }
  }

  /* ---------------- UPDATE ---------------- */
  async function toggleComplete(customer: Customer) {
    const { error } = await supabase
      .from("customers")
      .update({ completed: !customer.completed })
      .eq("id", customer.id);

    if (error) return console.log(error);

    loadCustomers();
  }

  /* ---------------- DELETE ---------------- */
  async function deleteCustomer(id: string) {
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) return console.log(error);

    loadCustomers();
  }

  /* ---------------- DRAG DROP ---------------- */
async function moveCustomerToDate(
  customerId: string,
  newDate: string
) {
  const { error } = await supabase
    .from("customers")
    .update({ date: newDate })
    .eq("id", customerId);

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

  /* ---------------- CALENDAR ---------------- */
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const start = new Date();
    const day = start.getDay();
    start.setDate(start.getDate() - day + weekOffset * 7 + i);
    return start;
  });

  /* ---------------- METRICS ---------------- */
  const revenue = customers
    .filter((c) => c.completed)
    .reduce((sum, c) => sum + c.price, 0);

  const completed = customers.filter((c) => c.completed).length;
  const pending = customers.length - completed;

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
  <>
    {/* TODAY JOBS */}
    <div style={styles.card}>
      <h3>Today’s Jobs</h3>

      {todayJobs.length === 0 ? (
        <p style={{ opacity: 0.5 }}>No jobs today</p>
      ) : (
        todayJobs.map((c) => (
          <div key={c.id} style={styles.item}>
            <div style={styles.name}>{c.name}</div>
            <div style={styles.sub}>{c.address}</div>
          </div>
        ))
      )}
    </div>

    {/* ROUTE ORDER */}
    <div style={styles.card}>
      <h3>Route Order</h3>

      {routeJobs.length === 0 ? (
        <p style={{ opacity: 0.5 }}>No route</p>
      ) : (
        routeJobs.map((c, i) => (
          <div key={c.id} style={styles.item}>
            <div style={styles.name}>
              {i + 1}. {c.name}
            </div>
            <div style={styles.sub}>{c.address}</div>
          </div>
        ))
      )}
    </div>

    {/* METRICS */}
    <div style={styles.grid}>
      <Card title="Total Jobs" value={customers.length} />
      <Card title="Completed" value={completed} />
      <Card title="Pending" value={pending} />
      <Card title="Revenue" value={`$${revenue}`} />
    </div>
  </>
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

            <div style={{ marginTop: 10 }}>
  <p style={{ fontSize: 12, opacity: 0.6 }}>Services</p>

  {["Driveway", "Sidewalk", "Patio", "Trashcans"].map((service) => (
    <button
      key={service}
      onClick={() => {
        setForm((prev) => ({
          ...prev,
          services: prev.services.includes(service)
            ? prev.services.filter((s) => s !== service)
            : [...prev.services, service],
        }));
      }}
      style={{
        marginRight: 8,
        marginBottom: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid #ddd",
        background: form.services.includes(service)
          ? "#1d1d1f"
          : "#fff",
        color: form.services.includes(service) ? "#fff" : "#000",
        fontSize: 12,
      }}
    >
      {service}
    </button>
  ))}
</div>

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
            <p style={{ opacity: 0.6 }}>Your weekly schedule</p>
          </div>

          <div style={weekStyles.grid}>
            {weekDays.map((day, i) => {
              const key = getDateKey(day);
              const jobs = customers.filter((c) => c.date === key);

              return (
                <div
                    key={i}
                    style={{
                      ...weekStyles.day,
                      background: hoverDate === key ? "#dbeafe" : "#fff",
                      transition: "0.2s ease",
                    }}
                    onDragOver={(e) => {
                      e.preventDefault(); // REQUIRED or drop won't work
                      setHoverDate(key);   // triggers blue highlight
                    }}
                    onDragLeave={() => setHoverDate(null)}
                    onDrop={(e) => {
                      const customerId = e.dataTransfer.getData("customerId");
                      moveCustomerToDate(customerId, key);
                      setHoverDate(null);
                    }}
                  >
                  <div style={weekStyles.header}>
                    {day.toDateString()}
                  </div>

                  {jobs.length === 0 ? (
                    <div style={{ opacity: 0.4 }}>No jobs</div>
                  ) : (
                    jobs.map((c) => (
                      <div
                          key={c.id}
                          style={{
                            ...weekStyles.job,
                            cursor: "grab",
                          }}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("customerId", c.id);
                          }}
                        >
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.6 }}>
                          {c.address}
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

const isMobile =
  typeof window !== "undefined" && window.innerWidth < 768;

/* ---------------- STYLES ---------------- */
const styles: any = {
  page: {
    padding: "clamp(12px, 3vw, 24px)",
    background: "#f4f4f6",
    minHeight: "100vh",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, SF Pro Display, SF Pro Text, Inter, sans-serif",
    color: "#1d1d1f",
    maxWidth: 980,
    margin: "0 auto",
  },

  header: { marginBottom: 18 },

  title: {
    fontSize: 26,
    fontWeight: 700,
  },

  tabs: {
  display: "flex",
  gap: 10,
  marginBottom: 18,
  flexWrap: "nowrap",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
},

  tab: {
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    fontSize: 13,
    cursor: "pointer",
  },

  activeTab: {
    padding: "8px 14px",
    borderRadius: 999,
    background: "#1d1d1f",
    color: "#fff",
    fontSize: 13,
    cursor: "pointer",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 14,
  },

  cardBox: {
    background: "#fff",
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(0,0,0,0.06)",
  },

  cardTitle: { fontSize: 12, opacity: 0.6, marginBottom: 6 },

  cardValue: { fontSize: 22, fontWeight: 600 },

  card: {
    background: "#fff",
    borderRadius: 18,
    padding: 18,
    border: "1px solid rgba(0,0,0,0.06)",
    marginBottom: 14,
  },

  input: {
    width: "100%",
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.08)",
  },

  addBtn: {
    width: "100%",
    padding: 12,
    background: "#1d1d1f",
    color: "#fff",
    borderRadius: 12,
    border: "none",
  },

  filters: { display: "flex", gap: 8, marginBottom: 12 },

  filter: {
    padding: "7px 12px",
    borderRadius: 999,
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.08)",
    fontSize: 12,
  },

  activeFilter: {
    padding: "7px 12px",
    borderRadius: 999,
    background: "#1d1d1f",
    color: "#fff",
    fontSize: 12,
  },

  draggingItem: {
    opacity: 0.5,
    transform: "scale(0.98)",
  },

  item: {
    background: "#fff",
    padding: "14px 14px 16px",
    marginTop: 10,
    borderRadius: 14,
    touchAction: "manipulation",
  },

  name: { fontWeight: 600 },

  sub: { opacity: 0.6, fontSize: 13 },

  price: { marginTop: 6, fontWeight: 600 },

  row: { display: "flex", gap: 10, marginTop: 10 },
};

const weekStyles: any = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(120px, 1fr))",
    overflowX: "auto",
    gap: 8,
  },
  day: {
    background: "#fff",
    padding: 10,
    borderRadius: 10,
    minHeight: 180,
  },
  header: {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 8,
  },
  job: {
    background: "#f5f5f5",
    padding: 6,
    borderRadius: 8,
    marginBottom: 6,
  },
};