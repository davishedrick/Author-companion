const STORAGE_KEY = "author-engine-mvp";
const STATE_API_ENDPOINT = "/api/state";
const DEFAULT_VIEW = "dashboard";
const PLOT_SECTION_IDS = ["characters", "locations", "glossary", "worldRules", "history", "mythology"];
const GOAL_DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const GOAL_DAY_LABELS = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun"
};
const PRIMARY_WORKSPACE_VIEWS = ["plot", "dashboard", "edit"];
const WORKSPACE_VIEWS = ["dashboard", "plot", "edit", "goals"];
const views = ["projects", "create-project", "dashboard", "plot", "edit", "goals", "sessions", "edit-project"];
const requiredImportColumns = [
  "row_type",
  "project_id",
  "project_title",
  "project_target_word_count",
  "project_current_word_count",
  "project_deadline",
  "project_daily_target",
  "project_start_date",
  "goal_id",
  "goal_type",
  "goal_title",
  "goal_target_value",
  "goal_created_at",
  "goal_tracking_mode",
  "goal_start_date",
  "goal_end_date",
  "goal_schedule_mode",
  "goal_monday_target",
  "goal_tuesday_target",
  "goal_wednesday_target",
  "goal_thursday_target",
  "goal_friday_target",
  "goal_saturday_target",
  "goal_sunday_target",
  "session_id",
  "session_date",
  "session_duration_minutes",
  "session_words_written",
  "session_words_edited",
  "session_notes"
];
const milestoneTargets = [5000, 10000, 25000, 50000, 75000, 100000];
const exportColumns = [
  "row_type",
  "project_id",
  "project_title",
  "project_target_word_count",
  "project_current_word_count",
  "project_deadline",
  "project_daily_target",
  "project_start_date",
  "project_edit_pass_name",
  "project_edit_pass_stage",
  "project_edit_pass_status",
  "project_edit_pass_objective",
  "project_edit_progress_current",
  "project_edit_progress_total",
  "goal_id",
  "goal_type",
  "goal_title",
  "goal_target_value",
  "goal_created_at",
  "goal_status",
  "goal_archived_at",
  "goal_tracking_mode",
  "goal_start_date",
  "goal_end_date",
  "goal_schedule_mode",
  "goal_monday_target",
  "goal_tuesday_target",
  "goal_wednesday_target",
  "goal_thursday_target",
  "goal_friday_target",
  "goal_saturday_target",
  "goal_sunday_target",
  "issue_id",
  "issue_title",
  "issue_type",
  "issue_section_label",
  "issue_priority",
  "issue_status",
  "issue_notes",
  "issue_created_at",
  "issue_resolved_at",
  "issue_pass_name",
  "session_id",
  "session_type",
  "session_date",
  "session_duration_minutes",
  "session_words_written",
  "session_words_edited",
  "session_pass_name",
  "session_section_label",
  "session_notes"
];

function defaultPassName(stage = "Developmental") {
  const labels = {
    Developmental: "Developmental Edit",
    Structural: "Structural Pass",
    "Line Edit": "Line Edit",
    Copyedit: "Copyedit",
    Proofread: "Proofread"
  };
  return labels[stage] || `${stage} Pass`;
}

function createDefaultEditingState() {
  return {
    passName: defaultPassName(),
    passStage: "Developmental",
    passStatus: "Not started",
    passObjective: "",
    progressCurrent: 0,
    progressTotal: 0
  };
}

function createDefaultPlotState() {
  return {
    activeSection: PLOT_SECTION_IDS[0],
    sections: Object.fromEntries(PLOT_SECTION_IDS.map((sectionId) => [sectionId, []]))
  };
}

function cloneValue(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const defaultProjectTemplate = {
  project: {
    bookTitle: "",
    targetWordCount: 80000,
    currentWordCount: 0,
    deadline: "",
    dailyTarget: 1000,
    projectStartDate: new Date().toISOString().slice(0, 10)
  },
  editing: createDefaultEditingState(),
  plot: createDefaultPlotState(),
  goals: [],
  sessions: [],
  issues: [],
  milestones: []
};

const defaultState = {
  projects: [],
  activeProjectId: null,
  themePreference: "light",
  sidebarCollapsed: false
};

let persistenceMode = "local";
let remoteSyncSuspended = false;
let pendingRemoteSnapshot = null;
let remoteSyncPromise = Promise.resolve();
let hasShownRemoteSyncWarning = false;
let state = loadState();
let activeView = loadActiveView();
let lastWorkspaceView = loadLastWorkspaceView();
let toastTimer = null;
let editingSessionId = null;
let editingEditSessionId = null;
let editingIssueId = null;
let heatmapMonthOffset = 0;
let selectedHeatmapDayKey = null;
let sessionDraftMinutes = 25;
let activeWritingSession = null;
let writingSessionInFocusMode = true;
let pendingCompletedSession = null;
let sessionTimerHandle = null;
let sessionsReturnView = "dashboard";

function isProjectWorkspaceView(view) {
  return WORKSPACE_VIEWS.includes(view);
}

function isPrimaryWorkspaceView(view) {
  return PRIMARY_WORKSPACE_VIEWS.includes(view);
}

function createProjectBundle(title, targetWordCount, currentWordCount, deadline) {
  return {
    id: createId(),
    project: {
      ...cloneValue(defaultProjectTemplate.project),
      bookTitle: title || "Untitled Manuscript",
      targetWordCount: number(targetWordCount) || 80000,
      currentWordCount: number(currentWordCount),
      deadline: deadline || "",
      dailyTarget: 1000,
      projectStartDate: new Date().toISOString().slice(0, 10)
    },
    editing: createDefaultEditingState(),
    plot: createDefaultPlotState(),
    goals: [],
    sessions: [],
    issues: [],
    milestones: []
  };
}

function readStoredSnapshot() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    return null;
  }
}

