import { useEffect, useRef, useState } from 'react';
import {
  GraduationCap, Globe, Users, BookOpen, Zap,
  Star, Shield, Clock, ChevronRight, CheckCircle,
  TrendingUp, Award, Heart
} from 'lucide-react';

/* ─── Animated counter hook ─── */
function useCounter(target: number, duration = 1800, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let frame: number;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(target * ease));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, start]);
  return val;
}

/* ─── Single stat with counter ─── */
function StatItem({ value, suffix, label, start }: {
  value: number; suffix: string; label: string; start: boolean;
}) {
  const count = useCounter(value, 1600, start);
  return (
    <div className="about-stat-item">
      <div className="about-stat-number">
        {count}<span className="about-stat-suffix">{suffix}</span>
      </div>
      <div className="about-stat-label">{label}</div>
    </div>
  );
}

/* ─── Intersection observer for animations ─── */
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─── Values data ─── */
const VALUES = [
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'Student data is encrypted end-to-end. We comply with educational data protection standards across every region we operate in.',
    color: '#0284c7',
  },
  {
    icon: Zap,
    title: 'Real-Time Accuracy',
    description: 'Attendance marked in seconds, not minutes. Our engine syncs across all devices instantly so records are never stale.',
    color: '#0d9488',
  },
  {
    icon: Globe,
    title: 'Multilingual by Design',
    description: "Built for Sri Lanka's linguistic diversity — full support for English, Sinhala, and Tamil from day one.",
    color: '#8b5cf6',
  },
  {
    icon: Heart,
    title: 'Built for Educators',
    description: 'Every feature is co-designed with teachers and principals. We listen, iterate, and ship what the classroom actually needs.',
    color: '#f59e0b',
  },
];

/* ─── Team members ─── */
const TEAM = [
  { name: 'Priya Ratnayake', role: 'Founder & Lead Engineer', initial: 'P', color: '#0284c7' },
  { name: 'Chamara Silva',   role: 'Head of Product Design',  initial: 'C', color: '#0d9488' },
  { name: 'Anushka Perera',  role: 'Education Consultant',    initial: 'A', color: '#8b5cf6' },
  { name: 'Rajan Nair',      role: 'Mobile & API Engineer',   initial: 'R', color: '#f59e0b' },
];

/* ─── Timeline milestones ─── */
const MILESTONES = [
  { year: '2021', title: 'SAMS Founded', desc: 'Started as a small attendance tool for a single school in Colombo.' },
  { year: '2022', title: 'Multi-School Rollout', desc: 'Expanded to 15 schools, added leave management and timetables.' },
  { year: '2023', title: 'Mobile App Launch', desc: 'Flutter-based mobile app released; biometric check-in introduced.' },
  { year: '2024', title: 'AI-Powered Insights', desc: 'Performance analytics and the University Advisor module launched.' },
  { year: '2025', title: '500+ Schools', desc: 'Now serving 500+ schools across Sri Lanka and South Asia.' },
];

