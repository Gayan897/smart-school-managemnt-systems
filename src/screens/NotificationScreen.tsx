import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, Plus, Search, AlertTriangle, Shield,
  Trash2, User, Tag, Sparkles, X, Clock, FileText, ArrowRight, Megaphone
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import { isNoticeRelevantToUser, deduplicateNotices, type Notice, type NoticeTargetRole } from '../data/models';

export default function NotificationScreen() {
  const { user, language } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAudience, setSelectedAudience] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newNotice, setNewNotice] = useState({
    title: '',
    body: '',
    category: 'General',
    targetRole: 'all' as NoticeTargetRole,
    priority: 'normal' as 'normal' | 'high' | 'urgent',
  });

  const categories = [
    { value: 'all', label: t('all', language) },
    ...(user?.role === 'zonal_admin' ? [
      { value: 'Zonal Request', label: '🔑 Zonal Key Request' },
      { value: 'Leave Request', label: '🏛️ Principal Leave Requests' },
    ] : [
      { value: 'Leave Request', label: user?.role === 'teacher' ? 'My Leave Updates' : t('categoryLeaveRequest', language) },
    ]),
    { value: 'General', label: t('categoryGeneral', language) },
    { value: 'Academic', label: t('categoryAcademic', language) },
    { value: 'Administrative', label: t('categoryAdministrative', language) },
    { value: 'Exam', label: t('categoryExam', language) },
    { value: 'Urgent', label: t('categoryUrgent', language) },
    { value: 'Event', label: t('categoryEvent', language) },
  ];

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const data = await databaseService.getNotices();
      setNotices(deduplicateNotices(data));
    } catch (err) {
      console.error('Error fetching notices:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time listener — subscribe on mount, unsubscribe on unmount
  useEffect(() => {
    setLoading(true);
    const unsub = databaseService.subscribeToNotices(
      (data) => {
        setNotices(deduplicateNotices(data));
        setLoading(false);
      },
      (err) => {
        console.error('Real-time notices error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotice.title.trim() || !newNotice.body.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const createdNotice: Notice = {
        id: `notice_${Date.now()}`,
        title: newNotice.title.trim(),
        body: newNotice.body.trim(),
        date: new Date().toISOString(),
        category: newNotice.category,
        targetRole: newNotice.targetRole,
        priority: newNotice.priority,
        authorName: user.name,
        authorRole: user.role,
        schoolCensusCode: user.schoolCensusCode,
        schoolName: user.schoolName,
      };

      await databaseService.createNotice(createdNotice);
      // No need to manually fetchNotices() — the real-time listener picks it up automatically
      setShowCreateModal(false);
      setNewNotice({
        title: '',
        body: '',
        category: 'General',
        targetRole: 'all',
        priority: 'normal',
      });
    } catch (err) {
      console.error('Failed to create notice:', err);
      alert('Failed to publish notice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;
    try {
      await databaseService.deleteNotice(id);
      // Real-time listener auto-updates the list — no need for setNotices manually
    } catch (err) {
      console.error('Failed to delete notice:', err);
      alert('Failed to delete notice.');
    }
  };

  // Filtering Logic
  const uniqueNotices = deduplicateNotices(notices);

  const filteredNotices = uniqueNotices.filter(n => {
    // 1. Core relevance check (Role & School Census Code isolation)
    if (!isNoticeRelevantToUser(n, user)) return false;

    // 2. Search query filter
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.authorName && n.authorName.toLowerCase().includes(searchQuery.toLowerCase()));

    // 3. Category filter
    const matchesCategory = selectedCategory === 'all' || n.category === selectedCategory;

    // 4. Priority filter
    const matchesPriority = selectedPriority === 'all' || (n.priority || 'normal') === selectedPriority;

    // 5. Manual audience filter dropdown
    const roleTarget = n.targetRole || 'all';
    const matchesAudience = selectedAudience === 'all' || roleTarget === selectedAudience;

    return matchesSearch && matchesCategory && matchesPriority && matchesAudience;
  });

  const schoolNotices = uniqueNotices.filter(n => isNoticeRelevantToUser(n, user));

  const totalUrgent = schoolNotices.filter(n => n.priority === 'urgent').length;
  const totalLeaveReqs = schoolNotices.filter(n => n.category === 'Leave Request').length;
  const totalForUser = schoolNotices.length;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell className="text-primary" size={28} />
            {t('notifications', language)}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
            <p className="page-subtitle" style={{ margin: 0 }}>{t('notificationsSubtitle', language)}</p>
            {/* Live Sync Indicator */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#10b981', borderRadius: '20px', fontSize: '11px',
              fontWeight: 700, padding: '2px 10px', letterSpacing: '0.3px',
            }}>
              <span style={{
                display: 'inline-block', width: 7, height: 7,
                borderRadius: '50%', background: '#10b981',
                animation: 'pulse-live 1.8s ease-in-out infinite',
              }} />
              LIVE
            </span>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} />
          <span>{t('createNotice', language)}</span>
        </button>
      </div>

      {/* Quick Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(2, 132, 199, 0.15)' }}>
            <Bell size={22} color="#0284c7" />
          </div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#0284c7' }}>{schoolNotices.length}</div>
            <div className="stat-label">
              {user?.role === 'zonal_admin'
                ? 'Zonal Oversight Notices'
                : user?.role === 'teacher'
                  ? 'My Notifications'
                  : 'Total Notifications'}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
            <FileText size={22} color="#f59e0b" />
          </div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#f59e0b' }}>{totalLeaveReqs}</div>
            <div className="stat-label">
              {user?.role === 'zonal_admin'
                ? 'Principal Leave Requests'
                : user?.role === 'teacher'
                  ? 'My Leave Updates'
                  : 'Staff Leave Requests'}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(225, 29, 72, 0.15)' }}>
            <AlertTriangle size={22} color="#e11d48" />
          </div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#e11d48' }}>{totalUrgent}</div>
            <div className="stat-label">
              {user?.role === 'zonal_admin' ? 'Urgent Zonal Alerts' : 'Urgent Alerts'}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(13, 148, 136, 0.15)' }}>
            <Shield size={22} color="#0d9488" />
          </div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#0d9488' }}>
              {user?.role === 'zonal_admin'
                ? schoolNotices.filter(n => n.category === 'Zonal Request' || n.targetRole === 'zonal_admin').length
                : schoolNotices.filter(n => n.category === 'General' || n.category === 'Academic' || n.category === 'Administrative').length}
            </div>
            <div className="stat-label">
              {user?.role === 'zonal_admin' ? 'Zonal Key Requests' : 'School Announcements'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {/* Search box */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '36px' }}
              placeholder={t('search', language) + ' notifications...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              className="input"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              {categories.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              className="input"
              value={selectedPriority}
              onChange={e => setSelectedPriority(e.target.value)}
            >
              <option value="all">{t('priority', language)}: {t('all', language)}</option>
              <option value="urgent">{t('urgentPriority', language)}</option>
              <option value="high">{t('highPriority', language)}</option>
              <option value="normal">{t('normalPriority', language)}</option>
            </select>
          </div>

          {/* Audience Filter */}
          <div>
            <select
              className="input"
              value={selectedAudience}
              onChange={e => setSelectedAudience(e.target.value)}
            >
              <option value="all">{t('targetAudience', language)}: {t('all', language)}</option>
              <option value="all">{t('allAudience', language)}</option>
              {user?.role !== 'zonal_admin' && (
                <option value="teacher">{t('teachersOnly', language)}</option>
              )}
              {user?.role !== 'teacher' && (
                <option value="principal">{t('principalOnlyAudience', language)}</option>
              )}
              {user?.role === 'zonal_admin' && (
                <option value="zonal_admin">Zonal Admin Directives</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <span className="spinner spinner-lg" />
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="card empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Bell size={48} style={{ opacity: 0.25, marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{t('noNotificationsFound', language)}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
            No matching notifications. Try resetting your search or filter parameters.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedPriority('all');
                setSelectedAudience('all');
              }}
            >
              Reset Filters
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={14} /> Create Notice
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredNotices.map(notice => {
            const isUrgent = notice.priority === 'urgent';
            const isHigh = notice.priority === 'high';
            const canDelete =
              user?.role === 'principal' ||
              user?.role === 'zonal_admin' ||
              Boolean(notice.authorName && user?.name && notice.authorName.toLowerCase() === user.name.toLowerCase());

            return (
              <div
                key={notice.id}
                className="card"
                style={{
                  position: 'relative',
                  padding: '20px',
                  borderLeft: isUrgent
                    ? '4px solid #e11d48'
                    : isHigh
                      ? '4px solid #f59e0b'
                      : '4px solid var(--primary)',
                  background: isUrgent ? 'rgba(225, 29, 72, 0.03)' : undefined,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Title & Badges */}
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {isUrgent && (
                        <span className="badge" style={{ background: '#e11d48', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={12} /> {t('urgentPriority', language)}
                        </span>
                      )}
                      {isHigh && (
                        <span className="badge" style={{ background: '#f59e0b', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Sparkles size={12} /> {t('highPriority', language)}
                        </span>
                      )}
                      <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Tag size={12} /> {notice.category}
                      </span>
                      <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} />
                        {notice.targetRole === 'teacher'
                          ? t('teachersOnly', language)
                          : notice.targetRole === 'principal'
                            ? t('principalOnlyAudience', language)
                            : t('allAudience', language)}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                      {notice.title}
                    </h3>
                  </div>

                  {/* Date & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} />
                      {new Date(notice.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>

                    {canDelete && (
                      <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => handleDeleteNotice(notice.id)}
                        title={t('deleteNotice', language)}
                        style={{ color: '#e11d48' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Body Content */}
                <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)', marginTop: '12px', whiteSpace: 'pre-line' }}>
                  {notice.body}
                </div>

                {/* Footer Info */}
                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={14} />
                    <span>
                      {t('postedBy', language)}: <strong style={{ color: 'var(--text-main)' }}>{notice.authorName || 'School Administration'}</strong>
                      {notice.authorRole && (
                        <span style={{ opacity: 0.8, marginLeft: '4px' }}>
                          ({t(notice.authorRole, language)})
                        </span>
                      )}
                    </span>
                  </div>

                  {notice.category === 'Leave Request' && (
                    <Link
                      to={user?.role === 'zonal_admin' ? '/admin' : '/leave'}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 10px' }}
                    >
                      <FileText size={13} />
                      <span>{user?.role === 'zonal_admin' ? 'Review in Admin Portal' : `${t('leave', language)} Screen`}</span>
                      <ArrowRight size={13} />
                    </Link>
                  )}

                  {notice.category === 'Zonal Request' && (
                    <Link
                      to="/admin"
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 10px', background: '#7c3aed', borderColor: '#7c3aed' }}
                    >
                      <Shield size={13} />
                      <span>Open in Zonal Command Center</span>
                      <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Notification Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '90%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={20} className="text-primary" />
                {t('createNotice', language)}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div>
                <label className="label">{t('noticeTitle', language)} *</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Staff Meeting / Examination Update"
                  value={newNotice.title}
                  onChange={e => setNewNotice({ ...newNotice, title: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">{t('noticeCategory', language)}</label>
                  <select
                    className="input"
                    value={newNotice.category}
                    onChange={e => setNewNotice({ ...newNotice, category: e.target.value })}
                  >
                    <option value="General">{t('categoryGeneral', language)}</option>
                    <option value="Academic">{t('categoryAcademic', language)}</option>
                    <option value="Administrative">{t('categoryAdministrative', language)}</option>
                    <option value="Exam">{t('categoryExam', language)}</option>
                    <option value="Urgent">{t('categoryUrgent', language)}</option>
                    <option value="Event">{t('categoryEvent', language)}</option>
                  </select>
                </div>

                <div>
                  <label className="label">{t('priority', language)}</label>
                  <select
                    className="input"
                    value={newNotice.priority}
                    onChange={e => setNewNotice({ ...newNotice, priority: e.target.value as any })}
                  >
                    <option value="normal">{t('normalPriority', language)}</option>
                    <option value="high">{t('highPriority', language)}</option>
                    <option value="urgent">{t('urgentPriority', language)}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">{t('targetAudience', language)}</label>
                <select
                  className="input"
                  value={newNotice.targetRole}
                  onChange={e => setNewNotice({ ...newNotice, targetRole: e.target.value as any })}
                >
                  {user?.role === 'zonal_admin' ? (
                    <>
                      <option value="principal">{t('principalOnlyAudience', language)}</option>
                      <option value="all">{t('allAudience', language)}</option>
                    </>
                  ) : (
                    <>
                      <option value="all">{t('allAudience', language)} (teachers + parents)</option>
                      <option value="teacher">{t('teachersOnly', language)}</option>
                      <option value="principal">{t('principalOnlyAudience', language)}</option>
                      <option value="parent">📱 Parents Only (Mobile App)</option>
                      <option value="student">🎓 Students Only (Mobile App)</option>
                    </>
                  )}
                </select>
                {(newNotice.targetRole === 'parent' || newNotice.targetRole === 'student') && (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>⚡ LIVE</span>
                    This notice will be pushed instantly to parents &amp; students on the EduNexus mobile app.
                  </p>
                )}
              </div>

              <div>
                <label className="label">{t('noticeBody', language)} *</label>
                <textarea
                  className="input"
                  rows={4}
                  required
                  placeholder="Enter full notice body and instructions..."
                  value={newNotice.body}
                  onChange={e => setNewNotice({ ...newNotice, body: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  {t('cancel', language)}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="spinner spinner-sm" />
                  ) : (
                    t('postNotification', language)
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
