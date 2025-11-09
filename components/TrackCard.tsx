import clsx from "clsx";
import { useMemo, useRef, useEffect } from "react";
import type { TrackInsight } from "@/lib/agent";

type Props = {
  insight: TrackInsight;
  onTogglePlay: (audio: HTMLAudioElement) => void;
  isActive: boolean;
  audioUrl: string;
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  let value = bytes;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`;
};

const formatDuration = (seconds?: number) => {
  if (!seconds || Number.isNaN(seconds)) return "Unknown";
  const mins = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${remainder}`;
};

export function TrackCard({
  insight,
  onTogglePlay,
  isActive,
  audioUrl
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = 0.9;
    if (!isActive && !audioRef.current.paused) {
      audioRef.current.pause();
    }
    if (isActive && audioRef.current.paused) {
      void audioRef.current.play();
    }
  }, [isActive]);
  const duration = formatDuration(insight.duration);
  const size = formatBytes(insight.size);

  const waveformPreview = useMemo(() => {
    const seed = insight.title.length + (insight.duration ?? 0);
    const bars = Array.from({ length: 32 }).map((_, index) => {
      const height =
        30 +
        ((Math.sin(seed * 0.1 + index * 0.7) + Math.cos(seed * 0.05 + index)) *
          20);
      return Math.max(8, Math.min(60, Math.round(height)));
    });
    return bars;
  }, [insight]);

  return (
    <article
      className={clsx("track-card", { active: isActive })}
      style={{
        borderRadius: "1.25rem",
        border: "1px solid rgba(148, 163, 184, 0.28)",
        background:
          "linear-gradient(140deg, rgba(14,165,233,0.12), rgba(15,23,42,0.04))",
        padding: "1.5rem",
        display: "grid",
        gap: "1rem"
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "1.1rem",
              fontWeight: 600,
              letterSpacing: "-0.01em"
            }}
          >
            {insight.title}
          </h3>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.85rem",
              color: "#475569"
            }}
          >
            {duration} • {size} • {insight.tempo} energy
          </p>
        </div>
        <button
          onClick={() => {
            if (!audioRef.current) return;
            onTogglePlay(audioRef.current);
          }}
          style={{
            border: "none",
            borderRadius: "999px",
            padding: "0.55rem 1.2rem",
            background: isActive ? "#0ea5e9" : "#0f172a",
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
            letterSpacing: "0.02em",
            transition: "background 0.2s ease"
          }}
        >
          {isActive ? "Pause" : "Play"}
        </button>
      </header>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "4px",
          height: "70px"
        }}
        aria-hidden
      >
        {waveformPreview.map((height, index) => (
          <span
            key={String(index)}
            style={{
              width: "4px",
              borderRadius: "999px",
              background: isActive ? "#0ea5e9" : "rgba(14, 165, 233, 0.55)",
              height: `${height}%`
            }}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem"
        }}
      >
        {insight.moods.map((mood) => (
          <span
            key={mood}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "999px",
              background: "rgba(14, 165, 233, 0.14)",
              color: "#0369a1",
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.03em"
            }}
          >
            {mood}
          </span>
        ))}
      </div>
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        controls
        style={{
          width: "100%",
          borderRadius: "0.75rem",
          background: "rgba(15,23,42,0.08)"
        }}
      />
    </article>
  );
}
