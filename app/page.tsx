"use client";

import MapView from "../components/MapView";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import InsightsTab from "./InsightsTab";

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
  time?: string;
  duration?: number;
  paid?: boolean;
  payment_method?: string;
  upsells?: string[];
};


/* ---------------- CONSTANTS ---------------- */
const HOME = { lat: 30.20320, lng: -97.85231 };
const SERVICES = ["Driveway", "Sidewalk", "Patio", "Trashcans"];
const FILTERS = ["all", "pending", "done"] as const;

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

function calcArrivalTimes(jobs: Customer[], startTime: string) {
  const toMins = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  const toTime = (mins: number) => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const fixed = jobs.filter((j) => j.time).sort((a, b) => toMins(a.time!) - toMins(b.time!));
  const flexible = jobs.filter((j) => !j.time);
  const schedule: { job: Customer; arrival: number; fixed: boolean }[] = [];

  for (const j of fixed) {
    schedule.push({ job: j, arrival: toMins(j.time!), fixed: true });
  }

  let cursor = toMins(startTime);
  for (const j of flexible) {
    for (const f of schedule.filter((s) => s.fixed)) {
      const fEnd = f.arrival + (f.job.duration || 60);
      if (cursor < fEnd && cursor + (j.duration || 60) > f.arrival) {
        cursor = fEnd;
      }
    }
    schedule.push({ job: j, arrival: cursor, fixed: false });
    cursor += j.duration || 60;
  }

  schedule.sort((a, b) => a.arrival - b.arrival);
  return schedule.map((s) => ({ id: s.job.id, arrival: toTime(s.arrival) }));
}

/* ---------------- PAGE ---------------- */
export default function Home() {
const [isMobile, setIsMobile] = useState(false);
const weekStyles: any = {
  grid: {
  display: "grid",
  gridTemplateColumns: isMobile ? "1fr" : "repeat(7, minmax(120px, 1fr))",
overflowX: "auto",
  gap: 8,
  },
  day: { background: "#fff", padding: 10, borderRadius: 10, minHeight: 180 },
  header: { fontSize: 12, fontWeight: 600, marginBottom: 8 },
  job: { background: "#f5f5f5", padding: 6, borderRadius: 8, marginBottom: 6 },
};

  

useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 768);
  check();
  window.addEventListener("resize", check);
  return () => window.removeEventListener("resize", check);
}, []);
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");


