import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-brand">
        Knowledge Hub
      </NavLink>
      <div className="navbar-links">
        <NavLink to="/chat" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Chat
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Search
        </NavLink>
        {user?.role === 'admin' && (
          <>
            <NavLink
              to="/admin/documents"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              Documents
            </NavLink>
            <NavLink
              to="/admin/qa"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              Q&amp;A Pairs
            </NavLink>
          </>
        )}
      </div>
      <div className="navbar-user">
        <span>{user?.email}</span>
        <span className="badge badge-info">{user?.role}</span>
        <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
