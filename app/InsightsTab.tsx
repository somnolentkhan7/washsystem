"use client";

import { useMemo, useState, useEffect } from "react";import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid,
} from "recharts";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
  typeof window !== "undefined" ? window.innerWidth < breakpoint : false
);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);

    check();
    window.addEventListener("resize", check);

    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);

  return isMobile;
}

/* ---------------- TYPES ---------------- */
type Customer = {
  id: string;
  name: string;
  price: number;
  date: string;
  completed: boolean;
  services: string[];
  paid?: boolean;
  payment_method?: string;
  upsells?: string[];
};

/* ---------------- HELPERS ---------------- */
function getWeekKey(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  return sunday.toISOString().split("T")[0];
}

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMonthLabel(dateStr: string) {
  const [year, month] = dateStr.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/* ---------------- COMPONENT ---------------- */
export default function InsightsTab({ customers }: { customers: Customer[] }) {
    const isMobile = useIsMobile();
  const [revenueView, setRevenueView] = useState<"month" | "week">("month");

  const completed = useMemo(() => customers.filter((c) => c.completed && c.paid && c.date), [customers]);
  const unpaidRevenue = useMemo(
  () => completed.filter((c) => !c.paid).reduce((s, c) => s + c.price, 0),
  [completed]
);

const paymentMethods = useMemo(() => {
  const map: Record<string, number> = {};
  for (const c of completed) {
    const m = c.payment_method || "Not set";
    map[m] = (map[m] || 0) + 1;
  }
  return Object.entries(map).sort(([, a], [, b]) => b - a);
}, [completed]);

const upsellRate = useMemo(() => {
  const withUpsells = completed.filter((c) => c.upsells?.length).length;
  return completed.length ? Math.round((withUpsells / completed.length) * 100) : 0;
}, [completed]);

  /* --- Revenue by month --- */
  const revenueByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of completed) {
      const key = c.date.slice(0, 7); // "YYYY-MM"
      map[key] = (map[key] || 0) + c.price;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, revenue]) => ({ label: formatMonthLabel(key), revenue }));
  }, [completed]);

  /* --- Revenue by week --- */
  const revenueByWeek = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of completed) {
      const key = getWeekKey(c.date);
      map[key] = (map[key] || 0) + c.price;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, revenue]) => ({ label: `Wk ${formatWeekLabel(key)}`, revenue }));
  }, [completed]);

  const revenueData = revenueView === "month" ? revenueByMonth : revenueByWeek;

  /* --- Most popular services --- */
  const serviceData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of customers) {
      for (const s of c.services || []) {
        map[s] = (map[s] || 0) + 1;
      }
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([service, count]) => ({ service, count }));
  }, [customers]);

  /* --- Average job value over time (by month) --- */
  const avgJobValue = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const c of completed) {
      const key = c.date.slice(0, 7);
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += c.price;
      map[key].count += 1;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { total, count }]) => ({
        label: formatMonthLabel(key),
        avg: Math.round(total / count),
      }));
  }, [completed]);

  /* --- Best day --- */
  const bestDay = useMemo(() => {
    const map: Record<string, { revenue: number; jobs: number }> = {};
    for (const c of completed) {
      if (!map[c.date]) map[c.date] = { revenue: 0, jobs: 0 };
      map[c.date].revenue += c.price;
      map[c.date].jobs += 1;
    }
    const entries = Object.entries(map);
    if (!entries.length) return null;
    const [date, stats] = entries.sort(([, a], [, b]) => b.revenue - a.revenue)[0];
    return {
      date: new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      ...stats,
    };
  }, [completed]);

  /* --- Best week --- */
  const bestWeek = useMemo(() => {
    const map: Record<string, { revenue: number; jobs: number }> = {};
    for (const c of completed) {
      const key = getWeekKey(c.date);
      if (!map[key]) map[key] = { revenue: 0, jobs: 0 };
      map[key].revenue += c.price;
      map[key].jobs += 1;
    }
    const entries = Object.entries(map);
    if (!entries.length) return null;
    const [date, stats] = entries.sort(([, a], [, b]) => b.revenue - a.revenue)[0];
    return {
      weekOf: `Week of ${formatWeekLabel(date)}`,
      ...stats,
    };
  }, [completed]);

  /* --- Summary stats --- */
  const totalRevenue = useMemo(() => completed.reduce((s, c) => s + c.price, 0), [completed]);
  const avgValue = useMemo(() => completed.length ? Math.round(totalRevenue / completed.length) : 0, [completed, totalRevenue]);