useEffect(() => {
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };

  checkMobile();

  window.addEventListener("resize", checkMobile);

  return () => {
    window.removeEventListener("resize", checkMobile);
  };
}, []);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
const [tab, setTab] = useState<"dashboard" | "jobs" | "map" | "calendar" | "insights">("dashboard");  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobFilter, setJobFilter] = useState<"all" | "pending" | "done">("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [dayStartTime, setDayStartTime] = useState<string>("08:00");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    price: "",
    date: "",
    notes: "",
    services: [] as string[],
  });

  const todayKey = getDateKey(new Date());

  /* ---------------- LOAD ---------------- */
  const loadCustomers = useCallback(async () => {
    const { data, error } = await supabase.from("customers").select("*");
    if (error) { console.log(error); return; }
    setCustomers(data || []);
  }, []);
  async function updateCustomer(id: string, fields: Partial<Customer>) {
  await supabase.from("customers").update(fields).eq("id", id);
  const { data: all } = await supabase.from("customers").select("*");
  if (all) setCustomers(all);
  const updated = all?.find((c) => c.id === id);
  if (updated) setSelectedCustomer(updated);
}

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  /* ---------------- GEO ---------------- */
  const geocodeAddress = useCallback(async (address: string) => {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    );
    const data = await res.json();
    if (!data.results?.length) return null;
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  }, []);

  /* ---------------- ADD ---------------- */
  async function addCustomer() {
    if (!form.name || !form.address) return;
    try {
      const coords = await geocodeAddress(form.address);
      const upsells = form.services.filter((s) => s !== "Driveway");

const { error } = await supabase.from("customers").insert([{
  name: form.name,
  phone: form.phone,
  address: form.address,
  price: Number(form.price || 0),
  date: form.date,
  completed: false,
  services: form.services,
  notes: form.notes,
  upsells,
  lat: coords?.lat ?? null,
  lng: coords?.lng ?? null,
}]);
      if (error) { alert(error.message); return; }
      loadCustomers();
      setForm({ name: "", phone: "", address: "", price: "", date: "", notes: "", services: [] });
    } catch (err) {
      console.log(err);
    }
  }

  /* ---------------- UPDATE ---------------- */
  const toggleComplete = useCallback(async (customer: Customer) => {
    const { error } = await supabase
      .from("customers")
      .update({ completed: !customer.completed })
      .eq("id", customer.id);
    if (error) return console.log(error);
    loadCustomers();
  }, [loadCustomers]);

  /* ---------------- DELETE ---------------- */
  const deleteCustomer = useCallback(async (id: string) => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return console.log(error);
    loadCustomers();
  }, [loadCustomers]);

  /* ---------------- DRAG DROP ---------------- */
  const moveCustomerToDate = useCallback(async (customerId: string, newDate: string) => {
    const { error } = await supabase
      .from("customers")
      .update({ date: newDate })
      .eq("id", customerId);
    if (error) { console.log(error); return; }
    loadCustomers();
  }, [loadCustomers]);

  /* ---------------- DERIVED ---------------- */
  const todayJobs = useMemo(
    () => customers.filter((c) => c.date === todayKey),
    [customers, todayKey]
  );

  const routeJobs = useMemo(
    () => [...todayJobs].sort((a, b) =>
      Math.hypot((a.lat ?? 0) - HOME.lat, (a.lng ?? 0) - HOME.lng) -
      Math.hypot((b.lat ?? 0) - HOME.lat, (b.lng ?? 0) - HOME.lng)
    ),
    [todayJobs]
  );

  const arrivalTimes = useMemo(
    () => calcArrivalTimes(routeJobs, dayStartTime),
    [routeJobs, dayStartTime]
  );

  const sortedRouteJobs = useMemo(
    () => [...routeJobs].sort((a, b) => {
      const aTime = arrivalTimes.find(t => t.id === a.id)?.arrival || "99:99";
      const bTime = arrivalTimes.find(t => t.id === b.id)?.arrival || "99:99";
      return aTime.localeCompare(bTime);
    }),
    [routeJobs, arrivalTimes]
  );

  const revenue = useMemo(
  () => customers.filter((c) => c.completed && c.paid).reduce((sum, c) => sum + c.price, 0),
  [customers]
);

  const completed = useMemo(() => customers.filter((c) => c.completed).length, [customers]);
  const pending = useMemo(() => customers.length - completed, [customers, completed]);

  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day + weekOffset * 7 + i);
    return d;
  }), [weekOffset]);

  const monthDays = useMemo(() => Array.from({ length: 35 }).map((_, i) => {
    const d = new Date();
    d.setDate(1);
    const firstDayOfWeek = d.getDay();
    d.setDate(1 - firstDayOfWeek + i);
    return d;
  }), []);

  const calendarDays = useMemo(
    () => calendarView === "week" ? weekDays : monthDays,
    [calendarView, weekDays, monthDays]
  );

  const filteredCustomers = useMemo(() => customers.filter((c) => {
    if (jobFilter === "done") return c.completed;
    if (jobFilter === "pending") return !c.completed;
    return true;
  }), [customers, jobFilter]);

  /* ---------------- UI ---------------- */
  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>Strong Powerwashing</h2>
      </div>

      {/* TABS */}
      <div style={styles.tabs}>
        {["dashboard", "jobs", "map", "calendar", "insights"].map((t) => (
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
            <h3>Today's Jobs</h3>
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
                    <StatusBadge completed={c.completed} />
                    {c.paid !== undefined && (
  <span style={{
    fontSize: 10, padding: "2px 8px", borderRadius: 999,
    background: c.paid ? "#dcfce7" : "#fee2e2",
    color: c.paid ? "#166534" : "#991b1b",
  }}>
    {c.paid ? "PAID" : "UNPAID"}
  </span>
)}
                  </div>
                  <div style={styles.sub}>{c.address}</div>
                  {c.services?.length > 0 && (
                    <div style={{ fontSize: 12, opacity: 0.6 }}>Services: {c.services.join(", ")}</div>
                  )}
                  {c.notes && (
                    <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>Notes: {c.notes}</div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* ROUTE ORDER */}
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Route Order</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, opacity: 0.6 }}>Start time:</span>
                <input
                  type="time"
                  value={dayStartTime}
                  onChange={(e) => setDayStartTime(e.target.value)}
                  style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12 }}
                />
              </div>
            </div>
            {routeJobs.length === 0 ? (
              <p style={{ opacity: 0.5 }}>No route</p>
            ) : (
              sortedRouteJobs.map((c, i) => (
                <div key={c.id} style={styles.item}>
                  <div style={{ ...styles.name, display: "flex", alignItems: "center", gap: 8 }}>
                    {i + 1}. {c.name}
                    {c.time && (
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "#dbeafe", color: "#1e40af" }}>
                        FIXED {c.time}
                      </span>
                    )}
                  </div>
                  <div style={styles.sub}>{c.address}</div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    🕐 Arrival: {arrivalTimes.find(a => a.id === c.id)?.arrival || "--"}
                    {c.duration ? ` · ${c.duration} mins` : " · ~60 mins (default)"}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* METRICS */}
          {/* METRICS */}
            <div style={styles.grid}>
              <Card title="Today's Jobs" value={todayJobs.length} />
              <Card title="Completed" value={todayJobs.filter(c => c.completed).length} />
              <Card title="Pending" value={todayJobs.filter(c => !c.completed).length} />
              <Card title="Today's Revenue" value={`$${todayJobs.filter(c => c.completed && c.paid).reduce((sum, c) => sum + c.price, 0)}`} />            </div>
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
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              placeholder="Phone Number"
              style={styles.input}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
            />
            <input
              placeholder="Address"
              style={styles.input}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <input
              type="date"
              style={styles.input}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <input
              placeholder="Price"
              type="number"
              style={styles.input}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, opacity: 0.6 }}>Services</p>
              {SERVICES.map((service) => (
                <button
                  key={service}
                  onClick={() => setForm((prev) => ({
                    ...prev,
                    services: prev.services.includes(service)
                      ? prev.services.filter((s) => s !== service)
                      : [...prev.services, service],
                  }))}
                  style={{
                    marginRight: 8, marginBottom: 8, padding: "6px 10px",
                    borderRadius: 999, border: "1px solid #ddd",
                    background: form.services.includes(service) ? "#1d1d1f" : "#fff",
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
            <button style={styles.addBtn} onClick={addCustomer}>Add Job</button>
          </div>

          <div style={styles.filters}>
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setJobFilter(f)}
                style={jobFilter === f ? styles.activeFilter : styles.filter}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {filteredCustomers.map((c) => (
            <div key={c.id} style={styles.item}>
              <div style={{ ...styles.name, display: "flex", alignItems: "center", gap: 8 }}>
                {c.name}
                <StatusBadge completed={c.completed} />
              </div>
              <div style={styles.sub}>{c.address}</div>
              {c.services?.length > 0 && (
                <div style={{ fontSize: 12, opacity: 0.6 }}>Services: {c.services.join(", ")}</div>
              )}
              {c.notes && (
                <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>Notes: {c.notes}</div>
              )}
              <div style={styles.price}>${c.price}</div>
              <div style={styles.row}>
  <button
    onClick={() => toggleComplete(c)}
    style={{
      padding: "7px 14px",
      borderRadius: 999,
      border: "none",
      background: c.completed ? "#f3f4f6" : "#1d1d1f",
      color: c.completed ? "#111" : "#fff",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
    }}
  >
    {c.completed ? "↩ Undo" : "✓ Complete"}
  </button>
  <button
    onClick={() => deleteCustomer(c.id)}
    style={{
      padding: "7px 14px",
      borderRadius: 999,
      border: "1px solid #fecaca",
      background: "#fff5f5",
      color: "#dc2626",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
    }}
  >
    🗑 Delete
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>Weekly Calendar</h3>
                <p style={{ opacity: 0.55, marginTop: 4, fontSize: 13 }}>
                  Drag jobs between days to schedule your route
                </p>
              </div>
              <div style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "#f3f4f6", color: "#111" }}>
                Week {weekOffset === 0 ? "Current" : weekOffset > 0 ? `+${weekOffset}` : weekOffset}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => setWeekOffset((w) => w - 1)} style={calBtn}>← Previous</button>
              <button onClick={() => setWeekOffset(0)} style={calBtnPrimary}>Today</button>
              <button onClick={() => setWeekOffset((w) => w + 1)} style={calBtn}>Next →</button>
              <button
                onClick={() => setCalendarView(calendarView === "week" ? "month" : "week")}
                style={calendarView === "month" ? calBtnPrimary : calBtn}
              >
                {calendarView === "week" ? "Month View" : "Week View"}
              </button>
            </div>
          </div>

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
                    boxShadow: isToday ? "0 0 0 2px rgba(29,78,216,0.1)" : "0 1px 3px rgba(0,0,0,0.04)",
                    transition: "0.2s ease",
                  }}
                  onDragOver={(e) => { e.preventDefault(); setHoverDate(key); }}
                  onDragLeave={() => setHoverDate(null)}
                  onDrop={(e) => {
                    const customerId = e.dataTransfer.getData("customerId");
                    moveCustomerToDate(customerId, key);
                    setHoverDate(null);
                  }}
                >
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      {day.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.55 }}>
                      {day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, marginBottom: 8, opacity: 0.6 }}>
                    {jobs.length} job{jobs.length !== 1 ? "s" : ""}
                  </div>
                  {jobs.length === 0 ? (
                    <div style={{ fontSize: 12, opacity: 0.4 }}>No scheduled jobs</div>
                  ) : (
                    jobs.map((c) => (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("customerId", c.id)}
                        style={{ background: "#f8fafc", padding: 10, borderRadius: 10, marginBottom: 8, cursor: "grab", border: "1px solid #eef2f7" }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                        <div style={{ fontSize: 11, opacity: 0.6 }}>{c.address}</div>
                        {c.time && <div style={{ fontSize: 11, opacity: 0.6 }}>⏰ {c.time}</div>}
                        <div style={{ marginTop: 6, fontSize: 10, display: "inline-block", padding: "2px 8px", borderRadius: 999, background: c.completed ? "#dcfce7" : "#fef9c3", color: c.completed ? "#166534" : "#92400e" }}>
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

      {tab === "insights" && <InsightsTab customers={customers} />}

      {/* MAP */}
      {tab === "map" && <div
  style={{
    height: isMobile
      ? "calc(100vh - 120px)"
      : "75vh",
  }}
>
  <MapView
    customers={customers}
    refreshCustomers={loadCustomers}
  />
</div>}

      {/* CUSTOMER MODAL */}
      {selectedCustomer && (
        <div
          onClick={() => setSelectedCustomer(null)}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,}}
        >
        
          <div
            onClick={(e) => e.stopPropagation()}
          style={{
  background: "#ffffff",
  padding: isMobile ? 16 : 20,
  borderRadius: isMobile ? 0 : 18,
  width: isMobile ? "100%" : "90%",
  height: isMobile ? "100%" : "auto",
  maxWidth: 420,
  overflowY: "auto",
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, SF Pro Display, Inter, sans-serif",
}}
>
            <h2 style={{ marginBottom: 6 }}>{selectedCustomer.name}</h2>
            <StatusBadge completed={selectedCustomer.completed} large />
            <p style={{ opacity: 0.6, marginBottom: 10 }}>{selectedCustomer.address}</p>
            <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
              <div>📞 <strong>Phone:</strong> {selectedCustomer.phone || "No phone"}</div>
              <div>🧼 <strong>Service:</strong> {selectedCustomer.services?.length ? selectedCustomer.services.join(", ") : "No service selected"}</div>
              <div>💵 <strong>Price:</strong> ${selectedCustomer.price}</div>
              <button
  onClick={async () => {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: selectedCustomer.price,
      }),
    });

    const data = await res.json();
    window.location.href = data.url;
  }}
  style={{
    width: "100%",
    padding: "10px 12px",
    marginTop: 10,
    background: "#16a34a",
    color: "#fff",
    borderRadius: 10,
    border: "none",
    fontWeight: 600,
    cursor: "pointer",
  }}
