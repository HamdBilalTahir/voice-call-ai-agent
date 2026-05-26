"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, X, Play, Pause, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getIdToken } from "@/contexts/AuthContext";

interface GeminiVoice {
  name: string;
  tone: string;
  gender: "Male" | "Female";
  character:
    | "Bright"
    | "Warm"
    | "Clear"
    | "Deep"
    | "Smooth"
    | "Authoritative"
    | "Energetic";
}

const GEMINI_VOICES: GeminiVoice[] = [
  // Female — Bright
  { name: "Zephyr", tone: "Bright", gender: "Female", character: "Bright" },
  { name: "Leda", tone: "Youthful", gender: "Female", character: "Bright" },
  { name: "Autonoe", tone: "Bright", gender: "Female", character: "Bright" },
  { name: "Laomedeia", tone: "Upbeat", gender: "Female", character: "Bright" },
  // Male — Bright / Energetic
  { name: "Puck", tone: "Upbeat", gender: "Male", character: "Bright" },
  { name: "Fenrir", tone: "Excitable", gender: "Male", character: "Energetic" },
  { name: "Sadachbia", tone: "Lively", gender: "Male", character: "Energetic" },
  // Female — Warm
  { name: "Aoede", tone: "Breezy", gender: "Female", character: "Warm" },
  {
    name: "Callirrhoe",
    tone: "Easy-going",
    gender: "Female",
    character: "Warm",
  },
  { name: "Despina", tone: "Smooth", gender: "Female", character: "Warm" },
  { name: "Sulafat", tone: "Warm", gender: "Female", character: "Warm" },
  { name: "Vindemiatrix", tone: "Gentle", gender: "Female", character: "Warm" },
  { name: "Achernar", tone: "Soft", gender: "Female", character: "Warm" },
  { name: "Erinome", tone: "Clear", gender: "Female", character: "Warm" },
  // Male — Warm
  { name: "Enceladus", tone: "Breathy", gender: "Male", character: "Warm" },
  { name: "Achird", tone: "Friendly", gender: "Male", character: "Warm" },
  // Female — Authoritative / Clear
  { name: "Kore", tone: "Firm", gender: "Female", character: "Authoritative" },
  {
    name: "Pulcherrima",
    tone: "Forward",
    gender: "Female",
    character: "Authoritative",
  },
  // Male — Authoritative / Clear
  { name: "Charon", tone: "Informative", gender: "Male", character: "Clear" },
  { name: "Iapetus", tone: "Clear", gender: "Male", character: "Clear" },
  { name: "Schedar", tone: "Even", gender: "Male", character: "Clear" },
  {
    name: "Rasalgethi",
    tone: "Informative",
    gender: "Male",
    character: "Clear",
  },
  { name: "Alnilam", tone: "Firm", gender: "Male", character: "Authoritative" },
  {
    name: "Sadaltager",
    tone: "Knowledgeable",
    gender: "Male",
    character: "Authoritative",
  },
  // Male — Deep
  { name: "Orus", tone: "Firm", gender: "Male", character: "Deep" },
  { name: "Algenib", tone: "Gravelly", gender: "Male", character: "Deep" },
  { name: "Gacrux", tone: "Mature", gender: "Male", character: "Deep" },
  // Male — Smooth
  { name: "Algieba", tone: "Smooth", gender: "Male", character: "Smooth" },
  { name: "Umbriel", tone: "Easy-going", gender: "Male", character: "Smooth" },
  {
    name: "Zubenelgenubi",
    tone: "Casual",
    gender: "Male",
    character: "Smooth",
  },
];

const GENDER_OPTIONS = ["Female", "Male"] as const;
const CHARACTER_OPTIONS = [
  "Bright",
  "Warm",
  "Clear",
  "Authoritative",
  "Deep",
  "Smooth",
  "Energetic",
] as const;

interface GeminiVoicePickerModalProps {
  value: string;
  onSelect: (voice: string) => void;
  onClose: () => void;
  configId?: string;
}