function normalizeLoadedState(snapshot) {
  if (!snapshot) return cloneValue(defaultState);

  if (Array.isArray(snapshot.projects)) {
    const normalizedProjects = snapshot.projects.map(normalizeProjectBundle);
    const hasStoredActiveId = normalizedProjects.some((project) => project.id === snapshot.activeProjectId);
    return {
      ...cloneValue(defaultState),
      ...snapshot,
      projects: normalizedProjects,
      activeProjectId: hasStoredActiveId
        ? snapshot.activeProjectId
        : normalizedProjects[0]?.id || null,
      themePreference: normalizeThemePreference(snapshot.themePreference),
      sidebarCollapsed: normalizeSidebarCollapsed(snapshot.sidebarCollapsed)
    };
  }

  if (snapshot.project) {
    const migrated = normalizeProjectBundle({
      id: createId(),
      project: snapshot.project,
      editing: snapshot.editing || createDefaultEditingState(),
      goals: snapshot.goals || [],
      sessions: snapshot.sessions || [],
      issues: snapshot.issues || [],
      milestones: snapshot.milestones || []
    });
    return {
      projects: [migrated],
      activeProjectId: migrated.id,
      themePreference: normalizeThemePreference(snapshot.themePreference),
      sidebarCollapsed: normalizeSidebarCollapsed(snapshot.sidebarCollapsed)
    };
  }

  return cloneValue(defaultState);
}

function normalizeStoredActiveView(snapshot, normalizedState = normalizeLoadedState(snapshot)) {
  const storedView = views.includes(snapshot?.activeView) ? snapshot.activeView : DEFAULT_VIEW;
  const hasProjects = normalizedState.projects.length > 0;
  if (!hasProjects) return DEFAULT_VIEW;
  return isProjectWorkspaceView(storedView) ? storedView : DEFAULT_VIEW;
}

function normalizeStoredLastWorkspaceView(snapshot) {
  if (PRIMARY_WORKSPACE_VIEWS.includes(snapshot?.lastWorkspaceView)) return snapshot.lastWorkspaceView;
  if (PRIMARY_WORKSPACE_VIEWS.includes(snapshot?.activeView)) return snapshot.activeView;
  return DEFAULT_VIEW;
}

function normalizeThemePreference(value) {
  return value === "dark" ? "dark" : "light";
}

function normalizeSidebarCollapsed(value) {
  return Boolean(value);
}

function normalizePersistedSnapshot(snapshot) {
  const normalizedState = normalizeLoadedState(snapshot);
  return {
    state: normalizedState,
    activeView: normalizeStoredActiveView(snapshot, normalizedState),
    lastWorkspaceView: normalizeStoredLastWorkspaceView(snapshot)
  };
}

function loadState() {
  return normalizeLoadedState(readStoredSnapshot());
}

function loadActiveView() {
  return normalizeStoredActiveView(readStoredSnapshot());
}

function loadLastWorkspaceView() {
  return normalizeStoredLastWorkspaceView(readStoredSnapshot());
}

function normalizeProjectBundle(bundle) {
  return {
    id: bundle.id || createId(),
    project: { ...cloneValue(defaultProjectTemplate.project), ...(bundle.project || {}) },
    editing: { ...createDefaultEditingState(), ...(bundle.editing || {}) },
    plot: normalizePlotState(bundle.plot),
    goals: Array.isArray(bundle.goals) ? bundle.goals.map(normalizeGoal) : [],
    sessions: Array.isArray(bundle.sessions) ? bundle.sessions.map(normalizeSession) : [],
    issues: Array.isArray(bundle.issues) ? bundle.issues.map(normalizeIssue) : [],
    milestones: Array.isArray(bundle.milestones) ? bundle.milestones : []
  };
}

function normalizeGoal(goal) {
  const status = goal?.status === "archived" ? "archived" : "active";
  const archivedAt = status === "archived"
    ? goal?.archivedAt || goal?.deletedAt || goal?.endedAt || new Date().toISOString()
    : "";
  const scheduleMode = goal?.scheduleMode === "custom_days" ? "custom_days" : "daily";
  const trackingMode = goal?.trackingMode === "date_range" ? "date_range" : "ongoing";
  const createdAt = goal?.createdAt || new Date().toISOString();
  const representativeTarget = Math.max(1, number(goal?.targetValue) || 1);
  const dayTargets = normalizeGoalDayTargets(goal, representativeTarget);

  return {
    id: goal?.id || createId(),
    type: goal?.type === "write_minutes" ? "write_minutes" : "write_words",
    title: String(goal?.title || ""),
    targetValue: representativeTarget,
    createdAt,
    status,
    archivedAt,
    trackingMode,
    startDate: normalizeGoalDateValue(goal?.startDate || toInputDate(createdAt)),
    endDate: trackingMode === "date_range" ? normalizeGoalDateValue(goal?.endDate || "") : "",
    scheduleMode,
    dayTargets
  };
}

function normalizeGoalDayTargets(goal, fallbackTargetValue = 1) {
  const fallbackTarget = Math.max(0, number(fallbackTargetValue));
  return GOAL_DAY_KEYS.reduce((targets, dayKey) => {
    const legacyFieldName = `${dayKey}Target`;
    const rowFieldName = `goal_${dayKey}_target`;
    const rawValue = goal?.dayTargets?.[dayKey]
      ?? goal?.[legacyFieldName]
      ?? goal?.[rowFieldName]
      ?? fallbackTarget;
    targets[dayKey] = Math.max(0, number(rawValue));
    return targets;
  }, {});
}

function normalizeGoalDateValue(value) {
  if (!value) return "";
  const normalized = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return toInputDate(normalized);
}

function normalizePlotState(plot) {
  const defaultPlot = createDefaultPlotState();
  const activeSection = PLOT_SECTION_IDS.includes(plot?.activeSection)
    ? plot.activeSection
    : defaultPlot.activeSection;
  const sections = Object.fromEntries(PLOT_SECTION_IDS.map((sectionId) => {
    const storedEntries = plot?.sections?.[sectionId] || plot?.[sectionId];
    return [sectionId, Array.isArray(storedEntries) ? storedEntries.map(normalizePlotEntry) : []];
  }));

  return {
    ...defaultPlot,
    ...plot,
    activeSection,
    sections
  };
}

function normalizePlotEntry(entry) {
  return {
    id: entry?.id || createId(),
    title: String(entry?.title || ""),
    summary: String(entry?.summary || ""),
    anchor: String(entry?.anchor || ""),
    detail: String(entry?.detail || ""),
    notes: String(entry?.notes || ""),
    updatedAt: entry?.updatedAt || new Date().toISOString()
  };
}

