import { useState } from 'react';
import { BookOpen, CheckCircle2, Plus, X, GraduationCap, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { databaseService } from '../data/database';
import { SL_OL_8_SUBJECTS } from '../data/models';

// All available subjects a SL teacher can choose from
const ALL_SL_SUBJECTS = [
  // O/L Core subjects
  'Mathematics',
  'Science',
  'Sinhala Language & Literature',
  'Tamil Language & Literature',
  'English Language',
  'Religion (Buddhism)',
  'Religion (Christianity)',
  'Religion (Hinduism)',
  'Religion (Islam)',
  'History',
  'Commerce / Business Studies',
  'ICT / Information Technology',
  'Agriculture',
  'Aesthetic Studies / Art',
  'Health & Physical Education',
  // A/L Subjects
  'Combined Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Economics',
  'Accounting',
  'Business Studies',
  'Geography',
  'Political Science',
  'Logic',
  'Sinhala Literature',
  'Tamil Literature',
  'Engineering Technology',
  'Science for Technology',
  'Drawing',
  'General English',
  // Common
  'Civic Education',
  'Drama & Theatre',
  'Music',
  'Dancing',
];

export function TeacherSubjectSetupModal() {
  const { user, updateUserSession } = useAuth();
  const [mainSubject, setMainSubject] = useState('');
  const [otherSubjects, setOtherSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleOtherSubject(sub: string) {
    if (sub === mainSubject) return; // can't add main subject as "other"
    setOtherSubjects((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  }

  async function handleSave() {
    if (!mainSubject.trim()) {
      setError('Please select your main teaching subject.');
      return;
    }
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const updated = await databaseService.updateUserProfile(user.id, {
        subject: mainSubject,
        otherSubjects,
        subjectSetupComplete: true,
      });
      updateUserSession({ ...updated, subjectSetupComplete: true, subject: mainSubject, otherSubjects });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Subject color chip helper (uses SL subject colors if defined)
  function getSubjectColor(sub: string) {
    const match = SL_OL_8_SUBJECTS.find((s) => s.nameEn.toLowerCase() === sub.toLowerCase());
    return match?.color || null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          border: '1px solid var(--border)',
          animation: 'fadeInDown 0.35s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #0d9488 100%)',
            padding: '28px 28px 24px',
            borderRadius: '20px 20px 0 0',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}
            >
              <GraduationCap size={28} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>
                Welcome, {user?.name?.split(' ')[0] || 'Teacher'}! 👋
              </h2>
              <p style={{ margin: 0, fontSize: '13px', opacity: 0.85, marginTop: '3px' }}>
                Help your Principal prepare better timetables by setting up your subjects.
              </p>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '12px',
              marginTop: '8px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
            }}
          >
            <Sparkles size={14} style={{ marginTop: '1px', flexShrink: 0 }} />
            <span>
              Your subject information is used for smart timetable generation and substitute teacher allocation. 
              This only takes a moment — you can always update it later in your Profile.
            </span>
          </div>
        </div>

        <div style={{ padding: '24px 28px' }}>
          {/* Step 1: Main Subject */}
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
                fontSize: '15px',
                marginBottom: '12px',
                color: 'var(--text-primary)',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                1
              </div>
              Select Your Main Teaching Subject *
            </label>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {ALL_SL_SUBJECTS.map((sub) => {
                const color = getSubjectColor(sub);
                const isSelected = mainSubject === sub;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => {
                      setMainSubject(sub);
                      // Remove from other subjects if it was there
                      setOtherSubjects((prev) => prev.filter((s) => s !== sub));
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      border: isSelected
                        ? `2px solid ${color || 'var(--primary)'}`
                        : '1.5px solid var(--border)',
                      background: isSelected
                        ? (color || 'var(--primary)')
                        : 'var(--bg-hover)',
                      color: isSelected ? '#fff' : 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {isSelected && <CheckCircle2 size={12} />}
                    {sub}
                  </button>
                );
              })}
            </div>

            {mainSubject && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '13px',
                  color: '#10b981',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={16} />
                Main Subject: {mainSubject}
              </div>
            )}
          </div>

          {/* Step 2: Other Subjects */}
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
                fontSize: '15px',
                marginBottom: '4px',
                color: 'var(--text-primary)',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#0d9488',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                2
              </div>
              Other Subjects You Can Teach
              <span
                style={{
                  background: 'var(--bg-hover)',
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  color: 'var(--text-muted)',
                }}
              >
                Optional
              </span>
            </label>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', marginLeft: '32px' }}>
              Select any subjects you can take as a substitute teacher (besides your main subject).
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {ALL_SL_SUBJECTS.filter((s) => s !== mainSubject).map((sub) => {
                const isSelected = otherSubjects.includes(sub);
                const color = getSubjectColor(sub);
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => toggleOtherSubject(sub)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '20px',
                      border: isSelected
                        ? `1.5px solid ${color || '#0d9488'}`
                        : '1.5px solid var(--border)',
                      background: isSelected
                        ? `${color || '#0d9488'}22`
                        : 'transparent',
                      color: isSelected ? (color || '#0d9488') : 'var(--text-muted)',
                      fontSize: '12px',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {isSelected ? <X size={10} /> : <Plus size={10} />}
                    {sub}
                  </button>
                );
              })}
            </div>

            {otherSubjects.length > 0 && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(13, 148, 136, 0.08)',
                  border: '1px solid rgba(13, 148, 136, 0.3)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <BookOpen size={14} color="#0d9488" style={{ flexShrink: 0 }} />
                <span style={{ color: '#0d9488', fontWeight: 600 }}>Also can teach:</span>
                {otherSubjects.map((s) => (
                  <span
                    key={s}
                    style={{
                      background: '#0d9488',
                      color: '#fff',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !mainSubject}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: mainSubject
                ? 'linear-gradient(135deg, #4f46e5 0%, #0d9488 100%)'
                : 'var(--border)',
              color: mainSubject ? '#fff' : 'var(--text-muted)',
              fontSize: '15px',
              fontWeight: 700,
              cursor: mainSubject ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              boxShadow: mainSubject ? '0 6px 20px rgba(79, 70, 229, 0.35)' : 'none',
            }}
          >
            {saving ? (
              <span className="spinner" />
            ) : (
              <CheckCircle2 size={20} />
            )}
            {saving ? 'Saving...' : 'Save My Teaching Subjects & Continue'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
            You can update your subjects anytime from your Profile page.
          </p>
        </div>
      </div>
    </div>
  );
}
