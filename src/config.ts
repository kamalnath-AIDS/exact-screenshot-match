export const TEAM_NAME = "Team IndicLive";
export const DEFAULT_WS_URL = "ws://localhost:8000/ws";

export const LANGUAGES = [
  { code: "en", name: "English", native: "English", font: "font-ui" },
  { code: "ta", name: "Tamil", native: "தமிழ்", font: "font-tamil" },
  { code: "hi", name: "Hindi", native: "हिन्दी", font: "font-devanagari" },
  { code: "te", name: "Telugu", native: "తెలుగు", font: "font-telugu" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", font: "font-kannada" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", font: "font-malayalam" },
] as const;

export const POLICIES = [
  { value: "stable", label: "IndicLive Stable" },
  { value: "stable3", label: "Cautious (k=3)" },
  { value: "aggressive", label: "Aggressive" },
  { value: "sentence_end", label: "Baseline (wait for sentence end)" },
] as const;