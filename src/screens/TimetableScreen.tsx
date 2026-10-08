import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, Sparkles, Send, Printer, Download,
  Share2, Coffee, Clock, Calendar, CheckCircle2, AlertCircle,
  Copy, RefreshCw, X, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { TimetableSlot, SchoolClass, Teacher } from '../data/models';
import {
  SL_BELL_SCHEDULE,
  SL_PERIOD_NUMBERS,
  SL_OL_8_SUBJECTS,
} from '../data/models';
import {
  buildSubjectTeacherMappings,
  generateClassTimetable,
  generateSchoolTimetables,
  formatTimetableWhatsAppMessage,
  generateTimetableCsv,
  type SubjectTeacherMapping,
} from '../utils/timetableEngine';
import { db } from '../data/firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';

const DAYS = [
  { num: 1, key: 'monday', labelEn: 'Monday', labelSi: 'සඳුදා', labelTa: 'திங்கள்' },
  { num: 2, key: 'tuesday', labelEn: 'Tuesday', labelSi: 'අඟහරුවාදා', labelTa: 'செவ்வாய்' },
  { num: 3, key: 'wednesday', labelEn: 'Wednesday', labelSi: 'බදාදා', labelTa: 'புதன்' },
  { num: 4, key: 'thursday', labelEn: 'Thursday', labelSi: 'බ්‍රහස්පතින්දා', labelTa: 'வியாழන්' },
  { num: 5, key: 'friday', labelEn: 'Friday', labelSi: 'සිකුරාදා', labelTa: 'வெள்ளி' },
];

