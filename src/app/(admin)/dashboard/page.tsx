"use client";

import {
  ArrowRight,
  BarChart3,
  Calendar,
  Car,
  ChevronDown,
  CircleDollarSign,
  MoreHorizontal,
  Plus,
  RotateCw,
  Wallet,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/src/lib/utils";

// ─── Data ──────────────────────────────────────────────────────────────────────

const chartData = [
  { d: "1 Jul", v: 32 },
  { d: "2 Jul", v: 38 },
  { d: "3 Jul", v: 28 },
  { d: "4 Jul", v: 46 },
  { d: "5 Jul", v: 52 },
  { d: "6 Jul", v: 40 },
  { d: "7 Jul", v: 70 },
  { d: "8 Jul", v: 55 },
  { d: "9 Jul", v: 64 },
];

const kpis = [
  { icon: Wallet, label: "Total Income", value: "$632,000", delta: "+1.29%", up: true, cta: "View income details" },
  { icon: Car, label: "Total Expenses", value: "$420,000", delta: "-0.85%", up: false, cta: "View expense details" },
  { icon: BarChart3, label: "Net Profit", value: "$532,000", delta: "+1.29%", up: true, cta: "View profit details" },
  { icon: CircleDollarSign, label: "Cash Flow", value: "$150,000", delta: "-2.40%", up: false, cta: "View cashflow details" },
];

const bars = [
  { label: "Ads", h: 70, style: "stripe" },
  { label: "SaaS", h: 95, style: "olive" },
  { label: "HR", h: 130, style: "brand", badge: "56%" },
  { label: "Office", h: 110, style: "ink" },
  { label: "Ops", h: 100, style: "olive" },
  { label: "Misc", h: 80, style: "stripe" },
  { label: "Misc", h: 75, style: "stripe" },
  { label: "Travel", h: 90, style: "stripe" },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  return (
    <>
      <PageHeader />
      <KpiRow />
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        <LeftColumn />
        <div className="flex flex-col gap-5">
          <PerformanceCard />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-5">
            <ExpenseAnalytics />
            <ExpenseAllocation />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Page Header ───────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Plan, prioritize, and accomplish your tasks with ease.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <PillButton><RotateCw className="h-3.5 w-3.5" /> Restart</PillButton>
        <PillButton>
          <Calendar className="h-3.5 w-3.5" /> Monthly{" "}
          <ChevronDown className="h-3.5 w-3.5" />
        </PillButton>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-brand text-foreground text-sm font-medium border border-brand/60 shadow-sm hover:brightness-105 transition-all active:scale-95">
          <Plus className="h-4 w-4" /> Add new
        </button>
      </div>
    </div>
  );
}

function PillButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-background border border-border text-sm text-foreground hover:bg-muted transition-colors">
      {children}
    </button>
  );
}

// ─── KPI Row ───────────────────────────────────────────────────────────────────

function KpiRow() {
  return (
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="h-11 w-11 grid place-items-center rounded-2xl bg-muted shrink-0">
              <k.icon className="h-5 w-5 text-foreground" aria-hidden="true" />
            </div>
            <span
              className={cn(
                "text-xs px-2.5 py-1 rounded-full font-medium tabular-nums",
                k.up
                  ? "bg-foreground text-brand"
                  : "bg-foreground text-background/80",
              )}
            >
              {k.delta}
            </span>
          </div>
          <div className="mt-4">
            <div className="text-sm text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-semibold tracking-tight mt-1 tabular-nums text-foreground">
              {k.value}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-dashed border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>{k.cta}</span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Left Column ───────────────────────────────────────────────────────────────

function LeftColumn() {
  return (
    <div className="flex flex-col gap-5">
      <AccountOverview />
      <QuickRecent />
    </div>
  );
}

function AccountOverview() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Account Overview</h2>
        <button aria-label="More options">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 rounded-full bg-muted grid place-items-center ring-4 ring-brand/30">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-muted-foreground/40 to-foreground" />
          <span className="absolute -top-1 right-0 text-[10px] font-semibold bg-foreground text-brand px-2 py-0.5 rounded-full">
            32%
          </span>
        </div>
        <div>
          <div className="text-lg font-semibold leading-tight text-foreground">
            Hello 👋
            <br />
            Miguel
          </div>
          <div className="text-xs text-muted-foreground mt-1">Welcome to Fintrix</div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border p-4">
        <div className="text-[10px] tracking-widest text-muted-foreground font-semibold uppercase">
          Upgrade
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <div className="font-semibold text-foreground">Premium Plan</div>
          <button className="text-xs px-3 py-1.5 rounded-full bg-brand text-foreground font-medium hover:brightness-105 transition-all">
            Upgrade
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
        Supercharge your sales management and unlock your full potential for
        extraordinary success.
      </p>

      <div className="mt-4 grid grid-cols-2 rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-r border-border">
          <div className="text-xs text-muted-foreground">Performance</div>
          <div className="text-xl font-semibold mt-1 tabular-nums text-foreground">79%</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-muted-foreground">Tools</div>
          <div className="text-xl font-semibold mt-1 tabular-nums text-foreground">30+</div>
        </div>
      </div>
    </div>
  );
}