>
  💳 Take Payment
</button>
              <div>📊 <strong>Status:</strong> {selectedCustomer.completed ? "Completed" : "Pending"}</div>
              <div style={{ marginTop: 12 }}>
  <strong>💰 Payment</strong>
  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
    <button
      onClick={async () => {
        await updateCustomer(selectedCustomer.id, { paid: true });
      }}
      style={{
        flex: 1,
        padding: "8px 0",
        borderRadius: 10,
        border: "none",
        background: selectedCustomer.paid ? "#16a34a" : "#f0fdf4",
        color: selectedCustomer.paid ? "#fff" : "#16a34a",
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer",
        transition: "0.15s ease",
      }}
    >
      ✓ Paid
    </button>
    <button
      onClick={async () => {
        await updateCustomer(selectedCustomer.id, { paid: false });
      }}
      style={{
        flex: 1,
        padding: "8px 0",
        borderRadius: 10,
        border: "none",
        background: !selectedCustomer.paid ? "#dc2626" : "#fef2f2",
        color: !selectedCustomer.paid ? "#fff" : "#dc2626",
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer",
        transition: "0.15s ease",
      }}
    >
      ✗ Unpaid
    </button>
  </div>
</div>

<div style={{ marginTop: 10 }}>
  <strong>💳 Payment Method:</strong>
  <select
    value={selectedCustomer.payment_method || ""}
    onChange={async (e) => {
  await updateCustomer(selectedCustomer.id, { payment_method: e.target.value });
}}
    style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}
  >
    <option value="">Not set</option>
    <option value="Cash">Cash</option>
    <option value="Venmo">Venmo</option>
    <option value="Card">Card</option>
  </select>
