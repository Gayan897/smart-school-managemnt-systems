import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ShieldCheck, Key, Eye, EyeOff, Lock, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import '../components/AppShell.css';
import landingBg from '../assets/landing_bg.png';

export default function AdminLoginScreen() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter your Zonal Admin username and password.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const loggedInUser = await login(username.trim(), password);
      if (loggedInUser.role !== 'zonal_admin') {
        logout();
        throw new Error('Access Denied: This portal is exclusively for Zonal Education Administrators. School staff must login via /login.');
      }
      navigate('/admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Admin login failed');
    } finally {
      setLoading(false);
    }
  }

  // If already logged in as a non-zonal admin (e.g. principal or teacher)
  if (user && user.role !== 'zonal_admin') {
    return (
      <div className="auth-page">
        <div className="auth-right" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100%' }}>
          <div className="auth-form-container" style={{ maxWidth: '460px', textAlign: 'center', padding: '32px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Lock size={28} color="#ef4444" />
            </div>
            <h1 className="auth-form-title" style={{ fontSize: '20px', marginBottom: '8px' }}>Restricted Access</h1>
            <p className="auth-form-sub" style={{ marginBottom: '20px' }}>
              You are currently logged in as <strong>{user.name}</strong> ({user.role === 'principal' ? 'Principal' : 'Teacher'}).
              <br />
              This URL (<code>/admin</code>) is strictly reserved for <strong>Zonal Education Administrators</strong>.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/dashboard')}
              >
                Return to Dashboard
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => { logout(); navigate('/admin'); }}
                style={{ background: '#ef4444', color: '#fff' }}
              >
                <LogOut size={15} style={{ marginRight: '6px' }} />
                Switch Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      {/* Left hero panel */}
      <div className="auth-left" style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 100%)' }}>
        <div className="auth-left-bg" style={{ backgroundImage: `url(${landingBg})`, opacity: 0.15 }} />
        <div className="auth-left-overlay" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.3) 0%, rgba(15,23,42,0.85) 100%)' }} />
        <div className="auth-left-content">
          <div className="auth-logo" style={{ background: '#7c3aed' }}>
            <Building2 size={36} color="#fff" />
          </div>
          <div className="auth-app-name" style={{ color: '#c4b5fd' }}>SAMS ADMIN</div>
          <p className="auth-tagline">Ministry of Education • Zonal Command Portal</p>
          <div className="auth-features" style={{ marginTop: '24px' }}>
            <div className="auth-feature">
              <ShieldCheck size={16} color="#a78bfa" />
              <span>Isolated Master Command Center</span>
            </div>
            <div className="auth-feature">
              <Key size={16} color="#a78bfa" />
              <span>School Secret Key & Registry Management</span>
            </div>
            <div className="auth-feature">
              <Building2 size={16} color="#a78bfa" />
              <span>District Directives & Multi-School Oversight</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="auth-right">
        <div className="auth-form-container" style={{ maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(124, 58, 237, 0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <Building2 size={24} color="#7c3aed" />
            </div>
            <h1 className="auth-form-title" style={{ fontSize: '22px', color: 'var(--text-main)' }}>
              Admin Panel Login
            </h1>
            <p className="auth-form-sub">
              Zonal Education Office • Security Authenticated Access
            </p>
          </div>

          {error && <div className="auth-error" style={{ marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

          {/* Secure Login Form Only */}
          <form onSubmit={handleAdminLogin}>
            <div className="form-group">
              <label className="form-label">Zonal Admin Username</label>
              <input
                id="admin-username"
                className="form-control"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username (e.g. admin)"
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <input
                  id="admin-password"
                  className="form-control"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ paddingRight: '38px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
                  }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="admin-login-submit"
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '12px', background: '#7c3aed', borderColor: '#7c3aed' }}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : null}
              Access Admin Panel
            </button>
          </form>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>

          </div>

        </div>
      </div>
    </div>
  );
}
