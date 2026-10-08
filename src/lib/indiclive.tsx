import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_WS_URL, LANGUAGES, POLICIES } from "@/config";

export type Policy = (typeof POLICIES)[number]["value"];
export type LangCode = (typeof LANGUAGES)[number]["code"];
export type CaptionFrame = { t?: number; committed: string; tentative: string; final: boolean; latency?: number; source?: string; detected_lang?: string; confidence?: number; terms?: string[] };
export type SessionMetrics = { firstWordMs: number | null; finalMs: number | null; mtLast: number | null; mtAvg: number | null; mtP95: number | null; rewrittenChars: number; rewriteEvents: number; commitRatio: number | null; updatesPerSecond: number | null };
export type GlossaryTerm = { id: string; source: string; target: string; category: string };
export type BenchmarkRow = { config: string; ttfw: number; final_lat: number; flicker: number; revisions: number; chrf: number; mt: string; n_utterances: number };
export type HistoryItem = { id: string; date: string; sourceLang: string; targetLang: string; policy: string; mode: "live" | "simulated" | "demo"; transcript: string; sourceText: string; metrics: SessionMetrics };
type Settings = { wsUrl: string; policy: Policy; reduceMotion: boolean };
type Store = { settings: Settings; glossary: GlossaryTerm[]; history: HistoryItem[]; benchmark: BenchmarkRow[] };
const KEY = "indiclive.v1";
const seedGlossary: GlossaryTerm[] = [
  { id: "seed-karunya", source: "Karunya", target: "கருண்யா", category: "Name" },
  { id: "seed-coimbatore", source: "Coimbatore", target: "கோயம்புத்தூர்", category: "Place" },
  { id: "seed-hacknex", source: "HackNex", target: "HackNex", category: "Product" },
  { id: "seed-indiclive", source: "IndicLive", target: "IndicLive", category: "Product" },
  { id: "seed-nexus", source: "NEXUS", target: "NEXUS", category: "Technical" },
  { id: "seed-azure", source: "Azure", target: "Azure", category: "Technical" },
];
const defaults: Store = { settings: { wsUrl: DEFAULT_WS_URL, policy: "stable", reduceMotion: false }, glossary: seedGlossary, history: [], benchmark: [] };
type Ctx = Store & { hydrated: boolean; saveSettings: (x: Partial<Settings>) => void; setGlossary: (x: GlossaryTerm[]) => void; setHistory: (x: HistoryItem[]) => void; setBenchmark: (x: BenchmarkRow[]) => void; clearAll: () => void };
const StoreContext = createContext<Ctx | null>(null);

