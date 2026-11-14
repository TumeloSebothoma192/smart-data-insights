import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { analysisAPI, insightsAPI } from '../services/api';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Lightbulb,
  Loader2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';

function FeedbackBlock({ title, items = [], icon: Icon, tone = 'cyan' }) {
  const toneClass = {
    cyan: 'text-cyan-300 border-cyan-400/25 bg-cyan-400/10',
    amber: 'text-amber-300 border-amber-400/25 bg-amber-400/10',
    green: 'text-emerald-300 border-emerald-400/25 bg-emerald-400/10',
    violet: 'text-violet-300 border-violet-400/25 bg-violet-400/10',
  }[tone];

  return (
    <section className="glass-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-2xl border grid place-items-center ${toneClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      {items.length ? (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li key={index} className="rounded-2xl bg-white/[.035] border border-white/10 p-4 text-sm text-white/65 leading-relaxed">
              {String(item).replace(/\*\*/g, '')}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-white/35">No feedback generated for this section yet.</p>
      )}
    </section>
  );
}

function ScoreRing({ score = 0, label = 'Pending' }) {
  const circumference = 2 * Math.PI * 46;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <div className="rounded-3xl bg-black/25 border border-white/10 p-5 text-center">
      <div className="relative w-32 h-32 mx-auto">
        <svg viewBox="0 0 120 120" className="w-32 h-32 rotate-[-90deg]">
          <circle cx="60" cy="60" r="46" stroke="rgba(255,255,255,.09)" strokeWidth="11" fill="none" />
          <circle cx="60" cy="60" r="46" stroke="currentColor" strokeWidth="11" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="text-cyan-300" />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div>
            <div className="text-2xl font-black text-white">{score}%</div>
            <p className="text-[10px] uppercase tracking-[.14em] text-white/35">quality</p>
          </div>
        </div>
      </div>
      <span className="badge mt-4 inline-block">File: {label}</span>
    </div>
  );
}

const money = (v) => (v == null ? '—' : `${v < 0 ? '-' : ''}R${Math.abs(v).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`);
const RISK_TONE = {
  High: 'text-rose-300 border-rose-400/40 bg-rose-500/10',
  Medium: 'text-amber-300 border-amber-400/40 bg-amber-500/10',
  Low: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10',
};
const FLAG_DOT = { high: 'bg-rose-400', medium: 'bg-amber-400', low: 'bg-emerald-400' };