function normalizeSession(session) {
  return {
    id: session?.id || createId(),
    type: session?.type === "edit" ? "edit" : "write",
    date: session?.date || new Date().toISOString(),
    durationMinutes: number(session?.durationMinutes),
    wordsWritten: number(session?.wordsWritten),
    wordsEdited: number(session?.wordsEdited),
    notes: String(session?.notes || ""),
    passName: String(session?.passName || ""),
    sectionLabel: String(session?.sectionLabel || "")
  };
}

function normalizeIssue(issue) {
  const status = String(issue?.status || "Open");
  return {
    id: issue?.id || createId(),
    title: String(issue?.title || ""),
    type: String(issue?.type || "General"),
    sectionLabel: String(issue?.sectionLabel || issue?.section || ""),
    priority: String(issue?.priority || "Medium"),
    status,
    notes: String(issue?.notes || ""),
    createdAt: issue?.createdAt || new Date().toISOString(),
    resolvedAt: status === "Resolved" ? (issue?.resolvedAt || issue?.createdAt || new Date().toISOString()) : "",
    passName: String(issue?.passName || "")
  };
}

function serializeStateSnapshot() {
  if (isProjectWorkspaceView(activeView)) {
    lastWorkspaceView = activeView;
  }
  return {
    projects: cloneValue(state.projects),
    activeProjectId: state.activeProjectId,
    themePreference: normalizeThemePreference(state.themePreference),
    sidebarCollapsed: normalizeSidebarCollapsed(state.sidebarCollapsed),
    activeView,
    lastWorkspaceView
  };
}

function applyPersistedSnapshot(snapshot) {
  const normalized = normalizePersistedSnapshot(snapshot);
  state = normalized.state;
  activeView = normalized.activeView;
  lastWorkspaceView = normalized.lastWorkspaceView;
}

async function fetchRemoteState() {
  const response = await fetch(STATE_API_ENDPOINT, {
    headers: {
      Accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`State fetch failed with status ${response.status}`);
  }
  return response.json();
}

function handleRemoteSyncFailure(error) {
  persistenceMode = "local";
  pendingRemoteSnapshot = null;
  console.error("Falling back to local persistence.", error);
  if (!hasShownRemoteSyncWarning && typeof showToast === "function") {
    hasShownRemoteSyncWarning = true;
    showToast("Cloud sync paused", "Changes are being stored in this browser until the server is reachable again.");
  }
}

function queueRemoteStateSync() {
  if (persistenceMode !== "remote" || remoteSyncSuspended) return;
  pendingRemoteSnapshot = serializeStateSnapshot();
  remoteSyncPromise = remoteSyncPromise
    .then(async () => {
      if (!pendingRemoteSnapshot) return;
      const snapshot = pendingRemoteSnapshot;
      pendingRemoteSnapshot = null;
      const response = await fetch(STATE_API_ENDPOINT, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(snapshot)
      });
      if (!response.ok) {
        throw new Error(`State save failed with status ${response.status}`);
      }
    })
    .catch(handleRemoteSyncFailure);
}

function saveState() {
  const snapshot = serializeStateSnapshot();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  queueRemoteStateSync();
}

function preferredWorkspaceView() {
  return isPrimaryWorkspaceView(lastWorkspaceView) ? lastWorkspaceView : DEFAULT_VIEW;
}

function currentBundle() {
  return state.projects.find((project) => project.id === state.activeProjectId) || null;
}

function updateCurrentBundle(updater) {
  state.projects = state.projects.map((project) => {
    if (project.id !== state.activeProjectId) return project;
    const updated = updater(normalizeProjectBundle(project));
    return normalizeProjectBundle(updated);
  });
}

function number(value) {
  return Number(value) || 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Math.round(number(value)));
}

function formatHours(minutes) {
  return `${(number(minutes) / 60).toFixed(1)} hrs`;
}

