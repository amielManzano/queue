import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import logo from "../assets/logo.png";

// iOS Safari (including standalone/homescreen PWA mode) does not reliably
// support triggering downloads via <a download>. iPadOS 13+ also reports
// as "Mac" in the user agent but has touch points, so we check for that too.
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

function sameRankScore(a, b) {
  if (!a || !b) return false;
  return a.winRatePct === b.winRatePct && a.wins === b.wins;
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

function ordinal(rank) {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

// Win rate at/above this shows the "On Fire" badge on the 1st place card.
const ON_FIRE_THRESHOLD = 75;

function defaultSeasonLabel() {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function LeaderboardPanel({ players, sessionId, seasonLabel }) {
  const exportRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [rankBy, setRankBy] = useState("composite");

  const ranked = [...players].sort((a, b) => {
    const wrA = Math.round(getWinRate(a) * 100);
    const wrB = Math.round(getWinRate(b) * 100);
    const pointsA = a.wins * 10;
    const pointsB = b.wins * 10;
    const compositeA = wrA * 0.7 + a.wins * 2 + a.gamesPlayed * 0.3;
    const compositeB = wrB * 0.7 + b.wins * 2 + b.gamesPlayed * 0.3;
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
    return a.name.localeCompare(b.name);
  });

  const rankedWithPosition = ranked.reduce((acc, p) => {
    const winRatePct = p.gamesPlayed
      ? Math.round((p.wins / p.gamesPlayed) * 100)
      : 0;
    const prev = acc[acc.length - 1];
    const current = {
      ...p,
      winRatePct,
      points: p.wins * 10,
      compositeScore: winRatePct * 0.7 + p.wins * 2 + p.gamesPlayed * 0.3,
      eligibleForWinRate: p.gamesPlayed >= 5,
    };

    const sameRank = prev
      ? rankBy === "mostWins"
        ? prev.wins === current.wins && prev.winRatePct === current.winRatePct
        : rankBy === "winRateMin5"
          ? prev.eligibleForWinRate === current.eligibleForWinRate &&
            prev.winRatePct === current.winRatePct &&
            prev.wins === current.wins
          : prev.compositeScore === current.compositeScore &&
            prev.wins === current.wins &&
            prev.winRatePct === current.winRatePct
      : false;

    const rank = prev ? (sameRank ? prev.rank : prev.rank + 1) : 1;
    acc.push({ ...current, rank });
    return acc;
  }, []);

  const groupedRanks = rankedWithPosition.reduce((groups, player) => {
    const last = groups[groups.length - 1];
    if (!last || last.rank !== player.rank) {
      groups.push({ rank: player.rank, players: [player] });
    } else {
      last.players.push(player);
    }
    return groups;
  }, []);

  const rank1 = groupedRanks.find((group) => group.rank === 1) || null;
  const rank2 = groupedRanks.find((group) => group.rank === 2) || null;
  const rank3 = groupedRanks.find((group) => group.rank === 3) || null;
  const podiumGroups = [
    { key: "rank2", placeLabel: "2nd", group: rank2, tone: "second" },
    { key: "rank1", placeLabel: "1st", group: rank1, tone: "first" },
    { key: "rank3", placeLabel: "3rd", group: rank3, tone: "third" },
  ];
  const restPlayers = rankedWithPosition.filter((player) => player.rank > 3);
  const rankingFootnote =
    rankBy === "mostWins"
      ? "Ranked by most wins. Ties are broken by win rate."
      : rankBy === "winRateMin5"
        ? "Ranked by win rate (minimum 5 games). Players below 5 games are listed after qualified players."
        : "Ranked by composite score (win rate + wins + activity).";

  const exportImage = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: null,
        scale: 2,
      });

      if (isIOS()) {
        // Downloads don't work reliably on iOS Safari / homescreen PWAs.
        // Show the image so the user can long-press → Save Image instead.
        const dataUrl = canvas.toDataURL("image/png");
        setPreviewUrl(dataUrl);
      } else {
        const link = document.createElement("a");
        link.download = `${sessionId || "stp-session"}-results.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="panel" ref={exportRef} style={{ position: "relative" }}>
      {ranked.length === 0 ? (
        <div className="empty-state">
          No completed games yet. Results appear here once games are marked
          done.
        </div>
      ) : (
        <div className="leaderboard-grid modern-leaderboard league-board">
          <div className="league-head">
            <div className="league-head-left">
              <div className="league-head-icon">
                <img src={logo} alt="STP logo" />
              </div>
              <div>
                <div className="league-title">Leaderboard</div>
                <div className="league-date">
                  {seasonLabel || defaultSeasonLabel()}
                </div>
              </div>
            </div>
            <div className="league-head-controls">
              <label className="league-rank-by">
                <span>Rank by</span>
                <select
                  value={rankBy}
                  onChange={(e) => setRankBy(e.target.value)}
                >
                  <option value="composite">Composite Score</option>
                  <option value="winRateMin5">Winrate (min. 5 games)</option>
                  <option value="mostWins">Most Wins</option>
                </select>
              </label>

              <button
                className="league-export-btn"
                onClick={exportImage}
                disabled={exporting || ranked.length === 0}
              >
                <span className="icon" aria-hidden="true">
                  ⬇
                </span>
                {exporting ? "Exporting..." : "Export"}
              </button>
            </div>
          </div>

          <div className="league-podium">
            {podiumGroups.map((slot) => {
              const group = slot.group;
              const names = group
                ? group.players.map((p) => p.name).join(", ")
                : "No player yet";
              const topPlayer = group?.players[0];
              const rate = topPlayer ? `${topPlayer.winRatePct}%` : "--";
              const points = topPlayer ? topPlayer.points : 0;
              const firstPlayer = group?.players[0];
              const tieCount =
                group && group.players.length > 1
                  ? group.players.length - 1
                  : 0;

              const isOnFire =
                slot.tone === "first" &&
                topPlayer &&
                topPlayer.winRatePct >= ON_FIRE_THRESHOLD;

              return (
                <article
                  key={slot.key}
                  className={`league-podium-card ${slot.tone} ${group ? "" : "empty"}`}
                >
                  {slot.tone === "first" && (
                    <span className="league-podium-crown" aria-hidden="true">
                      👑
                    </span>
                  )}
                  <div className="league-podium-top">
                    <span className="league-laurel" aria-hidden="true">
                      🌿
                    </span>
                    <span className="league-podium-place">
                      {slot.placeLabel}
                    </span>
                    <span
                      className="league-laurel"
                      aria-hidden="true"
                      style={{ transform: "scaleX(-1)" }}
                    >
                      🌿
                    </span>
                  </div>
                  <div className="league-podium-body">
                    <div className="league-avatar-wrap">
                      {group &&
                        group.players.map(({ name }, index) => {
                          return (
                            <div
                              key={index}
                              className="league-avatar"
                              title={name || ""}
                            >
                              {getInitials(name)}
                            </div>
                          );
                        })}
                    </div>
                    <div className="league-player-name">{names}</div>
                    <div className="league-top-stats">
                      <div>
                        <strong>{topPlayer?.wins ?? 0}</strong>
                        <span>Wins</span>
                      </div>
                      <div>
                        <strong>{topPlayer?.losses ?? 0}</strong>
                        <span>Losses</span>
                      </div>
                      <div>
                        <strong>{rate}</strong>
                        <span>Win Rate</span>
                      </div>
                    </div>
                    {group && group.players.length > 1 && (
                      <div className="league-tie-note">
                        {group.players.length}-way tie
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {restPlayers.length > 0 && (
            <div className="league-table-wrap">
              <div className="league-table-head">
                <span>Rank</span>
                <span>Player</span>
                <span>Games</span>
                <span>Wins</span>
                <span>Losses</span>
                <span>Win Rate</span>
              </div>
              <div className="league-table-body">
                {restPlayers.map((player) => (
                  <div key={player.id} className="league-table-row">
                    <div className="league-cell rank">
                      {ordinal(player.rank)}
                    </div>
                    <div className="league-cell player">
                      <span className="league-row-avatar">
                        {player.photoUrl ? (
                          <img src={player.photoUrl} alt={player.name} />
                        ) : (
                          getInitials(player.name)
                        )}
                      </span>
                      <span className="league-row-name">{player.name}</span>
                    </div>
                    <div className="league-cell">{player.gamesPlayed}</div>
                    <div className="league-cell win">{player.wins}</div>
                    <div className="league-cell loss">{player.losses}</div>
                    <div className="league-cell">{player.winRatePct}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="league-footnote">{rankingFootnote}</div>
        </div>
      )}

      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
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
            style={{
              color: "#fff",
              marginBottom: 12,
              fontSize: 15,
              textAlign: "center",
            }}
          >
            Tap and hold the image, then choose "Save Image" — tap anywhere else
            to close
          </div>
          <img
            src={previewUrl}
            alt="Leaderboard export"
            style={{ maxWidth: "100%", maxHeight: "75vh", borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="btn"
            style={{ marginTop: 16 }}
            onClick={() => setPreviewUrl(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
