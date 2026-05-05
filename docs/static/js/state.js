const STORAGE_KEY = "author-engine-mvp";
const STATE_API_ENDPOINT = "/api/state";
const DEFAULT_VIEW = "dashboard";
const DEFAULT_PLOT_SECTION_IDS = ["characters", "locations", "glossary", "worldRules", "history", "mythology"];
const PLOT_SECTION_IDS = [
  ...DEFAULT_PLOT_SECTION_IDS,
  "premise",
  "themes",
  "timeline",
  "plotThreads",
  "scenes",
  "relationships",
  "cultures",
  "magicSystems",
  "technology",
  "research",
  "memoirPeople",
  "memories",
  "objects",
  "questions"
];
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
const GOAL_TYPES = ["write_words", "write_minutes", "structure_units_completed", "issues_resolved"];
const SESSION_SNAPSHOT_TYPES = ["writing", "editing", "planning", "research"];
const SESSION_SNAPSHOT_GOALS = ["draft", "revise", "fix", "proofread", "custom"];
const SESSION_SNAPSHOT_OUTCOMES = ["completed", "partial", "blocked"];
const SESSION_SNAPSHOT_CONFIDENCE_LEVELS = ["", "low", "medium", "high"];
const PROJECT_TYPE_OPTIONS = ["Novel", "Short story", "Screenplay", "Essay", "Other"];
const STRUCTURE_UNIT_OPTIONS = ["Chapter", "Scene", "Section"];
const PRIMARY_WORKSPACE_VIEWS = ["dashboard", "plot", "edit"];
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
  "project_manuscript_type",
  "project_structure_unit_label",
  "project_status",
  "project_archived_at",
  "project_target_word_count",
  "project_current_word_count",
  "project_deadline",
  "project_daily_target",
  "project_start_date",
  "project_manuscript_is_complete",
  "project_manuscript_completed_at",
  "project_manuscript_completion_word_count",
  "project_is_published",
  "project_published_at",
  "project_published_word_count",
  "project_edit_pass_name",
  "project_edit_pass_stage",
  "project_edit_pass_status",
  "project_edit_pass_objective",
  "project_edit_progress_current",
  "project_edit_progress_total",
  "chapter_id",
  "chapter_label",
  "chapter_summary",
  "chapter_sort_order",
  "chapter_completed_at",
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
  "issue_snippet",
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
  "session_notes",
  "session_started_at",
  "session_ended_at",
  "session_structure_unit_id",
  "session_structure_unit_type",
  "session_start_word_count",
  "session_end_word_count",
  "session_words_added",
  "session_words_removed",
  "session_net_words",
  "session_intended_goal",
  "session_outcome_status",
  "session_accomplished",
  "session_next_step",
  "session_blocker",
  "session_confidence_level",
  "session_excerpt",
  "session_issue_ids"
];

const EDIT_FOCUS_ORDER = ["revision"];
const EDIT_FOCUS_CONFIG = {
  revision: {
    label: "Revision",
    shortLabel: "Rev",
    weight: 1,
    defaultPriority: "Medium",
    summary: "Big-picture and sentence-level issues all live together here."
  }
};

function normalizeEditFocusKey(value = "", fallback = "revision") {
  const source = `${String(value || "").trim()} ${String(fallback || "").trim()}`.toLowerCase();
  if (!source) return "revision";
  return "revision";
}

function getEditFocusConfig(focusKey = "revision") {
  return EDIT_FOCUS_CONFIG[normalizeEditFocusKey(focusKey)] || EDIT_FOCUS_CONFIG.revision;
}

function getEditFocusLabel(focusKey = "revision") {
  return getEditFocusConfig(focusKey).label;
}

function getEditFocusShortLabel(focusKey = "revision") {
  return getEditFocusConfig(focusKey).shortLabel;
}

function getEditFocusSummary(focusKey = "revision") {
  return getEditFocusConfig(focusKey).summary;
}

function getEditFocusDefaultPriority(focusKey = "revision") {
  return getEditFocusConfig(focusKey).defaultPriority;
}

function defaultPassName(stage = "") {
  return "";
}

function normalizeEditPassStage(stage = "") {
  return "";
}

function normalizeLegacyEditPassName(passName = "", activeStage = "") {
  return "";
}

function normalizeProjectType(type = "Novel") {
  const normalizedType = String(type || "").trim();
  return PROJECT_TYPE_OPTIONS.includes(normalizedType) ? normalizedType : "Novel";
}

function defaultStructureUnitForProjectType(type = "Novel") {
  const projectType = normalizeProjectType(type);
  if (projectType === "Novel") return "Chapter";
  if (projectType === "Short story" || projectType === "Screenplay") return "Scene";
  if (projectType === "Essay") return "Section";
  return "";
}

function normalizeStructureUnitLabel(label = "", projectType = "Novel") {
  const normalizedLabel = String(label || "").trim();
  return normalizedLabel || defaultStructureUnitForProjectType(projectType) || "Section";
}

function getStructureUnitLabel(bundleOrProject = currentBundle()) {
  const project = bundleOrProject?.project || bundleOrProject || {};
  return normalizeStructureUnitLabel(project.structureUnitLabel, project.manuscriptType);
}

function getStructureUnitLower(bundleOrProject = currentBundle()) {
  return getStructureUnitLabel(bundleOrProject).toLowerCase();
}

