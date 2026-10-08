import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Activity, BookOpen, ChevronDown, Gauge, History, Home, Languages, Menu, Settings2, X, MessageSquareText, Info, Wifi, WifiOff, Trash2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useIndicStore } from "@/lib/indiclive";
import { DEFAULT_WS_URL, POLICIES } from "@/config";

const items = [
  { to: "/", label: "Home", icon: Home }, { to: "/live", label: "Live", icon: Activity }, { to: "/conversation", label: "Conversation", icon: MessageSquareText }, { to: "/glossary", label: "Glossary", icon: BookOpen }, { to: "/benchmark", label: "Benchmark", icon: Gauge }, { to: "/history", label: "History", icon: History }, { to: "/about", label: "About", icon: Info },
] as const;

export function PageFrame({ children }: { children: React.ReactNode }) {
  const { pathname } = useRouterState({ select: (s) => s.location });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { settings, saveSettings, clearAll } = useIndicStore();
  const prefersReduced = useReducedMotion();
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const testConnection = () => {
    setTesting(true); setTestMessage("Testing connection…");
    let socket: WebSocket;
    try { socket = new WebSocket(settings.wsUrl); } catch { setTesting(false); setTestMessage("Could not open this address."); return; }
    const timer = window.setTimeout(() => { socket.close(); setTesting(false); setTestMessage("No response within 4 seconds."); }, 4000);
    socket.onopen = () => { window.clearTimeout(timer); socket.close(); setTesting(false); setTestMessage("Connection opened successfully."); };
    socket.onerror = () => { window.clearTimeout(timer); setTesting(false); setTestMessage("Could not reach the backend."); };
  };
  const navLinks = items.map(({ to, label, icon: Icon }) => <Link key={to} to={to} onClick={() => setMobileOpen(false)} className={`nav-link ${pathname === to ? "nav-link-active" : ""}`}><Icon size={15} strokeWidth={1.8} /><span>{label}</span>{pathname === to && <motion.i layoutId="nav-indicator" className="nav-indicator" transition={prefersReduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 24 }} />}</Link>);
  return <div className="app-shell">
    <header className="topbar">
      <Link to="/" className="brand" aria-label="IndicLive home"><span className="brand-mark"><span /></span><span>IndicLive</span></Link>
      <nav className="desktop-nav" aria-label="Main navigation">{navLinks}</nav>
      <div className="top-actions"><span className="status-chip"><span className="status-dot" /> Offline</span><Button variant="ghost" size="icon" aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /></Button><Button className="mobile-menu" variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setMobileOpen((v) => !v)}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</Button></div>
    </header>
    <AnimatePresence>{mobileOpen && <motion.nav className="mobile-nav" initial={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} aria-label="Mobile navigation">{navLinks}</motion.nav>}</AnimatePresence>
    <main className="page-main" key={pathname}>{children}</main>
    <footer className="site-footer"><span>IndicLive</span><span>Built for HackNex 2026 · HNX26EPS03</span><span>Team IndicLive</span></footer>
    <AnimatePresence>{settingsOpen && <>
      <motion.button className="drawer-scrim" aria-label="Close settings" onClick={() => setSettingsOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.aside className="settings-drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title" initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}>
        <div className="drawer-head"><div><span className="eyebrow">PREFERENCES</span><h2 id="settings-title">Settings</h2></div><Button variant="ghost" size="icon" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={18} /></Button></div>
        <label className="field-label" htmlFor="ws-url">Backend WebSocket URL</label><input id="ws-url" className="field-control mono" value={settings.wsUrl} onChange={(e) => saveSettings({ wsUrl: e.target.value })} placeholder={DEFAULT_WS_URL} />
        <p className="field-help">On an https page, use Chrome with ws://localhost:8000/ws, or expose your backend through a tunnel and use a wss:// URL.</p>
        <Button variant="outline" onClick={testConnection} disabled={testing}><Wifi size={15} /> {testing ? "Testing…" : "Test connection"}</Button>{testMessage && <p className="field-help" role="status">{testMessage}</p>}
        <label className="field-label" htmlFor="default-policy">Default policy</label><select id="default-policy" className="field-control" value={settings.policy} onChange={(e) => saveSettings({ policy: e.target.value as typeof settings.policy })}>{POLICIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
        <label className="switch-row"><span><strong>Reduce motion</strong><small>Use simpler transitions and pause decorative motion</small></span><input type="checkbox" checked={settings.reduceMotion} onChange={(e) => saveSettings({ reduceMotion: e.target.checked })} /></label>
        <div className="drawer-bottom"><Button variant="destructive" onClick={() => { if (window.confirm("Clear all saved settings, glossary terms, sessions, and benchmark data?")) { clearAll(); setTestMessage("Local data cleared."); } }}><Trash2 size={15} /> Clear all local data</Button><p className="field-help">This removes saved sessions, terms, imported results, and preferences from this browser.</p></div>
      </motion.aside>
    </>}</AnimatePresence>
  </div>;
}