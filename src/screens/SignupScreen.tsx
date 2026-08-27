import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, ShieldCheck, Key, Building2, UserCheck, ChevronRight, ArrowLeft, Mail, Smartphone, Send, X, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { User, UserRole, GovernmentSchool } from '../data/models';
import '../components/AppShell.css';
import landingBg from '../assets/landing_bg.png';

export default function SignupScreen() {
  const { login, logout, language } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('teacher');
  const [isZonalPortal, setIsZonalPortal] = useState(false);

  // School Selection
  const [schools, setSchools] = useState<GovernmentSchool[]>([]);
  const [selectedSchoolCode, setSelectedSchoolCode] = useState('10421'); // Default: Mahinda Rajapaksha College

  // Principal Verification Details
  const [zonalSecretKey, setZonalSecretKey] = useState('');
  const [sleasNumber, setSleasNumber] = useState('');
  const [nicNumber, setNicNumber] = useState('');

  // Zonal Admin Security Key
  const [zonalAdminKey, setZonalAdminKey] = useState('');

  // Magic Link Dispatch Invitation
  const [isMagicInvite, setIsMagicInvite] = useState(false);

  // Request Zonal Master Key Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqPrincipalName, setReqPrincipalName] = useState('');
  const [reqPrincipalEmail, setReqPrincipalEmail] = useState('');
  const [reqPrincipalPhone, setReqPrincipalPhone] = useState('');
  const [reqSleasNumber, setReqSleasNumber] = useState('');
  const [reqNicNumber, setReqNicNumber] = useState('');
  const [reqSchoolCode, setReqSchoolCode] = useState('10421');
  const [requestingKey, setRequestingKey] = useState(false);
  const [requestSuccessMsg, setRequestSuccessMsg] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    databaseService.getZonalSchools().then(data => {
      setSchools(data);

      // Check URL search parameters for magic invitation link
      const params = new URLSearchParams(window.location.search);
      const qCensusCode = params.get('censusCode');
      const qKey = params.get('key');
      const qInvite = params.get('invite');

      if (qCensusCode && qKey) {
        setSelectedSchoolCode(qCensusCode);
        setReqSchoolCode(qCensusCode);
        setZonalSecretKey(qKey);
        setRole('principal');
        setIsMagicInvite(true);
      } else if (data.length > 0) {
        setSelectedSchoolCode(data[0].censusCode);
        setReqSchoolCode(data[0].censusCode);
      }
    }).catch(err => console.error('Failed to load schools:', err));
  }, []);

  async function handleSendKeyRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!reqPrincipalName.trim() || !reqPrincipalEmail.trim() || !reqSchoolCode) {
      setError('Please fill in all key request details.');
      return;
    }
    setRequestingKey(true);
    setRequestSuccessMsg('');
    try {
      const sch = schools.find(s => s.censusCode === reqSchoolCode);
      await databaseService.requestZonalMasterKey({
        principalName: reqPrincipalName.trim(),
        principalEmail: reqPrincipalEmail.trim(),
        principalPhone: reqPrincipalPhone.trim(),
        sleasNumber: reqSleasNumber.trim(),
        nicNumber: reqNicNumber.trim(),
        censusCode: reqSchoolCode,
        schoolName: sch?.name || 'Government School',
      });
      setRequestSuccessMsg(`✅ Request submitted! Homagama / Colombo Zonal Education Office has been notified. An official email dispatch will be sent to ${reqPrincipalEmail.trim()}.`);
    } catch (err) {
      console.error('Failed to submit key request:', err);
    } finally {
      setRequestingKey(false);
    }
  }

  function toggleZonalPortal(showZonal: boolean) {
    setIsZonalPortal(showZonal);
    if (showZonal) {
      setRole('zonal_admin');
    } else {
      setRole('teacher');
    }
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password) {
      setError('Please fill in all basic account fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Check existing username
      const existing = await databaseService.getUserByUsername(username.trim());
      if (existing) throw new Error('Username already taken. Please choose another.');

      const selectedSchool = schools.find(s => s.censusCode === selectedSchoolCode);

      // 2. Role-specific Security Checks
      if (role === 'principal') {
        if (!zonalSecretKey.trim()) {
          throw new Error('Zonal Master Security Key is required for Principal registration.');
        }
        if (!sleasNumber.trim() || !nicNumber.trim()) {
          throw new Error('Official SLEAS / Service ID and NIC Number are required.');
        }

        // Verify Zonal Key against Database
        const ver = await databaseService.verifyZonalPrincipalKey(selectedSchoolCode, zonalSecretKey.trim());
        if (!ver.valid) {
          throw new Error(ver.error || 'Zonal Verification Failed.');
        }
      } else if (role === 'zonal_admin') {
        // Master Zonal Access Code check
        const MASTER_ZONAL_KEY = 'ZONAL-MOE-2024';
        if (zonalAdminKey.trim().toUpperCase() !== MASTER_ZONAL_KEY) {
          throw new Error('Invalid Zonal Admin Access Code. Contact Ministry of Education ICT.');
        }
      }

      // 3. Create User Document
      const newUser: User = {
        id: crypto.randomUUID(),
        username: username.trim(),
        password,
        name: name.trim(),
        role,
        schoolCensusCode: role === 'zonal_admin' ? 'ZONAL-MOE' : selectedSchoolCode,
        schoolName: role === 'zonal_admin' ? 'Colombo / Homagama Zonal Education Office' : (selectedSchool?.name || 'Mahinda Rajapaksha College'),
        nicNumber: nicNumber.trim() || undefined,
        sleasNumber: sleasNumber.trim() || undefined,
      };

      await databaseService.createUser(newUser);

      // 4. Post-registration role setup
      if (role === 'teacher') {
        await databaseService.createTeacherProfile(newUser);
      } else if (role === 'principal') {
        await databaseService.registerSchoolPrincipal(selectedSchoolCode, newUser);
      }

      logout();
      await login(username.trim(), password);

      if (role === 'zonal_admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-left-bg" style={{ backgroundImage: `url(${landingBg})` }} />
        <div className="auth-left-overlay" />
        <div className="auth-left-content">
          <div className="auth-logo">
            <GraduationCap size={40} color="#fff" />
          </div>
          <div className="auth-app-name">SAMS</div>
          <p className="auth-tagline">{t('appFullName', language)}</p>
          <div className="auth-features" style={{ marginTop: '20px' }}>
            <div className="auth-feature">
              <Building2 size={16} color="#38bdf8" />
              <span>Colombo District & Homagama Zone Portal</span>
            </div>
            <div className="auth-feature">
              <ShieldCheck size={16} color="#34d399" />
              <span>Zonal Master Key Verification System</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-container" style={{ maxWidth: '440px' }}>
          {isZonalPortal ? (
            <div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => toggleZonalPortal(false)}
                style={{ marginBottom: '12px', paddingLeft: 0, color: '#0284c7' }}
              >
                <ArrowLeft size={16} style={{ marginRight: 4 }} /> Back to School Portal
              </button>
              <h1 className="auth-form-title" style={{ color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={24} /> Zonal Education Office Portal
              </h1>
              <p className="auth-form-sub">Ministry of Education • Zonal Officer Registration</p>
            </div>
          ) : (
            <div>
              <h1 className="auth-form-title">{t('signupTitle', language)}</h1>
              <p className="auth-form-sub">Sri Lanka Government Schools Portal</p>
            </div>
          )}

          {error && (
            <div className="auth-error" style={{ fontSize: '13px', lineHeight: 1.4 }}>
              {error}
            </div>
          )}

          {isMagicInvite && (
            <div style={{ background: 'rgba(124, 58, 237, 0.12)', border: '1px solid rgba(124, 58, 237, 0.3)', color: '#7c3aed', padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={22} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700 }}>Verified Zonal Invitation Link</div>
                <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                  Your Zonal Master Security Key (<code>{zonalSecretKey}</code>) was automatically verified from official dispatch.
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* School Staff Role Selection (Teacher & Principal ONLY) */}
            {!isZonalPortal && (
              <div className="form-group">
                <label className="form-label">School Role</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn ${role === 'teacher' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '13px', padding: '9px 6px' }}
                    onClick={() => setRole('teacher')}
                  >
                    Teacher
                  </button>
                  <button
                    type="button"
                    className={`btn ${role === 'principal' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '13px', padding: '9px 6px' }}
                    onClick={() => setRole('principal')}
                  >
                    Principal
                  </button>
                </div>
              </div>
            )}

            {/* School Selection (For Teacher and Principal) */}
            {!isZonalPortal && (
              <div className="form-group">
                <label className="form-label">Select Government School (Colombo District)</label>
                <select
                  className="form-control"
                  value={selectedSchoolCode}
                  onChange={e => setSelectedSchoolCode(e.target.value)}
                >
                  {schools.map(sch => (
                    <option key={sch.censusCode} value={sch.censusCode}>
                      {sch.name} ({sch.zone} Zone - Census: {sch.censusCode})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Principal Specific Security Verification */}
            {!isZonalPortal && role === 'principal' && (
              <div style={{ background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.3)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <ShieldCheck size={16} /> Principal Zonal Identity Verification
                </div>
                <div className="form-group" style={{ marginBottom: '6px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Zonal Master Security Key (Issued by Zonal Office)</label>
                  <input
                    className="form-control"
                    placeholder="e.g. HMG-MRC-8942"
                    value={zonalSecretKey}
                    onChange={e => setZonalSecretKey(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: '#7c3aed', fontWeight: 600, fontSize: '11px', padding: '2px 0', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => {
                      setShowRequestModal(true);
                      setReqPrincipalName(name);
                      setReqSleasNumber(sleasNumber);
                      setReqNicNumber(nicNumber);
                      setReqSchoolCode(selectedSchoolCode);
                      setRequestSuccessMsg('');
                    }}
                  >
                    <Key size={12} /> Don't have a Zonal Master Key? Request Key from Admin →
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>SLEAS / Service ID</label>
                    <input
                      className="form-control"
                      placeholder="e.g. PF-88492"
                      value={sleasNumber}
                      onChange={e => setSleasNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>NIC Number</label>
                    <input
                      className="form-control"
                      placeholder="e.g. 1978...V"
                      value={nicNumber}
                      onChange={e => setNicNumber(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Request Zonal Key Modal */}
            {showRequestModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
                <div style={{ background: 'var(--bg-card, #ffffff)', width: '100%', maxWidth: '440px', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Key size={18} /> Request Zonal Master Key from Admin
                    </h3>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRequestModal(false)}>
                      <X size={16} />
                    </button>
                  </div>

                  {requestSuccessMsg ? (
                    <div style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '14px', borderRadius: '8px', fontSize: '13px', lineHeight: 1.5 }}>
                      {requestSuccessMsg}
                      <div style={{ marginTop: '16px' }}>
                        <button type="button" className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => setShowRequestModal(false)}>
                          Close & Return to Form
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSendKeyRequest}>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>
                        Submit your appointment details directly to the <strong>Homagama / Colombo Zonal Education Office</strong>. Once verified, the Zonal Admin will auto-dispatch your key.
                      </p>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Principal Full Name</label>
                        <input
                          className="form-control"
                          placeholder="e.g. Dr. A. P. Perera"
                          value={reqPrincipalName}
                          onChange={e => setReqPrincipalName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Official Email Address (To Receive Key)</label>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="e.g. principal@school.moe.gov.lk"
                          value={reqPrincipalEmail}
                          onChange={e => setReqPrincipalEmail(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Mobile Phone Number (For SMS Notification)</label>
                        <input
                          type="tel"
                          className="form-control"
                          placeholder="e.g. +94 77 123 4567"
                          value={reqPrincipalPhone}
                          onChange={e => setReqPrincipalPhone(e.target.value)}
                          required
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>SLEAS ID</label>
                          <input
                            className="form-control"
                            placeholder="e.g. SLEAS-982"
                            value={reqSleasNumber}
                            onChange={e => setReqSleasNumber(e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>NIC Number</label>
                          <input
                            className="form-control"
                            placeholder="e.g. 1978...V"
                            value={reqNicNumber}
                            onChange={e => setReqNicNumber(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Target School</label>
                        <select
                          className="form-control"
                          value={reqSchoolCode}
                          onChange={e => setReqSchoolCode(e.target.value)}
                        >
                          {schools.map(s => (
                            <option key={s.censusCode} value={s.censusCode}>
                              {s.name} ({s.censusCode})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1, background: '#7c3aed', borderColor: '#7c3aed' }} disabled={requestingKey}>
                          {requestingKey ? <span className="spinner" /> : <><Send size={14} /> Send Request to Admin</>}
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRequestModal(false)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* Zonal Admin Security Key */}
            {isZonalPortal && (
              <div style={{ background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.3)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Key size={16} /> Zonal Education Admin Authorization Code
                </div>
                <input
                  className="form-control"
                  type="password"
                  placeholder="Enter Zonal Admin Access Code (Default: ZONAL-MOE-2024)"
                  value={zonalAdminKey}
                  onChange={e => setZonalAdminKey(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Basic Info */}
            <div className="form-group">
              <label className="form-label">{t('name', language)}</label>
              <input
                id="signup-name"
                className="form-control"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full Official Name"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('username', language)}</label>
              <input
                id="signup-username"
                className="form-control"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Choose username"
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('password', language)}</label>
              <input
                id="signup-password"
                className="form-control"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                required
              />
            </div>

            <button
              id="signup-submit"
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : null}
              {isZonalPortal ? 'Register Zonal Officer' : role === 'principal' ? 'Verify & Register Principal' : 'Register Teacher'}
            </button>
          </form>



          <div className="auth-link-row" style={{ marginTop: '16px' }}>
            {t('haveAccount', language)}{' '}
            <Link to="/login" className="auth-link">{t('login', language)}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
