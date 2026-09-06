"use client";

import { useEffect, useMemo } from "react";
import { slotsFor } from "@/lib/formations";
import { lastNameOf } from "@/lib/flags";

type TokenPlayer = {
  id: string;
  name: string;
  shirtNumber: number;
  formationSlot: string | null;
  isStarter: boolean;
  onPitch: boolean;
  pitchX?: number | null;
  pitchY?: number | null;
};

type Placed = {
  id: string;
  name: string;
  shirt: number;
  x: number;
  y: number;
  side: "home" | "away";
  color: string;
};

function placeSide(
  players: TokenPlayer[],
  formation: string,
  side: "home" | "away",
  onLeft: boolean,
  color: string
): Placed[] {
  const slots = slotsFor(formation || "4-2-3-1");
  const assigned = new Set<string>();
  const eligible = (pl: TokenPlayer) => pl.isStarter || pl.onPitch;

  const placed = slots.map((slot) => {
    const candidates = players.filter(
      (pl) =>
        pl.formationSlot === slot.id &&
        eligible(pl) &&
        !assigned.has(pl.id)
    );
    const p =
      candidates.find((pl) => pl.onPitch) || candidates[0] || undefined;
    if (p) assigned.add(p.id);

    const depth = (100 - slot.y) / 100;
    const width = slot.x;
    let x: number;
    let y: number;
    if (onLeft) {
      x = 2 + depth * 46;
      y = width;
    } else {
      x = 98 - depth * 46;
      y = 100 - width;
    }
    if (p?.pitchX != null && Number.isFinite(p.pitchX)) x = p.pitchX;
    if (p?.pitchY != null && Number.isFinite(p.pitchY)) y = p.pitchY;

    return p
      ? {
          id: p.id,
          name: p.name,
          shirt: p.shirtNumber,
          x,
          y,
          side,
          color,
        }
      : null;
  });

  const validIds = new Set(slots.map((s) => s.id));
  const orphans = players.filter(
    (pl) =>
      eligible(pl) &&
      !assigned.has(pl.id) &&
      (!pl.formationSlot || !validIds.has(pl.formationSlot))
  );
  let oi = 0;
  const out: Placed[] = [];
  for (let i = 0; i < placed.length; i++) {
    const row = placed[i];
    if (row) {
      out.push(row);
      continue;
    }
    const slot = slots[i];
    if (oi >= orphans.length) continue;
    const p = orphans[oi++];
    assigned.add(p.id);
    const depth = (100 - slot.y) / 100;
    const width = slot.x;
    let x = onLeft ? 2 + depth * 46 : 98 - depth * 46;
    let y = onLeft ? width : 100 - width;
    if (p.pitchX != null && Number.isFinite(p.pitchX)) x = p.pitchX;
    if (p.pitchY != null && Number.isFinite(p.pitchY)) y = p.pitchY;
    out.push({
      id: p.id,
      name: p.name,
      shirt: p.shirtNumber,
      x,
      y,
      side,
      color,
    });
  }
  return out;
}

export function ObsPitchUnderlayClient(props: {
  matchId: string;
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  homeFormation: string;
  awayFormation: string;
  homePlayers: TokenPlayer[];
  awayPlayers: TokenPlayer[];
}) {
  const {
    matchId,
    homeColor,
    awayColor,
    homeFormation,
    awayFormation,
    homePlayers,
    awayPlayers,
  } = props;

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("obs-pitch-underlay-active");
    body.classList.add("obs-pitch-underlay-active");
    const prevHtmlBg = html.style.background;
    const prevBodyBg = body.style.background;
    const prevOverflow = body.style.overflow;
    html.style.background = "#0b1f12";
    body.style.background = "#0b1f12";
    body.style.overflow = "hidden";
    return () => {
      html.classList.remove("obs-pitch-underlay-active");
      body.classList.remove("obs-pitch-underlay-active");
      html.style.background = prevHtmlBg;
      body.style.background = prevBodyBg;
      body.style.overflow = prevOverflow;
    };
  }, []);

  // Soft reload so Official XI updates land in OBS without redeploy
  useEffect(() => {
    const id = window.setInterval(() => {
      window.location.reload();
    }, 45_000);
    return () => window.clearInterval(id);
  }, []);

  const tokens = useMemo(() => {
    const home = placeSide(
      homePlayers,
      homeFormation || "4-2-3-1",
      "home",
      true,
      homeColor
    );
    const away = placeSide(
      awayPlayers,
      awayFormation || "4-2-3-1",
      "away",
      false,
      awayColor
    );
    return [...home, ...away];
  }, [
    homePlayers,
    awayPlayers,
    homeFormation,
    awayFormation,
    homeColor,
    awayColor,
  ]);

  return (
    <div
      className="obs-pitch-underlay"
      data-obs-pitch="1"
      data-match-id={matchId}
      style={{
        width: 1920,
        height: 1080,
        overflow: "hidden",
        position: "relative",
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.18), transparent 16%, transparent 84%, rgba(0,0,0,0.2)), linear-gradient(90deg, rgba(0,0,0,0.1), transparent 12%, transparent 88%, rgba(0,0,0,0.1)), repeating-linear-gradient(90deg, #14532d 0 7.5%, #166534 7.5% 15%)",
      }}
    >
      {/* Pitch markings */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 24,
          border: "3px solid rgba(255,255,255,0.55)",
          borderRadius: 4,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            width: 0,
            borderLeft: "3px solid rgba(255,255,255,0.55)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 160,
            height: 160,
            marginLeft: -80,
            marginTop: -80,
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.55)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 10,
            height: 10,
            marginLeft: -5,
            marginTop: -5,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.7)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            width: "14%",
            height: "55%",
            marginTop: "-27.5%",
            border: "3px solid rgba(255,255,255,0.55)",
            borderLeft: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            right: 0,
            width: "14%",
            height: "55%",
            marginTop: "-27.5%",
            border: "3px solid rgba(255,255,255,0.55)",
            borderRight: "none",
          }}
        />
      </div>

      {tokens.map((t) => (
        <div
          key={t.id}
          data-token-side={t.side}
          style={{
            position: "absolute",
            left: `${t.x}%`,
            top: `${t.y}%`,
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: t.color || "#0f172a",
              border: "2px solid rgba(255,255,255,0.85)",
              boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 18,
              fontVariantNumeric: "tabular-nums",
              fontFamily:
                "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
            }}
          >
            {t.shirt || "·"}
          </div>
          <div
            style={{
              maxWidth: 110,
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.62)",
              color: "#f8fafc",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.02em",
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontFamily:
                "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
            }}
          >
            {lastNameOf(t.name) || t.name}
          </div>
        </div>
      ))}
    </div>
  );
}
