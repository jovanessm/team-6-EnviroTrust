import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChatBot, BotIcon } from './ChatBot';
import './Header.css';

export function Header() {
  const { pathname } = useLocation();
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">
            <span className="logo-name">NviroTrust</span>
          </Link>
          <nav className="nav">
            <Link to="/" className={pathname === '/' ? 'nav-link active' : 'nav-link'}>
              Home
            </Link>
            <Link to="/analyze" className={pathname === '/analyze' ? 'nav-link active' : 'nav-link'}>
              Analyze
            </Link>
            <Link to="/compare" className={pathname === '/compare' ? 'nav-link active' : 'nav-link'}>
              Compare
            </Link>
            <Link to="/portfolio" className={pathname === '/portfolio' ? 'nav-link active' : 'nav-link'}>
              Portfolio
            </Link>
          </nav>
          <button
            className={`ai-btn${chatOpen ? ' active' : ''}`}
            onClick={() => setChatOpen(v => !v)}
            aria-label="Open AI assistant"
            title="Park Assistant"
          >
            <BotIcon size={18} />
            <span className="ai-btn-label">Ask AI</span>
          </button>
          <Link to="/analyze" className="header-cta">
            Get Started
          </Link>
        </div>
      </header>

      <ChatBot open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