</div>

<div style={{ marginTop: 10 }}>
  <strong>⬆️ Upsells:</strong>
  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
    {["Driveway", "Sidewalk", "Patio", "Trashcans"].map((service) => {
      const active = selectedCustomer.upsells?.includes(service);
      return (
        <button
          key={service}
          onClick={async () => {
  const currentUpsells = selectedCustomer.upsells || [];
  const updatedUpsells = active
    ? currentUpsells.filter((s) => s !== service)
    : [...currentUpsells, service];
  
  // keep Driveway if it was in services, then add all upsells
  const baseServices = (selectedCustomer.services || []).filter(s => s === "Driveway");
  const updatedServices = [...new Set([...baseServices, ...updatedUpsells])];

  await updateCustomer(selectedCustomer.id, {
    upsells: updatedUpsells,
    services: updatedServices,
  });
}}
          style={{
            padding: "4px 10px", borderRadius: 999, fontSize: 12,
            border: "1px solid #ddd", cursor: "pointer",
            background: active ? "#1d1d1f" : "#fff",
            color: active ? "#fff" : "#000",
          }}
        >
          {service}
        </button>
      );
    })}
  </div>
</div>
              <div style={{ marginTop: 10 }}>
                <strong>⏰ Time:</strong>
                <input
                  type="time"
                  defaultValue={selectedCustomer.time || ""}
                  onChange={async (e) => {
  await updateCustomer(selectedCustomer.id, { time: e.target.value });
}}
                  style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 8, border: "1px solid #ddd" }}
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <strong>⏱ Duration (mins):</strong>
                <input
                  type="number"
                  defaultValue={selectedCustomer.duration || ""}
                  onChange={async (e) => {
  await updateCustomer(selectedCustomer.id, { duration: Number(e.target.value) });
}}
                  style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 8, border: "1px solid #ddd", width: 70 }}
                />
              </div>
            </div>
            <button
              onClick={async () => { await toggleComplete(selectedCustomer); setSelectedCustomer(null); }}
              style={{ width: "100%", padding: 12, marginTop: 14, borderRadius: 12, border: "none", background: selectedCustomer.completed ? "#999" : "#1d1d1f", color: "#fff", fontWeight: 600, cursor: "pointer" }}
            >
              {selectedCustomer.completed ? "Mark Incomplete" : "Mark Complete"}
            </button>
            <button
              onClick={() => setSelectedCustomer(null)}
              style={{ width: "100%", padding: 10, marginTop: 8, border: "1px solid #ccc", borderRadius: 10 }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/* ---------------- SMALL COMPONENTS ---------------- */
function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div style={styles.cardBox}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={styles.cardValue}>{value}</div>
    </div>
  );
}