function pluralizeStructureUnit(label = "Section") {
  const normalizedLabel = normalizeStructureUnitLabel(label);
  if (/[^aeiou]y$/i.test(normalizedLabel)) return `${normalizedLabel.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(normalizedLabel)) return `${normalizedLabel}es`;
  return `${normalizedLabel}s`;
}

function getStructureUnitPlural(bundleOrProject = currentBundle()) {
  return pluralizeStructureUnit(getStructureUnitLabel(bundleOrProject));
}

function normalizeChapterLabel(label = "") {
  const normalizedLabel = String(label || "").trim();
  return normalizedLabel || "Unassigned";
}

function compareEditingChapterLabels(a, b) {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function createEditingChapter(label = "", overrides = {}) {
  return {
    id: overrides.id || createId(),
    label: normalizeChapterLabel(label),
    summary: String(overrides.summary || "").trim(),
    sortOrder: Math.max(0, number(overrides.sortOrder)),
    completedAt: String(overrides.completedAt || "")
  };
}

function normalizeEditingChapters(chapters = [], issues = [], sessions = []) {
  const chapterMap = new Map();
  let nextSortOrder = 0;
  const fallbackLabel = "Unassigned";
  const hasAssignedFallbackContent = [...issues, ...sessions].some((entry) => normalizeChapterLabel(entry?.sectionLabel) === fallbackLabel);

  function upsertChapter(label, overrides = {}) {
    const normalizedLabel = normalizeChapterLabel(label);
    if (!chapterMap.has(normalizedLabel)) {
      chapterMap.set(normalizedLabel, createEditingChapter(normalizedLabel, {
        ...overrides,
        sortOrder: overrides.sortOrder ?? nextSortOrder
      }));
      nextSortOrder += 1;
      return;
    }
    const existing = chapterMap.get(normalizedLabel);
    chapterMap.set(normalizedLabel, {
      ...existing,
      id: overrides.id || existing.id,
      label: normalizedLabel,
      summary: String(
        overrides.summary !== undefined ? overrides.summary : existing.summary
      ).trim(),
      sortOrder: Math.max(0, number(
        overrides.sortOrder !== undefined ? overrides.sortOrder : existing.sortOrder
      )),
      completedAt: String(
        overrides.completedAt !== undefined ? overrides.completedAt : existing.completedAt || ""
      )
    });
  }

  (Array.isArray(chapters) ? chapters : []).forEach((chapter, index) => {
    if (normalizeChapterLabel(chapter?.label) === fallbackLabel && !hasAssignedFallbackContent) {
      return;
    }
    upsertChapter(chapter?.label, {
      id: chapter?.id,
      summary: chapter?.summary,
      sortOrder: chapter?.sortOrder ?? index,
      completedAt: chapter?.completedAt || chapter?.completed_at || ""
    });
  });

  [...issues, ...sessions].forEach((entry) => {
    const label = String(entry?.sectionLabel || "").trim();
    if (!label) return;
    upsertChapter(label);
  });

  return [...chapterMap.values()]
    .sort((a, b) => {
      const sortDelta = number(a.sortOrder) - number(b.sortOrder);
      if (sortDelta !== 0) return sortDelta;
      return compareEditingChapterLabels(a.label, b.label);
    })
    .map((chapter, index) => ({
      ...chapter,
      sortOrder: index
    }));
}

function createDefaultEditingState() {
  const focusKey = "revision";
  return {
    focusKey,
    passName: "",
    passStage: "",
    passStatus: "",
    passObjective: "",
    progressCurrent: 0,
    progressTotal: 0,
    chapters: []
  };
}

function createDefaultPlotState() {
  return {
    activeSection: DEFAULT_PLOT_SECTION_IDS[0],
    activeSections: [...DEFAULT_PLOT_SECTION_IDS],
    sections: Object.fromEntries(PLOT_SECTION_IDS.map((sectionId) => [sectionId, []]))
  };
}

function createDefaultCompletionState() {
  return {
    isManuscriptComplete: false,
    completedAt: "",
    completionWordCount: 0
  };
}

function createDefaultPublicationState() {
  return {
    isPublished: false,
    publishedAt: "",
    publishedWordCount: 0
  };
}

function createDefaultSessionSnapshot(projectId = "") {
  return {
    id: createId(),
    projectId: String(projectId || ""),
    sessionType: "writing",
    startedAt: "",
    endedAt: "",
    durationMinutes: 0,
    structureUnitId: "",
    structureUnitName: "",
    structureUnitType: "",
    startWordCount: null,
    endWordCount: null,
    wordsAdded: null,
    wordsRemoved: null,
    netWords: null,
    intendedGoal: "draft",
    outcomeStatus: "partial",
    focusKey: "",
    accomplished: "",
    nextStep: "",
    blocker: "",
    confidenceLevel: "",
    excerpt: "",
    notes: "",
    issueIds: []
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
    manuscriptType: "Novel",
    structureUnitLabel: "Chapter",
    targetWordCount: 80000,
    currentWordCount: 0,
    deadline: "",
    dailyTarget: 1000,
    projectStartDate: new Date().toISOString().slice(0, 10)
  },
  completion: createDefaultCompletionState(),
  publication: createDefaultPublicationState(),
  editing: createDefaultEditingState(),
  plot: createDefaultPlotState(),
  goals: [],
  snapshots: [],
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
let pendingSessionSnapshotContext = null;
let sessionCompletionAudioContext = null;
let lastSessionCompletionSoundAt = 0;

function playSessionCompleteSound() {
  const now = Date.now();
  if (now - lastSessionCompletionSoundAt < 1200) return;
  lastSessionCompletionSoundAt = now;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    sessionCompletionAudioContext = sessionCompletionAudioContext || new AudioContextClass();
    const context = sessionCompletionAudioContext;
    const startAt = context.currentTime + 0.01;
    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(0.0001, startAt);
    masterGain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.03);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.05);
    masterGain.connect(context.destination);

    const notes = [
      { frequency: 523.25, duration: 0.22, offset: 0 },
      { frequency: 659.25, duration: 0.24, offset: 0.16 },
      { frequency: 783.99, duration: 0.34, offset: 0.34 }
    ];

    notes.forEach((note) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const noteStart = startAt + note.offset;
      const noteEnd = noteStart + note.duration;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      gainNode.gain.setValueAtTime(0.0001, noteStart);
      gainNode.gain.exponentialRampToValueAtTime(0.18, noteStart + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
    });
  } catch (error) {
    console.warn("Unable to play the session completion sound.", error);
  }
}

function isProjectWorkspaceView(view) {
  return WORKSPACE_VIEWS.includes(view);
}

function isPrimaryWorkspaceView(view) {
  return PRIMARY_WORKSPACE_VIEWS.includes(view);
}

function createProjectBundle(title, targetWordCount, currentWordCount, deadline, projectType = "Novel", unitLabel = "") {
  const manuscriptType = normalizeProjectType(projectType);
  const structureUnitLabel = normalizeStructureUnitLabel(unitLabel, manuscriptType);
  return {
    id: createId(),
    status: "active",
    archivedAt: "",
    project: {
      ...cloneValue(defaultProjectTemplate.project),
      bookTitle: title || "Untitled Manuscript",
      manuscriptType,
      structureUnitLabel,
      targetWordCount: number(targetWordCount) || 80000,
      currentWordCount: number(currentWordCount),
      deadline: deadline || "",
      dailyTarget: 1000,
      projectStartDate: new Date().toISOString().slice(0, 10)
    },
    completion: createDefaultCompletionState(),
    publication: createDefaultPublicationState(),
    editing: createDefaultEditingState(),
    plot: createDefaultPlotState(),
    goals: [],
    snapshots: [],
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
    const activeProjects = normalizedProjects.filter((project) => !isProjectArchived(project));
    const hasStoredActiveId = activeProjects.some((project) => project.id === snapshot.activeProjectId);
    return {
      ...cloneValue(defaultState),
      ...snapshot,
      projects: normalizedProjects,
      activeProjectId: hasStoredActiveId
        ? snapshot.activeProjectId
        : activeProjects[0]?.id || null,
      themePreference: normalizeThemePreference(snapshot.themePreference),
      sidebarCollapsed: normalizeSidebarCollapsed(snapshot.sidebarCollapsed)
    };
  }

  if (snapshot.project) {
    const migrated = normalizeProjectBundle({
      id: createId(),
      project: snapshot.project,
      completion: snapshot.completion || createDefaultCompletionState(),
      publication: snapshot.publication || createDefaultPublicationState(),
      editing: snapshot.editing || createDefaultEditingState(),
      goals: snapshot.goals || [],
      snapshots: snapshot.snapshots || [],
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
  const rawView = snapshot?.activeView === "edit2" ? "edit" : snapshot?.activeView;
  const storedView = views.includes(rawView) ? rawView : DEFAULT_VIEW;
  const hasProjects = normalizedState.projects.length > 0;
  if (!hasProjects) return DEFAULT_VIEW;
  if (["projects", "create-project"].includes(storedView)) return storedView;
  return isProjectWorkspaceView(storedView) ? storedView : DEFAULT_VIEW;
}

function normalizeStoredLastWorkspaceView(snapshot) {
  const lastWorkspace = snapshot?.lastWorkspaceView === "edit2" ? "edit" : snapshot?.lastWorkspaceView;
  const activeWorkspace = snapshot?.activeView === "edit2" ? "edit" : snapshot?.activeView;
  if (PRIMARY_WORKSPACE_VIEWS.includes(lastWorkspace)) return lastWorkspace;
  if (PRIMARY_WORKSPACE_VIEWS.includes(activeWorkspace)) return activeWorkspace;
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
  const normalizedSessions = Array.isArray(bundle.sessions) ? bundle.sessions.map(normalizeSession) : [];
  const normalizedIssues = Array.isArray(bundle.issues) ? bundle.issues.map(normalizeIssue) : [];
  const normalizedEditing = normalizeEditingState(bundle.editing, normalizedIssues, normalizedSessions);
  const mergedProject = { ...cloneValue(defaultProjectTemplate.project), ...(bundle.project || {}) };
  const manuscriptType = normalizeProjectType(mergedProject.manuscriptType || mergedProject.projectType);
  const status = bundle.status === "archived" || bundle.project?.status === "archived" ? "archived" : "active";
  return {
    id: bundle.id || createId(),
    status,
    archivedAt: status === "archived" ? (bundle.archivedAt || bundle.project?.archivedAt || new Date().toISOString()) : "",
    project: {
      ...mergedProject,
      manuscriptType,
      structureUnitLabel: normalizeStructureUnitLabel(mergedProject.structureUnitLabel, manuscriptType)
    },
    completion: normalizeCompletionState(bundle.completion),
    publication: normalizePublicationState(bundle.publication),
    editing: normalizedEditing,
    plot: normalizePlotState(bundle.plot),
    goals: Array.isArray(bundle.goals) ? bundle.goals.map(normalizeGoal) : [],
    snapshots: Array.isArray(bundle.snapshots)
      ? bundle.snapshots.map((snapshot) => normalizeSessionSnapshot(snapshot, bundle))
      : [],
    sessions: normalizedSessions,
    issues: normalizedIssues,
    milestones: Array.isArray(bundle.milestones) ? bundle.milestones : []
  };
}

function isProjectArchived(bundle) {
  return bundle?.status === "archived";
}

function normalizeEditingState(editing, issues = [], sessions = []) {
  const mergedEditing = { ...createDefaultEditingState(), ...(editing || {}) };
  const focusKey = normalizeEditFocusKey(
    mergedEditing.focusKey,
    `${mergedEditing.passName || ""} ${mergedEditing.passStage || ""}`
  );
  return {
    ...mergedEditing,
    focusKey,
    passStage: "",
    passName: "",
    chapters: normalizeEditingChapters(mergedEditing.chapters, issues, sessions)
  };
}

function normalizeCompletionState(completion) {
  return {
    ...createDefaultCompletionState(),
    ...(completion || {}),
    isManuscriptComplete: Boolean(completion?.isManuscriptComplete),
    completedAt: String(completion?.completedAt || ""),
    completionWordCount: Math.max(0, number(completion?.completionWordCount))
  };
}

function normalizePublicationState(publication) {
  return {
    ...createDefaultPublicationState(),
    ...(publication || {}),
    isPublished: Boolean(publication?.isPublished),
    publishedAt: String(publication?.publishedAt || ""),
    publishedWordCount: Math.max(0, number(publication?.publishedWordCount))
  };
}

function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampText(value, maxLength = 140) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeSessionSnapshotType(value = "writing") {
  const normalized = String(value || "").trim().toLowerCase();
  return SESSION_SNAPSHOT_TYPES.includes(normalized) ? normalized : "writing";
}

function normalizeSessionSnapshotGoal(value = "draft", sessionType = "writing") {
  const normalized = String(value || "").trim().toLowerCase();
  if (SESSION_SNAPSHOT_GOALS.includes(normalized)) return normalized;
  if (sessionType === "editing") return "revise";
  if (sessionType === "research") return "fix";
  return "draft";
}

function normalizeSessionSnapshotOutcome(value = "partial") {
  const normalized = String(value || "").trim().toLowerCase();
  return SESSION_SNAPSHOT_OUTCOMES.includes(normalized) ? normalized : "partial";
}

function normalizeSessionSnapshotConfidence(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return SESSION_SNAPSHOT_CONFIDENCE_LEVELS.includes(normalized) ? normalized : "";
}

function computeSnapshotWordProgress(startWordCount, endWordCount, fallbackAdded = null, fallbackRemoved = null, fallbackNet = null) {
  const start = nullableNumber(startWordCount);
  const end = nullableNumber(endWordCount);
  if (start !== null && end !== null) {
    const delta = end - start;
    return {
      startWordCount: start,
      endWordCount: end,
      wordsAdded: delta > 0 ? delta : 0,
      wordsRemoved: delta < 0 ? Math.abs(delta) : 0,
      netWords: delta
    };
  }

  const wordsAdded = nullableNumber(fallbackAdded);
  const wordsRemoved = nullableNumber(fallbackRemoved);
  const netWords = nullableNumber(fallbackNet);

  return {
    startWordCount: start,
    endWordCount: end,
    wordsAdded,
    wordsRemoved,
    netWords: netWords !== null
      ? netWords
      : wordsAdded !== null || wordsRemoved !== null
        ? number(wordsAdded) - number(wordsRemoved)
        : null
  };
}

function getStructureUnitBySnapshotContext(bundle, structureUnitName = "", structureUnitId = "") {
  if (!bundle) return null;
  const units = bundle.editing?.chapters || [];
  const normalizedId = String(structureUnitId || "").trim();
  if (normalizedId) {
    const byId = units.find((unit) => unit.id === normalizedId);
    if (byId) return byId;
  }
  const normalizedName = String(structureUnitName || "").trim().toLowerCase();
  if (!normalizedName) return null;
  return units.find((unit) => String(unit.label || "").trim().toLowerCase() === normalizedName) || null;
}

function createSessionSnapshot(snapshot = {}, bundle = currentBundle()) {
  const projectBundle = bundle || currentBundle();
  const projectId = String(snapshot.projectId || projectBundle?.id || state.activeProjectId || "");
  const sessionType = normalizeSessionSnapshotType(
    snapshot.sessionType || (snapshot.type === "edit" ? "editing" : snapshot.type === "write" ? "writing" : "writing")
  );
  const matchedSession = Array.isArray(projectBundle?.sessions)
    ? projectBundle.sessions.find((session) => session.id === snapshot.id)
    : null;
  const startedAt = String(snapshot.startedAt || "").trim();
  const endedAt = String(snapshot.endedAt || snapshot.date || "").trim();
  const structureUnitName = clampText(snapshot.structureUnitName || snapshot.sectionLabel || "", 140);
  const matchedStructureUnit = getStructureUnitBySnapshotContext(projectBundle, structureUnitName, snapshot.structureUnitId);
  const focusKey = sessionType === "editing"
    ? normalizeEditFocusKey(
        snapshot.focusKey,
        matchedSession?.focusKey || snapshot.passName || projectBundle?.editing?.focusKey
      )
    : "";
  const wordProgress = computeSnapshotWordProgress(
    snapshot.startWordCount,
    snapshot.endWordCount,
    snapshot.wordsAdded ?? snapshot.wordsWritten,
    snapshot.wordsRemoved,
    snapshot.netWords
  );

  return {
    ...createDefaultSessionSnapshot(projectId),
    ...snapshot,
    id: String(snapshot.id || createId()),
    projectId,
    sessionType,
    startedAt,
    endedAt,
    durationMinutes: Math.max(1, number(snapshot.durationMinutes)),
    structureUnitId: String(snapshot.structureUnitId || matchedStructureUnit?.id || ""),
    structureUnitName,
    structureUnitType: clampText(
      snapshot.structureUnitType || getStructureUnitLower(projectBundle),
      40
    ).toLowerCase(),
    ...wordProgress,
    intendedGoal: normalizeSessionSnapshotGoal(snapshot.intendedGoal, sessionType),
    outcomeStatus: normalizeSessionSnapshotOutcome(snapshot.outcomeStatus),
    focusKey,
    accomplished: clampText(snapshot.accomplished, 140),
    nextStep: clampText(snapshot.nextStep, 140),
    blocker: clampText(snapshot.blocker, 180),
    confidenceLevel: normalizeSessionSnapshotConfidence(snapshot.confidenceLevel),
    excerpt: clampText(snapshot.excerpt, 500),
    notes: clampText(snapshot.notes || snapshot.sessionNotes, 280),
    issueIds: [...new Set((Array.isArray(snapshot.issueIds) ? snapshot.issueIds : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean))]
  };
}

function normalizeSessionSnapshot(snapshot, bundle = currentBundle()) {
  return createSessionSnapshot(snapshot, bundle);
}

function normalizeGoalType(type = "write_words") {
  const normalizedType = String(type || "").trim();
  return GOAL_TYPES.includes(normalizedType) ? normalizedType : "write_words";
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
    type: normalizeGoalType(goal?.type),
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
  const storedActiveSections = Array.isArray(plot?.activeSections) ? plot.activeSections : defaultPlot.activeSections;
  const activeSections = [...new Set(storedActiveSections)]
    .filter((sectionId) => PLOT_SECTION_IDS.includes(sectionId));
  const normalizedActiveSections = activeSections.length ? activeSections : [...defaultPlot.activeSections];
  const activeSection = normalizedActiveSections.includes(plot?.activeSection)
    ? plot.activeSection
    : normalizedActiveSections[0];
  const sections = Object.fromEntries(PLOT_SECTION_IDS.map((sectionId) => {
    const storedEntries = plot?.sections?.[sectionId] || plot?.[sectionId];
    return [sectionId, Array.isArray(storedEntries) ? storedEntries.map(normalizePlotEntry) : []];
  }));

  return {
    ...defaultPlot,
    ...plot,
    activeSection,
    activeSections: normalizedActiveSections,
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
  const isEditSession = session?.type === "edit";
  const focusKey = isEditSession
    ? normalizeEditFocusKey(session?.focusKey, session?.passName)
    : "";
  return {
    id: session?.id || createId(),
    type: isEditSession ? "edit" : "write",
    date: session?.date || new Date().toISOString(),
    durationMinutes: number(session?.durationMinutes),
    wordsWritten: number(session?.wordsWritten),
    wordsEdited: number(session?.wordsEdited),
    notes: String(session?.notes || ""),
    focusKey,
    passName: "",
    sectionLabel: String(session?.sectionLabel || "")
  };
}

function buildSnapshotFromSession(session, bundle = currentBundle()) {
  if (!session) return null;
  const sessionType = session.type === "edit" ? "editing" : "writing";
  const endedAt = String(session.date || "").trim();
  const startedAt = endedAt
    ? new Date(new Date(endedAt).getTime() - (Math.max(1, number(session.durationMinutes)) * 60000)).toISOString()
    : "";
  return createSessionSnapshot({
    id: session.id,
    projectId: bundle?.id || state.activeProjectId || "",
    sessionType,
    startedAt,
    endedAt,
    durationMinutes: Math.max(1, number(session.durationMinutes)),
    structureUnitName: session.sectionLabel || "",
    structureUnitType: getStructureUnitLower(bundle),
    wordsAdded: session.type === "edit" ? null : number(session.wordsWritten),
    wordsRemoved: null,
    netWords: session.type === "edit" ? null : number(session.wordsWritten),
    intendedGoal: sessionType === "editing" ? "revise" : "draft",
    outcomeStatus: "partial",
    focusKey: session.focusKey || "",
    notes: session.notes || ""
  }, bundle);
}

function getProjectSnapshots(projectId = state.activeProjectId, projects = state.projects) {
  const bundle = typeof projectId === "string"
    ? projects.find((project) => project.id === projectId)
    : projectId;
  if (!bundle) return [];
  return [...(bundle.snapshots || [])]
    .map((snapshot) => normalizeSessionSnapshot(snapshot, bundle))
    .sort((a, b) => new Date(b.endedAt || b.startedAt || 0) - new Date(a.endedAt || a.startedAt || 0));
}

function getSnapshotForSession(bundle, sessionId) {
  if (!bundle || !sessionId) return null;
  const saved = getProjectSnapshots(bundle).find((snapshot) => snapshot.id === sessionId);
  if (saved) return saved;
  const session = bundle.sessions.find((entry) => entry.id === sessionId);
  return session ? buildSnapshotFromSession(session, bundle) : null;
}

function getLatestSnapshot(projectId = state.activeProjectId, projects = state.projects) {
  const bundle = typeof projectId === "string"
    ? projects.find((project) => project.id === projectId)
    : projectId;
  if (!bundle) return null;
  const latestSaved = getProjectSnapshots(bundle)[0] || null;
  const latestSession = [...(bundle.sessions || [])]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0] || null;
  if (!latestSaved) return latestSession ? buildSnapshotFromSession(latestSession, bundle) : null;
  if (!latestSession) return latestSaved;
  const latestSavedDate = new Date(latestSaved.endedAt || latestSaved.startedAt || 0);
  const latestSessionDate = new Date(latestSession.date || 0);
  if (latestSessionDate > latestSavedDate) {
    return buildSnapshotFromSession(latestSession, bundle);
  }
  return latestSaved;
}

function upsertSessionSnapshot(bundle, snapshot) {
  if (!bundle || !snapshot) return bundle;
  const normalizedSnapshot = normalizeSessionSnapshot(snapshot, bundle);
  return {
    ...bundle,
    snapshots: [
      ...(bundle.snapshots || []).filter((entry) => entry.id !== normalizedSnapshot.id),
      normalizedSnapshot
    ].sort((a, b) => new Date(b.endedAt || b.startedAt || 0) - new Date(a.endedAt || a.startedAt || 0))
  };
}

function removeSessionSnapshot(bundle, snapshotId) {
  if (!bundle || !snapshotId) return bundle;
  return {
    ...bundle,
    snapshots: (bundle.snapshots || []).filter((snapshot) => snapshot.id !== snapshotId)
  };
}

function normalizeIssue(issue) {
  const status = String(issue?.status || "Open");
  const workflowStatus = status === "Resolved"
    ? "resolved"
    : issue?.workflowStatus === "in_progress"
      ? "in_progress"
      : "open";
  const focusKey = normalizeEditFocusKey(issue?.focusKey, issue?.passName);
  return {
    id: issue?.id || createId(),
    title: String(issue?.title || ""),
    type: String(issue?.type || "General"),
    sectionLabel: String(issue?.sectionLabel || issue?.section || ""),
    priority: String(issue?.priority || "Medium"),
    status,
    notes: String(issue?.notes || ""),
    snippet: String(issue?.snippet || ""),
    createdAt: issue?.createdAt || new Date().toISOString(),
    resolvedAt: status === "Resolved" ? (issue?.resolvedAt || issue?.createdAt || new Date().toISOString()) : "",
    focusKey,
    passName: "",
    workflowStatus,
    textLocation: String(issue?.textLocation || "")
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

function setPendingSessionSnapshotContext(snapshot) {
  pendingSessionSnapshotContext = snapshot ? cloneValue(snapshot) : null;
}

function getPendingSessionSnapshotContext() {
  return pendingSessionSnapshotContext ? cloneValue(pendingSessionSnapshotContext) : null;
}

function clearPendingSessionSnapshotContext() {
  pendingSessionSnapshotContext = null;
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

function formatRelativeTime(dateString, now = new Date()) {
  if (!dateString) return "recently";
  const date = new Date(dateString);
  const deltaMs = now.getTime() - date.getTime();
  const deltaMinutes = Math.max(0, Math.round(deltaMs / 60000));
  if (deltaMinutes < 1) return "just now";
  if (deltaMinutes < 60) return `${formatNumber(deltaMinutes)} minute${deltaMinutes === 1 ? "" : "s"} ago`;
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) return `${formatNumber(deltaHours)} hour${deltaHours === 1 ? "" : "s"} ago`;
  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays < 7) return `${formatNumber(deltaDays)} day${deltaDays === 1 ? "" : "s"} ago`;
  const deltaWeeks = Math.round(deltaDays / 7);
  if (deltaWeeks < 5) return `${formatNumber(deltaWeeks)} week${deltaWeeks === 1 ? "" : "s"} ago`;
  const deltaMonths = Math.round(deltaDays / 30);
  if (deltaMonths < 12) return `${formatNumber(deltaMonths)} month${deltaMonths === 1 ? "" : "s"} ago`;
  const deltaYears = Math.round(deltaDays / 365);
  return `${formatNumber(deltaYears)} year${deltaYears === 1 ? "" : "s"} ago`;
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

function sessionSnapshotTypeLabel(sessionType = "writing") {
  const normalized = normalizeSessionSnapshotType(sessionType);
  return {
    writing: "Writing",
    editing: "Editing",
    planning: "Planning",
    research: "Research"
  }[normalized] || "Writing";
}

function sessionSnapshotGoalLabel(goal = "draft") {
  const normalized = normalizeSessionSnapshotGoal(goal);
  return {
    draft: "Draft",
    revise: "Revise",
    fix: "Fix",
    proofread: "Proofread",
    custom: "Custom"
  }[normalized] || "Draft";
}

function sessionSnapshotOutcomeLabel(status = "partial") {
  const normalized = normalizeSessionSnapshotOutcome(status);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function defaultSnapshotNextStep(snapshot) {
  if (snapshot?.nextStep) return snapshot.nextStep;
  if (snapshot?.intendedGoal && snapshot.intendedGoal !== "custom") {
    const unitName = snapshot.structureUnitName ? ` on ${snapshot.structureUnitName}` : "";
    return {
      draft: `Continue drafting${unitName}`,
      revise: `Continue revising${unitName}`,
      fix: `Continue fixing the problem${unitName}`,
      proofread: `Continue proofreading${unitName}`
    }[snapshot.intendedGoal] || "";
  }
  if (snapshot?.structureUnitName) return `Continue work on ${snapshot.structureUnitName}`;
  return "Continue where you left off";
}

function formatSnapshotWordChange(snapshot) {
  if (!snapshot) return "No word change logged";
  const netWords = nullableNumber(snapshot.netWords);
  if (netWords !== null) {
    if (netWords > 0) return `+${formatNumber(netWords)} words`;
    if (netWords < 0) return `-${formatNumber(Math.abs(netWords))} words`;
    return "No net word change";
  }
  const wordsAdded = nullableNumber(snapshot.wordsAdded);
  const wordsRemoved = nullableNumber(snapshot.wordsRemoved);
  if (wordsAdded !== null && wordsAdded > 0) return `+${formatNumber(wordsAdded)} words`;
  if (wordsRemoved !== null && wordsRemoved > 0) return `-${formatNumber(wordsRemoved)} words`;
  return "No word change logged";
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
  const activeFocusKey = bundle?.editing?.focusKey || "revision";

  let minutesToday = 0;
  let minutesWeek = 0;
  let totalMinutes = 0;
  let totalWordsEdited = 0;
  let activeFocusMinutes = 0;

  sessions.forEach((session) => {
    const key = dateKey(session.date);
    const duration = number(session.durationMinutes);
    totalMinutes += duration;
    totalWordsEdited += number(session.wordsEdited);
    if (key === todayKey) minutesToday += duration;
    if (startOfDay(new Date(session.date)) >= weekStart) minutesWeek += duration;
    if (normalizeEditFocusKey(session.focusKey, session.passName) === activeFocusKey) activeFocusMinutes += duration;
  });

  const openIssues = bundle.issues.filter((issue) => issue.status !== "Resolved");
  const activeFocusIssues = openIssues.filter((issue) => normalizeEditFocusKey(issue.focusKey, issue.passName) === activeFocusKey);
  const resolvedIssues = bundle.issues.filter((issue) => issue.status === "Resolved");

  return {
    minutesToday,
    minutesWeek,
    totalMinutes,
    totalWordsEdited,
    activeFocusMinutes,
    averageSessionMinutes: totalMinutes / Math.max(1, sessions.length),
    sessionCount: sessions.length,
    activeFocusIssueCount: activeFocusIssues.length,
    resolvedIssueCount: resolvedIssues.length,
    lastSession: sessions[0] || null
  };
}

function isProjectPublished(bundle) {
  return Boolean(bundle?.publication?.isPublished);
}

function getOutstandingIssueCount(bundle) {
  if (!bundle) return 0;
  return bundle.issues.filter((issue) => issue.status !== "Resolved").length;
}

function getSnapshotIssueOptions(bundle, structureUnitName = "") {
  if (!bundle) return [];
  const priorityRank = { High: 0, Medium: 1, Low: 2 };
  const normalizedName = String(structureUnitName || "").trim().toLowerCase();
  const openIssues = [...(bundle.issues || [])]
    .filter((issue) => issue.status !== "Resolved")
    .sort((a, b) => {
      const priorityDelta = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  if (!normalizedName) return openIssues.slice(0, 6);
  const sectionMatches = openIssues.filter((issue) => String(issue.sectionLabel || "").trim().toLowerCase() === normalizedName);
  return (sectionMatches.length ? sectionMatches : openIssues).slice(0, 6);
}

function getPublishEligibility(bundle) {
  if (!bundle) {
    return {
      canPublish: false,
      manuscriptComplete: false,
      editingComplete: false,
      outstandingIssueCount: 0,
      remainingSections: 0,
      reasons: ["Select a project first."]
    };
  }

  const manuscriptComplete = Boolean(bundle.completion?.isManuscriptComplete);
  const outstandingIssueCount = getOutstandingIssueCount(bundle);
  const editingComplete = outstandingIssueCount === 0;
  const reasons = [];

  if (!manuscriptComplete) {
    reasons.push("Mark the manuscript complete in Write first.");
  }
  if (outstandingIssueCount > 0) {
    reasons.push(`Resolve the remaining ${formatNumber(outstandingIssueCount)} open or deferred issue${outstandingIssueCount === 1 ? "" : "s"} first.`);
  }

  return {
    canPublish: reasons.length === 0,
    manuscriptComplete,
    editingComplete,
    outstandingIssueCount,
    remainingSections: 0,
    reasons
  };
}

function goalValueForSession(goalType, session) {
  if (goalType === "write_minutes") return number(session.durationMinutes);
  if (session.type === "edit") return 0;
  return number(session.wordsWritten);
}

function goalValueForDate(bundle, goal, key) {
  if (goal.type === "structure_units_completed") {
    return (bundle.editing?.chapters || [])
      .filter((chapter) => chapter.completedAt && dateKey(chapter.completedAt) === key)
      .length;
  }
  if (goal.type === "issues_resolved") {
    return (bundle.issues || [])
      .filter((issue) => issue.status === "Resolved" && issue.resolvedAt && dateKey(issue.resolvedAt) === key)
      .length;
  }
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

function goalUnit(goalType, bundle = currentBundle()) {
  if (goalType === "write_minutes") return "minutes";
  if (goalType === "structure_units_completed") return getStructureUnitPlural(bundle).toLowerCase();
  if (goalType === "issues_resolved") return "issues";
  return "words";
}

function goalProgressText(goal, bundle = currentBundle()) {
  if (!goal.trackedToday) return "Not scheduled today";
  const value = formatNumber(goal.liveValue);
  const target = formatNumber(goal.targetValueToday);
  if (goal.type === "structure_units_completed") {
    return `${value} / ${target} ${goalUnit(goal.type, bundle)} completed`;
  }
  if (goal.type === "issues_resolved") {
    return `${value} / ${target} issues resolved`;
  }
  return `${value} / ${target} ${goalUnit(goal.type, bundle)}`;
}

function goalHistoryLabel(goalType, bundle = currentBundle()) {
  if (goalType === "write_minutes") return "minutes";
  if (goalType === "structure_units_completed") return `${goalUnit(goalType, bundle)} completed`;
  if (goalType === "issues_resolved") return "issues resolved";
  return "written";
}

function applyGoalTypePreset(form, goalType) {
  if (!form?.elements) return;
  const targetInput = form.elements.targetValue;
  const titleInput = form.elements.title;
  const targetLabel = document.getElementById("goal-target-label");
  if (!targetInput || !titleInput || !targetLabel) return;
  const normalizedType = normalizeGoalType(goalType);
  const unitPlural = getStructureUnitPlural(currentBundle()).toLowerCase();
  const unitSingular = getStructureUnitLower(currentBundle());
  const presets = {
    write_words: {
      defaultTarget: 1000,
      targetLabel: "Daily target (words)",
      placeholder: "Example: Write 1,000 words today",
      title: "Write 1,000 words today"
    },
    write_minutes: {
      defaultTarget: 60,
      targetLabel: "Daily target (minutes)",
      placeholder: "Example: Spend 60 focused minutes today",
      title: "Spend 60 focused minutes writing or editing"
    },
    structure_units_completed: {
      defaultTarget: 1,
      targetLabel: `Daily target (${unitPlural} completed)`,
      placeholder: `Example: Complete 1 ${unitSingular} today`,
      title: `Complete 1 ${unitSingular} today`
    },
    issues_resolved: {
      defaultTarget: 3,
      targetLabel: "Daily target (issues resolved)",
      placeholder: "Example: Resolve 3 editing issues today",
      title: "Resolve 3 editing issues today"
    }
  };
  const preset = presets[normalizedType] || presets.write_words;
  const defaultTarget = preset.defaultTarget;
  const dailySchedule = form.elements.scheduleMode?.value !== "custom_days";
  const previousPresetTitles = Object.values(presets).map((entry) => entry.title);
  const shouldReplaceTitle = !titleInput.value || previousPresetTitles.includes(titleInput.value);
  targetLabel.textContent = preset.targetLabel;
  if (dailySchedule || targetInput.value === "" || targetInput.dataset.goalType !== normalizedType) {
    targetInput.value = defaultTarget;
  }
  targetInput.dataset.goalType = normalizedType;
  titleInput.placeholder = preset.placeholder;
  if (shouldReplaceTitle) titleInput.value = preset.title;
  GOAL_DAY_KEYS.forEach((dayKey) => {
    const dayInput = form.elements[`target_${dayKey}`];
    if (!dayInput) return;
    if (dayInput.value === "" || dayInput.dataset.goalType !== normalizedType) {
      dayInput.value = String(defaultTarget);
    }
    dayInput.dataset.goalType = normalizedType;
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
  if (type === "write_minutes") return "FOCUS TIME";
  if (type === "structure_units_completed") return "STRUCTURE";
  if (type === "issues_resolved") return "ISSUES";
  return "WRITE";
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

function goalScheduleSummary(goal, bundle = currentBundle()) {
  const unit = goalUnit(goal.type, bundle);
  if (goal.scheduleMode !== "custom_days") {
    return `Every day: ${formatNumber(goal.targetValue)} ${unit}`;
  }

  const weekdayTargets = GOAL_DAY_KEYS.slice(0, 5).map((dayKey) => number(goal.dayTargets?.[dayKey]));
  const weekendTargets = GOAL_DAY_KEYS.slice(5).map((dayKey) => number(goal.dayTargets?.[dayKey]));
  const uniqueWeekdayTargets = [...new Set(weekdayTargets)];
  const uniqueWeekendTargets = [...new Set(weekendTargets)];

  if (uniqueWeekdayTargets.length === 1 && uniqueWeekendTargets.length === 1) {
    return `Weekdays ${formatNumber(uniqueWeekdayTargets[0])}, weekends ${formatNumber(uniqueWeekendTargets[0])} ${unit}`;
  }

  return GOAL_DAY_KEYS
    .map((dayKey) => `${GOAL_DAY_LABELS[dayKey]} ${formatNumber(goal.dayTargets?.[dayKey])}`)
    .join(" • ") + ` ${unit}`;
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
  const evaluatedGoal = {
    ...goal,
    liveValue: value,
    targetValueToday: target,
    trackedToday: true
  };
  return {
    id: goal.id,
    title: goal.title || {
      write_minutes: "Spend time writing or editing",
      structure_units_completed: `Complete ${getStructureUnitPlural(bundle).toLowerCase()}`,
      issues_resolved: "Resolve issues"
    }[goal.type] || "Write words",
    type: goal.type,
    status: goal.status === "archived" ? "archived" : "active",
    value,
    target,
    unit: goalUnit(goal.type, bundle),
    metricText: goalProgressText(evaluatedGoal, bundle),
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
    const trackedGoals = bundle.goals.filter((goal) => isGoalTrackedOnDate(goal, cursor));
    if (!trackedGoals.length) {
      const noGoalLines = [longDate, "No goals set", `${daySessions.length} ${daySessions.length === 1 ? "session" : "sessions"}`];
      days.push({
        key,
        status: "none",
        label: noGoalLines.join("\n"),
        dayNumber: cursor.getDate(),
        longDate,
        detailSummary: "No goals set",
        detailCopy: "No goals were active on this date.",
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
        <p class="muted">Start your first manuscript project to unlock the full Write, Story, Edit, and Goals workspace.</p>
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
    project_manuscript_type: bundle.project.manuscriptType || "Novel",
    project_structure_unit_label: getStructureUnitLabel(bundle),
    project_status: bundle.status || "active",
    project_archived_at: bundle.archivedAt || "",
    project_target_word_count: number(bundle.project.targetWordCount),
    project_current_word_count: number(bundle.project.currentWordCount),
    project_deadline: bundle.project.deadline || "",
    project_daily_target: number(bundle.project.dailyTarget),
    project_start_date: bundle.project.projectStartDate || "",
    project_manuscript_is_complete: bundle.completion?.isManuscriptComplete ? "true" : "false",
    project_manuscript_completed_at: bundle.completion?.completedAt || "",
    project_manuscript_completion_word_count: number(bundle.completion?.completionWordCount),
    project_is_published: bundle.publication?.isPublished ? "true" : "false",
    project_published_at: bundle.publication?.publishedAt || "",
    project_published_word_count: number(bundle.publication?.publishedWordCount),
    project_edit_pass_name: "",
    project_edit_pass_stage: "",
    project_edit_pass_status: bundle.editing.passStatus || "",
    project_edit_pass_objective: bundle.editing.passObjective || "",
    project_edit_progress_current: number(bundle.editing.progressCurrent),
    project_edit_progress_total: number(bundle.editing.progressTotal),
      chapter_id: "",
      chapter_label: "",
      chapter_summary: "",
      chapter_sort_order: "",
      chapter_completed_at: "",
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
    issue_snippet: "",
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
    session_notes: "",
    session_started_at: "",
    session_ended_at: "",
    session_structure_unit_id: "",
    session_structure_unit_type: "",
    session_start_word_count: "",
    session_end_word_count: "",
    session_words_added: "",
    session_words_removed: "",
    session_net_words: "",
    session_intended_goal: "",
    session_outcome_status: "",
    session_accomplished: "",
    session_next_step: "",
    session_blocker: "",
    session_confidence_level: "",
    session_excerpt: "",
    session_issue_ids: ""
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
    bundle.editing.chapters.forEach((chapter) => {
      rows.push({
        ...base,
        row_type: "chapter",
        chapter_id: chapter.id || "",
        chapter_label: chapter.label || "",
        chapter_summary: chapter.summary || "",
        chapter_sort_order: number(chapter.sortOrder),
        chapter_completed_at: chapter.completedAt || ""
      });
    });

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
        issue_snippet: issue.snippet || "",
        issue_created_at: issue.createdAt || "",
        issue_resolved_at: issue.resolvedAt || "",
        issue_pass_name: issue.passName || ""
      });
    });
  }

  bundle.sessions.forEach((session) => {
    if (mode === "write" && session.type === "edit") return;
    if (mode === "edit" && session.type !== "edit") return;
    const snapshot = getSnapshotForSession(bundle, session.id);
    rows.push({
      ...base,
      row_type: "session",
      session_id: session.id || "",
      session_type: session.type || "write",
      session_date: session.date || "",
      session_duration_minutes: number(session.durationMinutes),
      session_words_written: number(session.wordsWritten),
      session_words_edited: number(session.wordsEdited),
      session_pass_name: session.type === "edit"
        ? (session.passName || "")
        : "",
      session_section_label: session.sectionLabel || "",
      session_notes: session.notes || snapshot?.notes || "",
      session_started_at: snapshot?.startedAt || "",
      session_ended_at: snapshot?.endedAt || session.date || "",
      session_structure_unit_id: snapshot?.structureUnitId || "",
      session_structure_unit_type: snapshot?.structureUnitType || "",
      session_start_word_count: snapshot?.startWordCount ?? "",
      session_end_word_count: snapshot?.endWordCount ?? "",
      session_words_added: snapshot?.wordsAdded ?? "",
      session_words_removed: snapshot?.wordsRemoved ?? "",
      session_net_words: snapshot?.netWords ?? "",
      session_intended_goal: snapshot?.intendedGoal || "",
      session_outcome_status: snapshot?.outcomeStatus || "",
      session_accomplished: snapshot?.accomplished || "",
      session_next_step: snapshot?.nextStep || "",
      session_blocker: snapshot?.blocker || "",
      session_confidence_level: snapshot?.confidenceLevel || "",
      session_excerpt: snapshot?.excerpt || "",
      session_issue_ids: snapshot?.issueIds?.join("|") || ""
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
    status: projectRow.project_status === "archived" ? "archived" : "active",
    archivedAt: projectRow.project_archived_at || "",
    project: {
      bookTitle: projectRow.project_title || "Imported Manuscript",
      manuscriptType: projectRow.project_manuscript_type || "Novel",
      structureUnitLabel: projectRow.project_structure_unit_label || defaultStructureUnitForProjectType(projectRow.project_manuscript_type || "Novel"),
      targetWordCount: number(projectRow.project_target_word_count),
      currentWordCount: number(projectRow.project_current_word_count),
      deadline: projectRow.project_deadline || "",
      dailyTarget: number(projectRow.project_daily_target) || defaultProjectTemplate.project.dailyTarget,
      projectStartDate: projectRow.project_start_date || new Date().toISOString().slice(0, 10)
    },
    completion: {
      isManuscriptComplete: ["true", "1", "yes"].includes(String(projectRow.project_manuscript_is_complete || "").toLowerCase()),
      completedAt: projectRow.project_manuscript_completed_at || "",
      completionWordCount: number(projectRow.project_manuscript_completion_word_count)
    },
    publication: {
      isPublished: ["true", "1", "yes"].includes(String(projectRow.project_is_published || "").toLowerCase()),
      publishedAt: projectRow.project_published_at || "",
      publishedWordCount: number(projectRow.project_published_word_count)
    },
    editing: {
      focusKey: normalizeEditFocusKey(
        projectRow.project_edit_pass_name || projectRow.project_edit_pass_stage,
        "revision"
      ),
      passName: "",
      passStage: "",
      passStatus: projectRow.project_edit_pass_status || "",
      passObjective: projectRow.project_edit_pass_objective || "",
      progressCurrent: number(projectRow.project_edit_progress_current),
      progressTotal: number(projectRow.project_edit_progress_total),
      chapters: rows
        .filter((row) => row.row_type === "chapter")
        .map((row, index) => ({
          id: row.chapter_id || createId(),
          label: row.chapter_label || "",
          summary: row.chapter_summary || "",
          sortOrder: number(row.chapter_sort_order || index),
          completedAt: row.chapter_completed_at || ""
        }))
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
        snippet: row.issue_snippet || "",
        createdAt: row.issue_created_at || new Date().toISOString(),
        resolvedAt: row.issue_resolved_at || "",
        focusKey: normalizeEditFocusKey(row.issue_pass_name, projectRow.project_edit_pass_name || projectRow.project_edit_pass_stage),
        passName: row.issue_pass_name || ""
      })),
    snapshots: rows
      .filter((row) => row.row_type === "session")
      .map((row) => createSessionSnapshot({
        id: row.session_id || createId(),
        projectId: projectRow.project_id || "",
        sessionType: row.session_type === "edit" ? "editing" : "writing",
        startedAt: row.session_started_at || (
          row.session_date
            ? new Date(new Date(row.session_date).getTime() - (Math.max(1, number(row.session_duration_minutes)) * 60000)).toISOString()
            : ""
        ),
        endedAt: row.session_ended_at || row.session_date || "",
        durationMinutes: number(row.session_duration_minutes),
        structureUnitId: row.session_structure_unit_id || "",
        structureUnitName: row.session_section_label || "",
        structureUnitType: row.session_structure_unit_type || "",
        startWordCount: row.session_start_word_count,
        endWordCount: row.session_end_word_count,
        wordsAdded: row.session_words_added,
        wordsRemoved: row.session_words_removed,
        netWords: row.session_net_words,
        intendedGoal: row.session_intended_goal || "",
        outcomeStatus: row.session_outcome_status || "",
        focusKey: row.session_type === "edit"
          ? normalizeEditFocusKey(row.session_pass_name, projectRow.project_edit_pass_name || projectRow.project_edit_pass_stage)
          : "",
        accomplished: row.session_accomplished || "",
        nextStep: row.session_next_step || "",
        blocker: row.session_blocker || "",
        confidenceLevel: row.session_confidence_level || "",
        excerpt: row.session_excerpt || "",
        notes: row.session_notes || "",
        issueIds: String(row.session_issue_ids || "")
          .split("|")
          .map((value) => value.trim())
          .filter(Boolean)
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
        focusKey: row.session_type === "edit"
          ? normalizeEditFocusKey(row.session_pass_name, projectRow.project_edit_pass_name || projectRow.project_edit_pass_stage)
          : "",
        passName: row.session_pass_name || "",
        sectionLabel: row.session_section_label || "",
        notes: row.session_notes || ""
      })),
    milestones: []
  });

  bundle.goals = dedupeById(bundle.goals);
  bundle.snapshots = dedupeById(bundle.snapshots);
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
  activeView = isProjectPublished(importedBundle) ? "dashboard" : preferredWorkspaceView();
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