export function IndicLiveProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(defaults);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Store>;
        setStore({ settings: { ...defaults.settings, ...parsed.settings }, glossary: parsed.glossary ?? seedGlossary, history: parsed.history ?? [], benchmark: parsed.benchmark ?? [] });
      }
    } catch { /* retain safe defaults when saved data is invalid */ }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(KEY, JSON.stringify(store)); }, [store, hydrated]);
  const saveSettings = useCallback((x: Partial<Settings>) => setStore((s) => ({ ...s, settings: { ...s.settings, ...x } })), []);
  const setGlossary = useCallback((glossary: GlossaryTerm[]) => setStore((s) => ({ ...s, glossary })), []);
  const setHistory = useCallback((history: HistoryItem[]) => setStore((s) => ({ ...s, history })), []);
  const setBenchmark = useCallback((benchmark: BenchmarkRow[]) => setStore((s) => ({ ...s, benchmark })), []);
  const clearAll = useCallback(() => { localStorage.removeItem(KEY); setStore(defaults); }, []);
  const value = useMemo(() => ({ ...store, hydrated, saveSettings, setGlossary, setHistory, setBenchmark, clearAll }), [store, hydrated, saveSettings, setGlossary, setHistory, setBenchmark, clearAll]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
export function useIndicStore() { const value = useContext(StoreContext); if (!value) throw new Error("IndicLiveProvider is missing"); return value; }

export function emptyMetrics(): SessionMetrics { return { firstWordMs: null, finalMs: null, mtLast: null, mtAvg: null, mtP95: null, rewrittenChars: 0, rewriteEvents: 0, commitRatio: null, updatesPerSecond: null }; }
export function useIndicSession() {
  const { wsUrl, glossary } = useIndicStore();
  const socket = useRef<WebSocket | null>(null);
  const startedAt = useRef<number | null>(null);
  const firstSentAt = useRef<number | null>(null);
  const speechEndedAt = useRef<number | null>(null);
  const previousText = useRef("");
  const mtSamples = useRef<number[]>([]);
  const committedChars = useRef(0);
  const displayChars = useRef(0);
  const updateCount = useRef(0);
  const [status, setStatus] = useState<"offline" | "connecting" | "live" | "error">("offline");
  const [error, setError] = useState("");
  const [frame, setFrame] = useState<CaptionFrame | null>(null);
  const [metrics, setMetrics] = useState<SessionMetrics>(emptyMetrics);
  const cleanup = useCallback(() => { socket.current?.close(); socket.current = null; }, []);
  useEffect(() => cleanup, [cleanup]);
  const connect = useCallback((src: string, tgt: string, policy: Policy) => {
    cleanup(); setError(""); setFrame(null); setMetrics(emptyMetrics()); previousText.current = ""; mtSamples.current = []; committedChars.current = 0; displayChars.current = 0; updateCount.current = 0; startedAt.current = Date.now(); firstSentAt.current = null; speechEndedAt.current = null;
    setStatus("connecting");
    try {
      const url = new URL(wsUrl); url.searchParams.set("src", src); url.searchParams.set("tgt", tgt); url.searchParams.set("policy", policy);
      const ws = new WebSocket(url.toString()); socket.current = ws;
      const timer = window.setTimeout(() => { if (ws.readyState !== WebSocket.OPEN) { setStatus("offline"); setError("Backend offline — unable to open a session."); ws.close(); } }, 4000);
      ws.onopen = () => { clearTimeout(timer); setStatus("live"); ws.send(JSON.stringify({ type: "glossary", terms: glossary.map(({ source, target }) => ({ source, target })) })); };
      ws.onerror = () => { setStatus("offline"); setError("Backend offline — check your WebSocket URL in Settings."); };
      ws.onclose = () => { if (status === "live") setStatus("offline"); };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as CaptionFrame | { error?: string };
          if ("error" in data && data.error) { setError(data.error); setStatus("error"); return; }
          const next = data as CaptionFrame;
          if (typeof next.committed !== "string" || typeof next.tentative !== "string") return;
          const displayed = `${next.committed}${next.tentative ? ` ${next.tentative}` : ""}`.trim();
          if (displayed && firstSentAt.current !== null && metrics.firstWordMs === null) setMetrics((m) => ({ ...m, firstWordMs: Date.now() - firstSentAt.current! }));
          let common = 0; while (common < previousText.current.length && common < displayed.length && previousText.current[common] === displayed[common]) common++;
          const rewritten = Math.max(0, previousText.current.length - common);
          if (rewritten) setMetrics((m) => ({ ...m, rewrittenChars: m.rewrittenChars + rewritten, rewriteEvents: m.rewriteEvents + 1 }));
          previousText.current = displayed;
          committedChars.current += next.committed.length; displayChars.current += displayed.length; updateCount.current += 1;
          if (typeof next.latency === "number") mtSamples.current.push(next.latency * 1000);
          if (next.final && speechEndedAt.current !== null) setMetrics((m) => ({ ...m, finalMs: Date.now() - speechEndedAt.current! }));
          const samples = mtSamples.current.slice().sort((a, b) => a - b);
          setMetrics((m) => ({ ...m, mtLast: typeof next.latency === "number" ? next.latency * 1000 : m.mtLast, mtAvg: samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : m.mtAvg, mtP95: samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * .95))] : m.mtP95, commitRatio: displayChars.current ? committedChars.current / displayChars.current : null, updatesPerSecond: startedAt.current ? updateCount.current / ((Date.now() - startedAt.current) / 1000 || 1) : null }));
          setFrame(next);
        } catch { setError("Received a message that could not be read."); }
      };
    } catch { setStatus("offline"); setError("Backend offline — verify the WebSocket URL in Settings."); }
  }, [cleanup, glossary, metrics.firstWordMs, status, wsUrl]);
  const sendSimulation = useCallback((text: string) => { const ws = socket.current; if (!ws || ws.readyState !== WebSocket.OPEN) return false; if (firstSentAt.current === null) firstSentAt.current = Date.now(); ws.send(JSON.stringify({ type: "sim", text })); return true; }, []);
  const sendAudio = useCallback((audio: ArrayBuffer) => { const ws = socket.current; if (!ws || ws.readyState !== WebSocket.OPEN) return false; if (firstSentAt.current === null) firstSentAt.current = Date.now(); ws.send(audio); return true; }, []);
  const markSpeechEnd = useCallback(() => { speechEndedAt.current = Date.now(); }, []);
  const stop = useCallback(() => { cleanup(); setStatus("offline"); }, [cleanup]);
  return { status, error, frame, metrics, connect, sendSimulation, sendAudio, markSpeechEnd, stop };
}

