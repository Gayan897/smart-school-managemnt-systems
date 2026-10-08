import { useState, useMemo } from 'react';
import {
  GraduationCap, BookOpen, BarChart2, ChevronRight, Info,
  Lock, Award, TrendingUp, School, Layers, Star, AlertTriangle,
  Search, Filter, MapPin, Briefcase, CheckCircle2, Check, Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { SL_UNIVERSITY_PATHWAYS, AL_STREAMS } from '../data/models';
import type { ALStream, UniversityPathway } from '../data/models';

// ─── Sri Lanka Administrative Districts ─────────────────────────────────────
const SL_DISTRICTS = [
  { id: 'colombo', name: 'Colombo (කොළඹ)', underprivileged: false },
  { id: 'gampaha', name: 'Gampaha (ගම්පහ)', underprivileged: false },
  { id: 'kalutara', name: 'Kalutara (කළුතර)', underprivileged: false },
  { id: 'kandy', name: 'Kandy (මහනුවර)', underprivileged: false },
  { id: 'matale', name: 'Matale (මාතලේ)', underprivileged: false },
  { id: 'nuwara_eliya', name: 'Nuwara Eliya (නුවරඑළිය)', underprivileged: true },
  { id: 'galle', name: 'Galle (ගාල්ල)', underprivileged: false },
  { id: 'matara', name: 'Matara (මාතර)', underprivileged: false },
  { id: 'hambantota', name: 'Hambantota (හම්බන්තොට)', underprivileged: true },
  { id: 'jaffna', name: 'Jaffna (යාපනය)', underprivileged: true },
  { id: 'kilinochchi', name: 'Kilinochchi (කිලිනොච්චිය)', underprivileged: true },
  { id: 'mannar', name: 'Mannar (මන්නාරම)', underprivileged: true },
  { id: 'vavuniya', name: 'Vavuniya (වවුනියාව)', underprivileged: true },
  { id: 'mullaitivu', name: 'Mullaitivu (මුලතිව්)', underprivileged: true },
  { id: 'batticaloa', name: 'Batticaloa (මඩකලපුව)', underprivileged: true },
  { id: 'ampara', name: 'Ampara (අම්පාර)', underprivileged: true },
  { id: 'trincomalee', name: 'Trincomalee (ත්‍රිකුණාමලය)', underprivileged: true },
  { id: 'kurunegala', name: 'Kurunegala (කුරුණෑගල)', underprivileged: false },
  { id: 'puttalam', name: 'Puttalam (පුත්තලම)', underprivileged: true },
  { id: 'anuradhapura', name: 'Anuradhapura (අනුරාධපුරය)', underprivileged: true },
  { id: 'polonnaruwa', name: 'Polonnaruwa (පොළොන්නරුව)', underprivileged: true },
  { id: 'badulla', name: 'Badulla (බදුල්ල)', underprivileged: true },
  { id: 'monaragala', name: 'Monaragala (මොණරාගල)', underprivileged: true },
  { id: 'ratnapura', name: 'Ratnapura (රත්නපුරය)', underprivileged: true },
  { id: 'kegalle', name: 'Kegalle (කෑගල්ල)', underprivileged: false },
];

// ─── Grade Ladder Data ────────────────────────────────────────────────────────
const GRADE_LEVELS = [
  {
    range: '1–5',
    label: 'Primary',
    labelSi: 'ප්‍රාථමික',
    labelTa: 'ஆரம்பம்',
    color: '#10b981',
    milestone: 'Grade 5 Scholarship (ශිෂ්‍යත්ව / புலமைப்பரிசில்)',
    description: 'Foundation: Mother Tongue (Sinhala/Tamil), English, Mathematics, Environmental Studies.',
  },
  {
    range: '6–9',
    label: 'Junior Secondary',
    labelSi: 'කනිෂ්ඨ ද්විතීයික',
    labelTa: 'கீழ்நிலை இடைநிலை',
    color: '#0284c7',
    milestone: 'Continuous School-Based Assessment (SBA)',
    description: 'Broad national curriculum: 10 core subjects including Science, History, Geography, Civics, and ICT.',
  },
  {
    range: '10–11',
    label: 'Senior Secondary (O/L)',
    labelSi: 'ජ්‍යෙෂ්ඨ — සා/පෙළ',
    labelTa: 'மேல்நிலை — O/L',
    color: '#d97706',
    milestone: 'G.C.E. O/L Examination (December / MoE)',
    description: '9 national subjects — graded A/B/C/S/F. Minimum 6 passes including Mother Tongue & Maths required for Collegiate (A/L) admission.',
  },
  {
    range: '12–13',
    label: 'Collegiate (A/L)',
    labelSi: 'උසස් — උ/පෙළ',
    labelTa: 'கல்லூரி — A/L',
    color: '#7c3aed',
    milestone: 'G.C.E. A/L Examination → Z-Score Calculation → UGC National University Selection',
    description: '3 selected stream subjects + Common General Test + General English. Standardized Z-Score determines government university admission.',
  },
];

const GRADING = [
  { grade: 'A', range: '75–100', color: '#059669', bg: 'rgba(5,150,105,0.12)', label: 'Distinction' },
  { grade: 'B', range: '65–74', color: '#0284c7', bg: 'rgba(2,132,199,0.12)', label: 'Merit' },
  { grade: 'C', range: '55–64', color: '#0891b2', bg: 'rgba(8,145,178,0.12)', label: 'Credit' },
  { grade: 'S', range: '35–54', color: '#d97706', bg: 'rgba(217,119,6,0.12)', label: 'Simple Pass' },
  { grade: 'F', range: '0–34',  color: '#dc2626', bg: 'rgba(220,38,38,0.12)', label: 'Fail' },
];

// ─── Sri Lanka State Universities Directory ──────────────────────────────────
const SL_UNIVERSITIES = [
  { name: 'University of Colombo', abbr: 'UOC', founded: '1921', location: 'Colombo', rank: 'Top Ranked', specialty: 'Medicine, Law, UCSC Computing, Science, Management' },
  { name: 'University of Peradeniya', abbr: 'UOP', founded: '1942', location: 'Peradeniya, Kandy', rank: 'Top Ranked', specialty: 'Engineering, Medicine, Dental, Agriculture, Veterinary Science' },
  { name: 'University of Moratuwa', abbr: 'UOM', founded: '1972', location: 'Moratuwa', rank: 'Engineering Hub', specialty: 'Engineering, Architecture, IT, AI & Data Science, Medicine' },
  { name: 'University of Sri Jayewardenepura', abbr: 'USJ', founded: '1959', location: 'Gangodawila, Nugegoda', rank: 'Management Leader', specialty: 'Management & Commerce, Medical Sciences, Technology, Computing, Applied Sciences' },
  { name: 'University of Kelaniya', abbr: 'UOK', founded: '1959', location: 'Kelaniya', rank: 'Commerce & Humanities', specialty: 'Commerce & Management, Medicine (Ragama), Computing, Humanities, Science' },
  { name: 'University of Ruhuna', abbr: 'UOR', founded: '1978', location: 'Matara & Galle', rank: 'Southern Hub', specialty: 'Medicine (Karapitiya), Engineering (Hapugala), Fisheries & Marine, Agriculture' },
  { name: 'University of Jaffna', abbr: 'UOJ', founded: '1974', location: 'Jaffna & Kilinochchi', rank: 'Northern Hub', specialty: 'Medicine, Engineering, Agriculture, Science, Law, Hindu Studies' },
  { name: 'Rajarata University of Sri Lanka', abbr: 'RUSL', founded: '1995', location: 'Mihintale, Anuradhapura', rank: 'North Central', specialty: 'Medicine & Allied Sciences, Applied Sciences, Management, Technology' },
  { name: 'Wayamba University of Sri Lanka', abbr: 'WUSL', founded: '1999', location: 'Kuliyapitiya & Makandura', rank: 'North Western', specialty: 'Medicine, Livestock & Fisheries, Food Science, Applied Sciences, Business' },
  { name: 'Sabaragamuwa University of Sri Lanka', abbr: 'SUSL', founded: '1995', location: 'Belihuloya & Ratnapura', rank: 'Sabaragamuwa', specialty: 'Medicine, Geomatics, Agricultural Sciences, Management, Computing' },
  { name: 'Eastern University, Sri Lanka', abbr: 'EUSL', founded: '1981', location: 'Vantharumoolai, Batticaloa', rank: 'Eastern Hub', specialty: 'Healthcare Sciences, Agriculture, Science, Commerce, Technology' },
  { name: 'South Eastern University of Sri Lanka', abbr: 'SEUSL', founded: '1995', location: 'Oluvil', rank: 'Southeastern', specialty: 'Engineering, Applied Sciences, Management & Commerce, Technology' },
  { name: 'Uva Wellassa University', abbr: 'UWU', founded: '2005', location: 'Passara Road, Badulla', rank: 'Value Addition Hub', specialty: 'Science & Technology, Animal Science, Mineral Resources, Computer Science' },
  { name: 'The Open University of Sri Lanka', abbr: 'OUSL', founded: '1980', location: 'Nawala, Nugegoda', rank: 'Distance Learning', specialty: 'Engineering Technology, Natural Sciences, Education, Management' },
  { name: 'University of the Visual and Performing Arts', abbr: 'UVPA', founded: '2005', location: 'Colombo 07', rank: 'Aesthetic Arts', specialty: 'Visual Arts, Music, Dance & Drama' },
  { name: 'Gampaha Wickramarachchi Univ of Indigenous Medicine', abbr: 'GWUIM', founded: '2021', location: 'Yakkala', rank: 'Indigenous Medicine', specialty: 'Ayurveda, Indigenous Medicine, Technology' },
  { name: 'University of Vavuniya', abbr: 'UOV', founded: '2021', location: 'Pambaimadu, Vavuniya', rank: 'Northern Vanni', specialty: 'Applied Science, Business Studies, Technological Studies' },
];

// ─── Competitiveness Helper ───────────────────────────────────────────────────
function getCompetitiveness(zScoreMin: number): { label: string; color: string; bg: string } {
  if (zScoreMin >= 1.5) return { label: 'Very High', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' };
  if (zScoreMin >= 1.0) return { label: 'High', color: '#d97706', bg: 'rgba(217,119,6,0.1)' };
  if (zScoreMin >= 0.5) return { label: 'Medium', color: '#0284c7', bg: 'rgba(2,132,199,0.1)' };
  return { label: 'Accessible', color: '#059669', bg: 'rgba(5,150,105,0.1)' };
}

// ─── Z-Score Bar Component ───────────────────────────────────────────────────
function ZScoreBar({ min, max, color }: { min: number; max: number; color: string }) {
  const minPct = Math.min((min / 3.0) * 100, 100);
  const maxPct = Math.min((max / 3.0) * 100, 100);
  return (
    <div style={{ position: 'relative', height: '6px', background: 'var(--border)', borderRadius: '3px', marginTop: '6px' }}>
      <div style={{
        position: 'absolute',
        left: `${minPct}%`,
        width: `${Math.max(4, maxPct - minPct)}%`,
        height: '100%',
        background: color,
        borderRadius: '3px',
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

// ─── Tab 1: Z-Score Pathways & Course Explorer ─────────────────────────────────
function ZScorePathwaysTab({ language }: { language: string }) {
  const [selectedStream, setSelectedStream] = useState<ALStream | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComp, setSelectedComp] = useState<string>('all');

  const streamMap = useMemo(() => Object.fromEntries(AL_STREAMS.map(s => [s.id, s])), []);

  const filtered = useMemo(() => {
    return SL_UNIVERSITY_PATHWAYS.filter(p => {
      if (selectedStream !== 'all' && p.stream !== selectedStream) return false;
      if (selectedComp !== 'all') {
        const comp = getCompetitiveness(p.zScoreMin).label.toLowerCase();
        if (comp !== selectedComp.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDegree = p.degree.toLowerCase().includes(q);
        const matchUni = p.university.toLowerCase().includes(q);
        const matchFaculty = p.faculty.toLowerCase().includes(q);
        const matchCareers = p.careerProspects?.some(c => c.toLowerCase().includes(q));
        if (!matchDegree && !matchUni && !matchFaculty && !matchCareers) return false;
      }
      return true;
    });
  }, [selectedStream, selectedComp, searchQuery]);

  return (
    <div>
      {/* UGC Official 2024/2025 Info & Quota Policy Banner */}
      <div style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius)',
        background: 'linear-gradient(135deg, rgba(2,132,199,0.08), rgba(13,148,136,0.08))',
        border: '1.5px solid rgba(2,132,199,0.22)',
        marginBottom: '22px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{
            background: 'var(--primary)',
            color: '#fff',
            borderRadius: '8px',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
          }}>
            <School size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--text-main)' }}>
                UGC Sri Lanka Undergraduate Admission Guidelines (2024/2025 Latest Edition)
              </span>
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 700, fontSize: '11px' }}>
                ✅ Official Benchmarks
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {t('ugcNote', language as any)}
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '10px',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(2,132,199,0.15)',
            }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-main)' }}>
                🏆 <strong>40% All-Island Merit Quota:</strong> Based purely on national Z-score ranking.
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-main)' }}>
                📍 <strong>55% District Quota:</strong> Allocated proportionally across 25 administrative districts.
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-main)' }}>
                🛡️ <strong>5% Underprivileged Quota:</strong> 16 educationally disadvantaged districts.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Stream Controls */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        marginBottom: '20px',
        background: 'var(--bg-card)',
        padding: '16px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
      }}>
        {/* Search bar */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by degree (e.g. Medicine, AI, Law), university, or career..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={15} style={{ color: 'var(--text-muted)' }} />
            <select
              value={selectedComp}
              onChange={e => setSelectedComp(e.target.value)}
              className="form-control"
              style={{ fontSize: '12px', height: '38px', minWidth: '150px' }}
            >
              <option value="all">All Competitiveness</option>
              <option value="very high">Very High (Z ≥ 1.5)</option>
              <option value="high">High (Z 1.0 – 1.49)</option>
              <option value="medium">Medium (Z 0.5 – 0.99)</option>
              <option value="accessible">Accessible (Z &lt; 0.5)</option>
            </select>
            {(searchQuery || selectedComp !== 'all' || selectedStream !== 'all') && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearchQuery(''); setSelectedComp('all'); setSelectedStream('all'); }}
                style={{ height: '38px', fontSize: '12px' }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Stream Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedStream('all')}
            style={{
              padding: '6px 16px', borderRadius: '20px', border: '2px solid',
              borderColor: selectedStream === 'all' ? 'var(--primary)' : 'var(--border)',
              background: selectedStream === 'all' ? 'rgba(2,132,199,0.12)' : 'transparent',
              color: selectedStream === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {t('allStreams', language as any)} ({SL_UNIVERSITY_PATHWAYS.length})
          </button>
          {AL_STREAMS.map(s => {
            const streamCount = SL_UNIVERSITY_PATHWAYS.filter(p => p.stream === s.id).length;
            const isSelected = selectedStream === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedStream(s.id)}
                style={{
                  padding: '6px 16px', borderRadius: '20px', border: '2px solid',
                  borderColor: isSelected ? s.color : 'var(--border)',
                  background: isSelected ? `${s.color}18` : 'transparent',
                  color: isSelected ? s.color : 'var(--text-secondary)',
                  fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', transition: 'all 0.2s',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                }}
              >
                <span>{s.nameEn}</span>
                <span style={{
                  fontSize: '11px',
                  background: isSelected ? s.color : 'var(--bg-hover)',
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 700,
                }}>
                  {streamCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Showing <strong>{filtered.length}</strong> university degree pathway{filtered.length !== 1 ? 's' : ''} across Sri Lankan state universities
        </p>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }} /> Very High (≥1.5)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706' }} /> High (1.0–1.49)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }} /> Medium (0.5–0.99)
          </span>
        </div>
      </div>

      {/* Pathway Cards Grid */}
      {filtered.length === 0 ? (
        <div className="card empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            No degree pathways found matching your filters. Try clearing search keywords or selecting another stream.
          </p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setSearchQuery(''); setSelectedComp('all'); setSelectedStream('all'); }}
            style={{ marginTop: '12px' }}
          >
            Show All Degrees
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '16px' }}>
          {filtered.map((p, i) => {
            const streamInfo = streamMap[p.stream];
            const comp = getCompetitiveness(p.zScoreMin);
            return (
              <div
                key={i}
                style={{
                  background: 'var(--bg-card)',
                  border: `1.5px solid ${streamInfo?.color ?? 'var(--border)'}28`,
                  borderRadius: 'var(--radius)',
                  padding: '18px',
                  transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 10px 24px ${streamInfo?.color ?? '#000'}15`;
                  (e.currentTarget as HTMLDivElement).style.borderColor = `${streamInfo?.color ?? 'var(--primary)'}60`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.03)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = `${streamInfo?.color ?? 'var(--border)'}28`;
                }}
              >
                {/* Accent strip */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                  background: streamInfo?.color ?? 'var(--primary)',
                }} />

                <div>
                  {/* Stream Pill & Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px', marginTop: '4px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '12px', fontSize: '10.5px',
                      fontWeight: 800, letterSpacing: '0.4px',
                      background: `${streamInfo?.color ?? '#888'}18`,
                      color: streamInfo?.color ?? '#888',
                    }}>
                      {streamInfo?.nameEn?.toUpperCase() ?? p.stream.toUpperCase()}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {p.durationYears && (
                        <span style={{
                          padding: '2px 7px', borderRadius: '6px', fontSize: '10px',
                          fontWeight: 600, background: 'var(--bg-hover)', color: 'var(--text-muted)',
                        }}>
                          {p.durationYears} Years {p.degreeType ? `(${p.degreeType})` : ''}
                        </span>
                      )}
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '10px',
                        fontWeight: 700, background: comp.bg, color: comp.color,
                      }}>
                        {comp.label}
                      </span>
                    </div>
                  </div>

                  {/* Degree Title */}
                  <h3 style={{ fontWeight: 800, fontSize: '15.5px', marginBottom: '6px', lineHeight: 1.3, color: 'var(--text-main)' }}>
                    {p.degree}
                  </h3>

                  {/* University */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <School size={13} style={{ color: streamInfo?.color ?? 'var(--primary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {p.university}
                    </span>
                  </div>

                  {/* Faculty */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <Layers size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {p.faculty}
                    </span>
                  </div>

                  {/* District / Quota note */}
                  {p.district && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <MapPin size={11} style={{ color: '#0284c7' }} />
                      <span>{p.district}</span>
                    </div>
                  )}

                  {/* Prerequisites */}
                  {p.minPrerequisites && (
                    <div style={{
                      background: 'var(--bg-hover)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      marginBottom: '10px',
                      lineHeight: 1.4,
                      border: '1px solid var(--border)',
                    }}>
                      🔑 <strong>Prerequisites:</strong> {p.minPrerequisites}
                    </div>
                  )}

                  {/* Career prospects */}
                  {p.careerProspects && p.careerProspects.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                      {p.careerProspects.slice(0, 3).map((career, ci) => (
                        <span key={ci} style={{
                          fontSize: '10.5px',
                          background: 'rgba(99, 102, 241, 0.08)',
                          color: '#4f46e5',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontWeight: 500,
                        }}>
                          💼 {career}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Z-Score Bar & Metrics */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {t('zScoreRange', language as any)} (Cutoff):
                    </span>
                    <span style={{ fontSize: '14.5px', fontWeight: 800, color: streamInfo?.color ?? 'var(--primary)' }}>
                      {p.zScoreMin.toFixed(2)} – {p.zScoreMax.toFixed(2)}
                    </span>
                  </div>
                  <ZScoreBar min={p.zScoreMin} max={p.zScoreMax} color={streamInfo?.color ?? 'var(--primary)'} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>0.0</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>Min Cutoff: {p.zScoreMin.toFixed(2)}</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>3.0 (max)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Interactive Z-Score Advisor & Eligibility Checker ────────────────
function ZScoreAdvisorCalculatorTab({ language }: { language: string }) {
  const [inputZScore, setInputZScore] = useState<string>('1.65');
  const [selectedStream, setSelectedStream] = useState<ALStream>('mathsScience');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('colombo');
  const [filterType, setFilterType] = useState<'all' | 'eligible' | 'competitive'>('all');

  const parsedZ = parseFloat(inputZScore) || 0;
  const isUnderprivileged = SL_DISTRICTS.find(d => d.id === selectedDistrict)?.underprivileged;
  const streamMap = useMemo(() => Object.fromEntries(AL_STREAMS.map(s => [s.id, s])), []);

  // Filter pathways by stream and evaluate eligibility
  const streamPathways = useMemo(() => {
    return SL_UNIVERSITY_PATHWAYS.filter(p => p.stream === selectedStream);
  }, [selectedStream]);

  const evaluated = useMemo(() => {
    return streamPathways.map(p => {
      // Underprivileged districts enjoy a slight quota allowance margin (approx 0.08)
      const districtAllowance = isUnderprivileged ? 0.08 : 0.0;
      const effectiveCutoff = Math.max(0, p.zScoreMin - districtAllowance);
      const diff = parsedZ - effectiveCutoff;

      let status: 'eligible' | 'competitive' | 'reach';
      if (diff >= 0.05) {
        status = 'eligible';
      } else if (diff >= -0.05) {
        status = 'competitive';
      } else {
        status = 'reach';
      }

      return {
        pathway: p,
        effectiveCutoff,
        diff,
        status,
      };
    });
  }, [streamPathways, parsedZ, isUnderprivileged]);

  const eligibleList = evaluated.filter(e => e.status === 'eligible');
  const competitiveList = evaluated.filter(e => e.status === 'competitive');
  const reachList = evaluated.filter(e => e.status === 'reach');

  const displayedList = useMemo(() => {
    if (filterType === 'eligible') return eligibleList;
    if (filterType === 'competitive') return competitiveList;
    return evaluated;
  }, [filterType, eligibleList, competitiveList, evaluated]);

  return (
    <div>
      {/* Intro Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(2,132,199,0.08))',
        border: '1px solid rgba(124,58,237,0.25)',
        borderRadius: 'var(--radius)',
        padding: '18px 22px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Sparkles size={20} color="#7c3aed" />
          <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            AI-Assisted University Z-Score Pathway Predictor
          </h2>
        </div>
        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Enter your student's or your own G.C.E. Advanced Level Z-Score, choose the A/L stream and administrative district. 
          The engine compares against UGC 2024/2025 cutoff benchmarks and factors in district quota advantages.
        </p>
      </div>

      {/* Input Controls Card */}
      <div className="card" style={{ marginBottom: '22px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Z-Score Input */}
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '13px' }}>
              🎯 Student Z-Score (e.g. 1.72):
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="3.2"
              value={inputZScore}
              onChange={e => setInputZScore(e.target.value)}
              className="form-control"
              style={{ fontSize: '16px', fontWeight: 800, padding: '8px 14px', height: '42px', color: 'var(--primary)' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Valid range: 0.0000 to ~3.0000
            </span>
          </div>

          {/* Stream Selector */}
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '13px' }}>
              📚 A/L Subject Stream:
            </label>
            <select
              value={selectedStream}
              onChange={e => setSelectedStream(e.target.value as ALStream)}
              className="form-control"
              style={{ fontSize: '13px', fontWeight: 600, padding: '8px 12px', height: '42px' }}
            >
              {AL_STREAMS.map(s => (
                <option key={s.id} value={s.id}>{s.nameEn}</option>
              ))}
            </select>
          </div>

          {/* District Selector */}
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '13px' }}>
              📍 Administrative District (Quota Basis):
            </label>
            <select
              value={selectedDistrict}
              onChange={e => setSelectedDistrict(e.target.value)}
              className="form-control"
              style={{ fontSize: '13px', fontWeight: 600, padding: '8px 12px', height: '42px' }}
            >
              {SL_DISTRICTS.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.underprivileged ? '★ (Underprivileged 5% Quota)' : ''}
                </option>
              ))}
            </select>
            {isUnderprivileged && (
              <span style={{ fontSize: '11px', color: '#059669', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                ★ Eligible for UGC Underprivileged District 5% Quota Consideration
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary Scoreboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        <div style={{
          padding: '16px', borderRadius: 'var(--radius)', background: 'rgba(5, 150, 105, 0.08)',
          border: '1.5px solid rgba(5, 150, 105, 0.25)', textAlign: 'center',
        }}>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#059669', lineHeight: 1 }}>{eligibleList.length}</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#059669', marginTop: '6px' }}>Safe / High Probability</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Z-Score comfortably above cutoff</div>
        </div>

        <div style={{
          padding: '16px', borderRadius: 'var(--radius)', background: 'rgba(217, 119, 6, 0.08)',
          border: '1.5px solid rgba(217, 119, 6, 0.25)', textAlign: 'center',
        }}>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#d97706', lineHeight: 1 }}>{competitiveList.length}</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#d97706', marginTop: '6px' }}>Competitive / Target</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Within ±0.05 district cutoff</div>
        </div>

        <div style={{
          padding: '16px', borderRadius: 'var(--radius)', background: 'rgba(124, 58, 237, 0.08)',
          border: '1.5px solid rgba(124, 58, 237, 0.25)', textAlign: 'center',
        }}>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#7c3aed', lineHeight: 1 }}>{reachList.length}</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#7c3aed', marginTop: '6px' }}>Reach / Stretch Goals</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Cutoff higher than current score</div>
        </div>
      </div>

      {/* Filter Tabs for Results */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterType('all')}
          className={`btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
        >
          All {streamMap[selectedStream]?.nameEn} Programs ({evaluated.length})
        </button>
        <button
          onClick={() => setFilterType('eligible')}
          className={`btn btn-sm ${filterType === 'eligible' ? 'btn-success' : 'btn-secondary'}`}
        >
          Safe Matches ({eligibleList.length})
        </button>
        <button
          onClick={() => setFilterType('competitive')}
          className={`btn btn-sm ${filterType === 'competitive' ? 'btn-warning' : 'btn-secondary'}`}
        >
          Competitive Matches ({competitiveList.length})
        </button>
      </div>

      {/* Evaluated Courses Table */}
      <div className="card">
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Degree Course</th>
                <th>University &amp; Faculty</th>
                <th style={{ textAlign: 'center' }}>Cutoff</th>
                <th style={{ textAlign: 'center' }}>Margin (Δ)</th>
                <th>Admission Prospect</th>
                <th>Career Outlook</th>
              </tr>
            </thead>
            <tbody>
              {displayedList.map(({ pathway: p, status, effectiveCutoff, diff }) => {
                const streamInfo = streamMap[p.stream];
                const badgeColor =
                  status === 'eligible' ? { bg: 'rgba(5, 150, 105, 0.12)', color: '#059669', label: '🟢 Safe / High Probability' } :
                  status === 'competitive' ? { bg: 'rgba(217, 119, 6, 0.12)', color: '#d97706', label: '🟡 Competitive / Target' } :
                  { bg: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', label: '🟣 Stretch / Higher Z-Score' };

                return (
                  <tr key={p.degree + p.university}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>{p.degree}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {p.durationYears} Years {p.degreeType ? `• ${p.degreeType}` : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: streamInfo?.color ?? 'var(--primary)' }}>
                        {p.university}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.faculty}</div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                      {effectiveCutoff.toFixed(2)}
                      {isUnderprivileged && (
                        <div style={{ fontSize: '9.5px', color: '#059669' }}>Quota Adjusted</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: diff >= 0 ? '#059669' : '#dc2626' }}>
                      {diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                    </td>
                    <td>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: badgeColor.bg,
                        color: badgeColor.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        {badgeColor.label}
                      </span>
                    </td>
                    <td style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      {p.careerProspects ? p.careerProspects.slice(0, 2).join(', ') : 'Academic / Industry'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: School Structure & Universities Directory ─────────────────────────
function SchoolStructureTab({ language }: { language: string }) {
  return (
    <div>
      {/* Grade Ladder */}
      <div className="card" style={{ marginBottom: '22px' }}>
        <div className="card-header" style={{ marginBottom: '20px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--primary-light)' }} />
            Sri Lanka National School Structure — Grades 1 to 13
          </h3>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', left: '23px', top: '24px', bottom: '24px',
            width: '2px', background: 'var(--border)',
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {GRADE_LEVELS.map((lvl, i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                  background: `${lvl.color}18`, border: `2px solid ${lvl.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '13px', color: lvl.color, zIndex: 1,
                }}>
                  {lvl.range}
                </div>
                <div style={{
                  flex: 1, background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)',
                  padding: '14px 18px', border: `1px solid ${lvl.color}25`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--text-main)' }}>{lvl.label}</span>
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
                      <span style={{ fontSize: '11px', fontWeight: 700, color: lvl.color }}>{lvl.milestone}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* A/L Stream Subject Combinations */}
      <div className="card" style={{ marginBottom: '22px' }}>
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} style={{ color: 'var(--primary-light)' }} />
            {t('alStreamSubjects', language as any)} (Curriculum Guidelines)
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {AL_STREAMS.map(s => (
            <div key={s.id} style={{
              padding: '16px', borderRadius: 'var(--radius-sm)',
              border: `1.5px solid ${s.color}30`,
              background: `${s.color}06`,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '4px', bottom: 0,
                background: s.color, borderRadius: '0 0 0 4px',
              }} />
              <div style={{ marginLeft: '10px' }}>
                <div style={{ fontWeight: 800, fontSize: '14.5px', color: s.color, marginBottom: '4px' }}>
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
                <p style={{ marginTop: '10px', fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sri Lanka State Universities Directory */}
      <div className="card" style={{ marginBottom: '22px' }}>
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <School size={18} style={{ color: 'var(--primary)' }} />
            Sri Lanka State National Universities (UGC Recognized)
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px' }}>
          {SL_UNIVERSITIES.map(u => (
            <div key={u.abbr} style={{
              padding: '14px', borderRadius: '8px', background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>{u.name}</span>
                <span className="badge badge-primary" style={{ fontSize: '10px', padding: '1px 6px' }}>{u.abbr}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                📍 {u.location} • Est. {u.founded} • {u.rank}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <strong>Key Faculties:</strong> {u.specialty}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Official Grading Scale */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} style={{ color: '#f59e0b' }} />
            {t('gradingSystem', language as any)} (O/L &amp; A/L)
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
        <p style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
          🏫 <strong>UGC Entry Minimum:</strong> Candidates must obtain at least 3 Simple passes ('S') in one sitting of the G.C.E. A/L exam, and score minimum 30 in the Common General Test for university eligibility.
        </p>
      </div>
    </div>
  );
}

// ─── Tab 4: Readiness Report (Principal Access Only) ─────────────────────────
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

  const streamSummary = [
    { stream: AL_STREAMS[0], eligible: 18, borderline: 9, total: 45 },
    { stream: AL_STREAMS[1], eligible: 22, borderline: 7, total: 45 },
    { stream: AL_STREAMS[2], eligible: 30, borderline: 10, total: 45 },
    { stream: AL_STREAMS[3], eligible: 20, borderline: 8, total: 45 },
    { stream: AL_STREAMS[4], eligible: 35, borderline: 5, total: 45 },
  ];

  const topAchievers = [
    { name: 'Kasun Perera', classRoom: '11A', projectedZ: 2.1, stream: 'Physical Science (Maths)', prospect: 'High (Engineering)' },
    { name: 'Amaya Silva', classRoom: '11B', projectedZ: 1.9, stream: 'Bio Science', prospect: 'High (Medicine)' },
    { name: 'Dinusha Fernando', classRoom: '11A', projectedZ: 1.7, stream: 'Bio Science', prospect: 'High (Dentistry/Pharmacy)' },
    { name: 'Thilina Bandara', classRoom: '11C', projectedZ: 1.5, stream: 'Physical Science (Maths)', prospect: 'Medium (Computer Science)' },
    { name: 'Sathya Kumari', classRoom: '11B', projectedZ: 1.4, stream: 'Commerce', prospect: 'High (Accountancy)' },
  ];

  return (
    <div>
      <div style={{
        padding: '14px 18px', borderRadius: 'var(--radius-sm)',
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
        display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px',
      }}>
        <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          This report uses <strong>current term performance marks</strong> from your school's database to model
          A/L stream eligibility and projected Z-scores for Grade 11 &amp; Grade 12 students.
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
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
            Top Projected Z-Score Achievers — Grade 11 Cohort
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
                const comp = getCompetitiveness(s.projectedZ - 0.4);
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
                        {s.projectedZ.toFixed(2)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '11px',
                        fontWeight: 700, background: comp.bg, color: comp.color,
                      }}>
                        {s.prospect}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main University Advisor Screen ──────────────────────────────────────────
type TabKey = 'zscore' | 'calculator' | 'structure' | 'readiness';

export default function UniversityAdvisorScreen() {
  const { user, language } = useAuth();
  const isPrincipal = user?.role === 'principal';
  const [activeTab, setActiveTab] = useState<TabKey>('zscore');

  const tabs: { key: TabKey; icon: React.ElementType; label: string; principalOnly?: boolean }[] = [
    { key: 'zscore',     icon: GraduationCap, label: t('zScorePathways', language) },
    { key: 'calculator', icon: TrendingUp,    label: t('zScoreCalculator', language) },
    { key: 'structure',  icon: BookOpen,      label: t('schoolStructure', language) },
    { key: 'readiness',  icon: BarChart2,     label: t('readinessReport', language), principalOnly: true },
  ];

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GraduationCap size={24} style={{ color: 'var(--primary)' }} />
            {t('universityAdvisor', language)}
          </h1>
          <p className="page-subtitle">{t('universityAdvisorSubtitle', language)}</p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '20px',
          background: isPrincipal ? 'rgba(124,58,237,0.12)' : 'rgba(2,132,199,0.12)',
          color: isPrincipal ? '#7c3aed' : 'var(--primary)',
          fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
          border: `1px solid ${isPrincipal ? 'rgba(124,58,237,0.3)' : 'rgba(2,132,199,0.3)'}`,
        }}>
          <ChevronRight size={14} />
          {isPrincipal ? 'Principal Command View' : 'Academic View'}
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
      {activeTab === 'zscore'     && <ZScorePathwaysTab language={language} />}
      {activeTab === 'calculator' && <ZScoreAdvisorCalculatorTab language={language} />}
      {activeTab === 'structure'  && <SchoolStructureTab language={language} />}
      {activeTab === 'readiness'  && <ReadinessReportTab language={language} isPrincipal={isPrincipal} />}
    </div>
  );
}
