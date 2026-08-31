import { useEffect, useState } from 'react';
import { UserCheck, UserX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { SchoolClass, Teacher } from '../data/models';

export default function ClassManagementScreen() {
  const { user, language } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'ol' | 'al'>('all');

  async function load() {
    const userSchoolCode = user?.role === 'zonal_admin' ? undefined : user?.schoolCensusCode;
    const [cls, tc] = await Promise.all([
      databaseService.getClasses(),
      databaseService.getTeachers(userSchoolCode),
    ]);
    setClasses(cls);
    setTeachers(tc);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAssign() {
    if (!selectedClass) return;
    setSaving(true);
    const teacher = teachers.find(t => t.id === selectedTeacherId) ?? null;
    await databaseService.assignTeacherToClass(
      selectedClass.id,
      teacher?.id ?? null,
      teacher?.name ?? null
    );
    await load();
    setSelectedClass(null);
    setSelectedTeacherId('');
    setSaving(false);
  }

  async function handleRemove(cls: SchoolClass) {
    await databaseService.removeTeacherFromClass(cls.id);
    await load();
  }

  const filtered = classes.filter(c => filter === 'all' || c.stream === filter);
  const olClasses = filtered.filter(c => c.stream === 'ol');
  const alClasses = filtered.filter(c => c.stream === 'al');

  function ClassCard({ cls }: { cls: SchoolClass }) {
    return (
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '18px' }}>{cls.id}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span className="badge badge-primary">{cls.stream === 'ol' ? t('olStream', language) : t('alStream', language)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSelectedClass(cls); setSelectedTeacherId(cls.homeroomTeacherId ?? ''); }}
            >
              <UserCheck size={13} />
              {t('assignTeacher', language)}
            </button>
            {cls.homeroomTeacherId && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleRemove(cls)}
              >
                <UserX size={13} />
              </button>
            )}
          </div>
        </div>
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            {t('homeroomTeacher', language)}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 500 }}>
            {cls.homeroomTeacherName
              ? <span style={{ color: 'var(--success)' }}>✓ {cls.homeroomTeacherName}</span>
              : <span style={{ color: 'var(--text-muted)' }}>{t('noTeacherAssigned', language)}</span>
            }
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="page-title">{t('classManagement', language)}</h1>
          <p className="page-subtitle">{classes.length} classes total</p>
        </div>
        <div className="tabs" style={{ margin: 0 }}>
          {(['all', 'ol', 'al'] as const).map(f => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? t('all', language) : f === 'ol' ? t('olStream', language) : t('alStream', language)}
            </button>
          ))}
        </div>
      </div>

      {(filter === 'all' || filter === 'ol') && olClasses.length > 0 && (
        <>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            O/L Classes
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {olClasses.map(cls => <ClassCard key={cls.id} cls={cls} />)}
          </div>
        </>
      )}

      {(filter === 'all' || filter === 'al') && alClasses.length > 0 && (
        <>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            A/L Classes
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {alClasses.map(cls => <ClassCard key={cls.id} cls={cls} />)}
          </div>
        </>
      )}

      {/* Assign Teacher Modal */}
      {selectedClass && (
        <div className="modal-overlay" onClick={() => setSelectedClass(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">
              {t('assignTeacher', language)} — {selectedClass.id}
            </h2>
            <div className="form-group">
              <label className="form-label">{t('homeroomTeacher', language)}</label>
              <select
                id="assign-teacher-select"
                className="form-control"
                value={selectedTeacherId}
                onChange={e => setSelectedTeacherId(e.target.value)}
              >
                <option value="">{t('noTeacherAssigned', language)}</option>
                {teachers.map(tc => (
                  <option key={tc.id} value={tc.id}>{tc.name} — {tc.subject}</option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedClass(null)}>
                {t('cancel', language)}
              </button>
              <button className="btn btn-primary" onClick={handleAssign} disabled={saving}>
                {saving ? <span className="spinner" /> : null}
                {t('save', language)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
