import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Brain,
  Database,
  LayoutDashboard,
  LogOut,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const navItems = [
  { to: '/dashboard', label: 'Command Center', icon: LayoutDashboard, end: true },
  { to: '/dashboard/upload', label: 'Upload Data', icon: Upload },
  { to: '/dashboard/datasets', label: 'Datasets', icon: Database },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="lg:w-72 p-4 border-r border-white/10 bg-black/25 backdrop-blur-xl lg:min-h-screen">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-2xl bg-cyan-300 grid place-items-center shadow-[0_0_30px_rgba(34,211,238,.25)]">
            <Activity className="text-slate-950" />
          </div>
          <div>
            <b className="text-white">Smart Insights</b>
            <p className="text-xs text-cyan-300 font-mono">Data Science OS</p>
          </div>
        </div>

        <nav className="space-y-2">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} end={end} to={to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-8 rounded-3xl bg-white/[.035] border border-white/10 p-4">
          <div className="flex items-center gap-2 text-cyan-300 text-sm font-bold mb-2">
            <Sparkles size={16} /> Workflow
          </div>
          <ol className="space-y-2 text-xs text-white/45 leading-relaxed">
            <li>1. Upload a dataset</li>
            <li>2. Analyze & open report</li>
            <li>3. Explore charts</li>
            <li>4. Train ML model</li>
          </ol>
        </div>

        <div className="mt-8 rounded-3xl bg-white/[.035] border border-white/10 p-4">
          <div className="text-sm font-bold text-white truncate">{user?.name}</div>
          <div className="text-xs text-white/35 truncate">{user?.email}</div>
        </div>

        <button onClick={handleLogout} className="sidebar-link mt-3 w-full">
          <LogOut size={18} /> Sign out
        </button>

        <div className="mt-8 grid grid-cols-2 gap-2 text-center text-xs text-white/40">
          <div className="rounded-2xl bg-white/[.035] border border-white/10 p-3"><BarChart3 className="w-4 h-4 mx-auto mb-1 text-cyan-300" />Charts</div>
          <div className="rounded-2xl bg-white/[.035] border border-white/10 p-3"><Brain className="w-4 h-4 mx-auto mb-1 text-violet-300" />ML Lab</div>
        </div>
      </aside>

      <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
