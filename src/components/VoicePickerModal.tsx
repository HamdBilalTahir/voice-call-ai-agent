"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Play, Pause, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getIdToken } from "@/contexts/AuthContext";

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  preview_url?: string;
  labels?: {
    gender?: string;
    accent?: string;
    age?: string;
    description?: string;
    use_case?: string;
  };
}

interface VoicePickerModalProps {
  value: string;
  onSelect: (voiceId: string, voiceName: string) => void;
  onClose: () => void;
  configId?: string;
}

const GENDER_OPTIONS = ["Male", "Female"];
const AGE_OPTIONS = ["Young", "Middle Aged", "Old"];
const USE_CASE_OPTIONS = [
  "Conversational",
  "Narration",
  "News Presenter",
  "Characters",
  "Assistant",
];

function normalise(s?: string) {
  return (s ?? "").toLowerCase().replace(/_/g, " ").trim();
}

function matchesFilter(voice: ElevenLabsVoice, filter: string, value: string) {
  const norm = normalise(
    filter === "gender"
      ? voice.labels?.gender
      : filter === "age"
        ? voice.labels?.age
        : filter === "use_case"
          ? voice.labels?.use_case
          : filter === "accent"
            ? voice.labels?.accent
            : undefined,
  );
  return norm === value.toLowerCase();
}

export function VoicePickerModal({
  value,
  onSelect,
  onClose,
  configId,
}: VoicePickerModalProps) {
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<string | null>(null);
  const [ageFilter, setAgeFilter] = useState<string | null>(null);
  const [useCaseFilter, setUseCaseFilter] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (configId) params.set("configId", configId);
        const token = await getIdToken().catch(() => null);
        const res = await fetch(`/api/elevenlabs/voices?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load voices");
        }
        const data: ElevenLabsVoice[] = await res.json();
        if (mounted) setVoices(data);
      } catch (err) {
        if (mounted)
          setError(
            err instanceof Error ? err.message : "Failed to load voices",
          );
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [configId]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const togglePlay = (voice: ElevenLabsVoice) => {
    if (playingId === voice.voice_id) {
      stopAudio();
      return;
    }
    stopAudio();
    if (!voice.preview_url) return;
    const audio = new Audio(voice.preview_url);
    audioRef.current = audio;
    setPlayingId(voice.voice_id);
    audio.play().catch(() => setPlayingId(null));
    audio.onended = () => setPlayingId(null);
  };

  const filtered = voices.filter((v) => {
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        v.name,
        v.labels?.accent,
        v.labels?.description,
        v.labels?.use_case,
        v.labels?.gender,
        v.labels?.age,
        v.category,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (genderFilter && !matchesFilter(v, "gender", genderFilter)) return false;
    if (ageFilter && !matchesFilter(v, "age", ageFilter)) return false;
    if (useCaseFilter && !matchesFilter(v, "use_case", useCaseFilter))
      return false;
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

  const toggle = (
    current: string | null,
    value: string,
    set: (v: string | null) => void,
  ) => set(current === value ? null : value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">
            Select a voice
          </h2>
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
              placeholder="Search voices…"
              className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 pt-3 pb-3 flex flex-wrap gap-1.5 shrink-0 border-b border-border">
          <span className="text-xs text-muted-foreground self-center mr-1">
            Gender:
          </span>
          {GENDER_OPTIONS.map((g) => (
            <FilterPill
              key={g}
              label={g}
              active={genderFilter === g}
              onClick={() => toggle(genderFilter, g, setGenderFilter)}
            />
          ))}
          <span className="text-xs text-muted-foreground self-center ml-2 mr-1">
            Age:
          </span>
          {AGE_OPTIONS.map((a) => (
            <FilterPill
              key={a}
              label={a}
              active={ageFilter === a}
              onClick={() => toggle(ageFilter, a, setAgeFilter)}
            />
          ))}
          <span className="text-xs text-muted-foreground self-center ml-2 mr-1">
            Use:
          </span>
          {USE_CASE_OPTIONS.map((u) => (
            <FilterPill
              key={u}
              label={u}
              active={useCaseFilter === u}
              onClick={() => toggle(useCaseFilter, u, setUseCaseFilter)}
            />
          ))}
          {(genderFilter || ageFilter || useCaseFilter) && (
            <button
              type="button"
              onClick={() => {
                setGenderFilter(null);
                setAgeFilter(null);
                setUseCaseFilter(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground ml-1 underline underline-offset-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Voice list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Loading voices…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-8">
              <p className="text-sm text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground">
                Make sure your ElevenLabs API key is configured in the API key
                picker above.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              No voices match your filters.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((voice) => {
                const isSelected = voice.voice_id === value;
                const isPlaying = playingId === voice.voice_id;
                const tags = [
                  voice.labels?.gender,
                  voice.labels?.accent,
                  voice.labels?.age,
                  voice.labels?.use_case,
                ]
                  .filter(Boolean)
                  .map((t) => t!.replace(/_/g, " "));

                return (
                  <li
                    key={voice.voice_id}
                    className={`flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors ${
                      isSelected ? "bg-primary/5" : ""
                    }`}
                  >
                    {/* Play button */}
                    <button
                      type="button"
                      onClick={() => togglePlay(voice)}
                      disabled={!voice.preview_url}
                      title={isPlaying ? "Pause preview" : "Play preview"}
                      className="shrink-0 flex items-center justify-center size-8 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-30"
                    >
                      {isPlaying ? (
                        <Pause className="size-3.5" />
                      ) : (
                        <Play className="size-3.5 translate-x-px" />
                      )}
                    </button>

                    {/* Name + labels */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {voice.name}
                      </p>
                      {voice.labels?.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {voice.labels.description}
                        </p>
                      )}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Select button */}
                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => {
                        onSelect(voice.voice_id, voice.name);
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

        {/* Footer count */}
        {!loading && !error && (
          <div className="px-5 py-2.5 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">
              {filtered.length} voice{filtered.length !== 1 ? "s" : ""}
              {voices.length !== filtered.length ? ` of ${voices.length}` : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
