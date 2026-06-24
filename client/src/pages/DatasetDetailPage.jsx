import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { analysisAPI, datasetAPI, insightsAPI } from '../services/api';
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  Database,
  FileText,
  Lightbulb,
  Loader2,
  Play,
  Sparkles,
  Table2,
} from 'lucide-react';
import toast from 'react-hot-toast';

function MetricCard({ label, value, hint, icon: Icon }) {
  return (
    <article className="metric-card">
      <div className="metric-icon"><Icon className="w-5 h-5" /></div>
      <div>
        <div className="text-2xl font-black text-white">{value ?? '—'}</div>
        <p className="text-xs text-white/50">{label}</p>
        {hint && <p className="text-[11px] text-white/30 mt-1">{hint}</p>}
      </div>
    </article>
  );
}

function ReporterPreview({ reporter }) {
  if (!reporter) return null;
  return (
    <section className="report-panel">
      <div className="rounded-3xl bg-black/25 border border-white/10 p-5 text-center">
        <div className="text-5xl font-black text-cyan-300">{reporter.quality_score}%</div>
        <p className="text-xs uppercase tracking-[.18em] text-white/35 mt-1">Data health</p>
        <span className="badge mt-4 inline-block">{reporter.dataset_health}</span>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[.25em] text-cyan-300 font-mono">Reporter preview</p>
          <h2 className="text-2xl font-black mt-1">{reporter.headline}</h2>
          <p className="text-white/60 leading-relaxed mt-2">{reporter.main_finding}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="feedback-tile"><b className="text-amber-300">Risk</b><p>{reporter.risk}</p></div>
          <div className="feedback-tile"><b className="text-violet-300">ML option</b><p>{reporter.best_ml_option}</p></div>
          <div className="feedback-tile"><b className="text-emerald-300">Next step</b><p>{reporter.next_action}</p></div>
        </div>
      </div>
    </section>
  );
}

export default function DatasetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const loadDataset = async () => {
    const response = await datasetAPI.getOne(id);
    setDataset(response.data.dataset);
    return response.data.dataset;
  };

  useEffect(() => {
    setLoading(true);
    loadDataset()
      .catch(() => toast.error('Dataset not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const runAnalysisAndOpenReport = async () => {
    setAnalyzing(true);
    try {
      toast.loading('Python is analyzing your file...', { id: 'analyze' });
      await analysisAPI.process(id);
      toast.loading('Generating reporter feedback...', { id: 'analyze' });
      await insightsAPI.generate(id).catch(() => null);
      await loadDataset();
      toast.success('Report ready', { id: 'analyze' });
      navigate(`/dashboard/insights/${id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Analysis failed', { id: 'analyze' });
    } finally {
      setAnalyzing(false);
    }
  };

  const columns = dataset?.analysis?.columns || dataset?.metadata?.columnNames || [];
  const preview = dataset?.analysis?.preview || [];
  const reporter = dataset?.analysis?.reporter;
  const status = dataset?.status || 'uploaded';

  const statusClass = useMemo(() => {
    if (status === 'processed') return 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10';
    if (status === 'error') return 'text-red-300 border-red-400/30 bg-red-400/10';
    if (status === 'processing') return 'text-amber-300 border-amber-400/30 bg-amber-400/10';
    return 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10';
  }, [status]);

  if (loading) {
    return (
      <div className="glass-card p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-300 mx-auto" />
        <p className="text-white/45 text-sm mt-3">Loading dataset...</p>
      </div>
    );
  }

  if (!dataset) return <div className="glass-card p-8 text-white/50">Dataset not found.</div>;

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-400/10 border border-cyan-400/25 grid place-items-center">
              <Database className="w-6 h-6 text-cyan-300" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[.24em] text-cyan-300 font-mono">Dataset workspace</p>
              <h1 className="text-3xl lg:text-4xl font-black text-white">{dataset.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-sm text-white/45">
            <span>{dataset.originalName}</span>
            <span>•</span>
            <span className={`px-3 py-1 rounded-full border text-xs capitalize ${statusClass}`}>{status}</span>
            <span className="badge">{dataset.fileType?.toUpperCase()}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={runAnalysisAndOpenReport}
            disabled={analyzing}
            className="btn-primary inline-flex items-center gap-2"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {analyzing ? 'Building report...' : status === 'processed' ? 'Re-analyze & open report' : 'Analyze & open report'}
          </button>
          {status === 'processed' && (
            <>
              <Link className="btn-ghost inline-flex items-center gap-2" to={`/dashboard/analytics/${id}`}><BarChart3 className="w-4 h-4" /> Charts</Link>
              <Link className="btn-ghost inline-flex items-center gap-2" to={`/dashboard/ml/${id}`}><Brain className="w-4 h-4" /> ML Lab</Link>
              <Link className="btn-ghost inline-flex items-center gap-2" to={`/dashboard/insights/${id}`}><Lightbulb className="w-4 h-4" /> Report</Link>
            </>
          )}
        </div>
      </header>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={FileText} label="Rows" value={dataset.metadata?.rows?.toLocaleString()} hint="Records detected" />
        <MetricCard icon={Table2} label="Columns" value={dataset.metadata?.columns} hint="Features available" />
        <MetricCard icon={AlertTriangle} label="Missing values" value={dataset.metadata?.missingValues?.toLocaleString() ?? '—'} hint="Data quality signal" />
        <MetricCard icon={CheckCircle2} label="Report status" value={status === 'processed' ? 'Ready' : 'Pending'} hint="Click Analyze to build" />
      </section>

      {reporter ? (
        <ReporterPreview reporter={reporter} />
      ) : (
        <section className="glass-card p-8 text-center">
          <Sparkles className="w-10 h-10 text-cyan-300 mx-auto mb-3" />
          <h2 className="text-xl font-black">No report yet</h2>
          <p className="text-white/45 text-sm mt-2 max-w-xl mx-auto">
            Click <b>Analyze & open report</b>. Python will clean the file, prepare chart data, calculate data quality, and generate reporter feedback.
          </p>
        </section>
      )}

      {preview.length > 0 && (
        <section className="glass-card overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-lg">Data preview</h2>
              <p className="text-xs text-white/35">First 10 rows only. The full dataset is visualized in Charts and Report.</p>
            </div>
            <Link to={`/dashboard/analytics/${id}`} className="btn-ghost text-sm">Open charts</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead><tr>{columns.map((column) => <th className="table-header text-left" key={column}>{column}</th>)}</tr></thead>
              <tbody>
                {preview.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-white/[.025]">
                    {columns.map((column) => <td className="table-cell" key={column}>{String(row[column] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
