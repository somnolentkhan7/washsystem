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

function formatPhone(value: string) {
  const cleaned = value.replace(/\D/g, "").slice(0, 10);

  const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);

  if (!match) return value;

  const [, area, first, second] = match;

  if (second) return `(${area}) ${first}-${second}`;
  if (first) return `(${area}) ${first}`;
  if (area) return `(${area}`;

  return value;
}

/* ---------------- PAGE ---------------- */
export default function Home() {
const [calendarView, setCalendarView] = useState<"week" | "month">("week");
const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [tab, setTab] = useState<
    "dashboard" | "jobs" | "map" | "calendar"
  >("dashboard");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const todayKey = getDateKey(new Date());

const todayJobs = customers.filter(
  (c) => c.date === todayKey
);

const HOME = { lat: 30.20320, lng: -97.85231 };
const routeJobs = [...todayJobs].sort((a, b) =>
  Math.hypot((a.lat ?? 0) - HOME.lat, (a.lng ?? 0) - HOME.lng) -
  Math.hypot((b.lat ?? 0) - HOME.lat, (b.lng ?? 0) - HOME.lng)
);

  const [jobFilter, setJobFilter] = useState<"all" | "pending" | "done">(
    "all"
  );

  const [weekOffset, setWeekOffset] = useState(0);

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

  function getPinColor(customer: Customer) {
  if (customer.completed) return "green";
  if (customer.date === getDateKey(new Date())) return "orange";
  return "red";
}

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


  /* ---------------- CALENDAR ---------------- */
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
  const d = new Date();
  const day = d.getDay();

  d.setDate(
    d.getDate() - day + weekOffset * 7 + i
  );

  return d;
});
const monthDays = Array.from({ length: 30 }).map((_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + weekOffset * 7 + i);
  return d;
});

  /* ---------------- METRICS ---------------- */
  const revenue = customers
    .filter((c) => c.completed)
    .reduce((sum, c) => sum + c.price, 0);

  const completed = customers.filter((c) => c.completed).length;
  const pending = customers.length - completed;
  const calendarDays = calendarView === "week" ? weekDays : monthDays;



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
  <div
    key={c.id}
    style={{ ...styles.item, cursor: "pointer" }}
    onClick={() => setSelectedCustomer(c)}
  >
            <div style={{ ...styles.name, display: "flex", alignItems: "center", gap: 8 }}>
  {c.name}

  <span
    style={{
      fontSize: 10,
      padding: "2px 8px",
      borderRadius: 999,
      background: c.completed ? "#dcfce7" : "#fef9c3",
      color: c.completed ? "#166534" : "#92400e",
    }}
  >
    {c.completed ? "DONE" : "PENDING"}
  </span>
</div>
            <div style={styles.sub}>{c.address}</div>
            {c.services?.length > 0 && (
  <div style={{ fontSize: 12, opacity: 0.6 }}>
    Services: {c.services.join(", ")}
  </div>
)}

{c.notes && (
  <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>
    Notes: {c.notes}
  </div>
)}
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
              placeholder="Phone Number"
              style={styles.input}
              value={form.phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone: formatPhone(e.target.value),
                })
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
          <textarea
  placeholder="Notes"
  style={styles.input}
  value={form.notes}
  onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                <div style={{ ...styles.name, display: "flex", alignItems: "center", gap: 8 }}>
  {c.name}

  <span
    style={{
      fontSize: 10,
      padding: "2px 8px",
      borderRadius: 999,
      background: c.completed ? "#dcfce7" : "#fef9c3",
      color: c.completed ? "#166534" : "#92400e",
    }}
  >
    {c.completed ? "DONE" : "PENDING"}
  </span>
</div>
                <div style={styles.sub}>{c.address}</div>
                {c.services?.length > 0 && (
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    Services: {c.services.join(", ")}
                  </div>
                )}

                {c.notes && (
                  <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>
                    Notes: {c.notes}
                  </div>
                )}
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
    {/* HEADER CARD */}
    <div style={styles.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 18 }}>Weekly Calendar</h3>
          <p style={{ opacity: 0.55, marginTop: 4, fontSize: 13 }}>
            Drag jobs between days to schedule your route
          </p>
        </div>

        <div
          style={{
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 999,
            background: "#f3f4f6",
            color: "#111",
          }}
        >
          Week{" "}
          {weekOffset === 0
            ? "Current"
            : weekOffset > 0
            ? `+${weekOffset}`
            : weekOffset}
        </div>
      </div>

      {/* NAV BUTTONS */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => setWeekOffset((w) => w - 1)} style={calBtn}>
          ← Previous
        </button>

        <button onClick={() => setWeekOffset(0)} style={calBtnPrimary}>
          Today
        </button>

        <button onClick={() => setWeekOffset((w) => w + 1)} style={calBtn}>
          Next →
        </button>
        <button
  onClick={() => setCalendarView(calendarView === "week" ? "month" : "week")}
  style={calendarView === "month" ? calBtnPrimary : calBtn}
>
  {calendarView === "week" ? "Month View" : "Week View"}
