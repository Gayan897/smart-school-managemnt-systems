import type {
  Teacher,
  TimetableSlot,
  LeaveRequest,
  ProxyAssignment,
  ProxyCandidate,
} from './models';

// Subject Affinity Clusters

export const SUBJECT_CLUSTERS: Record<string, string[]> = {
  maths: [
    'mathematics',
    'maths',
    'combined mathematics',
    'higher maths',
    'statistics',
    'applied maths',
  ],
  science: [
    'science',
    'biology',
    'chemistry',
    'physics',
    'agriculture',
    'agricultural science',
    'health & physical education',
    'health science',
  ],
  tech: [
    'ict',
    'information technology',
    'computer science',
    'engineering technology',
    'science for technology',
    'biosystems technology',
    'design & technology',
  ],
  commerce: [
    'commerce',
    'business studies',
    'accounting',
    'economics',
    'business statistics',
    'entrepreneurship',
  ],
  languages: [
    'english',
    'sinhala',
    'tamil',
    'french',
    'japanese',
    'english literature',
    'sinhala literature',
    'tamil literature',
  ],
  humanities: [
    'history',
    'geography',
    'civic education',
    'civics',
    'logic',
    'political science',
    'buddhism',
    'christianity',
    'islam',
    'hinduism',
    'art',
    'music',
    'dancing',
    'drama',
  ],
};

function normalizeSubject(subject: string): string {
  return (subject || '').trim().toLowerCase();
}

/**
 * Checks if two subjects belong to the same cluster or related clusters
 */
export function getSubjectAffinity(subjectA: string, subjectB: string): {
  isExact: boolean;
  isClusterMatch: boolean;
  isCrossClusterMatch: boolean;
  score: number;
  reason: string;
} {
  const a = normalizeSubject(subjectA);
  const b = normalizeSubject(subjectB);

  if (!a || !b) {
    return { isExact: false, isClusterMatch: false, isCrossClusterMatch: false, score: 10, reason: 'General substitution' };
  }

  // Exact or near-exact match
  if (a === b || a.includes(b) || b.includes(a)) {
    return {
      isExact: true,
      isClusterMatch: true,
      isCrossClusterMatch: false,
      score: 45,
      reason: `Direct subject specialist (${subjectB})`,
    };
  }

  // Find clusters
  let clusterA: string | null = null;
  let clusterB: string | null = null;

  for (const [key, list] of Object.entries(SUBJECT_CLUSTERS)) {
    if (list.some(s => a.includes(s) || s.includes(a))) clusterA = key;
    if (list.some(s => b.includes(s) || s.includes(b))) clusterB = key;
  }

  if (clusterA && clusterB && clusterA === clusterB) {
    return {
      isExact: false,
      isClusterMatch: true,
      isCrossClusterMatch: false,
      score: 35,
      reason: `Same department cluster (${clusterA.toUpperCase()})`,
    };
  }

  // Cross-cluster affinities (Maths <-> Science, Tech <-> Maths, Tech <-> Science, Commerce <-> Maths)
  const crossAffinityPairs = [
    ['maths', 'science'],
    ['maths', 'tech'],
    ['science', 'tech'],
    ['commerce', 'maths'],
    ['humanities', 'languages'],
  ];

  if (clusterA && clusterB) {
    const isCross = crossAffinityPairs.some(
      ([c1, c2]) => (clusterA === c1 && clusterB === c2) || (clusterA === c2 && clusterB === c1)
    );
    if (isCross) {
      return {
        isExact: false,
        isClusterMatch: false,
        isCrossClusterMatch: true,
        score: 25,
        reason: `Related stream affinity (${clusterB.toUpperCase()} ↔ ${clusterA.toUpperCase()})`,
      };
    }
  }

  return {
    isExact: false,
    isClusterMatch: false,
    isCrossClusterMatch: false,
    score: 12,
    reason: 'General subject coverage',
  };
}

