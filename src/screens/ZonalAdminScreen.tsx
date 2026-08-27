import { useState, useEffect } from 'react';
import { Building2, ShieldCheck, Key, Activity, Send, CheckCircle2, AlertTriangle, RefreshCw, Search, Mail, Copy, Check, ExternalLink, Smartphone, Share2, MessageSquare, Bell, Clock, UserCheck, ThumbsUp, Trash2 } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { useAuth } from '../contexts/AuthContext';
import { databaseService } from '../data/database';
import type { GovernmentSchool, Notice, ZonalKeyRequest } from '../data/models';
import '../components/AppShell.css';

export default function ZonalAdminScreen() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<GovernmentSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<GovernmentSchool | null>(null);
  const [newKey, setNewKey] = useState('');
  const [updatingKey, setUpdatingKey] = useState(false);
  const [keySuccess, setKeySuccess] = useState('');

  // Key Requests state
  const [keyRequests, setKeyRequests] = useState<ZonalKeyRequest[]>([]);

  // Key Dispatch state
  const [dispatchSchool, setDispatchSchool] = useState<GovernmentSchool | null>(null);
  const [dispatchEmail, setDispatchEmail] = useState('');
  const [dispatchPhone, setDispatchPhone] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{ inviteUrl: string; dispatchedAt: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState('');

  // Notice broadcast form state
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeCategory, setNoticeCategory] = useState('Zonal Circular');
  const [noticeTarget, setNoticeTarget] = useState<'all' | 'principal'>('principal');
  const [broadcasting, setBroadcasting] = useState(false);
  const [noticeSuccess, setNoticeSuccess] = useState('');

  const [recentNotices, setRecentNotices] = useState<Notice[]>([]);

  useEffect(() => {
    loadSchools();

    // 1. Real-time listener for key requests
    const unsubKeyRequests = databaseService.subscribeToZonalKeyRequests(
      (reqs) => {
        setKeyRequests(reqs);
      },
      (err) => console.error('[ZonalAdmin] Key requests subscription error:', err)
    );

    // 2. Real-time listener for notices
    const unsubNotices = databaseService.subscribeToNotices(
      (notices) => {
        setRecentNotices(notices.filter(n => n.authorRole === 'zonal_admin' || n.category === 'Zonal Request'));
      },
      (err) => console.error('[ZonalAdmin] Notices subscription error:', err)
    );

    // Also reload when admin tab is re-focused
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        loadSchools();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubKeyRequests();
      unsubNotices();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  async function handleDeleteKeyRequest(id: string) {
    await databaseService.deleteZonalKeyRequest(id);
    setKeyRequests(prev => prev.filter(r => r.id !== id));
  }

  async function handleDeleteNotice(id: string) {
    await databaseService.deleteNotice(id);
    setRecentNotices(prev => prev.filter(n => n.id !== id));
  }

  async function loadSchools() {
    setLoading(true);
    try {
      const [data, allNotices, allRequests] = await Promise.all([
        databaseService.getZonalSchools(),
        databaseService.getNotices(),
        databaseService.getZonalKeyRequests(),
      ]);
      setSchools(data);
      setRecentNotices(allNotices.filter(n => n.authorRole === 'zonal_admin' || n.category === 'Zonal Request'));
      setKeyRequests(allRequests);
    } catch (err) {
      console.error('Failed to load zonal schools:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveKeyRequest(req: ZonalKeyRequest) {
    const sch = schools.find(s => s.censusCode === req.censusCode);
    if (!sch) return;

    setDispatchSchool(sch);
    setSelectedSchool(null);
    setDispatchEmail(req.principalEmail);
    setDispatchPhone(req.principalPhone);
    setDispatchResult(null);
    setCopiedLink(false);

    await databaseService.updateZonalKeyRequestStatus(req.id, 'approved');
    const updatedReqs = await databaseService.getZonalKeyRequests();
    setKeyRequests(updatedReqs);
  }

  async function handleUpdateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSchool || !newKey.trim()) return;
    setUpdatingKey(true);
    setKeySuccess('');
    try {
      await databaseService.updateSchoolZonalKey(selectedSchool.censusCode, newKey.trim());
      setKeySuccess(`Successfully updated Zonal Key for ${selectedSchool.name}`);
      setNewKey('');
      setSelectedSchool(null);
      await loadSchools();
    } catch (err) {
      console.error('Failed to update key:', err);
    } finally {
      setUpdatingKey(false);
    }
  }

  async function handleDispatchKey(e: React.FormEvent) {
    e.preventDefault();
    if (!dispatchSchool || !dispatchEmail.trim()) return;
    setDispatching(true);
    setKeySuccess('');
    setEmailStatusMsg('');
    try {
      const res = await databaseService.dispatchZonalKey(
        dispatchSchool.censusCode,
        dispatchEmail.trim(),
        dispatchPhone.trim()
      );
      setDispatchResult({ inviteUrl: res.inviteUrl, dispatchedAt: res.dispatchedAt });
      setKeySuccess(`✅ Key Dispatch registered! Launching real email client for ${dispatchEmail.trim()}...`);

      // Auto-trigger native email dispatch to send real email to user's inbox
      triggerNativeEmail(dispatchSchool, dispatchEmail.trim(), res.inviteUrl);
      setEmailStatusMsg(`📬 Opened system email composer (Outlook / Gmail) addressed to ${dispatchEmail.trim()}!`);

      await loadSchools();
    } catch (err) {
      console.error('Failed to dispatch key:', err);
    } finally {
      setDispatching(false);
    }
  }

  function triggerNativeEmail(school: GovernmentSchool, email: string, inviteUrl: string) {
    const subject = `🏛️ [OFFICIAL DISPATCH] SAMS Portal Authorization Key - ${school.name}`;
    const body = `Dear Principal,\n\nOfficial Authorization Details for SAMS (School Attendance & Management System):\n\nSchool: ${school.name}\nCensus Code: ${school.censusCode}\nZonal Master Security Key: ${school.zonalSecretKey}\n\nPlease click the official registration link below to activate your Principal account:\n${inviteUrl}\n\nRegards,\nHomagama / Colombo Zonal Education Office\nMinistry of Education, Sri Lanka`;

    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function triggerNativeSMS(school: GovernmentSchool, phone: string, inviteUrl: string) {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const smsBody = `MOE SAMS: Official Registration Key for ${school.name} [${school.censusCode}] is ${school.zonalSecretKey}. Register at: ${inviteUrl}`;

    window.open(`sms:${encodeURIComponent(cleanPhone)}?body=${encodeURIComponent(smsBody)}`, '_blank');
  }

  async function triggerWebShare(school: GovernmentSchool, inviteUrl: string) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `SAMS Security Key - ${school.name}`,
          text: `MOE SAMS Authorization: Zonal Key for ${school.name} is ${school.zonalSecretKey}. Register using this link:`,
          url: inviteUrl,
        });
      } catch (e) {
        console.log('Share canceled or failed:', e);
      }
    } else {
      copyInviteLink(inviteUrl);
    }
  }

  function copyInviteLink(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  }

  async function handleBroadcastDirective(e: React.FormEvent) {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeBody.trim()) return;
    setBroadcasting(true);
    setNoticeSuccess('');
    try {
      const notice: Notice = {
        id: `zonal_notice_${Date.now()}`,
        title: `🏛️ [ZONAL DIRECTIVE] ${noticeTitle.trim()}`,
        body: noticeBody.trim(),
        date: new Date().toISOString(),
        category: noticeCategory,
        targetRole: noticeTarget,
        authorName: user?.name || 'Zonal Education Office (Homagama/Colombo)',
        authorRole: 'zonal_admin',
        priority: 'urgent',
      };
      await databaseService.createNotice(notice);
      setNoticeSuccess('Directive broadcasted successfully to all target school portals!');
      setNoticeTitle('');
      setNoticeBody('');
      await loadSchools();
    } catch (err) {
      console.error('Failed to broadcast directive:', err);
    } finally {
      setBroadcasting(false);
    }
  }

  const filteredSchools = schools.filter(
    s => s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.censusCode.includes(search) ||
      s.zone.toLowerCase().includes(search.toLowerCase())
  );

  const verifiedCount = schools.filter(s => s.isRegistered).length;

  return (
    <div className="page">
      {/* Header Banner */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building2 color="#0284c7" size={28} />
            Zonal Education Office Command Center
          </h1>
          <p className="page-subtitle">
            Ministry of Education • Colombo District & Homagama Educational Zone Overview
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadSchools} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh Registry
        </button>
      </div>

      {/* KPI Stats */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(2, 132, 199, 0.15)' }}>
            <Building2 size={22} color="#0284c7" />
          </div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#0284c7' }}>{schools.length}</div>
            <div className="stat-label">Registered Zonal Schools</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
            <ShieldCheck size={22} color="#10b981" />
          </div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#10b981' }}>{verifiedCount} / {schools.length}</div>
            <div className="stat-label">Verified School Principals</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(124, 58, 237, 0.15)' }}>
            <Key size={22} color="#7c3aed" />
          </div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#7c3aed' }}>Active</div>
            <div className="stat-label">Zonal Master Security Keys</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
            <Activity size={22} color="#f59e0b" />
          </div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#f59e0b' }}>94.2%</div>
            <div className="stat-label">Zonal Attendance Avg</div>
          </div>
        </div>
      </div>

      {/* Pending Zonal Key Requests Alert Card */}
      {keyRequests.filter(r => r.status === 'pending').length > 0 && (
        <div className="card" style={{ border: '2px solid #7c3aed', background: 'rgba(124, 58, 237, 0.04)', marginBottom: '24px', boxShadow: '0 4px 20px rgba(124, 58, 237, 0.12)' }}>
          <div className="card-header" style={{ background: 'rgba(124, 58, 237, 0.08)', borderBottom: '1px solid rgba(124, 58, 237, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="card-title" style={{ color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
              <Bell size={18} />
              Pending Principal Zonal Key Requests ({keyRequests.filter(r => r.status === 'pending').length})
            </h2>
            <span className="badge" style={{ background: '#7c3aed', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
              Action Required
            </span>
          </div>

          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
            {keyRequests.filter(r => r.status === 'pending').map(req => (
              <div key={req.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-color)' }}>
                      {req.principalName}
                    </div>
                    <span className="badge" style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      <Clock size={10} style={{ marginRight: 2 }} /> {req.requestedAt.split(',')[0]}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', marginBottom: '8px' }}>
                    🏛️ {req.schoolName} <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>({req.censusCode})</span>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
                    <div>📧 Email: <strong style={{ color: 'var(--text-color)' }}>{req.principalEmail}</strong></div>
                    <div>📱 Mobile: <strong style={{ color: 'var(--text-color)' }}>{req.principalPhone}</strong></div>
                    <div>🪪 SLEAS ID: <code>{req.sleasNumber}</code> • NIC: <code>{req.nicNumber}</code></div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, background: '#7c3aed', borderColor: '#7c3aed', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    onClick={() => handleApproveKeyRequest(req)}
                  >
                    <ThumbsUp size={13} /> Approve & Auto-Dispatch Key
                  </button>
                  <button
                    className="btn btn-sm"
                    title="Dismiss this request"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                    onClick={() => handleDeleteKeyRequest(req.id)}
                  >
                    <Trash2 size={12} /> Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Left Column: School Registry Table */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#0284c7" />
              Government Schools Security & Master Keys Registry
            </h2>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                className="form-control"
                style={{ paddingLeft: '30px', fontSize: '12px', height: '34px' }}
                placeholder="Search school or census code..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {keySuccess && (
            <div style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              {keySuccess}
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              <span className="spinner spinner-lg" />
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Census Code</th>
                    <th>School Name</th>
                    <th>Zone / Division</th>
                    <th>Verified Principal</th>
                    <th>Zonal Secret Key</th>
                    <th>Dispatch Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchools.map(sch => (
                    <tr key={sch.censusCode}>
                      <td>
                        <span className="badge badge-primary" style={{ fontFamily: 'monospace' }}>
                          {sch.censusCode}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{sch.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sch.district} District</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px' }}>{sch.zone} Zone</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sch.division}</div>
                      </td>
                      <td>
                        {sch.isRegistered && sch.principalName ? (
                          <span style={{ color: '#10b981', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} />
                            {sch.principalName}
                          </span>
                        ) : (
                          <span style={{ color: '#f59e0b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={14} />
                            Unregistered
                          </span>
                        )}
                      </td>
                      <td>
                        <code style={{ background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, color: '#7c3aed' }}>
                          {sch.zonalSecretKey}
                        </code>
                      </td>
                      <td>
                        {sch.dispatchStatus === 'dispatched' ? (
                          <span className="badge" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '3px 8px', borderRadius: '12px', fontWeight: 600 }}>
                            <Send size={11} /> Dispatched ({sch.dispatchedAt ? sch.dispatchedAt.split(',')[0] : 'Sent'})
                          </span>
                        ) : (
                          <span className="badge" style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '3px 8px', borderRadius: '12px' }}>
                            Pending Dispatch
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#7c3aed', fontWeight: 600 }}
                            onClick={() => {
                              setDispatchSchool(sch);
                              setSelectedSchool(null);
                              setDispatchEmail(sch.principalEmail || '');
                              setDispatchPhone(sch.principalPhone || '');
                              setDispatchResult(null);
                              setCopiedLink(false);
                            }}
                            title="Auto-Dispatch Security Key & Magic Link to Principal"
                          >
                            <Send size={14} /> Auto-Dispatch
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#0284c7' }}
                            onClick={() => {
                              setSelectedSchool(sch);
                              setDispatchSchool(null);
                              setNewKey(sch.zonalSecretKey);
                            }}
                          >
                            <Key size={14} /> Reset
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Key Management Modal/Form & Broadcast Directives */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Automated Key Dispatch Form */}
          {dispatchSchool && (
            <div className="card" style={{ border: '2px solid #7c3aed', boxShadow: '0 4px 20px rgba(124, 58, 237, 0.15)' }}>
              <div className="card-header" style={{ background: 'rgba(124, 58, 237, 0.05)', borderBottom: '1px solid rgba(124, 58, 237, 0.15)' }}>
                <h3 className="card-title" style={{ fontSize: '15px', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Send size={16} /> Automated Key Dispatch for {dispatchSchool.name}
                </h3>
              </div>
              <form onSubmit={handleDispatchKey} style={{ padding: '16px' }}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">School Census Code & Key</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="form-control" value={dispatchSchool.censusCode} disabled readOnly style={{ flex: 1, fontFamily: 'monospace' }} />
                    <code style={{ padding: '8px 12px', background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', borderRadius: '6px', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                      {dispatchSchool.zonalSecretKey}
                    </code>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={14} color="#0284c7" /> Principal Official Email Address
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    value={dispatchEmail}
                    onChange={e => setDispatchEmail(e.target.value)}
                    placeholder="e.g. principal@school.moe.gov.lk"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Smartphone size={14} color="#10b981" /> Principal Mobile Number (Gov SMS Gateway)
                  </label>
                  <input
                    type="tel"
                    className="form-control"
                    value={dispatchPhone}
                    onChange={e => setDispatchPhone(e.target.value)}
                    placeholder="e.g. +94 77 123 4567"
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: dispatchResult ? '16px' : '0' }}>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1, background: '#7c3aed', borderColor: '#7c3aed' }} disabled={dispatching}>
                    {dispatching ? <span className="spinner" /> : <><Send size={14} /> Send Email & SMS Dispatch</>}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDispatchSchool(null)}>
                    Cancel
                  </button>
                </div>

                {/* Dispatch Results & Real Delivery Triggers */}
                {dispatchResult && (
                  <div style={{ marginTop: '16px', padding: '14px', background: 'var(--bg-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <CheckCircle2 size={16} /> Key Dispatched on {dispatchResult.dispatchedAt}
                    </div>

                    {emailStatusMsg && (
                      <div style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', padding: '8px 10px', borderRadius: '6px', fontSize: '11px', marginBottom: '10px' }}>
                        {emailStatusMsg}
                      </div>
                    )}

                    <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Generated Magic Invitation URL:</label>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', marginBottom: '12px' }}>
                      <input className="form-control form-control-sm" value={dispatchResult.inviteUrl} readOnly style={{ fontSize: '11px', fontFamily: 'monospace' }} />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => copyInviteLink(dispatchResult.inviteUrl)}
                        title="Copy Invitation Link"
                      >
                        {copiedLink ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      </button>
                      <a
                        href={dispatchResult.inviteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#0284c7' }}
                        title="Test Magic Registration Link in New Tab"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>

                    {/* Direct Launch Actions for Real Email & SMS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Real Dispatch Triggers:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#0284c7', borderColor: '#0284c7' }}
                          onClick={() => triggerNativeEmail(dispatchSchool, dispatchEmail, dispatchResult.inviteUrl)}
                        >
                          <Mail size={12} /> Launch Email App
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', borderColor: '#10b981' }}
                          onClick={() => triggerNativeSMS(dispatchSchool, dispatchPhone || '+94771234567', dispatchResult.inviteUrl)}
                        >
                          <Smartphone size={12} /> Send Phone SMS
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#7c3aed', marginTop: '4px' }}
                        onClick={() => triggerWebShare(dispatchSchool, dispatchResult.inviteUrl)}
                      >
                        <Share2 size={12} /> Share via WhatsApp / Messaging / Apps
                      </button>
                    </div>

                    <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(2, 132, 199, 0.08)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-color)' }}>
                      <strong>📬 Official MoE Email Template Payload:</strong>
                      <div style={{ color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                        To: <code>{dispatchEmail}</code><br />
                        Subject: 🏛️ [OFFICIAL DISPATCH] SAMS Security Key - {dispatchSchool.name}<br />
                        Notice: Key is <strong>{dispatchSchool.zonalSecretKey}</strong>. Click magic link to activate Principal account.
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}
          {/* Reset Key Form */}
          {selectedSchool && (
            <div className="card" style={{ border: '2px solid #0284c7' }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '15px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={16} /> Update Security Key for {selectedSchool.name}
                </h3>
              </div>
              <form onSubmit={handleUpdateKey}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">School Census Code</label>
                  <input className="form-control" value={selectedSchool.censusCode} disabled readOnly />
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">New Zonal Verification Key</label>
                  <input
                    className="form-control"
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    placeholder="e.g. HMG-MRC-9999"
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={updatingKey}>
                    {updatingKey ? <span className="spinner" /> : 'Save New Key'}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedSchool(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Broadcast Zonal Directives */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={18} color="#0284c7" />
                Broadcast Zonal Circular / Directive
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Send official Ministry notifications directly to School Principals across the Homagama / Colombo zone.
            </p>

            {noticeSuccess && (
              <div style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '12px' }}>
                {noticeSuccess}
              </div>
            )}

            <form onSubmit={handleBroadcastDirective}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Directive Title</label>
                <input
                  className="form-control"
                  value={noticeTitle}
                  onChange={e => setNoticeTitle(e.target.value)}
                  placeholder="e.g., Zonal Term Evaluation Guidelines 2026"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Category & Target Role</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="form-control"
                    value={noticeCategory}
                    onChange={e => setNoticeCategory(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="Zonal Circular">Zonal Circular</option>
                    <option value="Administrative Directive">Administrative Directive</option>
                    <option value="Academic Notice">Academic Notice</option>
                    <option value="Urgent Safety Notice">Urgent Safety Notice</option>
                  </select>
                  <select
                    className="form-control"
                    value={noticeTarget}
                    onChange={e => setNoticeTarget(e.target.value as any)}
                    style={{ flex: 1 }}
                  >
                    <option value="principal">Principals Only</option>
                    <option value="all">All School Portals</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Directive Content</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={noticeBody}
                  onChange={e => setNoticeBody(e.target.value)}
                  placeholder="Enter full zonal directive details..."
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={broadcasting}>
                {broadcasting ? <span className="spinner" /> : null}
                Broadcast to Zonal Portals
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Zonal Directives & Audit Trail Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="#7c3aed" />
            Official Zonal Directives & Audit Log
          </h2>
        </div>
        {recentNotices.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
            No zonal directives broadcasted yet. Use the form above to send an official circular.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Directive Title</th>
                  <th>Category</th>
                  <th>Target Audience</th>
                  <th>Issued Date</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentNotices.map(n => (
                  <tr key={n.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{n.title}</td>
                    <td><span className="badge badge-secondary">{n.category}</span></td>
                    <td>
                      <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                        {n.targetRole === 'all' ? 'All Portals' : n.targetRole}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(n.date).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        title="Delete this notification"
                        onClick={() => handleDeleteNotice(n.id)}
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
