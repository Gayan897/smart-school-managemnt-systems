import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, X, Sparkles, BookOpen, Clock, Calendar, CheckCircle } from 'lucide-react';
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

  const userSchoolCode = user?.role === 'zonal_admin' ? undefined : user?.schoolCensusCode;

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

  async function handleDecision(req: LeaveRequest, status: LeaveStatus) {
    const updated = await databaseService.updateLeaveRequest({
      ...req,
      status,
      principalComment: comment || null,
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
  const displayedRequests = (user?.role === 'principal' && activeTab === 'all')
    ? leaveRequests.filter(r => r.schoolCensusCode === currentSchoolCode)
    : myRequests;

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
  const casualRemaining = Math.max(0, CASUAL_MAX - casualUsed);
  const medicalRemaining = Math.max(0, MEDICAL_MAX - medicalUsed);
  const annualRemaining = Math.max(0, ANNUAL_MAX - annualUsed);

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('leave', language)}</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          {t('applyLeave', language)}
        </button>
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

      {/* Remaining Leave Balance Cards */}
      {user?.role === 'teacher' && (
        <div className="leave-balance-grid" style={{ marginBottom: '20px' }}>
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
      )}

      {/* Tabs for principal */}
      {user?.role === 'principal' && (
        <div className="tabs">
          <button className={`tab ${activeTab === 'my' ? 'active' : ''}`} onClick={() => setActiveTab('my')}>
            {t('myLeaveBalance', language)}
          </button>
          <button className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            {t('pendingRequests', language)} ({leaveRequests.filter(r => r.status === 'pending').length})
          </button>
        </div>
      )}

      {/* Requests table */}
      <div className="card">
        {displayedRequests.length === 0 ? (
          <div className="empty-state">
            <p>{t('noLeaveRequests', language)}</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  {user?.role === 'principal' && <th>Teacher</th>}
                  <th>{t('leaveType', language)}</th>
                  <th>Duration</th>
                  <th>{t('startDate', language)}</th>
                  <th>{t('endDate', language)}</th>
                  <th>{t('reason', language)} & Notes</th>
                  <th>Status & Balances</th>
                  {user?.role === 'principal' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayedRequests.map(req => {
                  const reqDays = calculateLeaveDays(req.startDate, req.endDate, req.type, req.isHalfDay);
                  return (
                    <tr key={req.id}>
                      {user?.role === 'principal' && (
                        <td>
                          <strong>{req.teacherName}</strong>
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
                        <span className={`badge ${statusBadge[req.status]}`}>
                          {t(req.status, language)}
                        </span>
                        {req.status === 'approved' && req.remainingCasualAfterApproval !== undefined && (
                          <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
                            Remaining: Casual {req.remainingCasualAfterApproval}d | Med {req.remainingMedicalAfterApproval}d | Ann {req.remainingAnnualAfterApproval}d
                          </div>
                        )}
                      </td>
                      {user?.role === 'principal' && req.status === 'pending' && (
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => {
                                if (commentTarget === req.id) {
                                  handleDecision(req, 'approved');
                                } else {
                                  setCommentTarget(req.id);
                                  setComment('');
                                }
                              }}
                            >
                              <Check size={13} />
                              {t('approve', language)}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDecision(req, 'rejected')}
                            >
                              <X size={13} />
                              {t('reject', language)}
                            </button>
                          </div>
                        </td>
                      )}
                      {user?.role === 'principal' && req.status !== 'pending' && <td />}
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
              {t('applyLeave', language)}
            </h2>

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
                  placeholder="Reason for leave application..."
                  required
                />
              </div>

              {/* Lesson Plan Notes */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="#6366f1" />
                  {t('lessonPlanNotes', language)} (Optional)
                </label>
                <textarea
                  id="leave-notes"
                  className="form-control"
                  rows={2}
                  value={form.lessonPlanNotes}
                  onChange={e => setForm(f => ({ ...f, lessonPlanNotes: e.target.value }))}
                  placeholder={t('lessonPlanNotesPlaceholder', language)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('cancel', language)}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <span className="spinner" /> : null}
                  {t('submitLeave', language)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