function FinancialRisk({ st }) {
  const tone = RISK_TONE[st.risk_level] || RISK_TONE.Medium;
  const tiles = [
    ['Income', money(st.income_total)],
    ['Spending', money(st.spending_total)],
    ['Net cash flow', money(st.net_cash_flow)],
    ['Debt-to-income', st.debt_to_income_pct == null ? '—' : `${Math.round(st.debt_to_income_pct)}%`],
    ['Lowest balance', money(st.lowest_balance)],
    ['Days overdrawn', `${Math.round(st.negative_balance_pct)}% of txns`],
  ];
  const maxPct = Math.max(1, ...st.spending_by_category.map((c) => c.pct));
  return (
    <section className="glass-card p-5 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[.25em] text-cyan-300 font-mono">Bank statement detected</p>
          <h2 className="text-2xl font-black mt-1">Financial risk</h2>
          <p className="text-sm text-white/45 mt-1">{st.period.start} to {st.period.end} · {st.transactions} transactions</p>
        </div>
        <div className={`rounded-2xl border px-5 py-3 text-center ${tone}`}>
          <div className="text-3xl font-black">{st.risk_level.toUpperCase()}</div>
          <div className="text-[11px] opacity-80">risk score {st.risk_score}/100</div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white/[.035] border border-white/10 p-3">
            <p className="text-xs text-white/45">{label}</p>
            <b className="text-lg">{value}</b>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div>
          <h3 className="font-bold mb-3">Why</h3>
          <ul className="space-y-2">
            {st.flags.map((f, i) => (
              <li key={i} className="flex gap-3 text-sm text-white/70">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${FLAG_DOT[f.level] || FLAG_DOT.medium}`} />
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-bold mb-3">Where the money goes</h3>
          <ul className="space-y-2">
            {st.spending_by_category.slice(0, 7).map((c) => (
              <li key={c.category} className="text-sm">
                <div className="flex justify-between text-white/70"><span className="capitalize">{c.category}</span><span>{money(c.amount)} · {Math.round(c.pct)}%</span></div>
                <div className="h-1.5 rounded-full bg-white/10 mt-1"><div className={`h-1.5 rounded-full ${c.category === 'debt' ? 'bg-rose-400' : 'bg-cyan-300'}`} style={{ width: `${(c.pct / maxPct) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function InsightsPage() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function generateFeedback() {
    setGenerating(true);
    try {
      const response = await insightsAPI.generate(id);
      setInsights(response.data.insights);
      toast.success('Reporter feedback generated');
      return response.data.insights;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate feedback');
      return null;
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [analysisResponse, insightsResponse] = await Promise.all([
          analysisAPI.getAnalysis(id),
          insightsAPI.get(id).catch(() => ({ data: { insights: null } })),
        ]);
        if (!mounted) return;
        setAnalysis(analysisResponse.data.analysis);
        setInsights(insightsResponse.data.insights);
        if (!insightsResponse.data.insights) {
          await generateFeedback();
        }
      } catch (error) {
        toast.error('Analyze the dataset first to generate a report');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [id]);

  const reporter = analysis?.reporter;
  const quickStats = insights?.quick_stats || {};

  const reportText = useMemo(() => {
    if (!analysis && !insights) return '';
    const lines = [
      'SMART DATA INSIGHTS REPORT',
      '==========================',
      '',
      reporter?.headline || 'Dataset report',
      reporter?.main_finding || '',
      '',
      ...(analysis?.statement ? [`Financial risk: ${analysis.statement.risk_level} (${analysis.statement.risk_score}/100)`, ...analysis.statement.flags.map((f) => `  - ${f.text}`)] : []),
      `Data quality: ${reporter?.quality_score ?? quickStats.data_quality_score ?? '—'}%`,
      `Risk: ${reporter?.risk || '—'}`,
      `ML recommendation: ${reporter?.best_ml_option || '—'}`,
      `Next action: ${reporter?.next_action || '—'}`,
      '',
      'Executive summary:',
      ...(insights?.summary || []).map((item) => `- ${String(item).replace(/\*\*/g, '')}`),
      '',
      'Trends:',
      ...(insights?.trends || []).map((item) => `- ${String(item).replace(/\*\*/g, '')}`),
      '',
      'Risks:',
      ...(insights?.risks || []).map((item) => `- ${String(item).replace(/\*\*/g, '')}`),
      '',
      'Recommendations:',
      ...(insights?.recommendations || []).map((item) => `- ${String(item).replace(/\*\*/g, '')}`),
    ];
    return lines.join('\n');
  }, [analysis, insights, quickStats, reporter]);

  function downloadReport() {
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'smart-data-insights-report.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="glass-card p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-300 mx-auto" />
        <p className="text-sm text-white/45 mt-3">Building analyst report...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="glass-card p-8 text-center">
        <h1 className="text-2xl font-black">No analysis found</h1>
        <p className="text-white/45 mt-2">Go back to the dataset and click Analyze & open report.</p>
        <Link className="btn-primary inline-block mt-5" to={`/dashboard/datasets/${id}`}>Back to dataset</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link to={`/dashboard/datasets/${id}`} className="btn-ghost px-3 py-2" aria-label="Back to dataset"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <p className="text-[11px] uppercase tracking-[.25em] text-cyan-300 font-mono">Analyzer feedback</p>
            <h1 className="text-3xl lg:text-4xl font-black">Insight Reporter</h1>
            <p className="text-white/45 text-sm mt-1">Readable feedback after the charts: findings, risks, ML recommendation, and next actions.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={generateFeedback} disabled={generating} className="btn-primary inline-flex items-center gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Refresh feedback'}
          </button>
          <button onClick={downloadReport} className="btn-ghost inline-flex items-center gap-2"><Download className="w-4 h-4" /> Export TXT</button>
        </div>
      </header>

      {reporter && (
        <section className="report-panel">
          <ScoreRing score={reporter.quality_score} label={reporter.dataset_health} />
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-black">{reporter.headline}</h2>
              <p className="text-white/65 leading-relaxed mt-2">{reporter.main_finding}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="feedback-tile"><b className="text-amber-300">Risk</b><p>{reporter.risk}</p></div>
              <div className="feedback-tile"><b className="text-violet-300">{analysis.statement ? 'Machine learning' : 'Best ML option'}</b><p>{reporter.best_ml_option}</p></div>
              <div className="feedback-tile"><b className="text-emerald-300">Next action</b><p>{reporter.next_action}</p></div>
            </div>
          </div>
        </section>
      )}

      {analysis.statement && <FinancialRisk st={analysis.statement} />}

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="metric-card"><CheckCircle2 className="w-5 h-5 text-emerald-300" /><div><b className="text-2xl">{analysis.shape?.rows?.toLocaleString()}</b><p className="text-xs text-white/45">Records analyzed</p></div></div>
        <div className="metric-card"><FileText className="w-5 h-5 text-cyan-300" /><div><b className="text-2xl">{analysis.shape?.columns}</b><p className="text-xs text-white/45">Columns detected</p></div></div>
        <div className="metric-card"><ShieldAlert className="w-5 h-5 text-amber-300" /><div><b className="text-2xl">{analysis.missing_values?.rate ?? 0}%</b><p className="text-xs text-white/45">Missing data rate</p></div></div>
        <div className="metric-card"><TrendingUp className="w-5 h-5 text-violet-300" /><div><b className="text-2xl">{analysis.numeric_columns?.length ?? 0}</b><p className="text-xs text-white/45">Numeric features</p></div></div>
      </section>

      {insights ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <FeedbackBlock title="Executive Summary" icon={FileText} items={insights.summary} tone="cyan" />
          <FeedbackBlock title="Trend Analyzer" icon={TrendingUp} items={insights.trends} tone="violet" />
          <FeedbackBlock title="Data Risks" icon={ShieldAlert} items={insights.risks} tone="amber" />
          <FeedbackBlock title="Recommendations" icon={Lightbulb} items={insights.recommendations} tone="green" />
        </div>
      ) : (
        <div className="glass-card p-8 text-white/45">Reporter feedback is not available yet. Click Refresh feedback.</div>
      )}
    </div>
  );
}
