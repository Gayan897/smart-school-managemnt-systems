import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import type { AppLanguage } from '../data/models';
import '../components/AppShell.css';
import landingBg from '../assets/landing_bg.png';

export default function LoginScreen() {
  const { login, language, setLanguage } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const langs: { value: AppLanguage; label: string }[] = [
    { value: 'english', label: 'English' },
    { value: 'sinhala', label: 'සිංහල' },
    { value: 'tamil',   label: 'தமிழ்' },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const loggedInUser = await login(username.trim(), password);
      if (loggedInUser.role === 'zonal_admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Left hero panel */}
      <div className="auth-left">
        <div className="auth-left-bg" style={{ backgroundImage: `url(${landingBg})` }} />
        <div className="auth-left-overlay" />
        <div className="auth-left-content">
          <div className="auth-logo">
            <GraduationCap size={40} color="#fff" />
          </div>
          <div className="auth-app-name">EduNexus</div>
          <p className="auth-tagline">{t('appFullName', language)}</p>
          <div className="auth-features">
            {['Attendance Tracking', 'Leave Management', 'Performance Reports', 'Timetable Management'].map(f => (
              <div key={f} className="auth-feature">
                <div className="auth-feature-dot" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="auth-right">
        <div className="auth-form-container">
          <h1 className="auth-form-title">{t('loginTitle', language)}</h1>
          <p className="auth-form-sub">Sri Lanka Government Schools</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t('username', language)}</label>
              <input
                id="login-username"
                className="form-control"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                placeholder={t('username', language)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('password', language)}</label>
              <div className="input-wrapper">
                <input
                  id="login-password"
                  className="form-control"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  style={{ paddingRight: '38px' }}
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
              id="login-submit"
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : null}
              {t('login', language)}
            </button>
          </form>

          <div className="auth-link-row">
            {t('noAccount', language)}{' '}
            <Link to="/signup" className="auth-link">{t('signUp', language)}</Link>
          </div>

          <div className="auth-lang">
            {langs.map(l => (
              <button
                key={l.value}
                className={`auth-lang-btn ${language === l.value ? 'active' : ''}`}
                onClick={() => setLanguage(l.value)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
