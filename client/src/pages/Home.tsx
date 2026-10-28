import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Cloud,
  Code2,
  Copy,
  Database,
  Download,
  FileJson,
  FileText,
  Filter,
  Gauge,
  GitBranch,
  HardDrive,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Package2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  RefreshCw,
  Search,
  ScanLine,
  ServerCog,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Table2,
  TerminalSquare,
  Trash2,
  UploadCloud,
  Users,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

type PageId = "overview" | "datasets" | "query" | "dashboards" | "settings";
type Role = "Analyst" | "Admin";
type DatasetCategory = "Healthcare" | "Commerce" | "Infrastructure";
type Point = [number, number];

type Field = {
  name: string;
  type: string;
  sample: string;
  completeness: number;
};

type Dataset = {
  id: string;
  name: string;
  category: DatasetCategory;
  table: string;
  records: number;
  freshness: string;
  updated: string;
  description: string;
  accent: string;
  health: number;
  fields: Field[];
  trend: number[];
  bars: number[];
  categories: string[];
  scatter: Point[];
  radar: number[];
  mix: { label: string; value: number; color: string }[];
};

type NavItem = { id: PageId; label: string; icon: LucideIcon; shortcut: string };

const navItems: NavItem[] = [
  { id: "overview", label: "Command center", icon: LayoutDashboard, shortcut: "01" },
  { id: "datasets", label: "Datasets", icon: Database, shortcut: "02" },
  { id: "query", label: "Query studio", icon: TerminalSquare, shortcut: "03" },
  { id: "dashboards", label: "Saved views", icon: ClipboardList, shortcut: "04" },
  { id: "settings", label: "Workspace", icon: Settings2, shortcut: "05" },
];

const seedDatasets: Dataset[] = [
  {
    id: "covid",
    name: "COVID-19 Outcomes",
    category: "Healthcare",
    table: "health_covid_outcomes",
    records: 128420,
    freshness: "3 min ago",
    updated: "Oct 28, 2026 · 10:26",
    description: "Regional case, recovery and hospital capacity signals across 42 reporting markets.",
    accent: "cyan",
    health: 98,
    fields: [
      { name: "report_date", type: "date", sample: "2026-10-28", completeness: 100 },
      { name: "region", type: "varchar", sample: "North America", completeness: 100 },
      { name: "new_cases", type: "integer", sample: "1,284", completeness: 99.8 },
      { name: "recovered", type: "integer", sample: "1,102", completeness: 99.4 },
      { name: "icu_occupancy", type: "decimal", sample: "0.71", completeness: 97.2 },
      { name: "variant", type: "varchar", sample: "Omicron-X", completeness: 96.1 },
    ],
    trend: [44, 52, 49, 66, 73, 68, 79, 88, 82, 92, 97, 93],
    bars: [74, 66, 82, 58, 91, 78],
    categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    scatter: [[10, 72], [18, 48], [24, 86], [32, 66], [39, 54], [47, 78], [54, 41], [61, 63], [70, 34], [79, 52], [88, 27]],
    radar: [84, 71, 92, 66, 78],
    mix: [
      { label: "Recovered", value: 52, color: "#b7f34a" },
      { label: "Active", value: 31, color: "#27d3e8" },
      { label: "Critical", value: 17, color: "#ffb75e" },
    ],
  },
  {
    id: "commerce",
    name: "E-Commerce Revenue",
    category: "Commerce",
    table: "commerce_orders_daily",
    records: 84210,
    freshness: "14 min ago",
    updated: "Oct 28, 2026 · 10:15",
    description: "Order, margin, channel and cohort performance for the global storefront estate.",
    accent: "lime",
    health: 94,
    fields: [
      { name: "order_date", type: "date", sample: "2026-10-28", completeness: 100 },
      { name: "channel", type: "varchar", sample: "Direct", completeness: 100 },
      { name: "orders", type: "integer", sample: "8,412", completeness: 99.7 },
      { name: "gross_revenue", type: "decimal", sample: "$184,220", completeness: 99.9 },
      { name: "discount_rate", type: "decimal", sample: "0.12", completeness: 95.2 },
      { name: "region", type: "varchar", sample: "EMEA", completeness: 99.3 },
    ],
    trend: [38, 42, 50, 55, 51, 64, 72, 70, 81, 76, 89, 104],
    bars: [62, 74, 54, 88, 79, 95],
    categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    scatter: [[11, 31], [19, 56], [26, 46], [34, 72], [42, 64], [51, 87], [59, 52], [66, 78], [75, 61], [84, 95], [92, 72]],
    radar: [76, 89, 70, 91, 64],
    mix: [
      { label: "Direct", value: 44, color: "#b7f34a" },
      { label: "Marketplace", value: 33, color: "#27d3e8" },
      { label: "Partner", value: 23, color: "#a38bfa" },
    ],
  },
  {
    id: "infra",
    name: "Infrastructure Telemetry",
    category: "Infrastructure",
    table: "infra_telemetry_5m",
    records: 604800,
    freshness: "1 min ago",
    updated: "Oct 28, 2026 · 10:31",
    description: "Five-minute service telemetry across compute, network and storage clusters.",
    accent: "violet",
    health: 91,
    fields: [
      { name: "observed_at", type: "timestamp", sample: "10:30:00Z", completeness: 100 },
      { name: "cluster", type: "varchar", sample: "prod-eu-2", completeness: 100 },
      { name: "cpu_pct", type: "decimal", sample: "68.4", completeness: 99.9 },
      { name: "memory_pct", type: "decimal", sample: "73.8", completeness: 99.9 },
      { name: "latency_ms", type: "decimal", sample: "42.6", completeness: 99.1 },
      { name: "incident_flag", type: "boolean", sample: "false", completeness: 100 },
    ],
    trend: [86, 78, 82, 74, 68, 71, 64, 59, 65, 54, 48, 42],
    bars: [88, 83, 76, 68, 61, 54],
    categories: ["01:00", "05:00", "09:00", "13:00", "17:00", "21:00"],
    scatter: [[9, 22], [17, 39], [24, 31], [31, 55], [39, 44], [48, 71], [56, 63], [64, 82], [72, 68], [82, 91], [91, 77]],
    radar: [91, 67, 82, 74, 88],
    mix: [
      { label: "Compute", value: 41, color: "#b7f34a" },
      { label: "Network", value: 36, color: "#27d3e8" },
      { label: "Storage", value: 23, color: "#a38bfa" },
    ],
  },
];

