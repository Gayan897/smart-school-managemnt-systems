import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, ShieldCheck, Key, Building2, UserCheck, ChevronRight, ArrowLeft, Mail, Smartphone, Send, X, Bell, CheckCircle, ScanLine } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import { verifyNicImages, validateSriLankaNic } from '../data/nicVerification';
import type { User, UserRole, GovernmentSchool, SchoolClass } from '../data/models';
import '../components/AppShell.css';
import landingBg from '../assets/landing_bg.png';

export default function SignupScreen() {
  const { login, logout, language } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('teacher');
  const [isZonalPortal, setIsZonalPortal] = useState(false);

  // School Selection
  const [schools, setSchools] = useState<GovernmentSchool[]>([]);
  const [selectedSchoolCode, setSelectedSchoolCode] = useState('10421'); // Default: Mahinda Rajapaksha College

  // Class Selection (Teacher only)
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassRoom, setSelectedClassRoom] = useState('');

  // Principal Verification Details
  const [zonalSecretKey, setZonalSecretKey] = useState('');
  const [sleasNumber, setSleasNumber] = useState('');
  const [nicNumber, setNicNumber] = useState('');

  // Zonal Admin Security Key
  const [zonalAdminKey, setZonalAdminKey] = useState('');

  // Magic Link Dispatch Invitation
  const [isMagicInvite, setIsMagicInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState(''); // email from invite URL
  const [inviteSchoolName, setInviteSchoolName] = useState('');

  // Request Zonal Master Key Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqPrincipalName, setReqPrincipalName] = useState('');
  const [reqPrincipalEmail, setReqPrincipalEmail] = useState('');
  const [reqPrincipalPhone, setReqPrincipalPhone] = useState('');
  const [reqSleasNumber, setReqSleasNumber] = useState('');
  const [reqNicNumber, setReqNicNumber] = useState('');
  const [reqSchoolCode, setReqSchoolCode] = useState('10421');
  const [reqNicFront, setReqNicFront] = useState<string>(''); // base64 compressed
  const [reqNicBack, setReqNicBack] = useState<string>(''); // base64 compressed
  const [nicFrontLoading, setNicFrontLoading] = useState(false);
  const [nicBackLoading, setNicBackLoading] = useState(false);
  const [requestingKey, setRequestingKey] = useState(false);
  const [requestSuccessMsg, setRequestSuccessMsg] = useState('');
  const [modalError, setModalError] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // NIC AI Verification scanning state
  const [nicVerifying, setNicVerifying] = useState(false);
  const [nicVerifyStep, setNicVerifyStep] = useState('');

  // Teacher NIC Verification Photo State
  const [teacherNicFront, setTeacherNicFront] = useState<string>('');
  const [teacherNicBack, setTeacherNicBack] = useState<string>('');
  const [teacherFrontLoading, setTeacherFrontLoading] = useState(false);
  const [teacherBackLoading, setTeacherBackLoading] = useState(false);

  // Teacher 2-Minute Pending Verification Screen State
  const [teacherPendingState, setTeacherPendingState] = useState<{ user: User; unlockAt: number } | null>(null);
  const [remainingSecs, setRemainingSecs] = useState<number>(120);

  useEffect(() => {
    if (!teacherPendingState) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.ceil((teacherPendingState.unlockAt - now) / 1000);
      if (diff <= 0) {
        setRemainingSecs(0);
        clearInterval(interval);
        databaseService.updateUserVerificationStatus(teacherPendingState.user.id, 'verified').then(() => {
          login(teacherPendingState.user.username, teacherPendingState.user.password || '').then(() => {
            navigate('/dashboard');
          }).catch(err => console.error('Auto login failed:', err));
        });
      } else {
        setRemainingSecs(diff);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [teacherPendingState, login, navigate]);

  useEffect(() => {
    const qCensusCode = searchParams.get('censusCode');
    const qKey = searchParams.get('key');
    const qEmail = searchParams.get('email');

    Promise.all([
      databaseService.getZonalSchools(),
      databaseService.getClasses(),
    ]).then(([schoolData, classData]) => {
      setSchools(schoolData);
      const sorted = [...classData].sort((a, b) => a.id.localeCompare(b.id));
      setClasses(sorted);

      if (qCensusCode && qKey) {
        const matchedSchool = schoolData.find(s => s.censusCode === qCensusCode);
        setSelectedSchoolCode(qCensusCode);
        setReqSchoolCode(qCensusCode);
        setZonalSecretKey(qKey.toUpperCase());
        setRole('principal');
        setIsMagicInvite(true);
        if (matchedSchool) setInviteSchoolName(matchedSchool.name);
        if (qEmail) {
          setInviteEmail(qEmail);
          setEmail(qEmail);
          setReqPrincipalEmail(qEmail);
        }
      } else if (schoolData.length > 0) {
        setSelectedSchoolCode(schoolData[0].censusCode);
        setReqSchoolCode(schoolData[0].censusCode);
      }
    }).catch(err => console.error('Failed to load data:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSchool = schools.find(s => s.censusCode === selectedSchoolCode);
  const isPrincipalRegistered = Boolean(selectedSchool?.isRegistered && selectedSchool?.principalId) && !isMagicInvite;

  useEffect(() => {
    if (isPrincipalRegistered && role === 'principal') {
      setRole('teacher');
    }
  }, [isPrincipalRegistered, role]);

  // Compress image to base64 JPEG ≤ 200KB using canvas
  async function compressImage(file: File, maxSizeKB = 200): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          // Scale down if too large
          const MAX_DIM = 1024;
          if (width > MAX_DIM || height > MAX_DIM) {
            const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);
          // Reduce quality until under maxSizeKB
          let quality = 0.85;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          while (dataUrl.length > maxSizeKB * 1024 * 1.37 && quality > 0.2) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = ev.target!.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleNicImage(side: 'front' | 'back', file: File) {
    if (!file.type.startsWith('image/')) {
      setModalError('Please select a valid image file (JPG, PNG).');
      return;
    }
    if (side === 'front') setNicFrontLoading(true);
    else setNicBackLoading(true);
    try {
      const compressed = await compressImage(file);
      if (side === 'front') setReqNicFront(compressed);
      else setReqNicBack(compressed);
    } catch {
      setModalError('Failed to process image. Please try another file.');
    } finally {
      if (side === 'front') setNicFrontLoading(false);
      else setNicBackLoading(false);
    }
  }

  async function handleTeacherNicImage(side: 'front' | 'back', file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG).');
      return;
    }
    if (side === 'front') setTeacherFrontLoading(true);
    else setTeacherBackLoading(true);
    setError('');
    try {
      const compressed = await compressImage(file);
      if (side === 'front') setTeacherNicFront(compressed);
      else setTeacherNicBack(compressed);
    } catch {
      setError('Failed to process image. Please try another file.');
    } finally {
      if (side === 'front') setTeacherFrontLoading(false);
      else setTeacherBackLoading(false);
    }
  }

  async function handleSendKeyRequest(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!reqPrincipalName.trim() || !reqPrincipalEmail.trim() || !reqSchoolCode) {
      setModalError('Please fill in all required key request details.');
      return;
    }
    if (!reqNicFront || !reqNicBack) {
      setModalError('Please upload both front and back photos of your NIC.');
      return;
    }
    setRequestingKey(true);
    setRequestSuccessMsg('');
    setModalError('');
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
        nicFrontImage: reqNicFront,
        nicBackImage: reqNicBack,
      });
      setRequestSuccessMsg(`✅ Request submitted successfully! The Colombo Zonal Education Office and Admin have been notified.`);
    } catch (err: unknown) {
      console.error('Failed to submit key request:', err);
      setModalError(err instanceof Error ? err.message : 'Failed to submit key request. Please check your internet connection.');
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
      if (role === 'teacher') {
        if (!nicNumber.trim()) {
          throw new Error('Official NIC Number is required for Teacher verification.');
        }
        const cleanNic = nicNumber.trim().toUpperCase();

        // Check if NIC format is valid
        const validation = validateSriLankaNic(cleanNic);
        if (!validation.isValid) {
          throw new Error(validation.reason || 'Invalid Sri Lanka NIC format.');
        }

        // Check for duplicate registered NIC in database
        const existingNicUser = await databaseService.getUserByNic(cleanNic);
        if (existingNicUser) {
          throw new Error(`NIC Number (${cleanNic}) is already registered to an existing user account (${existingNicUser.name}).`);
        }

        if (!teacherNicFront || !teacherNicBack) {
          throw new Error('Please upload both Front and Back photos of your NIC for verification.');
        }

        // --- AI-Powered NIC Image Verification ---
        setNicVerifying(true);
        setNicVerifyStep('🔍 Scanning NIC images with AI...');
        let nicResult;
        try {
          nicResult = await verifyNicImages(cleanNic, teacherNicFront, teacherNicBack);
        } catch (verifyErr) {
          throw verifyErr; // re-throw — already has a user-friendly message
        } finally {
          setNicVerifying(false);
          setNicVerifyStep('');
        }

        if (!nicResult.isValidNic) {
          throw new Error(
            `❌ NIC Verification Failed: The uploaded images do not appear to be a valid Sri Lanka National Identity Card. ${nicResult.reason ? `Reason: ${nicResult.reason}` : 'Please upload clear photos of your NIC front and back.'}`
          );
        }
        
        if (!nicResult.nicNumberMatch) {
          const extracted = nicResult.extractedNicNumber
            ? ` (Card shows: ${nicResult.extractedNicNumber})`
            : '';
          throw new Error(
            `❌ NIC Number Mismatch: The NIC number you entered (${cleanNic}) does not match the number on the card${extracted}. Please re-enter your NIC number correctly or upload the correct NIC photos.`
          );
        }
        // Verification passed ✅
      } else if (role === 'principal') {
        if (!zonalSecretKey.trim()) {
          throw new Error('Zonal Master Security Key is required for Principal registration.');
        }
        if (!sleasNumber.trim() || !nicNumber.trim()) {
          throw new Error('Official SLEAS / Service ID and NIC Number are required.');
        }

        // Verify Zonal Key against Database
        // If this is a magic invite link, skip the isRegistered check (allow re-registration for same school)
        const ver = await databaseService.verifyZonalPrincipalKey(selectedSchoolCode, zonalSecretKey.trim(), isMagicInvite);
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
      const unlockTime = Date.now() + 120000; // 2 minutes delay

      const newUser: User = {
        id: crypto.randomUUID(),
        username: username.trim(),
        password,
        name: name.trim(),
        role,
        schoolCensusCode: role === 'zonal_admin' ? 'ZONAL-MOE' : selectedSchoolCode,
        schoolName: role === 'zonal_admin' ? 'Colombo Zonal Education Office' : (selectedSchool?.name || 'Mahinda Rajapaksha College'),
        ...(email.trim() || inviteEmail ? { email: email.trim() || inviteEmail } : {}),
        ...(nicNumber.trim() ? { nicNumber: nicNumber.trim().toUpperCase() } : {}),
        ...(sleasNumber.trim() ? { sleasNumber: sleasNumber.trim() } : {}),
        ...(role === 'teacher' ? {
          nicFrontImage: teacherNicFront,
          nicBackImage: teacherNicBack,
          nicVerificationStatus: 'pending',
          verificationUnlockAt: unlockTime,
          registeredAt: new Date().toISOString(),
          ...(selectedClassRoom ? { classRoom: selectedClassRoom } : {}),
        } : {}),
      };

      await databaseService.createUser(newUser);

      // 4. Post-registration role setup
      if (role === 'teacher') {
        await databaseService.createTeacherProfile(newUser);
        logout();
        setTeacherPendingState({
          user: newUser,
          unlockAt: unlockTime,
        });
        setRemainingSecs(120);
        return;
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

  if (teacherPendingState) {
    const mins = Math.floor(remainingSecs / 60);
    const secs = remainingSecs % 60;
    const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const progressPercent = Math.min(100, Math.max(0, ((120 - remainingSecs) / 120) * 100));

    return (
      <div className="auth-page">
        <div className="auth-left">
          <div className="auth-left-bg" style={{ backgroundImage: `url(${landingBg})` }} />
          <div className="auth-left-overlay" />
          <div className="auth-left-content">
            <div className="auth-logo">
              <GraduationCap size={40} color="#fff" />
            </div>
            <div className="auth-app-name">EduNexus</div>
            <p className="auth-tagline">{t('appFullName', language)}</p>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-form-container" style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', marginBottom: '16px' }}>
              <ShieldCheck size={48} />
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-color)' }}>
              Teacher NIC Verification Active
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
              Welcome, <strong>{teacherPendingState.user.name}</strong>! Your NIC photos (Front & Back) have been verified against your NIC Number (<code>{teacherPendingState.user.nicNumber}</code>).
            </p>

            <div style={{ background: 'linear-gradient(135deg, rgba(2,132,199,0.1) 0%, rgba(124,58,237,0.08) 100%)', border: '1.5px solid rgba(2, 132, 199, 0.3)', borderRadius: '14px', padding: '24px 20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, color: '#0284c7', marginBottom: '8px' }}>
                2-Minute Security Verification Delay
              </div>

              <div style={{ fontSize: '42px', fontWeight: 900, fontFamily: 'monospace', color: remainingSecs > 0 ? '#0284c7' : '#10b981', marginBottom: '8px' }}>
                {remainingSecs > 0 ? formattedTime : '00:00 ✅'}
              </div>

              <div style={{ background: 'rgba(255,255,255,0.2)', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7, #10b981)', transition: 'width 1s linear' }} />
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {remainingSecs > 0 ? (
                  <>
                    ⏱️ Login will be <strong>automatically enabled in {remainingSecs} seconds</strong>. You will be redirected to your dashboard once the 2-minute timer reaches 00:00.
                  </>
                ) : (
                  <span style={{ color: '#10b981', fontWeight: 700 }}>
                    🎉 2-Minute Verification Complete! Logging you in now...
                  </span>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', fontSize: '12px' }}>
              <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text-color)' }}>Verification Status:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', marginBottom: '4px' }}>
                <CheckCircle size={14} /> Registered Teacher: <strong>{teacherPendingState.user.name}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', marginBottom: '4px' }}>
                <CheckCircle size={14} /> NIC Number Verified: <strong>{teacherPendingState.user.nicNumber}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
                <CheckCircle size={14} /> NIC Front & Back Document Photos Verified
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => navigate('/login')}
              >
                Go to Login Screen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
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
          <div className="auth-app-name">EduNexus</div>
          <p className="auth-tagline">{t('appFullName', language)}</p>
          <div className="auth-features" style={{ marginTop: '20px' }}>
            <div className="auth-feature">
              <Building2 size={16} color="#38bdf8" />
              <span>Colombo District Zone Portal</span>
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
            <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.13) 0%, rgba(2,132,199,0.09) 100%)', border: '2px solid rgba(124, 58, 237, 0.4)', color: '#7c3aed', padding: '14px 16px', borderRadius: '10px', marginBottom: '18px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <ShieldCheck size={24} style={{ flexShrink: 0 }} />
                <div style={{ fontWeight: 800, fontSize: '14px' }}>✅ Official Zonal Invitation Link Detected</div>
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9, lineHeight: 1.5 }}>
                <div>🏛️ School: <strong>{inviteSchoolName || selectedSchoolCode}</strong></div>
                <div>🔑 Key: <code style={{ background: 'rgba(124,58,237,0.12)', padding: '1px 5px', borderRadius: '4px' }}>{zonalSecretKey}</code> <span style={{ color: '#10b981', fontWeight: 700 }}>AUTO-VERIFIED</span></div>
                {inviteEmail && <div>📧 Dispatched to: <strong>{inviteEmail}</strong></div>}
                <div style={{ marginTop: '6px', fontWeight: 600 }}>Fill in your Name, Username and Password below to activate your Principal account.</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* School Selection (For Teacher and Principal) */}
            {!isZonalPortal && (
              <div className="form-group">
                <label className="form-label">Select Government School (Colombo District)</label>
                <select
                  className="form-control"
                  value={selectedSchoolCode}
                  onChange={e => {
                    const newCode = e.target.value;
                    setSelectedSchoolCode(newCode);
                    const sch = schools.find(s => s.censusCode === newCode);
                    if (sch?.isRegistered && sch?.principalId && !isMagicInvite && role === 'principal') {
                      setRole('teacher');
                    }
                  }}
                >
                  {schools.map(sch => (
                    <option key={sch.censusCode} value={sch.censusCode}>
                      {sch.name} ({sch.zone} Zone - Census: {sch.censusCode}){sch.isRegistered && sch.principalId ? ' 🔒 [Principal Registered]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* School Role Selection (Teacher, Principal) */}
            {!isZonalPortal && (
              <div className="form-group">
                <label className="form-label">Account Role</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn ${role === 'teacher' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '13px', padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', borderRadius: '8px' }}
                    onClick={() => { setRole('teacher'); setError(''); }}
                  >
                    <span style={{ fontSize: '20px' }}>👩‍🏫</span>
                    <span style={{ fontWeight: 600 }}>Teacher</span>
                  </button>
                  <button
                    type="button"
                    className={`btn ${role === 'principal' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      fontSize: '13px',
                      padding: '12px 8px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      borderRadius: '8px',
                      opacity: isPrincipalRegistered ? 0.55 : 1,
                      cursor: isPrincipalRegistered ? 'not-allowed' : 'pointer',
                    }}
                    disabled={isPrincipalRegistered}
                    onClick={() => { if (!isPrincipalRegistered) { setRole('principal'); setError(''); } }}
                    title={isPrincipalRegistered ? `A Principal is already registered for ${selectedSchool?.name}` : undefined}
                  >
                    <span style={{ fontSize: '20px' }}>🏫</span>
                    <span style={{ fontWeight: 600 }}>Principal {isPrincipalRegistered ? '🔒' : ''}</span>
                  </button>
                </div>
                {isPrincipalRegistered && role === 'principal' && (
                  <div style={{
                    fontSize: '11px',
                    color: '#e11d48',
                    background: 'rgba(225, 29, 72, 0.08)',
                    border: '1px solid rgba(225, 29, 72, 0.25)',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    marginTop: '8px',
                    fontWeight: 600,
                    lineHeight: 1.4
                  }}>
                    🔒 <strong>Principal Registered:</strong> {selectedSchool?.principalName || 'Verified Principal'} has already registered for {selectedSchool?.name}.
                  </div>
                )}
              </div>
            )}

            {/* Teacher Specific Identity & NIC Verification */}
            {!isZonalPortal && role === 'teacher' && (
              <div style={{ background: 'rgba(2, 132, 199, 0.06)', border: '1px solid rgba(2, 132, 199, 0.25)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <ShieldCheck size={16} /> Teacher NIC Identity Verification
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>National Identity Card (NIC) Number</label>
                  <input
                    className="form-control"
                    placeholder="e.g. 852345678V or 199012345678"
                    value={nicNumber}
                    onChange={e => setNicNumber(e.target.value.toUpperCase())}
                    required
                  />
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '3px' }}>Format: 9 digits + V/X (old format) or 12 digits (new format)</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>NIC Front Photo</label>
                    <label
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '10px', border: '1.5px dashed rgba(2,132,199,0.4)', borderRadius: '8px',
                        background: teacherNicFront ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.05)',
                        cursor: 'pointer', textAlign: 'center', minHeight: '85px'
                      }}
                    >
                      {teacherFrontLoading ? (
                        <span className="spinner" />
                      ) : teacherNicFront ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                          <img src={teacherNicFront} alt="NIC Front" style={{ height: '48px', objectFit: 'cover', borderRadius: '4px', marginBottom: '4px' }} />
                          <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>✓ Front Image Uploaded</span>
                        </div>
                      ) : (
                        <>
                          <UserCheck size={20} color="#0284c7" />
                          <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, marginTop: '4px' }}>Upload Front Photo</span>
                          <span style={{ fontSize: '9px', color: '#94a3b8' }}>JPG, PNG (max 5MB)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => e.target.files?.[0] && handleTeacherNicImage('front', e.target.files[0])}
                      />
                    </label>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>NIC Back Photo</label>
                    <label
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '10px', border: '1.5px dashed rgba(2,132,199,0.4)', borderRadius: '8px',
                        background: teacherNicBack ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.05)',
                        cursor: 'pointer', textAlign: 'center', minHeight: '85px'
                      }}
                    >
                      {teacherBackLoading ? (
                        <span className="spinner" />
                      ) : teacherNicBack ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                          <img src={teacherNicBack} alt="NIC Back" style={{ height: '48px', objectFit: 'cover', borderRadius: '4px', marginBottom: '4px' }} />
                          <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>✓ Back Image Uploaded</span>
                        </div>
                      ) : (
                        <>
                          <UserCheck size={20} color="#0284c7" />
                          <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, marginTop: '4px' }}>Upload Back Photo</span>
                          <span style={{ fontSize: '9px', color: '#94a3b8' }}>JPG, PNG (max 5MB)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => e.target.files?.[0] && handleTeacherNicImage('back', e.target.files[0])}
                      />
                    </label>
                  </div>
                </div>

                {/* Homeroom Class Selection */}
                <div className="form-group" style={{ marginTop: '12px', marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Homeroom Class <span style={{ color: '#6b7280', fontWeight: 400 }}>(optional)</span></label>
                  <select
                    className="form-control"
                    value={selectedClassRoom}
                    onChange={e => setSelectedClassRoom(e.target.value)}
                    style={{ fontSize: '13px' }}
                  >
                    <option value="">— Not assigned yet —</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        Class {cls.id} — Grade {cls.grade}{cls.stream === 'al' ? ' (A/L)' : ' (O/L)'}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '3px' }}>Select the class you will be a homeroom teacher for.</div>
                </div>

                <div style={{ fontSize: '10.5px', color: '#0284c7', background: 'rgba(2,132,199,0.08)', padding: '6px 8px', borderRadius: '6px', lineHeight: 1.35 }}>
                  💡 <strong>Automated Verification:</strong> Provide your NIC number and Front & Back photos. Upon validation, a 2-minute security period activates before login is enabled.
                </div>
              </div>
            )}

            {/* Principal Specific Security Verification */}
            {!isZonalPortal && role === 'principal' && (
              <div style={{ background: isMagicInvite ? 'rgba(16,185,129,0.06)' : 'rgba(2, 132, 199, 0.08)', border: `1px solid ${isMagicInvite ? 'rgba(16,185,129,0.35)' : 'rgba(2, 132, 199, 0.3)'}`, borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: isMagicInvite ? '#10b981' : '#0284c7', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <ShieldCheck size={16} /> {isMagicInvite ? '✅ Zonal Key — Pre-verified from Invite Link' : 'Principal Zonal Identity Verification'}
                </div>
                <div className="form-group" style={{ marginBottom: '6px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Zonal Master Security Key {isMagicInvite && <span style={{ color: '#10b981', fontWeight: 700 }}>(Auto-Filled — Do Not Edit)</span>}</label>
                  <input
                    className="form-control"
                    placeholder="e.g. HMG-MRC-8942"
                    value={zonalSecretKey}
                    onChange={e => !isMagicInvite && setZonalSecretKey(e.target.value)}
                    readOnly={isMagicInvite}
                    style={isMagicInvite ? { background: 'rgba(16,185,129,0.08)', color: '#059669', fontWeight: 700, cursor: 'not-allowed' } : {}}
                    required
                  />
                </div>

                {!isMagicInvite && (
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
                )}

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
              <label className="form-label">Email Address {role === 'principal' && <span style={{ color: '#6b7280', fontSize: '11px' }}>(Official Contact)</span>}</label>
              <input
                id="signup-email"
                className="form-control"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
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

            {/* NIC AI Scanning Progress */}
            {nicVerifying && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'linear-gradient(135deg, rgba(2,132,199,0.12), rgba(124,58,237,0.08))',
                border: '1.5px solid rgba(2,132,199,0.35)',
                borderRadius: '10px', padding: '12px 16px', marginTop: '8px',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}>
                <ScanLine size={20} color="#0284c7" style={{ flexShrink: 0, animation: 'spin 2s linear infinite' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0284c7' }}>AI NIC Verification in Progress</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{nicVerifyStep}</div>
                </div>
              </div>
            )}

            <button
              id="signup-submit"
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '8px', background: isMagicInvite ? 'linear-gradient(135deg, #7c3aed, #0284c7)' : undefined }}
              disabled={loading || nicVerifying}
            >
              {(loading || nicVerifying) ? <span className="spinner" /> : null}
              {nicVerifying ? 'Verifying NIC...' : isZonalPortal ? 'Register Zonal Officer' : role === 'principal' ? (isMagicInvite ? '🔑 Activate Principal Account' : 'Verify & Register Principal') : 'Register Teacher'}
            </button>
          </form>




          <div className="auth-link-row" style={{ marginTop: '16px' }}>
            {t('haveAccount', language)}{' '}
            <Link to="/login" className="auth-link">{t('login', language)}</Link>
          </div>
        </div>
      </div>

      {/* Request Zonal Key Standalone Modal */}
      {showRequestModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '16px' }}>
          <div style={{ background: 'var(--bg-card, #ffffff)', width: '100%', maxWidth: '460px', borderRadius: '14px', padding: '24px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.35)', color: 'var(--text-main, #1e293b)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <Key size={20} /> Request Zonal Master Key from Admin
              </h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRequestModal(false)}>
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px', lineHeight: 1.4 }}>
                {modalError}
              </div>
            )}

            {requestSuccessMsg ? (
              <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '16px', borderRadius: '10px', fontSize: '13px', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>Request Sent to Zonal Admin!</div>
                {requestSuccessMsg}
                <div style={{ marginTop: '16px' }}>
                  <button type="button" className="btn btn-primary btn-sm" style={{ width: '100%', background: '#7c3aed', borderColor: '#7c3aed' }} onClick={() => setShowRequestModal(false)}>
                    Close & Return to Registration
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendKeyRequest}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>
                  Submit your appointment details directly to the <strong> Colombo Zonal Education Office</strong>. The Admin will verify and dispatch your key.
                </p>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Principal Full Official Name *</label>
                  <input
                    className="form-control"
                    placeholder="e.g. Dr. A. P. Perera"
                    value={reqPrincipalName}
                    onChange={e => setReqPrincipalName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Official Email Address (To Receive Key) *</label>
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
                  <label className="form-label" style={{ fontSize: '11px' }}>Mobile Phone Number (For SMS Alert) *</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="e.g. 0771234567"
                    value={reqPrincipalPhone}
                    onChange={e => setReqPrincipalPhone(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>SLEAS / Service ID *</label>
                    <input
                      className="form-control"
                      placeholder="e.g. SLEAS-982"
                      value={reqSleasNumber}
                      onChange={e => setReqSleasNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>NIC Number *</label>
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
                  <label className="form-label" style={{ fontSize: '11px' }}>Select Target School *</label>
                  <select
                    className="form-control"
                    value={reqSchoolCode}
                    onChange={e => setReqSchoolCode(e.target.value)}
                    required
                  >
                    {schools.map(s => (
                      <option key={s.censusCode} value={s.censusCode}>
                        {s.name} ({s.zone} Zone - {s.censusCode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* NIC Image Upload */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontSize: '11px', marginBottom: '8px', display: 'block' }}>
                    🪪 NIC Verification Photos * <span style={{ color: '#6b7280', fontWeight: 400 }}>(Front &amp; Back — Required)</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {/* NIC Front */}
                    <div>
                      <div
                        style={{
                          border: `2px dashed ${reqNicFront ? '#10b981' : '#7c3aed'}`,
                          borderRadius: '8px',
                          padding: '10px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          background: reqNicFront ? 'rgba(16,185,129,0.06)' : 'rgba(124,58,237,0.04)',
                          position: 'relative',
                          transition: 'all 0.2s',
                          minHeight: '90px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onClick={() => document.getElementById('nic-front-input')?.click()}
                      >
                        {nicFrontLoading ? (
                          <span className="spinner spinner-sm" />
                        ) : reqNicFront ? (
                          <>
                            <img src={reqNicFront} alt="NIC Front" style={{ width: '100%', maxHeight: '70px', objectFit: 'cover', borderRadius: '4px', marginBottom: '4px' }} />
                            <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700 }}>✅ Front Uploaded</span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '22px', marginBottom: '4px' }}>📷</span>
                            <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 600 }}>NIC Front Side</span>
                            <span style={{ fontSize: '9px', color: '#9ca3af' }}>Tap to upload</span>
                          </>
                        )}
                        <input
                          id="nic-front-input"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          style={{ display: 'none' }}
                          onChange={e => e.target.files?.[0] && handleNicImage('front', e.target.files[0])}
                        />
                      </div>
                    </div>

                    {/* NIC Back */}
                    <div>
                      <div
                        style={{
                          border: `2px dashed ${reqNicBack ? '#10b981' : '#7c3aed'}`,
                          borderRadius: '8px',
                          padding: '10px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          background: reqNicBack ? 'rgba(16,185,129,0.06)' : 'rgba(124,58,237,0.04)',
                          position: 'relative',
                          transition: 'all 0.2s',
                          minHeight: '90px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onClick={() => document.getElementById('nic-back-input')?.click()}
                      >
                        {nicBackLoading ? (
                          <span className="spinner spinner-sm" />
                        ) : reqNicBack ? (
                          <>
                            <img src={reqNicBack} alt="NIC Back" style={{ width: '100%', maxHeight: '70px', objectFit: 'cover', borderRadius: '4px', marginBottom: '4px' }} />
                            <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700 }}>✅ Back Uploaded</span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '22px', marginBottom: '4px' }}>📷</span>
                            <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 600 }}>NIC Back Side</span>
                            <span style={{ fontSize: '9px', color: '#9ca3af' }}>Tap to upload</span>
                          </>
                        )}
                        <input
                          id="nic-back-input"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          style={{ display: 'none' }}
                          onChange={e => e.target.files?.[0] && handleNicImage('back', e.target.files[0])}
                        />
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: '9px', color: '#9ca3af', margin: '5px 0 0', textAlign: 'center' }}>
                    Images are compressed and securely stored for admin verification only.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1, background: '#7c3aed', borderColor: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} disabled={requestingKey}>
                    {requestingKey ? <span className="spinner spinner-sm" /> : <><Send size={14} /> Send Request to Admin</>}
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
    </div>
  );
}
