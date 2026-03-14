import { NavLink } from "react-router-dom";
import "./Nav.css";

export default function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-brand">
          <span className="nav-logo">⬡</span>
          <span className="nav-title">Octave Skills Hub</span>
          <span className="nav-badge">MVP</span>
        </div>

        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>Discover</NavLink>
          <NavLink to="/upload" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>Upload Skill</NavLink>
          <NavLink to="/match" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>AI Match</NavLink>
          <NavLink to="/guide" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>How to Use</NavLink>
          <NavLink to="/admin" className={({ isActive }) => `nav-link nav-link-admin ${isActive ? "active" : ""}`}>Admin</NavLink>
        </div>
      </div>
    </nav>
  );
}
