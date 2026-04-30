const EDIT2_PASS_ORDER = EDIT_FOCUS_ORDER;
const EDIT2_PASS_CONFIG = EDIT_FOCUS_CONFIG;
const EDIT2_DEFAULT_TYPES = [
  "Pacing",
  "Dialogue",
  "Character",
  "Continuity",
  "Clarity",
  "Grammar",
  "Prose",
  "General"
];

let edit2SelectedChapterKey = "";
let edit2ViewMode = "overview";
let edit2OverviewBoardView = "chapters";
let edit2SummaryEditMode = false;
const EDIT2_MOMENTUM_WINDOW_DAYS = 7;
const EDIT2_STALE_RECOMMENDATION_THRESHOLD = 2;
const EDIT2_STALE_RECOMMENDATION_STEP = 12;
const EDIT2_STALE_RECOMMENDATION_CAP = 24;
let edit2PrimaryRecommendationState = {
  key: "",
  streak: 0
};

function normalizeEdit2PassKey(value = "", fallback = "") {
  return normalizeEditFocusKey(value, fallback);
}

function getEdit2WorkflowStatus(issue) {
  if (String(issue?.status || "").toLowerCase() === "resolved") return "resolved";
  if (issue?.workflowStatus === "in_progress") return "in_progress";
  return "open";
}

function getEdit2WorkflowLabel(workflowStatus) {
  if (workflowStatus === "in_progress") return "In Progress";
  if (workflowStatus === "resolved") return "Resolved";
  return "Open";
}

function createEdit2PassSummary() {
  return {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    sessions: 0
  };
}

function createEdit2Chapter(label, overrides = {}) {
  const normalizedLabel = normalizeChapterLabel(label);
  return {
    id: overrides.id || createId(),
    key: normalizedLabel.toLowerCase(),
    label: normalizedLabel,
    summary: String(overrides.summary || "").trim(),
    sortOrder: Math.max(0, number(overrides.sortOrder)),
    completedAt: String(overrides.completedAt || ""),
    issues: [],
    sessions: [],
    passSummaries: Object.fromEntries(EDIT2_PASS_ORDER.map((passKey) => [passKey, createEdit2PassSummary()])),
    totalMinutes: 0,
    lastTouchedAt: ""
  };
}

function touchEdit2Chapter(chapter, dateValue) {
  if (!chapter || !dateValue) return;
  if (!chapter.lastTouchedAt || new Date(dateValue) > new Date(chapter.lastTouchedAt)) {
    chapter.lastTouchedAt = dateValue;
  }
}

function finalizeEdit2Chapter(chapter) {
  const heatByPass = Object.fromEntries(
    EDIT2_PASS_ORDER.map((passKey) => {
      const summary = chapter.passSummaries[passKey];
      const weight = EDIT2_PASS_CONFIG[passKey].weight;
      const heat = (summary.open * weight) + (summary.inProgress * weight * 0.8);
      return [passKey, heat];
    })
  );
  const openIssueCount = chapter.issues.filter((issue) => getEdit2WorkflowStatus(issue) !== "resolved").length;
  const priorityCounts = chapter.issues.reduce((counts, issue) => {
    if (getEdit2WorkflowStatus(issue) === "resolved") return counts;
    const priorityLabel = getEdit2IssuePriorityLabel(issue).toLowerCase();
    if (priorityLabel === "high" || priorityLabel === "medium" || priorityLabel === "low") {
      counts[priorityLabel] += 1;
    }
    return counts;
  }, { high: 0, medium: 0, low: 0 });
  const resolvedIssueCount = chapter.issues.length - openIssueCount;
  const totalHeat = Object.values(heatByPass).reduce((sum, value) => sum + value, 0);

  return {
    ...chapter,
    heatByPass,
    totalHeat,
    openIssueCount,
    priorityCounts,
    resolvedIssueCount
  };
}

function buildEdit2Chapters(bundle) {
  const chapters = new Map();
  const issueTypes = new Set(EDIT2_DEFAULT_TYPES);
  let nextSortOrder = 0;
  const fallbackLabel = "Unassigned";
  const hasAssignedFallbackContent = bundle.issues.some((issue) => normalizeChapterLabel(issue.sectionLabel) === fallbackLabel)
    || getEditSessions(bundle).some((session) => normalizeChapterLabel(session.sectionLabel) === fallbackLabel);

  function ensureChapter(label, overrides = {}) {
    const normalizedLabel = normalizeChapterLabel(label);
    const key = normalizedLabel.toLowerCase();
    if (!chapters.has(key)) {
      chapters.set(key, createEdit2Chapter(normalizedLabel, {
        ...overrides,
        sortOrder: overrides.sortOrder ?? nextSortOrder
      }));
      nextSortOrder += 1;
      return chapters.get(key);
    }
    const existing = chapters.get(key);
    chapters.set(key, {
      ...existing,
      id: overrides.id || existing.id,
      summary: String(overrides.summary !== undefined ? overrides.summary : existing.summary).trim(),
      sortOrder: Math.max(0, number(overrides.sortOrder !== undefined ? overrides.sortOrder : existing.sortOrder)),
      completedAt: String(overrides.completedAt !== undefined ? overrides.completedAt : existing.completedAt || "")
    });
    return chapters.get(key);
  }

  (bundle.editing?.chapters || []).forEach((chapter, index) => {
    if (normalizeChapterLabel(chapter.label) === fallbackLabel && !hasAssignedFallbackContent) {
      return;
    }
    ensureChapter(chapter.label, {
      id: chapter.id,
      summary: chapter.summary,
      sortOrder: chapter.sortOrder ?? index,
      completedAt: chapter.completedAt || ""
    });
  });

  bundle.issues.forEach((issue) => {
    const chapter = ensureChapter(issue.sectionLabel);
    const passKey = normalizeEdit2PassKey(issue.focusKey, issue.passName || bundle.editing.focusKey);
    const workflowStatus = getEdit2WorkflowStatus(issue);
    const normalizedIssue = {
      ...issue,
      passKey,
      workflowStatus,
      textLocation: String(issue.textLocation || "")
    };
    issueTypes.add(String(issue.type || "General"));
    chapter.issues.push(normalizedIssue);
    chapter.passSummaries[passKey].total += 1;
    if (workflowStatus === "resolved") chapter.passSummaries[passKey].resolved += 1;
    else if (workflowStatus === "in_progress") chapter.passSummaries[passKey].inProgress += 1;
    else chapter.passSummaries[passKey].open += 1;
    touchEdit2Chapter(chapter, issue.resolvedAt || issue.createdAt);
  });

  getEditSessions(bundle).forEach((session) => {
    const chapter = ensureChapter(session.sectionLabel);
    const passKey = normalizeEdit2PassKey(session.focusKey, session.passName || bundle.editing.focusKey);
    chapter.sessions.push({
      ...session,
      passKey
    });
    chapter.passSummaries[passKey].sessions += 1;
    chapter.totalMinutes += number(session.durationMinutes);
    touchEdit2Chapter(chapter, session.date);
  });

  const chapterList = [...chapters.values()]
    .map(finalizeEdit2Chapter)
    .sort((a, b) => {
      const sortDelta = number(a.sortOrder) - number(b.sortOrder);
      if (sortDelta !== 0) return sortDelta;
      return compareEditingChapterLabels(a.label, b.label);
    })
    .map((chapter, index) => ({
      ...chapter,
      sortOrder: index
    }));

  return {
    chapters: chapterList,
    issueTypes: [...issueTypes].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    totalOpenIssues: chapterList.reduce((sum, chapter) => sum + chapter.openIssueCount, 0),
    totalResolvedIssues: chapterList.reduce((sum, chapter) => sum + chapter.resolvedIssueCount, 0)
  };
}

function getEdit2FilteredHeat(chapter, passFilter = "all") {
  if (passFilter === "all") return chapter.totalHeat;
  return chapter.heatByPass[passFilter] || 0;
}

function getEdit2HeatLevel(chapter, chapters, passFilter = "all") {
  const maxHeat = Math.max(1, ...chapters.map((entry) => getEdit2FilteredHeat(entry, passFilter)));
  return Math.min(1, getEdit2FilteredHeat(chapter, passFilter) / maxHeat);
}

function getEdit2OpenIssues(issues) {
  return issues.filter((issue) => issue.workflowStatus !== "resolved");
}

function getEdit2NextFocusScopeLabel() {
  return "manuscript structure";
}

function getEdit2FocusIssues(chapter) {
  return getEdit2OpenIssues(chapter.issues);
}

function getEdit2IssuePriorityLabel(issue) {
  return String(issue?.priority || getEditFocusDefaultPriority(issue?.passKey || "revision"));
}

function getEdit2IssuePriorityRank(priorityLabel = "Medium") {
  const priorityRank = { High: 3, Medium: 2, Low: 1 };
  return priorityRank[String(priorityLabel || "Medium")] || 0;
}