export function useMicCapture(onChunk: (buffer: ArrayBuffer, rms: number) => void, onSpeechEnd: () => void) {
  const [active, setActive] = useState(false); const [level, setLevel] = useState(0); const [error, setError] = useState("");
  const ctxRef = useRef<AudioContext | null>(null); const streamRef = useRef<MediaStream | null>(null); const nodeRef = useRef<AudioWorkletNode | null>(null); const belowSince = useRef<number | null>(null); const spoke = useRef(false);
  const stop = useCallback(() => { nodeRef.current?.disconnect(); streamRef.current?.getTracks().forEach((t) => t.stop()); void ctxRef.current?.close(); ctxRef.current = null; nodeRef.current = null; streamRef.current = null; setActive(false); setLevel(0); }, []);
  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true } }); streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 }); ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream); const code = `class PCM extends AudioWorkletProcessor { constructor(){ super(); this.buf=[]; } process(inputs){ const ch=inputs[0][0]; if(!ch) return true; let sum=0; for(let i=0;i<ch.length;i++){ this.buf.push(ch[i]); sum+=ch[i]*ch[i]; } const rms=Math.sqrt(sum/ch.length); if(this.buf.length>=1600){ const pcm=new Int16Array(this.buf.length); for(let i=0;i<pcm.length;i++) pcm[i]=Math.max(-1,Math.min(1,this.buf[i]))*32767; this.port.postMessage({buffer:pcm.buffer,rms},[pcm.buffer]); this.buf=[]; } return true; } } registerProcessor('pcm',PCM);`;
      const blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" })); await ctx.audioWorklet.addModule(blobUrl); URL.revokeObjectURL(blobUrl);
      const worklet = new AudioWorkletNode(ctx, "pcm"); const gain = ctx.createGain(); gain.gain.value = 0; source.connect(worklet); worklet.connect(gain); gain.connect(ctx.destination);
      worklet.port.onmessage = (event: MessageEvent<{buffer:ArrayBuffer;rms:number}>) => { const rms = event.data.rms; setLevel(Math.min(1, rms * 16)); onChunk(event.data.buffer, rms); if (rms >= .01) { spoke.current = true; belowSince.current = null; } else if (spoke.current) { if (belowSince.current === null) belowSince.current = Date.now(); else if (Date.now() - belowSince.current >= 500) { spoke.current = false; belowSince.current = null; onSpeechEnd(); } } };
      setActive(true); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Microphone access is unavailable."); stop(); }
  }, [onChunk, onSpeechEnd, stop]);
  useEffect(() => stop, [stop]);
  return { active, level, error, start, stop };
}