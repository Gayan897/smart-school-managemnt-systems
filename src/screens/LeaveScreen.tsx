import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, X, Sparkles, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { LeaveRequest, LeaveType, LeaveStatus } from '../data/models';

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
    startDate: '',
    endDate: '',
    reason: '',
    lessonPlanNotes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const reqs = await databaseService.getLeaveRequests();
    setLeaveRequests(reqs);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.startDate || !form.endDate || !form.reason.trim()) return;
    setSubmitting(true);
    const req: LeaveRequest = {
      id: crypto.randomUUID(),
      teacherId: user?.id ?? '',
      teacherName: user?.name ?? '',
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason.trim(),
      lessonPlanNotes: form.lessonPlanNotes.trim() || null,
      status: 'pending',
      principalComment: null,
      submittedAt: new Date().toISOString(),
    };
    await databaseService.insertLeaveRequest(req);
    await load();
    setShowModal(false);
    setForm({ type: 'casual', startDate: '', endDate: '', reason: '', lessonPlanNotes: '' });
    setSubmitting(false);
  }

  async function handleDecision(req: LeaveRequest, status: LeaveStatus) {
    await databaseService.updateLeaveRequest({
      ...req,
      status,
      principalComment: comment || null,
    });
    setCommentTarget(null);
    setComment('');
    if (status === 'approved') {
      setLastApprovedLeave(req);
    }
    await load();
  }

  const myRequests = leaveRequests.filter(r => r.teacherId === user?.id);
  const displayedRequests = (user?.role === 'principal' && activeTab === 'all')
    ? leaveRequests
    : myRequests;

  const statusBadge: Record<LeaveStatus, string> = {
    pending: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
  };

  // Leave balance (teacher)
  const casualUsed = myRequests.filter(r => r.type === 'casual' && r.status === 'approved').length;
  const medicalUsed = myRequests.filter(r => r.type === 'medical' && r.status === 'approved').length;
  const annualUsed = myRequests.filter(r => r.type === 'annual' && r.status === 'approved').length;

  const CASUAL_MAX = 7, MEDICAL_MAX = 14, ANNUAL_MAX = 21;

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

      {/* Leave balance */}
      {user?.role === 'teacher' && (
        <div className="leave-balance-grid" style={{ marginBottom: '20px' }}>
          {[
            { label: t('casualLeave', language), used: casualUsed, max: CASUAL_MAX, color: '#0284c7' },
            { label: t('medicalLeave', language), used: medicalUsed, max: MEDICAL_MAX, color: '#0d9488' },
            { label: t('annualLeave', language), used: annualUsed, max: ANNUAL_MAX, color: '#10b981' },
          ].map(b => (
            <div key={b.label} className="leave-balance-card">
              <div className="leave-balance-value" style={{ color: b.color }}>
                {b.max - b.used}
              </div>
              <div className="leave-balance-label">{b.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {b.used}/{b.max} {t('days', language)}
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

      {/* Approved Leave Quick Proxy Trigger */}
      {user?.role === 'principal' && lastApprovedLeave && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)',
          border: '1px solid #6366f1',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#818cf8', fontSize: '15px' }}>
              <Sparkles size={18} />
              Leave Approved: {lastApprovedLeave.teacherName} ({lastApprovedLeave.startDate} to {lastApprovedLeave.endDate})
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Would you like the AI Smart Engine to find and assign substitute teachers for these dates?
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setLastApprovedLeave(null)}
            >
              Dismiss
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/substitutes')}
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                border: 'none',
              }}
            >
              <Sparkles size={14} />
              {t('generateSubstitutesForLeave', language)}
            </button>
          </div>
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
                  <th>{t('startDate', language)}</th>
                  <th>{t('endDate', language)}</th>
                  <th>{t('reason', language)} & Notes</th>
                  <th>Status</th>
                  {user?.role === 'principal' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayedRequests.map(req => (
                  <>
                    <tr key={req.id}>
                      {user?.role === 'principal' && <td>{req.teacherName}</td>}
                      <td>
                        <span className="badge badge-primary">{t(req.type, language)}</span>
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
                    {commentTarget === req.id && (
                      <tr key={`${req.id}-comment`}>
                        <td colSpan={7} style={{ background: 'var(--bg-hover)', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                              className="form-control"
                              placeholder={t('comment', language)}
                              value={comment}
                              onChange={e => setComment(e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <button className="btn btn-success btn-sm" onClick={() => handleDecision(req, 'approved')}>
                              <Check size={13} /> Confirm
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setCommentTarget(null)}>
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{t('applyLeave', language)}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('leaveType', language)}</label>
                <select
                  id="leave-type"
                  className="form-control"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as LeaveType }))}
                >
                  <option value="casual">{t('casual', language)}</option>
                  <option value="medical">{t('medical', language)}</option>
                  <option value="annual">{t('annual', language)}</option>
                  <option value="duty">{t('duty', language)}</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">{t('startDate', language)}</label>
                  <input
                    id="leave-start"
                    type="date"
                    className="form-control"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('endDate', language)}</label>
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
              </div>
              <div className="form-group">
                <label className="form-label">{t('reason', language)}</label>
                <textarea
                  id="leave-reason"
                  className="form-control"
                  rows={2}
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Enter reason..."
                  required
                />
              </div>
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
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                  These instructions will be automatically forwarded to the smart substitute teacher assigned to your classes.
                </span>
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
