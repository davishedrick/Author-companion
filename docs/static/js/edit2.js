const EDIT2_PASS_ORDER = ["developmental", "clarity", "polish"];
const EDIT2_PASS_CONFIG = {
  developmental: {
    label: "Developmental",
    shortLabel: "Dev",
    weight: 5,
    defaultPriority: "High",
    summary: "Structure, pacing, story shape, and the clarity of big ideas."
  },
  clarity: {
    label: "Clarity",
    shortLabel: "Clarity",
    weight: 3,
    defaultPriority: "Medium",
    summary: "Sentence flow, readability, voice, and line-level improvements."
  },
  polish: {
    label: "Polish",
    shortLabel: "Polish",
    weight: 1,
    defaultPriority: "Low",
    summary: "Grammar, copyediting, proofreading, and final cleanup."
  }
};
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

function normalizeEdit2PassKey(value = "", fallback = "") {
  const source = `${String(value || "").trim()} ${String(fallback || "").trim()}`.toLowerCase();
  if (/clarity|line/.test(source)) return "clarity";
  if (/polish|copy|proof|grammar/.test(source)) return "polish";
  return "developmental";
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

function getEdit2PassSummaryStatus(summary) {
  if (!summary.total && !summary.sessions) return "Not Started";
  if (!summary.open && !summary.inProgress && (summary.resolved || summary.sessions)) return "Done";
  return "In Progress";
}

function finalizeEdit2Chapter(chapter) {
  const passStatuses = Object.fromEntries(
    EDIT2_PASS_ORDER.map((passKey) => [passKey, getEdit2PassSummaryStatus(chapter.passSummaries[passKey])])
  );
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
  const donePassCount = Object.values(passStatuses).filter((status) => status === "Done").length;
  const totalHeat = Object.values(heatByPass).reduce((sum, value) => sum + value, 0);

  return {
    ...chapter,
    passStatuses,
    heatByPass,
    totalHeat,
    openIssueCount,
    priorityCounts,
    resolvedIssueCount,
    donePassCount
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
      sortOrder: Math.max(0, number(overrides.sortOrder !== undefined ? overrides.sortOrder : existing.sortOrder))
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
      sortOrder: chapter.sortOrder ?? index
    });
  });

  bundle.issues.forEach((issue) => {
    const chapter = ensureChapter(issue.sectionLabel);
    const passKey = normalizeEdit2PassKey(issue.passName, bundle.editing.passStage);
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
    const passKey = normalizeEdit2PassKey(session.passName, bundle.editing.passStage);
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
  return String(issue?.priority || EDIT2_PASS_CONFIG[issue?.passKey || "developmental"]?.defaultPriority || "Medium");
}

function getEdit2IssuePriorityRank(priorityLabel = "Medium") {
  const priorityRank = { High: 3, Medium: 2, Low: 1 };
  return priorityRank[String(priorityLabel || "Medium")] || 0;
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

function getEdit2RecommendationSignals(issue, chapter) {
  return {
    priorityRank: getEdit2IssuePriorityRank(getEdit2IssuePriorityLabel(issue)),
    unresolvedInChapter: getEdit2FocusIssues(chapter).length,
    chapterHeat: getEdit2FilteredHeat(chapter),
    lastTouchedAt: chapter.lastTouchedAt
  };
}

function scoreEdit2NextFocusIssue(issue, signals) {
  return (
    (signals.priorityRank * 100)
    + (signals.unresolvedInChapter * 12)
    + Math.round(signals.chapterHeat * 10)
    + (issue.workflowStatus === "in_progress" ? 18 : 0)
  );
}

function getEdit2NextFocusReasons(issue, chapter, signals, unitLabel = "Chapter") {
  const priorityLabel = getEdit2IssuePriorityLabel(issue);
  const passLabel = EDIT2_PASS_CONFIG[issue.passKey]?.label || "Editing";
  const reasons = [`${priorityLabel} priority issue in structure`];

  if (signals.unresolvedInChapter >= 2) {
    reasons.push(`Multiple unresolved issues in this ${unitLabel.toLowerCase()}`);
  } else if (signals.unresolvedInChapter === 1) {
    reasons.push(`Only unresolved issue in this ${unitLabel.toLowerCase()}`);
  }

  if (issue.workflowStatus === "in_progress") {
    reasons.push("Already in progress with active context");
  } else {
    reasons.push(`${passLabel} pass needs attention next`);
  }

  return reasons.slice(0, 3);
}

function buildEdit2ChapterFallbackRecommendation(chapter, label = "Scan structure", unitLabel = "Chapter") {
  const hasMixedPasses = EDIT2_PASS_ORDER
    .filter((passKey) => getEdit2ChapterOpenStageCount(chapter, passKey) > 0)
    .length >= 2;

  return {
    label,
    title: chapter.label,
    reasons: chapter.openIssueCount
      ? [
        `${unitLabel} still has unresolved issues`,
        hasMixedPasses ? "Issue mix spans several editing passes" : "One editing pass needs attention"
      ]
      : [
        "Fresh scan can reveal missing issues",
        `${unitLabel} context needs a clean review`
      ],
    meta: `${chapter.openIssueCount} open · ${formatNumber(chapter.donePassCount)} / ${EDIT2_PASS_ORDER.length} passes done`,
    primaryAction: "open-chapter",
    primaryLabel: `Open ${unitLabel.toLowerCase()}`,
    secondaryAction: "add-issue",
    secondaryLabel: "Add issue",
    chapterKey: chapter.key
  };
}

function buildEdit2NextFocusRecommendations(bundle, chapters) {
  const unitLabel = getStructureUnitLabel(bundle);
  const rankedCandidates = chapters
    .flatMap((chapter) => getEdit2FocusIssues(chapter).map((issue) => ({
      issue,
      chapter,
      signals: getEdit2RecommendationSignals(issue, chapter)
    })))
    .sort((a, b) => {
      const scoreDelta = scoreEdit2NextFocusIssue(b.issue, b.signals) - scoreEdit2NextFocusIssue(a.issue, a.signals);
      if (scoreDelta !== 0) return scoreDelta;
      const heatDelta = getEdit2FilteredHeat(b.chapter) - getEdit2FilteredHeat(a.chapter);
      if (heatDelta !== 0) return heatDelta;
      return String(a.issue.title || "").localeCompare(String(b.issue.title || ""));
    });

  if (rankedCandidates.length) {
    const labels = ["Highest pressure", "Strong next move", "Keep moving"];
    const recommendations = rankedCandidates.slice(0, 3).map(({ issue, chapter, signals }, index) => {
      const priorityLabel = getEdit2IssuePriorityLabel(issue);
      const passLabel = EDIT2_PASS_CONFIG[issue.passKey].label;
      return {
        label: labels[index] || "Next move",
        title: issue.title,
        reasons: getEdit2NextFocusReasons(issue, chapter, signals, unitLabel),
        meta: `${chapter.label} · ${passLabel} · ${priorityLabel} priority`,
        primaryAction: "review-issue",
        primaryLabel: "Review issue",
        secondaryAction: "open-chapter",
        secondaryLabel: `Open ${unitLabel.toLowerCase()}`,
        issueId: issue.id,
        chapterKey: chapter.key
      };
    });

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

      return [...recommendations, ...fallbackChapters];
    }

    return recommendations;
  }

  if (chapters.length) {
    return [...chapters]
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
  }

  return [
    {
      label: "Best next move",
      title: `Create the first ${unitLabel.toLowerCase()} anchor`,
      reasons: [
        `${unitLabel} structure needs its first anchor`,
        "Issues need a clear home first"
      ],
      meta: `${bundle.editing?.passName || "All stages"} · No ${getStructureUnitPlural(bundle).toLowerCase()} tracked`,
      primaryAction: "add-chapter",
      primaryLabel: `Add ${unitLabel.toLowerCase()}`,
      secondaryAction: "start-session",
      secondaryLabel: "Start editing session"
    }
  ];
}

function renderEdit2LaunchCard(bundle, manuscript, chapters) {
  const editStats = getEditStats(bundle);
  const unitLabel = getStructureUnitLabel(bundle);
  const unitLower = unitLabel.toLowerCase();
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEditSessions = [...getEditSessions(bundle)]
    .filter((session) => dateKey(session.date) === todayKey);
  const currentPassName = bundle.editing?.passName || defaultPassName(bundle.editing?.passStage);
  const lastSession = editStats.lastSession;
  const lastAnchor = lastSession?.sectionLabel || chapters.find((chapter) => chapter.lastTouchedAt)?.label || `No ${unitLower} touched yet`;

  return `
    <section class="card">
      <div class="writing-launch edit2-launch">
        <div class="writing-launch-copy">
          <div>
            <h3>Get editing</h3>
            <p>Jump into the current revision pass, log what you touched, and keep the ${unitLower} map honest as you move through the manuscript.</p>
          </div>
          <p class="edit2-launch-meta">
            Current pass: ${escapeHtml(currentPassName)}. ${formatNumber(todayEditSessions.length)} session${todayEditSessions.length === 1 ? "" : "s"} today, ${formatHours(editStats.minutesToday)} edited today, and ${formatNumber(manuscript.totalOpenIssues)} unresolved issue${manuscript.totalOpenIssues === 1 ? "" : "s"} still on the board.
          </p>
          <p class="edit2-launch-note">
            Last worked on: <strong>${escapeHtml(lastAnchor)}</strong>${lastSession?.date ? ` on ${escapeHtml(formatDate(lastSession.date))}` : ""}.
          </p>
        </div>
        <button class="primary-btn writing-launch-cta" id="edit2-start-session-btn" type="button">Start editing session</button>
      </div>
    </section>
  `;
}

function renderEdit2NextFocusCards(recommendations) {
  return `
    <section class="card next-focus-card">
      <div class="section-head">
        <div>
          <h3>Next Focus</h3>
          <p>Pick from the strongest open issues first. Priority and issue concentration drive the order.</p>
        </div>
      </div>
      <div class="next-focus-list next-focus-list-${recommendations.length}">
        ${recommendations.map((recommendation) => `
          <article class="next-focus-option">
            <div class="next-focus-copy">
              <p class="next-focus-kicker">${escapeHtml(recommendation.label)}</p>
              <h4>${escapeHtml(recommendation.title)}</h4>
              ${recommendation.description ? `<p>${escapeHtml(recommendation.description)}</p>` : ""}
            </div>
            ${recommendation.meta ? `<p class="edit2-focus-meta">${escapeHtml(recommendation.meta)}</p>` : ""}
            <div class="next-focus-reason">
              <strong>Why this surfaced:</strong>
              <ul>
                ${(recommendation.reasons || []).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
              </ul>
            </div>
            <div class="next-focus-actions">
              ${recommendation.primaryAction ? `
                <button
                  class="primary-btn"
                  type="button"
                  data-edit2-next-focus-action="${escapeAttr(recommendation.primaryAction)}"
                  ${recommendation.issueId ? `data-issue-id="${escapeAttr(recommendation.issueId)}"` : ""}
                  ${recommendation.chapterKey ? `data-chapter-key="${escapeAttr(recommendation.chapterKey)}"` : ""}
                >${escapeHtml(recommendation.primaryLabel)}</button>
              ` : ""}
              ${recommendation.secondaryAction ? `
                <button
                  class="ghost-btn"
                  type="button"
                  data-edit2-next-focus-action="${escapeAttr(recommendation.secondaryAction)}"
                  ${recommendation.issueId ? `data-issue-id="${escapeAttr(recommendation.issueId)}"` : ""}
                  ${recommendation.chapterKey ? `data-chapter-key="${escapeAttr(recommendation.chapterKey)}"` : ""}
                >${escapeHtml(recommendation.secondaryLabel)}</button>
              ` : ""}
            </div>
          </article>
        `).join("")}
      </div>
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
  const openByPass = Object.fromEntries(
    EDIT2_PASS_ORDER.map((passKey) => [passKey, getEdit2ChapterOpenStageCount(chapter, passKey)])
  );
  const priorityTotal = number(chapter.priorityCounts.high) + number(chapter.priorityCounts.medium) + number(chapter.priorityCounts.low);
  const priorityEvaluation = getEdit2PriorityEvaluation(chapter, chapters);
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
            <span class="edit2-pass-pill">${formatNumber(chapter.donePassCount)} / ${EDIT2_PASS_ORDER.length} passes</span>
          </div>
          <div class="edit2-chapter-issue-box">
            <p class="edit2-mini-label">Issues</p>
            <div class="edit2-chapter-mix-list">
              ${EDIT2_PASS_ORDER.map((passKey) => `
                <div class="edit2-chapter-mix-row">
                  <span>${escapeHtml(EDIT2_PASS_CONFIG[passKey].shortLabel)}</span>
                  <strong>${formatNumber(openByPass[passKey])}</strong>
                </div>
              `).join("")}
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
  return EDIT2_PASS_ORDER
    .map((passKey) => {
      const passIssues = chapter.issues.filter((issue) => issue.passKey === passKey);
      return `
        <section class="edit2-pass-group">
          <div class="section-head">
            <div>
              <h4>${escapeHtml(EDIT2_PASS_CONFIG[passKey].label)}</h4>
              <p>${escapeHtml(EDIT2_PASS_CONFIG[passKey].summary)}</p>
            </div>
            <span class="pill">${formatNumber(passIssues.length)} issue${passIssues.length === 1 ? "" : "s"}</span>
          </div>
          ${passIssues.length ? `
            <div class="edit2-issue-list">
              ${passIssues.map((issue) => renderEdit2IssueItem(issue)).join("")}
            </div>
          ` : `<div class="empty">No matching ${EDIT2_PASS_CONFIG[passKey].label.toLowerCase()} issues for this ${escapeHtml(unitLower)} right now.</div>`}
        </section>
      `;
    }).join("");
}

function renderEdit2IssueItem(issue) {
  const workflowStatus = getEdit2WorkflowStatus(issue);
  const priorityLabel = String(issue.priority || "Medium");
  return `
    <article class="edit2-issue-item">
      <div class="edit2-issue-head">
        <div>
          <p class="edit2-issue-kicker">
            ${escapeHtml(EDIT2_PASS_CONFIG[issue.passKey].label)}
            · ${escapeHtml(issue.type || "General")}
            ${issue.textLocation ? ` · ${escapeHtml(issue.textLocation)}` : ""}
          </p>
          <h5>${escapeHtml(issue.title)}</h5>
        </div>
        <div class="edit2-issue-badges">
          <span class="pill edit2-status-pill workflow-${escapeAttr(workflowStatus)}">${escapeHtml(getEdit2WorkflowLabel(workflowStatus))}</span>
          <span class="pill">${escapeHtml(priorityLabel)}</span>
        </div>
      </div>
      ${issue.notes ? `<p class="edit2-issue-note">${escapeHtml(issue.notes)}</p>` : ""}
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
    ? `${formatNumber(resolvedIssueArchive.length)} resolved issue${resolvedIssueArchive.length === 1 ? "" : "s"} are tucked here for reference. Reopen anything that needs another pass.`
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
          <label>Pass
            <select name="passScope">
              <option value="current" ${editIssueFilters.passScope === "current" ? "selected" : ""}>Current pass</option>
              <option value="all" ${editIssueFilters.passScope === "all" ? "selected" : ""}>All passes</option>
            </select>
          </label>
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
  const activeBoardView = edit2OverviewBoardView === "issues" ? "issues" : "chapters";
  const isIssueBoard = activeBoardView === "issues";
  const unitLabel = getStructureUnitLabel(bundle);
  const unitLower = unitLabel.toLowerCase();

  return `
    <section class="stack">
      ${renderEdit2LaunchCard(bundle, manuscript, chapters)}

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
  if (edit2SummaryEditMode) {
    return `
      <section class="card edit2-structure-section">
        <div class="section-head">
          <div>
            <h4>Summary</h4>
            <p>Keep this brief and structural. It should explain why this ${escapeHtml(unitLower)} exists in the manuscript.</p>
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
          <p>Keep this brief and structural. It should explain why this ${escapeHtml(unitLower)} exists in the manuscript.</p>
        </div>
        <button class="ghost-btn" id="edit2-edit-summary-btn" type="button">Edit summary</button>
      </div>
      <div class="edit2-summary-display ${selectedChapter.summary ? "" : "is-empty"}">
        <p>${escapeHtml(selectedChapter.summary || `No summary yet. Add a short purpose note when this ${unitLower} needs clearer context.`)}</p>
      </div>
    </section>
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
                <p class="muted">A focused workspace for reviewing the issues attached to this part of the manuscript.</p>
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
            <p>Review the issues attached to this part of the manuscript across the three editing stages.</p>
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
        ${renderEdit2LaunchCard(bundle, manuscript, chapters)}
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

function openEdit2SessionFlow() {
  if (getActiveFocusSession()) {
    showToast("Session already running", "Return to focus mode from the timer chip or end the current session before starting another.");
    return;
  }
  openEditSessionStartModal();
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

  const edit2IssueFilterForm = document.getElementById("edit2-issue-filters-form");
  if (edit2IssueFilterForm) {
    edit2IssueFilterForm.onchange = () => {
      editIssueFilters = {
        passScope: String(edit2IssueFilterForm.elements.passScope?.value || "current"),
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
      const action = button.dataset.edit2NextFocusAction;
      if (action === "review-issue" && button.dataset.issueId) {
        openIssueModal(button.dataset.issueId);
        return;
      }
      if (action === "open-chapter" && button.dataset.chapterKey) {
        openEdit2ChapterByKey(button.dataset.chapterKey);
        return;
      }
      if (action === "start-session") {
        openEdit2SessionFlow();
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

  const startSessionButton = document.getElementById("edit2-start-session-btn");
  if (startSessionButton) {
    startSessionButton.onclick = () => {
      openEdit2SessionFlow();
    };
  }

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
      showToast("Priority updated", "That issue was reprioritized for the next pass decision.");
    };
  });
}