const queryRows = [
  { segment: "North America", volume: "38,412", average: "$184.20", delta: "+12.4%", signal: "Healthy" },
  { segment: "EMEA", volume: "27,829", average: "$162.10", delta: "+8.1%", signal: "Healthy" },
  { segment: "APAC", volume: "21,607", average: "$149.80", delta: "-2.3%", signal: "Watch" },
  { segment: "LATAM", volume: "8,492", average: "$118.40", delta: "+5.7%", signal: "Healthy" },
];

const savedViews = [
  { name: "Executive health pulse", owner: "Mara Chen", updated: "12 min ago", widgets: 8, scope: "Healthcare" },
  { name: "Commerce margin watch", owner: "Jules Park", updated: "Yesterday", widgets: 6, scope: "Commerce" },
  { name: "Cluster reliability brief", owner: "Ari Singh", updated: "Oct 26", widgets: 10, scope: "Infrastructure" },
];

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);
const formatCompact = (value: number) => (value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : `${value}`);
const downloadSimulation = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

function StatusDot({ color = "lime", pulse = false }: { color?: "lime" | "cyan" | "amber" | "red"; pulse?: boolean }) {
  return <span className={`status-dot status-${color} ${pulse ? "status-pulse" : ""}`} />;
}

function GlassPanel({ children, className = "", glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return <section className={`glass-panel ${glow ? "glass-glow" : ""} ${className}`}>{children}</section>;
}

function SectionHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <div className="section-label">{eyebrow}</div>
        <h2>{title}</h2>
        {detail && <p className="section-detail">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, change, tone, icon: Icon, detail }: { label: string; value: string; change: string; tone: "cyan" | "lime" | "amber" | "violet"; icon: LucideIcon; detail: string }) {
  return (
    <GlassPanel className="metric-card">
      <div className="metric-topline">
        <span className="section-label">{label}</span>
        <span className={`metric-icon metric-${tone}`}><Icon size={15} strokeWidth={1.8} /></span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-bottomline">
        <span className={`metric-change ${change.startsWith("-") ? "negative" : "positive"}`}>{change.startsWith("-") ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{change}</span>
        <span className="metric-detail">{detail}</span>
      </div>
    </GlassPanel>
  );
}

function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return <div className="chart-legend">{items.map((item) => <span key={item.label}><i style={{ background: item.color }} />{item.label}</span>)}</div>;
}

function LineChart({ values, labels, accent = "#27d3e8", compare = false }: { values: number[]; labels: string[]; accent?: string; compare?: boolean }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 700;
  const height = 235;
  const pad = { top: 18, right: 18, bottom: 30, left: 24 };
  const max = Math.max(...values) * 1.16;
  const x = (index: number) => pad.left + (index * (width - pad.left - pad.right)) / (values.length - 1);
  const y = (value: number) => height - pad.bottom - (value / max) * (height - pad.top - pad.bottom);
  const path = values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(value)}`).join(" ");
  const area = `${path} L ${x(values.length - 1)},${height - pad.bottom} L ${x(0)},${height - pad.bottom} Z`;
  return (
    <div className="svg-chart line-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend line chart">
        <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={accent} stopOpacity=".22" /><stop offset="100%" stopColor={accent} stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3].map((line) => <line key={line} x1={pad.left} x2={width - pad.right} y1={pad.top + line * 51} y2={pad.top + line * 51} className="chart-grid-line" />)}
        <path d={area} fill="url(#areaFill)" />
        {compare && <path d={values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(Math.max(0, value - 13 + (index % 3) * 6))}`).join(" ")} className="compare-line" />}
        <path d={path} className="primary-line" style={{ stroke: accent }} />
        {values.map((value, index) => <g key={`${value}-${index}`} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}><circle cx={x(index)} cy={y(value)} r={hovered === index ? 6 : 3.5} className="chart-point" style={{ fill: accent, stroke: hovered === index ? "#081012" : accent }} /><circle cx={x(index)} cy={y(value)} r="13" className="hit-area" /></g>)}
        {labels.map((label, index) => <text key={label} x={x(index)} y={height - 8} textAnchor="middle" className="chart-axis-label">{label}</text>)}
        {hovered !== null && <g className="chart-tooltip"><rect x={Math.min(x(hovered) - 38, width - 96)} y={Math.max(y(values[hovered]) - 42, 4)} width="76" height="26" rx="4" /><text x={Math.min(x(hovered), width - 58)} y={Math.max(y(values[hovered]) - 25, 22)} textAnchor="middle">{values[hovered]} signal</text></g>}
      </svg>
    </div>
  );
}

function BarChart({ values, labels, accent = "#b7f34a" }: { values: number[]; labels: string[]; accent?: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 430;
  const height = 212;
  const barWidth = 35;
  const gap = 24;
  return (
    <div className="svg-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bar chart">
        {[0, 1, 2, 3].map((line) => <line key={line} x1="24" x2={width - 14} y1={24 + line * 42} y2={24 + line * 42} className="chart-grid-line" />)}
        {values.map((value, index) => { const bx = 35 + index * (barWidth + gap); const bh = value * 1.35; const by = height - 30 - bh; return <g key={labelSafe(labels[index])} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}><rect x={bx} y={by} width={barWidth} height={bh} rx="3" className="bar-rect" style={{ fill: accent, opacity: hovered === null || hovered === index ? 0.92 : 0.42 }} /><rect x={bx - 7} y="28" width={barWidth + 14} height={height - 54} fill="transparent" /><text x={bx + barWidth / 2} y={height - 10} textAnchor="middle" className="chart-axis-label">{labels[index]}</text>{hovered === index && <text x={bx + barWidth / 2} y={by - 9} textAnchor="middle" className="chart-value-label">{value}</text>}</g>; })}
      </svg>
    </div>
  );
}

function labelSafe(value: string | undefined) { return value ?? "point"; }

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const circumference = 2 * Math.PI * 45;
  let offset = 0;
  return (
    <div className="donut-layout">
      <div className="donut-chart">
        <svg viewBox="0 0 120 120" role="img" aria-label="Donut chart">
          <circle cx="60" cy="60" r="45" className="donut-track" />
          {segments.map((segment) => { const length = (segment.value / total) * circumference; const currentOffset = offset; offset += length; return <circle key={segment.label} cx="60" cy="60" r="45" className="donut-segment" stroke={segment.color} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-currentOffset} />; })}
        </svg>
        <div className="donut-center"><span>Total</span><strong>100%</strong></div>
      </div>
      <div className="donut-legend">{segments.map((segment) => <div key={segment.label}><span className="legend-name"><i style={{ background: segment.color }} />{segment.label}</span><b>{segment.value}%</b></div>)}</div>
    </div>
  );
}

