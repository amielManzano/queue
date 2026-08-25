import React, { useRef, useState } from "react";
import { toCanvas } from "html-to-image";
import gold1 from "../assets/gold1.png"
import gold2 from "../assets/gold2.png"
import silver1 from "../assets/silver1.png"
import silver2 from "../assets/silver2.png"
import bronze1 from "../assets/bronze1.png"
import bronze2 from "../assets/bronze2.png"
import logo from "../assets/logo.png"

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

  if (rankBy === "mostWins") {
    return [player.wins, winRate, points].join("|");
  }

  if (rankBy === "winRateMin5") {
    return [player.gamesPlayed >= 5 ? 1 : 0, winRate, player.wins, points].join("|");
  }

  return [winRate * 0.7 + player.wins * 2 + player.gamesPlayed * 0.3, player.wins, winRate, points].join("|");
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

function defaultSeasonLabel() {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const MEDAL_ASSETS = {
  first: { medal: gold1, leaves: gold2 },
  second: { medal: silver1, leaves: silver2 },
  third: { medal: bronze1, leaves: bronze2 },
};

function RankMedal({ place, tone }) {
  const assets = MEDAL_ASSETS[tone];

  return (
    <div className={`rank-medal-wrap ${tone}`}>
      <span className="rank-medal-glow" aria-hidden="true" />
      <img src={assets.leaves} alt="" className="rank-medal-leaves" aria-hidden="true" />
      <img src={assets.medal} alt={`${place} place medal`} className="rank-medal" />
    </div>
  );
}

export default function LeaderboardPanel({ players, sessionId, seasonLabel }) {
  const exportRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [rankBy, setRankBy] = useState("composite");
  const displayedDate = seasonLabel || defaultSeasonLabel();

  const ranked = [...players].sort((a, b) => {
    const wrA = Math.round(getWinRate(a) * 100);
    const wrB = Math.round(getWinRate(b) * 100);
    const pointsA = a.points || 0;
    const pointsB = b.points || 0;
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

  const podiumSlots = [2, 1, 3].map((rankNumber) => ({
    key: `rank${rankNumber}`,
    tone: rankNumber === 1 ? "first" : rankNumber === 2 ? "second" : "third",
    rankNumber,
    players: podiumGroups.find((group) => group.rankNumber === rankNumber)?.players || [],
  }));

  const restPlayers = rankedWithPosition.filter((player) => player.rank > 3);
  const rankingFootnote =
    rankBy === "mostWins"
      ? "Ranked by most wins. Ties are broken by win rate."
      : rankBy === "winRateMin5"
        ? "Ranked by win rate (minimum 5 games). Points break ties."
        : "Ranked by composite score. Points break ties.";

  const exportImage = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    const exportElement = exportRef.current;
    const desktopWidth = window.innerWidth >= 900
      ? Math.min(1100, Math.max(320, window.innerWidth - 56))
      : 1100;
    const exportWrapper = document.createElement("div");
    const exportBoard = exportElement.cloneNode(true);
    exportWrapper.style.width = `${desktopWidth + 72}px`;
    exportWrapper.style.padding = "36px";
    exportWrapper.style.background = "transparent";
    exportWrapper.style.boxSizing = "border-box";
    exportBoard.classList.add("leaderboard-export-desktop");
    exportBoard.style.width = `${desktopWidth}px`;
    exportBoard.style.maxWidth = "none";
    exportBoard.style.border = "2px solid rgba(255,255,255,0.12)";
    exportBoard.style.overflow = "visible";
    exportWrapper.appendChild(exportBoard);
    document.body.appendChild(exportWrapper);
    try {
      const canvas = await toCanvas(exportWrapper, {
        pixelRatio: 2,
        backgroundColor: "transparent",
        cacheBust: true,
      });

      if (isIOS()) {
        const dataUrl = canvas.toDataURL("image/png");
        setPreviewUrl(dataUrl);
      } else {
        const link = document.createElement("a");
        link.download = `${sessionId || "stp-session"}-results.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
    } finally {
      exportWrapper.remove();
      setExporting(false);
    }
  };

  return (
    <div className="panel league-board" ref={exportRef} style={{ position: "relative" }}>
      {ranked.length === 0 ? (
        <div className="empty-state">
          No completed games yet. Results appear here once games are marked
          done.
        </div>
      ) : (
        <div className="leaderboard-grid modern-leaderboard">
          <div className="league-head">
            <div className="league-head-left">
              <span className="league-head-icon">
                <img src={logo} alt="STP Badminton" />
              </span>
              <div>
                <div className="league-title">Leaderboard</div>
              </div>
            </div>
            <div className="league-head-controls">
              <div className="league-date" aria-label={`Leaderboard date: ${displayedDate}`}>
                <span>As of</span>
                <strong>{displayedDate}</strong>
              </div>
              <label className="league-rank-by">
                <select
                  value={rankBy}
                  onChange={(e) => setRankBy(e.target.value)}
                >
                  <option value="composite">Composite Score</option>
                  <option value="winRateMin5">Win rate (min. games)</option>
                  <option value="mostWins">Most Wins</option>
                </select>
              </label>

              <button
                className="league-export-btn"
                onClick={exportImage}
                disabled={exporting || ranked.length === 0}
              >
                <span className="icon" aria-hidden="true">⬇</span>
                {exporting ? "Exporting..." : "Export"}
              </button>
            </div>
          </div>

          <div className="league-podium">
            {podiumSlots.map((slot) => {
              const playersInGroup = slot.players;
              const p = playersInGroup[0] || null;

              return (
                <article
                  key={slot.key}
                  className={`league-podium-card ${slot.tone} ${p ? "" : "empty"}`}
                >
                  <span className={`export-rank-shadow ${slot.tone}`} aria-hidden="true" />
                  <div className="league-podium-top">
                    <RankMedal place={slot.rankNumber} tone={slot.tone} />
                  </div>

                  <div className="league-podium-body">
                    <div className={`league-podium-player ${playersInGroup.length > 1 ? "tied" : ""}`}>
                      <div className="league-avatar-stack">
                        {playersInGroup.map((groupPlayer, index) => (
                          <div
                            key={groupPlayer.id}
                            className={`league-avatar ${slot.tone}`}
                            style={{ zIndex: playersInGroup.length - index }}
                          >
                            {groupPlayer.photoUrl ? (
                              <img src={groupPlayer.photoUrl} alt={groupPlayer.name} />
                            ) : (
                              getInitials(groupPlayer.name)
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="league-podium-player-info">
                        <div className="league-player-name">
                          {p ? playersInGroup.map((groupPlayer) => groupPlayer.name).join(", ") : "No player yet"}
                        </div>
                        {p?.skill && (
                          <div className="league-player-skill">{p.skill}</div>
                        )}
                      </div>
                    </div>

                    <div className="league-top-stats">
                      <div>
                        <span>Win Rate</span>
                        <strong>{p ? `${p.winRatePct}%` : "--"}</strong>
                      </div>
                      <div>
                        <span>Games</span>
                        <strong>{p?.gamesPlayed ?? 0}</strong>
                      </div>
                      <div>
                        <span>W-L</span>
                        <strong>{p ? `${p.wins}-${p.losses}` : "--"}</strong>
                      </div>
                      <div>
                        <span>Points</span>
                        <strong>{p?.points ?? 0}</strong>
                      </div>
                    </div>

                    <div className="league-podium-bar">
                      <div
                        className={`league-podium-bar-fill ${slot.tone}`}
                        style={{ width: `${p?.winRatePct ?? 0}%` }}
                      />
                    </div>
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
                <span>Win Rate</span>
                <span>Games</span>
                <span>W-L</span>
                <span>Points</span>
              </div>
              <div className="league-table-body">
                {restPlayers.map((player) => (
                  <div key={player.id} className="league-table-row">
                    <div className="league-cell rank">#{player.rank}</div>
                    <div className="league-cell player">
                      <span className="league-row-avatar">
                        {player.photoUrl ? (
                          <img src={player.photoUrl} alt={player.name} />
                        ) : (
                          getInitials(player.name)
                        )}
                      </span>
                      <span className="league-row-name-wrap">
                        <span className="league-row-name">{player.name}</span>
                        {player.skill && (
                          <span className="league-row-skill">{player.skill}</span>
                        )}
                      </span>
                    </div>
                    <div className="league-cell winrate">
                      <span className="league-winrate-pct">
                        {player.winRatePct}%
                      </span>
                      <span className="league-winrate-bar">
                        <span
                          className="league-winrate-bar-fill"
                          style={{ width: `${player.winRatePct}%` }}
                        />
                      </span>
                    </div>
                    <div className="league-cell">{player.gamesPlayed}</div>
                    <div className="league-cell wl">
                      {player.wins}-{player.losses}
                    </div>
                    <div className="league-cell points">{player.points}</div>
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
            style={{ color: "#fff", marginBottom: 12, fontSize: 15, textAlign: "center" }}
          >
            Tap and hold the image, then choose "Save Image" — tap anywhere else to close
          </div>
          <img
            src={previewUrl}
            alt="Leaderboard export"
            style={{ maxWidth: "100%", maxHeight: "75vh", borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />
          <button className="btn" style={{ marginTop: 16 }} onClick={() => setPreviewUrl(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}