"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Customer = {
  id: string;
  name: string;
  price: number;
  completed: boolean;
  paid?: boolean;
  date?: string;
};

type WeekEntry = { label: string; amount: number; goal: number };

const GOAL = 20000;
const SUMMER_START = new Date(2026, 5, 21); // June = 5 (0-indexed)

const WEEKLY_GOALS = [
  1200, // week 1
  1400, // week 2
  1700, // week 3
  2000, // week 4
  2300, // week 5
  2600, // week 6
  2900, // week 7
  3200, // week 8
  3700, // week 9
];

function getCurrentWeekIndex(): number {
  const now = new Date();
  const ms = now.getTime() - SUMMER_START.getTime();
  const weeks = Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(weeks, WEEKLY_GOALS.length - 1));
}

function getWeekLabel(weekIndex: number): string {
  const start = new Date(SUMMER_START);
  start.setDate(start.getDate() + weekIndex * 7);
  return start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function weeksLeft(): number {
  const END_DATE = new Date("2026-08-22");
  const ms = END_DATE.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)));
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 16,
  marginBottom: 16,
  boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
  border: "1px solid rgba(0,0,0,0.04)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 10,
  marginTop: 0,
};

const kpiBox: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
};

const kpiLabel: React.CSSProperties = { fontSize: 11, opacity: 0.6, marginBottom: 4 };
const kpiValue: React.CSSProperties = { fontSize: 20, fontWeight: 700 };

const track: React.CSSProperties = {
  height: 10,
  background: "#e5e7eb",
  borderRadius: 999,
  overflow: "hidden",
};

// ── Today Schedule ──────────────────────────────────────────
function TodayStrip() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const h = now.getHours();
  const mins = h * 60 + now.getMinutes();
  const pct = Math.min(100, Math.max(0, ((mins - 9 * 60) / (11 * 60)) * 100));

  const dow = now.toLocaleDateString("en-US", { weekday: "long" });
  const isWeekend = dow === "Saturday" || dow === "Sunday";

  const blocks = isWeekend
    ? [{ time: "9 AM – 4 PM", label: "Production day", startH: 9, endH: 16, color: "#22c55e" }]
    : [
        { time: "9 AM – 1 PM", label: "Pressure washing jobs", startH: 9, endH: 13, color: "#2563eb" },
        { time: "1 PM – 3:30 PM", label: "Lunch, shower & Gym", startH: 13, endH: 15.5, color: "#f59e0b" },
        { time: "4 PM – 8 PM", label: "Door-to-door sales", startH: 16, endH: 20, color: "#8b5cf6" },
      ];

  const fmt12 = (hh: number, mm: number) => {
    const ampm = hh >= 12 ? "PM" : "AM";
    const h12 = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh;
    return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
  };

  return (
    <div style={card}>
      <h3 style={sectionTitle}>
        📅 {now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
      </h3>

      {blocks.map((b) => {
        const active = h >= b.startH && h < b.endH;
        const done = h >= b.endH;
        return (
          <div
            key={b.time}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 12,
              background: active ? "#dbeafe" : "#fff",
              border: active ? "2px solid #2563eb" : "1px solid #ececec",
              marginBottom: 8,
              opacity: done && !active ? 0.45 : 1,
              boxShadow: active ? "0 0 0 3px rgba(37,99,235,0.15)" : "none",
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{b.time}</div>
              <div style={{ fontSize: 13, opacity: 0.65 }}>{b.label}</div>
            </div>
            {active && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", padding: "3px 9px", borderRadius: 999 }}>
                NOW
              </span>
            )}
            {done && !active && <span style={{ fontSize: 11, color: "#9ca3af" }}>done</span>}
          </div>
        );
      })}

      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.6, marginBottom: 5 }}>
          <span>9 AM</span>
          <span style={{ fontWeight: 600, opacity: 1, color: "#1d1d1f" }}>{fmt12(h, now.getMinutes())}</span>
          <span>8 PM</span>
        </div>
        <div style={track}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #2563eb, #60a5fa)", transition: "width 0.5s linear" }} />
        </div>
      </div>
    </div>
  );
}