function formatDate(dateString) {
  if (!dateString) return "No date";
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function toInputDate(dateString) {
  const fallback = new Date();
  const date = dateString ? new Date(dateString) : fallback;
  const safeDate = Number.isNaN(date.getTime()) ? fallback : date;
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function describeMinutes(minutes) {
  return `${formatNumber(minutes)} minute${number(minutes) === 1 ? "" : "s"}`;
}

function slugifyFilePart(value) {
  return String(value || "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

function dateKey(dateString) {
  return new Date(dateString).toISOString().slice(0, 10);
}

function getWriteSessions(bundle) {
  return bundle.sessions.filter((session) => session.type !== "edit");
}

function getEditSessions(bundle) {
  return bundle.sessions.filter((session) => session.type === "edit");
}

function getSessionGroups(bundle, filterFn = () => true) {
  const groups = new Map();
  bundle.sessions.filter(filterFn).forEach((session) => {
    const key = dateKey(session.date);
    if (!groups.has(key)) {
      groups.set(key, { words: 0, edited: 0, duration: 0, count: 0 });
    }
    const entry = groups.get(key);
    entry.words += number(session.wordsWritten);
    entry.edited += number(session.wordsEdited);
    entry.duration += number(session.durationMinutes);
    entry.count += 1;
  });
  return groups;
}

function getStats(bundle) {
  const writingSessions = getWriteSessions(bundle);
  const groups = getSessionGroups(bundle, (session) => session.type !== "edit");
  const sortedDays = [...groups.keys()].sort();
  const todayKey = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const weekStart = startOfDay(new Date(now));
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let wordsToday = 0;
  let wordsWeek = 0;
  let wordsMonth = 0;
  let totalWritten = 0;
  let totalEdited = 0;
  let totalDuration = 0;
  let bestDay = { key: "", words: 0 };
  const weekdayTotals = new Array(7).fill(0);
  writingSessions.forEach((session) => {
    const sessionDate = new Date(session.date);
    const dayKey = dateKey(session.date);
    const words = number(session.wordsWritten);
    const edited = number(session.wordsEdited);
    const duration = number(session.durationMinutes);
    totalWritten += words;
    totalEdited += edited;
    totalDuration += duration;
    weekdayTotals[sessionDate.getDay()] += words;
    if (dayKey === todayKey) wordsToday += words;
    if (startOfDay(sessionDate) >= weekStart) wordsWeek += words;
    if (startOfDay(sessionDate) >= startOfDay(monthStart)) wordsMonth += words;
  });

  groups.forEach((entry, key) => {
    if (entry.words > bestDay.words) bestDay = { key, words: entry.words };
  });

  let currentStreak = 0;
  let longestStreak = 0;
  if (sortedDays.length) {
    let run = 1;
    longestStreak = 1;
    for (let i = 1; i < sortedDays.length; i += 1) {
      const gap = daysBetween(sortedDays[i - 1], sortedDays[i]);
      run = gap === 1 ? run + 1 : 1;
      longestStreak = Math.max(longestStreak, run);
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const lastDay = sortedDays[sortedDays.length - 1];
    if ([todayKey, yesterday.toISOString().slice(0, 10)].includes(lastDay)) {
      currentStreak = 1;
      for (let i = sortedDays.length - 1; i > 0; i -= 1) {
        const gap = daysBetween(sortedDays[i - 1], sortedDays[i]);
        if (gap === 1) currentStreak += 1;
        else break;
      }
    }
  }

  const firstSessionDate = writingSessions.length
    ? new Date([...writingSessions].sort((a, b) => new Date(a.date) - new Date(b.date))[0].date)
    : new Date(bundle.project.projectStartDate || new Date());
  const activeDays = Math.max(1, daysBetween(firstSessionDate, new Date()) + 1);
  const dailyAverage = totalWritten / activeDays;
  const weeklyAverage = totalWritten / Math.max(1, activeDays / 7);
  const avgSession = totalWritten / Math.max(1, writingSessions.length);
  const targetWords = number(bundle.project.targetWordCount);
  const currentWords = number(bundle.project.currentWordCount);
  const distanceToGoal = Math.max(targetWords - currentWords, 0);
  const estimatedCompletionDate = dailyAverage > 0
    ? new Date(Date.now() + (distanceToGoal / dailyAverage) * 86400000)
    : null;

  const recentDays = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const recentFirst = recentDays.slice(0, Math.max(1, Math.ceil(recentDays.length / 2)));
  const recentSecond = recentDays.slice(-Math.max(1, Math.ceil(recentDays.length / 2)));
  const recentAvgA = recentFirst.reduce((sum, [, value]) => sum + value.words, 0) / Math.max(1, recentFirst.length);
  const recentAvgB = recentSecond.reduce((sum, [, value]) => sum + value.words, 0) / Math.max(1, recentSecond.length);
  const momentum = recentAvgB > recentAvgA * 1.08 ? "Increasing" : recentAvgB < recentAvgA * 0.92 ? "Slowing" : "Steady";

  const mostProductiveDayIndex = weekdayTotals.indexOf(Math.max(...weekdayTotals));
  const longestSession = writingSessions.reduce((best, session) => Math.max(best, number(session.durationMinutes)), 0);
  const totalProgress = targetWords > 0 ? Math.min(100, (currentWords / targetWords) * 100) : 0;
  const estimatedWordsRemaining = Math.max(targetWords - currentWords, 0);

  return {
    wordsToday,
    wordsWeek,
    wordsMonth,
    totalWritten,
    totalEdited,
    totalDuration,
    dailyAverage,
    weeklyAverage,
    avgSession,
    bestDay,
    currentStreak,
    longestStreak,
    estimatedCompletionDate,
    distanceToGoal,
    momentum,
    mostProductiveDayIndex,
    longestSession,
    totalProgress,
    estimatedWordsRemaining,
    groups
  };
}

function getEditStats(bundle) {
  const sessions = [...getEditSessions(bundle)].sort((a, b) => new Date(b.date) - new Date(a.date));
  const todayKey = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const weekStart = startOfDay(new Date(now));
  weekStart.setDate(weekStart.getDate() - 6);

  let minutesToday = 0;
  let minutesWeek = 0;
  let totalMinutes = 0;
  let totalWordsEdited = 0;
  let currentPassMinutes = 0;

  sessions.forEach((session) => {
    const key = dateKey(session.date);
    const duration = number(session.durationMinutes);
    totalMinutes += duration;
    totalWordsEdited += number(session.wordsEdited);
    if (key === todayKey) minutesToday += duration;
    if (startOfDay(new Date(session.date)) >= weekStart) minutesWeek += duration;
    if (session.passName === bundle.editing.passName) currentPassMinutes += duration;
  });

  const openIssues = bundle.issues.filter((issue) => issue.status !== "Resolved");
  const currentPassIssues = openIssues.filter((issue) => !issue.passName || issue.passName === bundle.editing.passName);
  const resolvedIssues = bundle.issues.filter((issue) => issue.status === "Resolved");

  return {
    minutesToday,
    minutesWeek,
    totalMinutes,
    totalWordsEdited,
    currentPassMinutes,
    averageSessionMinutes: totalMinutes / Math.max(1, sessions.length),
    sessionCount: sessions.length,
    currentPassIssueCount: currentPassIssues.length,
    resolvedIssueCount: resolvedIssues.length,
    lastSession: sessions[0] || null
  };
}

function goalValueForSession(goalType, session) {
  if (goalType === "write_minutes") return number(session.durationMinutes);
  if (session.type === "edit") return 0;
  return number(session.wordsWritten);
}

function goalValueForDate(bundle, goal, key) {
  return bundle.sessions
    .filter((session) => dateKey(session.date) === key)
    .reduce((sum, session) => sum + goalValueForSession(goal.type, session), 0);
}

function activeGoalsForBundle(bundle) {
  return bundle.goals.filter((goal) => goal.status !== "archived");
}

function archivedGoalsForBundle(bundle) {
  return bundle.goals
    .filter((goal) => goal.status === "archived")
    .sort((a, b) => new Date(b.archivedAt || b.createdAt) - new Date(a.archivedAt || a.createdAt));
}

function goalUnit(goalType) {
  return goalType === "write_minutes" ? "minutes" : "words";
}

function goalHistoryLabel(goalType) {
  return goalType === "write_minutes" ? "minutes" : "written";
}

function applyGoalTypePreset(form, goalType) {
  if (!form?.elements) return;
  const targetInput = form.elements.targetValue;
  const titleInput = form.elements.title;
  const targetLabel = document.getElementById("goal-target-label");
  if (!targetInput || !titleInput || !targetLabel) return;
  const normalizedType = goalType === "write_minutes" ? "write_minutes" : "write_words";
  const defaultTarget = normalizedType === "write_minutes" ? 60 : 1000;
  const dailySchedule = form.elements.scheduleMode?.value !== "custom_days";
  if (goalType === "write_minutes") {
    targetLabel.textContent = "Daily target (minutes)";
    if (dailySchedule || targetInput.value === "") targetInput.value = defaultTarget;
    titleInput.placeholder = "Example: Spend 60 minutes writing or editing today";
    titleInput.value = titleInput.value || "Spend 60 focused minutes writing or editing";
  } else {
    targetLabel.textContent = "Daily target (words)";
    if (dailySchedule || targetInput.value === "") targetInput.value = defaultTarget;
    titleInput.placeholder = "Example: Write 1,000 words today";
    titleInput.value = titleInput.value || "Write 1,000 words today";
  }
  GOAL_DAY_KEYS.forEach((dayKey) => {
    const dayInput = form.elements[`target_${dayKey}`];
    if (!dayInput) return;
    if (dayInput.value === "") {
      dayInput.value = String(defaultTarget);
    }
  });
}

function evaluateGoal(bundle, goal) {
  const today = startOfDay(new Date());
  const value = goalValueForDate(bundle, goal, today.toISOString().slice(0, 10));
  const trackedToday = isGoalTrackedOnDate(goal, today);
  const target = trackedToday ? Math.max(1, goalTargetForDate(goal, today)) : 0;
  const progress = trackedToday ? Math.min(100, (value / target) * 100) : 0;
  const completed = trackedToday && progress >= 100;
  return {
    ...goal,
    liveValue: value,
    progress,
    completed,
    trackedToday,
    targetValueToday: target
  };
}

function goalTypeContext(type) {
  return type === "write_minutes" ? "FOCUS TIME" : "WRITE";
}

function isGoalTrackedOnDate(goal, cursor) {
  const createdAt = goal.createdAt ? startOfDay(new Date(goal.createdAt)) : null;
  if (createdAt && createdAt > cursor) return false;
  const startDate = goal.startDate ? startOfDay(new Date(goal.startDate)) : createdAt;
  if (startDate && startDate > cursor) return false;
  if (goal.trackingMode === "date_range" && goal.endDate) {
    const endDate = startOfDay(new Date(goal.endDate));
    if (endDate < cursor) return false;
  }
  if (goalTargetForDate(goal, cursor) <= 0) return false;
  if (goal.status !== "archived") return true;
  if (!goal.archivedAt) return true;
  return startOfDay(new Date(goal.archivedAt)) >= cursor;
}

function goalTargetForDate(goal, dateValue) {
  const cursor = startOfDay(new Date(dateValue));
  if (goal.scheduleMode !== "custom_days") {
    return Math.max(0, number(goal.targetValue));
  }
  const dayKey = GOAL_DAY_KEYS[(cursor.getDay() + 6) % 7];
  return Math.max(0, number(goal.dayTargets?.[dayKey]));
}

function goalScheduleSummary(goal) {
  if (goal.scheduleMode !== "custom_days") {
    return `Every day: ${formatNumber(goal.targetValue)} ${goalUnit(goal.type)}`;
  }

  const weekdayTargets = GOAL_DAY_KEYS.slice(0, 5).map((dayKey) => number(goal.dayTargets?.[dayKey]));
  const weekendTargets = GOAL_DAY_KEYS.slice(5).map((dayKey) => number(goal.dayTargets?.[dayKey]));
  const uniqueWeekdayTargets = [...new Set(weekdayTargets)];
  const uniqueWeekendTargets = [...new Set(weekendTargets)];

  if (uniqueWeekdayTargets.length === 1 && uniqueWeekendTargets.length === 1) {
    return `Weekdays ${formatNumber(uniqueWeekdayTargets[0])}, weekends ${formatNumber(uniqueWeekendTargets[0])} ${goalUnit(goal.type)}`;
  }

  return GOAL_DAY_KEYS
    .map((dayKey) => `${GOAL_DAY_LABELS[dayKey]} ${formatNumber(goal.dayTargets?.[dayKey])}`)
    .join(" • ");
}

function goalWindowSummary(goal) {
  if (goal.trackingMode !== "date_range" || !goal.endDate) {
    return `Starts ${formatDate(goal.startDate || goal.createdAt)}`;
  }
  return `${formatDate(goal.startDate || goal.createdAt)} to ${formatDate(goal.endDate)}`;
}

function buildGoalSnapshotForDate(bundle, goal, key) {
  const value = goalValueForDate(bundle, goal, key);
  const target = Math.max(1, goalTargetForDate(goal, key));
  return {
    id: goal.id,
    title: goal.title || (goal.type === "write_minutes" ? "Spend time writing or editing" : "Write words"),
    type: goal.type,
    status: goal.status === "archived" ? "archived" : "active",
    value,
    target,
    unit: goalUnit(goal.type),
    metricText: `${formatNumber(value)} / ${formatNumber(target)} ${goalHistoryLabel(goal.type)}`,
    ratio: value / target
  };
}

function heatmapStatusCopy(status) {
  return {
    fail: "Nothing done",
    partial: "Partial progress",
    met: "Complete",
    exceeded: "Goal exceeded",
    none: "No goals set"
  }[status] || "No activity";
}

function heatmapFillPercent(ratio) {
  if (ratio <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function preferredHeatmapDayKey(days) {
  const selectableDays = days.filter((day) => !day.outsideMonth);
  if (!selectableDays.length) return null;
  const selectedDay = selectableDays.find((day) => day.key === selectedHeatmapDayKey);
  if (selectedDay) return selectedDay.key;
  const latestPastDay = [...selectableDays].reverse().find((day) => !day.future);
  return latestPastDay?.key || selectableDays[0]?.key || null;
}

function getHeatmapMonth(bundle, monthOffset = 0) {
  const today = startOfDay(new Date());
  const targetMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthStart = startOfDay(targetMonth);
  const monthEnd = startOfDay(new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0));
  const calendarStart = startOfDay(new Date(monthStart));
  calendarStart.setDate(calendarStart.getDate() - ((calendarStart.getDay() + 6) % 7));
  const calendarEnd = startOfDay(new Date(monthEnd));
  calendarEnd.setDate(calendarEnd.getDate() + ((7 - ((calendarEnd.getDay() + 6) % 7) - 1 + 7) % 7));
  const days = [];

  for (let cursor = new Date(calendarStart); cursor <= calendarEnd; cursor.setDate(cursor.getDate() + 1)) {
    const key = cursor.toISOString().slice(0, 10);
    const inMonth = cursor.getMonth() === monthStart.getMonth() && cursor.getFullYear() === monthStart.getFullYear();
    const longDate = cursor.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    if (!inMonth) {
      days.push({
        key,
        status: "none",
        label: "",
        outsideMonth: true,
        dayNumber: cursor.getDate(),
        fillPercent: 0,
        progressPercent: 0
      });
      continue;
    }
    if (cursor > today) {
      days.push({
        key,
        status: "none",
        label: `${longDate}\nFuture day`,
        dayNumber: cursor.getDate(),
        future: true,
        longDate,
        detailSummary: "Future day",
        detailCopy: "Goal progress will appear here once the day arrives.",
        sessionCount: 0,
        goalSummaries: [],
        fillPercent: 0,
        progressPercent: 0
      });
      continue;
    }
    const daySessions = getWriteSessions(bundle).filter((session) => dateKey(session.date) === key);
    const trackedGoals = bundle.goals.filter((goal) =>
      (goal.type === "write_words" || goal.type === "write_minutes") &&
      isGoalTrackedOnDate(goal, cursor)
    );
    if (!trackedGoals.length) {
      const noGoalLines = [longDate, "No goals set", `${daySessions.length} ${daySessions.length === 1 ? "session" : "sessions"}`];
      days.push({
        key,
        status: "none",
        label: noGoalLines.join("\n"),
        dayNumber: cursor.getDate(),
        longDate,
        detailSummary: "No goals set",
        detailCopy: "No writing goals were active on this date.",
        sessionCount: daySessions.length,
        goalSummaries: [],
        fillPercent: 0,
        progressPercent: 0
      });
      continue;
    }
    const goalSummaries = trackedGoals.map((goal) => buildGoalSnapshotForDate(bundle, goal, key));
    const averageRatio = goalSummaries.reduce((sum, goal) => {
      return sum + goal.ratio;
    }, 0) / trackedGoals.length;
    const fillPercent = heatmapFillPercent(averageRatio);
    const progressPercent = averageRatio > 0 ? Math.max(1, Math.round(averageRatio * 100)) : 0;
    const status = averageRatio > 1 ? "exceeded" : averageRatio >= 1 ? "met" : averageRatio > 0 ? "partial" : "fail";
    const statusLabel = heatmapStatusCopy(status);
    const labelLines = [
      longDate,
      statusLabel,
      `${formatNumber(progressPercent)}% of combined daily target`,
      ...goalSummaries.map((goal) => `${goal.title}: ${goal.metricText}`),
      `${daySessions.length} ${daySessions.length === 1 ? "session" : "sessions"}`
    ];
    days.push({
      key,
      status,
      label: labelLines.join("\n"),
      dayNumber: cursor.getDate(),
      longDate,
      detailSummary: statusLabel,
      detailCopy: "Hover, focus, or tap a day to compare what you did against the goal that was active then.",
      sessionCount: daySessions.length,
      goalSummaries,
      fillPercent,
      progressPercent
    });
  }

  return {
    days,
    monthLabel: monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" })
  };
}

function renderHeatmapDayDetail(day) {
  if (!day) return "";
  const sessionsLabel = `${day.sessionCount} ${day.sessionCount === 1 ? "session" : "sessions"}`;
  const goalMarkup = day.goalSummaries.length
    ? `
      <div class="heatmap-detail-goals">
        ${day.goalSummaries.map((goal) => `
          <article class="heatmap-detail-goal">
            <div class="heatmap-detail-goal-head">
              <strong>${escapeHtml(goal.title)}</strong>
              <span class="pill heatmap-goal-status ${goal.status === "archived" ? "archived" : "active"}">${goal.status === "archived" ? "Archived goal" : "Active goal"}</span>
            </div>
            <span>${escapeHtml(goal.metricText)}</span>
          </article>
        `).join("")}
      </div>
    `
    : `<p class="small-copy heatmap-detail-empty">${escapeHtml(day.detailCopy || "No goal snapshot for this day yet.")}</p>`;

  return `
    <div class="heatmap-detail-head">
      <div>
        <p class="small-copy">Daily Goal Snapshot</p>
        <h4>${escapeHtml(day.longDate || "")}</h4>
      </div>
      <div class="heatmap-detail-meta">
        <span class="pill">${escapeHtml(day.detailSummary || heatmapStatusCopy(day.status))}</span>
        ${day.goalSummaries?.length ? `<span class="pill">${formatNumber(day.progressPercent || 0)}% complete</span>` : ""}
        <span class="pill">${sessionsLabel}</span>
      </div>
    </div>
    ${goalMarkup}
  `;
}

function renderGoalHeatmap(bundle) {
  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const { days, monthLabel } = getHeatmapMonth(bundle, heatmapMonthOffset);
  const selectedDayKey = preferredHeatmapDayKey(days);
  selectedHeatmapDayKey = selectedDayKey;
  const selectedDay = days.find((day) => day.key === selectedDayKey) || null;
  return `
    <section class="card">
      <div class="section-head">
        <div>
          <h3>Goal Heatmap</h3>
          <p>Daily goal performance, one month at a time. Hover, focus, or tap a day to inspect the goal snapshot behind it.</p>
        </div>
      </div>
      <div class="heatmap-shell">
        <div class="heatmap-toolbar">
          <button class="heatmap-nav" id="heatmap-prev-month-btn" type="button" aria-label="Previous month">‹</button>
          <p class="heatmap-title">${monthLabel}</p>
          <button class="heatmap-nav" id="heatmap-next-month-btn" type="button" aria-label="Next month">›</button>
        </div>
        <div class="heatmap-legend">
          <span><i class="heatmap-swatch fail"></i> Nothing done</span>
          <span><i class="heatmap-swatch partial"></i> Partial</span>
          <span><i class="heatmap-swatch met"></i> Complete</span>
          <span><i class="heatmap-swatch exceeded"></i> Exceeded</span>
        </div>
        <div class="heatmap-weekdays">${weekdayLabels.map((label) => `<span>${label}</span>`).join("")}</div>
        <div class="heatmap-grid">
          ${days.map((day) => day.outsideMonth
            ? `<div class="heatmap-cell none outside-month" aria-hidden="true"></div>`
            : `<button class="heatmap-cell ${day.status}${day.key === selectedDayKey ? " is-selected" : ""}" data-heatmap-day="${day.key}" type="button" style="--heatmap-fill:${day.fillPercent || 0}%;" title="${escapeAttr(day.label)}" aria-label="${escapeAttr(day.label)}"><span class="heatmap-daynum">${day.dayNumber}</span></button>`
          ).join("")}
        </div>
        <div class="heatmap-detail" id="heatmap-detail-panel">
          ${renderHeatmapDayDetail(selectedDay)}
        </div>
      </div>
    </section>
  `;
}

function renderWorkspaceEmptyState(label) {
  return `
    <section class="empty-state">
      <div class="empty-panel">
        <p class="small-copy">${escapeHtml(label)}</p>
        <h2 class="hero-title">Create a project to track your progress</h2>
        <p class="muted">Start your first manuscript project to unlock the full Write, Edit, and Stats workspace.</p>
        <div class="meta-line" style="margin-top: 22px;">
          <button class="primary-btn writing-launch-cta" data-action="create-first-project" type="button">Create first project</button>
        </div>
      </div>
    </section>
  `;
}

function bindWorkspaceEmptyActions() {
  document.querySelectorAll("[data-action='create-first-project']").forEach((button) => {
    button.onclick = () => {
      activeView = "create-project";
      render();
    };
  });
}

function openSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
}

function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (!modal) return;
  modal.classList.add("hidden");
}

function showToast(title, body) {
  const toast = document.getElementById("toast");
  toast.innerHTML = `<strong>${title}</strong><span>${body}</span>`;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll(`"`, `""`)}"`;
}

function parseCsv(text) {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === `"` && next === `"`) {
        currentValue += `"`;
        index += 1;
      } else if (char === `"`) {
        inQuotes = false;
      } else {
        currentValue += char;
      }
      continue;
    }

    if (char === `"`) {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    if (char === "\r") continue;
    currentValue += char;
  }

  if (currentValue.length || currentRow.length) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

function projectExportBaseRow(bundle) {
  return {
    row_type: "",
    project_id: bundle.id,
    project_title: bundle.project.bookTitle || "",
    project_target_word_count: number(bundle.project.targetWordCount),
    project_current_word_count: number(bundle.project.currentWordCount),
    project_deadline: bundle.project.deadline || "",
    project_daily_target: number(bundle.project.dailyTarget),
    project_start_date: bundle.project.projectStartDate || "",
    project_edit_pass_name: bundle.editing.passName || "",
    project_edit_pass_stage: bundle.editing.passStage || "",
    project_edit_pass_status: bundle.editing.passStatus || "",
    project_edit_pass_objective: bundle.editing.passObjective || "",
    project_edit_progress_current: number(bundle.editing.progressCurrent),
    project_edit_progress_total: number(bundle.editing.progressTotal),
      goal_id: "",
      goal_type: "",
      goal_title: "",
      goal_target_value: "",
      goal_created_at: "",
      goal_status: "",
      goal_archived_at: "",
      goal_tracking_mode: "",
      goal_start_date: "",
      goal_end_date: "",
      goal_schedule_mode: "",
      goal_monday_target: "",
      goal_tuesday_target: "",
      goal_wednesday_target: "",
      goal_thursday_target: "",
      goal_friday_target: "",
      goal_saturday_target: "",
      goal_sunday_target: "",
      issue_id: "",
    issue_title: "",
    issue_type: "",
    issue_section_label: "",
    issue_priority: "",
    issue_status: "",
    issue_notes: "",
    issue_created_at: "",
    issue_resolved_at: "",
    issue_pass_name: "",
    session_id: "",
    session_type: "",
    session_date: "",
    session_duration_minutes: "",
    session_words_written: "",
    session_words_edited: "",
    session_pass_name: "",
    session_section_label: "",
    session_notes: ""
  };
}

function buildProjectExportRows(bundle, mode = "all") {
  const base = projectExportBaseRow(bundle);
  const rows = [{ ...base, row_type: "project" }];
  const includeWrite = mode === "all" || mode === "write";
  const includeEdit = mode === "all" || mode === "edit";

  if (includeWrite) {
    bundle.goals.forEach((goal) => {
      rows.push({
        ...base,
        row_type: "goal",
        goal_id: goal.id || "",
        goal_type: goal.type || "",
        goal_title: goal.title || "",
        goal_target_value: number(goal.targetValue),
        goal_created_at: goal.createdAt || "",
        goal_status: goal.status || "active",
        goal_archived_at: goal.archivedAt || "",
        goal_tracking_mode: goal.trackingMode || "ongoing",
        goal_start_date: goal.startDate || "",
        goal_end_date: goal.endDate || "",
        goal_schedule_mode: goal.scheduleMode || "daily",
        goal_monday_target: number(goal.dayTargets?.monday),
        goal_tuesday_target: number(goal.dayTargets?.tuesday),
        goal_wednesday_target: number(goal.dayTargets?.wednesday),
        goal_thursday_target: number(goal.dayTargets?.thursday),
        goal_friday_target: number(goal.dayTargets?.friday),
        goal_saturday_target: number(goal.dayTargets?.saturday),
        goal_sunday_target: number(goal.dayTargets?.sunday)
      });
    });
  }

  if (includeEdit) {
    bundle.issues.forEach((issue) => {
      rows.push({
        ...base,
        row_type: "issue",
        issue_id: issue.id || "",
        issue_title: issue.title || "",
        issue_type: issue.type || "",
        issue_section_label: issue.sectionLabel || "",
        issue_priority: issue.priority || "",
        issue_status: issue.status || "",
        issue_notes: issue.notes || "",
        issue_created_at: issue.createdAt || "",
        issue_resolved_at: issue.resolvedAt || "",
        issue_pass_name: issue.passName || ""
      });
    });
  }

  bundle.sessions.forEach((session) => {
    if (mode === "write" && session.type === "edit") return;
    if (mode === "edit" && session.type !== "edit") return;
    rows.push({
      ...base,
      row_type: "session",
      session_id: session.id || "",
      session_type: session.type || "write",
      session_date: session.date || "",
      session_duration_minutes: number(session.durationMinutes),
      session_words_written: number(session.wordsWritten),
      session_words_edited: number(session.wordsEdited),
      session_pass_name: session.passName || "",
      session_section_label: session.sectionLabel || "",
      session_notes: session.notes || ""
    });
  });

  return rows;
}

function bundleToCsv(bundle, mode = "all") {
  const rows = buildProjectExportRows(bundle, mode);
  const header = exportColumns.map(csvCell).join(",");
  const body = rows.map((row) => exportColumns.map((column) => csvCell(row[column])).join(",")).join("\n");
  return `\uFEFF${header}\n${body}`;
}

function downloadCurrentProjectCsv(mode = "all") {
  const bundle = currentBundle();
  if (!bundle) return;
  const csv = bundleToCsv(bundle, mode);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  const modeLabel = mode === "write" ? "write" : mode === "edit" ? "edit" : "project";
  link.download = `${slugifyFilePart(bundle.project.bookTitle)}-${modeLabel}-${stamp}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  const toastLabel = mode === "write" ? "Write" : mode === "edit" ? "Edit" : "Project";
  showToast("CSV exported", `${toastLabel} data was downloaded in a format you can keep locally.`);
}

function parseImportedRows(text) {
  const rows = parseCsv(text.trim());
  if (!rows.length) throw new Error("This CSV file is empty.");

  const header = rows[0].map((cell, index) => {
    const clean = index === 0 ? cell.replace(/^\uFEFF/, "") : cell;
    return clean.trim();
  });

  const missingColumns = requiredImportColumns.filter((column) => !header.includes(column));
  if (missingColumns.length) {
    throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
  }

  return rows.slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
    .map((row) => {
      const entry = {};
      header.forEach((column, index) => {
        entry[column] = row[index] ?? "";
      });
      return entry;
    });
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = item.id || createId();
    if (seen.has(id)) return false;
    item.id = id;
    seen.add(id);
    return true;
  });
}

function buildBundleFromImportedRows(rows) {
  const projectRow = rows.find((row) => row.row_type === "project");
  if (!projectRow) throw new Error("No project row was found in this CSV.");

  const bundle = normalizeProjectBundle({
    id: projectRow.project_id || createId(),
    project: {
      bookTitle: projectRow.project_title || "Imported Manuscript",
      targetWordCount: number(projectRow.project_target_word_count),
      currentWordCount: number(projectRow.project_current_word_count),
      deadline: projectRow.project_deadline || "",
      dailyTarget: number(projectRow.project_daily_target) || defaultProjectTemplate.project.dailyTarget,
      projectStartDate: projectRow.project_start_date || new Date().toISOString().slice(0, 10)
    },
    editing: {
      passName: projectRow.project_edit_pass_name || defaultPassName(projectRow.project_edit_pass_stage || "Developmental"),
      passStage: projectRow.project_edit_pass_stage || "Developmental",
      passStatus: projectRow.project_edit_pass_status || "Not started",
      passObjective: projectRow.project_edit_pass_objective || "",
      progressCurrent: number(projectRow.project_edit_progress_current),
      progressTotal: number(projectRow.project_edit_progress_total)
    },
    goals: rows
      .filter((row) => row.row_type === "goal")
      .map((row) => ({
        id: row.goal_id || createId(),
        type: row.goal_type || "write_words",
        title: row.goal_title || "Imported goal",
        targetValue: number(row.goal_target_value),
        createdAt: row.goal_created_at || new Date().toISOString(),
        status: row.goal_status === "archived" ? "archived" : "active",
        archivedAt: row.goal_archived_at || "",
        trackingMode: row.goal_tracking_mode === "date_range" ? "date_range" : "ongoing",
        startDate: row.goal_start_date || toInputDate(row.goal_created_at || new Date().toISOString()),
        endDate: row.goal_end_date || "",
        scheduleMode: row.goal_schedule_mode === "custom_days" ? "custom_days" : "daily",
        dayTargets: {
          monday: number(row.goal_monday_target || row.goal_target_value),
          tuesday: number(row.goal_tuesday_target || row.goal_target_value),
          wednesday: number(row.goal_wednesday_target || row.goal_target_value),
          thursday: number(row.goal_thursday_target || row.goal_target_value),
          friday: number(row.goal_friday_target || row.goal_target_value),
          saturday: number(row.goal_saturday_target || row.goal_target_value),
          sunday: number(row.goal_sunday_target || row.goal_target_value)
        }
      })),
    issues: rows
      .filter((row) => row.row_type === "issue")
      .map((row) => ({
        id: row.issue_id || createId(),
        title: row.issue_title || "Imported issue",
        type: row.issue_type || "General",
        sectionLabel: row.issue_section_label || "",
        priority: row.issue_priority || "Medium",
        status: row.issue_status || "Open",
        notes: row.issue_notes || "",
        createdAt: row.issue_created_at || new Date().toISOString(),
        resolvedAt: row.issue_resolved_at || "",
        passName: row.issue_pass_name || ""
      })),
    sessions: rows
      .filter((row) => row.row_type === "session")
      .map((row) => ({
        id: row.session_id || createId(),
        type: row.session_type === "edit" ? "edit" : "write",
        date: row.session_date || new Date().toISOString(),
        durationMinutes: number(row.session_duration_minutes),
        wordsWritten: number(row.session_words_written),
        wordsEdited: number(row.session_words_edited),
        passName: row.session_pass_name || "",
        sectionLabel: row.session_section_label || "",
        notes: row.session_notes || ""
      })),
    milestones: []
  });

  bundle.goals = dedupeById(bundle.goals);
  bundle.issues = dedupeById(bundle.issues);
  bundle.sessions = dedupeById(bundle.sessions);
  return normalizeProjectBundle(bundle);
}

function importProjectFromCsv(text) {
  const rows = parseImportedRows(text);
  const importedBundle = buildBundleFromImportedRows(rows);
  const existingIndex = state.projects.findIndex((project) => project.id === importedBundle.id);

  if (existingIndex >= 0) {
    const shouldReplace = window.confirm(`Replace the existing project "${state.projects[existingIndex].project.bookTitle}" with the imported data?`);
    if (!shouldReplace) return;
    state.projects.splice(existingIndex, 1, importedBundle);
  } else {
    state.projects.unshift(importedBundle);
  }

  state.activeProjectId = importedBundle.id;
  activeView = preferredWorkspaceView();
  persistAndRender();
  showToast("CSV imported", `${importedBundle.project.bookTitle} is now available in your workspace.`);
}

function handleImportProjectFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importProjectFromCsv(String(reader.result || ""));
    } catch (error) {
      showToast("Import failed", error instanceof Error ? error.message : "The CSV could not be imported.");
    }
  };
  reader.readAsText(file);
}
