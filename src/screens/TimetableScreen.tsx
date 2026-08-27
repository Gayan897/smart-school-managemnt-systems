import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Sparkles, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { TimetableSlot, SchoolClass, ProxyAssignment } from '../data/models';
import { db } from '../data/firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';

const DAYS = [
  { num: 1, key: 'monday' },
  { num: 2, key: 'tuesday' },
  { num: 3, key: 'wednesday' },
  { num: 4, key: 'thursday' },
  { num: 5, key: 'friday' },
];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export default function TimetableScreen() {
  const { user, language } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [proxyAssignments, setProxyAssignments] = useState<ProxyAssignment[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    dayOfWeek: 1,
    period: 1,
    subject: '',
    teacher: '',
  });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [cls, s, proxies] = await Promise.all([
      databaseService.getClasses(),
      databaseService.getTimetable(),
      databaseService.getProxyAssignments(),
    ]);
    setClasses(cls);
    setSlots(s);
    setProxyAssignments(proxies);
    if (cls.length > 0) setSelectedClass(cls[0].id);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const classSlots = slots.filter(s => s.classRoom === selectedClass);

  function getSlot(day: number, period: number): TimetableSlot | undefined {
    return classSlots.find(s => s.dayOfWeek === day && s.period === period);
  }

  function getProxyForSlot(period: number): ProxyAssignment | undefined {
    return proxyAssignments.find(
      p => p.date === selectedDate && p.classRoom === selectedClass && p.period === period && p.status !== 'declined'
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim() || !form.teacher.trim()) return;
    setSubmitting(true);
    const slot: TimetableSlot = {
      classRoom: selectedClass,
      dayOfWeek: form.dayOfWeek,
      period: form.period,
      subject: form.subject.trim(),
      teacher: form.teacher.trim(),
    };
    const id = `${selectedClass}_${form.dayOfWeek}_${form.period}`;
    await setDoc(doc(collection(db, 'timetable'), id), slot);
    await load();
    setShowModal(false);
    setForm({ dayOfWeek: 1, period: 1, subject: '', teacher: '' });
    setSubmitting(false);
  }

  async function handleDelete(day: number, period: number) {
    const id = `${selectedClass}_${day}_${period}`;
    await deleteDoc(doc(collection(db, 'timetable'), id));
    setSlots(prev => prev.filter(s => !(s.classRoom === selectedClass && s.dayOfWeek === day && s.period === period)));
  }

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  // Calculate day of week for selected date
  const dateObj = new Date(selectedDate);
  const selectedDayNum = dateObj.getDay() === 0 || dateObj.getDay() === 6 ? 1 : dateObj.getDay();

  return (
    <div className="page">
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">{t('timetable', language)}</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Link
            to="/substitutes"
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={16} color="#6366f1" />
            <span>{t('proxyEngine', language)}</span>
          </Link>
          {user?.role === 'principal' && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} />
              {t('addSlot', language)}
            </button>
          )}
        </div>
      </div>

      {/* Class & Date select */}
      <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0, minWidth: '240px' }}>
          <label className="form-label">{t('selectClass', language)}</label>
          <select className="form-control" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                Grade {c.grade}{c.section} ({c.stream === 'ol' ? 'O/L' : 'A/L'})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
          <label className="form-label">Active Date (Substitute Overlay)</label>
          <input
            type="date"
            className="form-control"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* Timetable grid */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          className="timetable-grid"
          style={{
            gridTemplateColumns: `60px repeat(${DAYS.length}, 1fr)`,
            border: 'none',
          }}
        >
          {/* Header row */}
          <div className="timetable-cell header">Period</div>
          {DAYS.map(d => (
            <div
              key={d.num}
              className={`timetable-cell header ${d.num === selectedDayNum ? 'header-highlight' : ''}`}
              style={{
                background: d.num === selectedDayNum ? 'rgba(99, 102, 241, 0.15)' : undefined,
                color: d.num === selectedDayNum ? '#818cf8' : undefined,
              }}
            >
              {t(d.key, language)} {d.num === selectedDayNum && '(Selected)'}
            </div>
          ))}

          {/* Period rows */}
          {PERIODS.map(p => (
            <>
              <div key={`p${p}`} className="timetable-cell header" style={{ fontSize: '13px' }}>{p}</div>
              {DAYS.map(d => {
                const slot = getSlot(d.num, p);
                const proxy = d.num === selectedDayNum ? getProxyForSlot(p) : undefined;

                return (
                  <div
                    key={`${d.num}-${p}`}
                    className={`timetable-cell ${slot ? 'filled' : ''}`}
                    style={{
                      position: 'relative',
                      background: proxy ? 'rgba(99, 102, 241, 0.12)' : undefined,
                      border: proxy ? '1px dashed #6366f1' : undefined,
                    }}
                  >
                    {slot ? (
                      <>
                        <span className="timetable-slot-subject">{slot.subject}</span>
                        {proxy ? (
                          <div style={{
                            background: 'rgba(99, 102, 241, 0.25)',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            marginTop: '2px',
                            border: '1px solid #6366f1',
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <UserCheck size={11} />
                              Proxy: {proxy.substituteTeacherName}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              (For {proxy.originalTeacherName})
                            </div>
                          </div>
                        ) : (
                          <span className="timetable-slot-teacher">{slot.teacher}</span>
                        )}

                        {user?.role === 'principal' && !proxy && (
                          <button
                            onClick={() => handleDelete(d.num, p)}
                            style={{
                              position: 'absolute', top: '4px', right: '4px',
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-muted)', padding: '2px',
                              opacity: 0, transition: 'opacity 0.15s',
                            }}
                            className="timetable-delete-btn"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>

      {/* Add Slot Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{t('addSlot', language)}</h2>
            <form onSubmit={handleAdd}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">{t('day', language)}</label>
                  <select className="form-control" value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: Number(e.target.value) }))}>
                    {DAYS.map(d => <option key={d.num} value={d.num}>{t(d.key, language)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('period', language)}</label>
                  <select className="form-control" value={form.period} onChange={e => setForm(f => ({ ...f, period: Number(e.target.value) }))}>
                    {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('subject', language)}</label>
                <input className="form-control" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Mathematics" required />
              </div>
              <div className="form-group">
                <label className="form-label">Teacher</label>
                <input className="form-control" value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))} placeholder="Teacher name" required />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('cancel', language)}</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <span className="spinner" /> : null}
                  {t('save', language)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .timetable-cell:hover .timetable-delete-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
