import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import domtoimage from "dom-to-image-more";
import LeaderboardPoster, { POSTER_SIZE, PODIUM_TONES, PosterMedal, PosterStats } from "./LeaderboardPoster.jsx";

const clashLogo = "/clash-logo.png";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleTouch = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS13Plus =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isAppleTouch || isIPadOS13Plus;
}

function getWinRate(player) {
  return player.gamesPlayed ? player.wins / player.gamesPlayed : 0;
}

function getRankingKey(player, rankBy) {
  const winRate = Math.round(getWinRate(player) * 100);
  const points = player.points || 0;
  const compositeScore = getWinRate(player) * Math.sqrt(player.gamesPlayed || 0);

  if (rankBy === "mostWins") {
    return [player.wins, winRate, points].join("|");
  }

  if (rankBy === "winRateMin5") {
    return [player.gamesPlayed >= 5 ? 1 : 0, winRate, player.wins, points].join("|");
  }

  return [compositeScore.toFixed(6), player.wins, winRate, points].join("|");
}

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(value) {
  if (!value) return '';
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function defaultSeasonLabel() {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}


// Swap every <img> under `root` for a data URL so the capture never depends on
// a network fetch mid-render, then wait until each one has decoded.
async function inlineImages(root) {
  await Promise.all(Array.from(root.querySelectorAll("img")).map(async (image) => {
    if (!image.src || image.src.startsWith("data:")) return;
    try {
      const response = await fetch(image.src);
      if (!response.ok) return;
      const blob = await response.blob();
      image.src = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      // Keep the original source as a fallback.
    }
  }));
  await Promise.all(Array.from(root.querySelectorAll("img")).map(async (image) => {
    if (!image.complete) {
      await new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }
    if (image.decode) await image.decode().catch(() => {});
  }));
}

const EXPORT_CHOICES = [
  { key: "top3", label: "Top 3", variant: "podium" },
  { key: "top10", label: "Top 10", variant: "standings" },
  { key: "all", label: "All", variant: "all" },
];

const POSTER_FONTS = ['40px "Anton"', '600 20px "Barlow"', '700 20px "Barlow"', '600 20px "Barlow Condensed"', '700 20px "Barlow Condensed"', '800 20px "Barlow Condensed"'];

export default function LeaderboardPanel({ players: sessionPlayers, overallPlayers = [], overallOnly = false, sessionOnly = false, defaultScope = "session", sessionId, seasonLabel, sessionCreatedAt, clubName }) {
  const posterRef = useRef(null);
  const exportMenuRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [posterChoice, setPosterChoice] = useState(null);
  const [previews, setPreviews] = useState([]);
  const [exportError, setExportError] = useState('');
  const [rankBy, setRankBy] = useState("composite");
  const [scope, setScope] = useState(overallOnly ? "overall" : defaultScope);
  const players = scope === "overall" ? overallPlayers : sessionPlayers;
  const displayedDate = scope === "overall"
    ? defaultSeasonLabel()
    : formatDate(sessionCreatedAt) || seasonLabel || defaultSeasonLabel();

  const ranked = players.filter((player) => scope === "overall" || player.gamesPlayed > 0).sort((a, b) => {
    const wrA = Math.round(getWinRate(a) * 100);
    const wrB = Math.round(getWinRate(b) * 100);
    const pointsA = a.points || 0;
    const pointsB = b.points || 0;
    const compositeA = getWinRate(a) * Math.sqrt(a.gamesPlayed || 0);
    const compositeB = getWinRate(b) * Math.sqrt(b.gamesPlayed || 0);
    const eligibleA = a.gamesPlayed >= 5 ? 1 : 0;
    const eligibleB = b.gamesPlayed >= 5 ? 1 : 0;

    if (rankBy === "mostWins") {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (wrB !== wrA) return wrB - wrA;
    } else if (rankBy === "winRateMin5") {
      if (eligibleB !== eligibleA) return eligibleB - eligibleA;
      if (wrB !== wrA) return wrB - wrA;
      if (b.wins !== a.wins) return b.wins - a.wins;
    } else {
      if (compositeB !== compositeA) return compositeB - compositeA;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (wrB !== wrA) return wrB - wrA;
    }

    if (pointsB !== pointsA) return pointsB - pointsA;

    return 0;
  });

  let previousRankingKey = null;
  let currentRank = 0;
  const rankedWithPosition = ranked.map((p, index) => {
    const winRatePct = p.gamesPlayed
      ? Math.round((p.wins / p.gamesPlayed) * 100)
      : 0;
    const rankingKey = getRankingKey(p, rankBy);
    if (rankingKey !== previousRankingKey) {
      currentRank += 1;
      previousRankingKey = rankingKey;
    }

    return {
      ...p,
      winRatePct,
      points: p.points || 0,
      rank: currentRank,
    };
  });

  const podiumGroups = rankedWithPosition.reduce((groups, player) => {
    const group = groups.find((entry) => entry.rankNumber === player.rank);
    if (group) group.players.push(player);
    else groups.push({ rankNumber: player.rank, players: [player] });
    return groups;
  }, []);

  const restPlayers = rankedWithPosition.filter((player) => player.rank > 3);
  const rankingFootnote =
    rankBy === "mostWins"
      ? "Ranked by most wins. Ties are broken by win rate."
      : rankBy === "winRateMin5"
        ? "Ranked by win rate (minimum 5 games). Points break ties."
        : "Ranked by volume-adjusted win rate: win rate × √games. Wins and points break ties.";

  const posterProps = {
    scopeLabel: scope === "overall" ? "Overall" : "Session",
    dateLabel: displayedDate,
    clubName,
    footnote: rankingFootnote,
    podiumGroups,
  };
  const exportChoice = EXPORT_CHOICES.find((choice) => choice.key === posterChoice);

  useEffect(() => {
    if (!exportMenuOpen) return undefined;
    const closeOnOutside = (event) => {
      if (!exportMenuRef.current?.contains(event.target)) setExportMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setExportMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [exportMenuOpen]);

  // Renders the chosen poster off-screen, captures it at 2x, then shows it in
  // a preview where it can be downloaded (or saved by tap-and-hold on iOS).
  const exportImage = async (choiceKey) => {
    const choice = EXPORT_CHOICES.find((item) => item.key === choiceKey);
    setExportMenuOpen(false);
    setExporting(true);
    setExportError('');
    setPosterChoice(choiceKey);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (document.fonts?.load) await Promise.all(POSTER_FONTS.map((font) => document.fonts.load(font).catch(() => {})));
      if (document.fonts?.ready) await document.fonts.ready;

      const node = posterRef.current;
      if (!node) return;
      await inlineImages(node);
      // The full-rankings poster is as tall as its player list needs. Use the
      // box height: scrollHeight would include the oversized court backdrop.
      const options = { width: POSTER_SIZE, height: Math.max(POSTER_SIZE, node.offsetHeight), scale: 2, bgcolor: "#020617" };
      // iOS may finish loading cloned images only after the first canvas pass.
      if (isIOS()) await domtoimage.toCanvas(node, options);
      const canvas = await domtoimage.toCanvas(node, options);
      setPreviews([{
        name: choice.label,
        url: canvas.toDataURL("image/png"),
        fileName: `${sessionId || "clash"}-${scope}-${choice.key}.png`,
      }]);
    } catch (err) {
      console.error('Leaderboard export failed:', err);
      setExportError('Export failed. Please try again.');
    } finally {
      setPosterChoice(null);
      setExporting(false);
    }
  };

  const scopeLabel = scope === "overall" ? "Overall" : "Session";
  const [first, second, third] = [1, 2, 3].map((rank) => podiumGroups.find((group) => group.rankNumber === rank)?.players || []);
  const rankByLabel = rankBy === "mostWins" ? "Ranked by most wins" : rankBy === "winRateMin5" ? "Ranked by win rate" : "Ranked by composite score";
  // Tied players share a podium slot: show every name, stats of the first.
  const groupName = (group) => (group.length ? group.map((player) => player.name).join(", ") : "No player yet");
  const avatar = (player, className) => (
    <span className={className}>
      {player?.photoUrl ? <img src={player.photoUrl} alt="" /> : getInitials(player?.name) || "?"}
    </span>
  );

  return (
    <div className="lb-page">
      <div className="lb-page-head">
        <div className="lb-poster-brand"><img src={clashLogo} alt="" />Leaderboard</div>
        <div className="lb-poster-date">As of <b>{displayedDate}</b></div>
      </div>

      <div className="lb-page-title-row">
        <div>
          <div className="lb-poster-title">
            <span className="lb-poster-kicker">{scopeLabel}</span>
            <span className="lb-poster-headline">Leaderboard</span>
          </div>
          <div className="lb-poster-tag"><i />{rankByLabel}</div>
        </div>
        <div className="lb-page-controls">
          {!overallOnly && !sessionOnly && (
            <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Leaderboard scope">
              <option value="session">Session leaderboard</option>
              <option value="overall">Overall leaderboard</option>
            </select>
          )}
          <select value={rankBy} onChange={(e) => setRankBy(e.target.value)} aria-label="Rank by">
            <option value="composite">Composite Score</option>
            <option value="winRateMin5">Win rate (min. games)</option>
            <option value="mostWins">Most Wins</option>
          </select>
          <div className="lb-page-export-wrap" ref={exportMenuRef}>
            <button
              className="lb-page-export"
              onClick={() => setExportMenuOpen((open) => !open)}
              disabled={exporting || ranked.length === 0}
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
            >
              {exporting ? "Exporting..." : "Export"}
            </button>
            {exportMenuOpen && (
              <div className="lb-page-export-menu" role="menu">
                {EXPORT_CHOICES.map((choice) => (
                  <button key={choice.key} type="button" role="menuitem" onClick={() => exportImage(choice.key)}>
                    {choice.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {exportError && <div className="export-error" role="alert">{exportError}</div>}

      {ranked.length === 0 ? (
        <div className="lb-page-empty">
          No completed games yet. Results appear here once games are marked done.
        </div>
      ) : (
        <>
          <div className="lb-poster-hero lb-page-hero">
            <PosterMedal rank={1} />
            <div className="lb-poster-hero-body">
              <div className="lb-poster-who">
                {avatar(first[0], "lb-poster-mono")}
                <div>
                  <div className="lb-poster-place gold">{PODIUM_TONES[1].label}</div>
                  <div className="lb-poster-name hero">{groupName(first)}</div>
                </div>
              </div>
              <PosterStats player={first[0]} />
            </div>
          </div>

          <div className="lb-poster-duo lb-page-duo">
            {[[2, second], [3, third]].map(([rank, group]) => (
              <div key={rank} className={`lb-poster-card ${PODIUM_TONES[rank].tone}`}>
                <div className="lb-poster-card-top">
                  <PosterMedal rank={rank} />
                  <div>
                    <div className={`lb-poster-place ${PODIUM_TONES[rank].tone}`}>{PODIUM_TONES[rank].label}</div>
                    <div className="lb-poster-name">{groupName(group)}</div>
                  </div>
                </div>
                <PosterStats player={group[0]} />
              </div>
            ))}
          </div>

          {restPlayers.length > 0 && (
            <div className="lb-poster-table lb-page-table">
              <div className="lb-poster-th">
                <span>Rank</span><span>Player</span><span className="c">Games</span><span className="c">W-L</span><span>Win rate</span><span className="r">Points</span>
              </div>
              {restPlayers.map((player) => (
                <div key={player.id} className="lb-poster-tr">
                  <span className="lb-poster-rank">{String(player.rank).padStart(2, "0")}</span>
                  <span className="lb-poster-player">{avatar(player, "lb-poster-avatar")}<span className="lb-page-name">{player.name}</span></span>
                  <span className="c">{player.gamesPlayed}</span>
                  <span className="c">{player.wins}-{player.losses}</span>
                  <span className="lb-poster-wr"><span className="lb-poster-bar"><i style={{ width: `${player.winRatePct}%` }} /></span><b>{player.winRatePct}%</b></span>
                  <span className="r lb-poster-points">{(player.points || 0).toLocaleString("en-US")}</span>
                </div>
              ))}
            </div>
          )}

          <div className="lb-page-foot">{rankingFootnote}</div>
        </>
      )}

      {exportChoice && createPortal(
        <div className="lb-poster-stage" aria-hidden="true">
          <LeaderboardPoster
            ref={posterRef}
            variant={exportChoice.variant}
            topPlayers={exportChoice.key === "all" ? rankedWithPosition : rankedWithPosition.slice(0, 10)}
            {...posterProps}
          />
        </div>,
        document.body,
      )}

      {previews.length > 0 && (
        <div
          onClick={() => setPreviews([])}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{ color: "#fff", marginBottom: 12, fontSize: 15, textAlign: "center" }}
          >
            {isIOS()
              ? 'Tap and hold the image, then choose "Save Image" — tap anywhere else to close'
              : "Download the image — click anywhere else to close"}
          </div>
          <div className="lb-poster-previews" onClick={(e) => e.stopPropagation()}>
            {previews.map((preview) => (
              <div key={preview.name} className="lb-poster-preview">
                <img src={preview.url} alt={`Leaderboard ${preview.name} poster`} />
                {!isIOS() && (
                  <a className="btn" href={preview.url} download={preview.fileName}>
                    Download {preview.name}
                  </a>
                )}
              </div>
            ))}
          </div>
          <button className="btn secondary" style={{ marginTop: 16 }} onClick={() => setPreviews([])}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}