const statRowStyle = {
  display: "grid",
  gridTemplateColumns: isMobile
    ? "1fr 1fr"
    : "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

  if (completed.length === 0) {
    return (
      <div style={s.empty}>
        <div style={s.emptyIcon}>📊</div>
        <div style={s.emptyTitle}>No data yet</div>
        <div style={s.emptySub}>Complete some jobs and insights will appear here.</div>
      </div>
    );
  }

  return (
    <div>
      {/* SUMMARY ROW */}
      <div style={statRowStyle}>
        <StatBox label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} />
        <StatBox label="Jobs Completed" value={completed.length} />
        <StatBox label="Avg Job Value" value={`$${avgValue}`} />
        <StatBox label="Unpaid Revenue" value={`$${unpaidRevenue}`} />
        <StatBox label="Upsell Rate" value={`${upsellRate}%`} />    
      </div>

      {/* BEST DAY / BEST WEEK */}
      <div style={statRowStyle}>
        <div style={s.highlightCard}>
          <div style={s.highlightLabel}>🏆 Best Day</div>
          {bestDay ? (
            <>
              <div style={s.highlightValue}>${bestDay.revenue.toLocaleString()}</div>
              <div style={s.highlightSub}>{bestDay.date}</div>
              <div style={s.highlightSub}>{bestDay.jobs} job{bestDay.jobs !== 1 ? "s" : ""}</div>
            </>
          ) : <div style={s.highlightSub}>No data</div>}
        </div>
        <div style={s.highlightCard}>
          <div style={s.highlightLabel}>📅 Best Week</div>
          {bestWeek ? (
            <>
              <div style={s.highlightValue}>${bestWeek.revenue.toLocaleString()}</div>
              <div style={s.highlightSub}>{bestWeek.weekOf}</div>
              <div style={s.highlightSub}>{bestWeek.jobs} job{bestWeek.jobs !== 1 ? "s" : ""}</div>
            </>
          ) : <div style={s.highlightSub}>No data</div>}
        </div>
      </div>

      {/* REVENUE CHART */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <h3 style={s.cardTitle}>Revenue</h3>
          <div style={s.toggle}>
            <button
              onClick={() => setRevenueView("month")}
              style={revenueView === "month" ? s.toggleActive : s.toggleBtn}
            >
              Monthly
            </button>
            <button
              onClick={() => setRevenueView("week")}
              style={revenueView === "week" ? s.toggleActive : s.toggleBtn}
            >
              Weekly
            </button>
          </div>
        </div>
        {revenueData.length < 2 ? (
          <div style={s.chartEmpty}>Not enough data yet — complete more jobs to see the chart.</div>
        ) : (
          <ResponsiveContainer
  width="100%"
  height={isMobile ? 180 : 220}
>
            <BarChart data={revenueData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => [`$${v}`, "Revenue"]} />
              <Bar dataKey="revenue" fill="#1d1d1f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* AVG JOB VALUE CHART */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <h3 style={s.cardTitle}>Average Job Value Over Time</h3>
        </div>
        {avgJobValue.length < 2 ? (
          <div style={s.chartEmpty}>Not enough data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
            <LineChart data={avgJobValue} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => [`$${v}`, "Avg Value"]} />
              <Line type="monotone" dataKey="avg" stroke="#1d1d1f" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* SERVICES BREAKDOWN */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <h3 style={s.cardTitle}>Most Popular Services</h3>
        </div>
        {serviceData.length === 0 ? (
          <div style={s.chartEmpty}>No services recorded yet.</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={isMobile ? 150 : 180}>
              <BarChart data={serviceData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="service" tick={{ fontSize: 12 }} width={70} />
                <Tooltip formatter={(v: number) => [v, "Jobs"]} />
                <Bar dataKey="count" fill="#1d1d1f" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={s.serviceList}>
              {serviceData.map((item, i) => (
                <div key={item.service} style={s.serviceRow}>
                  <div style={s.serviceRank}>#{i + 1}</div>
                  <div style={s.serviceName}>{item.service}</div>
                  <div style={s.serviceCount}>{item.count} job{item.count !== 1 ? "s" : ""}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div style={s.card}>
  <div style={s.cardHeader}>
    <h3 style={s.cardTitle}>Payment Methods</h3>
  </div>
  {paymentMethods.length === 0 ? (
    <div style={s.chartEmpty}>No payment data yet.</div>
  ) : (
    paymentMethods.map(([method, count]) => (
      <div key={method} style={s.serviceRow}>
        <div style={s.serviceName}>{method}</div>
        <div style={s.serviceCount}>{count} job{count !== 1 ? "s" : ""}</div>
      </div>
    ))
  )}
</div>
    </div>
  );
}

/* ---------------- STAT BOX ---------------- */
function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={s.statBox}>
      <div style={s.statLabel}>{label}</div>
      <div style={s.statValue}>{value}</div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */
const s: any = {
  empty: { textAlign: "center", padding: "60px 20px" },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 600, marginBottom: 6 },
  emptySub: { opacity: 0.5, fontSize: 14 },

  statBox: {
    background: "#fff",
    borderRadius: 14,
    padding: "14px 16px",
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  statLabel: { fontSize: 11, opacity: 0.55, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: 700 },

  highlightCard: {
    background: "#fff",
    borderRadius: 14,
    padding: "14px 16px",
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  highlightLabel: { fontSize: 12, fontWeight: 600, marginBottom: 6 },
  highlightValue: { fontSize: 26, fontWeight: 700, marginBottom: 2 },
  highlightSub: { fontSize: 12, opacity: 0.55 },

  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
    border: "1px solid rgba(0,0,0,0.04)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  cardTitle: { margin: 0, fontSize: 16, fontWeight: 600 },
  chartEmpty: { fontSize: 13, opacity: 0.45, padding: "20px 0" },

  toggle: { display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: 3 },
  toggleBtn: { padding: "4px 10px", borderRadius: 6, border: "none", background: "transparent", fontSize: 12, cursor: "pointer", opacity: 0.6 },
  toggleActive: { padding: "4px 10px", borderRadius: 6, border: "none", background: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },

  serviceList: { marginTop: 14, borderTop: "1px solid #f0f0f0", paddingTop: 12 },
  serviceRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #f9f9f9" },
  serviceRank: { fontSize: 11, fontWeight: 700, opacity: 0.4, width: 24 },
  serviceName: { flex: 1, fontSize: 13, fontWeight: 500 },
  serviceCount: { fontSize: 12, opacity: 0.55 },
};