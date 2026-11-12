export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap bar">
        <a className="brand" href="/">
          <svg className="mark" width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="currentColor" />
            <path d="M8.5 16.8 13.4 22 23.5 10.5" fill="none" stroke="#f4f1ea" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          AI Visibility Checker
        </a>
        <nav className="site-nav" aria-label="Primary">
          <a href="/#checker">Check your brand</a>
          <a href="/free-ai-visibility-checker">Free checker</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </div>
    </header>
  );
}