function StatusBadge({ completed, large }: { completed: boolean; large?: boolean }) {
  return (
    <span style={{
      display: "inline-block",
      fontSize: large ? 12 : 10,
      padding: large ? "4px 10px" : "2px 8px",
      borderRadius: 999,
      marginTop: large ? 6 : 0,
      background: completed ? "#dcfce7" : "#fef9c3",
      color: completed ? "#166534" : "#92400e",
    }}>
      {completed ? (large ? "COMPLETED" : "DONE") : "PENDING"}
    </span>
  );
}

/* ---------------- STYLES ---------------- */
const styles: any = {
  page: {
    padding: "clamp(12px, 3vw, 24px)",
    background: "#f2f4f7",
    minHeight: "100vh",
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, SF Pro Text, Inter, sans-serif",
    color: "#1d1d1f",
    maxWidth: 980,
    margin: "0 auto",
  },
  header: { marginBottom: 18 },
  title: { fontSize: 26, fontWeight: 700 },

  tabs: {
  display: "flex",
  gap: 6,
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",

  position: "sticky",
  top: 0,
  zIndex: 10,

  padding: "12px 10px",
  marginBottom: 16,

  background: "rgba(255,255,255,0.6)",
  backdropFilter: "blur(14px)",
  border: "1px solid rgba(0,0,0,0.06)",
  borderRadius: 16,

  scrollbarWidth: "none",
  msOverflowStyle: "none",
},
  tab: {
  padding: "10px 14px",
  borderRadius: 999,
  fontSize: 13,
  cursor: "pointer",

  whiteSpace: "nowrap",
  flexShrink: 0,

  border: "1px solid rgba(0,0,0,0.06)",
  background: "rgba(255,255,255,0.7)",
  color: "#444",

  transition: "all 0.15s ease",
},
  activeTab: {
  padding: "10px 16px",
  borderRadius: 999,
  fontSize: 13,
  cursor: "pointer",

  whiteSpace: "nowrap",
  flexShrink: 0,

  border: "1px solid rgba(0,0,0,0.08)",
  background: "#1d1d1f",
  color: "#fff",

  boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
  transform: "scale(1.04)",

  transition: "all 0.15s ease",
},
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 },
  cardBox: { background: "#fff", borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.06)" },
  cardTitle: { fontSize: 12, opacity: 0.6, marginBottom: 6 },
  cardValue: { fontSize: 22, fontWeight: 600 },
  card: { background: "#fff", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.04)" },
  input: { width: "100%", padding: 12, marginBottom: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)" },
  addBtn: { width: "100%", padding: 12, background: "#1d1d1f", color: "#fff", borderRadius: 12, border: "none" },
  filters: { display: "flex", gap: 8, marginBottom: 12 },
  filter: { padding: "7px 12px", borderRadius: 999, background: "#f5f5f5", border: "1px solid rgba(0,0,0,0.06)", fontSize: 12, cursor: "pointer" },
  activeFilter: { padding: "7px 12px", borderRadius: 999, background: "#111", color: "#fff", fontSize: 12 },
  item: { background: "#fafafa", padding: "12px 14px", marginTop: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.05)" },
  name: { fontWeight: 600, fontSize: 15 },
  sub: { opacity: 0.6, fontSize: 13, marginTop: 2 },
  price: { marginTop: 6, fontWeight: 600 },
  row: {
  display: "flex",
  gap: 10,
  marginTop: 10,
  flexWrap: "wrap",
},
};

const calBtn = { padding: "6px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, cursor: "pointer" };
const calBtnPrimary = { padding: "6px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", fontSize: 12, cursor: "pointer" };