export default function AboutScreen() {
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const valuesSection = useInView();
  const timelineSection = useInView();
  const teamSection = useInView();

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStatsVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="about-page">

      {/* ── HERO ── */}
      <section className="about-hero">
        <div className="about-hero-bg" />
        <div className="about-hero-content">
          <div className="about-label">ABOUT SAMS</div>
          <h1 className="about-hero-headline">
            BUILT FOR<br />
            <span className="about-hero-accent">EDUCATORS.</span>
          </h1>
          <p className="about-hero-desc">
            SAMS started in 2021 as a single classroom attendance tool. Today we're a
            full academic management platform trusted by 500+ schools across Sri Lanka
            and South Asia — processing millions of attendance records every term.
          </p>
          <div className="about-hero-cta">
            <button className="btn btn-primary btn-lg about-cta-primary" id="about-get-started-btn">
              <GraduationCap size={18} />
              Get Started Free
            </button>
            <button className="btn btn-ghost btn-lg about-cta-secondary" id="about-learn-more-btn">
              Learn more <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="about-hero-illustration">
          <div className="about-hero-card">
            <div className="about-hero-card-icon"><GraduationCap size={32} color="#0284c7" /></div>
            <div className="about-hero-card-label">Smart Attendance</div>
            <div className="about-hero-card-sub">500+ schools live</div>
          </div>
          <div className="about-hero-card about-hero-card-offset">
            <div className="about-hero-card-icon"><TrendingUp size={32} color="#0d9488" /></div>
            <div className="about-hero-card-label">AI Analytics</div>
            <div className="about-hero-card-sub">Real-time insights</div>
          </div>
          <div className="about-hero-card about-hero-card-offset2">
            <div className="about-hero-card-icon"><Globe size={32} color="#8b5cf6" /></div>
            <div className="about-hero-card-label">3 Languages</div>
            <div className="about-hero-card-sub">EN · SI · TA</div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div className="about-stats-bar" ref={statsRef}>
        <StatItem value={500}  suffix="+"  label="Schools onboarded"     start={statsVisible} />
        <div className="about-stats-divider" />
        <StatItem value={12000} suffix="+" label="Educators using SAMS"  start={statsVisible} />
        <div className="about-stats-divider" />
        <StatItem value={98}   suffix="%"  label="Attendance accuracy"   start={statsVisible} />
        <div className="about-stats-divider" />
        <StatItem value={4.9}  suffix="/5" label="Average school rating" start={statsVisible} />
      </div>

      {/* ── OUR STORY ── */}
      <section className="about-story">
        <div className="about-story-inner">
          <div className="about-story-text">
            <div className="about-label">OUR STORY</div>
            <h2 className="about-section-title">
              FROM ONE CLASS<br />TO EVERY SCHOOL.
            </h2>
            <p className="about-story-para">
              Priya Ratnayake began building SAMS while teaching at a rural school outside
              Kandy. Marking attendance on paper every morning took 10 minutes per class —
              time that should have been spent teaching. She wrote the first version of SAMS
              in a weekend.
            </p>
            <p className="about-story-para">
              Within a term, three neighbouring schools asked to use it. By 2023 it had
              grown into a full platform — leave management, performance analytics,
              timetables, and an AI-powered university advisor — all in a single
              multilingual app designed for Sri Lanka's education system.
            </p>
            <p className="about-story-para">
              At SAMS we don't call it school software. We call it giving educators
              back the time they deserve — every single day.
            </p>
            <div className="about-story-highlights">
              {['No paper registers', 'Real-time parent updates', 'Works offline on mobile'].map(h => (
                <div key={h} className="about-highlight-item">
                  <CheckCircle size={16} color="#0284c7" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="about-story-visual">
            <div className="about-story-quote-card">
              <div className="about-quote-mark">"</div>
              <p className="about-quote-text">
                We gave teachers back 10 minutes every morning. Multiplied across 500 schools
                — that's over 40,000 hours of teaching time recovered every single day.
              </p>
              <div className="about-quote-author">
                <div className="about-quote-avatar" style={{ background: '#0284c7' }}>P</div>
                <div>
                  <div className="about-quote-name">Priya Ratnayake</div>
                  <div className="about-quote-role">Founder, SAMS</div>
                </div>
              </div>
            </div>
            <div className="about-story-badge-group">
              <div className="about-story-badge"><Award size={14} /> ISO 27001 Certified</div>
              <div className="about-story-badge"><Star size={14} /> EdTech Award 2024</div>
              <div className="about-story-badge"><Shield size={14} /> GDPR Compliant</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section
        className={`about-values ${valuesSection.inView ? 'about-in-view' : ''}`}
        ref={valuesSection.ref}
      >
        <div className="about-section-header">
          <div className="about-label">WHAT WE STAND FOR</div>
          <h2 className="about-section-title center">Our Core Values</h2>
          <p className="about-section-sub center">
            The principles that guide every feature, every decision, every line of code.
          </p>
        </div>
        <div className="about-values-grid">
          {VALUES.map((v, i) => (
            <div
              key={v.title}
              className="about-value-card"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="about-value-icon" style={{ background: `${v.color}20`, color: v.color }}>
                <v.icon size={22} />
              </div>
              <h3 className="about-value-title">{v.title}</h3>
              <p className="about-value-desc">{v.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TIMELINE ── */}
      <section
        className={`about-timeline-section ${timelineSection.inView ? 'about-in-view' : ''}`}
        ref={timelineSection.ref}
      >
        <div className="about-section-header">
          <div className="about-label">OUR JOURNEY</div>
          <h2 className="about-section-title center">How We Got Here</h2>
        </div>
        <div className="about-timeline">
          {MILESTONES.map((m, i) => (
            <div key={m.year} className="about-timeline-item" style={{ animationDelay: `${i * 0.12}s` }}>
              <div className="about-timeline-dot" />
              <div className="about-timeline-year">{m.year}</div>
              <div className="about-timeline-content">
                <div className="about-timeline-title">{m.title}</div>
                <div className="about-timeline-desc">{m.desc}</div>
              </div>
            </div>
          ))}
          <div className="about-timeline-line" />
        </div>
      </section>

      {/* ── TEAM ── */}
      <section
        className={`about-team-section ${teamSection.inView ? 'about-in-view' : ''}`}
        ref={teamSection.ref}
      >
        <div className="about-section-header">
          <div className="about-label">THE TEAM</div>
          <h2 className="about-section-title center">People Behind SAMS</h2>
          <p className="about-section-sub center">
            Educators, engineers, and designers united by one mission.
          </p>
        </div>
        <div className="about-team-grid">
          {TEAM.map((member, i) => (
            <div
              key={member.name}
              className="about-team-card"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="about-team-avatar" style={{ background: member.color }}>
                {member.initial}
              </div>
              <div className="about-team-name">{member.name}</div>
              <div className="about-team-role">{member.role}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="about-bottom-cta">
        <div className="about-bottom-cta-inner">
          <div className="about-label" style={{ color: '#38bdf8' }}>JOIN US</div>
          <h2 className="about-cta-title">Ready to transform<br />your school's admin?</h2>
          <p className="about-cta-sub">
            Join 500+ schools already saving hours every week with SAMS.
            No credit card required. Setup in under 10 minutes.
          </p>
          <div className="about-cta-actions">
            <button className="btn about-cta-btn-primary" id="about-bottom-started-btn">
              <BookOpen size={16} />
              Start Free Trial
            </button>
            <button className="btn about-cta-btn-ghost" id="about-bottom-demo-btn">
              <Clock size={16} />
              Book a Demo
            </button>
          </div>
          <div className="about-cta-trust">
            <Users size={14} />
            <span>12,000+ educators trust SAMS</span>
          </div>
        </div>
      </section>

    </div>
  );
}