// ── Goal Progress ───────────────────────────────────────────
function GoalProgress({ customers }: { customers: Customer[] }) {
  const earned = customers
    .filter((c) => c.completed && c.paid)
    .reduce((sum, c) => sum + (c.price || 0), 0);

  const needed = Math.max(0, GOAL - earned);
  const pct = Math.min(100, Math.round((earned / GOAL) * 100));
  const wks = weeksLeft();
  const currentWeek = getCurrentWeekIndex();
  const thisWeekGoal = WEEKLY_GOALS[currentWeek] ?? 0;
  const paidJobCount = customers.filter((c) => c.completed && c.paid).length;

  // Revenue earned this calendar week (Sun–Sat)
  const todayDate = new Date();
  const weekStart = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() - todayDate.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const thisWeekEarned = customers
    .filter((c) => {
      if (!c.completed || !c.paid || !c.date) return false;
      const d = new Date(c.date + "T00:00:00");
      return d >= weekStart && d < weekEnd;
    })
    .reduce((sum, c) => sum + (c.price || 0), 0);

  const weekPct = Math.min(100, Math.round((thisWeekEarned / thisWeekGoal) * 100));
  const weekStatus = thisWeekEarned >= thisWeekGoal ? "on track" : `$${(thisWeekGoal - thisWeekEarned).toLocaleString()} to go`;

  // Build weekly entries from customer data
  const weeklyTotals: Record<number, number> = {};
  customers
    .filter((c) => c.completed && c.paid && c.date)
    .forEach((c) => {
      const d = new Date(c.date + "T00:00:00");
      const msFromStart = d.getTime() - SUMMER_START.getTime();
      const weekIdx = Math.floor(msFromStart / (7 * 24 * 60 * 60 * 1000));
      if (weekIdx >= 0 && weekIdx < WEEKLY_GOALS.length) {
        weeklyTotals[weekIdx] = (weeklyTotals[weekIdx] || 0) + (c.price || 0);
      }
    });

  const weekEntries: WeekEntry[] = WEEKLY_GOALS.map((goal, i) => ({
    label: `Wk ${i + 1}\n${getWeekLabel(i)}`,
    amount: weeklyTotals[i] || 0,
    goal,
  }));

  return (
    <>
      {/* Overall goal card */}
      <div style={{ ...card, padding: 16 }}>
        <h3 style={sectionTitle}>🎯 Summer Goal — $20,000</h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
          <div style={kpiBox}>
            <div style={kpiLabel}>Earned</div>
            <div style={kpiValue}>${earned.toLocaleString()}</div>
          </div>
          <div style={kpiBox}>
            <div style={kpiLabel}>Still needed</div>
            <div style={kpiValue}>${needed.toLocaleString()}</div>
          </div>
          <div style={kpiBox}>
            <div style={kpiLabel}>{wks} wks left</div>
            <div style={{ ...kpiValue, fontSize: 16 }}>{pct}% done</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.6, marginBottom: 6 }}>
          <span>Progress to $20k</span>
          <span style={{ fontWeight: 700, opacity: 1 }}>{pct}%</span>
        </div>
        <div style={{ ...track, height: 14, marginBottom: 6 }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: pct >= 100 ? "#22c55e" : "linear-gradient(90deg, #2563eb, #60a5fa)", transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.45, marginBottom: 12 }}>
          {["$0", "$5k", "$10k", "$15k", "$20k"].map((l) => <span key={l}>{l}</span>)}
        </div>

        <div style={{ fontSize: 12, opacity: 0.55, padding: "8px 10px", background: "#f8fafc", borderRadius: 8, border: "1px solid rgba(0,0,0,0.04)" }}>
          Auto-calculated from {paidJobCount} paid & completed job{paidJobCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* This week card */}
      <div style={card}>
        <h3 style={sectionTitle}>⚡ Week {currentWeek + 1} — This Week</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div style={kpiBox}>
            <div style={kpiLabel}>Earned this week</div>
            <div style={kpiValue}>${thisWeekEarned.toLocaleString()}</div>
          </div>
          <div style={kpiBox}>
            <div style={kpiLabel}>Week {currentWeek + 1} goal</div>
            <div style={kpiValue}>${thisWeekGoal.toLocaleString()}</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.6, marginBottom: 6 }}>
          <span>Week progress</span>
          <span style={{ fontWeight: 700, opacity: 1, color: thisWeekEarned >= thisWeekGoal ? "#16a34a" : "#1d1d1f" }}>
            {weekPct}% · {weekStatus}
          </span>
        </div>
        <div style={{ ...track, height: 12 }}>
          <div style={{ width: `${weekPct}%`, height: "100%", borderRadius: 999, background: thisWeekEarned >= thisWeekGoal ? "#22c55e" : "linear-gradient(90deg, #2563eb, #60a5fa)", transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* Chart */}
      <RevenueChart entries={weekEntries} currentWeek={currentWeek} />

      {/* Ramp table */}
      <RampTable entries={weekEntries} currentWeek={currentWeek} />
    </>
  );
}