function QuickRecent() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Quick recent</h2>
        <button aria-label="More options">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex -space-x-2">
          <div className="h-8 w-8 rounded-full bg-brand grid place-items-center text-[10px] font-semibold ring-2 ring-background text-foreground">
            +4
          </div>
          <div className="h-8 w-8 rounded-full bg-muted-foreground/30 ring-2 ring-background" />
          <div className="h-8 w-8 rounded-full bg-muted-foreground/50 ring-2 ring-background" />
          <div className="h-8 w-8 rounded-full bg-muted-foreground/70 ring-2 ring-background" />
        </div>
        <button
          aria-label="Add team member"
          className="h-8 w-8 rounded-full border border-dashed border-border grid place-items-center text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Performance Chart ─────────────────────────────────────────────────────────

function PerformanceCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Financial Performance</h2>
        <PillButton>
          <span className="text-xs">Weekly</span>
          <ChevronDown className="h-3 w-3" />
        </PillButton>
      </div>
      <div className="mt-4 h-[240px] sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              stroke="currentColor"
              strokeDasharray="3 3"
              vertical={false}
              className="text-border"
            />
            <XAxis
              dataKey="d"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-muted-foreground"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-muted-foreground"
              tickFormatter={(v) => `${v}k`}
              domain={[0, 80]}
              ticks={[0, 10, 30, 50, 70, 80]}
            />
            <Tooltip
              cursor={{ stroke: "currentColor", strokeDasharray: "4 4" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid hsl(var(--border))",
                fontSize: 12,
                background: "hsl(var(--card))",
                color: "hsl(var(--card-foreground))",
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              }}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke="#C9F036"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, fill: "hsl(var(--foreground))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Expense Analytics ─────────────────────────────────────────────────────────

function ExpenseAnalytics() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Expense Analytics</h2>
        <button aria-label="More options">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <div className="mt-6 flex items-end justify-between gap-1 sm:gap-2 h-[160px]">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            {b.badge && (
              <span className="text-[9px] sm:text-[10px] font-semibold bg-foreground text-background px-1.5 py-0.5 rounded-md whitespace-nowrap">
                {b.badge}
              </span>
            )}
            {!b.badge && <span className="h-5" />}
            <div
              aria-label={`${b.label}: ${b.h}`}
              className={cn(
                "w-full max-w-[32px] sm:max-w-[36px] rounded-full transition-all",
                b.style === "brand" && "bg-brand",
                b.style === "ink" && "bg-foreground",
                b.style === "olive" && "bg-primary",
                b.style === "stripe" && "bg-muted border-2 border-dashed border-border",
              )}
              style={{ height: `${b.h}px` }}
            />
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Expense Allocation ────────────────────────────────────────────────────────

function ExpenseAllocation() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Expense Allocation</h2>
        <button aria-label="More options">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <div className="mt-4 relative h-[160px] flex items-center justify-center">
        <svg
          viewBox="0 0 200 120"
          className="w-full h-full"
          role="img"
          aria-label="Expense allocation gauge showing $230 spent"
        >
          {/* Track */}
          <path
            d="M20,100 A80,80 0 0,1 180,100"
            fill="none"
            stroke="currentColor"
            className="text-brand"
            strokeWidth="28"
            strokeLinecap="round"
          />
          {/* Value */}
          <path
            d="M20,100 A80,80 0 0,1 80,30"
            fill="none"
            stroke="currentColor"
            className="text-foreground"
            strokeWidth="28"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute bottom-2 right-3 text-right">
          <div className="text-xl sm:text-2xl font-semibold tabular-nums text-foreground">
            $230.0
          </div>
          <div className="text-xs text-muted-foreground">Spent Amount</div>
        </div>
      </div>
    </div>
  );
}