</button>
      </div>
    </div>

    {/* GRID */}
    <div style={weekStyles.grid}>
      {calendarDays.map((day, i) => {
        const key = getDateKey(day);
        const jobs = customers.filter((c) => c.date === key);
        const isToday = key === getDateKey(new Date());

        return (
          <div
            key={i}
            style={{
              ...weekStyles.day,
              background: hoverDate === key ? "#eef6ff" : "#fff",
              border: isToday ? "2px solid #1d4ed8" : "1px solid #eee",
              boxShadow: isToday
                ? "0 0 0 2px rgba(29,78,216,0.1)"
                : "0 1px 3px rgba(0,0,0,0.04)",
              transition: "0.2s ease",
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setHoverDate(key);
            }}
            onDragLeave={() => setHoverDate(null)}
            onDrop={(e) => {
              const customerId = e.dataTransfer.getData("customerId");
              moveCustomerToDate(customerId, key);
              setHoverDate(null);
            }}
          >
            {/* DAY HEADER */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </div>

              <div style={{ fontSize: 11, opacity: 0.55 }}>
                {day.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>

            {/* JOB COUNT */}
            <div
              style={{
                fontSize: 11,
                marginBottom: 8,
                opacity: 0.6,
              }}
            >
              {jobs.length} job{jobs.length !== 1 ? "s" : ""}
            </div>

            {/* JOBS */}
            {jobs.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.4 }}>
                No scheduled jobs
              </div>
            ) : (
              jobs.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("customerId", c.id);
                  }}
                  style={{
                    background: "#f8fafc",
                    padding: 10,
                    borderRadius: 10,
                    marginBottom: 8,
                    cursor: "grab",
                    border: "1px solid #eef2f7",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {c.name}
                  </div>

                  <div style={{ fontSize: 11, opacity: 0.6 }}>
                    {c.address}
                  </div>

                  {/* STATUS */}
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 10,
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: c.completed ? "#dcfce7" : "#fef9c3",
                      color: c.completed ? "#166534" : "#92400e",
                    }}
                  >
                    {c.completed ? "DONE" : "PENDING"}
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
      {tab === "map" && <MapView
  customers={customers}
  refreshCustomers={loadCustomers}
/>}
      {selectedCustomer && (
  <div
    onClick={() => setSelectedCustomer(null)}
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div
  onClick={(e) => e.stopPropagation()}
  style={{
    background: "#ffffff",
    padding: 20,
    borderRadius: 18,
    width: "90%",
    maxWidth: 420,
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, SF Pro Display, Inter, sans-serif",
  }}
>
      <h2 style={{ marginBottom: 6 }}>{selectedCustomer.name}</h2>
      <span
  style={{
    display: "inline-block",
    marginTop: 6,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    background: selectedCustomer.completed ? "#dcfce7" : "#fef9c3",
    color: selectedCustomer.completed ? "#166534" : "#92400e",
  }}
>
  {selectedCustomer.completed ? "COMPLETED" : "PENDING"}
</span>

<p style={{ opacity: 0.6, marginBottom: 10 }}>
  {selectedCustomer.address}
</p>

<div style={{ display: "grid", gap: 6, fontSize: 14 }}>
  <div>
    📞 <strong>Phone:</strong> {selectedCustomer.phone || "No phone"}
  </div>

  <div>
    🧼 <strong>Service:</strong>{" "}
    {selectedCustomer.services?.length
      ? selectedCustomer.services.join(", ")
      : "No service selected"}
  </div>

  <div>
    💵 <strong>Price:</strong> ${selectedCustomer.price}
  </div>

  <div>
    📊 <strong>Status:</strong>{" "}
    {selectedCustomer.completed ? "Completed" : "Pending"}
  </div>
</div>

      <button
  onClick={async () => {
    await toggleComplete(selectedCustomer);
    setSelectedCustomer(null);
  }}
  style={{
    width: "100%",
    padding: 12,
    marginTop: 14,
    borderRadius: 12,
    border: "none",
    background: selectedCustomer.completed ? "#999" : "#1d1d1f",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  }}
>
  {selectedCustomer.completed ? "Mark Incomplete" : "Mark Complete"}
</button>

      <button
        onClick={() => setSelectedCustomer(null)}
        style={{
          width: "100%",
          padding: 10,
          marginTop: 8,
          border: "1px solid #ccc",
          borderRadius: 10,
        }}
      >
        Close
      </button>
    </div>
  </div>
)}
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


/* ---------------- STYLES ---------------- */
const styles: any = {
  page: {
    padding: "clamp(12px, 3vw, 24px)",
    background: "#f2f4f7",
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
  borderRadius: 16,
  padding: 18,
  marginBottom: 16,
  boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
  border: "1px solid rgba(0,0,0,0.04)",
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
  background: "#f5f5f5",
  border: "1px solid rgba(0,0,0,0.06)",
  fontSize: 12,
  cursor: "pointer",
},

  activeFilter: {
  padding: "7px 12px",
  borderRadius: 999,
  background: "#111",
  color: "#fff",
  fontSize: 12,
},

  draggingItem: {
    opacity: 0.5,
    transform: "scale(0.98)",
  },

 item: {
  background: "#fafafa",
  padding: "12px 14px",
  marginTop: 10,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.05)",
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

  price: { marginTop: 6, fontWeight: 600 },

  row: { display: "flex", gap: 10, marginTop: 10 },
};

const calBtn = {
  padding: "6px 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontSize: 12,
  cursor: "pointer",
};

const calBtnPrimary = {
  padding: "6px 12px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontSize: 12,
  cursor: "pointer",
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