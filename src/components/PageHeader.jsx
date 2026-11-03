import React from "react";

// The page header every tab shares (the leaderboard look): a big gradient
// title with a kicker above and a tag line below, and on the right an
// optional info pill above the page's own controls.
export default function PageHeader({ meta, kicker, title, tag, children }) {
  return (
    <header className="lb-page-header">
      <div className="lb-page-title-row">
        <div>
          <div className="lb-poster-title">
            {kicker && <span className="lb-poster-kicker">{kicker}</span>}
            <span className="lb-poster-headline">{title}</span>
          </div>
          {tag && <div className="lb-poster-tag"><i />{tag}</div>}
        </div>
        {(meta || children) && (
          <div className="lb-page-header-side">
            {meta && <div className="lb-poster-date">{meta}</div>}
            {children && <div className="lb-page-controls">{children}</div>}
          </div>
        )}
      </div>
    </header>
  );
}
