import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Key, ShieldCheck, X, CheckCircle, Lock, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { AppLanguage, GovernmentSchool } from '../data/models';
import '../components/AppShell.css';
import landingBg from '../assets/landing_bg.png';

export default function LoginScreen() {
  const { login, logout, language, setLanguage } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password / Principal Account Recovery Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [schools, setSchools] = useState<GovernmentSchool[]>([]);
  const [recoverySchoolCode, setRecoverySchoolCode] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [recoveryNewPw, setRecoveryNewPw] = useState('');
  const [showRecoveryPw, setShowRecoveryPw] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccessMsg, setRecoverySuccessMsg] = useState('');

  const langs: { value: AppLanguage; label: string }[] = [
    { value: 'english', label: 'English' },
    { value: 'sinhala', label: 'සිංහල' },
    { value: 'tamil',   label: 'தமிழ்' },
  ];

  useEffect(() => {
    databaseService.getZonalSchools().then(data => {
      setSchools(data);
      if (data.length > 0) {
        setRecoverySchoolCode(data[0].censusCode);
      }
    }).catch(err => console.error('Failed to load schools:', err));
  }, []);

  const [pendingTimerSecs, setPendingTimerSecs] = useState<number | null>(null);

  useEffect(() => {
    if (pendingTimerSecs === null || pendingTimerSecs <= 0) return;
    const interval = setInterval(() => {
      setPendingTimerSecs(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setError('🎉 2-Minute Security Delay finished! Click Login to enter your dashboard.');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pendingTimerSecs]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter username and password.');
      return;
    }
    setLoading(true);
    setError('');
    setPendingTimerSecs(null);
    try {
      const loggedInUser = await login(username.trim(), password);
      if (loggedInUser.role === 'student' || loggedInUser.role === 'parent') {
        logout();
        setError('Access Restricted: This web portal is exclusively for Principals and Teachers. Students and Parents must use the mobile application.');
        return;
      }
      if (loggedInUser.role === 'zonal_admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      if (msg.includes('Account Verification Pending')) {
        const matchSecs = msg.match(/(\d+)\s+second/);
        const matchMins = msg.match(/(\d+)\s+minute/);
        let total = 0;
        if (matchMins) total += parseInt(matchMins[1], 10) * 60;
        if (matchSecs) total += parseInt(matchSecs[1], 10);
        if (total > 0) setPendingTimerSecs(total);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordRecovery(e: React.FormEvent) {
    e.preventDefault();
    if (!recoveryKey.trim() || !recoveryNewPw) {
      setRecoveryError('Please enter your Zonal Master Security Key and New Password.');
      return;
    }
    if (recoveryNewPw.length < 6) {
      setRecoveryError('New Password must be at least 6 characters long.');
      return;
    }
    setRecoveryLoading(true);
    setRecoveryError('');
    setRecoverySuccessMsg('');
    try {
      const res = await databaseService.resetPrincipalPassword(
        recoverySchoolCode,
        recoveryKey.trim(),
        recoveryNewPw
      );
      setRecoverySuccessMsg(`✅ Password reset successfully for Principal ${res.name} (${res.schoolName})!`);
      setUsername(res.username);
      setPassword(recoveryNewPw);
    } catch (err: unknown) {
      setRecoveryError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setRecoveryLoading(false);
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

          {error && (
            <div
              className="auth-error"
              style={{
                fontSize: '13px',
                lineHeight: 1.5,
                ...(pendingTimerSecs !== null
                  ? {
                      background: 'rgba(2, 132, 199, 0.1)',
                      borderColor: 'rgba(2, 132, 199, 0.4)',
                      color: '#0284c7',
                    }
                  : {}),
              }}
            >
              <div>{error}</div>
              {pendingTimerSecs !== null && (
                <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(2,132,199,0.12)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 900, fontSize: '22px', fontFamily: 'monospace', color: '#0284c7' }}>
                    ⏱️ {String(Math.floor(pendingTimerSecs / 60)).padStart(2, '0')}:{String(pendingTimerSecs % 60).padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.9 }}>
                    Automated security verification active. Please wait for the 2-minute timer to finish.
                  </div>
                </div>
              )}
            </div>
          )}

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

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">{t('password', language)}</label>
                <button
                  type="button"
                  className="auth-link"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-color)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  onClick={() => {
                    setShowForgotModal(true);
                    setRecoveryError('');
                    setRecoverySuccessMsg('');
                  }}
                >
                  🔑 {t('forgotPassword', language)}
                </button>
              </div>
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

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '18px' }}>
              <button
                id="login-submit"
                type="submit"
                className="btn btn-primary btn-lg"
                style={{
                  width: '100%',
                  maxWidth: '240px',
                  height: '44px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '15px',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : <LogIn size={17} />}
                <span>{t('login', language)}</span>
              </button>
            </div>
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

      {/* ── Principal Forgot Password / Recovery Modal ── */}
      {showForgotModal && (
        <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)', zIndex: 1000 }}>
          <div className="modal-content card" style={{ maxWidth: '440px', width: '92%', border: '2px solid #0284c7', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', animation: 'modalSlideIn 0.25s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                  <Key size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-color)' }}>{t('principalRecovery', language)}</h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Verify Zonal Security Key to Reset Password</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForgotModal(false)} style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {recoveryError && (
              <div style={{ background: 'rgba(225, 29, 72, 0.1)', border: '1px solid rgba(225, 29, 72, 0.3)', color: '#e11d48', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '14px', lineHeight: 1.4 }}>
                {recoveryError}
              </div>
            )}

            {recoverySuccessMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '12px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={16} /> Password Recovery Complete
                </div>
                <div>{recoverySuccessMsg}</div>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#059669' }}>
                  Username auto-filled on login screen. Click <strong>Login</strong> to proceed.
                </div>
              </div>
            )}

            <form onSubmit={handlePasswordRecovery}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px' }}>Select Government School</label>
                <select
                  className="form-control"
                  value={recoverySchoolCode}
                  onChange={e => setRecoverySchoolCode(e.target.value)}
                  required
                >
                  {schools.map(sch => (
                    <option key={sch.censusCode} value={sch.censusCode}>
                      {sch.name} ({sch.zone} Zone - Census: {sch.censusCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px' }}>Zonal Master Security Key *</label>
                <div className="input-wrapper">
                  <input
                    className="form-control"
                    placeholder="e.g. HMG-MRC-8942"
                    value={recoveryKey}
                    onChange={e => setRecoveryKey(e.target.value)}
                    style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}
                    required
                  />
                  <ShieldCheck size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#0284c7' }} />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Issued by Colombo Zonal Education Office
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label" style={{ fontSize: '12px' }}>New Password *</label>
                <div className="input-wrapper">
                  <input
                    className="form-control"
                    type={showRecoveryPw ? 'text' : 'password'}
                    placeholder="Enter new password (min. 6 chars)"
                    value={recoveryNewPw}
                    onChange={e => setRecoveryNewPw(e.target.value)}
                    style={{ paddingRight: '38px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRecoveryPw(s => !s)}
                    style={{
                      position: 'absolute', right: '10px', top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
                    }}
                  >
                    {showRecoveryPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  disabled={recoveryLoading}
                >
                  {recoveryLoading ? <span className="spinner spinner-sm" /> : <><Lock size={14} /> Reset Password</>}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowForgotModal(false)}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