export default function TimetableScreen() {
  const { user, language } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<number>(2026);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchTab, setDispatchTab] = useState<'notice' | 'whatsapp' | 'print' | 'export'>('notice');

  // Generator configuration state
  const [genScope, setGenScope] = useState<'current' | 'all'>('current');
  const [genYear, setGenYear] = useState<number>(2026);
  const [customMappings, setCustomMappings] = useState<SubjectTeacherMapping[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Dispatch state
  const [dispatchNote, setDispatchNote] = useState('');
  const [dispatchSuccess, setDispatchSuccess] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  // Add/Edit manual slot form
  const [form, setForm] = useState({
    dayOfWeek: 1,
    period: 1,
    subject: '',
    teacher: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  async function load() {
    try {
      const isPrincipal = user?.role === 'principal';
      const [cls, s, tList] = await Promise.all([
        databaseService.getClasses(),
        databaseService.getTimetable(),
        isPrincipal ? databaseService.getTeachers(user?.schoolCensusCode) : Promise.resolve([]),
      ]);
      setClasses(cls);
      setSlots(s);
      setTeachers(tList);

      // For teachers/students: lock to their own homeroom class
      if (!isPrincipal && user?.classRoom) {
        setSelectedClass(user.classRoom);
      } else if (cls.length > 0 && !selectedClass) {
        setSelectedClass(cls[0].id);
      }
    } catch (err) {
      console.error('Failed to load timetable data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const unsub = databaseService.subscribeToTimetable((updatedSlots) => {
      setSlots(updatedSlots);
    });
    return () => unsub();
  }, [user]);

  // Current active class object
  const activeClassObj = useMemo(() => {
    return classes.find((c) => c.id === selectedClass);
  }, [classes, selectedClass]);

  // Teacher Schedule & View Mode
  const isTeacher = user?.role === 'teacher';
  const [viewMode, setViewMode] = useState<'class' | 'my_schedule'>(isTeacher ? 'my_schedule' : 'class');

  // Slots for the selected class and academic year
  const classSlots = useMemo(() => {
    return slots.filter((s) => s.classRoom === selectedClass);
  }, [slots, selectedClass]);

  // Slots assigned to this specific teacher across all classes
  const teacherSlots = useMemo(() => {
    if (!user) return [];
    const nameNorm = (user.name || '').trim().toLowerCase();
    const userId = user.id;
    return slots.filter((s) => {
      const slotTeacherNorm = (s.teacher || '').trim().toLowerCase();
      return (
        (s.teacherId && s.teacherId === userId) ||
        (slotTeacherNorm && slotTeacherNorm === nameNorm) ||
        (slotTeacherNorm && nameNorm && (nameNorm.includes(slotTeacherNorm) || slotTeacherNorm.includes(nameNorm)))
      );
    });
  }, [slots, user]);

  // Setup mappings when generator modal opens
  useEffect(() => {
    if (activeClassObj && showGenerateModal) {
      const mappings = buildSubjectTeacherMappings(activeClassObj, teachers);
      setCustomMappings(mappings);
    }
  }, [activeClassObj, teachers, showGenerateModal]);

  function getSlot(day: number, period: number): TimetableSlot | undefined {
    if (isTeacher && viewMode === 'my_schedule') {
      return teacherSlots.find((s) => s.dayOfWeek === day && s.period === period);
    }
    return classSlots.find((s) => s.dayOfWeek === day && s.period === period);
  }

  // Handle Manual Add Slot
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim() || !form.teacher.trim()) return;
    setSubmitting(true);
    try {
      const bell = SL_BELL_SCHEDULE.find((b) => b.period === form.period);
      const slot: TimetableSlot = {
        classRoom: selectedClass,
        dayOfWeek: form.dayOfWeek,
        period: form.period,
        subject: form.subject.trim(),
        teacher: form.teacher.trim(),
        academicYear: selectedAcademicYear,
        startTime: bell?.startTime,
        endTime: bell?.endTime,
      };
      const id = `${selectedClass}_${form.dayOfWeek}_${form.period}`;
      await setDoc(doc(collection(db, 'timetable'), id), slot);
      setShowAddModal(false);
      setForm({ dayOfWeek: 1, period: 1, subject: '', teacher: '' });
      showToast('Timetable slot saved successfully.');
    } catch (err) {
      console.error('Failed to save slot:', err);
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Manual Delete Slot
  async function handleDelete(day: number, period: number) {
    const id = `${selectedClass}_${day}_${period}`;
    await deleteDoc(doc(collection(db, 'timetable'), id));
    setSlots((prev) =>
      prev.filter((s) => !(s.classRoom === selectedClass && s.dayOfWeek === day && s.period === period))
    );
    showToast('Slot removed.');
  }

  // Clear Timetable for Current Class
  async function handleClearClass() {
    if (!confirm(`Are you sure you want to clear all timetable slots for Class ${selectedClass}?`)) {
      return;
    }
    await databaseService.deleteClassTimetable(selectedClass);
    showToast(`Timetable cleared for Class ${selectedClass}.`);
  }

  // Handle Annual Generator Execution
  async function handleExecuteGenerate() {
    if (!activeClassObj && genScope === 'current') return;
    setIsGenerating(true);

    try {
      if (genScope === 'current' && activeClassObj) {
        // Generate single class
        const newSlots = generateClassTimetable({
          schoolClass: activeClassObj,
          academicYear: genYear,
          mappings: customMappings,
          existingSchoolSlots: slots.filter((s) => s.classRoom !== activeClassObj.id),
        });
        await databaseService.saveTimetableSlotsBatch(newSlots);
        showToast(`Successfully generated 40 periods for Class ${activeClassObj.id} (Year ${genYear})!`);
      } else {
        // Whole school batch generation
        const allGenerated = generateSchoolTimetables({
          classes,
          teachers,
          academicYear: genYear,
        });
        await databaseService.saveTimetableSlotsBatch(allGenerated);
        showToast(`Successfully generated annual timetables for all ${classes.length} classes (Year ${genYear})!`);
      }
      setShowGenerateModal(false);
    } catch (err) {
      console.error('Failed during generation:', err);
      alert('Error generating timetable: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsGenerating(false);
    }
  }

  // Handle Official Notice Broadcast Dispatch
  async function handleBroadcastNotice() {
    if (!activeClassObj || isBroadcasting) return;
    setIsBroadcasting(true);
    try {
      await databaseService.publishTimetableNotice({
        classRoom: selectedClass,
        className: `Grade ${activeClassObj.grade}${activeClassObj.section}`,
        academicYear: selectedAcademicYear,
        authorName: user?.name || 'Principal Office',
        schoolName: user?.schoolName || 'Government School',
        censusCode: user?.schoolCensusCode,
        messageNote: dispatchNote.trim() || undefined,
      });
      setDispatchSuccess(true);
      setTimeout(() => setDispatchSuccess(false), 4000);
      showToast('Timetable published! System notice and parent alerts dispatched.');
    } catch (err) {
      console.error('Failed to broadcast timetable notice:', err);
    } finally {
      setIsBroadcasting(false);
    }
  }

  // Get WhatsApp share text
  const whatsAppText = useMemo(() => {
    if (!activeClassObj) return '';
    return formatTimetableWhatsAppMessage({
      schoolName: user?.schoolName || 'Sri Lanka Model School',
      censusCode: user?.schoolCensusCode,
      className: `Grade ${activeClassObj.grade}${activeClassObj.section} (${activeClassObj.stream === 'ol' ? 'O/L' : 'A/L'})`,
      academicYear: selectedAcademicYear,
      slots: classSlots,
    });
  }, [activeClassObj, user, selectedAcademicYear, classSlots]);

  function handleCopyWhatsApp() {
    navigator.clipboard.writeText(whatsAppText);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 3000);
    showToast('WhatsApp message copied to clipboard!');
  }

  function handleOpenWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(whatsAppText)}`;
    window.open(url, '_blank');
  }

  function handleDownloadCsv() {
    const csv = generateTimetableCsv(classSlots, activeClassObj ? `Grade ${activeClassObj.grade}${activeClassObj.section}` : selectedClass);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Timetable_${selectedClass}_${selectedAcademicYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV downloaded successfully.');
  }

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  const currentDay = new Date().getDay();
  const todayDayNum = currentDay === 0 || currentDay === 6 ? 1 : currentDay;

  return (
    <div className="page">
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          background: '#10b981',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600,
          animation: 'fadeInDown 0.3s ease',
        }}>
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">{t('timetable', language)}</h1>
            <span style={{
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <Calendar size={13} />
              Year {selectedAcademicYear}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Official Sri Lankan School Schedule: 08:00 AM – 01:30 PM (8 Periods with Recess after Period 4)
          </p>
        </div>

        {/* Action Controls for Principal */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {user?.role === 'principal' && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => setShowGenerateModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                }}
              >
                <Sparkles size={16} />
                Generate Annual Timetable
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => setShowDispatchModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={15} />
                Send & Publish
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => window.print()}
                title="Print MoE Timetable"
              >
                <Printer size={15} />
                Print
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => setShowAddModal(true)}
                title="Add individual slot"
              >
                <Plus size={15} />
                {t('addSlot', language)}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Control Bar: Class & Year */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, minWidth: '240px', flex: '1 1 240px' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>{t('selectClass', language)}</label>

            {user?.role === 'principal' ? (
              /* Principal: full dropdown to switch between all classes */
              <select
                className="form-control"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Grade {c.grade}{c.section} — {c.stream === 'ol' ? 'O/L (Grades 10–11)' : 'A/L Stream'}
                    {c.homeroomTeacherName ? ` (${c.homeroomTeacherName})` : ''}
                  </option>
                ))}
              </select>
            ) : user?.role === 'teacher' ? (
              /* Teacher: Toggle between "My Teaching Schedule" and "Classroom Timetable" */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setViewMode('my_schedule')}
                    className={`btn btn-sm ${viewMode === 'my_schedule' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <span>📅</span>
                    <span>My Teaching Schedule</span>
                    <span className="badge badge-secondary" style={{ fontSize: '10px', padding: '1px 6px' }}>
                      {teacherSlots.length} Periods
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('class')}
                    className={`btn btn-sm ${viewMode === 'class' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <span>🏫</span>
                    <span>Classroom Timetable</span>
                  </button>
                </div>

                {viewMode === 'class' ? (
                  <select
                    className="form-control"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    style={{ fontSize: '13px' }}
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        Class {c.id} (Grade {c.grade}{c.section}) — {c.stream === 'al' ? 'A/L' : 'O/L'}
                        {c.homeroomTeacherName ? ` · Homeroom: ${c.homeroomTeacherName}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: '11px', color: '#0284c7', background: 'rgba(2,132,199,0.08)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(2,132,199,0.2)' }}>
                    Showing all periods where <strong>{user?.name}</strong> is scheduled to teach across the school.
                  </div>
                )}
              </div>
            ) : (
              /* Student: locked to their own class — read-only */
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(99,102,241,0.08)',
                border: '1.5px solid var(--primary)',
              }}>
                <ShieldAlert size={16} color="var(--primary)" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                    {selectedClass
                      ? (() => {
                          const cls = classes.find(c => c.id === selectedClass);
                          return cls
                            ? `Grade ${cls.grade}${cls.section} — ${cls.stream === 'ol' ? 'O/L' : 'A/L'}`
                            : selectedClass;
                        })()
                      : 'Loading…'
                    }
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Your assigned class timetable
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="form-group" style={{ margin: 0, minWidth: '160px' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Academic Year</label>
            <select
              className="form-control"
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(Number(e.target.value))}
            >
              <option value={2026}>2026 Academic Year</option>
              <option value={2027}>2027 Academic Year</option>
              <option value={2025}>2025 Academic Year</option>
            </select>
          </div>

          {user?.role === 'principal' && classSlots.length > 0 && (
            <button
              onClick={handleClearClass}
              className="btn btn-ghost"
              style={{ color: '#ef4444', fontSize: '13px', marginLeft: 'auto' }}
              title="Reset slots for this class"
            >
              <RefreshCw size={14} />
              Reset Class Slots
            </button>
          )}
        </div>
      </div>


      {/* Bell Schedule Summary Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '10px 16px',
        marginBottom: '16px',
        fontSize: '12px',
        flexWrap: 'wrap',
        gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={16} color="var(--primary)" />
          <span><strong>Day Schedule:</strong> 08:00 AM – 01:30 PM</span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span>8 Teaching Periods (40m / 35m)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Coffee size={16} color="#d97706" />
          <span style={{ color: '#d97706', fontWeight: 600 }}>
            ☕ Interval: 10:40 AM – 11:00 AM (Strictly after Period 4)
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Classroom slots filled: </span>
          <strong style={{ color: classSlots.length >= 40 ? '#10b981' : '#f59e0b' }}>
            {classSlots.length} / 40
          </strong>
        </div>
      </div>

      {/* Timetable Grid */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          className="timetable-grid"
          style={{
            gridTemplateColumns: `100px repeat(${DAYS.length}, 1fr)`,
            border: 'none',
          }}
        >
          {/* Header Row */}
          <div className="timetable-cell header" style={{ flexDirection: 'column' }}>
            <span>Period</span>
            <span style={{ fontSize: '9px', fontWeight: 400, opacity: 0.8 }}>Time</span>
          </div>

          {DAYS.map((d) => (
            <div
              key={d.num}
              className={`timetable-cell header ${d.num === todayDayNum ? 'header-highlight' : ''}`}
              style={{
                background: d.num === todayDayNum ? 'rgba(99, 102, 241, 0.15)' : undefined,
                color: d.num === todayDayNum ? '#818cf8' : undefined,
                flexDirection: 'column',
              }}
            >
              <span>{t(d.key, language)}</span>
              <span style={{ fontSize: '10px', opacity: 0.8, fontWeight: 400 }}>
                {d.labelSi} • {d.labelTa}
              </span>
              {d.num === todayDayNum && (
                <span style={{ fontSize: '9px', color: '#6366f1', fontWeight: 700 }}>
                  Today
                </span>
              )}
            </div>
          ))}

          {/* Periods 1 to 4 */}
          {SL_PERIOD_NUMBERS.slice(0, 4).map((p) => {
            const bell = SL_BELL_SCHEDULE.find((b) => b.period === p);
            return (
              <>
                <div key={`p-header-${p}`} className="timetable-cell header" style={{ justifyContent: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>P{p}</span>
                  <span className="period-time-badge">
                    {bell ? `${bell.startTime} - ${bell.endTime}` : ''}
                  </span>
                </div>

                {DAYS.map((d) => {
                  const slot = getSlot(d.num, p);
                  return (
                    <SlotCell
                      key={`${d.num}-${p}`}
                      slot={slot}
                      isPrincipal={user?.role === 'principal'}
                      isTeacherSchedule={isTeacher && viewMode === 'my_schedule'}
                      onDelete={() => handleDelete(d.num, p)}
                    />
                  );
                })}
              </>
            );
          })}

          {/* ─── OFFICIAL INTERVAL / RECESS ROW (AFTER 4TH PERIOD) ─── */}
          <div className="timetable-interval-row">
            <Coffee size={16} />
            <span>🥪 INTERVAL / RECESS — 10:40 AM TO 11:00 AM (විවේක කාලය / இடைவேளை)</span>
            <Coffee size={16} />
          </div>

          {/* Periods 5 to 8 */}
          {SL_PERIOD_NUMBERS.slice(4, 8).map((p) => {
            const bell = SL_BELL_SCHEDULE.find((b) => b.period === p);
            return (
              <>
                <div key={`p-header-${p}`} className="timetable-cell header" style={{ justifyContent: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>P{p}</span>
                  <span className="period-time-badge">
                    {bell ? `${bell.startTime} - ${bell.endTime}` : ''}
                  </span>
                </div>

                {DAYS.map((d) => {
                  const slot = getSlot(d.num, p);
                  return (
                    <SlotCell
                      key={`${d.num}-${p}`}
                      slot={slot}
                      isPrincipal={user?.role === 'principal'}
                      isTeacherSchedule={isTeacher && viewMode === 'my_schedule'}
                      onDelete={() => handleDelete(d.num, p)}
                    />
                  );
                })}
              </>
            );
          })}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: ANNUAL TIMETABLE GENERATOR WIZARD                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showGenerateModal && (
        <div className="modal-overlay" onClick={() => !isGenerating && setShowGenerateModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: '780px', width: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#fff',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="modal-title" style={{ margin: 0 }}>Generate Annual Timetable</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    Sri Lankan National Curriculum Specification (8:00 AM – 1:30 PM, 8 Periods)
                  </p>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => !isGenerating && setShowGenerateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scope Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div
                onClick={() => setGenScope('current')}
                style={{
                  border: genScope === 'current' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '12px',
                  cursor: 'pointer',
                  background: genScope === 'current' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                  🎯 Selected Class Only
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Generates 40 slots for <strong>Grade {activeClassObj?.grade}{activeClassObj?.section}</strong>.
                </div>
              </div>

              <div
                onClick={() => setGenScope('all')}
                style={{
                  border: genScope === 'all' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '12px',
                  cursor: 'pointer',
                  background: genScope === 'all' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                  🏫 Whole School Batch
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Auto-generates for all {classes.length} classes avoiding teacher schedule clashes.
                </div>
              </div>
            </div>

            {/* Academic Year Selection */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Target Academic Year</label>
              <select
                className="form-control"
                value={genYear}
                onChange={(e) => setGenYear(Number(e.target.value))}
              >
                <option value={2026}>2026 Academic Year (Circular 2026/01 Compliant)</option>
                <option value={2027}>2027 Academic Year</option>
              </select>
            </div>

            {/* 8 Subjects & Teacher Allocation Mapping Preview */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                  {activeClassObj?.stream === 'ol' ? '8 Sri Lankan Core Subjects & Teacher Mapping' : 'Stream Subject Allocations'}
                </label>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Total 40 periods/week
                </span>
              </div>

              <div style={{
                maxHeight: '260px',
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px',
              }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '6px' }}>Subject</th>
                      <th style={{ padding: '6px' }}>Weekly Periods</th>
                      <th style={{ padding: '6px' }}>Assigned Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customMappings.map((m, idx) => (
                      <tr key={m.subjectId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 6px', fontWeight: 600 }}>{m.subjectName}</td>
                        <td style={{ padding: '8px 6px' }}>
                          <span style={{
                            background: 'var(--bg-hover)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontWeight: 600,
                          }}>
                            {m.weeklyPeriods} / week
                          </span>
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <select
                            className="form-control"
                            style={{ padding: '4px 8px', height: '32px', fontSize: '12px' }}
                            value={m.teacherName}
                            onChange={(e) => {
                              const newName = e.target.value;
                              const tObj = teachers.find((t) => t.name === newName);
                              setCustomMappings((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, teacherName: newName, teacherId: tObj?.id }
                                    : item
                                )
                              );
                            }}
                          >
                            {teachers.map((t) => (
                              <option key={t.id} value={t.name}>
                                {t.name} ({t.subject})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '12px',
              color: '#d97706',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}>
              <AlertCircle size={16} />
              <span>
                Generator enforces Sri Lankan MoE criteria: Maximum 2 periods/day per subject, core academics in morning, and 20-min Interval after Period 4.
              </span>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isGenerating}
                onClick={() => setShowGenerateModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isGenerating}
                onClick={handleExecuteGenerate}
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                }}
              >
                {isGenerating ? <span className="spinner" /> : <Sparkles size={16} />}
                {isGenerating ? 'Generating...' : genScope === 'current' ? 'Generate Class Timetable' : 'Generate Whole School'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: SEND & PUBLISH TIMETABLE ("Send them")               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showDispatchModal && (
        <div className="modal-overlay" onClick={() => setShowDispatchModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: '720px', width: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={20} color="var(--primary)" />
                <h2 className="modal-title" style={{ margin: 0 }}>
                  Publish & Send Timetable — {activeClassObj ? `Grade ${activeClassObj.grade}${activeClassObj.section}` : selectedClass}
                </h2>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowDispatchModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Dispatch Navigation Tabs */}
            <div style={{
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid var(--border)',
              marginBottom: '16px',
            }}>
              <button
                className={`btn btn-ghost ${dispatchTab === 'notice' ? 'btn-primary' : ''}`}
                onClick={() => setDispatchTab('notice')}
                style={{ borderRadius: '6px 6px 0 0', padding: '8px 14px' }}
              >
                📢 Official Notice & In-App Alerts
              </button>
              <button
                className={`btn btn-ghost ${dispatchTab === 'whatsapp' ? 'btn-primary' : ''}`}
                onClick={() => setDispatchTab('whatsapp')}
                style={{ borderRadius: '6px 6px 0 0', padding: '8px 14px' }}
              >
                💬 WhatsApp Broadcast
              </button>
              <button
                className={`btn btn-ghost ${dispatchTab === 'print' ? 'btn-primary' : ''}`}
                onClick={() => setDispatchTab('print')}
                style={{ borderRadius: '6px 6px 0 0', padding: '8px 14px' }}
              >
                🖨️ MoE Official Print View
              </button>
              <button
                className={`btn btn-ghost ${dispatchTab === 'export' ? 'btn-primary' : ''}`}
                onClick={() => setDispatchTab('export')}
                style={{ borderRadius: '6px 6px 0 0', padding: '8px 14px' }}
              >
                📥 Export CSV
              </button>
            </div>

            {/* TAB 1: OFFICIAL NOTICE BROADCAST */}
            {dispatchTab === 'notice' && (
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  Broadcasting will publish an official system announcement to all teachers, students, and parents belonging to this class, as well as sending instant push notifications to parents.
                </p>

                <div className="form-group">
                  <label className="form-label">Principal Announcement Notes (Optional)</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="e.g. Please adhere to the new 2026 Academic Bell Schedule. Students must arrive before 07:50 AM."
                    value={dispatchNote}
                    onChange={(e) => setDispatchNote(e.target.value)}
                  />
                </div>

                <div style={{
                  background: 'var(--bg-hover)',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '12px',
                }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>📢 Notice Preview:</div>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    <strong>Subject:</strong> 📅 Academic Timetable Published: Grade {activeClassObj?.grade}{activeClassObj?.section} ({selectedAcademicYear})<br />
                    <strong>Schedule:</strong> 08:00 AM – 01:30 PM (8 Periods with Recess at 10:40 AM)<br />
                    <strong>Author:</strong> Principal {user?.name || 'Office'}
                  </p>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleBroadcastNotice}
                  disabled={isBroadcasting}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {isBroadcasting ? (
                    <>
                      <span className="spinner spinner-sm" />
                      Broadcasting Notice...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Broadcast Notice to Teachers, Students & Parents
                    </>
                  )}
                </button>
              </div>
            )}

            {/* TAB 2: WHATSAPP BROADCAST */}
            {dispatchTab === 'whatsapp' && (
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Share this pre-formatted schedule directly with Class WhatsApp Groups, Parents, and Student bodies.
                </p>

                <textarea
                  className="form-control"
                  rows={10}
                  readOnly
                  value={whatsAppText}
                  style={{ fontFamily: 'monospace', fontSize: '11px', marginBottom: '14px', background: 'var(--bg-hover)' }}
                />

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" onClick={handleCopyWhatsApp} style={{ flex: 1 }}>
                    <Copy size={16} />
                    {copiedWhatsApp ? 'Copied to Clipboard!' : 'Copy Formatted Text'}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleOpenWhatsApp}
                    style={{ flex: 1, background: '#25D366', borderColor: '#25D366' }}
                  >
                    <Share2 size={16} />
                    Open in WhatsApp
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: MOE OFFICIAL PRINT VIEW */}
            {dispatchTab === 'print' && (
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  Print-ready A4 landscape official timetable complying with Sri Lankan Ministry of Education requirements, including school census code and endorsement signatures.
                </p>

                <div style={{
                  border: '1px solid var(--border)',
                  padding: '16px',
                  borderRadius: '8px',
                  background: '#fff',
                  color: '#000',
                  marginBottom: '16px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}>
                  <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, textTransform: 'uppercase', fontSize: '16px' }}>{user?.schoolName || 'Mahinda Rajapaksha College'}</h3>
                    <div style={{ fontSize: '11px' }}>Ministry of Education • Colombo District • Census Code: {user?.schoolCensusCode || '10421'}</div>
                    <h4 style={{ margin: '4px 0 0', fontSize: '13px' }}>Class Timetable — Grade {activeClassObj?.grade}{activeClassObj?.section} ({selectedAcademicYear})</h4>
                  </div>
                  <div style={{ fontSize: '11px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Homeroom Teacher: {activeClassObj?.homeroomTeacherName || 'Not Assigned'}</span>
                    <span>School Bell Hours: 08:00 AM – 01:30 PM (Interval: 10:40 AM – 11:00 AM)</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>
                    [Grid with 8 periods will print cleanly on landscape A4 sheet]
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => { setShowDispatchModal(false); setTimeout(() => window.print(), 300); }}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Printer size={16} />
                  Print Official Classroom Timetable (A4)
                </button>
              </div>
            )}

            {/* TAB 4: EXPORT CSV */}
            {dispatchTab === 'export' && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Download size={40} color="var(--primary)" style={{ marginBottom: '12px' }} />
                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Download Timetable Spreadsheet</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Export all 40 period slots with start/end times and teacher allocations for archive or school reports.
                </p>
                <button className="btn btn-primary" onClick={handleDownloadCsv}>
                  <Download size={16} />
                  Download CSV (Class {selectedClass})
                </button>
              </div>
            )}

            <div className="modal-footer" style={{ marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowDispatchModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 3: MANUAL ADD / EDIT SLOT                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{t('addSlot', language)}</h2>
            <form onSubmit={handleAdd}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">{t('day', language)}</label>
                  <select
                    className="form-control"
                    value={form.dayOfWeek}
                    onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))}
                  >
                    {DAYS.map((d) => (
                      <option key={d.num} value={d.num}>
                        {t(d.key, language)} ({d.labelSi})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('period', language)} (8:00 AM - 1:30 PM)</label>
                  <select
                    className="form-control"
                    value={form.period}
                    onChange={(e) => setForm((f) => ({ ...f, period: Number(e.target.value) }))}
                  >
                    {SL_PERIOD_NUMBERS.map((p) => {
                      const bell = SL_BELL_SCHEDULE.find((b) => b.period === p);
                      return (
                        <option key={p} value={p}>
                          Period {p} ({bell?.startTime} - {bell?.endTime})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Quick Sri Lankan Subject Selector Chips */}
              <div className="form-group">
                <label className="form-label">
                  {t('subject', language)} (Select or Type)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {SL_OL_8_SUBJECTS.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setForm((f) => ({ ...f, subject: s.nameEn }))}
                      style={{
                        background: form.subject === s.nameEn ? s.color : 'var(--bg-hover)',
                        color: form.subject === s.nameEn ? '#fff' : 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      {s.nameEn}
                    </button>
                  ))}
                </div>
                <input
                  className="form-control"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Mathematics"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Teacher</label>
                <input
                  className="form-control"
                  value={form.teacher}
                  onChange={(e) => setForm((f) => ({ ...f, teacher: e.target.value }))}
                  placeholder="Teacher name"
                  list="teacher-suggestions"
                  required
                />
                <datalist id="teacher-suggestions">
                  {teachers.map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  {t('cancel', language)}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <span className="spinner" /> : null}
                  {t('save', language)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hover delete style */}
      <style>{`
        .timetable-cell:hover .timetable-delete-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

/**
 * Individual Timetable Slot Card Component
 */
function SlotCell({
  slot,
  isPrincipal,
  isTeacherSchedule,
  onDelete,
}: {
  slot?: TimetableSlot;
  isPrincipal: boolean;
  isTeacherSchedule?: boolean;
  onDelete: () => void;
}) {
  const matchedSubject = SL_OL_8_SUBJECTS.find(
    (s) => slot && s.nameEn.toLowerCase() === slot.subject.toLowerCase()
  );
  const color = matchedSubject?.color || 'var(--primary)';

  return (
    <div
      className={`timetable-cell ${slot ? 'filled' : ''}`}
      style={{
        position: 'relative',
        borderLeft: slot ? `3px solid ${color}` : undefined,
        background: isTeacherSchedule && slot ? 'rgba(59, 130, 246, 0.04)' : undefined,
      }}
    >
      {slot ? (
        <>
          <span className="timetable-slot-subject" title={slot.subject}>
            {slot.subject}
          </span>
          {isTeacherSchedule ? (
            <span
              style={{
                display: 'inline-block',
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#2563eb',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                marginTop: '3px',
              }}
            >
              🏛️ Class {slot.classRoom}
            </span>
          ) : (
            <span className="timetable-slot-teacher">{slot.teacher}</span>
          )}

          {isPrincipal && (
            <button
              onClick={onDelete}
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '2px',
                opacity: 0,
                transition: 'opacity 0.15s',
              }}
              className="timetable-delete-btn"
              title="Delete this slot"
            >
              <Trash2 size={12} />
            </button>
          )}
        </>
      ) : (
        <span style={{ color: 'var(--text-muted)', fontSize: '11px', margin: 'auto' }}>
          {isTeacherSchedule ? 'Free Period' : '—'}
        </span>
      )}
    </div>
  );
}
