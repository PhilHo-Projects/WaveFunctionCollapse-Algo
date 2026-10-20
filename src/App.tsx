import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import ExplainerMode from './pages/ExplainerMode';
import BuilderMode from './pages/BuilderMode';
import TownscaperMode from './pages/TownscaperMode';
import TownscaperGenMode from './pages/TownscaperGenMode';
const Townscaper3DProcedural = lazy(() => import('./pages/Townscaper3DMode'));
const Townscaper3DBuilder = lazy(() => import('./pages/Townscaper3DBuilderLevel'));
const CanalTown = lazy(() => import('./canal/CanalTown'));

const AppLayout = ({ children }: { children: React.ReactNode }) => {
    const navLinkClass = ({ isActive }: { isActive: boolean }) =>
        `px-4 py-1.5 rounded-md transition-all text-xs font-bold uppercase tracking-widest ${isActive ? 'bg-[#52ffd8]/10 text-[#52ffd8] border border-[#52ffd8]/30 shadow-[0_0_15px_rgba(82,255,216,0.15)]' : 'text-[#8892b0] hover:bg-[#112240] hover:text-[#e6f1ff]'}`;

    return (
        <div className="flex flex-col min-h-screen w-full">
            <header className="text-center pt-5 pb-3 px-6 border-b border-[--border] bg-gradient-to-b from-[--bg-secondary] to-[var(--bg-primary)] flex flex-col items-center gap-4">
                <div>
                    <h1 className="text-[--accent] tracking-tight">Wave Function Collapse</h1>
                    <p className="text-[--text-secondary] text-sm mt-0.5">Interactive Algorithms</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                    <NavLink to="/" className={navLinkClass}>Canal Town</NavLink>
                    <NavLink to="/learn" className={navLinkClass}>Explainer</NavLink>
                    <NavLink to="/builder" className={navLinkClass}>Builder</NavLink>
                    <NavLink to="/townscaper" className={navLinkClass}>Townscaper (Builder)</NavLink>
                    <NavLink to="/townscaper-gen" className={navLinkClass}>Townscaper (Procedural)</NavLink>
                    <NavLink to="/townscaper-builder-3d" className={navLinkClass}>3D Builder</NavLink>
                    <NavLink to="/townscaper-procedural-3d" className={navLinkClass}>3D Procedural</NavLink>
                </div>
            </header>
            <main className="flex flex-1 flex-col md:flex-row max-w-6xl w-full mx-auto justify-center items-start pt-6 gap-6">{children}</main>
        </div>
    );
};

export default function App() {
    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Suspense fallback={<div style={{padding:40}}>Opening the town…</div>}>
              <Routes>
                <Route path="/" element={<CanalTown />} />
                <Route path="/learn" element={<AppLayout><ExplainerMode /></AppLayout>} />
                <Route path="/builder" element={<AppLayout><BuilderMode /></AppLayout>} />
                <Route path="/townscaper" element={<AppLayout><TownscaperMode /></AppLayout>} />
                <Route path="/townscaper-gen" element={<AppLayout><TownscaperGenMode /></AppLayout>} />
                <Route path="/townscaper-builder-3d" element={<AppLayout><Townscaper3DBuilder /></AppLayout>} />
                <Route path="/townscaper-procedural-3d" element={<AppLayout><Townscaper3DProcedural /></AppLayout>} />
                <Route path="*" element={<AppLayout><p>That place isn’t on this map. <NavLink to="/">Return to Canal Town</NavLink>.</p></AppLayout>} />
              </Routes>
            </Suspense>
        </BrowserRouter>
    );
}
