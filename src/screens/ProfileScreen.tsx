import { useState } from 'react';
import {
  User as UserIcon, Mail, ShieldCheck, Key, BookOpen,
  GraduationCap, Building2, Calendar, CheckCircle, Save,
  Lock, Eye, EyeOff, FileText, Award, Smartphone
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { User } from '../data/models';

export default function ProfileScreen() {
  const { user, language, updateUserSession } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState(user?.classRoom ? 'Information Technology' : 'General');
  const [classRoom, setClassRoom] = useState(user?.classRoom || '10A');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showNicPreview, setShowNicPreview] = useState<'front' | 'back' | null>(null);

  if (!user) return null;

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setProfileMsg({ type: 'error', text: 'Full Name cannot be empty.' });
      return;
    }
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      if (!user) return;
      const updated = await databaseService.updateUserProfile(user.id, {
        name: name.trim(),
        email: email.trim(),
        classRoom: classRoom.trim(),
        subject: subject.trim(),
      });
      updateUserSession(updated);
      setProfileMsg({ type: 'success', text: '✅ Profile details updated successfully!' });
    } catch (err: unknown) {
      setProfileMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword) {
      setPasswordMsg({ type: 'error', text: 'Please enter a new password.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      if (!user) return;
      const updated = await databaseService.updateUserProfile(user.id, {
        password: newPassword,
      });
      updateUserSession(updated);
      setPasswordMsg({ type: 'success', text: '✅ Password changed successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to change password.' });
    } finally {
      setSavingPassword(false);
    }
  }

  const roleTitle =
    user.role === 'zonal_admin' ? 'Zonal Master Administrator' :
    user.role === 'principal' ? 'School Principal' : 'Government School Teacher';

  return (
    <div className="page" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Profile Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(13, 148, 136, 0.15) 100%)',
          border: '1.5px solid var(--primary)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary) 0%, #0d9488 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '32px',
              fontWeight: 800,
              boxShadow: '0 8px 24px rgba(2, 132, 199, 0.3)',
              border: '3px solid #fff',
            }}
          >
            {user.name?.[0]?.toUpperCase() ?? 'U'}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: 'var(--text-color)' }}>
                {user.name}
              </h1>
              <span
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  letterSpacing: '0.3px',
                }}
              >
                {roleTitle}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Building2 size={15} color="var(--primary)" />
                {user.schoolName || 'Government School'}
                {user.schoolCensusCode ? ` (Census: ${user.schoolCensusCode})` : ''}
              </span>
              {user.nicNumber && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Award size={15} color="#0d9488" />
                  NIC: <code>{user.nicNumber}</code>
                </span>
              )}
              {user.nicVerificationStatus === 'verified' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#10b981',
                    fontWeight: 700,
                    fontSize: '12px',
                  }}
                >
                  <CheckCircle size={14} /> NIC Verified
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Edit Personal Details */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserIcon size={20} color="var(--primary)" />
            Edit Profile Details
          </h2>

          {profileMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
                background: profileMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(225, 29, 72, 0.1)',
                border: `1px solid ${profileMsg.type === 'success' ? '#10b981' : '#e11d48'}`,
                color: profileMsg.type === 'success' ? '#10b981' : '#e11d48',
              }}
            >
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <div className="input-wrapper">
                <input
                  className="form-control"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter full name"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <input
                  className="form-control"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="teacher@school.moe.gov.lk"
                />
                <Mail size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            {user.role === 'teacher' && (
              <>
                <div className="form-group">
                  <label className="form-label">Teaching Subject</label>
                  <input
                    className="form-control"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. Mathematics, Science, IT"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Homeroom Class</label>
                  <input
                    className="form-control"
                    value={classRoom}
                    onChange={e => setClassRoom(e.target.value)}
                    placeholder="e.g. 10A"
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Username (Permanent Account ID)</label>
              <input className="form-control" value={user.username} readOnly disabled style={{ opacity: 0.75 }} />
            </div>

            <div className="form-group">
              <label className="form-label">NIC Number (Verified Document ID)</label>
              <input className="form-control" value={user.nicNumber || 'N/A'} readOnly disabled style={{ opacity: 0.75 }} />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              disabled={savingProfile}
            >
              {savingProfile ? <span className="spinner spinner-sm" /> : <><Save size={16} /> Save Profile Changes</>}
            </button>
          </form>
        </div>

        {/* Right Column: Security & Identity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Change Password Card */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={20} color="#0284c7" />
              Security & Password
            </h2>

            {passwordMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '16px',
                  background: passwordMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(225, 29, 72, 0.1)',
                  border: `1px solid ${passwordMsg.type === 'success' ? '#10b981' : '#e11d48'}`,
                  color: passwordMsg.type === 'success' ? '#10b981' : '#e11d48',
                }}
              >
                {passwordMsg.text}
              </div>
            )}

            <form onSubmit={handleSavePassword}>
              <div className="form-group">
                <label className="form-label">New Password *</label>
                <div className="input-wrapper">
                  <input
                    className="form-control"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    style={{ paddingRight: '38px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    style={{
                      position: 'absolute', right: '10px', top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input
                  className="form-control"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-secondary"
                style={{ width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                disabled={savingPassword}
              >
                {savingPassword ? <span className="spinner spinner-sm" /> : <><Key size={16} /> Update Password</>}
              </button>
            </form>
          </div>

          {/* NIC Photo Upload Verification Card */}
          {user.role === 'teacher' && (user.nicFrontImage || user.nicBackImage) && (
            <div className="card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="#10b981" />
                Uploaded Verification Photos
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Official Sri Lanka National Identity Card photos uploaded during account registration.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {user.nicFrontImage && (
                  <div
                    onClick={() => setShowNicPreview('front')}
                    style={{
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <img src={user.nicFrontImage} alt="NIC Front" style={{ width: '100%', height: '90px', objectFit: 'cover' }} />
                    <div style={{ fontSize: '11px', textAlign: 'center', padding: '4px', background: 'var(--bg-hover)', fontWeight: 600 }}>
                      🪪 NIC Front
                    </div>
                  </div>
                )}
                {user.nicBackImage && (
                  <div
                    onClick={() => setShowNicPreview('back')}
                    style={{
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <img src={user.nicBackImage} alt="NIC Back" style={{ width: '100%', height: '90px', objectFit: 'cover' }} />
                    <div style={{ fontSize: '11px', textAlign: 'center', padding: '4px', background: 'var(--bg-hover)', fontWeight: 600 }}>
                      🪪 NIC Back
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NIC Modal Preview Zoom */}
      {showNicPreview && (
        <div
          className="modal-overlay"
          onClick={() => setShowNicPreview(null)}
          style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(6px)', zIndex: 2000 }}
        >
          <div className="modal-content card" style={{ maxWidth: '600px', width: '92%', padding: '16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {showNicPreview === 'front' ? '🪪 NIC Front Photo' : '🪪 NIC Back Photo'}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNicPreview(null)}>Close</button>
            </div>
            <img
              src={showNicPreview === 'front' ? user.nicFrontImage : user.nicBackImage}
              alt="NIC Zoom"
              style={{ width: '100%', borderRadius: '8px', objectFit: 'contain', maxHeight: '400px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
