import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, X, Sparkles, BookOpen, Clock, Calendar, CheckCircle, Building2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import { calculateLeaveDays, type LeaveRequest, type LeaveType, type LeaveStatus } from '../data/models';

export default function LeaveScreen() {
  const { user, language } = useAuth();
  const navigate = useNavigate();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [comment, setComment] = useState('');
  const [commentTarget, setCommentTarget] = useState<string | null>(null);
  const [lastApprovedLeave, setLastApprovedLeave] = useState<LeaveRequest | null>(null);

  // Form state
  const [form, setForm] = useState({
    type: 'casual' as LeaveType,
    isHalfDay: false,
    halfDaySession: 'morning' as 'morning' | 'afternoon',
    startDate: '',
    endDate: '',
    reason: '',
    lessonPlanNotes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const isZonalAdmin = user?.role === 'zonal_admin';
  const isPrincipal = user?.role === 'principal';
  const isTeacher = user?.role === 'teacher';

  const userSchoolCode = isZonalAdmin ? undefined : user?.schoolCensusCode;

  async function load() {
    const reqs = await databaseService.getLeaveRequests(userSchoolCode);
    setLeaveRequests(reqs);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.startDate || (!form.isHalfDay && !form.endDate) || !form.reason.trim()) return;
    setSubmitting(true);

    const endDateToSave = form.isHalfDay ? form.startDate : form.endDate;

    const req: LeaveRequest = {
      id: crypto.randomUUID(),
      teacherId: user?.id ?? '',
      teacherName: user?.name ?? '',
      applicantRole: user?.role || 'teacher',
      type: form.type,
      isHalfDay: form.isHalfDay,
      halfDaySession: form.isHalfDay ? form.halfDaySession : undefined,
      startDate: form.startDate,
      endDate: endDateToSave,
      reason: form.reason.trim(),
      lessonPlanNotes: form.lessonPlanNotes.trim() || null,
      status: 'pending',
      principalComment: null,
      submittedAt: new Date().toISOString(),
      schoolCensusCode: user?.schoolCensusCode,
      schoolName: user?.schoolName || '',
    };
    await databaseService.insertLeaveRequest(req);
    await load();
    setShowModal(false);
    setForm({ type: 'casual', isHalfDay: false, halfDaySession: 'morning', startDate: '', endDate: '', reason: '', lessonPlanNotes: '' });
    setSubmitting(false);
  }

  async function handleDecision(req: LeaveRequest, status: LeaveStatus, decisionComment?: string) {
    const finalComment = decisionComment !== undefined ? decisionComment : comment;
    const updated = await databaseService.updateLeaveRequest({
      ...req,
      status,
      principalComment: !isZonalAdmin ? (finalComment || null) : req.principalComment,
      adminComment: isZonalAdmin ? (finalComment || null) : req.adminComment,
      reviewedByRole: isZonalAdmin ? 'zonal_admin' : 'principal',
    });
    setCommentTarget(null);
    setComment('');
    if (status === 'approved') {
      setLastApprovedLeave(updated);
    }
    await load();
  }

  const currentSchoolCode = user?.schoolCensusCode;
  const myRequests = leaveRequests.filter(r => r.teacherId === user?.id);

  let displayedRequests: LeaveRequest[] = myRequests;
  if (isPrincipal) {
    displayedRequests = activeTab === 'all'
      ? leaveRequests.filter(r => r.schoolCensusCode === currentSchoolCode && r.teacherId !== user?.id)
      : myRequests;
  } else if (isZonalAdmin) {
    // Admin views all Principal leave requests across schools
    displayedRequests = leaveRequests.filter(r => r.applicantRole === 'principal');
  }

  const statusBadge: Record<LeaveStatus, string> = {
    pending: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
  };

  // Accurate Leave balance calculation
  const calculateUsedDays = (typeKey: string) => {
    return myRequests
      .filter(r => r.status === 'approved' && r.type.toString().replace(/^half_/, '') === typeKey)
      .reduce((sum, r) => sum + calculateLeaveDays(r.startDate, r.endDate, r.type, r.isHalfDay), 0);
  };

  const casualUsed = calculateUsedDays('casual');
  const medicalUsed = calculateUsedDays('medical');
  const annualUsed = calculateUsedDays('annual');

  const CASUAL_MAX = 7, MEDICAL_MAX = 14, ANNUAL_MAX = 21;
  const casualRemaining = user?.casualBalance !== undefined ? user.casualBalance : Math.max(0, CASUAL_MAX - casualUsed);
  const medicalRemaining = user?.medicalBalance !== undefined ? user.medicalBalance : Math.max(0, MEDICAL_MAX - medicalUsed);
  const annualRemaining = user?.annualBalance !== undefined ? user.annualBalance : Math.max(0, ANNUAL_MAX - annualUsed);

  // Selected leave type remaining balance for modal
  const selectedTypeBase = form.type.toString().replace(/^half_/, '');
  const selectedTypeRemaining =
    selectedTypeBase === 'casual' ? casualRemaining :
    selectedTypeBase === 'medical' ? medicalRemaining : annualRemaining;

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">
            {isZonalAdmin ? '🏛️ Zonal Leave Administration' : t('leave', language)}
          </h1>
          <p className="page-subtitle">
            {isZonalAdmin
              ? 'Review and decide on School Principal leave applications across the zone'
              : isPrincipal
              ? 'Principal Leave Applications & Teacher Leave Approvals'
              : 'Official Leave Management Portal'}
          </p>
        </div>

        {!isZonalAdmin && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            {isPrincipal ? 'Apply for Principal Leave' : t('applyLeave', language)}
          </button>
        )}
      </div>

      {/* Banner when leave is approved */}
      {lastApprovedLeave && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1.5px solid #10b981',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          color: '#10b981',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 14px rgba(16,185,129,0.12)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '15px' }}>
              <CheckCircle size={18} /> ✅ Leave Approved for {lastApprovedLeave.teacherName}!
            </div>
            <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.95 }}>
              Updated Remaining Balances &rarr; Casual: <strong>{lastApprovedLeave.remainingCasualAfterApproval ?? casualRemaining}</strong> days | Medical: <strong>{lastApprovedLeave.remainingMedicalAfterApproval ?? medicalRemaining}</strong> days | Annual: <strong>{lastApprovedLeave.remainingAnnualAfterApproval ?? annualRemaining}</strong> days
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setLastApprovedLeave(null)} style={{ color: '#10b981', padding: '4px' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Remaining Leave Balance Cards (Shown for Teachers & Principals) */}
      {(isTeacher || isPrincipal) && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isPrincipal ? '👔 Principal Leave Quota & Remaining Balances' : '👨‍🏫 Teacher Leave Quota & Remaining Balances'}
            </div>
            {isPrincipal && (
              <span className="badge" style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', border: '1px solid rgba(124, 58, 237, 0.3)', fontSize: '11px', fontWeight: 600 }}>
                Approving Authority: Zonal Education Office (Admin)
              </span>
            )}
          </div>
          <div className="leave-balance-grid">
            {[
              { label: t('casualLeave', language), remaining: casualRemaining, used: casualUsed, max: CASUAL_MAX, color: '#0284c7' },
              { label: t('medicalLeave', language), remaining: medicalRemaining, used: medicalUsed, max: MEDICAL_MAX, color: '#0d9488' },
              { label: t('annualLeave', language), remaining: annualRemaining, used: annualUsed, max: ANNUAL_MAX, color: '#10b981' },
            ].map(b => (
              <div key={b.label} className="leave-balance-card">
                <div className="leave-balance-value" style={{ color: b.color }}>
                  {b.remaining}
                </div>
                <div className="leave-balance-label">{b.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Used: {b.used}/{b.max} {t('days', language)} • Remaining: <strong>{b.remaining}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs for principal */}
      {isPrincipal && (
        <div className="tabs" style={{ marginBottom: '20px' }}>
          <button className={`tab ${activeTab === 'my' ? 'active' : ''}`} onClick={() => setActiveTab('my')}>
            👔 My Leave &amp; Balances ({myRequests.length})
          </button>
          <button className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            👨‍🏫 Staff Requests for Approval ({leaveRequests.filter(r => r.schoolCensusCode === currentSchoolCode && r.teacherId !== user?.id && r.status === 'pending').length} Pending)
          </button>
        </div>
      )}

      {/* Tabs for Zonal Admin */}
      {isZonalAdmin && (
        <div className="tabs" style={{ marginBottom: '20px' }}>
          <button className="tab active">
            🏛️ Principal Leave Applications ({leaveRequests.filter(r => r.applicantRole === 'principal' && r.status === 'pending').length} Pending Review)
          </button>
        </div>
      )}

      {/* Requests table */}
      <div className="card">
        {displayedRequests.length === 0 ? (
          <div className="empty-state">
            <p>
              {isZonalAdmin
                ? 'No principal leave requests submitted yet.'
                : isPrincipal && activeTab === 'all'
                ? 'No teacher leave requests pending approval in your school.'
                : t('noLeaveRequests', language)}
            </p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  {((isPrincipal && activeTab === 'all') || isZonalAdmin) && <th>Applicant</th>}
                  {isZonalAdmin && <th>School</th>}
                  <th>{t('leaveType', language)}</th>
                  <th>Duration</th>
                  <th>{t('startDate', language)}</th>
                  <th>{t('endDate', language)}</th>
                  <th>{t('reason', language)} &amp; Notes</th>
                  <th>Status &amp; Approval</th>
                  {((isPrincipal && activeTab === 'all') || isZonalAdmin) && <th style={{ textAlign: 'center' }}>Decision Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayedRequests.map(req => {
                  const reqDays = calculateLeaveDays(req.startDate, req.endDate, req.type, req.isHalfDay);
                  const isPrincipalApplicant = req.applicantRole === 'principal';

                  return (
                    <tr key={req.id}>
                      {((isPrincipal && activeTab === 'all') || isZonalAdmin) && (
                        <td>
                          <div style={{ fontWeight: 600 }}>{req.teacherName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {isPrincipalApplicant ? '👔 School Principal' : '👨‍🏫 Teacher'}
                          </div>
                        </td>
                      )}
                      {isZonalAdmin && (
                        <td style={{ fontSize: '12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{req.schoolName || 'School'}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Census: {req.schoolCensusCode || '—'}</div>
                        </td>
                      )}
                      <td>
                        <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {req.isHalfDay || req.type.toString().startsWith('half') ? <Clock size={12} /> : <Calendar size={12} />}
                          {t(req.type, language)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: req.isHalfDay ? '#818cf8' : 'var(--text-main)' }}>
                          {reqDays} {reqDays === 0.5 ? 'Day (Half Day)' : 'Days'}
                          {req.halfDaySession ? ` (${req.halfDaySession.toUpperCase()})` : ''}
                        </span>
                      </td>
                      <td>{req.startDate}</td>
                      <td>{req.endDate}</td>
                      <td style={{ maxWidth: '240px', fontSize: '12px' }}>
                        <div style={{ color: 'var(--text-main)' }}>{req.reason}</div>
                        {req.lessonPlanNotes && (
                          <div style={{
                            fontSize: '11px',
                            color: '#818cf8',
                            marginTop: '4px',
                            background: 'rgba(99, 102, 241, 0.08)',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}>
                            <BookOpen size={11} /> <em>"{req.lessonPlanNotes}"</em>
                          </div>
                        )}
                      </td>
                      <td>
                        {isPrincipalApplicant ? (
                          <>
                            <span className={`badge ${req.status === 'approved' ? 'badge-success' : req.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {req.status === 'approved' ? <CheckCircle size={12} /> : req.status === 'rejected' ? <X size={12} /> : <Clock size={12} />}
                              {req.status === 'approved' ? 'Approved by Admin' : req.status === 'rejected' ? 'Rejected by Admin' : 'Pending Admin Approval'}
                            </span>
                            {req.adminComment && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                <em>Admin: "{req.adminComment}"</em>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <span className={`badge ${statusBadge[req.status]}`}>
                              {t(req.status, language)}
                            </span>
                            {req.principalComment && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                <em>Principal: "{req.principalComment}"</em>
                              </div>
                            )}
                          </>
                        )}
                        {req.status === 'approved' && req.remainingCasualAfterApproval !== undefined && (
                          <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
                            Remaining: Casual {req.remainingCasualAfterApproval}d | Med {req.remainingMedicalAfterApproval}d | Ann {req.remainingAnnualAfterApproval}d
                          </div>
                        )}
                      </td>

                      {/* Decision Actions column */}
                      {((isPrincipal && activeTab === 'all' && req.teacherId !== user?.id) || (isZonalAdmin && isPrincipalApplicant)) && (
                        <td style={{ textAlign: 'center' }}>
                          {req.status === 'pending' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                              {commentTarget === req.id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '200px' }}>
                                  <input
                                    type="text"
                                    className="form-control"
                                    placeholder={isZonalAdmin ? 'Zonal admin remark...' : 'Principal comment...'}
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    style={{ fontSize: '11px', padding: '4px 8px' }}
                                    autoFocus
                                  />
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                    <button
                                      className="btn btn-success btn-sm"
                                      style={{ padding: '3px 8px', fontSize: '11px' }}
                                      onClick={() => handleDecision(req, 'approved', comment)}
                                    >
                                      Confirm Approve
                                    </button>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: '3px 8px', fontSize: '11px' }}
                                      onClick={() => { setCommentTarget(null); setComment(''); }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    className="btn btn-success btn-sm"
                                    title="Approve Leave"
                                    onClick={() => {
                                      setCommentTarget(req.id);
                                      setComment('');
                                    }}
                                  >
                                    <Check size={13} /> Approve
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    title="Reject Leave"
                                    onClick={() => handleDecision(req, 'rejected')}
                                  >
                                    <X size={13} /> Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Completed</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal card" style={{ maxWidth: '520px', width: '92%' }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} color="var(--primary)" />
              {isPrincipal ? 'Apply for Principal Leave' : t('applyLeave', language)}
            </h2>

            {/* Principal notice about Zonal Admin approval */}
            {isPrincipal && (
              <div style={{
                background: 'rgba(124, 58, 237, 0.08)',
                border: '1px solid rgba(124, 58, 237, 0.25)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#7c3aed',
                fontWeight: 500,
              }}>
                <ShieldCheck size={16} />
                <span>As School Principal, your leave request will be routed directly to the <strong>Zonal Education Office (Admin)</strong> for review and approval.</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Duration Type Segmented Picker */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Leave Duration *</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn ${!form.isHalfDay ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => setForm(f => ({ ...f, isHalfDay: false }))}
                  >
                    <Calendar size={14} /> Full Day Leave
                  </button>
                  <button
                    type="button"
                    className={`btn ${form.isHalfDay ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => setForm(f => ({ ...f, isHalfDay: true, endDate: f.startDate }))}
                  >
                    <Clock size={14} /> Half Day Leave (0.5 Day)
                  </button>
                </div>
              </div>

              {/* Leave Category Selector */}
              <div className="form-group">
                <label className="form-label">{t('leaveType', language)} *</label>
                <select
                  id="leave-type"
                  className="form-control"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as LeaveType }))}
                >
                  <option value="casual">{t('casual', language)} (Casual Leave)</option>
                  <option value="medical">{t('medical', language)} (Medical Leave)</option>
                  <option value="annual">{t('annual', language)} (Annual Leave)</option>
                  <option value="duty">{t('duty', language)} (Official Duty Leave)</option>
                  <option value="half_casual">Half Day - Casual (0.5 Day)</option>
                  <option value="half_medical">Half Day - Medical (0.5 Day)</option>
                  <option value="half_annual">Half Day - Annual (0.5 Day)</option>
                </select>
              </div>

              {/* Remaining balance badge */}
              <div style={{
                background: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Your Available Balance for <strong>{form.type.toUpperCase()}</strong>:
                </span>
                <span className={`badge ${selectedTypeRemaining > 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontWeight: 700, fontSize: '12px' }}>
                  {selectedTypeRemaining} Days Remaining
                </span>
              </div>

              {/* Half Day Session Picker if Half Day is selected */}
              {form.isHalfDay && (
                <div className="form-group" style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                  <label className="form-label" style={{ fontSize: '12px', color: '#6366f1' }}>Half Day Session *</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${form.halfDaySession === 'morning' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setForm(f => ({ ...f, halfDaySession: 'morning' }))}
                    >
                      🌅 Morning (8:00 AM - 12:00 PM)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${form.halfDaySession === 'afternoon' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setForm(f => ({ ...f, halfDaySession: 'afternoon' }))}
                    >
                      🌇 Afternoon (12:00 PM - 3:30 PM)
                    </button>
                  </div>
                </div>
              )}

              {/* Date Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: form.isHalfDay ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">{form.isHalfDay ? 'Leave Date *' : `${t('startDate', language)} *`}</label>
                  <input
                    id="leave-start"
                    type="date"
                    className="form-control"
                    value={form.startDate}
                    onChange={e => setForm(f => ({
                      ...f,
                      startDate: e.target.value,
                      endDate: f.isHalfDay ? e.target.value : f.endDate
                    }))}
                    required
                  />
                </div>

                {!form.isHalfDay && (
                  <div className="form-group">
                    <label className="form-label">{t('endDate', language)} *</label>
                    <input
                      id="leave-end"
                      type="date"
                      className="form-control"
                      value={form.endDate}
                      min={form.startDate}
                      onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className="form-group">
                <label className="form-label">{t('reason', language)} *</label>
                <textarea
                  id="leave-reason"
                  className="form-control"
                  rows={2}
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder={isPrincipal ? "Reason for principal leave application..." : "Reason for leave application..."}
                  required
                />
              </div>

              {/* Handover / Study Material Notes */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="#6366f1" />
                  {isPrincipal ? 'Acting Principal / Handover Instructions (Optional)' : `${t('lessonPlanNotes', language)} (Optional)`}
                </label>
                <textarea
                  id="leave-notes"
                  className="form-control"
                  rows={2}
                  value={form.lessonPlanNotes}
                  onChange={e => setForm(f => ({ ...f, lessonPlanNotes: e.target.value }))}
                  placeholder={isPrincipal ? "Instructions for Deputy Principal / Acting Principal..." : t('lessonPlanNotesPlaceholder', language)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('cancel', language)}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <span className="spinner" /> : null}
                  {isPrincipal ? 'Submit to Zonal Admin' : t('submitLeave', language)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
