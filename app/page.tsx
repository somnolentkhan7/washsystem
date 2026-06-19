"use client";

import MapView from "../components/MapView";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
const HOME = { lat: 30.2032, lng: -97.85231 };
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
  if (area) return `(${area})`;
  return value;
}

function autoCapitalize(value: string) {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

function calcArrivalTimes(jobs: Customer[], startTime: string) {
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
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
  for (const j of fixed) schedule.push({ job: j, arrival: toMins(j.time!), fixed: true });
  let cursor = toMins(startTime);
  for (const j of flexible) {
    for (const f of schedule.filter((s) => s.fixed)) {
      const fEnd = f.arrival + (f.job.duration || 60);
      if (cursor < fEnd && cursor + (j.duration || 60) > f.arrival) cursor = fEnd;
    }
    schedule.push({ job: j, arrival: cursor, fixed: false });
    cursor += j.duration || 60;
  }
  schedule.sort((a, b) => a.arrival - b.arrival);
  return schedule.map((s) => ({ id: s.job.id, arrival: toTime(s.arrival) }));
}

/* ---------------- ADDRESS AUTOCOMPLETE HOOK ---------------- */
function useAddressAutocomplete(
  onChange: (val: string, lat?: number, lng?: number) => void
) 
{
  const [suggestions, setSuggestions] = useState<{ description: string; place_id: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 3) { setSuggestions([]); return; }
    try {
      const res = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(input)}`      );
      const data = await res.json();
      setSuggestions(data.predictions || []);
    } catch { setSuggestions([]); }
  }, []);

  const handleInput = useCallback((val: string) => {
    onChange(val);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 280);
  }, [onChange, fetchSuggestions]);

  const selectSuggestion = useCallback(async (description: string, placeId: string) => {
    setSuggestions([]);
    setShowSuggestions(false);
    try {
      const res = await fetch(
        `/api/places/geocode?place_id=${placeId}`
      );
      const data = await res.json();
      if (data.results?.[0]) {
        const { lat, lng } = data.results[0].geometry.location;
        onChange(description, lat, lng);
      } else {
        onChange(description);
      }
    } catch { onChange(description); }
  }, [onChange]);

  return { suggestions, showSuggestions, setShowSuggestions, handleInput, selectSuggestion };
}

/* -------- ADDRESS INPUT COMPONENT -------- */
function AddressInput({
  value,
  onAddressChange,
  style,
  placeholder = "Address",
}: {
  value: string;
  onAddressChange: (val: string, lat?: number, lng?: number) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  const [locating, setLocating] = useState(false);
  const { suggestions, showSuggestions, setShowSuggestions, handleInput, selectSuggestion } =
    useAddressAutocomplete(value, onAddressChange);

  const useMyLocation = async () => {
    if (!navigator.geolocation) return alert("Geolocation not supported");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const res = await fetch(`/api/places/geocode?latlng=${latitude},${longitude}`);
        const data = await res.json();
        if (data.results?.[0]) {
          const { lat, lng } = data.results[0].geometry.location;
          onAddressChange(data.results[0].formatted_address, lat, lng);
        }
      } catch {}
      setLocating(false);
    }, () => { setLocating(false); alert("Could not get location"); });
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          style={{ ...style, marginBottom: 0, flex: 1 }}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={useMyLocation}
          title="Use my location"
          style={{
            padding: "0 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)",
            background: "#fff", cursor: "pointer", fontSize: 16, flexShrink: 0,
            opacity: locating ? 0.5 : 1,
          }}
        >
          {locating ? "⏳" : "📍"}
        </button>
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)", overflow: "hidden", marginTop: 4,
        }}>
          {suggestions.map((s) => (
            <div
              key={s.place_id}
              onMouseDown={() => selectSuggestion(s.description, s.place_id)}
              style={{
                padding: "10px 14px", fontSize: 13, cursor: "pointer",
                borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "flex-start", gap: 8,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <span style={{ opacity: 0.4, flexShrink: 0, marginTop: 1 }}>📍</span>
              <span>{s.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductivityTab() {
  const [now, setNow] = useState(new Date());

  /* LIVE CLOCK */
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, []);

  const currentDay = now.toLocaleDateString("en-US", {
    weekday: "long",
  });

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  /* DAY PROGRESS (9am → 8pm) */
  const DAY_START = 9 * 60;
  const DAY_END = 20 * 60;

  const progress =
    Math.min(
      Math.max((currentMinutes - DAY_START) / (DAY_END - DAY_START), 0),
      1
    ) * 100;

  /* ACTIVE BLOCK LOGIC */
  const getCurrentBlock = () => {
    if (currentMinutes >= 9 * 60 && currentMinutes < 13 * 60) return "wash";
    if (currentMinutes >= 13 * 60 && currentMinutes < 15.5 * 60) return "reset";
    if (currentMinutes >= 16 * 60 && currentMinutes < 20 * 60) return "sales";
    return null;
  };

  const activeBlock = getCurrentBlock();

  /* MODE LABEL (ALWAYS VALID) */
  const productionIntensity =
    activeBlock === "wash"
      ? "HIGH OUTPUT MODE"
      : activeBlock === "sales"
      ? "REVENUE HUNT MODE"
      : activeBlock === "reset"
      ? "RECOVERY MODE"
      : "OFF-SEASON MODE";

  const weekSchedule = [
    {
      day: "Monday",
      blocks: [
        { time: "9:00 AM - 1:00 PM", task: "Pressure Washing Jobs", emoji: "🧼", key: "wash" },
        { time: "1:00 PM - 3:30 PM", task: "Lunch • Shower • Quotes", emoji: "🍽️", key: "reset" },
        { time: "4:00 PM - 8:00 PM", task: "Door-to-Door Sales", emoji: "🚪", key: "sales" },
      ],
    },
    {
      day: "Tuesday",
      blocks: [
        { time: "9:00 AM - 1:00 PM", task: "Pressure Washing Jobs", emoji: "🧼", key: "wash" },
        { time: "1:00 PM - 3:30 PM", task: "Lunch • Shower • Quotes", emoji: "🍽️", key: "reset" },
        { time: "4:00 PM - 8:00 PM", task: "Door-to-Door Sales", emoji: "🚪", key: "sales" },
      ],
    },
    {
      day: "Wednesday",
      blocks: [
        { time: "9:00 AM - 1:00 PM", task: "Pressure Washing Jobs", emoji: "🧼", key: "wash" },
        { time: "1:00 PM - 3:30 PM", task: "Lunch • Shower • Quotes", emoji: "🍽️", key: "reset" },
        { time: "4:00 PM - 8:00 PM", task: "Door-to-Door Sales", emoji: "🚪", key: "sales" },
      ],
    },
    {
      day: "Thursday",
      blocks: [
        { time: "9:00 AM - 1:00 PM", task: "Pressure Washing Jobs", emoji: "🧼", key: "wash" },
        { time: "1:00 PM - 3:30 PM", task: "Lunch • Shower • Quotes", emoji: "🍽️", key: "reset" },
        { time: "4:00 PM - 8:00 PM", task: "Door-to-Door Sales", emoji: "🚪", key: "sales" },
      ],
    },
    {
      day: "Friday",
      blocks: [
        { time: "9:00 AM - 4:00 PM", task: "Production Day", emoji: "💰", key: "wash" },
      ],
    },
    {
      day: "Saturday",
      blocks: [
        { time: "9:00 AM - 4:00 PM", task: "Production Day", emoji: "💰", key: "wash" },
      ],
    },
    {
      day: "Sunday",
      blocks: [
        { time: "ALL DAY", task: "Recovery / Reset", emoji: "🌴", key: "reset" },
      ],
    },
  ];

  return (
    <div style={styles.card}>
      <h2 style={{ marginTop: 0 }}>Weekly Game Plan</h2>

      {/* LIVE CLOCK */}
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        Current time: <strong>{now.toLocaleTimeString()}</strong>
      </div>

      {/* STATUS HEADER */}
      <div style={{ fontWeight: 600, marginTop: 6, marginBottom: 10 }}>
        {activeBlock
          ? `NOW: ${activeBlock.toUpperCase()} BLOCK`
          : "NOW: OFF BLOCK (SCHEDULE STILL ACTIVE)"}

        <div
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 14,
            background:
              activeBlock === "wash"
                ? "linear-gradient(135deg, #dbeafe, #eff6ff)"
                : activeBlock === "sales"
                ? "linear-gradient(135deg, #dcfce7, #f0fdf4)"
                : activeBlock === "reset"
                ? "linear-gradient(135deg, #f3f4f6, #ffffff)"
                : "linear-gradient(135deg, #f9fafb, #ffffff)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.6 }}>Mode</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {productionIntensity}
          </div>

          <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>
            {activeBlock === "wash" &&
              "Focus: high-ticket exterior surface cleaning + fast turnover"}
            {activeBlock === "sales" &&
              "Focus: closing deals, follow-ups, and upsells"}
            {activeBlock === "reset" &&
              "Recover energy, prep quotes, admin tasks"}
            {!activeBlock && "Plan your day — no active block right now"}
          </div>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div
        style={{
          position: "relative",
          height: 10,
          background: "#e5e7eb",
          borderRadius: 999,
          marginBottom: 18,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "linear-gradient(90deg, #2563eb, #60a5fa)",
            transition: "width 0.5s linear",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: `${progress}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#fff",
            border: "3px solid #2563eb",
            boxShadow: "0 0 10px rgba(37,99,235,0.6)",
            transition: "left 0.5s linear",
          }}
        />
      </div>

      {/* WEEKLY SCHEDULE (ALWAYS VISIBLE) */}
      <div style={{ display: "grid", gap: 14 }}>
        {weekSchedule.map((day) => {
          const isToday = day.day === currentDay;

          return (
            <div
              key={day.day}
              style={{
                background: isToday ? "#f5f9ff" : "#fafafa",
                border: isToday
                  ? "2px solid #2563eb"
                  : "1px solid rgba(0,0,0,0.05)",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                {day.day}
              </div>

              {day.blocks.map((block) => {
                const isActive = isToday && activeBlock === block.key;
                const isTodayBlock = isToday;

                return (
                  <div
                    key={block.time}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: isActive
                        ? "#dbeafe"
                        : isTodayBlock
                        ? "#f3f4f6"
                        : "#fff",
                      border: isActive
                        ? "2px solid #2563eb"
                        : "1px solid #ececec",
                      marginBottom: 8,
                      boxShadow: isActive
                        ? "0 0 0 3px rgba(37,99,235,0.15)"
                        : "none",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{block.emoji}</span>

                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {block.time}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.65 }}>
                        {block.task}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}


const jobCard: React.CSSProperties = {
  background: "#fff",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #eee",
  marginBottom: 10,
  cursor: "pointer",
};

/* ---------------- PAGE ---------------- */
export default function Home() {
const serviceOrder = ["Driveway", "Sidewalk", "Patio", "Trashcans"];
const saveRates = async () => {
  setRatesSaved(false);

  const { error } = await supabase.from("settings").upsert({
    id: "main",
    rates: rates,
  });

  if (error) {
    console.log(error);
    return;
  }

  setRatesSaved(true);
};
  
  const getRouteColor = (job: Customer) => {
  if (job.completed && job.paid) return "#dcfce7"; // green
  if (job.completed && !job.paid) return "#fef9c3"; // yellow
  return "#fafafa"; // normal
};
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [tab, setTab] = useState<"dashboard" | "customers" | "map" | "calendar" | "insights" | "productivity" | "rates">("dashboard");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobFilter, setJobFilter] = useState<"all" | "pending" | "done">("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [dayStartTime, setDayStartTime] = useState("09:00");
  const [ratesSaved, setRatesSaved] = useState(true);
  const [rates, setRates] = useState({
  Driveway: 40,
  Sidewalk: 20,
  Patio: 60,
  Trashcans: 15,
});
  const [form, setForm] = useState({
    name: "", phone: "", address: "", price: "", date: "", notes: "", services: [] as string[],
    lat: undefined as number | undefined, lng: undefined as number | undefined,
  });

  const todayKey = getDateKey(new Date());

  /* ---------------- LOAD ---------------- */
  const loadCustomers = useCallback(async () => {
    const { data, error } = await supabase.from("customers").select("*");
    if (error) { console.error(error); return; }
    setCustomers(data || []);
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  useEffect(() => {
  const loadRates = async () => {
    const { data } = await supabase
      .from("settings")
      .select("rates")
      .eq("id", "main")
      .single();

    if (data?.rates) {
      setRates(data.rates);
    }
  };

  loadRates();
}, []);

  /* ---------------- GEO ---------------- */
  const geocodeAddress = useCallback(async (address: string) => {
  const res = await fetch(`/api/places/geocode?address=${encodeURIComponent(address)}`);
  const data = await res.json();
  if (!data.results?.length) return null;
  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}, []);

  /* ---------------- UPDATE ---------------- */
  const updateCustomer = useCallback(async (id: string, fields: Partial<Customer>) => {
    await supabase.from("customers").update(fields).eq("id", id);
    const { data: all } = await supabase.from("customers").select("*");
    if (all) {
      setCustomers(all);
      const updated = all.find((c) => c.id === id);
      if (updated) setSelectedCustomer(updated);
    }
  }, []);

  /* ---------------- SAVE FULL EDIT ---------------- */
  const saveCustomerEdit = useCallback(async () => {
    if (!selectedCustomer) return;
    const fields: Partial<Customer> = {
      name: selectedCustomer.name,
      phone: selectedCustomer.phone,
      address: selectedCustomer.address,
      price: selectedCustomer.price,
      date: selectedCustomer.date,
      notes: selectedCustomer.notes,
      services: selectedCustomer.services,
    };
    const original = customers.find((c) => c.id === selectedCustomer.id);
    if (original?.address !== selectedCustomer.address) {
      const coords = selectedCustomer.lat
        ? { lat: selectedCustomer.lat, lng: selectedCustomer.lng! }
        : await geocodeAddress(selectedCustomer.address);
      if (coords) { fields.lat = coords.lat; fields.lng = coords.lng; }
    }
    await supabase.from("customers").update(fields).eq("id", selectedCustomer.id);
    await loadCustomers();
    setIsEditingCustomer(false);
  }, [selectedCustomer, customers, geocodeAddress, loadCustomers]);

  /* ---------------- ADD ---------------- */
  const calculatedPrice = form.services.reduce((sum, service) => {
  return sum + (rates[service as keyof typeof rates] || 0);
}, 0);

  async function addCustomer() {
    if (!form.name || !form.address) return;
    let lat = form.lat, lng = form.lng;
    if (!lat) {
      const coords = await geocodeAddress(form.address);
      lat = coords?.lat; lng = coords?.lng;
    }
    const upsells = form.services.filter((s) => s !== "Driveway");
    const { error } = await supabase.from("customers").insert([{
      name: form.name, phone: form.phone, address: form.address,
      price: Number(form.price || 0), date: form.date,
      completed: false, services: form.services, notes: form.notes, upsells,
      lat: lat ?? null, lng: lng ?? null,
    }]);
    if (error) { alert(error.message); return; }
    loadCustomers();
    setForm({ name: "", phone: "", address: "", price: "", date: "", notes: "", services: [], lat: undefined, lng: undefined });
  }

  /* ---------------- TOGGLE / DELETE ---------------- */
  const toggleComplete = useCallback(async (customer: Customer) => {
    await supabase.from("customers").update({ completed: !customer.completed }).eq("id", customer.id);
    loadCustomers();
  }, [loadCustomers]);

  const deleteCustomer = useCallback(async (id: string) => {
    await supabase.from("customers").delete().eq("id", id);
    loadCustomers();
  }, [loadCustomers]);

  /* ---------------- DRAG DROP ---------------- */
  const moveCustomerToDate = useCallback(async (customerId: string, newDate: string) => {
    await supabase.from("customers").update({ date: newDate }).eq("id", customerId);
    loadCustomers();
  }, [loadCustomers]);

  /* ---------------- DERIVED ---------------- */
  const todayJobs = useMemo(() => customers.filter((c) => c.date === todayKey), [customers, todayKey]);

  const routeJobs = useMemo(() =>
    [...todayJobs].sort((a, b) =>
      Math.hypot((a.lat ?? 0) - HOME.lat, (a.lng ?? 0) - HOME.lng) -
      Math.hypot((b.lat ?? 0) - HOME.lat, (b.lng ?? 0) - HOME.lng)
    ), [todayJobs]);

  const arrivalTimes = useMemo(() => calcArrivalTimes(routeJobs, dayStartTime), [routeJobs, dayStartTime]);

  const sortedRouteJobs = useMemo(() =>
    [...routeJobs].sort((a, b) => {
      const aTime = arrivalTimes.find((t) => t.id === a.id)?.arrival || "99:99";
      const bTime = arrivalTimes.find((t) => t.id === b.id)?.arrival || "99:99";
      return aTime.localeCompare(bTime);
    }), [routeJobs, arrivalTimes]);

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
    () => (calendarView === "week" ? weekDays : monthDays),
    [calendarView, weekDays, monthDays]
  );
  
  const filteredCustomers = useMemo(() => customers.filter((c) => {
    if (jobFilter === "done") return c.completed;
    if (jobFilter === "pending") return !c.completed;
    return true;
  }), [customers, jobFilter]);

const unscheduledCustomers = useMemo(() => {
  return [...customers]
    .filter((c) => !c.date)
    .sort((a, b) => {
      // Priority 1: highest price first
      const priceDiff = (b.price || 0) - (a.price || 0);
      if (priceDiff !== 0) return priceDiff;

      // Priority 2: newest first (optional fallback)
      return (b.id || "").localeCompare(a.id || "");
    });
}, [customers]);

  /* ---------------- MODAL STYLES ---------------- */
  const modalOverlayStyle: React.CSSProperties = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.45)", display: "flex",
    alignItems: isMobile ? "flex-end" : "center",
    justifyContent: "center", zIndex: 9999,
  };

  const modalStyle: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: isMobile ? "20px 20px 0 0" : 20,
    width: isMobile ? "100%" : "90%",
    maxWidth: 440,
    maxHeight: isMobile ? "92vh" : "90vh",
    overflowY: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Inter, sans-serif",
  };

  /* ---------------- UI ---------------- */
  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>Strong Powerwashing</h2>
      </div>

      {/* TABS */}
      <div style={styles.tabs}>
        {(["dashboard", "customers", "map", "calendar", "insights", "productivity", "rates"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={tab === t ? styles.activeTab : styles.tab}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === "dashboard" && (
  <>
    {/* ── TOP KPI STRIP ── */}
    <div style={{ ...styles.card, padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <div style={styles.kpiBox}>
          <div style={styles.kpiLabel}>Jobs</div>
          <div style={styles.kpiValue}>{todayJobs.length}</div>
        </div>

        <div style={styles.kpiBox}>
          <div style={styles.kpiLabel}>Completed</div>
          <div style={styles.kpiValue}>
            {todayJobs.filter((c) => c.completed).length}
          </div>
        </div>

        <div style={styles.kpiBox}>
          <div style={styles.kpiLabel}>Pending</div>
          <div style={styles.kpiValue}>
            {todayJobs.filter((c) => !c.completed).length}
          </div>
        </div>

        <div style={styles.kpiBox}>
  <div style={styles.kpiLabel}>Revenue</div>
  <div style={styles.kpiValue}>
    $
    {todayJobs
      .filter((c) => c.completed && c.paid)
      .reduce((sum, c) => sum + (c.price || 0), 0)}
  </div>
</div>
      </div>
    </div>

    {/* ── MAIN CONTENT GRID ── */}
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
      
      {/* ── LEFT: PRIORITY JOB QUEUE ── */}
      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>🔥 Today’s Job Queue</h3>

        {todayJobs.length === 0 ? (
          <p style={{ opacity: 0.5 }}>No jobs scheduled for today</p>
        ) : (
          todayJobs.map((c, idx) => {
            const urgency =
              c.completed ? "done" : c.time ? "scheduled" : "flex";

            return (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedCustomer(c);
                  setIsEditingCustomer(false);
                }}
                style={{
  ...styles.jobCard,
  borderLeft:
    urgency === "done"
      ? "4px solid #22c55e"
      : urgency === "scheduled"
      ? "4px solid #2563eb"
      : "4px solid #f59e0b",
  opacity: c.completed ? 0.6 : 1,
}}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 700 }}>
                    {idx + 1}. {c.name}
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <StatusBadge completed={c.completed} />
                    {c.paid !== undefined && (
                      <span
  style={{
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 600,
    background: c.paid ? "#dcfce7" : "#fee2e2",
    color: c.paid ? "#166534" : "#991b1b",
  }}
>
  {c.paid ? "PAID" : "UNPAID"}
</span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                  📍 {c.address}
                </div>

                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
                  {c.services?.length ? `🧼 ${c.services.join(", ")}` : null}
                  {c.notes ? ` • 📝 ${c.notes}` : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── RIGHT: ROUTE ITINERARY ── */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h3 style={styles.sectionTitle}>🧭 Route Plan</h3>

          <input
            type="time"
            value={dayStartTime}
            onChange={(e) => setDayStartTime(e.target.value)}
            style={styles.timeInput}
          />
        </div>

        {sortedRouteJobs.length === 0 ? (
          <p style={{ opacity: 0.5 }}>No route planned</p>
        ) : (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {sortedRouteJobs.map((c, i) => (
              <div key={c.id} style={styles.jobCard}>
                <div style={{ fontWeight: 700 }}>
                  {i + 1}. {c.name}
                </div>

                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  📍 {c.address}
                </div>

                <div style={{ fontSize: 12, marginTop: 4, opacity: 0.6 }}>
                  🕐 {arrivalTimes.find((a) => a.id === c.id)?.arrival || "--"}
                  {c.duration ? ` • ${c.duration} min` : " • ~60 min"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </>
)}

      {/* ── CUSTOMERS ── */}
      {tab === "customers" && (
        <div>
          <div style={styles.card}>
            <h3>Add Customer</h3>
            <input
              placeholder="Name"
              style={styles.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: autoCapitalize(e.target.value) })}
            />
            <input
              placeholder="Phone Number"
              style={styles.input}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
            />
            <AddressInput
              value={form.address}
              onAddressChange={(val, lat, lng) => setForm({ ...form, address: val, lat, lng })}
              style={{ ...styles.input, marginBottom: 10 }}
            />
            <input type="date" style={styles.input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input placeholder="Price" type="number" style={styles.input} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, opacity: 0.6 }}>Services</p>
              {SERVICES.map((service) => (
                <button key={service}
                  onClick={() =>
  setForm((prev) => {
    const updatedServices = prev.services.includes(service)
      ? prev.services.filter((s) => s !== service)
      : [...prev.services, service];

    return {
      ...prev,
      services: updatedServices,
      price: updatedServices.reduce(
        (sum, s) => sum + (rates[s as keyof typeof rates] || 0),
        0
      ),
    };
  })
}
                  style={{ marginRight: 8, marginBottom: 8, padding: "6px 10px", borderRadius: 999, border: "1px solid #ddd", background: form.services.includes(service) ? "#1d1d1f" : "#fff", color: form.services.includes(service) ? "#fff" : "#000", fontSize: 12, cursor: "pointer" }}
                >
                  {service}
                </button>
              ))}
            </div>
            <textarea placeholder="Notes" style={styles.input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button style={styles.addBtn} onClick={addCustomer}>Add Customer</button>
          </div>

          <div style={styles.filters}>
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setJobFilter(f)} style={jobFilter === f ? styles.activeFilter : styles.filter}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {filteredCustomers.map((c) => (
            <div key={c.id} style={styles.item}>
              <div style={{ ...styles.name, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {c.name}
                <StatusBadge completed={c.completed} />
              </div>
              <div style={styles.sub}>{c.address}</div>
              {c.date && <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>📅 {c.date}</div>}
              {c.services?.length > 0 && <div style={{ fontSize: 12, opacity: 0.6 }}>Services: {c.services.join(", ")}</div>}
              {c.notes && <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>Notes: {c.notes}</div>}
              <div style={styles.price}>${c.price}</div>
              <div style={styles.row}>
                <button onClick={() => { setSelectedCustomer(c); setIsEditingCustomer(false); }} style={styles.btnEdit}>✏️ Edit</button>
                <button onClick={() => toggleComplete(c)} style={{ ...styles.btnAction, background: c.completed ? "#f3f4f6" : "#1d1d1f", color: c.completed ? "#111" : "#fff" }}>
                  {c.completed ? "↩ Undo" : "✓ Complete"}
                </button>
                <button onClick={() => deleteCustomer(c.id)} style={styles.btnDelete}>🗑 Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CALENDAR ── */}
      {tab === "calendar" && (
        <div>
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>
                  {calendarView === "week" ? "Weekly Calendar" : "Monthly Calendar"}
                </h3>
                <p style={{ opacity: 0.55, marginTop: 4, fontSize: 13 }}>Drag jobs between days to reschedule</p>
              </div>
              <div style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "#f3f4f6", color: "#111" }}>
                Week {weekOffset === 0 ? "Current" : weekOffset > 0 ? `+${weekOffset}` : weekOffset}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => setWeekOffset((w) => w - 1)} style={calBtn}>← Previous</button>
              <button onClick={() => setWeekOffset(0)} style={calBtnPrimary}>Today</button>
              <button onClick={() => setWeekOffset((w) => w + 1)} style={calBtn}>Next →</button>
              <button onClick={() => setCalendarView(calendarView === "week" ? "month" : "week")} style={calendarView === "month" ? calBtnPrimary : calBtn}>
                {calendarView === "week" ? "Month View" : "Week View"}
              </button>
            </div>
          </div>

          {/* UNSCHEDULED POOL */}
<div style={styles.card}>
  <h3 style={{ marginBottom: 8 }}>Unscheduled Customers</h3>
  <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>
    Drag these into a day to schedule them
  </p>

  {unscheduledCustomers.length === 0 ? (
    <div style={{ opacity: 0.5, fontSize: 13 }}>No unscheduled customers</div>
  ) : (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
      {unscheduledCustomers.map((c) => (
        <div
          key={c.id}
          draggable
          onDragStart={(e) => e.dataTransfer.setData("customerId", c.id)}
          style={{
            minWidth: 180,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 10,
            cursor: "grab",
          }}
        >
          <div style={{ fontWeight: 600 }}>{c.name}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>{c.address}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>${c.price}</div>
        </div>
      ))}
    </div>
  )}
</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(7, minmax(120px, 1fr))", overflowX: "auto", gap: 8 }}>
            {calendarDays.map((day, i) => {
              const key = getDateKey(day);
              const jobs = customers.filter((c) => c.date === key);
              const isToday = key === getDateKey(new Date());
              return (
                <div key={i}
                  style={{ background: hoverDate === key ? "#eef6ff" : "#fff", padding: 10, borderRadius: 10, minHeight: 180, border: isToday ? "2px solid #1d4ed8" : "1px solid #eee", boxShadow: isToday ? "0 0 0 2px rgba(29,78,216,0.1)" : "0 1px 3px rgba(0,0,0,0.04)", transition: "0.2s ease" }}
                  onDragOver={(e) => { e.preventDefault(); setHoverDate(key); }}
                  onDragLeave={() => setHoverDate(null)}
                  onDrop={(e) => { moveCustomerToDate(e.dataTransfer.getData("customerId"), key); setHoverDate(null); }}
                >
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
                    <div style={{ fontSize: 11, opacity: 0.55 }}>{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                  </div>
                  <div style={{ fontSize: 11, marginBottom: 8, opacity: 0.6 }}>{jobs.length} job{jobs.length !== 1 ? "s" : ""}</div>
                  {jobs.length === 0 ? (
                    <div style={{ fontSize: 12, opacity: 0.4 }}>No jobs</div>
                  ) : jobs.map((c) => (
                    <div key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("customerId", c.id)}
                      style={{ background: "#f8fafc", padding: 10, borderRadius: 10, marginBottom: 8, cursor: "grab", border: "1px solid #eef2f7" }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                      <div style={{ fontSize: 11, opacity: 0.6 }}>{c.address}</div>
                      {c.time && <div style={{ fontSize: 11, opacity: 0.6 }}>⏰ {c.time}</div>}
                      <div style={{ marginTop: 6, fontSize: 10, display: "inline-block", padding: "2px 8px", borderRadius: 999, background: c.completed ? "#dcfce7" : "#fef9c3", color: c.completed ? "#166534" : "#92400e" }}>
                        {c.completed ? "DONE" : "PENDING"}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "insights" && <InsightsTab customers={customers} />}

      {tab === "productivity" && <ProductivityTab />}

      {tab === "rates" && (
  <div style={styles.card}>
    <h3>Set Your Service Rates</h3>
    <div style={{ fontSize: 12, marginBottom: 10 }}>
  {ratesSaved ? "Saved ✓" : "Saving..."}
</div>

    {serviceOrder.map((service) => (
      <div key={service} style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{service}</div>

        <input
          type="number"
          value={rates[service as keyof typeof rates]}
          onChange={(e) => {
  const updated = {
    ...rates,
    [service]: Number(e.target.value),
  };

  setRates(updated);
}}
          style={styles.input}
        />
      </div>
    ))}
    <button
  onClick={saveRates}
  style={{
    marginTop: 15,
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "none",
    background: "#1d1d1f",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  }}
>
  Update Rates
</button>
  </div>
)}

      {tab === "map" && (
        <div style={{ height: isMobile ? "calc(100vh - 120px)" : "75vh" }}>
          <MapView customers={customers} refreshCustomers={loadCustomers} />
        </div>
      )}

      {/* ── CUSTOMER MODAL ── */}
      {selectedCustomer && (
        <div onClick={() => { setSelectedCustomer(null); setIsEditingCustomer(false); }} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalStyle}>

            {isEditingCustomer ? (
              /* ══ EDIT MODE ══ */
              <div style={{ padding: isMobile ? 20 : 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Edit Job</h3>
                  <button onClick={() => setIsEditingCustomer(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", opacity: 0.4, padding: 4 }}>✕</button>
                </div>

                <div style={{ display: "grid", gap: 14 }}>
                  <label style={styles.fieldLabel}>
                    Name
                    <input value={selectedCustomer.name}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, name: autoCapitalize(e.target.value) })}
                      style={styles.fieldInput} />
                  </label>
                  <label style={styles.fieldLabel}>
                    Phone
                    <input value={selectedCustomer.phone || ""}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, phone: formatPhone(e.target.value) })}
                      style={styles.fieldInput} placeholder="(555) 555-5555" />
                  </label>
                  <label style={styles.fieldLabel}>
                    Address
                    <AddressInput
                      value={selectedCustomer.address}
                      onAddressChange={(val, lat, lng) => setSelectedCustomer({ ...selectedCustomer, address: val, lat: lat ?? selectedCustomer.lat, lng: lng ?? selectedCustomer.lng })}
                      style={styles.fieldInput}
                    />
                  </label>
                  <div style={{ display: "flex", gap: 12 }}>
                    <label style={{ ...styles.fieldLabel, flex: 1 }}>
                      Date
                      <input type="date" value={selectedCustomer.date || ""}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, date: e.target.value })}
                        style={styles.fieldInput} />
                    </label>
                    <label style={{ ...styles.fieldLabel, flex: 1 }}>
                      Price ($)
                      <input type="number" value={selectedCustomer.price}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, price: Number(e.target.value) })}
                        style={styles.fieldInput} />
                    </label>
                  </div>
                  <label style={styles.fieldLabel}>
                    Notes
                    <textarea value={selectedCustomer.notes || ""}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, notes: e.target.value })}
                      rows={3} style={{ ...styles.fieldInput, resize: "vertical" }}
                      placeholder="Special instructions..." />
                  </label>
                  <div>
                    <div style={{ ...styles.fieldLabel, marginBottom: 8 }}>Services</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {SERVICES.map((service) => {
                        const active = selectedCustomer.services?.includes(service);
                        return (
                          <button key={service}
                            onClick={() => setSelectedCustomer({
                              ...selectedCustomer,
                              services: active
                                ? selectedCustomer.services.filter((s) => s !== service)
                                : [...(selectedCustomer.services || []), service],
                            })}
                            style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, border: "1px solid #ddd", cursor: "pointer", background: active ? "#1d1d1f" : "#fff", color: active ? "#fff" : "#000" }}>
                            {service}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <label style={{ ...styles.fieldLabel, flex: 1 }}>
                      Arrival Time
                      <input type="time" defaultValue={selectedCustomer.time || ""}
                        onChange={(e) => updateCustomer(selectedCustomer.id, { time: e.target.value })}
                        style={styles.fieldInput} />
                    </label>
                    <label style={{ ...styles.fieldLabel, flex: 1 }}>
                      Duration (mins)
                      <input type="number" defaultValue={selectedCustomer.duration || ""}
                        onChange={(e) => updateCustomer(selectedCustomer.id, { duration: Number(e.target.value) })}
                        style={styles.fieldInput} />
                    </label>
                  </div>
                </div>

                <button onClick={saveCustomerEdit}
                  style={{ width: "100%", padding: 13, marginTop: 20, borderRadius: 12, border: "none", background: "#1d1d1f", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 15 }}>
                  Save Changes
                </button>
                <button onClick={() => setIsEditingCustomer(false)}
                  style={{ width: "100%", padding: 10, marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 10, cursor: "pointer", background: "#fff", fontSize: 14 }}>
                  Cancel
                </button>
              </div>
            ) : (
              /* ══ VIEW MODE ══ */
              <>
                {/* Header strip */}
                <div style={{ padding: isMobile ? "20px 20px 16px" : "24px 24px 16px", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px" }}>{selectedCustomer.name}</h2>
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        <StatusBadge completed={selectedCustomer.completed} large />
                        {selectedCustomer.paid !== undefined && (
                          <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: selectedCustomer.paid ? "#dcfce7" : "#fee2e2", color: selectedCustomer.paid ? "#166534" : "#991b1b", fontWeight: 600 }}>
                            {selectedCustomer.paid ? "PAID" : "UNPAID"}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => { setSelectedCustomer(null); setIsEditingCustomer(false); }}
                      style={{ background: "#f3f4f6", border: "none", borderRadius: 999, width: 32, height: 32, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      ✕
                    </button>
                  </div>
                </div>

                {/* Info rows */}
                <div style={{ padding: isMobile ? "16px 20px" : "16px 24px", display: "grid", gap: 0 }}>
                  <InfoRow icon="📍" label="Address" value={selectedCustomer.address} />
                  <InfoRow icon="📞" label="Phone" value={selectedCustomer.phone || "—"} />
                  <InfoRow icon="📅" label="Date" value={selectedCustomer.date || "—"} />
                  <InfoRow icon="💵" label="Price" value={`$${selectedCustomer.price}`} />
                  {selectedCustomer.services?.length > 0 && (
                    <InfoRow icon="🧼" label="Services" value={selectedCustomer.services.join(", ")} />
                  )}
                  {selectedCustomer.time && (
                    <InfoRow icon="⏰" label="Arrival" value={selectedCustomer.time} />
                  )}
                  {selectedCustomer.duration && (
                    <InfoRow icon="⏱" label="Duration" value={`${selectedCustomer.duration} mins`} />
                  )}
                  {selectedCustomer.payment_method && (
                    <InfoRow icon="💳" label="Payment" value={selectedCustomer.payment_method} />
                  )}
                  {selectedCustomer.notes && (
                    <InfoRow icon="📝" label="Notes" value={selectedCustomer.notes} />
                  )}
                  {selectedCustomer.upsells && selectedCustomer.upsells.length > 0 && (
                    <InfoRow icon="⬆️" label="Upsells" value={selectedCustomer.upsells.join(", ")} />
                  )}
                </div>

                {/* Payment status section */}
                <div style={{ padding: isMobile ? "0 20px 16px" : "0 24px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", opacity: 0.45, textTransform: "uppercase", marginBottom: 8 }}>Payment Status</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => updateCustomer(selectedCustomer.id, { paid: true })}
                      style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: selectedCustomer.paid ? "#16a34a" : "#f0fdf4", color: selectedCustomer.paid ? "#fff" : "#16a34a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                      ✓ Paid
                    </button>
                    <button onClick={() => updateCustomer(selectedCustomer.id, { paid: false })}
                      style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: !selectedCustomer.paid ? "#dc2626" : "#fef2f2", color: !selectedCustomer.paid ? "#fff" : "#dc2626", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                      ✗ Unpaid
                    </button>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <select value={selectedCustomer.payment_method || ""}
                      onChange={(e) => updateCustomer(selectedCustomer.id, { payment_method: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, background: "#fafafa", color: "#1d1d1f" }}>
                      <option value="">Payment method…</option>
                      <option value="Cash">Cash</option>
                      <option value="Venmo">Venmo</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                </div>

                {/* Upsells */}
                <div style={{ padding: isMobile ? "0 20px 16px" : "0 24px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", opacity: 0.45, textTransform: "uppercase", marginBottom: 8 }}>Upsells</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {SERVICES.map((service) => {
                      const active = selectedCustomer.upsells?.includes(service);
                      return (
                        <button key={service}
                          onClick={async () => {
                            const currentUpsells = selectedCustomer.upsells || [];
                            const updatedUpsells = active
                              ? currentUpsells.filter((s) => s !== service)
                              : [...currentUpsells, service];
                            const baseServices = (selectedCustomer.services || []).filter((s) => s === "Driveway");
                            const updatedServices = [...new Set([...baseServices, ...updatedUpsells])];
                            await updateCustomer(selectedCustomer.id, { upsells: updatedUpsells, services: updatedServices });
                          }}
                          style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, border: "1px solid #ddd", cursor: "pointer", background: active ? "#1d1d1f" : "#fff", color: active ? "#fff" : "#000", transition: "0.1s ease" }}>
                          {service}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ padding: isMobile ? "0 20px 28px" : "0 24px 24px", display: "grid", gap: 8 }}>
                  <button onClick={() => setIsEditingCustomer(true)}
                    style={{ width: "100%", padding: 12, borderRadius: 12, border: "1.5px solid #e5e7eb", background: "#fff", color: "#1d1d1f", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
                    ✏️ Edit Details
                  </button>
                  <button onClick={async () => { await toggleComplete(selectedCustomer); setSelectedCustomer(null); }}
                    style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: selectedCustomer.completed ? "#6b7280" : "#1d1d1f", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
                    {selectedCustomer.completed ? "↩ Mark Incomplete" : "✓ Mark Complete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/* ---------------- SMALL COMPONENTS ---------------- */
function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.4px", opacity: 0.45, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 500, wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}

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
      display: "inline-block", fontSize: large ? 11 : 10,
      padding: large ? "4px 10px" : "2px 8px", borderRadius: 999,
      background: completed ? "#dcfce7" : "#fef9c3", color: completed ? "#166534" : "#92400e",
      fontWeight: 600,
    }}>
      {completed ? (large ? "COMPLETED" : "DONE") : "PENDING"}
    </span>
  );
}

/* ---------------- STYLES ---------------- */
const styles: any = {
jobCard: {
  background: "#fff",
  borderRadius: 14,
  padding: 12,
  border: "1px solid rgba(0,0,0,0.06)",
  marginBottom: 10,
  cursor: "pointer",
},

  timeInput: {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  fontSize: 12,
  background: "#fff",
},
  kpiBox: {
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
},

kpiLabel: {
  fontSize: 11,
  opacity: 0.6,
  marginBottom: 4,
},

kpiValue: {
  fontSize: 20,
  fontWeight: 700,
},
  page: {
    padding: "clamp(12px, 3vw, 24px)", background: "#f2f4f7", minHeight: "100vh",
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, SF Pro Text, Inter, sans-serif",
    color: "#1d1d1f", maxWidth: 980, margin: "0 auto",
  },
  header: { marginBottom: 18 },
  title: { fontSize: 26, fontWeight: 700 },
  tabs: {
    display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch",
    position: "sticky", top: 0, zIndex: 10, padding: "12px 10px", marginBottom: 16,
    background: "rgba(255,255,255,0.6)", backdropFilter: "blur(14px)",
    border: "1px solid rgba(0,0,0,0.06)", borderRadius: 16,
    scrollbarWidth: "none", msOverflowStyle: "none",
  },
  tab: {
    padding: "10px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer",
    whiteSpace: "nowrap", flexShrink: 0, border: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.7)", color: "#444", transition: "all 0.15s ease",
  },
  activeTab: {
    padding: "10px 16px", borderRadius: 999, fontSize: 13, cursor: "pointer",
    whiteSpace: "nowrap", flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)",
    background: "#1d1d1f", color: "#fff", boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
    transform: "scale(1.04)", transition: "all 0.15s ease",
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 },
  cardBox: { background: "#fff", borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.06)" },
  cardTitle: { fontSize: 12, opacity: 0.6, marginBottom: 6 },
  cardValue: { fontSize: 22, fontWeight: 600 },
  card: { background: "#fff", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.04)" },
  input: { width: "100%", padding: 12, marginBottom: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", boxSizing: "border-box", fontSize: 14 },
  addBtn: { width: "100%", padding: 12, background: "#1d1d1f", color: "#fff", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600 },
  filters: { display: "flex", gap: 8, marginBottom: 12 },
  filter: { padding: "7px 12px", borderRadius: 999, background: "#f5f5f5", border: "1px solid rgba(0,0,0,0.06)", fontSize: 12, cursor: "pointer" },
  activeFilter: { padding: "7px 12px", borderRadius: 999, background: "#111", color: "#fff", fontSize: 12, border: "none", cursor: "pointer" },
  item: { background: "#fafafa", padding: "12px 14px", marginTop: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.05)" },
  name: { fontWeight: 600, fontSize: 15 },
  sub: { opacity: 0.6, fontSize: 13, marginTop: 2 },
  price: { marginTop: 6, fontWeight: 600 },
  row: { display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" },
  btnEdit: { padding: "7px 14px", borderRadius: 999, border: "none", background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  btnAction: { padding: "7px 14px", borderRadius: 999, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  btnDelete: { padding: "7px 14px", borderRadius: 999, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  fieldLabel: { display: "flex", flexDirection: "column", gap: 5, fontWeight: 600, fontSize: 13, color: "#374151" },
  fieldInput: { padding: "9px 11px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, fontWeight: 400, width: "100%", boxSizing: "border-box", background: "#fafafa" },
  sectionTitle: {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 10,
},
};

const calBtn = { padding: "6px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, cursor: "pointer" };
const calBtnPrimary = { padding: "6px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", fontSize: 12, cursor: "pointer" };