function ScatterPlot({ points }: { points: Point[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 430;
  const height = 212;
  return (
    <div className="svg-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Scatter plot">
        {[0, 1, 2, 3].map((line) => <line key={line} x1="28" x2={width - 20} y1={28 + line * 42} y2={28 + line * 42} className="chart-grid-line" />)}
        {points.map(([px, py], index) => { const cx = 28 + px * 3.8; const cy = height - 32 - py * 1.7; return <g key={`${px}-${py}`} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}><circle cx={cx} cy={cy} r={hovered === index ? 6 : 4} className="scatter-point" style={{ fill: hovered === index ? "#b7f34a" : "#27d3e8" }} /><circle cx={cx} cy={cy} r="13" className="hit-area" />{hovered === index && <text x={cx} y={cy - 11} className="chart-value-label">{px} / {py}</text>}</g>; })}
        <text x="30" y={height - 7} className="chart-axis-label">low volume</text><text x={width - 28} y={height - 7} textAnchor="end" className="chart-axis-label">high volume</text>
      </svg>
    </div>
  );
}

function RadarChart({ values }: { values: number[] }) {
  const size = 220;
  const center = 110;
  const radius = 78;
  const labels = ["Latency", "Completeness", "Coverage", "Stability", "Freshness"];
  const point = (value: number, index: number, scale = radius) => { const angle = -Math.PI / 2 + (index * Math.PI * 2) / values.length; const r = (value / 100) * scale; return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`; };
  const outer = values.map((_, index) => point(100, index)).join(" ");
  const mid = values.map((_, index) => point(68, index)).join(" ");
  const inner = values.map((_, index) => point(35, index)).join(" ");
  const data = values.map((value, index) => point(value, index)).join(" ");
  return <div className="radar-wrap"><svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Radar chart"><polygon points={outer} className="radar-grid" /><polygon points={mid} className="radar-grid" /><polygon points={inner} className="radar-grid" />{values.map((_, index) => <line key={labels[index]} x1={center} y1={center} x2={point(100, index).split(",")[0]} y2={point(100, index).split(",")[1]} className="radar-axis" />)}<polygon points={data} className="radar-area" /><polyline points={data} className="radar-line" />{labels.map((label, index) => { const [lx, ly] = point(118, index).split(","); return <text key={label} x={lx} y={ly} textAnchor="middle" className="radar-label">{label}</text>; })}</svg></div>;
}

function Sidebar({ page, setPage, collapsed, setCollapsed, role, setRole }: { page: PageId; setPage: (page: PageId) => void; collapsed: boolean; setCollapsed: (value: boolean) => void; role: Role; setRole: (role: Role) => void }) {
  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="brand-row"><div className="brand-mark"><span>O</span><i /></div>{!collapsed && <div className="brand-copy"><strong>OmniMetrics</strong><span>AI CONTROL PLANE</span></div>}<button className="icon-button sidebar-collapse" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button></div>
      <div className="workspace-switch"><div className="workspace-avatar">A</div>{!collapsed && <><div className="workspace-copy"><span>Workspace</span><strong>Atlas Research</strong></div><ChevronDown size={14} /></>}</div>
      <div className="nav-block"><div className="section-label nav-label">Workspace</div>{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${page === item.id ? "nav-item-active" : ""}`} onClick={() => setPage(item.id)} title={collapsed ? item.label : undefined}><Icon size={17} strokeWidth={1.8} /><span>{!collapsed && item.label}</span>{!collapsed && <kbd>{item.shortcut}</kbd>}{page === item.id && <i className="nav-active-pip" />}</button>; })}</div>
      {!collapsed && <div className="sidebar-status"><div className="section-label">Data plane status</div><div className="status-card"><div><StatusDot pulse /><span>All systems nominal</span></div><strong>99.98%</strong><small>last 24 hours</small></div><div className="status-card status-card-muted"><div><Cloud size={14} /><span>Cloud sync</span></div><strong>34 ms</strong><small>p95 latency</small></div></div>}
      <div className="sidebar-bottom"><button className={`nav-item ${role === "Admin" ? "nav-item-admin" : ""}`} onClick={() => setRole(role === "Analyst" ? "Admin" : "Analyst")} title="Toggle role"><ShieldCheck size={17} /><span>{collapsed ? role.slice(0, 1) : `${role} mode`}</span>{!collapsed && <span className="role-toggle-indicator">{role === "Admin" ? "A" : "R"}</span>}</button>{!collapsed && <div className="user-chip"><div className="user-avatar">MC</div><div><strong>Mara Chen</strong><span>Data operations</span></div><MoreHorizontal size={15} /></div>}</div>
    </aside>
  );
}

function Topbar({ dataset, role, setRole, onSearch }: { dataset: Dataset; role: Role; setRole: (role: Role) => void; onSearch: (value: string) => void }) {
  return <header className="topbar"><div className="breadcrumb"><span className="breadcrumb-muted">Atlas Research</span><ChevronRight size={14} /><span>Command center</span><span className="live-chip"><StatusDot pulse />LIVE</span></div><div className="topbar-actions"><div className="telemetry-strip"><span><Activity size={13} /> ingest <b>1.2 GB/s</b></span><span><Gauge size={13} /> query p95 <b>184 ms</b></span><span><ServerCog size={13} /> {dataset.name} <b>{dataset.freshness}</b></span></div><div className="topbar-divider" /><label className="top-search"><Search size={15} /><input placeholder="Search workspace" onChange={(event) => onSearch(event.target.value)} /><kbd>⌘ K</kbd></label><button className="icon-button top-action"><Bell size={17} /><i /></button><div className="role-switcher"><button className={role === "Analyst" ? "selected" : ""} onClick={() => setRole("Analyst")}>Analyst</button><button className={role === "Admin" ? "selected" : ""} onClick={() => setRole("Admin")}>Admin</button></div></div></header>;
}