function getEdit2RecommendationKey(recommendation = {}) {
  if (recommendation.issueId) return `issue:${recommendation.issueId}`;
  if (recommendation.chapterKey) return `chapter:${recommendation.chapterKey}`;
  if (recommendation.title) return `title:${recommendation.title}`;
  return "";
}

function clearEdit2NextFocusDisplayState() {
  edit2PrimaryRecommendationState = {
    key: "",
    streak: 0
  };
}

function noteEdit2PrimaryRecommendation(recommendation = null) {
  const key = getEdit2RecommendationKey(recommendation || {});
  if (!key) {
    clearEdit2NextFocusDisplayState();
    return;
  }
  if (edit2PrimaryRecommendationState.key === key) {
    edit2PrimaryRecommendationState.streak += 1;
    return;
  }
  edit2PrimaryRecommendationState = {
    key,
    streak: 1
  };
}

function getEdit2StaleRecommendationPenalty(recommendationKey = "") {
  if (!recommendationKey || edit2PrimaryRecommendationState.key !== recommendationKey) return 0;
  const extraRepeats = Math.max(0, edit2PrimaryRecommendationState.streak - EDIT2_STALE_RECOMMENDATION_THRESHOLD);
  return Math.min(EDIT2_STALE_RECOMMENDATION_CAP, extraRepeats * EDIT2_STALE_RECOMMENDATION_STEP);
}

function isEdit2RecentDate(dateValue = "", windowDays = EDIT2_MOMENTUM_WINDOW_DAYS) {
  if (!dateValue) return false;
  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) return false;
  return timestamp >= (Date.now() - (windowDays * 86400000));
}

function createEdit2RecommendationContext(bundle, chapters) {
  const openIssues = chapters.flatMap((chapter) => getEdit2FocusIssues(chapter));
  const unresolvedCounts = chapters.map((chapter) => getEdit2FocusIssues(chapter).length);
  return {
    bundle,
    unitLabel: getStructureUnitLabel(bundle),
    unitLower: getStructureUnitLower(bundle),
    lastSessionLabel: normalizeChapterLabel(getEditStats(bundle).lastSession?.sectionLabel || ""),
    maxPriorityRank: Math.max(0, ...openIssues.map((issue) => getEdit2IssuePriorityRank(getEdit2IssuePriorityLabel(issue)))),
    maxUnresolvedInChapter: Math.max(0, ...unresolvedCounts)
  };
}

function getEdit2RecentSessionCount(chapter, windowDays = EDIT2_MOMENTUM_WINDOW_DAYS) {
  return chapter.sessions.filter((session) => isEdit2RecentDate(session.date, windowDays)).length;
}

function getEdit2RecentResolvedCount(chapter, windowDays = EDIT2_MOMENTUM_WINDOW_DAYS) {
  return chapter.issues.filter((issue) => getEdit2WorkflowStatus(issue) === "resolved" && isEdit2RecentDate(issue.resolvedAt, windowDays)).length;
}

function getEdit2ChapterOpenStageCount(chapter, passKey) {
  const summary = chapter.passSummaries[passKey];
  return number(summary?.open) + number(summary?.inProgress);
}

function getEdit2OverviewSummary(chapter) {
  return String(chapter.summary || "").trim() || "No structure purpose saved yet.";
}

