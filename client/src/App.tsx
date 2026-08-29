import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute, AdminRoute } from './components/RouteGuards';
import { NavBar } from './components/NavBar';

import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ChatPage } from './pages/ChatPage';
import { SearchPage } from './pages/SearchPage';
import { AdminDocumentsPage } from './pages/AdminDocumentsPage';
import { AdminQAPage } from './pages/AdminQAPage';

function AppLayout() {
  return (
    <div className="app-shell">
      <NavBar />
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}

function ChatLayout() {
  return (
    <div className="app-shell">
      <NavBar />
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Authenticated — Chat gets its own full-height layout (no .main-content padding) */}
          <Route element={<PrivateRoute />}>
            <Route element={<ChatLayout />}>
              <Route path="/chat" element={<ChatPage />} />
            </Route>

            <Route element={<AppLayout />}>
              <Route path="/search" element={<SearchPage />} />

              {/* Admin only */}
              <Route element={<AdminRoute />}>
                <Route path="/admin/documents" element={<AdminDocumentsPage />} />
                <Route path="/admin/qa" element={<AdminQAPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
