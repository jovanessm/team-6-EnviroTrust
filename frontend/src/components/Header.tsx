import { Link } from 'react-router-dom';
import './Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <span className="logo-icon">🛰️</span>
          <span className="logo-text">EnviroTrust</span>
        </Link>
        <nav className="nav">
          <Link to="/">Home</Link>
          <Link to="/analyze">Analyze Park</Link>
        </nav>
      </div>
    </header>
  );
}
