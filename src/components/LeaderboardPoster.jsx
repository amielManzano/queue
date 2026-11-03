import React, { forwardRef } from "react";
import gold1 from "../assets/gold1.png";
import gold2 from "../assets/gold2.png";
import silver1 from "../assets/silver1.png";
import silver2 from "../assets/silver2.png";
import bronze1 from "../assets/bronze1.png";
import bronze2 from "../assets/bronze2.png";
import courtBlueprint from "../assets/court-blueprint.webp";

const clashLogo = "/clash-logo.png";

// Square 1080px share posters for the leaderboard export. Exported at 2x.
export const POSTER_SIZE = 1080;

export const PODIUM_TONES = {
  1: { medal: gold1, leaves: gold2, tone: "gold", label: "1st place · leader" },
  2: { medal: silver1, leaves: silver2, tone: "silver", label: "2nd place" },
  3: { medal: bronze1, leaves: bronze2, tone: "bronze", label: "3rd place" },
};

export function getInitials(name = "") {
  return name.split(/\s+/).filter(Boolean).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
}

const formatNumber = (value) => (Number(value) || 0).toLocaleString("en-US");

export function PosterMedal({ rank, size }) {
  const tone = PODIUM_TONES[rank];
  return (
    <div className="lb-poster-medal" style={size ? { width: size, height: size } : undefined}>
      <img src={tone.leaves} alt="" />
      <img src={tone.medal} alt="" className="lb-poster-medal-face" />
    </div>
  );
}

export function PosterStats({ player }) {
  return (
    <>
      <div className="lb-poster-stats">
        <div><span>Games</span><strong>{player ? formatNumber(player.gamesPlayed) : "--"}</strong></div>
        <div><span>W-L</span><strong>{player ? `${player.wins}-${player.losses}` : "--"}</strong></div>
        <div><span>Win rate</span><strong>{player ? `${player.winRatePct}%` : "--"}</strong></div>
        <div><span>Points</span><strong>{player ? formatNumber(player.points) : "--"}</strong></div>
      </div>
      <div className="lb-poster-bar"><i style={{ width: `${player?.winRatePct ?? 0}%` }} /></div>
    </>
  );
}

// Tied players share a podium slot: show every name, stats of the first.
function podiumName(group) {
  return group.length ? group.map((player) => player.name).join(", ") : "No player yet";
}

const LeaderboardPoster = forwardRef(function LeaderboardPoster(
  { variant, scopeLabel, dateLabel, clubName, footnote, podiumGroups, topPlayers },
  ref,
) {
  const club = (clubName || "CLASH").trim();
  const hashtag = `#${club.replace(/[^a-z0-9]/gi, "")}Rankings`;
  // "podium" = top 3 cards, "standings" = top 10 table, "all" = every ranked
  // player in a table (that poster grows taller instead of staying square)
  const isPodium = variant === "podium";
  const headline = isPodium ? "Top Three" : variant === "all" ? "Full Rankings" : "Top 10 Rankings";
  const [first, second, third] = [1, 2, 3].map((rank) => podiumGroups.find((group) => group.rankNumber === rank)?.players || []);

  return (
    <div ref={ref} className={`lb-poster lb-poster-${variant}`}>
      <img src={courtBlueprint} alt="" className="lb-poster-court" />
      <span className="lb-poster-slash" />
      <span className="lb-poster-slash thin" />

      <div className="lb-poster-head">
        <div className="lb-poster-brand"><img src={clashLogo} alt="" />Leaderboard</div>
        <div className="lb-poster-date">As of <b>{dateLabel}</b></div>
      </div>
      <div className="lb-poster-title">
        <span className="lb-poster-kicker">{scopeLabel}</span>
        <span className="lb-poster-headline">{headline}</span>
      </div>
      <div className="lb-poster-tag"><i />{isPodium ? "The podium so far" : `${scopeLabel} standings`}</div>

      {isPodium ? (
        <>
          <div className="lb-poster-hero">
            <PosterMedal rank={1} size={200} />
            <div className="lb-poster-hero-body">
              <div className="lb-poster-who">
                <div>
                  <div className="lb-poster-place gold">{PODIUM_TONES[1].label}</div>
                  <div className="lb-poster-name hero">{podiumName(first)}</div>
                </div>
              </div>
              <PosterStats player={first[0]} />
            </div>
          </div>
          <div className="lb-poster-duo">
            {[[2, second], [3, third]].map(([rank, group]) => (
              <div key={rank} className={`lb-poster-card ${PODIUM_TONES[rank].tone}`}>
                <div className="lb-poster-card-top">
                  <PosterMedal rank={rank} size={100} />
                  <div>
                    <div className={`lb-poster-place ${PODIUM_TONES[rank].tone}`}>{PODIUM_TONES[rank].label}</div>
                    <div className="lb-poster-name">{podiumName(group)}</div>
                  </div>
                </div>
                <PosterStats player={group[0]} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="lb-poster-table">
          <div className="lb-poster-th">
            <span>Rank</span><span>Player</span><span className="c">Games</span><span className="c">W-L</span><span>Win rate</span><span className="r">Points</span>
          </div>
          {topPlayers.map((player) => (
            <div key={player.id} className={`lb-poster-tr ${PODIUM_TONES[player.rank]?.tone || ""}`}>
              <span className="lb-poster-rank">{String(player.rank).padStart(2, "0")}</span>
              <span className="lb-poster-player"><span className="lb-poster-avatar">{getInitials(player.name)}</span>{player.name}</span>
              <span className="c">{formatNumber(player.gamesPlayed)}</span>
              <span className="c">{player.wins}-{player.losses}</span>
              <span className="lb-poster-wr"><span className="lb-poster-bar"><i style={{ width: `${player.winRatePct}%` }} /></span><b>{player.winRatePct}%</b></span>
              <span className="r lb-poster-points">{formatNumber(player.points)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="lb-poster-foot"><span>{footnote}</span><b>{hashtag}</b></div>
    </div>
  );
});

export default LeaderboardPoster;
