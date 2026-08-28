import React, { useRef, useState } from "react";
import domtoimage from "dom-to-image-more";
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
  const [exportError, setExportError] = useState('');
  const [rankBy, setRankBy] = useState("composite");
  const displayedDate = seasonLabel || defaultSeasonLabel();

  const ranked = players.filter((player) => player.gamesPlayed > 0).sort((a, b) => {
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
    setExportError('');
    const exportElement = exportRef.current;
    const desktopWidth = 1100;
    const exportFrame = document.createElement("iframe");
    exportFrame.style.position = "fixed";
    exportFrame.style.left = "-10000px";
    exportFrame.style.top = "0";
    exportFrame.style.width = "1200px";
    exportFrame.style.height = "1000px";
    exportFrame.style.border = "0";
    exportFrame.setAttribute("aria-hidden", "true");
    document.body.appendChild(exportFrame);

    const frameDocument = exportFrame.contentDocument;
    frameDocument.open();
    frameDocument.write("<!doctype html><html><head></head><body></body></html>");
    frameDocument.close();
    document.querySelectorAll("style, link[rel='stylesheet']").forEach((styleNode) => {
      frameDocument.head.appendChild(styleNode.cloneNode(true));
    });
    await Promise.all(Array.from(frameDocument.querySelectorAll("link[rel='stylesheet']")).map((link) => (
      link.sheet ? Promise.resolve() : new Promise((resolve) => {
        link.addEventListener("load", resolve, { once: true });
        link.addEventListener("error", resolve, { once: true });
      })
    )));

    const exportWrapper = frameDocument.createElement("div");
    const exportBoard = exportElement.cloneNode(true);
    exportWrapper.className = "app-shell";
    exportWrapper.dataset.theme = "dark";
    exportWrapper.style.width = `${desktopWidth + 72}px`;
    exportWrapper.style.padding = "36px";
    exportWrapper.style.background = "#0b0d10";
    exportWrapper.style.boxSizing = "border-box";
    exportWrapper.style.position = "fixed";
    exportWrapper.style.left = "-10000px";
    exportWrapper.style.top = "0";
    exportWrapper.style.pointerEvents = "none";
    exportBoard.classList.add("leaderboard-export-desktop");
    if (isIOS()) exportBoard.classList.add("leaderboard-export-ios");
    exportBoard.style.width = `${desktopWidth}px`;
    exportBoard.style.maxWidth = "none";
    exportBoard.style.border = "2px solid rgba(255,255,255,0.12)";
    exportBoard.style.overflow = "visible";
    exportWrapper.appendChild(exportBoard);
    frameDocument.body.appendChild(exportWrapper);
    if (frameDocument.fonts?.ready) await frameDocument.fonts.ready;
    await Promise.all(Array.from(exportWrapper.querySelectorAll("img")).map(async (image) => {
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
        // Keep the original source as a fallback for remote avatars.
      }
    }));
    await Promise.all(Array.from(exportWrapper.querySelectorAll("img")).map(async (image) => {
      if (!image.complete) {
        await new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }
      if (image.decode) await image.decode().catch(() => {});
    }));
    if (isIOS()) {
      if (frameDocument.fonts?.ready) await frameDocument.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    const exportShadows = {
      first: {
        boxShadow: "0 0 0 1px rgba(255,183,3,0.55), 0 0 18px rgba(255,183,3,0.16), 0 12px 24px rgba(255,183,3,0.14)"
      },
      second: {
        boxShadow: "0 0 0 1px rgba(220,228,238,0.28), 0 0 18px rgba(185,198,213,0.16), 0 12px 24px rgba(154,164,175,0.14)"
      },
      third: {
        boxShadow: "0 0 0 1px rgba(236,157,91,0.28), 0 0 18px rgba(218,127,58,0.16), 0 12px 24px rgba(176,106,52,0.14)"
      }
    };
    Object.entries(exportShadows).forEach(([tone, styles]) => {
      exportBoard.querySelectorAll(`.league-podium-card.${tone}`).forEach((card) => {
        card.style.boxShadow = styles.boxShadow;
      });
    });
    try {
      const captureOptions = {
        width: desktopWidth + 72,
        height: exportWrapper.scrollHeight,
        bgcolor: "#0b0d10",
        windowWidth: 1200,
        windowHeight: 1000,
      };

      // iOS may finish loading cloned images only after the first canvas pass.
      // Warm up once, then use the second capture for the visible preview.
      if (isIOS()) await domtoimage.toCanvas(exportWrapper, captureOptions);
      const canvas = await domtoimage.toCanvas(exportWrapper, captureOptions);

      if (isIOS()) {
        const dataUrl = canvas.toDataURL("image/png");
        setPreviewUrl(dataUrl);
      } else {
        const link = document.createElement("a");
        link.download = `${sessionId || "stp-session"}-results.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
    } catch (err) {
      console.error('Leaderboard export failed:', err);
      setExportError('Export failed. Please try again.');
    } finally {
      exportFrame.remove();
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
            {exportError && <div className="export-error" role="alert">{exportError}</div>}
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
            style={{
              display: "block",
              width: "min(100%, 1100px)",
              height: "auto",
              maxHeight: "75vh",
              objectFit: "contain",
              background: "#0b0d10",
              borderRadius: 8,
            }}
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