export function GeminiVoicePickerModal({
  value,
  onSelect,
  onClose,
  configId,
}: GeminiVoicePickerModalProps) {
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<string | null>(null);
  const [characterFilter, setCharacterFilter] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPlayingVoice(null);
    setLoadingVoice(null);
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const togglePlay = async (voice: GeminiVoice) => {
    if (playingVoice === voice.name) {
      stopAudio();
      return;
    }
    stopAudio();
    setLoadingVoice(voice.name);
    try {
      const params = new URLSearchParams({ voice: voice.name });
      if (configId) params.set("configId", configId);
      const token = await getIdToken().catch(() => null);
      const res = await fetch(`/api/gemini/voice-preview?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Preview unavailable");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingVoice(voice.name);
      setLoadingVoice(null);
      audio.play().catch(() => setPlayingVoice(null));
      audio.onended = () => {
        setPlayingVoice(null);
        URL.revokeObjectURL(url);
      };
    } catch {
      setLoadingVoice(null);
    }
  };

  const filtered = GEMINI_VOICES.filter((v) => {
    if (
      search &&
      !v.name.toLowerCase().includes(search.toLowerCase()) &&
      !v.tone.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    if (genderFilter && v.gender !== genderFilter) return false;
    if (characterFilter && v.character !== characterFilter) return false;
    return true;
  });

  const FilterPill = ({
    label,
    active,
    onClick,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Select a Gemini voice
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Language follows your agent&apos;s system prompt — not the voice.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or tone…"
              className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 pt-3 pb-3 flex flex-wrap items-center gap-1.5 border-b border-border shrink-0">
          <span className="text-xs text-muted-foreground mr-1">Gender:</span>
          {GENDER_OPTIONS.map((g) => (
            <FilterPill
              key={g}
              label={g}
              active={genderFilter === g}
              onClick={() => setGenderFilter((prev) => (prev === g ? null : g))}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-3 mr-1">
            Character:
          </span>
          {CHARACTER_OPTIONS.map((c) => (
            <FilterPill
              key={c}
              label={c}
              active={characterFilter === c}
              onClick={() =>
                setCharacterFilter((prev) => (prev === c ? null : c))
              }
            />
          ))}
          {(genderFilter || characterFilter) && (
            <button
              type="button"
              onClick={() => {
                setGenderFilter(null);
                setCharacterFilter(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground ml-1 underline underline-offset-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Voice list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              No voices match.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((voice) => {
                const isSelected = voice.name === value;
                const isPlaying = playingVoice === voice.name;
                const isLoading = loadingVoice === voice.name;

                return (
                  <li
                    key={voice.name}
                    className={`flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors ${
                      isSelected ? "bg-primary/5" : ""
                    }`}
                  >
                    {/* Play button */}
                    <button
                      type="button"
                      onClick={() => void togglePlay(voice)}
                      disabled={isLoading}
                      title={isPlaying ? "Pause" : "Preview voice"}
                      className="shrink-0 flex items-center justify-center size-8 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? (
                        <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="size-3.5" />
                      ) : (
                        <Play className="size-3.5 translate-x-px" />
                      )}
                    </button>

                    {/* Name + metadata */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {voice.name}
                      </p>
                      <div className="flex gap-1.5 mt-1">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${voice.gender === "Female" ? "bg-pink-500/10 text-pink-500" : "bg-blue-500/10 text-blue-500"}`}
                        >
                          {voice.gender}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {voice.tone}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500">
                          {voice.character}
                        </span>
                      </div>
                    </div>

                    {/* Select */}
                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => {
                        onSelect(voice.name);
                        stopAudio();
                        onClose();
                      }}
                      className="shrink-0"
                    >
                      {isSelected ? (
                        <>
                          <Check className="size-3.5 mr-1" /> Selected
                        </>
                      ) : (
                        "Select"
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-2.5 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {GEMINI_VOICES.length} voices · No
            language/accent filter — language follows the system prompt ·
            Previews via Gemini TTS
          </p>
        </div>
      </div>
    </div>
  );
}