// ── Revenue Chart ───────────────────────────────────────────
function RevenueChart({ entries, currentWeek }: { entries: WeekEntry[]; currentWeek: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  const buildChart = useCallback(() => {
    if (!canvasRef.current || !(window as any).Chart) return;
    const ChartJS = (window as any).Chart;
    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new ChartJS(canvasRef.current, {
      type: "bar",
      data: {
        labels: entries.map((_, i) => `Wk ${i + 1}`),
        datasets: [
          {
            label: "Earned",
            data: entries.map((e) => e.amount),
            backgroundColor: entries.map((e, i) =>
              i < currentWeek
                ? e.amount >= e.goal ? "#22c55e" : "#ef4444"
                : i === currentWeek
                ? "#2563eb"
                : "#e5e7eb"
            ),
            borderRadius: 6,
            order: 2,
          },
          {
            label: "Goal",
            data: entries.map((e) => e.goal),
            type: "line",
            borderColor: "#f59e0b",
            backgroundColor: "transparent",
            borderWidth: 2,
            borderDash: [5, 3],
            pointRadius: 3,
            pointBackgroundColor: "#f59e0b",
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v: number) => "$" + v.toLocaleString() },
          },
        },
      },
    });
  }, [entries, currentWeek]);

  useEffect(() => {
    if (!(window as any).Chart) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
      s.onload = buildChart;
      document.head.appendChild(s);
    } else {
      buildChart();
    }
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [buildChart]);

  return (
    <div style={card}>
      <h3 style={sectionTitle}>📈 Revenue vs. Ramp Goal</h3>
      <div style={{ position: "relative", width: "100%", height: 200 }}>
        <canvas ref={canvasRef} role="img" aria-label="Weekly revenue bars vs goal ramp line" />
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, opacity: 0.6, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#2563eb", display: "inline-block" }} />Current week
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#22c55e", display: "inline-block" }} />Hit goal
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444", display: "inline-block" }} />Missed goal
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#f59e0b", display: "inline-block" }} />Goal ramp
        </span>
      </div>
    </div>
  );
}

// ── Ramp Table ──────────────────────────────────────────────
function RampTable({ entries, currentWeek }: { entries: WeekEntry[]; currentWeek: number }) {
  return (
    <div style={card}>
      <h3 style={sectionTitle}>🗓 9-Week Ramp Schedule</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
              <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, opacity: 0.5, fontSize: 11 }}>WEEK</th>
              <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, opacity: 0.5, fontSize: 11 }}>DATES</th>
              <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700, opacity: 0.5, fontSize: 11 }}>GOAL</th>
              <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700, opacity: 0.5, fontSize: 11 }}>EARNED</th>
              <th style={{ textAlign: "center", padding: "8px 10px", fontWeight: 700, opacity: 0.5, fontSize: 11 }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const isCurrent = i === currentWeek;
              const isPast = i < currentWeek;
              const hit = e.amount >= e.goal;
              const start = new Date(SUMMER_START);

// normalize to midnight so no timezone drift
start.setHours(0, 0, 0, 0);

// jump to correct week
start.setDate(start.getDate() + i * 7);

// ALWAYS compute Saturday from Sunday anchor
const end = new Date(start);
end.setDate(start.getDate() + 6);
              const dateStr =
                start.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
                " – " +
                end.toLocaleDateString("en-US", { month: "short", day: "numeric" });

              let statusBadge = null;
              if (isCurrent) {
                statusBadge = <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontWeight: 700 }}>NOW</span>;
              } else if (isPast) {
                statusBadge = hit
                  ? <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontWeight: 700 }}>✓ HIT</span>
                  : <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, background: "#fee2e2", color: "#991b1b", fontWeight: 700 }}>✗ MISS</span>;
              } else {
                statusBadge = <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, background: "#f3f4f6", color: "#6b7280", fontWeight: 600 }}>UPCOMING</span>;
              }

              return (
                <tr
                  key={i}
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    background: isCurrent ? "#f5f9ff" : "transparent",
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  <td style={{ padding: "10px 10px", fontSize: 13 }}>
                    {isCurrent && <span style={{ marginRight: 4 }}>→</span>}Week {i + 1}
                  </td>
                  <td style={{ padding: "10px 10px", fontSize: 12, opacity: 0.6 }}>{dateStr}</td>
                  <td style={{ padding: "10px 10px", textAlign: "right" }}>${e.goal.toLocaleString()}</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", color: isPast ? (hit ? "#16a34a" : "#dc2626") : isCurrent && e.amount > 0 ? "#2563eb" : "#9ca3af" }}>
                    {e.amount > 0 ? `$${e.amount.toLocaleString()}` : "—"}
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "center" }}>{statusBadge}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #f3f4f6", background: "#fafafa" }}>
              <td colSpan={2} style={{ padding: "10px 10px", fontWeight: 700, fontSize: 13 }}>Total</td>
              <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700 }}>$20,000</td>
              <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: "#2563eb" }}>
                ${entries.reduce((s, e) => s + e.amount, 0).toLocaleString()}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────
export default function ProductivityTab({ customers }: { customers: Customer[] }) {
  return (
    <div>
      <TodayStrip />
      <GoalProgress customers={customers} />
    </div>
  );
}