function DatasetSelector({ datasets, activeId, onSelect }: { datasets: Dataset[]; activeId: string; onSelect: (id: string) => void }) {
  return <div className="dataset-selector">{datasets.map((dataset) => <button key={dataset.id} className={`dataset-mini ${dataset.id === activeId ? "active" : ""}`} onClick={() => onSelect(dataset.id)}><span className={`dataset-mini-icon dataset-icon-${dataset.accent}`}>{dataset.category === "Healthcare" ? <Activity size={15} /> : dataset.category === "Commerce" ? <Package2 size={15} /> : <ServerCog size={15} />}</span><span><b>{dataset.name}</b><small>{formatCompact(dataset.records)} rows · {dataset.health}% health</small></span>{dataset.id === activeId && <Check size={14} />}</button>)}</div>;
}

function MiniProgress({ value, color = "lime" }: { value: number; color?: string }) { return <div className="mini-progress"><i className={`progress-${color}`} style={{ width: `${value}%` }} /></div>; }

function Overview({ dataset, datasets, onDatasetChange, onNavigate, searchTerm }: { dataset: Dataset; datasets: Dataset[]; onDatasetChange: (id: string) => void; onNavigate: (page: PageId) => void; searchTerm: string }) {
  const [range, setRange] = useState("30D");
  const [category, setCategory] = useState("All signals");
  const rangeScale = range === "7D" ? 0.84 : range === "90D" ? 1.12 : range === "YTD" ? 1.26 : 1;
  const categoryScale = category === "Anomalies" ? 0.66 : category === "Growth" ? 1.18 : category === "Reliability" ? 0.92 : 1;
  const scopedTrend = dataset.trend.map((value, index) => Math.max(1, Math.round(value * rangeScale * categoryScale + (category === "Anomalies" && index % 3 === 0 ? 18 : 0))));
  const scopedBars = dataset.bars.map((value) => Math.max(1, Math.round(value * categoryScale)));
  const anomalyCount = Math.max(2, Math.round((dataset.id === "infra" ? 27 : dataset.id === "covid" ? 14 : 9) * (category === "Anomalies" ? 1.4 : categoryScale)));
  const meanValue = dataset.id === "commerce" ? `$${(184.2 * rangeScale * categoryScale).toFixed(2)}` : dataset.id === "infra" ? `${(68.4 * categoryScale).toFixed(1)}%` : `${(74.8 * rangeScale * categoryScale).toFixed(1)}K`;
  const medianValue = dataset.id === "commerce" ? `$${(142.6 * rangeScale * categoryScale).toFixed(2)}` : dataset.id === "infra" ? `${(42.6 * categoryScale).toFixed(1)} ms` : `${(61.2 * rangeScale * categoryScale).toFixed(1)}K`;
  const growthValue = dataset.id === "infra" ? 18.9 : dataset.id === "commerce" ? 24.6 : 32.8;
  const scopedGrowth = (growthValue * (range === "YTD" ? 1.16 : range === "7D" ? .92 : 1) * (category === "Growth" ? 1.2 : 1)).toFixed(1);
  const filteredRecords = searchTerm ? dataset.fields.filter((field) => field.name.toLowerCase().includes(searchTerm.toLowerCase())) : dataset.fields;
  return <div className="page-content"><div className="page-header command-header"><div><div className="section-label"><StatusDot pulse /> Signal overview / {dataset.category}</div><h1>Command center</h1><p>Move from live signals to a decision-ready brief.</p></div><div className="header-actions"><div className="dataset-context"><span className={`dataset-mini-icon dataset-icon-${dataset.accent}`}><Database size={15} /></span><div><small>Active dataset</small><strong>{dataset.name}</strong></div><ChevronDown size={15} /></div><button className="primary-button" onClick={() => onNavigate("query")}><Sparkles size={15} />Ask Omni</button></div></div>
    <DatasetSelector datasets={datasets} activeId={dataset.id} onSelect={onDatasetChange} />
    <div className="metric-grid"><MetricCard label="Mean signal" value={meanValue} change={dataset.id === "infra" ? "-4.8%" : "+12.4%"} tone="cyan" icon={Activity} detail={`${range} window`} /><MetricCard label="Median" value={medianValue} change="+8.1%" tone="lime" icon={BarChart3} detail={`${category.toLowerCase()} p50`} /><MetricCard label="Anomalies" value={String(anomalyCount).padStart(2, "0")} change={dataset.id === "infra" ? "+3" : "-6"} tone="amber" icon={AlertTriangle} detail="need review" /><MetricCard label="YoY growth" value={`+${scopedGrowth}%`} change="+4.2 pts" tone="violet" icon={GitBranch} detail="rolling 12 months" /></div>
    <div className="overview-grid"><GlassPanel className="lead-chart-panel" glow><div className="panel-header"><div><div className="section-label">Primary trend</div><h3>{dataset.category === "Infrastructure" ? "Reliability index" : dataset.category === "Commerce" ? "Revenue velocity" : "Care pathway signal"}</h3></div><div className="panel-tools"><div className="segmented-control">{["7D", "30D", "90D", "YTD"].map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div><button className="icon-button"><MoreHorizontal size={16} /></button></div></div><div className="chart-meta"><span><i className="legend-swatch cyan-swatch" />Current window</span><span><i className="legend-swatch muted-swatch" />Prior window</span><span className="chart-meta-right"><CalendarDays size={13} /> {range === "7D" ? "Oct 22 — Oct 28, 2026" : range === "YTD" ? "Jan 01 — Oct 28, 2026" : "Oct 01 — Oct 28, 2026"}</span></div><LineChart values={scopedTrend} labels={["01", "04", "07", "10", "13", "16", "19", "22", "25", "28", "30", "Today"]} accent={dataset.accent === "lime" ? "#b7f34a" : dataset.accent === "violet" ? "#a38bfa" : "#27d3e8"} compare /></GlassPanel>
      <GlassPanel className="health-panel"><div className="panel-header"><div><div className="section-label">Quality monitor</div><h3>Data health</h3></div><button className="icon-button"><MoreHorizontal size={16} /></button></div><div className="health-score"><div className="score-ring"><strong>{dataset.health}</strong><span>/100</span></div><div><strong>Trusted signal</strong><p>Completeness and freshness are within policy.</p></div></div><div className="health-list"><div><span>Completeness</span><b>{dataset.health + 1}%</b><MiniProgress value={dataset.health + 1} /></div><div><span>Freshness SLA</span><b>99.2%</b><MiniProgress value={99} color="cyan" /></div><div><span>Schema drift</span><b className="warning-text">1 field</b><MiniProgress value={29} color="amber" /></div></div><button className="text-button" onClick={() => onNavigate("datasets")}>Open data quality <ChevronRight size={14} /></button></GlassPanel>
      <GlassPanel className="bar-panel"><div className="panel-header"><div><div className="section-label">Volume by segment</div><h3>Signal distribution</h3></div><label className="select-like"><Filter size={13} /><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All signals</option><option>Growth</option><option>Reliability</option><option>Anomalies</option></select><ChevronDown size={13} /></label></div><BarChart values={scopedBars} labels={dataset.categories} accent={dataset.accent === "violet" ? "#a38bfa" : "#b7f34a"} /></GlassPanel>
      <GlassPanel className="donut-panel"><div className="panel-header"><div><div className="section-label">Portfolio mix</div><h3>Coverage by type</h3></div><button className="icon-button"><MoreHorizontal size={16} /></button></div><DonutChart segments={dataset.mix} /></GlassPanel>
      <GlassPanel className="scatter-panel"><div className="panel-header"><div><div className="section-label">Relationship map</div><h3>Volume vs outcome</h3></div><span className="tiny-status"><StatusDot /> correlation 0.84</span></div><ScatterPlot points={dataset.scatter} /></GlassPanel>
      <GlassPanel className="radar-panel"><div className="panel-header"><div><div className="section-label">Operational fingerprint</div><h3>Signal profile</h3></div><button className="icon-button"><MoreHorizontal size={16} /></button></div><RadarChart values={dataset.radar} /><ChartLegend items={[{ label: "Current profile", color: "#b7f34a" }, { label: "Policy baseline", color: "#27d3e8" }]} /></GlassPanel>
    </div>
    <div className="bottom-grid"><GlassPanel className="activity-panel"><SectionHeading eyebrow="Recent activity" title="What moved" detail="Latest changes across your data plane" action={<button className="text-button" onClick={() => onNavigate("dashboards")}>View all <ChevronRight size={14} /></button>} /><div className="activity-list"><div className="activity-row"><span className="activity-icon activity-lime"><CheckCircle2 size={15} /></span><div><strong>Schema sync completed</strong><p>{dataset.name} · 6 fields validated</p></div><time>2 min ago</time></div><div className="activity-row"><span className="activity-icon activity-amber"><AlertTriangle size={15} /></span><div><strong>{anomalyCount} anomalies clustered</strong><p>Review suggested for the latest window</p></div><time>11 min ago</time></div><div className="activity-row"><span className="activity-icon activity-cyan"><BrainCircuit size={15} /></span><div><strong>AI summary generated</strong><p>“Growth is holding above the prior baseline.”</p></div><time>18 min ago</time></div></div></GlassPanel><GlassPanel className="fields-panel"><SectionHeading eyebrow="Active schema" title="Signal fields" detail={`${filteredRecords.length} of ${dataset.fields.length} fields surfaced`} action={<button className="icon-button"><MoreHorizontal size={16} /></button>} /><div className="field-table">{filteredRecords.map((field) => <div className="field-row" key={field.name}><span className="field-type">{field.type === "date" || field.type === "timestamp" ? <CalendarDays size={13} /> : field.type === "varchar" ? <FileText size={13} /> : <BarChart3 size={13} />}</span><strong>{field.name}</strong><span className="field-sample">{field.sample}</span><span className="field-completeness"><MiniProgress value={field.completeness} color={field.completeness < 98 ? "amber" : "cyan"} />{field.completeness}%</span></div>)}</div></GlassPanel></div>
  </div>;
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (name: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [stage, setStage] = useState<"idle" | "parsing" | "done">("idle");
  const handleFile = (name: string) => { setFileName(name); setStage("parsing"); window.setTimeout(() => setStage("done"), 700); };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files[0]?.name ?? "commerce_snapshot.csv"); };
  return <div className="modal-backdrop"><div className="modal-card"><div className="modal-header"><div><div className="section-label">Ingest source</div><h3>Import a dataset</h3><p>CSV and JSON files are parsed locally for this simulation.</p></div><button className="icon-button" onClick={onClose}><X size={17} /></button></div><div className={`drop-zone ${dragging ? "drop-zone-active" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => handleFile("omni_import_2026.csv")}><UploadCloud size={24} /><strong>{fileName || "Drop a CSV or JSON file here"}</strong><span>{fileName ? "Ready to validate" : "or click to browse · max 250 MB"}</span></div>{stage !== "idle" && <div className={`parser-status parser-${stage}`}><div className="parser-icon">{stage === "done" ? <Check size={15} /> : <RefreshCw size={15} className="spin" />}</div><div><strong>{stage === "done" ? "Parse complete" : "Parsing file structure"}</strong><p>{stage === "done" ? "8,412 rows · 12 columns · 99.6% valid" : "Inferring schema and checking delimiters…"}</p></div><span className="parser-badge">{stage === "done" ? "VALID" : "RUNNING"}</span></div>}{stage === "done" && <div className="preview-table"><div className="preview-header"><span>Import preview</span><span>first 3 rows</span></div>{["2026-10-28 · Direct · 184.20", "2026-10-28 · Marketplace · 162.10", "2026-10-27 · Partner · 148.80"].map((row) => <div className="preview-row" key={row}><Table2 size={13} /><span>{row}</span><CheckCircle2 size={13} /></div>)}</div>}<div className="modal-footer"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={stage !== "done"} onClick={() => onImported(fileName || "omni_import_2026.csv")}><Plus size={15} />Add dataset</button></div></div></div>;
}

function DatasetsPage({ datasets, activeId, onSelect, onImport, onToast, onDuplicate, onEdit, onDelete }: { datasets: Dataset[]; activeId: string; onSelect: (id: string) => void; onImport: () => void; onToast: (message: string) => void; onDuplicate: (dataset: Dataset) => void; onEdit: (dataset: Dataset) => void; onDelete: (dataset: Dataset) => void }) {
  const [showSchema, setShowSchema] = useState(true);
  const active = datasets.find((item) => item.id === activeId) ?? datasets[0];
  return <div className="page-content"><div className="page-header"><div><div className="section-label"><Database size={13} /> Data registry</div><h1>Datasets</h1><p>Govern the signals that power every downstream view.</p></div><div className="header-actions"><button className="secondary-button"><ListFilter size={15} />Filter</button><button className="primary-button" onClick={onImport}><UploadCloud size={15} />Import dataset</button></div></div><div className="dataset-overview-strip"><div><span className="section-label">Registry health</span><strong>{datasets.length} active / 0 stale</strong></div><div><span className="section-label">Total records</span><strong>{formatCompact(datasets.reduce((sum, item) => sum + item.records, 0))}</strong></div><div><span className="section-label">Avg completeness</span><strong>97.8%</strong></div><div><span className="section-label">Last schema sync</span><strong>2 min ago</strong></div></div><div className="datasets-layout"><div className="dataset-registry">{datasets.map((item) => <GlassPanel className={`dataset-registry-card ${item.id === activeId ? "selected" : ""}`} key={item.id}><button className="dataset-card-main" onClick={() => onSelect(item.id)}><div className={`dataset-large-icon dataset-icon-${item.accent}`}>{item.category === "Healthcare" ? <Activity size={20} /> : item.category === "Commerce" ? <Package2 size={20} /> : <ServerCog size={20} />}</div><div className="dataset-card-copy"><div className="dataset-card-title"><strong>{item.name}</strong><span className="health-pill"><StatusDot />{item.health}%</span></div><p>{item.description}</p><div className="dataset-card-meta"><span><Table2 size={13} />{formatNumber(item.records)} rows</span><span><RefreshCw size={13} />{item.freshness}</span><span>{item.table}</span></div></div><ChevronRight size={17} /></button><div className="dataset-card-footer"><span>{item.fields.length} fields</span><span className="tag-chip">{item.category}</span><div className="dataset-card-actions"><button onClick={(event) => { event.stopPropagation(); onDuplicate(item); }} title="Duplicate"><Copy size={14} /></button><button onClick={(event) => { event.stopPropagation(); onEdit(item); }} title="Edit"><Settings2 size={14} /></button><button onClick={(event) => { event.stopPropagation(); onDelete(item); }} title="Delete"><Trash2 size={14} /></button></div></div></GlassPanel>)}<button className="dashed-add" onClick={onImport}><Plus size={17} /><span><strong>Register a new dataset</strong><small>Bring a CSV, JSON, or connector online</small></span><ChevronRight size={15} /></button></div><GlassPanel className="schema-panel"><div className="panel-header"><div><div className="section-label">Schema inspector</div><h3>{active.name}</h3></div><button className="icon-button" onClick={() => setShowSchema(!showSchema)}>{showSchema ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></div>{showSchema && <><div className="schema-summary"><div><span>Source</span><strong>{active.table}</strong></div><div><span>Refreshed</span><strong>{active.updated}</strong></div></div><div className="schema-field-list">{active.fields.map((field) => <div className="schema-field" key={field.name}><div className="schema-field-name"><span className="field-type-badge">{field.type}</span><strong>{field.name}</strong></div><span className="schema-sample">{field.sample}</span><span className="schema-complete"><MiniProgress value={field.completeness} color={field.completeness < 98 ? "amber" : "cyan"} />{field.completeness}%</span></div>)}</div><div className="transform-box"><div className="section-label"><SlidersHorizontal size={12} /> Cleaning & transformations</div><p>Preview safe changes before writing back to the data plane.</p><div className="transform-actions"><button onClick={() => onToast("Missing values profiled: 1.8% across 2 columns")}><ScanLine size={14} />Profile nulls</button><button onClick={() => onToast("Column types inferred and staged for review")}><Workflow size={14} />Infer types</button><button onClick={() => onToast("Filter preview ready: 42,184 records")}><Filter size={14} />Add filter</button></div></div></>}</GlassPanel></div></div>;
}

function QueryPage({ dataset, onToast }: { dataset: Dataset; onToast: (message: string) => void }) {
  const [query, setQuery] = useState(`SELECT region, SUM(gross_revenue) AS revenue, AVG(discount_rate) AS avg_discount\nFROM ${dataset.table}\nWHERE report_date >= '2026-10-01'\nGROUP BY region\nORDER BY revenue DESC;`);
  const [nlPrompt, setNlPrompt] = useState("Show revenue by region for October, compare it with the previous window, and flag any region with a negative discount trend.");
  const [executed, setExecuted] = useState(true);
  const [mode, setMode] = useState<"sql" | "nl">("sql");
  const [resultView, setResultView] = useState<"table" | "chart">("table");
  const runQuery = () => { setExecuted(false); window.setTimeout(() => setExecuted(true), 600); onToast("Query completed in 184 ms · 4 rows returned"); };
  return <div className="page-content"><div className="page-header"><div><div className="section-label"><TerminalSquare size={13} /> Query studio</div><h1>Ask the data plane</h1><p>Blend SQL precision with natural-language exploration.</p></div><div className="header-actions"><span className="query-status"><StatusDot pulse /> warehouse online</span><button className="secondary-button" onClick={() => onToast("Query saved to Saved views")}>Save query</button></div></div><div className="query-layout"><GlassPanel className="query-editor-panel" glow><div className="editor-toolbar"><div className="query-tabs"><button className={mode === "sql" ? "active" : ""} onClick={() => setMode("sql")}><Code2 size={14} />SQL editor</button><button className={mode === "nl" ? "active" : ""} onClick={() => setMode("nl")}><Sparkles size={14} />Natural language</button></div><span className="editor-meta"><span className="live-chip"><StatusDot pulse />autosave on</span><button className="icon-button"><MoreHorizontal size={16} /></button></span></div>{mode === "sql" ? <textarea className="query-editor" value={query} onChange={(event) => setQuery(event.target.value)} spellCheck={false} /> : <div className="nl-editor"><Sparkles size={17} /><textarea value={nlPrompt} onChange={(event) => setNlPrompt(event.target.value)} /><div className="nl-suggest">Omni will translate your request into a safe, read-only query.</div></div>}<div className="query-examples"><span className="section-label">Try an example</span><button onClick={() => setQuery("SELECT cluster, AVG(latency_ms) FROM infra_telemetry_5m GROUP BY cluster;")}>latency by cluster</button><button onClick={() => setQuery("SELECT variant, SUM(new_cases) FROM health_covid_outcomes GROUP BY variant;")}>cases by variant</button><button onClick={() => setQuery("SELECT channel, SUM(gross_revenue) FROM commerce_orders_daily GROUP BY channel;")}>revenue by channel</button></div><div className="editor-footer"><span><Database size={13} />{dataset.table}</span><span><LockKeyhole size={13} />read-only</span><button className="primary-button run-button" onClick={runQuery}><Play size={14} />{executed ? "Run query" : "Running…"}</button></div></GlassPanel><GlassPanel className="query-side-panel"><div className="panel-header"><div><div className="section-label">Query context</div><h3>Guardrails</h3></div><ShieldCheck size={17} className="icon-lime" /></div><div className="guardrail-list"><div><CheckCircle2 size={15} /><span>Read-only execution</span><b>ON</b></div><div><CheckCircle2 size={15} /><span>PII masking</span><b>ON</b></div><div><CheckCircle2 size={15} /><span>Row limit</span><b>10K</b></div><div><AlertTriangle size={15} /><span>Query cost</span><b className="warning-text">LOW</b></div></div><div className="query-history"><div className="section-label">Recent queries</div>{["Revenue by region", "Anomaly clusters", "Schema health"].map((item, index) => <button key={item} onClick={() => onToast(`${item} loaded into the editor`)}><RefreshCw size={12} />{item}<span>{index + 1}m</span></button>)}</div></GlassPanel></div><GlassPanel className="query-results"><div className="results-header"><div><div className="section-label">Result set</div><h3>Revenue concentration by region</h3></div><div className="results-actions"><span className="result-count"><Check size={13} />4 rows · 184 ms</span><div className="segmented-control"><button className={resultView === "table" ? "active" : ""} onClick={() => setResultView("table")}><Table2 size={13} />Table</button><button className={resultView === "chart" ? "active" : ""} onClick={() => setResultView("chart")}><BarChart3 size={13} />Chart</button></div><button className="icon-button" onClick={() => downloadSimulation("omnimetrics-query.csv", ["segment,volume,average_order,delta,signal", ...queryRows.map((row) => `${row.segment},${row.volume},${row.average},${row.delta},${row.signal}`)].join("\n"), "text/csv")}><Download size={15} /></button></div></div>{resultView === "table" ? <div className="result-table"><div className="result-table-row result-table-head"><span>segment</span><span>volume</span><span>average order</span><span>delta</span><span>signal</span></div>{queryRows.map((row) => <div className="result-table-row" key={row.segment}><strong>{row.segment}</strong><span>{row.volume}</span><span>{row.average}</span><span className={row.delta.startsWith("-") ? "negative-text" : "positive-text"}>{row.delta}</span><span className={`signal-badge ${row.signal === "Watch" ? "signal-watch" : "signal-good"}`}><StatusDot color={row.signal === "Watch" ? "amber" : "lime"} />{row.signal}</span></div>)}</div> : <div className="query-chart-output"><BarChart values={[92, 74, 57, 31]} labels={["NA", "EMEA", "APAC", "LATAM"]} accent="#27d3e8" /><div className="query-insight"><Sparkles size={15} /><div><strong>Omni insight</strong><p>North America contributes 48% of modeled revenue, with the strongest positive delta in the current window.</p></div></div></div>}</GlassPanel></div>;
}

function DashboardsPage({ onToast }: { onToast: (message: string) => void }) {
  const [views, setViews] = useState(savedViews);
  const [activeView, setActiveView] = useState(savedViews[0].name);
  const createDashboard = () => { const next = { name: `Untitled signal brief ${views.length + 1}`, owner: "Mara Chen", updated: "just now", widgets: 4, scope: "Workspace" }; setViews((current) => [next, ...current]); setActiveView(next.name); onToast("New dashboard saved to your workspace"); };
  const exportPdf = () => { downloadSimulation("omnimetrics-dashboard.pdf", "OmniMetrics AI\nDecision-ready brief\n\nExport simulation: PDF package queued from the current dashboard view.", "application/pdf"); onToast("PDF brief downloaded · simulation package"); };
  const exportCsv = () => { downloadSimulation("omnimetrics-dashboard.csv", "dashboard,scope,widgets,owner\n" + views.map((view) => `${view.name},${view.scope},${view.widgets},${view.owner}`).join("\n"), "text/csv"); onToast("CSV bundle downloaded · 4 files simulated"); };
  return <div className="page-content"><div className="page-header"><div><div className="section-label"><ClipboardList size={13} /> Saved views</div><h1>Dashboards & exports</h1><p>Keep the right signal close, then send it downstream.</p></div><div className="header-actions"><button className="secondary-button" onClick={createDashboard}><Plus size={15} />New dashboard</button><button className="primary-button" onClick={exportPdf}><Download size={15} />Export view</button></div></div><div className="dashboard-summary"><GlassPanel className="summary-tile"><div className="summary-icon summary-lime"><LayoutDashboard size={17} /></div><div><span className="section-label">Saved layouts</span><strong>{views.length + 9}</strong><small>+3 this month</small></div></GlassPanel><GlassPanel className="summary-tile"><div className="summary-icon summary-cyan"><Users size={17} /></div><div><span className="section-label">Shared with team</span><strong>08</strong><small>4 active viewers</small></div></GlassPanel><GlassPanel className="summary-tile"><div className="summary-icon summary-violet"><Download size={17} /></div><div><span className="section-label">Exports this week</span><strong>24</strong><small>100% delivered</small></div></GlassPanel></div><div className="dashboard-layout"><GlassPanel className="saved-view-list"><div className="panel-header"><div><div className="section-label">Your workspace</div><h3>Saved dashboards</h3></div><div className="select-like"><Search size={13} />Search</div></div>{views.map((view) => <div className={`saved-view-row ${activeView === view.name ? "saved-view-active" : ""}`} key={view.name}><div className={`saved-view-icon saved-${view.scope.toLowerCase()}`}>{view.scope === "Healthcare" ? <Activity size={17} /> : view.scope === "Commerce" ? <BarChart3 size={17} /> : <ServerCog size={17} />}</div><div className="saved-view-copy"><strong>{view.name}</strong><p>{view.scope} · {view.widgets} widgets · {view.owner}</p></div><span className="saved-time">{view.updated}</span><button className="icon-button" onClick={() => { setActiveView(view.name); onToast(`${view.name} opened in preview`); }}><ChevronRight size={16} /></button></div>)}<button className="dashed-add" onClick={createDashboard}><Plus size={15} /><span><strong>Build from a blank canvas</strong><small>Choose widgets and save a new view</small></span></button></GlassPanel><GlassPanel className="export-panel"><div className="panel-header"><div><div className="section-label">Export center</div><h3>Send a decision-ready brief</h3></div><FileText size={18} className="icon-cyan" /></div><p className="export-copy">Package the active dashboard with a schema snapshot, KPI definitions, and the current filter state.</p><div className="export-options"><button onClick={exportPdf}><div><FileText size={17} /><strong>PDF brief</strong><span>Best for executive review</span></div><Download size={15} /></button><button onClick={exportCsv}><div><FileJson size={17} /><strong>CSV bundle</strong><span>Best for downstream analysis</span></div><Download size={15} /></button></div><div className="export-foot"><span><CheckCircle2 size={14} />Includes active filters</span><span><LockKeyhole size={14} />PII safe</span></div></GlassPanel></div></div>;
}

function SettingsPage({ role, onToast }: { role: Role; onToast: (message: string) => void }) {
  const [alerts, setAlerts] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  return <div className="page-content"><div className="page-header"><div><div className="section-label"><Settings2 size={13} /> Workspace</div><h1>Control settings</h1><p>Shape how your team explores and ships trusted analytics.</p></div><div className="header-actions"><span className="role-badge"><ShieldCheck size={14} />{role} access</span></div></div><div className="settings-layout"><GlassPanel className="settings-nav"><div className="section-label">Workspace config</div>{["General", "Data policies", "Notifications", "Integrations", "Access control"].map((item, index) => <button key={item} className={index === 0 ? "active" : ""}><span>{item}</span><ChevronRight size={14} /></button>)}</GlassPanel><GlassPanel className="settings-main"><div className="settings-section"><div><div className="section-label">Workspace identity</div><h3>Atlas Research</h3><p>Default context for your OmniMetrics control plane.</p></div><button className="secondary-button" onClick={() => onToast("Workspace name edit enabled")}>Edit</button></div><div className="settings-divider" /><div className="settings-section"><div><div className="section-label">Live telemetry</div><h3>Keep the signal fresh</h3><p>Refresh active charts when the connected data plane reports a new window.</p></div><button className={`toggle ${autoRefresh ? "on" : ""}`} onClick={() => setAutoRefresh(!autoRefresh)}><i /></button></div><div className="settings-divider" /><div className="settings-section"><div><div className="section-label">Anomaly alerts</div><h3>Route high-confidence issues</h3><p>Surface anomaly clusters in the activity stream and top telemetry bar.</p></div><button className={`toggle ${alerts ? "on" : ""}`} onClick={() => setAlerts(!alerts)}><i /></button></div><div className="settings-divider" /><div className="settings-section"><div><div className="section-label">Current access</div><h3>{role === "Admin" ? "Admin policies" : "Analyst policies"}</h3><p>{role === "Admin" ? "You can manage registry CRUD, policy rules, and workspace access." : "You can explore data, run read-only queries, and save shared views."}</p></div><span className="access-chip"><StatusDot />{role} mode</span></div></GlassPanel></div></div>;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) { return <div className="toast"><CheckCircle2 size={16} /><span>{message}</span><button onClick={onClose}><X size={14} /></button></div>; }

export default function Home() {
  const [page, setPage] = useState<PageId>("overview");
  const [role, setRole] = useState<Role>("Analyst");
  const [collapsed, setCollapsed] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>(seedDatasets);
  const [activeId, setActiveId] = useState("covid");
  const [searchTerm, setSearchTerm] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const activeDataset = useMemo(() => datasets.find((dataset) => dataset.id === activeId) ?? datasets[0], [datasets, activeId]);
  const notify = (message: string) => { if (toastTimer.current) window.clearTimeout(toastTimer.current); setToast(message); toastTimer.current = window.setTimeout(() => setToast(""), 3600); };
  const handleImport = (name: string) => { const imported: Dataset = { ...seedDatasets[1], id: `import-${Date.now()}`, name: name.replace(/\.(csv|json)$/i, "") || "Imported dataset", table: "imported_dataset_preview", records: 8412, category: "Commerce", freshness: "just now", updated: "Oct 28, 2026 · 10:32", description: "Newly parsed source staged for review and schema mapping.", health: 96 }; setDatasets((current) => [...current, imported]); setActiveId(imported.id); setShowImport(false); setPage("datasets"); notify("Dataset imported and staged for review"); };
  const handleDuplicate = (dataset: Dataset) => { const copy = { ...dataset, id: `${dataset.id}-copy-${Date.now()}`, name: `${dataset.name} copy`, freshness: "just now", updated: "Oct 28, 2026 · 10:34" }; setDatasets((current) => [...current, copy]); setActiveId(copy.id); notify(`${dataset.name} duplicated`); };
  const handleEdit = (dataset: Dataset) => { const nextName = window.prompt("Rename dataset", dataset.name); if (!nextName?.trim()) return; setDatasets((current) => current.map((item) => item.id === dataset.id ? { ...item, name: nextName.trim(), updated: "just now" } : item)); notify(`${nextName.trim()} updated`); };
  const handleDelete = (dataset: Dataset) => { if (datasets.length <= 1) { notify("Keep at least one dataset in the registry"); return; } if (!window.confirm(`Delete ${dataset.name}? This simulation removes it from the local registry.`)) return; const next = datasets.filter((item) => item.id !== dataset.id); setDatasets(next); if (activeId === dataset.id) setActiveId(next[0].id); notify(`${dataset.name} deleted from the registry`); };
  return <div className="app-shell"><Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} role={role} setRole={setRole} /><div className="main-shell"><Topbar dataset={activeDataset} role={role} setRole={setRole} onSearch={setSearchTerm} /><main>{page === "overview" && <Overview dataset={activeDataset} datasets={datasets} onDatasetChange={setActiveId} onNavigate={setPage} searchTerm={searchTerm} />}{page === "datasets" && <DatasetsPage datasets={datasets} activeId={activeId} onSelect={setActiveId} onImport={() => setShowImport(true)} onToast={notify} onDuplicate={handleDuplicate} onEdit={handleEdit} onDelete={handleDelete} />}{page === "query" && <QueryPage dataset={activeDataset} onToast={notify} />}{page === "dashboards" && <DashboardsPage onToast={notify} />}{page === "settings" && <SettingsPage role={role} onToast={notify} />}</main></div>{showImport && <ImportModal onClose={() => setShowImport(false)} onImported={handleImport} />}{toast && <Toast message={toast} onClose={() => setToast("")} />}</div>;
}