function truncateEdit2Summary(summary, maxWords = 12) {
  const normalized = String(summary || "").trim();
  if (!normalized) return "No structure purpose saved yet.";
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return normalized;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function getEdit2PriorityEvaluation(chapter, chapters) {
  const highCount = number(chapter.priorityCounts?.high);
  const mediumCount = number(chapter.priorityCounts?.medium);
  const openCount = number(chapter.openIssueCount);
  const maxHighCount = Math.max(1, ...chapters.map((entry) => number(entry.priorityCounts?.high)));
  const highRatio = highCount / maxHighCount;
  const highShare = highCount / Math.max(1, openCount);

  if (!openCount) return { label: "Clear", tone: "clear" };
  if (highCount >= 3 || highRatio >= 0.75 || highShare >= 0.5) return { label: "High", tone: "high" };
  if (highCount >= 1 || mediumCount >= 3 || highRatio >= 0.35) return { label: "Medium", tone: "medium" };
  return { label: "Low", tone: "low" };
}

function getEdit2PriorityRingStyle(chapter) {
  const highCount = number(chapter.priorityCounts?.high);
  const mediumCount = number(chapter.priorityCounts?.medium);
  const lowCount = number(chapter.priorityCounts?.low);
  const total = highCount + mediumCount + lowCount;
  if (!total) return "--priority-high:0deg; --priority-medium:0deg;";
  const highDegrees = (highCount / total) * 360;
  const mediumDegrees = (mediumCount / total) * 360;
  return `--priority-high:${highDegrees.toFixed(2)}deg; --priority-medium:${mediumDegrees.toFixed(2)}deg;`;
}

function getEdit2RecommendationSignals(issue, chapter, recommendationContext) {
  const priorityRank = getEdit2IssuePriorityRank(getEdit2IssuePriorityLabel(issue));
  const unresolvedInChapter = getEdit2FocusIssues(chapter).length;
  const recentSessionCount = getEdit2RecentSessionCount(chapter);
  const recentResolvedCount = getEdit2RecentResolvedCount(chapter);
  const sameAsLastSession = recommendationContext.lastSessionLabel && recommendationContext.lastSessionLabel === chapter.label;
  const recommendationKey = getEdit2RecommendationKey({
    issueId: issue.id,
    chapterKey: chapter.key,
    title: issue.title
  });
  return {
    priorityRank,
    unresolvedInChapter,
    chapterHeat: getEdit2FilteredHeat(chapter),
    lastTouchedAt: chapter.lastTouchedAt,
    recentSessionCount,
    recentResolvedCount,
    sameAsLastSession,
    chapterHasMostUnresolved: unresolvedInChapter > 0 && unresolvedInChapter === recommendationContext.maxUnresolvedInChapter,
    isHighestPriority: priorityRank > 0 && priorityRank === recommendationContext.maxPriorityRank,
    stalePenalty: getEdit2StaleRecommendationPenalty(recommendationKey)
  };
}

function getEdit2MomentumBoost(signals) {
  return Math.min(16,
    (signals.sameAsLastSession ? 6 : 0)
    + Math.min(6, signals.recentSessionCount * 3)
    + Math.min(4, signals.recentResolvedCount * 2)
  );
}

function scoreEdit2NextFocusIssue(issue, signals) {
  return (
    (signals.priorityRank * 100)
    + (signals.unresolvedInChapter * 12)
    + Math.round(signals.chapterHeat * 10)
    + (issue.workflowStatus === "in_progress" ? 18 : 0)
    + getEdit2MomentumBoost(signals)
    - signals.stalePenalty
  );
}

function getEdit2RecommendationReason(issue, chapter, signals, recommendationContext) {
  if (issue.workflowStatus === "in_progress") {
    return "You have already started here, so finishing it will build momentum.";
  }
  if (signals.sameAsLastSession || signals.recentSessionCount > 0) {
    return `You worked in ${chapter.label} recently, so context should still be warm.`;
  }
  if (signals.isHighestPriority) {
    return "This is the highest priority open issue.";
  }
  if (signals.chapterHasMostUnresolved) {
    return `This ${recommendationContext.unitLower} has the most unresolved issues.`;
  }
  if (signals.recentResolvedCount > 0) {
    return `You have already been clearing issues in ${chapter.label}, so momentum is building here.`;
  }
  return "This is the clearest next move on the board right now.";
}

function getEdit2RecommendationProgressContext(chapter, recommendationContext) {
  const openCount = number(chapter.openIssueCount);
  const resolvedCount = number(chapter.resolvedIssueCount);
  const unitLower = recommendationContext.unitLower;
  if (openCount && resolvedCount) {
    return `${formatNumber(openCount)} issue${openCount === 1 ? "" : "s"} remain in this ${unitLower} · ${formatNumber(resolvedCount)} resolved here already`;
  }
  if (openCount) {
    return `${formatNumber(openCount)} issue${openCount === 1 ? "" : "s"} remain in this ${unitLower}`;
  }
  if (resolvedCount) {
    return `You have resolved ${formatNumber(resolvedCount)} issue${resolvedCount === 1 ? "" : "s"} here already.`;
  }
  if (chapter.sessions.length) {
    return `${formatNumber(chapter.sessions.length)} editing session${chapter.sessions.length === 1 ? "" : "s"} logged here`;
  }
  return `No ${unitLower} activity logged here yet.`;
}

function buildEdit2IssueRecommendation(issue, chapter, signals, recommendationContext) {
  const priorityLabel = getEdit2IssuePriorityLabel(issue);
  return {
    key: getEdit2RecommendationKey({
      issueId: issue.id,
      chapterKey: chapter.key,
      title: issue.title
    }),
    title: issue.title,
    reason: getEdit2RecommendationReason(issue, chapter, signals, recommendationContext),
    progressContext: getEdit2RecommendationProgressContext(chapter, recommendationContext),
    meta: `${chapter.label} · ${priorityLabel} priority`,
    primaryAction: "review-issue",
    primaryLabel: "Open next step",
    issueId: issue.id,
    chapterKey: chapter.key
  };
}

function buildEdit2ChapterFallbackRecommendation(chapter, label = "Scan structure", unitLabel = "Chapter") {
  const activeFocusCount = getEdit2ChapterOpenStageCount(chapter, EDIT2_PASS_ORDER[0]);
  const fallbackMeta = chapter.lastTouchedAt
    ? `Last touched ${formatDate(chapter.lastTouchedAt)}`
    : `No ${unitLabel.toLowerCase()} activity yet`;
  const reason = chapter.openIssueCount
    ? (activeFocusCount > 1
      ? "Several unresolved notes are clustered here."
      : `${unitLabel} still has unresolved issues.`)
    : `A fresh scan could uncover the next useful note here.`;

  return {
    key: getEdit2RecommendationKey({
      chapterKey: chapter.key,
      title: chapter.label
    }),
    title: chapter.label,
    reason,
    progressContext: chapter.openIssueCount
      ? `${chapter.openIssueCount} issue${chapter.openIssueCount === 1 ? "" : "s"} remain in this ${unitLabel.toLowerCase()}`
      : getEdit2RecommendationProgressContext(chapter, { unitLower: unitLabel.toLowerCase() }),
    meta: chapter.openIssueCount
      ? `${chapter.openIssueCount} open issue${chapter.openIssueCount === 1 ? "" : "s"} · ${formatNumber(chapter.sessions.length)} session${chapter.sessions.length === 1 ? "" : "s"} logged`
      : fallbackMeta,
    primaryAction: "open-chapter",
    primaryLabel: label,
    chapterKey: chapter.key
  };
}

function buildEdit2NextFocusRecommendations(bundle, chapters) {
  const recommendationContext = createEdit2RecommendationContext(bundle, chapters);
  const unitLabel = recommendationContext.unitLabel;
  const rankedCandidates = chapters
    .flatMap((chapter) => getEdit2FocusIssues(chapter).map((issue) => ({
      issue,
      chapter,
      signals: getEdit2RecommendationSignals(issue, chapter, recommendationContext)
    })))
    .sort((a, b) => {
      const scoreDelta = scoreEdit2NextFocusIssue(b.issue, b.signals) - scoreEdit2NextFocusIssue(a.issue, a.signals);
      if (scoreDelta !== 0) return scoreDelta;
      const heatDelta = getEdit2FilteredHeat(b.chapter) - getEdit2FilteredHeat(a.chapter);
      if (heatDelta !== 0) return heatDelta;
      return String(a.issue.title || "").localeCompare(String(b.issue.title || ""));
    });

  if (rankedCandidates.length) {
    const recommendations = rankedCandidates
      .slice(0, 3)
      .map(({ issue, chapter, signals }) => buildEdit2IssueRecommendation(issue, chapter, signals, recommendationContext));

    if (recommendations.length < 3) {
      const usedChapterKeys = new Set(recommendations.map((recommendation) => recommendation.chapterKey).filter(Boolean));
      const fallbackChapters = [...chapters]
        .filter((chapter) => !usedChapterKeys.has(chapter.key))
        .sort((a, b) => {
          const heatDelta = getEdit2FilteredHeat(b) - getEdit2FilteredHeat(a);
          if (heatDelta !== 0) return heatDelta;
          return new Date(b.lastTouchedAt || 0) - new Date(a.lastTouchedAt || 0);
        })
        .slice(0, 3 - recommendations.length)
        .map((chapter) => buildEdit2ChapterFallbackRecommendation(chapter, `Scan ${unitLabel.toLowerCase()}`, unitLabel));

      const combinedRecommendations = [...recommendations, ...fallbackChapters];
      return {
        primary: combinedRecommendations[0],
        secondary: combinedRecommendations.slice(1, 3)
      };
    }

    return {
      primary: recommendations[0],
      secondary: recommendations.slice(1, 3)
    };
  }

  if (chapters.length) {
    const fallbackRecommendations = [...chapters]
      .sort((a, b) => {
        const heatDelta = getEdit2FilteredHeat(b) - getEdit2FilteredHeat(a);
        if (heatDelta !== 0) return heatDelta;
        return new Date(b.lastTouchedAt || 0) - new Date(a.lastTouchedAt || 0);
      })
      .slice(0, 3)
      .map((chapter, index) => buildEdit2ChapterFallbackRecommendation(
        chapter,
        index === 0 ? "Scan first" : index === 1 ? "Rebuild context" : "Fresh audit",
        unitLabel
      ));
    return {
      primary: fallbackRecommendations[0],
      secondary: fallbackRecommendations.slice(1, 3)
    };
  }

  return {
    primary: {
      key: "add-anchor",
      title: `Create the first ${unitLabel.toLowerCase()} anchor`,
      reason: `${unitLabel} structure needs its first anchor before issue recommendations can stay useful.`,
      progressContext: `No ${getStructureUnitPlural(bundle).toLowerCase()} are mapped yet`,
      meta: `No ${getStructureUnitPlural(bundle).toLowerCase()} tracked yet`,
      primaryAction: "add-chapter",
      primaryLabel: `Add ${unitLabel.toLowerCase()}`,
    },
    secondary: [
      {
        key: "add-first-issue",
        title: "Log the first issue",
        reason: "One concrete issue will create useful context for the first next step.",
        meta: "No edit history yet",
        primaryAction: "add-issue",
        primaryLabel: "Add issue"
      }
    ]
  };
}

function renderEdit2NextFocusCards(recommendations) {
  const primaryRecommendation = recommendations?.primary || null;
  const secondaryRecommendations = Array.isArray(recommendations?.secondary)
    ? recommendations.secondary.filter(Boolean).slice(0, 2)
    : [];
  if (!primaryRecommendation) return "";
  return `
    <section class="card next-focus-card">
      <div class="section-head">
        <div>
          <h3>Next Up</h3>
          <p>One clear next move now, with backup options only if you need them.</p>
        </div>
      </div>
      <div class="next-focus-list next-focus-list-1">
        <article class="next-focus-option next-focus-primary">
          <div class="next-focus-copy">
            <p class="next-focus-kicker">Recommended</p>
            <h4>${escapeHtml(`Next step: ${primaryRecommendation.title}`)}</h4>
          </div>
          ${primaryRecommendation.meta ? `<p class="edit2-focus-meta">${escapeHtml(primaryRecommendation.meta)}</p>` : ""}
          ${primaryRecommendation.reason ? `<p class="next-focus-justification">${escapeHtml(primaryRecommendation.reason)}</p>` : ""}
          ${primaryRecommendation.progressContext ? `<p class="next-focus-support">${escapeHtml(primaryRecommendation.progressContext)}</p>` : ""}
          <div class="next-focus-actions">
            ${primaryRecommendation.primaryAction ? `
              <button
                class="primary-btn"
                type="button"
                data-edit2-next-focus-action="${escapeAttr(primaryRecommendation.primaryAction)}"
                ${primaryRecommendation.issueId ? `data-issue-id="${escapeAttr(primaryRecommendation.issueId)}"` : ""}
                ${primaryRecommendation.chapterKey ? `data-chapter-key="${escapeAttr(primaryRecommendation.chapterKey)}"` : ""}
              >${escapeHtml(primaryRecommendation.primaryLabel)}</button>
            ` : ""}
          </div>
        </article>
      </div>
      ${secondaryRecommendations.length ? `
        <details class="next-focus-secondary">
          <summary>Other options (${formatNumber(secondaryRecommendations.length)})</summary>
          <div class="next-focus-secondary-list">
            ${secondaryRecommendations.map((recommendation) => `
              <article class="next-focus-secondary-item">
                <div class="next-focus-secondary-copy">
                  <h4>${escapeHtml(recommendation.title)}</h4>
                  ${recommendation.meta ? `<p class="edit2-focus-meta">${escapeHtml(recommendation.meta)}</p>` : ""}
                  ${recommendation.reason ? `<p>${escapeHtml(recommendation.reason)}</p>` : ""}
                </div>
                ${recommendation.primaryAction ? `
                  <button
                    class="ghost-btn"
                    type="button"
                    data-edit2-next-focus-action="${escapeAttr(recommendation.primaryAction)}"
                    ${recommendation.issueId ? `data-issue-id="${escapeAttr(recommendation.issueId)}"` : ""}
                    ${recommendation.chapterKey ? `data-chapter-key="${escapeAttr(recommendation.chapterKey)}"` : ""}
                  >${escapeHtml(recommendation.primaryLabel)}</button>
                ` : ""}
              </article>
            `).join("")}
          </div>
        </details>
      ` : ""}
    </section>
  `;
}

function getEdit2SelectedChapter(chapters) {
  const currentSelection = chapters.find((chapter) => chapter.key === edit2SelectedChapterKey);
  if (currentSelection) return currentSelection;
  const hottestChapter = [...chapters]
    .sort((a, b) => getEdit2FilteredHeat(b) - getEdit2FilteredHeat(a))
    .find((chapter) => getEdit2FilteredHeat(chapter) > 0);
  const fallback = hottestChapter || chapters[0] || null;
  edit2SelectedChapterKey = fallback?.key || "";
  return fallback;
}

function renderEdit2ChapterCard(chapter, chapters, chapterIndex, chapterCount, unitLabel = getStructureUnitLabel(currentBundle())) {
  const heatLevel = getEdit2HeatLevel(chapter, chapters);
  const hasUnassignedContents = chapter.label === "Unassigned" && (chapter.issues.length > 0 || chapter.sessions.length > 0);
  const unitLower = unitLabel.toLowerCase();
  const completionLabel = chapter.completedAt ? `Completed ${formatDate(chapter.completedAt)}` : `Mark ${unitLower} complete`;
  const inProgressCount = chapter.issues.filter((issue) => issue.workflowStatus === "in_progress").length;
  const priorityTotal = number(chapter.priorityCounts.high) + number(chapter.priorityCounts.medium) + number(chapter.priorityCounts.low);
  const priorityEvaluation = getEdit2PriorityEvaluation(chapter, chapters);
  const activityLabel = chapter.lastTouchedAt ? `Last touched ${formatDate(chapter.lastTouchedAt)}` : "No edit activity yet";
  return `
    <div class="edit2-chapter-row-shell ${chapterIndex === 0 ? "is-first" : ""} ${chapterIndex === chapterCount - 1 ? "is-last" : ""}">
      <div class="edit2-chapter-rail" aria-hidden="true">
        <span>${formatNumber(chapterIndex + 1)}</span>
      </div>
      <div class="edit2-chapter-section">
        <article
          class="edit2-chapter-card ${edit2SelectedChapterKey === chapter.key ? "active" : ""}"
          style="--edit2-heat:${heatLevel.toFixed(3)};"
          data-edit2-open-chapter-card="${escapeAttr(chapter.key)}"
          role="button"
          tabindex="0"
          aria-label="Open ${escapeAttr(chapter.label)}"
        >
          <div class="edit2-chapter-identity">
            <h4>${escapeHtml(chapter.label)}</h4>
            <p class="edit2-chapter-summary">${escapeHtml(truncateEdit2Summary(getEdit2OverviewSummary(chapter), 12))}</p>
            <span class="edit2-pass-pill">${formatNumber(chapter.openIssueCount)} open issue${chapter.openIssueCount === 1 ? "" : "s"}</span>
            <span class="edit2-pass-pill">${formatNumber(chapter.sessions.length)} session${chapter.sessions.length === 1 ? "" : "s"} logged</span>
            <span class="edit2-pass-pill">${escapeHtml(activityLabel)}</span>
            ${chapter.completedAt ? `<span class="edit2-pass-pill">${escapeHtml(completionLabel)}</span>` : ""}
          </div>
          <div class="edit2-chapter-issue-box">
            <p class="edit2-mini-label">Issues</p>
            <div class="edit2-chapter-mix-list">
              <div class="edit2-chapter-mix-row">
                <span>Open</span>
                <strong>${formatNumber(chapter.openIssueCount)}</strong>
              </div>
              <div class="edit2-chapter-mix-row">
                <span>Working</span>
                <strong>${formatNumber(inProgressCount)}</strong>
              </div>
              <div class="edit2-chapter-mix-row">
                <span>Resolved</span>
                <strong>${formatNumber(chapter.resolvedIssueCount)}</strong>
              </div>
            </div>
          </div>
          <div class="edit2-chapter-priority-box">
            <p class="edit2-mini-label">Priority</p>
            <div class="edit2-priority-body">
              <div
                class="edit2-priority-ring ${priorityTotal ? "" : "is-empty"}"
                style="${escapeAttr(getEdit2PriorityRingStyle(chapter))}"
                aria-label="${formatNumber(chapter.priorityCounts.high)} high priority, ${formatNumber(chapter.priorityCounts.medium)} medium priority, ${formatNumber(chapter.priorityCounts.low)} low priority"
              >
                <span>${formatNumber(priorityTotal)}</span>
              </div>
              <div class="edit2-priority-counts">
                <div><span>High</span><strong>${formatNumber(chapter.priorityCounts.high)}</strong></div>
                <div><span>Med</span><strong>${formatNumber(chapter.priorityCounts.medium)}</strong></div>
                <div><span>Low</span><strong>${formatNumber(chapter.priorityCounts.low)}</strong></div>
              </div>
            </div>
            <span class="edit2-priority-evaluation is-${escapeAttr(priorityEvaluation.tone)}">${escapeHtml(priorityEvaluation.label)}</span>
          </div>
        </article>
        <div class="edit2-card-controls edit2-chapter-controls" aria-label="${escapeAttr(unitLabel)} controls">
          <button class="inline-btn edit2-complete-toggle" type="button" data-edit2-toggle-chapter-complete="${escapeAttr(chapter.id)}" aria-label="${escapeAttr(chapter.completedAt ? `Reopen ${chapter.label}` : `Mark ${chapter.label} complete`)}">
            ${escapeHtml(chapter.completedAt ? `Reopen ${unitLower}` : `Complete ${unitLower}`)}
          </button>
          <button class="icon-btn" type="button" data-edit2-move-chapter="up" data-chapter-id="${escapeAttr(chapter.id)}" aria-label="Move ${escapeAttr(chapter.label)} earlier" ${chapterIndex === 0 ? "disabled" : ""}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 6-5 5" />
              <path d="m12 6 5 5" />
              <path d="M12 6v12" />
            </svg>
          </button>
          <button class="icon-btn" type="button" data-edit2-move-chapter="down" data-chapter-id="${escapeAttr(chapter.id)}" aria-label="Move ${escapeAttr(chapter.label)} later" ${chapterIndex === chapters.length - 1 ? "disabled" : ""}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 18-5-5" />
              <path d="m12 18 5-5" />
              <path d="M12 6v12" />
            </svg>
          </button>
          <button class="icon-btn" type="button" data-edit2-delete-chapter="${escapeAttr(chapter.key)}" aria-label="Delete ${escapeAttr(chapter.label)}" ${hasUnassignedContents ? "disabled" : ""}>
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
    </div>
  `;
}

function renderEdit2IssueGroups(chapter) {
  const unitLower = getStructureUnitLower(currentBundle());
  const currentIssues = chapter.issues.filter((issue) => getEdit2WorkflowStatus(issue) !== "resolved");
  const resolvedIssues = chapter.issues.filter((issue) => getEdit2WorkflowStatus(issue) === "resolved");
  const activeIssueView = editIssueBoardView === "resolved" ? "resolved" : "current";
  const visibleIssues = activeIssueView === "resolved" ? resolvedIssues : currentIssues;
  const title = activeIssueView === "resolved" ? "Archived Issues" : "Open Issues";
  const emptyCopy = activeIssueView === "resolved"
    ? `Archived issues will collect here once you resolve them.`
    : `No open issues are attached to this ${unitLower} right now.`;
  return `
    <section class="edit2-pass-group">
      <div class="section-head">
        <div>
          <h4>${escapeHtml(title)}</h4>
        </div>
        <span class="pill">${formatNumber(visibleIssues.length)} issue${visibleIssues.length === 1 ? "" : "s"}</span>
      </div>
      ${visibleIssues.length ? `
        <div class="edit2-issue-list">
          ${visibleIssues.map((issue) => renderEdit2IssueItem(issue)).join("")}
        </div>
      ` : `<div class="empty">${escapeHtml(emptyCopy)}</div>`}
    </section>
  `;
}

function renderEdit2IssueItem(issue) {
  const workflowStatus = getEdit2WorkflowStatus(issue);
  const priorityLabel = String(issue.priority || "Medium");
  return `
    <article class="edit2-issue-item">
      <div class="edit2-issue-head">
        <div>
          <p class="edit2-issue-kicker">
            ${escapeHtml(issue.type || "General")}
            ${issue.textLocation ? ` · ${escapeHtml(issue.textLocation)}` : ""}
          </p>
          <h5>${escapeHtml(issue.title)}</h5>
        </div>
        <div class="edit2-issue-badges">
          <span class="pill edit2-status-pill workflow-${escapeAttr(workflowStatus)}">${escapeHtml(getEdit2WorkflowLabel(workflowStatus))}</span>
          <span class="pill">${escapeHtml(priorityLabel)}</span>
        </div>
      </div>
      ${issue.snippet ? `<blockquote class="edit2-issue-snippet">${escapeHtml(issue.snippet)}</blockquote>` : ""}
      ${issue.notes ? `<details class="edit2-issue-note-wrap"><summary>Note</summary><p class="edit2-issue-note">${escapeHtml(issue.notes)}</p></details>` : ""}
      <div class="edit2-issue-actions">
        ${workflowStatus !== "resolved" ? `
          <button class="ghost-btn" type="button" data-edit2-workflow="${workflowStatus === "open" ? "in_progress" : "open"}" data-issue-id="${escapeAttr(issue.id)}">
            ${workflowStatus === "open" ? "Start working" : "Mark open"}
          </button>
          <button class="primary-btn" type="button" data-edit2-resolve="resolved" data-issue-id="${escapeAttr(issue.id)}">Resolve</button>
        ` : `
          <button class="ghost-btn" type="button" data-edit2-resolve="open" data-issue-id="${escapeAttr(issue.id)}">Reopen</button>
        `}
        <button class="ghost-btn" type="button" data-edit2-priority-cycle="${escapeAttr(priorityLabel)}" data-issue-id="${escapeAttr(issue.id)}">Priority: ${escapeHtml(priorityLabel)}</button>
        <button class="ghost-btn" type="button" data-edit2-edit-issue="${escapeAttr(issue.id)}">Edit</button>
        <button class="icon-btn" type="button" data-edit2-delete-issue="${escapeAttr(issue.id)}" aria-label="Delete issue">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 7h14"></path>
            <path d="M9 7V4h6v3"></path>
            <path d="M8 7l1 12h6l1-12"></path>
            <path d="M10 11v5"></path>
            <path d="M14 11v5"></path>
          </svg>
        </button>
      </div>
    </article>
  `;
}

function renderEdit2BoardSwitcher(activeBoardView, bundle, chapters) {
  const currentIssueCount = bundle.issues.filter((issue) => issue.status !== "Resolved").length;
  const unitPlural = getStructureUnitPlural(bundle);
  return `
    <div class="edit2-primary-view-switch" role="group" aria-label="Edit board filter">
      <button
        class="edit2-primary-view-tab ${activeBoardView === "chapters" ? "active" : ""}"
        type="button"
        aria-pressed="${activeBoardView === "chapters" ? "true" : "false"}"
        data-edit2-board-view="chapters"
      >
        <span class="edit2-primary-view-label">${escapeHtml(unitPlural)}</span>
        <strong>${formatNumber(chapters.length)} mapped</strong>
      </button>
      <button
        class="edit2-primary-view-tab ${activeBoardView === "issues" ? "active" : ""}"
        type="button"
        aria-pressed="${activeBoardView === "issues" ? "true" : "false"}"
        data-edit2-board-view="issues"
      >
        <span class="edit2-primary-view-label">Issues</span>
        <strong>${formatNumber(currentIssueCount)} current</strong>
      </button>
    </div>
  `;
}

function renderEdit2ChapterBoard(chapters) {
  const unitLabel = getStructureUnitLabel(currentBundle());
  return `
    <div class="edit2-chapter-grid">
      ${chapters.map((chapter, index) => renderEdit2ChapterCard(chapter, chapters, index, chapters.length, unitLabel)).join("")}
    </div>
  `;
}

function renderEdit2IssueBoard(bundle) {
  const unitLabel = getStructureUnitLabel(bundle);
  const unitLower = unitLabel.toLowerCase();
  const unitPluralLower = getStructureUnitPlural(bundle).toLowerCase();
  const issues = [...bundle.issues].sort(compareEditIssuesByPriority);
  const visibleIssues = issues.filter((issue) => issue.status !== "Resolved");
  const resolvedIssues = issues.filter((issue) => issue.status === "Resolved");
  const issueFilterOptions = getEditIssueFilterOptions(visibleIssues);
  editIssueFilters = normalizeEditIssueFilters(editIssueFilters, issueFilterOptions);
  const filteredIssues = getFilteredEditIssues(bundle, visibleIssues, editIssueFilters);
  const resolvedIssueArchive = [...resolvedIssues].sort(compareResolvedEditIssues);
  const issueFilterSummary = describeEditIssueFilterSummary(filteredIssues, editIssueFilters);
  const resolvedIssueSummary = resolvedIssueArchive.length
    ? `${formatNumber(resolvedIssueArchive.length)} resolved issue${resolvedIssueArchive.length === 1 ? "" : "s"} are tucked here for reference. Reopen anything that needs another look.`
    : "Resolved issues will collect here once you start closing them out.";

  return `
    <div class="open-issues-focus edit2-issue-board-panel">
      <div class="edit2-issue-board-toolbar">
        <div class="issue-board-state-toggle" role="tablist" aria-label="Issue board states">
          <button
            class="issue-board-state-btn ${editIssueBoardView === "current" ? "active" : ""}"
            type="button"
            role="tab"
            aria-selected="${editIssueBoardView === "current" ? "true" : "false"}"
            data-edit2-issue-view="current"
          >
            <span>Current</span>
            <strong>${formatNumber(visibleIssues.length)}</strong>
          </button>
          <button
            class="issue-board-state-btn ${editIssueBoardView === "resolved" ? "active" : ""}"
            type="button"
            role="tab"
            aria-selected="${editIssueBoardView === "resolved" ? "true" : "false"}"
            data-edit2-issue-view="resolved"
          >
            <span>Resolved</span>
            <strong>${formatNumber(resolvedIssueArchive.length)}</strong>
          </button>
        </div>
        ${editIssueBoardView === "current" ? `<button class="ghost-btn" id="edit2-open-issue-modal-btn" type="button">Add issue</button>` : ""}
      </div>
      <div class="issue-board-state-shell">
        <p class="small-copy issue-board-state-copy">${escapeHtml(editIssueBoardView === "current" ? "Current issues stay action-oriented here. Resolved items move out of the way until you need the archive." : resolvedIssueSummary)}</p>
      </div>
      ${editIssueBoardView === "current" ? `
        <form class="issue-filter-form" id="edit2-issue-filters-form">
          <label>Priority
            <select name="priority">
              <option value="all" ${editIssueFilters.priority === "all" ? "selected" : ""}>All priorities</option>
              <option value="High" ${editIssueFilters.priority === "High" ? "selected" : ""}>High</option>
              <option value="Medium" ${editIssueFilters.priority === "Medium" ? "selected" : ""}>Medium</option>
              <option value="Low" ${editIssueFilters.priority === "Low" ? "selected" : ""}>Low</option>
            </select>
          </label>
          <label>Type
            <select name="type">
              <option value="all" ${editIssueFilters.type === "all" ? "selected" : ""}>All types</option>
              ${issueFilterOptions.types.map((type) => `<option value="${escapeAttr(type)}" ${editIssueFilters.type === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}
            </select>
          </label>
          <label>${escapeHtml(unitLabel)}
            <select name="section">
              <option value="all" ${editIssueFilters.section === "all" ? "selected" : ""}>All ${escapeHtml(unitPluralLower)}</option>
              ${issueFilterOptions.sections.map((section) => `<option value="${escapeAttr(section)}" ${editIssueFilters.section === section ? "selected" : ""}>${escapeHtml(section)}</option>`).join("")}
            </select>
          </label>
          <label>Sort
            <select name="sort" id="edit2-issue-sort">
              <option value="priority" ${editIssueFilters.sort === "priority" ? "selected" : ""}>Priority first</option>
              <option value="newest" ${editIssueFilters.sort === "newest" ? "selected" : ""}>Newest first</option>
              <option value="oldest" ${editIssueFilters.sort === "oldest" ? "selected" : ""}>Oldest first</option>
              <option value="section" ${editIssueFilters.sort === "section" ? "selected" : ""}>By ${escapeHtml(unitLower)}</option>
              <option value="type" ${editIssueFilters.sort === "type" ? "selected" : ""}>By type</option>
            </select>
          </label>
          <button class="ghost-btn issue-filter-reset" id="edit2-reset-issue-filters-btn" type="button">Reset filters</button>
        </form>
        <p class="small-copy issue-filter-summary">${escapeHtml(issueFilterSummary)}</p>
        <div class="list">
          ${filteredIssues.length ? filteredIssues.map(renderIssueCard).join("") : `<div class="empty">No unresolved issues match these filters right now.</div>`}
        </div>
      ` : `
        <div class="issue-board-archive">
          <div class="list issue-archive-list">
            ${resolvedIssueArchive.length ? resolvedIssueArchive.map((issue) => renderIssueCard(issue, { archived: true })).join("") : `<div class="empty">Resolved issues will collect here once you start closing them out.</div>`}
          </div>
        </div>
      `}
    </div>
  `;
}

function renderEdit2Overview(bundle, manuscript, chapters) {
  const nextFocusRecommendations = buildEdit2NextFocusRecommendations(bundle, chapters);
  noteEdit2PrimaryRecommendation(nextFocusRecommendations.primary);
  const activeBoardView = edit2OverviewBoardView === "issues" ? "issues" : "chapters";
  const isIssueBoard = activeBoardView === "issues";
  const unitLabel = getStructureUnitLabel(bundle);
  const unitLower = unitLabel.toLowerCase();

  return `
    <section class="stack">
      ${renderEdit2NextFocusCards(nextFocusRecommendations)}

      <section class="card edit2-map-card edit2-map-card-full">
        <div class="edit2-board-switcher-wrap">
          ${renderEdit2BoardSwitcher(activeBoardView, bundle, chapters)}
        </div>
        <div class="section-head edit2-board-head">
          <div>
            <h3>${isIssueBoard ? "Issue Board" : "Manuscript Structure"}</h3>
            <p>${isIssueBoard
              ? `Switch into backlog mode without leaving the ${unitLower}-first Edit workspace.`
              : `Stay in scan mode here. Each ${unitLower} row compresses recall and highlights where the most serious revision pressure is still sitting.`}</p>
          </div>
          <div class="edit2-board-head-actions">
            ${!isIssueBoard ? `
              <div class="meta-line">
                <button class="ghost-btn" id="edit2-open-issue-modal-btn" type="button">Add issue</button>
                <button class="primary-btn" id="edit2-open-chapter-modal-btn" type="button">Add ${escapeHtml(unitLower)}</button>
              </div>
            ` : ""}
          </div>
        </div>
        <div class="edit2-board-panel">
          ${isIssueBoard ? renderEdit2IssueBoard(bundle) : renderEdit2ChapterBoard(chapters)}
        </div>
      </section>
    </section>
  `;
}

function renderEdit2ChapterSummarySection(selectedChapter) {
  const unitLower = getStructureUnitLower(currentBundle());
  const completionAction = selectedChapter.completedAt ? `Reopen ${unitLower}` : `Mark ${unitLower} complete`;
  if (edit2SummaryEditMode) {
    return `
      <section class="card edit2-structure-section">
        <div class="section-head">
          <div>
            <h4>Summary</h4>
          </div>
        </div>
        <form class="edit2-summary-form" id="edit2-chapter-summary-form">
          <label class="full">Brief summary
            <textarea name="summary" maxlength="280" placeholder="Example: Pressure Mara into choosing loyalty to her brother over the alliance she thought she wanted.">${escapeHtml(selectedChapter.summary || "")}</textarea>
          </label>
          <div class="edit2-structure-actions">
            <button class="primary-btn" type="submit">Save summary</button>
            <button class="ghost-btn" id="edit2-cancel-summary-edit-btn" type="button">Cancel</button>
          </div>
        </form>
      </section>
    `;
  }

  return `
    <section class="card edit2-structure-section">
      <div class="section-head">
        <div>
          <h4>Summary</h4>
        </div>
        <div class="edit2-structure-actions">
          <button class="ghost-btn" id="edit2-edit-summary-btn" type="button">Edit summary</button>
          <button class="inline-btn" type="button" data-edit2-toggle-chapter-complete="${escapeAttr(selectedChapter.id)}">${escapeHtml(completionAction)}</button>
        </div>
      </div>
      <div class="edit2-summary-display ${selectedChapter.summary ? "" : "is-empty"}">
        <p>${escapeHtml(selectedChapter.summary || `Add a quick ${unitLower} summary.`)}</p>
        ${selectedChapter.completedAt ? `<p class="small-copy">${escapeHtml(`Completed ${formatDate(selectedChapter.completedAt)}`)}</p>` : ""}
      </div>
    </section>
  `;
}

function renderEdit2ChapterDetailTabs(selectedChapter, manuscript) {
  const currentIssues = selectedChapter.issues.filter((issue) => getEdit2WorkflowStatus(issue) !== "resolved");
  const resolvedIssues = selectedChapter.issues.filter((issue) => getEdit2WorkflowStatus(issue) === "resolved");
  const activeIssueView = editIssueBoardView === "resolved" ? "resolved" : "current";
  return `
    <div class="edit2-primary-view-switch edit2-detail-tabs" role="tablist" aria-label="${escapeAttr(selectedChapter.label)} sections">
      <button
        class="edit2-primary-view-tab ${activeIssueView === "current" ? "active" : ""}"
        type="button"
        role="tab"
        aria-selected="${activeIssueView === "current" ? "true" : "false"}"
        data-edit2-detail-tab="current"
      >
        <span class="edit2-primary-view-label">Open issues</span>
        <strong>${formatNumber(currentIssues.length)} current</strong>
      </button>
      <button
        class="edit2-primary-view-tab ${activeIssueView === "resolved" ? "active" : ""}"
        type="button"
        role="tab"
        aria-selected="${activeIssueView === "resolved" ? "true" : "false"}"
        data-edit2-detail-tab="resolved"
      >
        <span class="edit2-primary-view-label">Archived</span>
        <strong>${formatNumber(resolvedIssues.length)} saved</strong>
      </button>
    </div>
  `;
}

function renderEdit2ChapterPage(selectedChapter, manuscript, chapterIndex, chapterCount) {
  const unitLabel = getStructureUnitLabel(currentBundle());
  return `
    <section class="stack">
      <section class="card hero">
        <div class="hero-panel edit2-hero edit2-detail-hero">
          <div class="section-head edit2-detail-hero-head">
            <div class="edit2-detail-title-row">
              <button class="route-chip route-chip-icon-only edit2-detail-back-route" data-edit2-back-to-map type="button" aria-label="Back to Edit workspace">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m14.5 6-6 6 6 6" />
                </svg>
              </button>
              <div>
                <p class="small-copy">Edit</p>
                <h2 class="hero-title">${escapeHtml(selectedChapter.label)}</h2>
              </div>
            </div>
          </div>
        </div>
      </section>

      ${renderEdit2ChapterSummarySection(selectedChapter)}

      <section class="card edit2-detail-page-card">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(unitLabel)} Issues</h3>
            ${renderEdit2ChapterDetailTabs(selectedChapter, manuscript)}
          </div>
          <button class="ghost-btn" id="edit2-open-issue-modal-btn" type="button">Add issue</button>
        </div>
        <section class="edit2-pass-groups">
          ${renderEdit2IssueGroups(selectedChapter)}
        </section>
      </section>
    </section>
  `;
}

function renderEdit2Dashboard(bundle) {
  const view = document.getElementById("view-edit");
  if (!bundle) {
    view.innerHTML = renderWorkspaceEmptyState("Edit");
    bindWorkspaceEmptyActions();
    return;
  }

  const manuscript = buildEdit2Chapters(bundle);
  const chapters = manuscript.chapters;
  const unitLabel = getStructureUnitLabel(bundle);
  const unitLower = unitLabel.toLowerCase();
  const unitPluralLower = getStructureUnitPlural(bundle).toLowerCase();

  if (!chapters.length) {
    edit2ViewMode = "overview";
    view.innerHTML = `
      <section class="stack">
        <section class="card edit2-empty-state">
          <div class="section-head">
            <div>
              <h3>Manuscript Structure</h3>
              <p>Add ${escapeHtml(unitPluralLower)} first so issues and editing sessions have a clear place to live in the manuscript structure.</p>
            </div>
            <div class="meta-line">
              <button class="primary-btn" id="edit2-open-chapter-modal-btn" type="button">Add ${escapeHtml(unitLower)}</button>
            </div>
          </div>
          <div class="empty">No ${escapeHtml(unitLower)} labels have been tracked yet.</div>
        </section>
      </section>
    `;
    bindEdit2DashboardEvents(bundle);
    return;
  }

  const selectedChapter = getEdit2SelectedChapter(chapters);
  if (edit2ViewMode === "detail" && selectedChapter) {
    const chapterIndex = chapters.findIndex((chapter) => chapter.id === selectedChapter.id);
    view.innerHTML = renderEdit2ChapterPage(selectedChapter, manuscript, Math.max(chapterIndex, 0), chapters.length);
  } else {
    edit2ViewMode = "overview";
    view.innerHTML = renderEdit2Overview(bundle, manuscript, chapters);
  }

  bindEdit2DashboardEvents(bundle);
}

function openEdit2ChapterModal() {
  const modal = document.getElementById("edit2-chapter-modal");
  const form = document.getElementById("edit2-chapter-form");
  const title = document.getElementById("edit2-chapter-modal-title");
  const copy = document.getElementById("edit2-chapter-modal-copy");
  const submit = document.getElementById("edit2-chapter-submit-btn");
  const labelText = document.getElementById("edit2-chapter-label-text");
  const labelInput = document.getElementById("edit2-chapter-label-input");
  const summaryLabel = document.getElementById("edit2-chapter-summary-label");
  if (!modal || !form || !title || !copy || !submit) return;
  const unitLabel = getStructureUnitLabel(currentBundle());
  const unitLower = unitLabel.toLowerCase();
  form.reset();
  title.textContent = `Add ${unitLabel}`;
  copy.textContent = `Create a ${unitLower} anchor so issues and editing sessions have a place to live in the manuscript structure.`;
  if (labelText) labelText.textContent = `${unitLabel} label`;
  if (labelInput) labelInput.placeholder = `Example: ${unitLabel} 9`;
  if (summaryLabel) summaryLabel.textContent = `${unitLabel} summary`;
  submit.textContent = `Add ${unitLower}`;
  modal.classList.remove("hidden");
  form.elements.label?.focus();
}

function closeEdit2ChapterModal() {
  const modal = document.getElementById("edit2-chapter-modal");
  const form = document.getElementById("edit2-chapter-form");
  form?.reset();
  modal?.classList.add("hidden");
}

function cycleEdit2Priority(priority) {
  const nextPriority = {
    High: "Medium",
    Medium: "Low",
    Low: "High"
  };
  return nextPriority[String(priority || "Medium")] || "Medium";
}

function updateEdit2ChapterRecords(updater) {
  updateCurrentBundle((projectBundle) => ({
    ...projectBundle,
    editing: {
      ...projectBundle.editing,
      chapters: updater(projectBundle.editing.chapters || [])
    }
  }));
}

function moveEdit2Chapter(chapterId, direction = "up") {
  updateEdit2ChapterRecords((chapters) => {
    const nextChapters = [...chapters];
    const index = nextChapters.findIndex((chapter) => chapter.id === chapterId);
    if (index === -1) return nextChapters;
    const targetIndex = direction === "down" ? index + 1 : index - 1;
    if (targetIndex < 0 || targetIndex >= nextChapters.length) return nextChapters;
    const [chapter] = nextChapters.splice(index, 1);
    nextChapters.splice(targetIndex, 0, chapter);
    return nextChapters.map((entry, order) => ({
      ...entry,
      sortOrder: order
    }));
  });
}

function saveEdit2ChapterSummary(chapterId, summary) {
  updateEdit2ChapterRecords((chapters) => chapters.map((chapter) => chapter.id === chapterId
    ? { ...chapter, summary: String(summary || "").trim() }
    : chapter
  ));
}

function toggleEdit2ChapterComplete(chapterId) {
  const bundle = currentBundle();
  const builtChapter = buildEdit2Chapters(bundle).chapters.find((chapter) => chapter.id === chapterId);
  if (!builtChapter) return null;
  const nextCompletedAt = builtChapter.completedAt ? "" : new Date().toISOString();
  updateEdit2ChapterRecords((chapters) => {
    const chapterExists = chapters.some((chapter) => chapter.id === chapterId);
    if (chapterExists) {
      return chapters.map((chapter) => chapter.id === chapterId
        ? { ...chapter, completedAt: nextCompletedAt }
        : chapter
      );
    }
    return [
      ...chapters,
      createEditingChapter(builtChapter.label, {
        id: builtChapter.id,
        summary: builtChapter.summary,
        sortOrder: builtChapter.sortOrder,
        completedAt: nextCompletedAt
      })
    ];
  });
  return {
    chapter: builtChapter,
    completedAt: nextCompletedAt
  };
}

function addEdit2Chapter(label, summary = "") {
  const unitLabel = getStructureUnitLabel(currentBundle());
  const unitLower = unitLabel.toLowerCase();
  const normalizedLabel = String(label || "").trim();
  if (!normalizedLabel) {
    showToast(`Name the ${unitLower}`, `Give the ${unitLower} a label before adding it to the manuscript structure.`);
    return false;
  }

  const nextLabel = normalizeChapterLabel(normalizedLabel);
  if (nextLabel === "Unassigned") {
    showToast(`Choose a real ${unitLower} name`, `Unassigned is reserved as the fallback bucket for items that lose their ${unitLower}.`);
    return false;
  }

  const existingChapters = currentBundle()?.editing?.chapters || [];
  const duplicateExists = existingChapters.some((chapter) => normalizeChapterLabel(chapter.label).toLowerCase() === nextLabel.toLowerCase());
  if (duplicateExists) {
    showToast(`${unitLabel} already exists`, `${nextLabel} is already part of the manuscript structure.`);
    return false;
  }

  updateEdit2ChapterRecords((chapters) => [
    ...chapters,
    createEditingChapter(nextLabel, {
      summary: String(summary || "").trim(),
      sortOrder: chapters.length
    })
  ]);

  edit2SelectedChapterKey = "";
  edit2ViewMode = "overview";
  persistAndRender();
  showToast(`${unitLabel} added`, `${nextLabel} is now part of the manuscript structure.`);
  return true;
}

function deleteEdit2Chapter(chapterKey) {
  const bundle = currentBundle();
  const unitLabel = getStructureUnitLabel(bundle);
  const unitLower = unitLabel.toLowerCase();
  const normalizedKey = String(chapterKey || "").trim().toLowerCase();
  const chapter = buildEdit2Chapters(bundle).chapters.find((entry) => entry.key === normalizedKey);
  if (!chapter) return;
  const fallbackLabel = "Unassigned";
  const linkedIssueCount = bundle.issues.filter((issue) => normalizeChapterLabel(issue.sectionLabel) === chapter.label).length;
  const linkedSessionCount = bundle.sessions.filter((session) => normalizeChapterLabel(session.sectionLabel) === chapter.label).length;
  if (chapter.label === fallbackLabel && (linkedIssueCount > 0 || linkedSessionCount > 0)) {
    showToast("Keep the fallback bucket", `${fallbackLabel} can only be deleted when it has no linked issues or sessions.`);
    return;
  }

  updateCurrentBundle((projectBundle) => ({
    ...projectBundle,
    editing: {
      ...projectBundle.editing,
      chapters: (projectBundle.editing.chapters || [])
        .filter((entry) => normalizeChapterLabel(entry.label).toLowerCase() !== normalizedKey)
        .map((entry, index) => ({
          ...entry,
          sortOrder: index
        }))
    },
    issues: projectBundle.issues.map((issue) => normalizeChapterLabel(issue.sectionLabel) === chapter.label
      ? { ...issue, sectionLabel: fallbackLabel }
      : issue
    ),
    sessions: projectBundle.sessions.map((session) => normalizeChapterLabel(session.sectionLabel) === chapter.label
      ? { ...session, sectionLabel: fallbackLabel }
      : session
    )
  }));

  if (edit2SelectedChapterKey === chapter.key) {
    edit2SelectedChapterKey = "";
    edit2SummaryEditMode = false;
    edit2ViewMode = "overview";
  }
  persistAndRender();
  showToast(`${unitLabel} deleted`, linkedIssueCount || linkedSessionCount
    ? `${chapter.label} was removed, and linked items were moved to ${fallbackLabel}.`
    : `${chapter.label} was removed from the manuscript structure.`
  );
}

function updateEdit2Issue(issueId, updater) {
  updateCurrentBundle((projectBundle) => ({
    ...projectBundle,
    issues: projectBundle.issues.map((issue) => issue.id === issueId ? normalizeIssue(updater(issue)) : issue)
  }));
}

function openEdit2ChapterByKey(chapterKey) {
  edit2SelectedChapterKey = String(chapterKey || "");
  edit2SummaryEditMode = false;
  editIssueBoardView = "current";
  edit2ViewMode = "detail";
  render();
}

function bindEdit2DashboardEvents(bundle) {
  const view = document.getElementById("view-edit");
  const chapterModal = document.getElementById("edit2-chapter-modal");
  const chapterForm = document.getElementById("edit2-chapter-form");
  const closeChapterButton = document.getElementById("close-edit2-chapter-modal-btn");

  if (view && view.dataset.edit2Delegated !== "true") {
    view.dataset.edit2Delegated = "true";
    view.addEventListener("click", (event) => {
      const completeChapterButton = event.target.closest("[data-edit2-toggle-chapter-complete]");
      if (completeChapterButton) {
        event.preventDefault();
        event.stopPropagation();
        const result = toggleEdit2ChapterComplete(completeChapterButton.dataset.edit2ToggleChapterComplete);
        if (!result) return;
        persistAndRender();
        const unitLabel = getStructureUnitLabel(currentBundle());
        const unitLower = unitLabel.toLowerCase();
        showToast(
          result.completedAt ? `${unitLabel} completed` : `${unitLabel} reopened`,
          result.completedAt ? `${result.chapter.label} now counts toward ${unitLower} completion goals.` : `${result.chapter.label} no longer counts as completed.`
        );
        return;
      }

      const deleteChapterButton = event.target.closest("[data-edit2-delete-chapter]");
      if (deleteChapterButton) {
        event.preventDefault();
        event.stopPropagation();
        deleteEdit2Chapter(deleteChapterButton.dataset.edit2DeleteChapter);
        return;
      }

      const chapterCard = event.target.closest("[data-edit2-open-chapter-card]");
      if (chapterCard && !event.target.closest("button, a, input, select, textarea, label")) {
        event.preventDefault();
        openEdit2ChapterByKey(chapterCard.dataset.edit2OpenChapterCard);
      }
    });

    view.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const chapterCard = event.target.closest("[data-edit2-open-chapter-card]");
      if (!chapterCard || event.target !== chapterCard) return;
      event.preventDefault();
      openEdit2ChapterByKey(chapterCard.dataset.edit2OpenChapterCard);
    });
  }

  view?.querySelectorAll("[data-edit2-board-view]").forEach((button) => {
    button.onclick = () => {
      edit2OverviewBoardView = button.dataset.edit2BoardView === "issues" ? "issues" : "chapters";
      render();
    };
  });

  view?.querySelectorAll("[data-edit2-detail-tab]").forEach((button) => {
    button.onclick = () => {
      const detailTab = button.dataset.edit2DetailTab;
      editIssueBoardView = detailTab === "resolved" ? "resolved" : "current";
      render();
    };
  });

  const edit2IssueFilterForm = document.getElementById("edit2-issue-filters-form");
  if (edit2IssueFilterForm) {
    edit2IssueFilterForm.onchange = () => {
      editIssueFilters = {
        priority: String(edit2IssueFilterForm.elements.priority?.value || "all"),
        type: String(edit2IssueFilterForm.elements.type?.value || "all"),
        section: String(edit2IssueFilterForm.elements.section?.value || "all"),
        sort: String(edit2IssueFilterForm.elements.sort?.value || "priority")
      };
      render();
    };
  }

  const edit2ResetIssueFiltersButton = document.getElementById("edit2-reset-issue-filters-btn");
  if (edit2ResetIssueFiltersButton) {
    edit2ResetIssueFiltersButton.onclick = () => {
      editIssueFilters = createDefaultEditIssueFilters();
      render();
    };
  }

  view?.querySelectorAll("[data-edit2-issue-view]").forEach((button) => {
    button.onclick = () => {
      editIssueBoardView = button.dataset.edit2IssueView === "resolved" ? "resolved" : "current";
      render();
    };
  });

  document.querySelectorAll("[data-edit2-next-focus-action]").forEach((button) => {
    button.onclick = () => {
      clearEdit2NextFocusDisplayState();
      const action = button.dataset.edit2NextFocusAction;
      if (action === "review-issue" && button.dataset.issueId) {
        openIssueModal(button.dataset.issueId);
        return;
      }
      if (action === "open-chapter" && button.dataset.chapterKey) {
        openEdit2ChapterByKey(button.dataset.chapterKey);
        return;
      }
      if (action === "add-issue") {
        openIssueModal();
        return;
      }
      if (action === "add-chapter") {
        openEdit2ChapterModal();
      }
    };
  });

  document.querySelectorAll("[data-edit2-open-chapter]").forEach((button) => {
    button.onclick = () => {
      openEdit2ChapterByKey(button.dataset.edit2OpenChapter);
    };
  });

  document.querySelectorAll("[data-edit2-back-to-map]").forEach((button) => {
    button.onclick = () => {
      edit2SummaryEditMode = false;
      edit2ViewMode = "overview";
      render();
    };
  });

  const openIssueButton = document.getElementById("edit2-open-issue-modal-btn");
  if (openIssueButton) {
    openIssueButton.onclick = () => {
      openIssueModal();
    };
  }

  const openChapterButton = document.getElementById("edit2-open-chapter-modal-btn");
  if (openChapterButton) {
    openChapterButton.onclick = () => {
      openEdit2ChapterModal();
    };
  }

  document.querySelectorAll("[data-edit2-move-chapter]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveEdit2Chapter(button.dataset.chapterId, button.dataset.edit2MoveChapter);
      persistAndRender();
      const unitLabel = getStructureUnitLabel(currentBundle());
      const unitLower = unitLabel.toLowerCase();
      showToast(`${unitLabel} moved`, button.dataset.edit2MoveChapter === "down" ? `That ${unitLower} moved later in the manuscript.` : `That ${unitLower} moved earlier in the manuscript.`);
    };
  });

  document.querySelectorAll("[data-edit2-delete-chapter]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      deleteEdit2Chapter(button.dataset.edit2DeleteChapter);
    };
  });

  const chapterSummaryForm = document.getElementById("edit2-chapter-summary-form");
  if (chapterSummaryForm) {
    chapterSummaryForm.onsubmit = (event) => {
      event.preventDefault();
      const chapter = buildEdit2Chapters(currentBundle()).chapters.find((entry) => entry.key === edit2SelectedChapterKey);
      if (!chapter) return;
      saveEdit2ChapterSummary(chapter.id, chapterSummaryForm.elements.summary?.value || "");
      edit2SummaryEditMode = false;
      persistAndRender();
      showToast("Summary saved", `${chapter.label} now has an updated ${getStructureUnitLower(currentBundle())} purpose summary.`);
    };
  }

  const editSummaryButton = document.getElementById("edit2-edit-summary-btn");
  if (editSummaryButton) {
    editSummaryButton.onclick = () => {
      edit2SummaryEditMode = true;
      render();
    };
  }

  const cancelSummaryEditButton = document.getElementById("edit2-cancel-summary-edit-btn");
  if (cancelSummaryEditButton) {
    cancelSummaryEditButton.onclick = () => {
      edit2SummaryEditMode = false;
      render();
    };
  }

  if (closeChapterButton) {
    closeChapterButton.onclick = () => {
      closeEdit2ChapterModal();
    };
  }

  if (chapterModal) {
    chapterModal.onclick = (event) => {
      if (event.target === chapterModal) closeEdit2ChapterModal();
    };
  }

  if (chapterForm) {
    chapterForm.onsubmit = (event) => {
      event.preventDefault();
      const formData = new FormData(chapterForm);
      const didAdd = addEdit2Chapter(
        String(formData.get("label") || ""),
        String(formData.get("summary") || "")
      );
      if (didAdd) closeEdit2ChapterModal();
    };
  }

  document.querySelectorAll("[data-edit2-edit-issue]").forEach((button) => {
    button.onclick = () => {
      openIssueModal(button.dataset.edit2EditIssue);
    };
  });

  document.querySelectorAll("[data-edit2-delete-issue]").forEach((button) => {
    button.onclick = () => {
      const issueId = button.dataset.edit2DeleteIssue;
      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        issues: projectBundle.issues.filter((issue) => issue.id !== issueId)
      }));
      persistAndRender();
      showToast("Issue deleted", `That issue was removed from the ${getStructureUnitLower(currentBundle())}.`);
    };
  });

  view?.querySelectorAll("[data-action='edit-issue']").forEach((button) => {
    button.onclick = () => {
      openIssueModal(button.dataset.id);
    };
  });

  view?.querySelectorAll("[data-action='toggle-issue-status']").forEach((button) => {
    button.onclick = () => {
      const issueId = button.dataset.id;
      const existingIssue = bundle.issues.find((issue) => issue.id === issueId);
      const nextStatus = existingIssue?.status === "Resolved" ? "Open" : "Resolved";
      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        issues: projectBundle.issues.map((issue) => {
          if (issue.id !== issueId) return issue;
          return {
            ...issue,
            status: nextStatus,
            workflowStatus: nextStatus === "Resolved" ? "resolved" : "open",
            resolvedAt: nextStatus === "Resolved" ? (issue.resolvedAt || new Date().toISOString()) : ""
          };
        })
      }));
      editIssueBoardView = nextStatus === "Resolved" ? "resolved" : "current";
      persistAndRender();
      showToast("Issue updated", nextStatus === "Resolved" ? "That issue moved to the resolved board." : "That issue is back in the current board.");
    };
  });

  view?.querySelectorAll("[data-action='delete-issue']").forEach((button) => {
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

  document.querySelectorAll("[data-edit2-workflow]").forEach((button) => {
    button.onclick = () => {
      const issueId = button.dataset.issueId;
      const nextWorkflow = button.dataset.edit2Workflow;
      updateEdit2Issue(issueId, (issue) => ({
        ...issue,
        workflowStatus: nextWorkflow === "in_progress" ? "in_progress" : "open",
        status: issue.status === "Resolved" ? "Open" : issue.status,
        resolvedAt: ""
      }));
      persistAndRender();
      showToast("Issue updated", nextWorkflow === "in_progress" ? "That issue is marked in progress." : "That issue is back in the open queue.");
    };
  });

  document.querySelectorAll("[data-edit2-resolve]").forEach((button) => {
    button.onclick = () => {
      const issueId = button.dataset.issueId;
      const nextState = button.dataset.edit2Resolve;
      updateEdit2Issue(issueId, (issue) => ({
        ...issue,
        workflowStatus: nextState === "resolved" ? "resolved" : "open",
        status: nextState === "resolved" ? "Resolved" : "Open",
        resolvedAt: nextState === "resolved" ? (issue.resolvedAt || new Date().toISOString()) : ""
      }));
      persistAndRender();
      showToast("Issue updated", nextState === "resolved" ? "That issue is marked resolved." : "That issue is back in the revision queue.");
    };
  });

  document.querySelectorAll("[data-edit2-priority-cycle]").forEach((button) => {
    button.onclick = () => {
      const issueId = button.dataset.issueId;
      updateEdit2Issue(issueId, (issue) => ({
        ...issue,
        priority: cycleEdit2Priority(issue.priority)
      }));
      persistAndRender();
      showToast("Priority updated", "That issue was reprioritized for the next review decision.");
    };
  });
}
