import BadgeImg from './BadgeImg.js';

export default function DirectoryBadges() {
  return (
    <div className="featured">
      <p className="featured-label">Featured on</p>
      <div className="featured-row">
        <a className="badge-link" href="https://smollaunch.com" target="_blank" rel="noopener">
          <BadgeImg src="https://smollaunch.com/badges/featured.svg" alt="AI Visibility Checker — Featured on Smol Launch" loading="lazy" width={250} height={60} />
        </a>
        <a className="launched" href="https://launched.tools/tools/ai-visibility-checker" target="_blank" rel="noopener">
          <span className="launched-mark" aria-hidden="true" />
          <span className="launched-copy">
            <span className="launched-title">Featured on launched.tools</span>
            <span className="launched-sub">REVIEWED ✓</span>
          </span>
        </a>
        <a className="badge-link" href="https://www.aitoolfinder.com/" target="_blank" rel="noopener">
          <BadgeImg src="https://www.aitoolfinder.com//function/badge-generator.php?type=2&theme=light&domain=www.aitoolfinder.com" alt="Featured on AIToolFinder" loading="lazy" height={84} />
        </a>
        <a className="fazier" href="https://fazier.com" target="_blank" rel="noopener">
          <BadgeImg src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=featured&theme=light" width={160} height={38} alt="Fazier badge" loading="lazy" />
        </a>
        <span className="muted"><a href="https://twelve.tools">Listed on Twelve.tools</a> · <a href="https://dang.ai">Featured on Dang.ai</a></span>
      </div>
    </div>
  );
}
