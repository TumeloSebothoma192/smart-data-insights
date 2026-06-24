import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { analysisAPI } from '../services/api';
import { AlertTriangle, ArrowLeft, BarChart3, Brain, Database, LineChart as LineIcon, Sparkles, TrendingUp } from 'lucide-react';

const COLORS = ['#00ccff', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

const fmt = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (typeof value === 'number') return value >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return value;
};

function Panel({ title, subtitle, children, action }) {
  return (
    <section className="glass-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-black text-white tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-white/40 mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, detail, icon: Icon, tone = 'cyan', spark = [] }) {
  const toneMap = { cyan: '#00ccff', violet: '#8b5cf6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444' };
  return (
    <div className="glass-card p-5 overflow-hidden relative">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-2xl grid place-items-center" style={{ background: `${toneMap[tone]}22`, border: `1px solid ${toneMap[tone]}55` }}>
          <Icon className="w-5 h-5" style={{ color: toneMap[tone] }} />
        </div>
        {spark.length > 1 && (
          <div className="w-24 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spark}><Line type="monotone" dataKey="value" stroke={toneMap[tone]} strokeWidth={2} dot={false} /></LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="text-3xl font-black tracking-tight">{fmt(value)}</div>
      <div className="text-sm text-white/70 mt-1">{label}</div>
      {detail && <div className="text-xs text-white/35 mt-1">{detail}</div>}
    </div>
  );
}

function ReporterCard({ reporter }) {
  if (!reporter) return null;
  const score = reporter.quality_score ?? 0;
  const statusColor = score >= 85 ? '#22c55e' : score >= 65 ? '#f59e0b' : '#ef4444';
  return (
    <Panel title="Insight Reporter" subtitle="Plain-language analysis generated from the uploaded file">
      <div className="grid lg:grid-cols-[220px_1fr] gap-5 items-stretch">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-5 grid place-items-center text-center">
          <div className="relative w-36 h-36 rounded-full grid place-items-center" style={{ background: `conic-gradient(${statusColor} ${score * 3.6}deg, rgba(255,255,255,.08) 0deg)` }}>
            <div className="absolute inset-3 rounded-full bg-[#090e22]" />
            <div className="relative">
              <div className="text-4xl font-black">{score}%</div>
              <div className="text-xs text-white/45">health score</div>
            </div>
          </div>
          <div className="mt-4 text-sm font-bold" style={{ color: statusColor }}>{reporter.dataset_health}</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            ['Headline', reporter.headline],
            ['Main finding', reporter.main_finding],
            ['Risk', reporter.risk],
            ['Recommendation', reporter.recommendation],
            ['Best ML option', reporter.best_ml_option],
            ['Next action', reporter.next_action],
          ].map(([label, text]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
              <div className="text-[11px] uppercase tracking-[.18em] text-cyan font-mono mb-2">{label}</div>
              <p className="text-sm text-white/70 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

const TooltipBox = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#080d20]/95 px-3 py-2 text-xs shadow-2xl">
      {label && <p className="text-white/50 mb-1">{label}</p>}
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name || p.dataKey}: <b>{fmt(p.value)}</b></p>)}
    </div>
  );
};

export default function AnalyticsPage() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    analysisAPI.getAnalysis(id)
      .then((r) => {
        const a = r.data.analysis;
        setAnalysis(a);
        setSelectedMetric(a.numeric_columns?.[0] || '');
        setSelectedCategory(a.categorical_columns?.[0] || '');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const histogram = useMemo(() => {
    const d = analysis?.distributions?.[selectedMetric];
    if (!d) return [];
    return d.counts.map((count, i) => ({ range: `${fmt(d.bins[i])}–${fmt(d.bins[i + 1])}`, count }));
  }, [analysis, selectedMetric]);

  const categoryData = useMemo(() => {
    const chart = analysis?.category_metrics?.find((x) => x.category_column === selectedCategory) || analysis?.category_metrics?.[0];
    return chart?.points || [];
  }, [analysis, selectedCategory]);

  const pieData = useMemo(() => {
    const dist = analysis?.category_distributions?.[selectedCategory];
    if (!dist) return categoryData.slice(0, 8);
    return dist.labels.slice(0, 8).map((name, i) => ({ name, value: dist.values[i] }));
  }, [analysis, selectedCategory, categoryData]);

  const corrPairs = useMemo(() => {
    const c = analysis?.correlation;
    if (!c?.columns || !c?.matrix) return [];
    const pairs = [];
    for (let i = 0; i < c.columns.length; i++) {
      for (let j = i + 1; j < c.columns.length; j++) {
        const value = c.matrix[i]?.[j];
        if (value !== null && value !== undefined) pairs.push({ pair: `${c.columns[i]} × ${c.columns[j]}`, value });
      }
    }
    return pairs.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 8);
  }, [analysis]);

  if (loading) return <div className="glass-card p-10 text-white/50">Loading analytics dashboard...</div>;
  if (!analysis) return <div className="glass-card p-10 text-white/50">No analysis found. Analyze the dataset first.</div>;

  const rows = analysis.shape?.rows || 0;
  const cols = analysis.shape?.columns || 0;
  const totalCells = rows * cols;
  const spark = analysis.time_series?.points?.length ? analysis.time_series.points : histogram.map((x) => ({ value: x.count }));

  return (
    <div className="space-y-6 max-w-[1500px]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link to={`/dashboard/datasets/${id}`} className="btn-ghost px-3 py-2"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <div className="text-[11px] uppercase tracking-[.22em] text-cyan font-mono">Reporter dashboard</div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight">Data Analysis Command Center</h1>
            <p className="text-white/45 text-sm mt-1">Charts first. Table second. Analyst feedback after every upload.</p>
          </div>
        </div>
        <Link to={`/dashboard/ml/${id}`} className="btn-primary inline-flex items-center gap-2"><Brain className="w-4 h-4" /> Open ML Lab</Link>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi icon={Database} label="Records analyzed" value={rows} detail={`${cols} columns loaded`} tone="cyan" spark={spark} />
        <Kpi icon={BarChart3} label="Total cells" value={totalCells} detail="Rows × columns" tone="violet" spark={spark} />
        <Kpi icon={AlertTriangle} label="Missing values" value={analysis.missing_values?.total || 0} detail={`${analysis.missing_values?.rate || 0}% missing rate`} tone={(analysis.missing_values?.total || 0) > 0 ? 'amber' : 'green'} />
        <Kpi icon={Sparkles} label="Data health" value={`${analysis.reporter?.quality_score || 0}%`} detail={analysis.reporter?.dataset_health} tone={(analysis.reporter?.quality_score || 0) > 75 ? 'green' : 'amber'} />
      </div>

      <ReporterCard reporter={analysis.reporter} />

      <div className="grid xl:grid-cols-[1.45fr_.9fr] gap-6">
        <Panel title="Main Trend Analyzer" subtitle={analysis.time_series ? `${analysis.time_series.metric_column} by ${analysis.time_series.date_column}` : 'Uses a time column when available, otherwise shows numeric distribution'}>
          <div className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              {analysis.time_series?.points?.length ? (
                <LineChart data={analysis.time_series.points} margin={{ left: -15, right: 20 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.08)" />
                  <XAxis dataKey="period" stroke="rgba(255,255,255,.35)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="rgba(255,255,255,.35)" tick={{ fontSize: 11 }} />
                  <Tooltip content={<TooltipBox />} />
                  <Line type="monotone" dataKey="value" stroke="#00ccff" strokeWidth={4} dot={{ r: 3 }} />
                </LineChart>
              ) : (
                <BarChart data={histogram} margin={{ left: -15, right: 20 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.08)" />
                  <XAxis dataKey="range" stroke="rgba(255,255,255,.35)" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis stroke="rgba(255,255,255,.35)" tick={{ fontSize: 11 }} />
                  <Tooltip content={<TooltipBox />} />
                  <Bar dataKey="count" fill="#00ccff" radius={[10, 10, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Category Share" subtitle="Dominant segments in the selected category">
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="select-field mb-4">
            {(analysis.categorical_columns || []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="h-[278px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={72} outerRadius={112} paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<TooltipBox />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <Panel title="Category Breakdown" subtitle="Ranks segments by count or first numeric metric">
          <div className="h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ left: 25, right: 25 }}>
                <CartesianGrid stroke="rgba(255,255,255,.08)" />
                <XAxis type="number" stroke="rgba(255,255,255,.35)" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={95} stroke="rgba(255,255,255,.35)" tick={{ fontSize: 11 }} />
                <Tooltip content={<TooltipBox />} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Numeric Distribution" subtitle="Outlier and spread check for one metric" action={
          <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)} className="select-field text-sm py-2 min-w-[180px]">
            {(analysis.numeric_columns || []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        }>
          <div className="h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram} margin={{ left: -15, right: 20 }}>
                <CartesianGrid stroke="rgba(255,255,255,.08)" />
                <XAxis dataKey="range" stroke="rgba(255,255,255,.35)" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis stroke="rgba(255,255,255,.35)" tick={{ fontSize: 11 }} />
                <Tooltip content={<TooltipBox />} />
                <Bar dataKey="count" fill="#22c55e" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <Panel title="Correlation Finder" subtitle="Strongest feature relationships">
          <div className="h-[285px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={corrPairs} layout="vertical" margin={{ left: 55, right: 25 }}>
                <CartesianGrid stroke="rgba(255,255,255,.08)" />
                <XAxis type="number" domain={[-1, 1]} stroke="rgba(255,255,255,.35)" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="pair" width={150} stroke="rgba(255,255,255,.35)" tick={{ fontSize: 10 }} />
                <Tooltip content={<TooltipBox />} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]}>{corrPairs.map((x, i) => <Cell key={i} fill={x.value >= 0 ? '#00ccff' : '#ef4444'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Relationship Scatter" subtitle={analysis.scatter ? `${analysis.scatter.x} vs ${analysis.scatter.y}` : 'Needs at least two numeric columns'}>
          <div className="h-[285px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: -15, right: 20 }}>
                <CartesianGrid stroke="rgba(255,255,255,.08)" />
                <XAxis type="number" dataKey="x" name={analysis.scatter?.x} stroke="rgba(255,255,255,.35)" tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="y" name={analysis.scatter?.y} stroke="rgba(255,255,255,.35)" tick={{ fontSize: 11 }} />
                <Tooltip content={<TooltipBox />} />
                <Scatter data={analysis.scatter?.points || []} fill="#f59e0b" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Data Preview" subtitle="First 10 rows only — the dashboard remains the main reporting layer">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left">
            <thead><tr>{(analysis.columns || []).map((c) => <th className="table-header" key={c}>{c}</th>)}</tr></thead>
            <tbody>{(analysis.preview || []).map((row, i) => <tr key={i}>{(analysis.columns || []).map((c) => <td className="table-cell font-mono text-xs" key={c}>{row[c] === null || row[c] === undefined ? <span className="text-red-400/70">null</span> : String(row[c]).slice(0, 70)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