/**
 * Determines Day of Week number (1 = Mon ... 5 = Fri) from YYYY-MM-DD
 */
export function getDayOfWeekFromDate(dateStr: string): number {
  const date = new Date(dateStr);
  const jsDay = date.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  if (jsDay === 0 || jsDay === 6) return 1; // Default to Monday for weekends in mock
  return jsDay;
}

export interface SmartAllocationParams {
  date: string; // YYYY-MM-DD
  dayOfWeek: number;
  period: number;
  classRoom: string;
  originalSubject: string;
  absentTeacherId: string;
  absentTeacherName: string;
  allTeachers: Teacher[];
  timetable: TimetableSlot[];
  allProxyAssignments: ProxyAssignment[];
  allLeaveRequests: LeaveRequest[];
}

/**
 * Calculates candidate compatibility and returns ranked candidate recommendations
 */
export function rankProxyCandidates(params: SmartAllocationParams): ProxyCandidate[] {
  const {
    date,
    dayOfWeek,
    period,
    classRoom,
    originalSubject,
    absentTeacherId,
    absentTeacherName,
    allTeachers,
    timetable,
    allProxyAssignments,
    allLeaveRequests,
  } = params;

  // 1. Identify teachers who are on approved leave on this date
  const absentTeacherIds = new Set<string>();
  absentTeacherIds.add(absentTeacherId);

  for (const lr of allLeaveRequests) {
    if (lr.status === 'approved') {
      if (date >= lr.startDate && date <= lr.endDate) {
        absentTeacherIds.add(lr.teacherId);
      }
    }
  }

  // 2. Identify teachers who already have a timetable slot in this day & period
  const busyInTimetableTeacherNames = new Set<string>();
  const timetableSlotsInPeriod = timetable.filter(
    s => s.dayOfWeek === dayOfWeek && s.period === period
  );
  timetableSlotsInPeriod.forEach(s => {
    busyInTimetableTeacherNames.add(normalizeSubject(s.teacher));
  });

  // 3. Identify teachers who already have a proxy assigned for this date & period
  const busyInProxyTeacherIds = new Set<string>();
  allProxyAssignments
    .filter(p => p.date === date && p.period === period && p.status !== 'declined')
    .forEach(p => {
      busyInProxyTeacherIds.add(p.substituteTeacherId);
    });

  // 4. Calculate weekly proxy load for all teachers (for fairness / workload balancing)
  // Determine start and end of week for current date
  const currDate = new Date(date);
  const dayOffset = (currDate.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(currDate);
  monday.setDate(currDate.getDate() - dayOffset);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const mondayStr = monday.toISOString().slice(0, 10);
  const fridayStr = friday.toISOString().slice(0, 10);

  const weeklyProxyCounts: Record<string, number> = {};
  for (const p of allProxyAssignments) {
    if (p.date >= mondayStr && p.date <= fridayStr && p.status !== 'declined') {
      weeklyProxyCounts[p.substituteTeacherId] = (weeklyProxyCounts[p.substituteTeacherId] || 0) + 1;
    }
  }

  // 5. Calculate today's teaching load count for each teacher
  const todayTeachingLoads: Record<string, number> = {};
  timetable
    .filter(s => s.dayOfWeek === dayOfWeek)
    .forEach(s => {
      const norm = normalizeSubject(s.teacher);
      todayTeachingLoads[norm] = (todayTeachingLoads[norm] || 0) + 1;
    });

  // 6. Grade of the class (e.g. "10A" -> "10")
  const targetGradeMatch = classRoom.match(/\d+/);
  const targetGrade = targetGradeMatch ? targetGradeMatch[0] : '';

  // 7. Evaluate each teacher
  const candidates: ProxyCandidate[] = [];

  for (const teacher of allTeachers) {
    // Exclude absent / self
    if (teacher.id === absentTeacherId || absentTeacherIds.has(teacher.id)) {
      continue;
    }
    if (teacher.name.toLowerCase() === absentTeacherName.toLowerCase()) {
      continue;
    }

    const normTeacherName = normalizeSubject(teacher.name);

    // Check if free in this period
    const isBusyInTimetable = busyInTimetableTeacherNames.has(normTeacherName);
    const isBusyInProxy = busyInProxyTeacherIds.has(teacher.id);
    const isFree = !isBusyInTimetable && !isBusyInProxy;

    if (!isFree) {
      continue; // Only free candidates are eligible
    }

    // A. Subject Score (Max 45)
    const affinity = getSubjectAffinity(originalSubject, teacher.subject || '');
    const subjectScore = affinity.score;

    // B. Workload Score (Max 35)
    const weeklyCount = weeklyProxyCounts[teacher.id] || 0;
    let workloadScore = 0;
    if (weeklyCount === 0) workloadScore += 25;
    else if (weeklyCount === 1) workloadScore += 18;
    else if (weeklyCount === 2) workloadScore += 10;
    else workloadScore += 3;

    const todayPeriods = todayTeachingLoads[normTeacherName] || 0;
    if (todayPeriods <= 2) workloadScore += 10;
    else if (todayPeriods <= 4) workloadScore += 6;
    else workloadScore += 2;

    // C. Grade & Familiarity Score (Max 20)
    let gradeScore = 5;
    if (teacher.classRoom) {
      if (teacher.classRoom === classRoom) {
        gradeScore = 20; // Homeroom teacher of this class
      } else if (targetGrade && teacher.classRoom.startsWith(targetGrade)) {
        gradeScore = 15; // Teaches same grade (e.g. 10B for 10A)
      } else {
        gradeScore = 8;
      }
    }

    // Check if teacher already has classes in this classroom on other periods
    const teachesThisClass = timetable.some(
      s => s.classRoom === classRoom && normalizeSubject(s.teacher) === normTeacherName
    );
    if (teachesThisClass && gradeScore < 18) {
      gradeScore = 18;
    }

    // Total Match Score (Normalized to 100)
    const totalScore = Math.min(100, Math.round(subjectScore + workloadScore + gradeScore));

    // Construct human-readable reason
    const reasonParts: string[] = [];
    reasonParts.push(affinity.reason);
    if (weeklyCount === 0) {
      reasonParts.push('0 proxies this week (high fairness)');
    } else {
      reasonParts.push(`${weeklyCount} prior proxy duty`);
    }
    if (gradeScore >= 15) {
      reasonParts.push(`Grade ${targetGrade} familiarity`);
    }

    candidates.push({
      teacher,
      matchScore: totalScore,
      matchReason: reasonParts.join(' • '),
      subjectScore,
      workloadScore,
      gradeScore,
      weeklyProxyCount: weeklyCount,
      todayPeriodsCount: todayPeriods,
      isExactSubject: affinity.isExact,
      isRelatedSubject: affinity.isClusterMatch || affinity.isCrossClusterMatch,
      isFree: true,
    });
  }

  // Sort descending by match score
  return candidates.sort((a, b) => b.matchScore - a.matchScore);
}

export interface UncoveredPeriodSlot {
  dayOfWeek: number;
  period: number;
  classRoom: string;
  subject: string;
  absentTeacherId: string;
  absentTeacherName: string;
  lessonPlanNotes?: string;
  leaveRequestId?: string;
}

/**
 * Scans the entire timetable for all periods affected by a list of absent teachers on a given date.
 */
export function findAffectedPeriods(params: {
  date: string;
  dayOfWeek: number;
  absentTeachers: { id: string; name: string; lessonPlanNotes?: string; leaveRequestId?: string }[];
  timetable: TimetableSlot[];
  existingAssignments: ProxyAssignment[];
}): {
  uncoveredSlots: UncoveredPeriodSlot[];
  alreadyCoveredSlots: ProxyAssignment[];
} {
  const { date, dayOfWeek, absentTeachers, timetable, existingAssignments } = params;

  const uncoveredSlots: UncoveredPeriodSlot[] = [];
  const alreadyCoveredSlots = existingAssignments.filter(p => p.date === date);

  for (const absent of absentTeachers) {
    const normAbsentName = normalizeSubject(absent.name);

    // Find all timetable slots where this teacher is scheduled on this day of week
    const teacherSlots = timetable.filter(
      s => s.dayOfWeek === dayOfWeek && normalizeSubject(s.teacher) === normAbsentName
    );

    for (const slot of teacherSlots) {
      // Check if already covered by an active proxy
      const existing = alreadyCoveredSlots.find(
        p => p.period === slot.period && p.classRoom === slot.classRoom && p.status !== 'declined'
      );

      if (!existing) {
        uncoveredSlots.push({
          dayOfWeek,
          period: slot.period,
          classRoom: slot.classRoom,
          subject: slot.subject,
          absentTeacherId: absent.id,
          absentTeacherName: absent.name,
          lessonPlanNotes: absent.lessonPlanNotes,
          leaveRequestId: absent.leaveRequestId,
        });
      }
    }
  }

  // Sort by period ascending
  uncoveredSlots.sort((a, b) => a.period - b.period);
  return { uncoveredSlots, alreadyCoveredSlots };
}

/**
 * 1-Click AI Auto-Allocation Pipeline
 * Solves all uncovered periods in sequential optimal order, updating simulated state as it allocates.
 */
export function runAutoAllocationPipeline(params: {
  date: string;
  uncoveredSlots: UncoveredPeriodSlot[];
  allTeachers: Teacher[];
  timetable: TimetableSlot[];
  allProxyAssignments: ProxyAssignment[];
  allLeaveRequests: LeaveRequest[];
  assignedBy?: string;
}): {
  successAssignments: ProxyAssignment[];
  unsolvableSlots: UncoveredPeriodSlot[];
} {
  const {
    date,
    uncoveredSlots,
    allTeachers,
    timetable,
    allProxyAssignments,
    allLeaveRequests,
    assignedBy = 'AI Smart Engine',
  } = params;

  const successAssignments: ProxyAssignment[] = [];
  const unsolvableSlots: UncoveredPeriodSlot[] = [];

  // Working copy of proxy assignments to account for consecutive allocations
  let simulatedAssignments = [...allProxyAssignments];

  for (const slot of uncoveredSlots) {
    const candidates = rankProxyCandidates({
      date,
      dayOfWeek: slot.dayOfWeek,
      period: slot.period,
      classRoom: slot.classRoom,
      originalSubject: slot.subject,
      absentTeacherId: slot.absentTeacherId,
      absentTeacherName: slot.absentTeacherName,
      allTeachers,
      timetable,
      allProxyAssignments: simulatedAssignments,
      allLeaveRequests,
    });

    if (candidates.length > 0) {
      const best = candidates[0];
      const newAssignment: ProxyAssignment = {
        id: `proxy_${date.replace(/-/g, '')}_p${slot.period}_${slot.classRoom}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        date,
        dayOfWeek: slot.dayOfWeek,
        period: slot.period,
        classRoom: slot.classRoom,
        originalTeacherId: slot.absentTeacherId,
        originalTeacherName: slot.absentTeacherName,
        originalSubject: slot.subject,
        substituteTeacherId: best.teacher.id,
        substituteTeacherName: best.teacher.name,
        substituteTeacherSubject: best.teacher.subject || 'General',
        leaveRequestId: slot.leaveRequestId,
        status: 'assigned',
        lessonPlanNotes: slot.lessonPlanNotes || '',
        matchScore: best.matchScore,
        matchReason: best.matchReason,
        assignedAt: new Date().toISOString(),
        assignedBy,
      };

      successAssignments.push(newAssignment);
      simulatedAssignments.push(newAssignment);
    } else {
      unsolvableSlots.push(slot);
    }
  }

  return { successAssignments, unsolvableSlots };
}
