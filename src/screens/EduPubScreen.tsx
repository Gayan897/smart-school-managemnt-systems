import { useState } from 'react';
import {
  ExternalLink, BookOpen, FileText, Download,
  Search, Calendar, Tag, Info, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';

interface EduNotice {
  id: string;
  refCode: string;
  title: string;
  category: 'Circular' | 'Textbook' | 'Syllabus' | 'Distribution';
  date: string;
  summary: string;
  pdfUrl: string;
  important?: boolean;
}

const OFFICIAL_NOTICES: EduNotice[] = [
  {
    id: 'n1',
    refCode: 'EDUPUB/2026/CIR-08',
    title: 'Distribution of Free School Textbooks for Academic Year 2026',
    category: 'Distribution',
    date: '2026-02-01',
    summary: 'Instructions for school principals regarding the final stage verification and distribution of Grade 1-13 textbooks issued by the Educational Publications Department.',
    pdfUrl: 'https://edupub.gov.lk',
    important: true,
  },
  {
    id: 'n2',
    refCode: 'EDUPUB/2026/TG-03',
    title: 'Revised Teacher Guides for O/L Science and Mathematics (New Curriculum)',
    category: 'Teacher Guide' as any,
    date: '2026-01-25',
    summary: 'Updated Digital Teacher Guides and Syllabus Specifications for Grade 10 & 11 Science, Mathematics, and ICT subjects available for immediate download.',
    pdfUrl: 'https://edupub.gov.lk',
    important: true,
  },
  {
    id: 'n3',
    refCode: 'EDUPUB/2026/CIR-02',
    title: 'Digital E-Textbooks Access Portal Instructions for School Libraries',
    category: 'Circular',
    date: '2026-01-18',
    summary: 'Guidelines for government school teachers and principals to access PDF e-textbooks via the official EduPub portal for smart classrooms.',
    pdfUrl: 'https://edupub.gov.lk',
  },
  {
    id: 'n4',
    refCode: 'EDUPUB/2025/SYL-12',
    title: 'G.C.E. Advanced Level Stream Syllabus Updates & Supplementary Reading Books',
    category: 'Syllabus',
    date: '2025-12-30',
    summary: 'Supplementary learning booklets and syllabus guidelines for Bio Science, Physical Science, Commerce, and Arts streams.',
    pdfUrl: 'https://edupub.gov.lk',
  },
  {
    id: 'n5',
    refCode: 'EDUPUB/2025/TEXT-09',
    title: 'Requisition & Surplus Textbook Return Procedure for Term 1',
    category: 'Distribution',
    date: '2025-12-15',
    summary: 'Procedural notice on returning unused surplus textbooks to zonal education offices and submitting supplementary textbook quotas.',
    pdfUrl: 'https://edupub.gov.lk',
  },
];

const E_TEXTBOOKS = [
  { grade: 'Grade 10', subject: 'Mathematics (Part I & II)', medium: 'Sinhala / Tamil / English', format: 'PDF (Official)' },
  { grade: 'Grade 10', subject: 'Science & Technology', medium: 'Sinhala / Tamil / English', format: 'PDF (Official)' },
  { grade: 'Grade 11', subject: 'Information & Communication Technology', medium: 'English / Sinhala', format: 'PDF (Official)' },
  { grade: 'Grade 11', subject: 'History & Civics', medium: 'Sinhala / Tamil / English', format: 'PDF (Official)' },
  { grade: 'Grade 12', subject: 'Combined Mathematics Teacher Guide', medium: 'English / Sinhala', format: 'PDF (Official)' },
  { grade: 'Grade 13', subject: 'Physics & Chemistry Lab Manuals', medium: 'English / Sinhala', format: 'PDF (Official)' },
];

export default function EduPubScreen() {
  const { language } = useAuth();
  const [activeTab, setActiveTab] = useState<'notices' | 'viewer' | 'textbooks'>('notices');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotice, setSelectedNotice] = useState<EduNotice | null>(null);

  const categories = ['All', 'Distribution', 'Circular', 'Syllabus', 'Teacher Guide'];

  const filteredNotices = OFFICIAL_NOTICES.filter(n => {
    const matchesCat = selectedCategory === 'All' || n.category === selectedCategory;
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          n.refCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          n.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('edupub', language)}</h1>
          <p className="page-subtitle">{t('edupubSubtitle', language)}</p>
        </div>
        <a
          href="https://edupub.gov.lk"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          <ExternalLink size={15} />
          {t('openEdupub', language)}
        </a>
      </div>

      {/* EduPub Banner / Portal Info */}
      <div className="card" style={{ marginBottom: '20px', background: 'linear-gradient(135deg, rgba(2,132,199,0.12) 0%, rgba(13,148,136,0.12) 100%)', border: '1px solid rgba(2,132,199,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge badge-primary">{t('officialWebsite', language)}</span>
              <span className="badge badge-success">Ministry of Education Sri Lanka</span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0' }}>
              Educational Publications Department Official Access
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '700px' }}>
              Access official school textbooks, teacher instructional guides, syllabus circulars, and departmental notifications directly from edupub.gov.lk.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className={`btn ${activeTab === 'notices' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('notices')}
            >
              <FileText size={15} />
              Notices & Circulars
            </button>
            <button
              className={`btn ${activeTab === 'viewer' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('viewer')}
            >
              <BookOpen size={15} />
              Web Viewer
            </button>
            <button
              className={`btn ${activeTab === 'textbooks' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('textbooks')}
            >
              <Download size={15} />
              E-Textbooks
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'notices' && (
        <>
          {/* Notice Filter Bar */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '38px' }}
                  placeholder="Search notices, circulars, reference codes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="form-control"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                >
                  {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Notices Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {filteredNotices.map(notice => (
              <div
                key={notice.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderLeft: notice.important ? '4px solid var(--primary)' : '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="badge badge-info" style={{ fontSize: '10px' }}>
                      <Tag size={10} style={{ marginRight: '4px' }} />
                      {notice.category}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} />
                      {notice.date}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {notice.refCode}
                  </div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', lineHeight: 1.4 }}>
                    {notice.title}
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {notice.summary}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => setSelectedNotice(notice)}
                  >
                    <Info size={13} />
                    View Details
                  </button>
                  <a
                    href="https://edupub.gov.lk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                  >
                    <ExternalLink size={13} />
                    Official Link
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Web Viewer Tab */}
      {activeTab === 'viewer' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '10px', fontFamily: 'monospace' }}>
                https://edupub.gov.lk
              </span>
            </div>
            <a
              href="https://edupub.gov.lk"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <ExternalLink size={13} />
              Open in New Window
            </a>
          </div>

          <div style={{ position: 'relative', minHeight: '600px', width: '100%', background: '#ffffff' }}>
            <iframe
              src="https://edupub.gov.lk"
              title="EduPub Official Website"
              style={{ width: '100%', height: '650px', border: 'none' }}
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </div>
      )}

      {/* E-Textbooks Tab */}
      {activeTab === 'textbooks' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">{t('textbookCatalog', language)}</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Official PDF E-Textbooks & Syllabus materials issued by EduPub
              </p>
            </div>
            <a
              href="https://edupub.gov.lk"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
            >
              <ExternalLink size={13} />
              EduPub Downloads Page
            </a>
          </div>

          <div className="table-wrapper" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Subject Title</th>
                  <th>Available Mediums</th>
                  <th>Format</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {E_TEXTBOOKS.map((tb, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{tb.grade}</td>
                    <td style={{ fontWeight: 500 }}>{tb.subject}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{tb.medium}</td>
                    <td><span className="badge badge-success">{tb.format}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <a
                        href="https://edupub.gov.lk"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        <Download size={13} />
                        Download PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notice Detail Modal */}
      {selectedNotice && (
        <div className="modal-overlay" onClick={() => setSelectedNotice(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span className="badge badge-info">{selectedNotice.category}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedNotice.refCode}</span>
            </div>
            <h2 className="modal-title" style={{ marginBottom: '12px' }}>{selectedNotice.title}</h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={13} /> Published Date: {selectedNotice.date}
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '20px' }}>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                {selectedNotice.summary}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '12px', color: 'var(--success)' }}>
              <CheckCircle2 size={16} /> Verified Official Notice from Educational Publications Department Sri Lanka
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedNotice(null)}>
                Close
              </button>
              <a
                href={selectedNotice.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <ExternalLink size={14} />
                Open Official Portal Notice
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
