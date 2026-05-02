let editSessionDraftMinutes = 45;
let activeEditingSession = null;
let editingSessionInFocusMode = true;
let pendingCompletedEditSession = null;
let loggingPastEditingSession = false;
let editSessionTimerHandle = null;
let editIssueFilters = createDefaultEditIssueFilters();
let editIssueBoardView = "current";
let editSessionGlobalActionsBound = false;

function createDefaultEditIssueFilters() {
  return {
    priority: "all",
    type: "all",
    section: "all",
    sort: "priority"
  };
}

function normalizeEditIssueFilters(filters, options = {}) {
  const defaults = createDefaultEditIssueFilters();
  const types = Array.isArray(options.types) ? options.types : [];
  const sections = Array.isArray(options.sections) ? options.sections : [];
  const allowedPriorities = ["all", "High", "Medium", "Low"];
  const allowedSorts = ["priority", "newest", "oldest", "section", "type"];

  return {
    priority: allowedPriorities.includes(filters?.priority) ? filters.priority : defaults.priority,
    type: types.includes(filters?.type) ? filters.type : defaults.type,
    section: sections.includes(filters?.section) ? filters.section : defaults.section,
    sort: allowedSorts.includes(filters?.sort) ? filters.sort : defaults.sort
  };
}

function getEditIssueFilterOptions(issues) {
  return {
    types: [...new Set(issues.map((issue) => String(issue.type || "General")).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
    sections: [...new Set(issues.map((issue) => String(issue.sectionLabel || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
  };
}

function compareEditIssuesByPriority(a, b) {
  const priorityRank = { High: 0, Medium: 1, Low: 2 };
  const statusRank = { Open: 0, Deferred: 1 };
  const statusDelta = (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99);
  if (statusDelta !== 0) return statusDelta;
  const priorityDelta = (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99);
  if (priorityDelta !== 0) return priorityDelta;
  return new Date(b.createdAt) - new Date(a.createdAt);
}

function getFilteredEditIssues(bundle, issues, filters) {
  const normalizedFilters = normalizeEditIssueFilters(filters, getEditIssueFilterOptions(issues));

  return [...issues]
    .filter((issue) => issue.status !== "Resolved")
    .filter((issue) => normalizedFilters.priority === "all" || issue.priority === normalizedFilters.priority)
    .filter((issue) => normalizedFilters.type === "all" || issue.type === normalizedFilters.type)
    .filter((issue) => normalizedFilters.section === "all" || issue.sectionLabel === normalizedFilters.section)
    .sort((a, b) => {
      if (normalizedFilters.sort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (normalizedFilters.sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (normalizedFilters.sort === "section") {
        const labelDelta = String(a.sectionLabel || "~").localeCompare(String(b.sectionLabel || "~"));
        return labelDelta || compareEditIssuesByPriority(a, b);
      }
      if (normalizedFilters.sort === "type") {
        const typeDelta = String(a.type || "").localeCompare(String(b.type || ""));
        return typeDelta || compareEditIssuesByPriority(a, b);
      }
      return compareEditIssuesByPriority(a, b);
    });
}

function buildEditSectionHotspots(bundle) {
  const hotspots = new Map();

  function getSectionEntry(sectionLabel) {
    const label = String(sectionLabel || "").trim();
    if (!label) return null;
    const key = label.toLowerCase();
    if (!hotspots.has(key)) {
      hotspots.set(key, {
        key,
        label,
        sessionCount: 0,
        totalMinutes: 0,
        wordsEdited: 0,
        openIssueCount: 0,
        deferredIssueCount: 0,
        resolvedIssueCount: 0,
        lastTouchedAt: ""
      });
    }
    return hotspots.get(key);
  }

  function markTouched(entry, dateValue) {
    if (!entry || !dateValue) return;
    if (!entry.lastTouchedAt || new Date(dateValue) > new Date(entry.lastTouchedAt)) {
      entry.lastTouchedAt = dateValue;
    }
  }

  bundle.issues
    .forEach((issue) => {
      const entry = getSectionEntry(issue.sectionLabel);
      if (!entry) return;
      if (issue.status === "Resolved") entry.resolvedIssueCount += 1;
      else if (issue.status === "Deferred") entry.deferredIssueCount += 1;
      else entry.openIssueCount += 1;
      markTouched(entry, issue.createdAt);
    });

  getEditSessions(bundle)
    .forEach((session) => {
      const entry = getSectionEntry(session.sectionLabel);
      if (!entry) return;
      entry.sessionCount += 1;
      entry.totalMinutes += number(session.durationMinutes);
      entry.wordsEdited += number(session.wordsEdited);
      markTouched(entry, session.date);
    });

  return [...hotspots.values()]
    .map((entry) => ({
      ...entry,
      pressureScore:
        (entry.openIssueCount * 4)
        + (entry.deferredIssueCount * 3)
        + entry.sessionCount
        + Math.min(4, Math.round(entry.totalMinutes / 30))
    }))
    .sort((a, b) => {
      const scoreDelta = b.pressureScore - a.pressureScore;
      if (scoreDelta !== 0) return scoreDelta;
      const dateDelta = new Date(b.lastTouchedAt || 0) - new Date(a.lastTouchedAt || 0);
      if (dateDelta !== 0) return dateDelta;
      return a.label.localeCompare(b.label);
    });
}

function getEditIssueRecommendationSignals(issue, hotspots, editStats) {
  const sectionKey = String(issue.sectionLabel || "").trim().toLowerCase();
  const sectionHotspot = hotspots.find((entry) => entry.key === sectionKey) || null;
  const priorityRank = { High: 3, Medium: 2, Low: 1 };
  const createdAt = issue.createdAt ? new Date(issue.createdAt) : null;
  const ageDays = createdAt ? Math.max(0, Math.round((Date.now() - createdAt.getTime()) / 86400000)) : 0;
  const lastTouchedDate = sectionHotspot?.lastTouchedAt || "";
  const lastTouchedLabel = lastTouchedDate ? formatDate(lastTouchedDate) : "";
  const sameAsLastSession = Boolean(editStats.lastSession?.sectionLabel && issue.sectionLabel && editStats.lastSession.sectionLabel === issue.sectionLabel);
  const unresolvedInSection = (sectionHotspot?.openIssueCount || 0) + (sectionHotspot?.deferredIssueCount || 0);

  return {
    priorityRank: priorityRank[issue.priority] || 0,
    unresolvedInSection,
    sessionCount: sectionHotspot?.sessionCount || 0,
    lastTouchedAt: lastTouchedDate,
    lastTouchedLabel,
    sameAsLastSession,
    ageDays
  };
}

function scoreEditIssueRecommendation(issue, signals, lens = "urgent") {
  const basePriorityScore = signals.priorityRank * 100;
  const sectionClusterScore = signals.unresolvedInSection * 12;
  const recentSectionScore = signals.sameAsLastSession ? 24 : Math.min(18, signals.sessionCount * 6);
  const ageScore = Math.min(30, signals.ageDays * 2);

  if (lens === "momentum") {
    return basePriorityScore + recentSectionScore + (sectionClusterScore * 0.7) + ageScore;
  }

  if (lens === "cleanup") {
    const isolatedSectionBonus = signals.unresolvedInSection <= 1 ? 18 : 0;
    return basePriorityScore + ageScore + isolatedSectionBonus + (signals.unresolvedInSection * 4);
  }

  return basePriorityScore + sectionClusterScore + ageScore + (signals.sameAsLastSession ? 8 : 0);
}

function describeEditRecommendationReason(issue, signals, lens = "urgent", unitLabel = "section") {
  const unitLower = unitLabel.toLowerCase();
  const reasonParts = [`${issue.priority} priority issue`];

  if (signals.unresolvedInSection >= 2) {
    reasonParts.push(`${formatNumber(signals.unresolvedInSection)} unresolved issues sit in ${issue.sectionLabel || `this ${unitLower}`}`);
  } else if (signals.unresolvedInSection === 1 && issue.sectionLabel) {
    reasonParts.push(`${issue.sectionLabel} is down to a single unresolved issue`);
  }

  if (lens === "momentum") {
    if (signals.sameAsLastSession && issue.sectionLabel) {
      reasonParts.push(`you edited ${issue.sectionLabel} most recently, so context should still be warm`);
    } else if (signals.lastTouchedLabel) {
      reasonParts.push(`this ${unitLower} was touched recently on ${signals.lastTouchedLabel}`);
    }
  } else if (lens === "cleanup") {
    if (signals.ageDays >= 1) {
      reasonParts.push(`it has been waiting since ${formatDate(issue.createdAt)}`);
    }
  } else if (signals.ageDays >= 1) {
    reasonParts.push(`it has been open since ${formatDate(issue.createdAt)}`);
  }

  return `${reasonParts.join(". ")}.`;
}

function buildEditIssueRecommendation(issue, signals, lens = "urgent", unitLabel = "Section") {
  const unitLower = unitLabel.toLowerCase();
  const labels = {
    urgent: "Most urgent",
    momentum: "Best momentum move",
    cleanup: "Best cleanup win",
    primary: "Best next move"
  };
  const descriptions = {
    urgent: issue.sectionLabel
      ? `Tackle ${issue.sectionLabel} by addressing "${issue.title}" first.`
      : `Address "${issue.title}" before lower-pressure edits start competing for attention.`,
    momentum: issue.sectionLabel
      ? `Stay in motion by continuing work in ${issue.sectionLabel}.`
      : `Use this issue as the easiest way to keep revision momentum going.`,
    cleanup: issue.sectionLabel
      ? `Use ${issue.sectionLabel} as a contained cleanup target.`
      : `This issue is a strong candidate for clearing something old off the board.`,
    primary: issue.sectionLabel
      ? `Start with ${issue.sectionLabel} so the highest-value issue there is handled first.`
      : "Start here because it is the strongest unresolved issue on the board."
  };

  return {
    label: labels[lens] || labels.primary,
    title: issue.title,
    description: descriptions[lens] || descriptions.primary,
    reason: describeEditRecommendationReason(issue, signals, lens, unitLower),
    badges: [
      issue.priority,
      issue.type,
      issue.sectionLabel || `No ${unitLower} tagged`
    ],
    primaryAction: "review-issue",
    primaryLabel: "Review issue",
    secondaryAction: issue.sectionLabel ? "filter-section" : "",
    secondaryLabel: issue.sectionLabel ? `Show ${unitLower} issues` : "",
    issueId: issue.id,
    filterSection: issue.sectionLabel || ""
  };
}

function buildFallbackEditRecommendation(bundle, editStats) {
  const unitLower = getStructureUnitLower(bundle);

  if (editStats.lastSession?.sectionLabel) {
    return {
      label: "Best next move",
      title: `Pick up from ${editStats.lastSession.sectionLabel}`,
      description: `That was the most recently edited ${unitLower}. Use it as the handoff point for your next revision session.`,
      reason: `There are no open issues on the board, so the recommendation falls back to your most recent editing context from ${formatDate(editStats.lastSession.date)}.`,
      badges: [
        formatDate(editStats.lastSession.date),
        `${formatNumber(editStats.sessionCount)} editing session${editStats.sessionCount === 1 ? "" : "s"} logged`,
        `${formatNumber(editStats.resolvedIssueCount)} resolved issue${editStats.resolvedIssueCount === 1 ? "" : "s"}`
      ],
      primaryAction: "add-issue",
      primaryLabel: "Log issue",
      secondaryAction: "",
      secondaryLabel: ""
    };
  }

  return {
    label: "Best next move",
    title: "Create the first revision anchor",
    description: "Start by logging an issue so the Edit workspace can begin steering what needs attention next.",
    reason: "Priority-led recommendations need at least one issue on the board. Until then, the safest suggestion is to start logging what you find.",
    badges: ["No edit history yet"],
    primaryAction: "add-issue",
    primaryLabel: "Add issue",
    secondaryAction: "",
    secondaryLabel: ""
  };
}

function deriveEditFocusRecommendations(bundle, unresolvedIssues, hotspots, editStats) {
  const activeFocusIssues = [...unresolvedIssues];

  if (!activeFocusIssues.length) {
    return [buildFallbackEditRecommendation(bundle, editStats)];
  }

  const signalsById = new Map(activeFocusIssues.map((issue) => [issue.id, getEditIssueRecommendationSignals(issue, hotspots, editStats)]));
  const rankIssues = (lens) => [...activeFocusIssues].sort((a, b) => {
    const scoreDelta = scoreEditIssueRecommendation(b, signalsById.get(b.id), lens) - scoreEditIssueRecommendation(a, signalsById.get(a.id), lens);
    if (scoreDelta !== 0) return scoreDelta;
    return compareEditIssuesByPriority(a, b);
  });

  const orderedCandidates = activeFocusIssues.length <= 2
    ? [{ lens: "primary", issues: rankIssues("urgent") }]
    : [
        { lens: "urgent", issues: rankIssues("urgent") },
        { lens: "momentum", issues: rankIssues("momentum") },
        { lens: "cleanup", issues: rankIssues("cleanup") }
      ];

  const usedIssueIds = new Set();
  const recommendations = [];
  const unitLabel = getStructureUnitLabel(bundle);

  orderedCandidates.forEach(({ lens, issues }) => {
    const nextIssue = issues.find((issue) => !usedIssueIds.has(issue.id));
    if (!nextIssue) return;
    usedIssueIds.add(nextIssue.id);
    recommendations.push(buildEditIssueRecommendation(nextIssue, signalsById.get(nextIssue.id), lens, unitLabel));
  });

  if (activeFocusIssues.length > 2 && recommendations.length < 3) {
    rankIssues("urgent").forEach((issue) => {
      if (recommendations.length >= 3 || usedIssueIds.has(issue.id)) return;
      usedIssueIds.add(issue.id);
      recommendations.push(buildEditIssueRecommendation(issue, signalsById.get(issue.id), "urgent", unitLabel));
    });
  }

  return recommendations;
}

function describeEditIssueFilterSummary(issues, filters) {
  if (!issues.length) return "No unresolved issues match these filters right now.";
  const extraFilters = [filters.priority, filters.type, filters.section].filter((value) => value && value !== "all");
  return `${formatNumber(issues.length)} unresolved issue${issues.length === 1 ? "" : "s"}${extraFilters.length ? ` filtered by ${extraFilters.join(", ")}` : ""}.`;
}

function compareResolvedEditIssues(a, b) {
  const dateDelta = new Date(b.resolvedAt || b.createdAt || 0) - new Date(a.resolvedAt || a.createdAt || 0);
  if (dateDelta !== 0) return dateDelta;
  return String(a.title || "").localeCompare(String(b.title || ""));
}

function getEditIssueSectionOptions(bundle) {
  const chapterLabels = Array.isArray(bundle?.editing?.chapters)
    ? bundle.editing.chapters.map((chapter) => normalizeChapterLabel(chapter.label))
    : [];
  const fallbackLabels = [
    ...(bundle?.issues || []).map((issue) => String(issue.sectionLabel || "").trim()),
    ...(bundle?.sessions || []).map((session) => String(session.sectionLabel || "").trim())
  ].filter(Boolean);
  const orderedLabels = [...new Set([...chapterLabels, ...fallbackLabels])];
  return orderedLabels.sort((a, b) => {
    const chapterIndexA = chapterLabels.indexOf(a);
    const chapterIndexB = chapterLabels.indexOf(b);
    if (chapterIndexA !== -1 && chapterIndexB !== -1) return chapterIndexA - chapterIndexB;
    if (chapterIndexA !== -1) return -1;
    if (chapterIndexB !== -1) return 1;
    return compareEditingChapterLabels(a, b);
  });
}

function getEditIssueDefaultPriority() {
  return "Medium";
}

const ISSUE_TITLE_WORD_LIMIT = 8;
const ISSUE_SECTION_UNIT_WORD_PATTERN = "zero|one|two|three|four|five|six|seven|eight|nine";
const ISSUE_SECTION_TEEN_WORD_PATTERN = "ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen";
const ISSUE_SECTION_TENS_WORD_PATTERN = "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety";
const ISSUE_SECTION_WORD_PATTERN = `(?:${ISSUE_SECTION_UNIT_WORD_PATTERN}|${ISSUE_SECTION_TEEN_WORD_PATTERN}|${ISSUE_SECTION_TENS_WORD_PATTERN})(?:[-\\s](?:one|two|three|four|five|six|seven|eight|nine))?`;
const ISSUE_SECTION_REGEX = new RegExp(`(chapter|scene|section)\\s+(?:\\d+|${ISSUE_SECTION_WORD_PATTERN})\\b`, "i");
const ISSUE_SECTION_NUMBER_WORDS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
};
const ISSUE_TYPE_RULES = [
  { type: "Dialogue", keywords: ["dialogue", "conversation", "line"] },
  { type: "Pacing", keywords: ["slow", "fast", "drag", "rush"] },
  { type: "Clarity", keywords: ["confusing", "unclear", "hard to follow"] },
  { type: "Character", keywords: ["motivation", "arc", "character"] },
  { type: "Grammar", keywords: ["grammar", "typo", "spelling"] }
];
const ISSUE_HIGH_PRIORITY_KEYWORDS = ["major", "critical", "big"];
const ISSUE_COMPLETION_RULE = /\b(fixed|resolve(?:d|s)?|finish(?:ed|es)?|complet(?:e|ed|es)|done|address(?:ed|es)|clarif(?:y|ied|ies)|tighten(?:ed|s)?|rewrote|rewrite|rework(?:ed|s)?|clean(?:ed)? up|cleaned|correct(?:ed|s)?|polish(?:ed|es)?|trim(?:med|s)?|cut|smoothed|improv(?:ed|es))\b/i;
const ISSUE_PARTIAL_PROGRESS_RULE = /\b(start(?:ed|ing)?|begin|began|continu(?:e|ed|ing)|next|later|todo|to do|still|partial|blocked|need(?:ed|s)?|remaining|left)\b/i;
const ISSUE_TEXT_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "i",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "them",
  "there",
  "this",
  "those",
  "to",
  "was",
  "were",
  "with"
]);
const ISSUE_TYPE_MATCH_KEYWORDS = {
  Dialogue: ["dialogue", "conversation", "line", "lines"],
  Pacing: ["pacing", "slow", "fast", "drag", "drags", "dragging", "rush", "rushed"],
  Clarity: ["clarity", "clear", "clarified", "clarify", "confusing", "unclear"],
  Character: ["character", "motivation", "arc"],
  Grammar: ["grammar", "typo", "proof", "proofread", "proofreading"],
  Continuity: ["continuity", "consistency"],
  Prose: ["prose", "sentence", "sentences"],
  Research: ["research", "fact", "facts"],
  "Scene logic": ["scene", "logic"],
  General: []
};

function normalizeIssueNoteText(note = "") {
  return String(note || "").replace(/\s+/g, " ").trim();
}

function normalizeIssueComparisonText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeIssueComparisonText(value = "", options = {}) {
  const allowShort = options.allowShort === true;
  return normalizeIssueComparisonText(value)
    .split(" ")
    .filter((token) => token)
    .filter((token) => allowShort || token.length >= 3 || /^\d+$/.test(token))
    .filter((token) => !ISSUE_TEXT_STOP_WORDS.has(token));
}

function issueTextIncludesKeyword(text = "", keyword = "") {
  const normalizedText = normalizeIssueComparisonText(text);
  const normalizedKeyword = normalizeIssueComparisonText(keyword);
  if (!normalizedText || !normalizedKeyword) return false;
  return new RegExp(`(^|\\s)${normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(normalizedText);
}

function deriveIssueTitleFromNote(note = "") {
  const normalizedNote = normalizeIssueNoteText(note);
  if (!normalizedNote) return "Untitled issue";
  const words = normalizedNote.split(" ").filter(Boolean);
  return words.slice(0, Math.min(ISSUE_TITLE_WORD_LIMIT, words.length)).join(" ");
}

function parseIssueSectionNumber(value = "") {
  const normalizedValue = normalizeIssueNoteText(value);
  if (/^\d+$/.test(normalizedValue)) return normalizedValue;

  const wordTokens = normalizeIssueComparisonText(normalizedValue)
    .split(" ")
    .filter(Boolean);
  if (!wordTokens.length) return normalizedValue;
  if (!wordTokens.every((token) => Object.prototype.hasOwnProperty.call(ISSUE_SECTION_NUMBER_WORDS, token))) {
    return normalizedValue;
  }
  return String(wordTokens.reduce((total, token) => total + ISSUE_SECTION_NUMBER_WORDS[token], 0));
}

function formatDerivedIssueSection(match = "") {
  const normalizedMatch = String(match || "")
    .replace(/\s+/g, " ")
    .trim();
  const sectionParts = normalizedMatch.match(/^(chapter|scene|section)\s+(.+)$/i);
  if (!sectionParts) return normalizedMatch;
  const sectionType = sectionParts[1].charAt(0).toUpperCase() + sectionParts[1].slice(1).toLowerCase();
  return `${sectionType} ${parseIssueSectionNumber(sectionParts[2])}`;
}

function getLastActiveIssueSectionLabel(bundle = currentBundle()) {
  const currentChapterLabel = getCurrentEdit2ChapterLabel(bundle);
  if (currentChapterLabel) return currentChapterLabel;
  const pendingSnapshot = getPendingSessionSnapshotContext();
  if (pendingSnapshot?.structureUnitName) return pendingSnapshot.structureUnitName;
  const lastSessionLabel = getEditStats(bundle).lastSession?.sectionLabel || "";
  return String(lastSessionLabel || "").trim();
}

function getIssueCreationContext(context = currentBundle()) {
  if (context?.bundle) {
    return {
      bundle: context.bundle,
      lastActiveSection: String(context.lastActiveSection || "").trim(),
      timestamp: context.timestamp || "",
      focusKey: context.focusKey || context.bundle?.editing?.focusKey || "revision",
      snippet: String(context.snippet || "")
    };
  }
  return {
    bundle: context || currentBundle(),
    lastActiveSection: "",
    timestamp: "",
    focusKey: context?.editing?.focusKey || "revision",
    snippet: String(context?.snippet || "")
  };
}

function deriveIssueSectionFromNote(note = "", bundle = currentBundle()) {
  const issueContext = getIssueCreationContext(bundle);
  const matchedSection = String(note || "").match(ISSUE_SECTION_REGEX);
  if (matchedSection?.[0]) return formatDerivedIssueSection(matchedSection[0]);
  const lastActiveSection = issueContext.lastActiveSection || getLastActiveIssueSectionLabel(issueContext.bundle);
  return normalizeChapterLabel(lastActiveSection || "Unassigned");
}

function deriveIssueTypeFromNote(note = "") {
  const normalizedNote = normalizeIssueNoteText(note).toLowerCase();
  const matchedRule = ISSUE_TYPE_RULES.find((rule) => rule.keywords.some((keyword) => normalizedNote.includes(keyword)));
  return matchedRule?.type || "General";
}

function deriveIssuePriorityFromNote(note = "") {
  const normalizedNote = normalizeIssueNoteText(note).toLowerCase();
  return ISSUE_HIGH_PRIORITY_KEYWORDS.some((keyword) => normalizedNote.includes(keyword)) ? "High" : "Medium";
}

function deriveIssueFieldsFromNote(note = "", bundle = currentBundle()) {
  const rawNote = String(note || "");
  return {
    title: deriveIssueTitleFromNote(rawNote),
    sectionLabel: deriveIssueSectionFromNote(rawNote, bundle),
    type: deriveIssueTypeFromNote(rawNote),
    priority: deriveIssuePriorityFromNote(rawNote),
    notes: rawNote
  };
}

function createIssueFromNote(note = "", context = {}) {
  const issueContext = getIssueCreationContext(context);
  const derivedIssue = deriveIssueFieldsFromNote(note, issueContext);
  return normalizeIssue({
    id: context.id || createId(),
    title: derivedIssue.title,
    type: derivedIssue.type,
    priority: derivedIssue.priority,
    sectionLabel: derivedIssue.sectionLabel,
    notes: derivedIssue.notes,
    snippet: issueContext.snippet || "",
    createdAt: context.timestamp || new Date().toISOString(),
    status: "Open",
    focusKey: issueContext.focusKey || "revision",
    passName: "",
    workflowStatus: "open",
    textLocation: String(context.textLocation || "")
  });
}

function formatIssueDraftPreview(note = "", bundle = currentBundle()) {
  const normalizedNote = normalizeIssueNoteText(note);
  if (!normalizedNote) return "";
  const derivedIssue = deriveIssueFieldsFromNote(normalizedNote, bundle);
  return `Will file under ${derivedIssue.sectionLabel} | ${derivedIssue.type} | ${derivedIssue.priority} priority.`;
}

function syncIssueDraftPreview(note = "", bundle = currentBundle()) {
  const preview = document.getElementById("issue-derived-preview");
  const form = document.getElementById("issue-form");
  if (!preview || !form) return;

  if (form.dataset.mode === "edit") {
    preview.textContent = "";
    preview.classList.add("hidden");
    return;
  }

  const previewCopy = formatIssueDraftPreview(note, bundle);
  preview.textContent = previewCopy;
  preview.classList.toggle("hidden", !previewCopy);
}

function getIssueMatchKeywords(issue = {}) {
  return tokenizeIssueComparisonText([
    issue.title || "",
    issue.notes || "",
    issue.type || ""
  ].join(" "));
}

function getIssueTypeMatchKeywordList(issueType = "General") {
  const mappedKeywords = ISSUE_TYPE_MATCH_KEYWORDS[String(issueType || "General")] || [];
  return [...new Set([
    ...mappedKeywords,
    ...tokenizeIssueComparisonText(issueType, { allowShort: true })
  ])];
}

function scoreIssueMatchAgainstText(text = "", issue = {}, context = {}) {
  const normalizedText = normalizeIssueComparisonText(text);
  const textKeywords = new Set(tokenizeIssueComparisonText(text, { allowShort: true }));
  const issueKeywords = getIssueMatchKeywords(issue);
  const overlapCount = issueKeywords.filter((keyword) => textKeywords.has(keyword)).length;
  const sectionBonus = issue.sectionLabel && normalizeIssueComparisonText(issue.sectionLabel)
    && normalizedText.includes(normalizeIssueComparisonText(issue.sectionLabel))
    ? 1
    : 0;
  const typeBonus = getIssueTypeMatchKeywordList(issue.type).some((keyword) => textKeywords.has(keyword)) ? 1 : 0;
  const titlePhrase = normalizeIssueComparisonText(issue.title || "");
  const titleBonus = titlePhrase && titlePhrase.length > 8 && normalizedText.includes(titlePhrase) ? 2 : 0;
  const selectedBonus = Array.isArray(context.selectedIssueIds) && context.selectedIssueIds.includes(issue.id) ? 1 : 0;

  return overlapCount + sectionBonus + typeBonus + titleBonus + selectedBonus;
}

function shouldAutoResolveFromAccomplished(accomplished = "", outcomeStatus = "partial") {
  const normalizedAccomplished = normalizeIssueNoteText(accomplished);
  if (!normalizedAccomplished) return false;
  if (String(outcomeStatus || "").toLowerCase() === "blocked") return false;
  const hasCompletionCue = ISSUE_COMPLETION_RULE.test(normalizedAccomplished) || String(outcomeStatus || "").toLowerCase() === "completed";
  const onlyPartialCue = ISSUE_PARTIAL_PROGRESS_RULE.test(normalizedAccomplished) && !ISSUE_COMPLETION_RULE.test(normalizedAccomplished);
  return hasCompletionCue && !onlyPartialCue;
}

function getAutoResolvedIssueIdsFromSession(accomplished = "", issues = [], context = {}) {
  if (!shouldAutoResolveFromAccomplished(accomplished, context.outcomeStatus)) return [];
  return issues
    .filter((issue) => issue.status !== "Resolved")
    .filter((issue) => {
      const score = scoreIssueMatchAgainstText(accomplished, issue, context);
      if (Array.isArray(context.selectedIssueIds) && context.selectedIssueIds.includes(issue.id)) {
        return score >= 1;
      }
      return score >= 2;
    })
    .map((issue) => issue.id);
}

function findExistingIssueForNote(note = "", issues = [], context = {}) {
  const normalizedNote = normalizeIssueNoteText(note);
  if (!normalizedNote) return null;

  const derivedIssue = deriveIssueFieldsFromNote(normalizedNote, context);
  const normalizedDerivedTitle = normalizeIssueComparisonText(derivedIssue.title);
  const normalizedDerivedNote = normalizeIssueComparisonText(normalizedNote);
  const derivedKeywords = new Set(tokenizeIssueComparisonText(normalizedNote, { allowShort: true }));

  return issues.find((issue) => {
    const normalizedIssueTitle = normalizeIssueComparisonText(issue.title || "");
    const normalizedIssueNote = normalizeIssueComparisonText(issue.notes || "");
    if (normalizedDerivedNote && (normalizedDerivedNote === normalizedIssueNote || normalizedDerivedNote === normalizedIssueTitle)) {
      return true;
    }
    if (normalizedDerivedTitle && (
      normalizedDerivedTitle === normalizedIssueTitle
      || (normalizedIssueTitle && normalizedIssueTitle.includes(normalizedDerivedTitle))
      || (normalizedDerivedTitle && normalizedDerivedTitle.includes(normalizedIssueTitle))
    )) {
      return true;
    }
    const keywordOverlap = getIssueMatchKeywords(issue).filter((keyword) => derivedKeywords.has(keyword)).length;
    const sameSection = normalizeChapterLabel(issue.sectionLabel) === normalizeChapterLabel(derivedIssue.sectionLabel);
    const sameType = String(issue.type || "General") === derivedIssue.type;
    return sameSection && sameType && keywordOverlap >= 2;
  }) || null;
}

function maybeCreateNextStepIssue(nextStep = "", issues = [], context = {}) {
  const normalizedNextStep = normalizeIssueNoteText(nextStep);
  if (!normalizedNextStep) {
    return {
      issues: [...issues],
      createdIssue: null,
      matchedIssue: null
    };
  }

  const matchedIssue = findExistingIssueForNote(normalizedNextStep, issues, context);
  if (matchedIssue) {
    return {
      issues: [...issues],
      createdIssue: null,
      matchedIssue
    };
  }

  const createdIssue = createIssueFromNote(normalizedNextStep, context);
  return {
    issues: [createdIssue, ...issues],
    createdIssue,
    matchedIssue: null
  };
}

function applyEditSessionIssueAutomation(issues = [], context = {}) {
  const normalizedIssues = Array.isArray(issues) ? [...issues] : [];
  const resolvedIssueIds = getAutoResolvedIssueIdsFromSession(context.accomplished, normalizedIssues, context);
  const resolvedIssueIdSet = new Set(resolvedIssueIds);
  const issuesAfterResolution = normalizedIssues.map((issue) => {
    if (!resolvedIssueIdSet.has(issue.id)) return issue;
    return normalizeIssue({
      ...issue,
      status: "Resolved",
      workflowStatus: "resolved",
      resolvedAt: issue.resolvedAt || context.timestamp || new Date().toISOString()
    });
  });
  const nextStepResult = maybeCreateNextStepIssue(context.nextStep, issuesAfterResolution, context);

  return {
    issues: nextStepResult.issues,
    resolvedIssueIds,
    createdIssue: nextStepResult.createdIssue,
    matchedNextIssue: nextStepResult.matchedIssue
  };
}

function getCurrentEdit2ChapterLabel(bundle) {
  if (activeView !== "edit" || !edit2SelectedChapterKey) return "";
  return buildEdit2Chapters(bundle).chapters.find((chapter) => chapter.key === edit2SelectedChapterKey)?.label || "";
}

function renderEditDashboard(bundle) {
  bindEditDashboardEvents(bundle);
}


function bindEditDashboardEvents(bundle) {
  bindEditSessionGlobalActions();
  const editSessionModal = document.getElementById("edit-session-modal");
  const issueModal = document.getElementById("issue-modal");
  const editSessionForm = document.getElementById("edit-session-form");
  const issueForm = document.getElementById("issue-form");
  const issueFilterForm = document.getElementById("edit-issue-filters-form");
  const issueViewButtons = document.querySelectorAll("[data-edit-issue-view]");
  const endEditSessionButton = document.getElementById("end-edit-session-btn");
  const leaveEditFocusModeButton = document.getElementById("leave-edit-focus-mode-btn");
  const cancelEndEditSessionButton = document.getElementById("cancel-end-edit-session-btn");
  const confirmEndEditSessionButton = document.getElementById("confirm-end-edit-session-btn");
  const openIssueButton = document.getElementById("open-issue-modal-btn");
  const resetIssueFiltersButton = document.getElementById("reset-edit-issue-filters-btn");
  const viewAllSessionsButton = document.getElementById("view-all-edit-sessions-btn");
  const closeEditSessionButton = document.getElementById("close-edit-session-btn");
  const closeIssueButton = document.getElementById("close-issue-modal-btn");

  if (endEditSessionButton) {
    endEditSessionButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      openEndEditSessionConfirmModal();
    };
  }

  if (leaveEditFocusModeButton) {
    leaveEditFocusModeButton.onclick = () => {
      leaveEditingFocusMode();
    };
  }

  if (cancelEndEditSessionButton) {
    cancelEndEditSessionButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeEndEditSessionConfirmModal();
    };
  }

  if (confirmEndEditSessionButton) {
    confirmEndEditSessionButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeEndEditSessionConfirmModal();
      finishActiveEditingSession(false);
    };
  }

  if (openIssueButton) {
    openIssueButton.onclick = () => {
      openIssueModal();
    };
  }

  if (issueFilterForm) {
    issueFilterForm.onchange = () => {
      editIssueFilters = {
        priority: String(issueFilterForm.elements.priority?.value || "all"),
        type: String(issueFilterForm.elements.type?.value || "all"),
        section: String(issueFilterForm.elements.section?.value || "all"),
        sort: String(issueFilterForm.elements.sort?.value || "priority")
      };
      render();
    };
  }

  issueViewButtons.forEach((button) => {
    button.onclick = () => {
      editIssueBoardView = button.dataset.editIssueView === "resolved" ? "resolved" : "current";
      render();
    };
  });

  if (resetIssueFiltersButton) {
    resetIssueFiltersButton.onclick = () => {
      editIssueFilters = createDefaultEditIssueFilters();
      render();
    };
  }

  if (viewAllSessionsButton) {
    viewAllSessionsButton.onclick = () => {
      sessionsReturnView = "edit";
      activeView = "sessions";
      render();
    };
  }

  if (closeEditSessionButton) {
    closeEditSessionButton.onclick = () => {
      closeEditSessionModal();
    };
  }

  if (closeIssueButton) {
    closeIssueButton.onclick = () => {
      closeIssueModal();
    };
  }

  if (editSessionModal) {
    editSessionModal.onclick = (event) => {
      if (event.target === editSessionModal) closeEditSessionModal();
    };
  }

  const endEditSessionConfirmModal = document.getElementById("end-edit-session-confirm-modal");
  if (endEditSessionConfirmModal) {
    endEditSessionConfirmModal.onclick = (event) => {
      if (event.target === endEditSessionConfirmModal) closeEndEditSessionConfirmModal();
    };
  }

  if (issueModal) {
    issueModal.onclick = (event) => {
      if (event.target === issueModal) closeIssueModal();
    };
  }

  if (editSessionForm) {
    editSessionForm.onsubmit = (event) => {
      event.preventDefault();
      const formData = new FormData(editSessionForm);
      const isEditingExisting = Boolean(editingEditSessionId);
      const existingSnapshot = isEditingExisting ? getSnapshotForSession(bundle, editingEditSessionId) : null;
      const structureUnitName = String(formData.get("sectionLabel") || "").trim();
      const outcomeStatus = String(formData.get("sessionOutcomeStatus") || "partial");
      const accomplished = String(formData.get("sessionAccomplished") || "").trim();
      const nextStep = String(formData.get("sessionNextStep") || "").trim();
      const blocker = String(formData.get("sessionBlocker") || "").trim();
      const confidenceLevel = String(formData.get("sessionConfidenceLevel") || "").trim();
      const excerpt = String(formData.get("sessionExcerpt") || "").trim();
      const issueIds = readSelectedSessionIssueIds("edit-session-issue-links-field");
      const sessionFocusKey = normalizeEditFocusKey(
        existingSnapshot?.focusKey || pendingCompletedEditSession?.focusKey || bundle.editing.focusKey
      );
      const sessionTimestamp = pendingCompletedEditSession?.endedAt || new Date().toISOString();
      const session = normalizeSession({
        id: editingEditSessionId || createId(),
        type: "edit",
        date: new Date(`${formData.get("sessionDate")}T12:00:00`).toISOString(),
        durationMinutes: Math.max(1, number(formData.get("durationMinutes"))),
        wordsEdited: Math.max(0, number(formData.get("wordsEdited"))),
        notes: String(formData.get("sessionNotes") || "").trim(),
        focusKey: sessionFocusKey,
        passName: "",
        sectionLabel: structureUnitName
      });
      let automationResult = null;

      updateCurrentBundle((projectBundle) => {
        const snapshotToPreserve = isEditingExisting ? getSnapshotForSession(projectBundle, editingEditSessionId) : null;
        const linkedIssueIds = [...issueIds];
        const nextIssues = !isEditingExisting
          ? (() => {
              automationResult = applyEditSessionIssueAutomation(projectBundle.issues, {
                bundle: projectBundle,
                lastActiveSection: structureUnitName,
                timestamp: sessionTimestamp,
                focusKey: sessionFocusKey,
                outcomeStatus,
                accomplished,
                nextStep,
                selectedIssueIds: issueIds
              });
              return automationResult.issues;
            })()
          : projectBundle.issues;
        const linkedIssueIdSet = new Set(linkedIssueIds);
        if (automationResult?.createdIssue?.id) linkedIssueIdSet.add(automationResult.createdIssue.id);
        if (automationResult?.matchedNextIssue?.id) linkedIssueIdSet.add(automationResult.matchedNextIssue.id);
        (automationResult?.resolvedIssueIds || []).forEach((issueId) => linkedIssueIdSet.add(issueId));
        const updatedBundle = {
          ...projectBundle,
          issues: nextIssues,
          sessions: isEditingExisting
            ? projectBundle.sessions.map((item) => item.id === editingEditSessionId ? session : item)
            : [session, ...projectBundle.sessions]
        };
        return upsertSessionSnapshot(updatedBundle, createSessionSnapshot({
          id: session.id,
          projectId: projectBundle.id,
          sessionType: "editing",
          startedAt: snapshotToPreserve?.startedAt || pendingCompletedEditSession?.startedAt || (
            session.date
              ? new Date(new Date(session.date).getTime() - (Math.max(1, number(session.durationMinutes)) * 60000)).toISOString()
              : ""
          ),
          endedAt: session.date,
          durationMinutes: Math.max(1, number(session.durationMinutes)),
          structureUnitId: snapshotToPreserve?.structureUnitId || "",
          structureUnitName,
          structureUnitType: snapshotToPreserve?.structureUnitType || getStructureUnitLower(projectBundle),
          startWordCount: snapshotToPreserve?.startWordCount,
          endWordCount: formData.get("sessionEndWordCount"),
          wordsAdded: snapshotToPreserve?.wordsAdded,
          wordsRemoved: snapshotToPreserve?.wordsRemoved,
          netWords: snapshotToPreserve?.netWords,
          intendedGoal: snapshotToPreserve?.intendedGoal || "revise",
          outcomeStatus,
          focusKey: sessionFocusKey,
          accomplished,
          nextStep,
          blocker,
          confidenceLevel,
          excerpt,
          notes: String(formData.get("sessionNotes") || "").trim(),
          issueIds: [...linkedIssueIdSet]
        }, projectBundle));
      });

      closeEditSessionModal();
      persistAndRender();
      const createdIssueTitle = automationResult?.createdIssue?.title || "";
      const matchedIssueTitle = automationResult?.matchedNextIssue?.title || "";
      const resolvedCount = automationResult?.resolvedIssueIds?.length || 0;
      let toastCopy = "Your revision work is now part of the Edit workspace.";
      if (!isEditingExisting && createdIssueTitle) {
        toastCopy = `Created "${createdIssueTitle}" from your next step and saved the session handoff.`;
      } else if (!isEditingExisting && matchedIssueTitle) {
        toastCopy = `Linked your next step to "${matchedIssueTitle}" and saved the session handoff.`;
      } else if (!isEditingExisting && resolvedCount) {
        toastCopy = `Updated ${formatNumber(resolvedCount)} linked issue${resolvedCount === 1 ? "" : "s"} from the session handoff.`;
      }
      showToast(isEditingExisting ? "Editing session updated" : "Editing session logged", toastCopy);
    };
  }

  if (issueForm) {
    issueForm.onchange = (event) => {
      const target = event.target;
      if (!target?.name) return;

      if (target.name === "priority") {
        issueForm.dataset.priorityTouched = "true";
      }
    };

    issueForm.onsubmit = (event) => {
      event.preventDefault();
      const formData = new FormData(issueForm);
      const isEditingExisting = Boolean(editingIssueId);
      const existingIssue = isEditingExisting
        ? bundle.issues.find((item) => item.id === editingIssueId)
        : null;
      const note = String(formData.get("note") || "");
      const snippet = String(formData.get("snippet") || "");
      if (!isEditingExisting && !normalizeIssueNoteText(note)) {
        showToast("Add a note", "A short note is enough. Jot what you noticed and we’ll place it for you.");
        issueForm.elements.note?.focus();
        return;
      }
      const issuePassKey = normalizeEdit2PassKey(existingIssue?.focusKey || bundle.editing.focusKey);
      const nextWorkflowStatusRaw = String(
        isEditingExisting
          ? (
              formData.get("issueStatus")
              || (existingIssue?.status === "Resolved"
                ? "resolved"
                : existingIssue?.workflowStatus || "open")
            )
          : "open"
      );
      const nextWorkflowStatus = nextWorkflowStatusRaw === "resolved"
        ? "resolved"
        : nextWorkflowStatusRaw === "in_progress"
          ? "in_progress"
          : "open";
      const nextStatus = nextWorkflowStatus === "resolved" ? "Resolved" : "Open";
      const createdIssue = isEditingExisting
        ? null
        : createIssueFromNote(note, {
            bundle,
            focusKey: issuePassKey,
            timestamp: new Date().toISOString(),
            snippet
          });
      const issue = isEditingExisting
        ? normalizeIssue({
            id: editingIssueId || createId(),
            title: String(formData.get("title") || "").trim(),
            type: String(formData.get("type") || "General"),
            sectionLabel: String(formData.get("sectionLabel") || "").trim(),
            priority: String(formData.get("priority") || existingIssue?.priority || getEditIssueDefaultPriority(issuePassKey)),
            status: nextStatus,
            notes: note,
            snippet,
            createdAt: existingIssue?.createdAt || new Date().toISOString(),
            resolvedAt: nextStatus === "Resolved"
              ? existingIssue?.resolvedAt || new Date().toISOString()
              : "",
            focusKey: issuePassKey,
            passName: "",
            workflowStatus: nextWorkflowStatus,
            textLocation: existingIssue?.textLocation || ""
          })
        : createdIssue;

      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        issues: isEditingExisting
          ? projectBundle.issues.map((item) => item.id === editingIssueId ? issue : item)
          : [issue, ...projectBundle.issues]
      }));

      editIssueBoardView = issue.status === "Resolved" ? "resolved" : "current";
      closeIssueModal();
      persistAndRender();
      showToast(isEditingExisting ? "Issue updated" : "Issue added", "That editing problem is saved to the Edit workspace.");
    };
  }

  document.querySelectorAll("[data-action='edit-issue']").forEach((button) => {
    button.onclick = () => {
      openIssueModal(button.dataset.id);
    };
  });

  document.querySelectorAll("[data-action='toggle-issue-status']").forEach((button) => {
    button.onclick = () => {
      const issueId = button.dataset.id;
      const existingIssue = bundle.issues.find((issue) => issue.id === issueId);
      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        issues: projectBundle.issues.map((issue) => {
          if (issue.id !== issueId) return issue;
          const nextStatus = issue.status === "Resolved" ? "Open" : "Resolved";
          return {
            ...issue,
            status: nextStatus,
            resolvedAt: nextStatus === "Resolved" ? (issue.resolvedAt || new Date().toISOString()) : ""
          };
        })
      }));
      if (existingIssue?.status === "Resolved") {
        editIssueBoardView = "current";
      }
      persistAndRender();
      showToast("Issue updated", "The issue status was updated.");
    };
  });

  document.querySelectorAll("[data-action='delete-issue']").forEach((button) => {
    button.onclick = () => {
      const issueId = button.dataset.id;
      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        issues: projectBundle.issues.filter((issue) => issue.id !== issueId)
      }));
      persistAndRender();
      showToast("Issue deleted", "That issue was removed from your editing backlog.");
    };
  });

  document.querySelectorAll("[data-next-focus-action]").forEach((button) => {
    button.onclick = () => {
      const action = button.dataset.nextFocusAction;
      if (action === "review-issue" && button.dataset.issueId) {
        openIssueModal(button.dataset.issueId);
        return;
      }
      if (action === "filter-section") {
        editIssueBoardView = "current";
        editIssueFilters = {
          ...editIssueFilters,
          section: String(button.dataset.section || "all")
        };
        render();
        return;
      }
      if (action === "add-issue") {
        openIssueModal();
      }
    };
  });

  bindSessionActions();
  bindEditSessionDial();
}

function bindEditSessionGlobalActions() {
  if (editSessionGlobalActionsBound) return;
  editSessionGlobalActionsBound = true;
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!target?.closest) return;
    if (target.closest("#end-edit-session-btn")) {
      event.preventDefault();
      openEndEditSessionConfirmModal();
      return;
    }
    if (target.closest("#cancel-end-edit-session-btn")) {
      event.preventDefault();
      closeEndEditSessionConfirmModal();
      return;
    }
    if (target.closest("#confirm-end-edit-session-btn")) {
      event.preventDefault();
      closeEndEditSessionConfirmModal();
      finishActiveEditingSession(false);
    }
  });
}

function openEditSessionModal(sessionId = null) {
  const modal = document.getElementById("edit-session-modal");
  const form = document.getElementById("edit-session-form");
  const bundle = currentBundle();
  const focusCopy = document.getElementById("edit-session-focus-copy");
  const title = document.getElementById("edit-session-title");
  const copy = document.getElementById("edit-session-copy");
  const contextCopy = document.getElementById("edit-session-context-copy");
  const submit = document.getElementById("edit-session-submit-btn");
  const sectionLabel = document.getElementById("edit-session-section-label");
  const sectionInput = document.getElementById("edit-session-section-input");
  const existingSession = sessionId ? bundle?.sessions.find((item) => item.id === sessionId) : null;
  const existingSnapshot = sessionId ? getSnapshotForSession(bundle, sessionId) : null;
  const pendingSnapshot = getPendingSessionSnapshotContext();
  const unitLabel = getStructureUnitLabel(bundle);
  const activeFocusKey = bundle?.editing?.focusKey || "revision";

  editingEditSessionId = sessionId;
  form.reset();
  populateStructureUnitDatalist("edit-session-structure-unit-options", bundle);
  if (focusCopy) {
    focusCopy.textContent = "Capture only the handoff details that will help you restart quickly.";
  }
  if (sectionLabel) sectionLabel.textContent = `${unitLabel} worked on`;
  if (sectionInput) sectionInput.placeholder = `Example: ${unitLabel} 12`;

  if (existingSession) {
    title.textContent = "Edit Editing Session";
    copy.textContent = "Update the handoff for this editing session.";
    form.elements.sessionDate.value = toInputDate(existingSession.date);
    form.elements.durationMinutes.value = String(Math.max(1, number(existingSession.durationMinutes)));
    form.elements.sectionLabel.value = existingSnapshot?.structureUnitName || existingSession.sectionLabel || "";
    form.elements.wordsEdited.value = String(number(existingSession.wordsEdited));
    form.elements.sessionEndWordCount.value = existingSnapshot?.endWordCount ?? "";
    form.querySelector(`input[name="sessionOutcomeStatus"][value="${existingSnapshot?.outcomeStatus || "partial"}"]`)?.click();
    form.elements.sessionAccomplished.value = existingSnapshot?.accomplished || "";
    form.elements.sessionNextStep.value = existingSnapshot?.nextStep || "";
    form.elements.sessionBlocker.value = existingSnapshot?.blocker || "";
    form.elements.sessionConfidenceLevel.value = existingSnapshot?.confidenceLevel || "";
    form.elements.sessionExcerpt.value = existingSnapshot?.excerpt || "";
    form.elements.sessionNotes.value = existingSnapshot?.notes || existingSession.notes || "";
    renderSessionIssueLinks("edit-session-issue-links-field", bundle, form.elements.sectionLabel.value, existingSnapshot?.issueIds || []);
    if (contextCopy) {
      contextCopy.textContent = "Goal: Revise. Update only what would help you pick the work back up quickly.";
    }
    submit.textContent = "Save changes";
  } else {
    title.textContent = loggingPastEditingSession ? "Log editing session" : "Editing Session Complete";
    copy.textContent = pendingCompletedEditSession
      ? `You edited for ${describeMinutes(pendingCompletedEditSession.durationMinutes)}. Close the loop with a quick handoff.`
      : loggingPastEditingSession
        ? "Capture the essentials from an editing session you already finished elsewhere."
        : "Capture what matters for the restart and leave the rest behind.";
    form.elements.sessionDate.value = toInputDate(pendingCompletedEditSession?.endedAt || new Date().toISOString());
    form.elements.durationMinutes.value = String(Math.max(1, number(pendingCompletedEditSession?.durationMinutes || editSessionDraftMinutes)));
    form.elements.sectionLabel.value = pendingSnapshot?.structureUnitName || "";
    form.elements.wordsEdited.value = "0";
    form.elements.sessionEndWordCount.value = "";
    form.querySelector('input[name="sessionOutcomeStatus"][value="partial"]')?.click();
    form.elements.sessionAccomplished.value = "";
    form.elements.sessionNextStep.value = "";
    form.elements.sessionBlocker.value = "";
    form.elements.sessionConfidenceLevel.value = "";
    form.elements.sessionExcerpt.value = "";
    form.elements.sessionNotes.value = "";
    renderSessionIssueLinks("edit-session-issue-links-field", bundle, form.elements.sectionLabel.value, pendingSnapshot?.issueIds || []);
    if (contextCopy) {
      contextCopy.textContent = pendingSnapshot?.structureUnitName
        ? `Goal: Revise. Resuming ${pendingSnapshot.structureUnitName}.`
        : "Goal: Revise. Save only the context you will actually use next time.";
    }
    submit.textContent = "Save handoff";
  }

  form.elements.sectionLabel.oninput = () => {
    renderSessionIssueLinks("edit-session-issue-links-field", bundle, form.elements.sectionLabel.value);
  };

  modal.classList.remove("hidden");
}

function closeEditSessionModal() {
  const modal = document.getElementById("edit-session-modal");
  const form = document.getElementById("edit-session-form");
  form.reset();
  editingEditSessionId = null;
  pendingCompletedEditSession = null;
  loggingPastEditingSession = false;
  clearPendingSessionSnapshotContext();
  modal.classList.add("hidden");
}

function openPastEditingSessionModal() {
  loggingPastEditingSession = true;
  pendingCompletedEditSession = null;
  editingEditSessionId = null;
  clearPendingSessionSnapshotContext();
  openEditSessionModal();
}

function openEditSessionStartModal() {
  const modal = document.getElementById("session-modal");
  startSessionFlowType = "editing";
  syncStartSessionFlow("config");
  modal.classList.remove("hidden");
}

function closeEditSessionStartModal() {
  closeSessionModal();
}

function syncEditSessionDial(minutes = editSessionDraftMinutes) {
  const dialValue = document.getElementById("edit-session-dial-value");
  const dialProgress = document.getElementById("edit-session-dial-progress");
  const dialHandle = document.getElementById("edit-session-dial-handle");
  const dialCaption = document.getElementById("edit-session-dial-caption");
  if (!dialValue || !dialProgress || !dialHandle || !dialCaption) return;
  const clampedMinutes = Math.min(120, Math.max(15, Math.round(number(minutes) / 5) * 5 || 45));
  editSessionDraftMinutes = clampedMinutes;
  const progress = (clampedMinutes - 15) / 105;
  const angle = Math.PI - (progress * Math.PI);
  const cx = 160;
  const cy = 180;
  const radius = 120;
  const x = cx + Math.cos(angle) * radius;
  const y = cy - Math.sin(angle) * radius;
  dialValue.textContent = String(clampedMinutes);
  dialProgress.setAttribute("stroke-dasharray", `${progress * 100} 100`);
  dialHandle.setAttribute("cx", x.toFixed(2));
  dialHandle.setAttribute("cy", y.toFixed(2));
  dialCaption.textContent = `${describeMinutes(clampedMinutes)} of focused editing time.`;
}

function bindEditSessionDial() {
  const dial = document.getElementById("edit-session-dial");
  const dialWrap = document.getElementById("editing-session-dial-wrap");
  if (!dial || !dialWrap || dial.dataset.bound === "true") return;
  dial.dataset.bound = "true";

  let rafId = 0;
  let pendingPointer = null;
  let activePointerId = null;

  const updateFromPointer = (clientX, clientY) => {
    const bounds = dial.getBoundingClientRect();
    const scaleX = 320 / bounds.width;
    const scaleY = 220 / bounds.height;
    const x = (clientX - bounds.left) * scaleX;
    const y = (clientY - bounds.top) * scaleY;
    const angle = Math.max(0, Math.min(Math.PI, Math.atan2(180 - y, x - 160)));
    const progress = (Math.PI - angle) / Math.PI;
    const rawMinutes = 15 + progress * 105;
    const snappedMinutes = Math.round(rawMinutes / 2.5) * 2.5;
    const minutes = Math.min(120, Math.max(15, Math.round(snappedMinutes / 5) * 5));
    syncEditSessionDial(minutes);
  };

  const scheduleUpdate = (clientX, clientY) => {
    pendingPointer = { clientX, clientY };
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (!pendingPointer) return;
      updateFromPointer(pendingPointer.clientX, pendingPointer.clientY);
      pendingPointer = null;
    });
  };

  const startDrag = (event) => {
    if (event.target.closest("button")) return;
    activePointerId = event.pointerId;
    dial.classList.add("dragging");
    dialWrap.setPointerCapture(event.pointerId);
    scheduleUpdate(event.clientX, event.clientY);
  };

  const move = (event) => {
    if (activePointerId !== event.pointerId) return;
    if (event.buttons === 0 && event.type === "pointermove") return;
    scheduleUpdate(event.clientX, event.clientY);
  };

  const endDrag = (event) => {
    if (activePointerId !== event.pointerId) return;
    activePointerId = null;
    dial.classList.remove("dragging");
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      pendingPointer = null;
    }
    if (dialWrap.hasPointerCapture(event.pointerId)) dialWrap.releasePointerCapture(event.pointerId);
  };

  dialWrap.addEventListener("pointerdown", startDrag);
  dialWrap.addEventListener("pointermove", move);
  dialWrap.addEventListener("pointerup", endDrag);
  dialWrap.addEventListener("pointercancel", endDrag);
  dialWrap.addEventListener("lostpointercapture", () => {
    activePointerId = null;
    dial.classList.remove("dragging");
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      pendingPointer = null;
    }
  });

  syncEditSessionDial(editSessionDraftMinutes);
}

function stopEditingSessionTimer() {
  if (editSessionTimerHandle) {
    clearInterval(editSessionTimerHandle);
    editSessionTimerHandle = null;
  }
}

function enterEditingFocusMode() {
  if (!activeEditingSession) return;
  editingSessionInFocusMode = true;
  document.getElementById("editing-session-screen")?.classList.remove("hidden");
  syncFloatingFocusTimer?.();
  updateEditingSessionScreen();
}

function leaveEditingFocusMode() {
  if (!activeEditingSession) return;
  editingSessionInFocusMode = false;
  document.getElementById("editing-session-screen")?.classList.add("hidden");
  syncFloatingFocusTimer?.();
}

function updateEditingSessionScreen() {
  const screen = document.getElementById("editing-session-screen");
  const clock = document.getElementById("editing-session-clock");
  const copy = document.getElementById("editing-session-copy");
  if (!screen || !clock || !copy || !activeEditingSession) return;
  const remainingSeconds = (activeEditingSession.endsAt - Date.now()) / 1000;
  if (remainingSeconds <= 0) {
    clock.textContent = "00:00";
    syncFloatingFocusTimer?.();
    finishActiveEditingSession(true);
    return;
  }
  screen.classList.toggle("hidden", !editingSessionInFocusMode);
  clock.textContent = formatClock(remainingSeconds);
  copy.textContent = `${describeMinutes(activeEditingSession.plannedMinutes)} editing session in progress`;
  syncFloatingFocusTimer?.();
}

function startEditingSession() {
  const startedAt = Date.now();
  const pendingSnapshot = getPendingSessionSnapshotContext();
  activeEditingSession = {
    startedAt,
    focusKey: pendingSnapshot?.focusKey || currentBundle()?.editing?.focusKey || "revision",
    plannedMinutes: editSessionDraftMinutes,
    endsAt: startedAt + (editSessionDraftMinutes * 60000)
  };
  editingSessionInFocusMode = true;
  closeEndEditSessionConfirmModal();
  closeEditSessionStartModal();
  document.getElementById("editing-session-screen").classList.remove("hidden");
  updateEditingSessionScreen();
  stopEditingSessionTimer();
  editSessionTimerHandle = setInterval(updateEditingSessionScreen, 250);
}

function finishActiveEditingSession(autoCompleted = false) {
  if (!activeEditingSession) return;
  const endedAt = Date.now();
  const elapsedMinutes = Math.max(1, Math.round((endedAt - activeEditingSession.startedAt) / 60000));
  pendingCompletedEditSession = {
    durationMinutes: autoCompleted ? activeEditingSession.plannedMinutes : elapsedMinutes,
    focusKey: activeEditingSession.focusKey || currentBundle()?.editing?.focusKey || "revision",
    startedAt: new Date(activeEditingSession.startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString()
  };
  activeEditingSession = null;
  editingSessionInFocusMode = true;
  closeEndEditSessionConfirmModal();
  stopEditingSessionTimer();
  document.getElementById("editing-session-screen").classList.add("hidden");
  syncFloatingFocusTimer?.();
  openEditSessionModal();
}

function openEndEditSessionConfirmModal() {
  const modal = document.getElementById("end-edit-session-confirm-modal");
  modal.classList.remove("hidden");
}

function closeEndEditSessionConfirmModal() {
  const modal = document.getElementById("end-edit-session-confirm-modal");
  modal.classList.add("hidden");
}

function openIssueModal(issueId = null) {
  const modal = document.getElementById("issue-modal");
  const form = document.getElementById("issue-form");
  const focusCopy = document.getElementById("issue-focus-copy");
  const preview = document.getElementById("issue-derived-preview");
  const noteLabel = document.getElementById("issue-note-label");
  const noteInput = document.getElementById("issue-note-input");
  const snippetInput = document.getElementById("issue-snippet-input");
  const sectionSelect = document.getElementById("issue-section-select");
  const title = document.getElementById("issue-modal-title");
  const copy = document.getElementById("issue-modal-copy");
  const submit = document.getElementById("issue-submit-btn");
  const sectionLabel = document.getElementById("issue-section-label");
  const bundle = currentBundle();
  const unitLabel = getStructureUnitLabel(bundle);
  const unitLower = getStructureUnitLower(bundle);
  const currentChapterLabel = getCurrentEdit2ChapterLabel(bundle);
  const issue = issueId ? bundle?.issues.find((item) => item.id === issueId) : null;
  const sectionLabels = getEditIssueSectionOptions(bundle);
  const structuredFieldIds = [
    "issue-title-field",
    "issue-section-field",
    "issue-type-field",
    "issue-priority-field",
    "issue-status-field"
  ];

  editingIssueId = issueId;
  form.reset();
  form.dataset.mode = issue ? "edit" : "create";
  form.dataset.priorityTouched = "false";
  if (sectionLabel) sectionLabel.textContent = unitLabel;
  if (form.elements.title) form.elements.title.placeholder = `Example: ${unitLabel} 8 stalls after the reveal`;
  if (form.elements.title) form.elements.title.required = Boolean(issue);
  if (form.elements.sectionLabel) form.elements.sectionLabel.required = Boolean(issue);
  if (noteInput) noteInput.required = !issue;
  if (preview) preview.classList.add("hidden");
  structuredFieldIds.forEach((fieldId) => {
    document.getElementById(fieldId)?.classList.toggle("hidden", !issue);
  });

  if (focusCopy) {
    focusCopy.textContent = "";
    focusCopy.classList.add("hidden");
  }
  if (sectionSelect) {
    const availableSections = sectionLabels.length ? sectionLabels : ["Unassigned"];
    sectionSelect.innerHTML = availableSections
      .map((sectionLabel) => `<option value="${escapeAttr(sectionLabel)}">${escapeHtml(sectionLabel)}</option>`)
      .join("");
  }

  if (issue) {
    if (noteLabel) noteLabel.textContent = "Jot a quick note (short is fine)";
    title.textContent = "Edit Issue";
    copy.textContent = `Update the issue details if you want. The quick note can stay short.`;
    form.elements.note.value = issue.notes || "";
    if (snippetInput) snippetInput.value = issue.snippet || "";
    form.elements.title.value = issue.title || "";
    form.elements.type.value = issue.type || "General";
    form.elements.sectionLabel.value = issue.sectionLabel || "";
    form.elements.priority.value = issue.priority || getEditIssueDefaultPriority();
    form.elements.issueStatus.value = issue.status === "Resolved"
      ? "resolved"
      : issue.workflowStatus === "in_progress"
        ? "in_progress"
        : "open";
    submit.textContent = "Save changes";
    if (noteInput) {
      noteInput.placeholder = "chapter 3 slow\ndialogue stiff\nmotivation unclear\nconfusing here";
      noteInput.oninput = null;
    }
    syncIssueDraftPreview("", bundle);
  } else {
    if (noteLabel) noteLabel.textContent = "Jot a quick note (short is fine)";
    title.textContent = "Add Open Issue";
    copy.textContent = "Capture it quickly. A short note is enough—we’ll place it for you. Paste the exact text if you want to return to it faster later.";
    form.elements.note.value = "";
    if (snippetInput) snippetInput.value = "";
    form.elements.type.value = "General";
    form.elements.sectionLabel.value = sectionLabels.includes(currentChapterLabel) ? currentChapterLabel : (sectionLabels[0] || "Unassigned");
    form.elements.priority.value = getEditIssueDefaultPriority();
    form.elements.issueStatus.value = "open";
    submit.textContent = "Save issue";
    if (noteInput) {
      noteInput.placeholder = "chapter 3 slow\ndialogue stiff\nmotivation unclear\nconfusing here";
      noteInput.oninput = () => {
        syncIssueDraftPreview(noteInput.value, bundle);
      };
    }
    syncIssueDraftPreview("", bundle);
  }

  modal.classList.remove("hidden");
  if (issue) {
    form.elements.title?.focus();
  } else {
    noteInput?.focus();
  }
}

function closeIssueModal() {
  const modal = document.getElementById("issue-modal");
  const form = document.getElementById("issue-form");
  const noteInput = document.getElementById("issue-note-input");
  const preview = document.getElementById("issue-derived-preview");
  form.reset();
  delete form.dataset.mode;
  delete form.dataset.priorityTouched;
  if (noteInput) noteInput.oninput = null;
  if (preview) {
    preview.textContent = "";
    preview.classList.add("hidden");
  }
  editingIssueId = null;
  modal.classList.add("hidden");
}


function renderIssueCard(issue, options = {}) {
  const { archived = false } = options;
  const priorityClass = `priority-${String(issue.priority || "Medium").toLowerCase()}`;
  const statusClass = `status-${String(issue.status || "Open").toLowerCase()}`;
  const issueLabel = issue.status === "Resolved" ? "Resolved issue" : "Open issue";
  return `
    <div class="item ${archived ? "archived-issue" : ""}">
      <div class="item-top">
        <div>
          <p class="session-kind">${issueLabel}</p>
          <h4 class="issue-title">${escapeHtml(issue.title)}</h4>
        </div>
        <div class="goal-actions">
          <button class="icon-btn" type="button" data-action="edit-issue" data-id="${issue.id}" aria-label="Edit issue">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4"></path>
              <path d="M13.5 6.5l4 4"></path>
            </svg>
          </button>
          <button class="inline-btn" type="button" data-action="toggle-issue-status" data-id="${issue.id}">
            ${issue.status === "Resolved" ? "Reopen" : "Resolve"}
          </button>
          <button class="icon-btn" type="button" data-action="delete-issue" data-id="${issue.id}" aria-label="Delete issue">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h14"></path>
              <path d="M9 7V4h6v3"></path>
              <path d="M8 7l1 12h6l1-12"></path>
              <path d="M10 11v5"></path>
              <path d="M14 11v5"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="meta-line">
        <span class="pill">${escapeHtml(issue.type)}</span>
        <span class="pill issue-priority ${priorityClass}">${escapeHtml(issue.priority)}</span>
        <span class="pill ${statusClass}">${escapeHtml(issue.status)}</span>
        ${archived && issue.resolvedAt ? `<span class="pill">Resolved ${escapeHtml(formatDate(issue.resolvedAt))}</span>` : ""}
        ${issue.sectionLabel ? `<span class="pill">${escapeHtml(issue.sectionLabel)}</span>` : ""}
      </div>
      ${issue.snippet ? `<blockquote class="issue-snippet">${escapeHtml(issue.snippet)}</blockquote>` : ""}
      ${issue.notes ? `<p class="issue-note">${escapeHtml(issue.notes)}</p>` : ""}
    </div>
  `;
}
