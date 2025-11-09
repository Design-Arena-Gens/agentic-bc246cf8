/* eslint-disable @typescript-eslint/no-misused-promises */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildTrackInsight, generateAgentResponse, type TrackInsight } from "@/lib/agent";
import { TrackCard } from "./TrackCard";

type Message = {
  id: string;
  role: "agent" | "user";
  content: string;
  timestamp: number;
};

type UploadedTrack = {
  id: string;
  name: string;
  objectUrl: string;
  duration?: number;
  size: number;
  insight: TrackInsight;
};

const allowedTypes = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/mp3",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
  "audio/ogg"
]);

const readDuration = (src: string) =>
  new Promise<number | undefined>((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = src;

    const clean = () => {
      audio.removeEventListener("loadedmetadata", onLoad);
      audio.removeEventListener("error", onError);
    };

    const onLoad = () => {
      clean();
      resolve(Number.isFinite(audio.duration) ? audio.duration : undefined);
    };

    const onError = () => {
      clean();
      resolve(undefined);
    };

    audio.addEventListener("loadedmetadata", onLoad, { once: true });
    audio.addEventListener("error", onError, { once: true });
  });

const sanitizeName = (name: string) =>
  name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled Suno Track";

export function AudioAgent() {
  const [tracks, setTracks] = useState<UploadedTrack[]>([]);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: crypto.randomUUID(),
      role: "agent",
      content:
        "Upload your Suno AI creations and ask me for a summary, playlist flow, or vibe check. I’ll decode the set in seconds.",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const objectUrlsRef = useRef(new Set<string>());

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const acceptedFiles = Array.from(fileList).filter((file) => {
        if (allowedTypes.has(file.type)) return true;
        if (!file.type && file.name.match(/\.(mp3|wav|m4a|aac|flac|ogg)$/i)) return true;
        return false;
      });

      if (!acceptedFiles.length) return;

      const prepared = await Promise.all(
        acceptedFiles.map(async (file) => {
          const objectUrl = URL.createObjectURL(file);
          objectUrlsRef.current.add(objectUrl);
          const duration = await readDuration(objectUrl);
          const id = crypto.randomUUID();
          const name = sanitizeName(file.name);
          const insight = buildTrackInsight({
            id,
            name,
            duration,
            size: file.size
          });

          return {
            id,
            name,
            objectUrl,
            duration,
            size: file.size,
            insight
          } satisfies UploadedTrack;
        })
      );

      setTracks((prev) => [...prepared, ...prev]);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "agent",
          content: `Loaded ${prepared.length} Suno ${prepared.length > 1 ? "tracks" : "track"}. Ask for a summary, playlist, or vibe breakdown.`,
          timestamp: Date.now()
        }
      ]);
    },
    []
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      void handleFiles(event.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleInputSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const question = input.trim();
      if (!question) return;
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
        timestamp: Date.now()
      };
      const agentMessage: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: generateAgentResponse(
          question,
          tracks.map((track) => track.insight)
        ),
        timestamp: Date.now()
      };

      setMessages((prev) => [...prev, userMessage, agentMessage]);
      setInput("");
    },
    [input, tracks]
  );

  const stats = useMemo(() => {
    if (!tracks.length) {
      return {
        totalDuration: "0:00",
        totalSizeMb: "0",
        topMoods: []
      };
    }

    const totalSeconds = tracks.reduce((sum, track) => sum + (track.duration ?? 0), 0);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60)
      .toString()
      .padStart(2, "0");
    const totalSize = tracks.reduce((sum, track) => sum + track.size, 0) / (1024 * 1024);

    const moodCounts = tracks.reduce<Record<string, number>>((acc, track) => {
      track.insight.moods.forEach((mood) => {
        acc[mood] = (acc[mood] ?? 0) + 1;
      });
      return acc;
    }, {});

    const topMoods = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([mood, count]) => `${mood} ×${count}`);

    return {
      totalDuration: `${minutes}:${seconds}`,
      totalSizeMb: totalSize.toFixed(1),
      topMoods
    };
  }, [tracks]);

  const handleTogglePlay = useCallback(
    (trackId: string, audio: HTMLAudioElement) => {
      if (activeAudioRef.current && activeAudioRef.current !== audio) {
        activeAudioRef.current.pause();
      }

      if (activeTrackId === trackId) {
        if (!audio.paused) {
          audio.pause();
          activeAudioRef.current = null;
          setActiveTrackId(null);
        } else {
          void audio.play();
          activeAudioRef.current = audio;
          setActiveTrackId(trackId);
        }
        return;
      }

      if (activeAudioRef.current && activeAudioRef.current !== audio) {
        activeAudioRef.current.pause();
      }

      activeAudioRef.current = audio;
      setActiveTrackId(trackId);
      void audio.play();
    },
    [activeTrackId]
  );

  return (
    <section className="container">
      <div className="card" style={{ marginBottom: "2.5rem" }}>
        <span className="pill">Suno Uploader</span>
        <h1 className="title">Agentic companion for your Suno AI drops</h1>
        <p className="subtitle">
          Upload freshly generated tracks, then let the agent summarize vibes, map playlists,
          and plan transitions—all in your browser. Nothing leaves your machine.
        </p>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          style={{
            marginTop: "2rem",
            borderRadius: "1.25rem",
            border: `2px dashed ${isDragging ? "#0ea5e9" : "rgba(148,163,184,0.4)"}`,
            background: isDragging ? "rgba(14,165,233,0.08)" : "rgba(248,250,252,0.8)",
            padding: "2.5rem",
            textAlign: "center",
            transition: "all 0.2s ease"
          }}
        >
          <p
            style={{
              margin: 0,
              fontWeight: 600,
              letterSpacing: "0.02em",
              color: "#0f172a",
              fontSize: "1.05rem"
            }}
          >
            Drag & drop Suno exports (MP3, WAV, FLAC, M4A) here
          </p>
          <p
            style={{
              marginTop: "0.6rem",
              color: "#64748b",
              fontSize: "0.95rem"
            }}
          >
            or
          </p>
          <label
            htmlFor="file-upload"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#0ea5e9",
              color: "white",
              padding: "0.75rem 1.6rem",
              borderRadius: "999px",
              cursor: "pointer",
              fontWeight: 600,
              letterSpacing: "0.03em",
              boxShadow: "0 12px 30px rgba(14, 165, 233, 0.35)"
            }}
          >
            Browse files
            <input
              id="file-upload"
              type="file"
              accept="audio/*"
              multiple
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = "";
              }}
              style={{ display: "none" }}
            />
          </label>
        </div>

        <div
          className="grid"
          style={{
            marginTop: "2.5rem"
          }}
        >
          <div
            style={{
              padding: "1.5rem",
              borderRadius: "1rem",
              background: "rgba(15,23,42,0.06)",
              border: "1px solid rgba(15,23,42,0.08)"
            }}
          >
            <p style={{ margin: 0, color: "#475569", fontSize: "0.85rem" }}>Runtime Loaded</p>
            <p style={{ margin: "0.35rem 0 0", fontSize: "1.65rem", fontWeight: 700 }}>
              {stats.totalDuration}
            </p>
          </div>
          <div
            style={{
              padding: "1.5rem",
              borderRadius: "1rem",
              background: "rgba(15,23,42,0.06)",
              border: "1px solid rgba(15,23,42,0.08)"
            }}
          >
            <p style={{ margin: 0, color: "#475569", fontSize: "0.85rem" }}>Disk Footprint</p>
            <p style={{ margin: "0.35rem 0 0", fontSize: "1.65rem", fontWeight: 700 }}>
              {stats.totalSizeMb} MB
            </p>
          </div>
          <div
            style={{
              padding: "1.5rem",
              borderRadius: "1rem",
              background: "rgba(15,23,42,0.06)",
              border: "1px solid rgba(15,23,42,0.08)"
            }}
          >
            <p style={{ margin: 0, color: "#475569", fontSize: "0.85rem" }}>Dominant Moods</p>
            <p
              style={{
                margin: "0.35rem 0 0",
                fontSize: "1.1rem",
                fontWeight: 600,
                color: "#0f172a"
              }}
            >
              {stats.topMoods.length ? stats.topMoods.join(" • ") : "Awaiting tracks"}
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: "2rem",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.2fr)"
        }}
      >
        <div
          className="card"
          style={{
            padding: "2rem",
            maxHeight: "70vh",
            overflow: "auto"
          }}
        >
          <h2
            style={{
              margin: "0 0 1.25rem",
              fontSize: "1.4rem",
              letterSpacing: "-0.02em"
            }}
          >
            Loaded Tracks
          </h2>
          {!tracks.length && (
            <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
              Your Suno archive is empty. Upload tracks to analyze tempo, mood, and flow.
            </p>
          )}
          <div
            style={{
              display: "grid",
              gap: "1.5rem"
            }}
          >
            {tracks.map((track) => (
              <TrackCard
                key={track.id}
                insight={track.insight}
                audioUrl={track.objectUrl}
                isActive={activeTrackId === track.id}
                onTogglePlay={(audio) => handleTogglePlay(track.id, audio)}
              />
            ))}
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem"
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.4rem",
              letterSpacing: "-0.02em"
            }}
          >
            Agent Console
          </h2>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "1rem"
            }}
          >
            {messages.map((message) => {
              const lines = message.content.split("\n");
              return (
                <div
                  key={message.id}
                  style={{
                    alignSelf: message.role === "agent" ? "flex-start" : "flex-end",
                    maxWidth: "85%",
                    padding: "1rem 1.2rem",
                    borderRadius:
                      message.role === "agent"
                        ? "1.1rem 1.1rem 1.1rem 0.35rem"
                        : "1.1rem 1.1rem 0.35rem 1.1rem",
                    background:
                      message.role === "agent" ? "rgba(14,165,233,0.16)" : "rgba(15,23,42,0.88)",
                    color: message.role === "agent" ? "#0f172a" : "white",
                    fontSize: "0.95rem",
                    lineHeight: 1.55,
                    boxShadow:
                      message.role === "agent"
                        ? "0 8px 22px rgba(14,165,233,0.24)"
                        : "0 8px 22px rgba(15,23,42,0.32)"
                  }}
                >
                  {lines.map((line, index) => (
                    <span key={String(index)}>
                      {line}
                      {index < lines.length - 1 && <br />}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>

          <form
            onSubmit={handleInputSubmit}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              borderRadius: "1rem",
              background: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(148,163,184,0.32)",
              padding: "0.5rem 0.6rem"
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask for a summary, playlist, vibe arc, or transitions..."
              style={{
                flex: 1,
                border: "none",
                fontSize: "0.95rem",
                padding: "0.75rem 1rem",
                background: "transparent",
                outline: "none",
                color: "#0f172a"
              }}
            />
            <button
              type="submit"
              style={{
                border: "none",
                borderRadius: "999px",
                padding: "0.7rem 1.5rem",
                background: "#0f172a",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
                letterSpacing: "0.03em"
              }}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
