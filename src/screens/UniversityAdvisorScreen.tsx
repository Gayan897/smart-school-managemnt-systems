import { useState, useMemo } from 'react';
import {
  GraduationCap, BookOpen, BarChart2, ChevronRight, Info,
  Lock, Award, TrendingUp, School, Layers, Star, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { SL_UNIVERSITY_PATHWAYS, AL_STREAMS } from '../data/models';
import type { ALStream } from '../data/models';

// ─── Grade Ladder Data ────────────────────────────────────────────────────────
const GRADE_LEVELS = [
  {
    range: '1–5',
    label: 'Primary',
    labelSi: 'ප්‍රාථමික',
    labelTa: 'ஆரம்பம்',
    color: '#10b981',
    milestone: 'Grade 5 Scholarship (ශිෂ්‍යත්ව / புலமைப்பரிசில்)',
    description: 'Foundation: Sinhala / Tamil, English, Mathematics, Environment',
  },
  {
    range: '6–9',
    label: 'Junior Secondary',
    labelSi: 'කනිෂ්ඨ ද්විතීයික',
    labelTa: 'கீழ்நிலை இடைநிலை',
    color: '#0284c7',
    milestone: 'Continuous Assessment',
    description: 'Broad curriculum: 10 subjects including Science, History, ICT',
  },
  {
    range: '10–11',
    label: 'Senior Secondary (O/L)',
    labelSi: 'ජ්‍යෙෂ්ඨ — සා/පෙළ',
    labelTa: 'மேல்நிலை — O/L',
    color: '#d97706',
    milestone: 'G.C.E. O/L Exam (December)',
    description: '9 subjects — graded A/B/C/S/F. Minimum 6 passes needed for A/L admission.',
  },
  {
    range: '12–13',
    label: 'Collegiate (A/L)',
    labelSi: 'උසස් — උ/පෙළ',
    labelTa: 'கல்லூரி — A/L',
    color: '#7c3aed',
    milestone: 'G.C.E. A/L Exam (August) → Z-Score → UGC University Admission',
    description: '3 subjects + General English. Z-Score determines university admission.',
  },
];

const GRADING = [
  { grade: 'A', range: '75–100', color: '#059669', bg: 'rgba(5,150,105,0.12)', label: 'Distinction' },
  { grade: 'B', range: '65–74', color: '#0284c7', bg: 'rgba(2,132,199,0.12)', label: 'Merit' },
  { grade: 'C', range: '55–64', color: '#0891b2', bg: 'rgba(8,145,178,0.12)', label: 'Credit' },
  { grade: 'S', range: '35–54', color: '#d97706', bg: 'rgba(217,119,6,0.12)', label: 'Simple Pass' },
  { grade: 'F', range: '0–34',  color: '#dc2626', bg: 'rgba(220,38,38,0.12)', label: 'Fail' },
];

// ─── Competitiveness Helper ───────────────────────────────────────────────────
function getCompetitiveness(zScoreMin: number): { label: string; color: string; bg: string } {
  if (zScoreMin >= 1.5) return { label: 'Very High', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' };
  if (zScoreMin >= 1.0) return { label: 'High', color: '#d97706', bg: 'rgba(217,119,6,0.1)' };
  if (zScoreMin >= 0.5) return { label: 'Medium', color: '#0284c7', bg: 'rgba(2,132,199,0.1)' };
  return { label: 'Accessible', color: '#059669', bg: 'rgba(5,150,105,0.1)' };
}

// ─── Z-Score Bar ──────────────────────────────────────────────────────────────
function ZScoreBar({ min, max, color }: { min: number; max: number; color: string }) {
  // Normalize: max realistic Z-score is ~3.0
  const minPct = Math.min((min / 3.0) * 100, 100);
  const maxPct = Math.min((max / 3.0) * 100, 100);
  return (
    <div style={{ position: 'relative', height: '6px', background: 'var(--border)', borderRadius: '3px', marginTop: '6px' }}>
      <div style={{
        position: 'absolute',
        left: `${minPct}%`,
        width: `${maxPct - minPct}%`,
        height: '100%',
        background: color,
        borderRadius: '3px',
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

// ─── Tab 1: Z-Score Pathways ──────────────────────────────────────────────────
function ZScorePathwaysTab({ language }: { language: string }) {
  const [selectedStream, setSelectedStream] = useState<ALStream | 'all'>('all');

  const filtered = useMemo(() => {
    if (selectedStream === 'all') return SL_UNIVERSITY_PATHWAYS;
    return SL_UNIVERSITY_PATHWAYS.filter(p => p.stream === selectedStream);
  }, [selectedStream]);

  const streamMap = Object.fromEntries(AL_STREAMS.map(s => [s.id, s]));

  return (
    <div>
      {/* UGC Info Banner */}
      <div style={{
        padding: '14px 18px',
        borderRadius: 'var(--radius-sm)',
        background: 'linear-gradient(135deg, rgba(2,132,199,0.08), rgba(13,148,136,0.08))',
        border: '1px solid rgba(2,132,199,0.2)',
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        marginBottom: '20px',
      }}>
        <Info size={16} style={{ color: 'var(--primary-light)', flexShrink: 0, marginTop: '2px' }} />
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {t('ugcNote', language as any)}
        </p>
      </div>

      {/* Stream Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button
          onClick={() => setSelectedStream('all')}
          style={{
            padding: '6px 16px', borderRadius: '20px', border: '2px solid',
            borderColor: selectedStream === 'all' ? 'var(--primary)' : 'var(--border)',
            background: selectedStream === 'all' ? 'rgba(2,132,199,0.12)' : 'transparent',
            color: selectedStream === 'all' ? 'var(--primary-light)' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {t('allStreams', language as any)}
        </button>
        {AL_STREAMS.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedStream(s.id)}
            style={{
              padding: '6px 16px', borderRadius: '20px', border: '2px solid',
              borderColor: selectedStream === s.id ? s.color : 'var(--border)',
              background: selectedStream === s.id ? `${s.color}18` : 'transparent',
              color: selectedStream === s.id ? s.color : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {s.nameEn}
          </button>
        ))}
      </div>

      {/* Count */}
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Showing {filtered.length} degree programme{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Pathway Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
        {filtered.map((p, i) => {
          const streamInfo = streamMap[p.stream];
          const comp = getCompetitiveness(p.zScoreMin);
          return (
            <div
              key={i}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${streamInfo?.color ?? 'var(--border)'}30`,
                borderRadius: 'var(--radius)',
                padding: '16px',
                transition: 'transform 0.15s, box-shadow 0.15s',
                cursor: 'default',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${streamInfo?.color ?? '#000'}18`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              }}
            >
              {/* Top accent strip */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                background: streamInfo?.color ?? 'var(--primary)',
              }} />

              {/* Stream pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', marginTop: '4px' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: '12px', fontSize: '10px',
                  fontWeight: 700, letterSpacing: '0.4px',
                  background: `${streamInfo?.color ?? '#888'}18`,
                  color: streamInfo?.color ?? '#888',
                }}>
                  {streamInfo?.nameEn?.toUpperCase() ?? p.stream.toUpperCase()}
                </span>
                <span style={{
                  padding: '3px 8px', borderRadius: '10px', fontSize: '10px',
                  fontWeight: 600, background: comp.bg, color: comp.color,
                }}>
                  {comp.label}
                </span>
              </div>

              {/* Degree */}
              <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px', lineHeight: 1.3 }}>{p.degree}</h3>

              {/* University */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <School size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{p.university}</span>
              </div>

              {/* Faculty */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <Layers size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.faculty}</span>
              </div>

              {/* Z-Score */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {t('zScoreRange', language as any)}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: streamInfo?.color ?? 'var(--primary-light)' }}>
                    {p.zScoreMin.toFixed(1)} – {p.zScoreMax.toFixed(1)}
                  </span>
                </div>
                <ZScoreBar min={p.zScoreMin} max={p.zScoreMax} color={streamInfo?.color ?? 'var(--primary)'} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>0.0</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>3.0 (max)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab 2: School Structure ──────────────────────────────────────────────────
function SchoolStructureTab({ language }: { language: string }) {
  return (
    <div>
      {/* Grade Ladder */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ marginBottom: '20px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--primary-light)' }} />
            Sri Lanka National School Structure — Grades 1 to 13
          </h3>
        </div>
        <div style={{ position: 'relative' }}>
          {/* Vertical connector line */}
          <div style={{
            position: 'absolute', left: '23px', top: '24px', bottom: '24px',
            width: '2px', background: 'var(--border)',
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {GRADE_LEVELS.map((lvl, i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                {/* Circle */}
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                  background: `${lvl.color}18`, border: `2px solid ${lvl.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '13px', color: lvl.color, zIndex: 1,
                }}>
                  {lvl.range}
                </div>
                {/* Content */}
                <div style={{
                  flex: 1, background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px', border: `1px solid ${lvl.color}22`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{lvl.label}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {lvl.labelSi} / {lvl.labelTa}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
                    {lvl.description}
                  </p>
                  {lvl.milestone && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '4px 10px', borderRadius: '8px',
                      background: `${lvl.color}12`, border: `1px solid ${lvl.color}30`,
                    }}>
                      <Star size={11} style={{ color: lvl.color }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: lvl.color }}>{lvl.milestone}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* A/L Stream Subject Combinations */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} style={{ color: 'var(--primary-light)' }} />
            {t('alStreamSubjects', language as any)}
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {AL_STREAMS.map(s => (
            <div key={s.id} style={{
              padding: '14px', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${s.color}30`,
              background: `${s.color}06`,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '4px', bottom: 0,
                background: s.color, borderRadius: '0 0 0 4px',
              }} />
              <div style={{ marginLeft: '10px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: s.color, marginBottom: '4px' }}>
                  {s.nameEn}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  {s.nameSi} / {s.nameTa}
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  {s.subjects.map((sub, i) => (
                    <li key={i}>{sub}</li>
                  ))}
                </ul>
                <p style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grading System */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} style={{ color: '#f59e0b' }} />
            {t('gradingSystem', language as any)} (O/L & A/L)
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {GRADING.map(g => (
            <div key={g.grade} style={{
              flex: '1 1 130px', padding: '16px 12px', textAlign: 'center',
              borderRadius: 'var(--radius-sm)', background: g.bg,
              border: `2px solid ${g.color}40`,
            }}>
              <div style={{ fontSize: '28px', fontWeight: 900, color: g.color, lineHeight: 1 }}>{g.grade}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: g.color, marginTop: '4px' }}>{g.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{g.range}%</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          🏫 <strong>National Schools</strong> (e.g. Royal, Zahira, Visakha) follow the same syllabus but typically have higher cut-off scores for A/L stream selection.
          Provincial schools follow the same national exam structure.
        </p>
      </div>
    </div>
  );
}

// ─── Tab 3: Readiness Report (Principal Only) ────────────────────────────────
function ReadinessReportTab({ language, isPrincipal }: { language: string; isPrincipal: boolean }) {
  if (!isPrincipal) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '60px 20px', textAlign: 'center',
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'rgba(124,58,237,0.1)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
        }}>
          <Lock size={32} style={{ color: '#7c3aed' }} />
        </div>
        <h3 style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>Principal Access Only</h3>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '360px', lineHeight: 1.6 }}>
          {t('principalOnlyTab', language as any)}
        </p>
      </div>
    );
  }

  // ── Stream readiness summary (demo data — in real app, computed from Firebase marks) ──
  const streamSummary = [
    { stream: AL_STREAMS[0], eligible: 18, borderline: 9, total: 45 },
    { stream: AL_STREAMS[1], eligible: 22, borderline: 7, total: 45 },
    { stream: AL_STREAMS[2], eligible: 30, borderline: 10, total: 45 },
    { stream: AL_STREAMS[3], eligible: 20, borderline: 8, total: 45 },
    { stream: AL_STREAMS[4], eligible: 35, borderline: 5, total: 45 },
  ];

  // Top projected Z-score achievers (demo)
  const topAchievers = [
    { name: 'Kasun Perera', classRoom: '11A', projectedZ: 2.1, stream: 'Physical Science (Maths)' },
    { name: 'Amaya Silva', classRoom: '11B', projectedZ: 1.9, stream: 'Bio Science' },
    { name: 'Dinusha Fernando', classRoom: '11A', projectedZ: 1.7, stream: 'Bio Science' },
    { name: 'Thilina Bandara', classRoom: '11C', projectedZ: 1.5, stream: 'Physical Science (Maths)' },
    { name: 'Sathya Kumari', classRoom: '11B', projectedZ: 1.4, stream: 'Bio Science' },
  ];

  return (
    <div>
      {/* Warning banner */}
      <div style={{
        padding: '12px 16px', borderRadius: 'var(--radius-sm)',
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
        display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px',
      }}>
        <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          This report uses <strong>current term 3 marks</strong> from your school's performance data to predict 
          A/L stream eligibility for Grade 11 students. Projections are estimates only.
        </p>
      </div>

      {/* Stream Readiness Cards */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} style={{ color: 'var(--primary-light)' }} />
            {t('streamReadiness', language as any)} — All Grade 11 Classes
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {streamSummary.map(({ stream, eligible, borderline, total }) => {
            const eligiblePct = Math.round((eligible / total) * 100);
            const borderlinePct = Math.round((borderline / total) * 100);
            return (
              <div key={stream.id} style={{
                padding: '16px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-hover)', border: `1px solid ${stream.color}25`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%', background: stream.color,
                  }} />
                  <span style={{ fontWeight: 700, fontSize: '14px', color: stream.color }}>{stream.nameEn}</span>
                </div>
                {/* Eligible bar */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('predictedEligible', language as any)}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>{eligible} / {total}</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px' }}>
                    <div style={{ width: `${eligiblePct}%`, height: '100%', background: '#059669', borderRadius: '3px' }} />
                  </div>
                </div>
                {/* Borderline bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Borderline</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#d97706' }}>{borderline} / {total}</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px' }}>
                    <div style={{ width: `${borderlinePct}%`, height: '100%', background: '#d97706', borderRadius: '3px' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Projected Z-Score Achievers */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} style={{ color: '#f59e0b' }} />
            Top Projected Z-Score Achievers — Grade 11
          </h3>
        </div>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Class</th>
                <th>Predicted A/L Stream</th>
                <th style={{ textAlign: 'center' }}>Projected Z-Score</th>
                <th style={{ textAlign: 'center' }}>Admission Prospect</th>
              </tr>
            </thead>
            <tbody>
              {topAchievers.map((s, i) => {
                const comp = getCompetitiveness(s.projectedZ - 0.5);
                return (
                  <tr key={i}>
                    <td>
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '50%',
                        background: i === 0 ? 'rgba(245,158,11,0.15)' : i === 1 ? 'rgba(156,163,175,0.15)' : 'rgba(180,83,9,0.15)',
                        color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : '#b45309',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '13px',
                      }}>
                        #{i + 1}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td><span className="badge badge-primary">{s.classRoom}</span></td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.stream}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--primary-light)' }}>
                        {s.projectedZ.toFixed(1)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '11px',
                        fontWeight: 700, background: comp.bg, color: comp.color,
                      }}>
                        {comp.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          * Projected Z-scores are estimated from current term average performance. Actual Z-scores depend on national performance distribution.
        </p>
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
type TabKey = 'zscore' | 'structure' | 'readiness';

export default function UniversityAdvisorScreen() {
  const { user, language } = useAuth();
  const isPrincipal = user?.role === 'principal';
  const [activeTab, setActiveTab] = useState<TabKey>('zscore');

  const tabs: { key: TabKey; icon: React.ElementType; label: string; principalOnly?: boolean }[] = [
    { key: 'zscore',     icon: GraduationCap, label: t('zScorePathways', language) },
    { key: 'structure',  icon: BookOpen,      label: t('schoolStructure', language) },
    { key: 'readiness',  icon: BarChart2,     label: t('readinessReport', language), principalOnly: true },
  ];

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GraduationCap size={24} style={{ color: 'var(--primary-light)' }} />
            {t('universityAdvisor', language)}
          </h1>
          <p className="page-subtitle">{t('universityAdvisorSubtitle', language)}</p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '20px',
          background: isPrincipal ? 'rgba(124,58,237,0.12)' : 'rgba(2,132,199,0.12)',
          color: isPrincipal ? '#7c3aed' : 'var(--primary-light)',
          fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <ChevronRight size={14} />
          {isPrincipal ? 'Principal View' : 'Teacher View'}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '24px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <tab.icon size={15} />
            {tab.label}
            {tab.principalOnly && !isPrincipal && (
              <Lock size={12} style={{ color: 'var(--text-muted)', marginLeft: '2px' }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'zscore'    && <ZScorePathwaysTab language={language} />}
      {activeTab === 'structure' && <SchoolStructureTab language={language} />}
      {activeTab === 'readiness' && <ReadinessReportTab language={language} isPrincipal={isPrincipal} />}
    </div>
  );
}
