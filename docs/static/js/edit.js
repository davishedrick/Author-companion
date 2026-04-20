let editSessionDraftMinutes = 45;
let activeEditingSession = null;
let editingSessionInFocusMode = true;
let pendingCompletedEditSession = null;
let editSessionTimerHandle = null;
let editIssueFilters = createDefaultEditIssueFilters();
let editIssueBoardView = "current";

function createDefaultEditIssueFilters() {
  return {
    passScope: "current",
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
  const allowedScopes = ["current", "all"];
  const allowedPriorities = ["all", "High", "Medium", "Low"];
  const allowedSorts = ["priority", "newest", "oldest", "section", "type"];

  return {
    passScope: allowedScopes.includes(filters?.passScope) ? filters.passScope : defaults.passScope,
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

function scopeMatchesEditPass(itemPassName, currentPassName, scope = "current") {
  if (scope === "all") return true;
  return !itemPassName || itemPassName === currentPassName;
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
  const currentPassName = bundle.editing.passName || defaultPassName(bundle.editing.passStage);
  const normalizedFilters = normalizeEditIssueFilters(filters, getEditIssueFilterOptions(issues));

  return [...issues]
    .filter((issue) => issue.status !== "Resolved")
    .filter((issue) => scopeMatchesEditPass(issue.passName, currentPassName, normalizedFilters.passScope))
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

function buildEditSectionHotspots(bundle, scope = "current") {
  const currentPassName = bundle.editing.passName || defaultPassName(bundle.editing.passStage);
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
    .filter((issue) => scopeMatchesEditPass(issue.passName, currentPassName, scope))
    .forEach((issue) => {
      const entry = getSectionEntry(issue.sectionLabel);
      if (!entry) return;
      if (issue.status === "Resolved") entry.resolvedIssueCount += 1;
      else if (issue.status === "Deferred") entry.deferredIssueCount += 1;
      else entry.openIssueCount += 1;
      markTouched(entry, issue.createdAt);
    });

  getEditSessions(bundle)
    .filter((session) => scopeMatchesEditPass(session.passName, currentPassName, scope))
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

function describeEditRecommendationReason(issue, signals, lens = "urgent") {
  const reasonParts = [`${issue.priority} priority in the current pass`];

  if (signals.unresolvedInSection >= 2) {
    reasonParts.push(`${formatNumber(signals.unresolvedInSection)} unresolved issues sit in ${issue.sectionLabel || "this section"}`);
  } else if (signals.unresolvedInSection === 1 && issue.sectionLabel) {
    reasonParts.push(`${issue.sectionLabel} is down to a single unresolved issue`);
  }

  if (lens === "momentum") {
    if (signals.sameAsLastSession && issue.sectionLabel) {
      reasonParts.push(`you edited ${issue.sectionLabel} most recently, so context should still be warm`);
    } else if (signals.lastTouchedLabel) {
      reasonParts.push(`this section was touched recently on ${signals.lastTouchedLabel}`);
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

function buildEditIssueRecommendation(issue, signals, lens = "urgent") {
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
      ? `Start with ${issue.sectionLabel} so the highest-value issue in the current pass is handled first.`
      : `Start here because it is the strongest unresolved issue in the current pass.`
  };

  return {
    label: labels[lens] || labels.primary,
    title: issue.title,
    description: descriptions[lens] || descriptions.primary,
    reason: describeEditRecommendationReason(issue, signals, lens),
    badges: [
      issue.priority,
      issue.type,
      issue.sectionLabel || "No section tagged"
    ],
    primaryAction: "review-issue",
    primaryLabel: "Review issue",
    secondaryAction: issue.sectionLabel ? "filter-section" : "start-session",
    secondaryLabel: issue.sectionLabel ? "Show section issues" : "Start editing session",
    issueId: issue.id,
    filterSection: issue.sectionLabel || ""
  };
}

function buildFallbackEditRecommendation(bundle, editStats) {
  const currentPassName = bundle.editing.passName || defaultPassName(bundle.editing.passStage);
  const sectionsRemaining = Math.max(number(bundle.editing.progressTotal) - number(bundle.editing.progressCurrent), 0);

  if (sectionsRemaining > 0) {
    return {
      label: "Keep the pass moving",
      title: "Start a fresh pass session",
      description: `${formatNumber(sectionsRemaining)} section${sectionsRemaining === 1 ? "" : "s"} remain in this pass. A fresh timed session is the fastest way to keep momentum from drifting.`,
      reason: `${formatNumber(bundle.editing.progressCurrent)} of ${formatNumber(bundle.editing.progressTotal)} sections are marked complete, and there are no current issues steering the next move right now.`,
      badges: [
        `${formatNumber(bundle.editing.progressCurrent)} / ${formatNumber(bundle.editing.progressTotal)} sections reviewed`,
        `${formatHours(editStats.currentPassMinutes)} in this pass`,
        bundle.editing.passStatus || "In progress"
      ],
      primaryAction: "start-session",
      primaryLabel: "Start editing session",
      secondaryAction: "change-pass",
      secondaryLabel: "Adjust pass"
    };
  }

  if (editStats.lastSession?.sectionLabel) {
    return {
      label: "Best next move",
      title: `Pick up from ${editStats.lastSession.sectionLabel}`,
      description: `That was the most recently edited section. Use it as the handoff point for your next cleanup or polish pass.`,
      reason: `There are no open issues in the current pass, so the recommendation falls back to your most recent editing context from ${formatDate(editStats.lastSession.date)}.`,
      badges: [
        formatDate(editStats.lastSession.date),
        `${formatNumber(editStats.sessionCount)} editing session${editStats.sessionCount === 1 ? "" : "s"} logged`,
        `${formatNumber(editStats.resolvedIssueCount)} resolved issue${editStats.resolvedIssueCount === 1 ? "" : "s"}`
      ],
      primaryAction: "start-session",
      primaryLabel: "Start editing session",
      secondaryAction: "add-issue",
      secondaryLabel: "Log issue"
    };
  }

  return {
    label: "Best next move",
    title: "Create the first revision anchor",
    description: "Start by logging an issue or a timed editing session so the dashboard can begin steering what needs attention next.",
    reason: `Priority-led recommendations need at least one current-pass issue. Until then, the safest suggestion is to start logging what you find.`,
    badges: [
      currentPassName,
      bundle.editing.passStatus || "Not started",
      "No edit history yet"
    ],
    primaryAction: "add-issue",
    primaryLabel: "Add issue",
    secondaryAction: "start-session",
    secondaryLabel: "Start editing session"
  };
}

function deriveEditFocusRecommendations(bundle, unresolvedIssues, hotspots, editStats) {
  const currentPassName = bundle.editing.passName || defaultPassName(bundle.editing.passStage);
  const currentPassIssues = unresolvedIssues.filter((issue) => scopeMatchesEditPass(issue.passName, currentPassName, "current"));

  if (!currentPassIssues.length) {
    return [buildFallbackEditRecommendation(bundle, editStats)];
  }

  const signalsById = new Map(currentPassIssues.map((issue) => [issue.id, getEditIssueRecommendationSignals(issue, hotspots, editStats)]));
  const rankIssues = (lens) => [...currentPassIssues].sort((a, b) => {
    const scoreDelta = scoreEditIssueRecommendation(b, signalsById.get(b.id), lens) - scoreEditIssueRecommendation(a, signalsById.get(a.id), lens);
    if (scoreDelta !== 0) return scoreDelta;
    return compareEditIssuesByPriority(a, b);
  });

  const orderedCandidates = currentPassIssues.length <= 2
    ? [{ lens: "primary", issues: rankIssues("urgent") }]
    : [
        { lens: "urgent", issues: rankIssues("urgent") },
        { lens: "momentum", issues: rankIssues("momentum") },
        { lens: "cleanup", issues: rankIssues("cleanup") }
      ];

  const usedIssueIds = new Set();
  const recommendations = [];

  orderedCandidates.forEach(({ lens, issues }) => {
    const nextIssue = issues.find((issue) => !usedIssueIds.has(issue.id));
    if (!nextIssue) return;
    usedIssueIds.add(nextIssue.id);
    recommendations.push(buildEditIssueRecommendation(nextIssue, signalsById.get(nextIssue.id), lens));
  });

  if (currentPassIssues.length > 2 && recommendations.length < 3) {
    rankIssues("urgent").forEach((issue) => {
      if (recommendations.length >= 3 || usedIssueIds.has(issue.id)) return;
      usedIssueIds.add(issue.id);
      recommendations.push(buildEditIssueRecommendation(issue, signalsById.get(issue.id), "urgent"));
    });
  }

  return recommendations;
}

function describeEditIssueFilterSummary(issues, filters) {
  if (!issues.length) return "No unresolved issues match these filters right now.";
  const scopeLabel = filters.passScope === "all" ? "across all passes" : "in the current pass";
  const extraFilters = [filters.priority, filters.type, filters.section].filter((value) => value && value !== "all");
  return `${formatNumber(issues.length)} unresolved issue${issues.length === 1 ? "" : "s"} ${scopeLabel}${extraFilters.length ? ` filtered by ${extraFilters.join(", ")}` : ""}.`;
}

function getCurrentPassUnresolvedIssueCount(bundle) {
  if (!bundle) return 0;
  const currentPassName = bundle.editing.passName || defaultPassName(bundle.editing.passStage);
  return bundle.issues.filter((issue) => issue.status !== "Resolved" && scopeMatchesEditPass(issue.passName, currentPassName, "current")).length;
}

function compareResolvedEditIssues(a, b) {
  const dateDelta = new Date(b.resolvedAt || b.createdAt || 0) - new Date(a.resolvedAt || a.createdAt || 0);
  if (dateDelta !== 0) return dateDelta;
  return String(a.title || "").localeCompare(String(b.title || ""));
}

function getEditPassNameOptions(bundle) {
  const currentPassName = bundle?.editing?.passName || defaultPassName(bundle?.editing?.passStage);
  return [...new Set([
    currentPassName,
    ...(bundle?.issues || []).map((issue) => String(issue.passName || "").trim()),
    ...(bundle?.sessions || []).map((session) => String(session.passName || "").trim())
  ].filter(Boolean))].sort((a, b) => {
    if (a === currentPassName) return -1;
    if (b === currentPassName) return 1;
    return a.localeCompare(b);
  });
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

function getEditIssuePassLabel(passKey = "developmental") {
  return EDIT2_PASS_CONFIG[passKey]?.label || EDIT2_PASS_CONFIG.developmental.label;
}

function getEditIssueDefaultPriority(passKey = "developmental") {
  return EDIT2_PASS_CONFIG[passKey]?.defaultPriority || "Medium";
}

function getCurrentEdit2ChapterLabel(bundle) {
  if (activeView !== "edit" || !edit2SelectedChapterKey) return "";
  return buildEdit2Chapters(bundle).chapters.find((chapter) => chapter.key === edit2SelectedChapterKey)?.label || "";
}

function getEditStageRoadmap(passStage, passStatus) {
  const stages = [
    {
      name: "Developmental",
      cue: "Big picture",
      description: "Story, structure, and major revision choices."
    },
    {
      name: "Line Edit",
      cue: "Sentence craft",
      description: "Voice, clarity, rhythm, and prose texture."
    },
    {
      name: "Copyedit",
      cue: "Mechanics",
      description: "Consistency, grammar, and technical cleanup."
    },
    {
      name: "Proofread",
      cue: "Final polish",
      description: "Last-pass typo checks before calling it done."
    }
  ];
  const activeStage = stages.find((stage) => stage.name === passStage)?.name || stages[0].name;
  const activeIndex = stages.findIndex((stage) => stage.name === activeStage);
  const isComplete = String(passStatus || "").toLowerCase() === "complete";

  return stages.map((stage, index) => ({
    ...stage,
    state:
      index < activeIndex
        ? "complete"
        : index === activeIndex
          ? (isComplete ? "current-complete" : "current")
          : "upcoming"
  }));
}

function renderEditDashboard(bundle) {
  bindEditDashboardEvents(bundle);
}


function bindEditDashboardEvents(bundle) {
  const passModal = document.getElementById("edit-pass-modal");
  const editSessionStartModal = document.getElementById("edit-session-start-modal");
  const editSessionModal = document.getElementById("edit-session-modal");
  const issueModal = document.getElementById("issue-modal");
  const passForm = document.getElementById("edit-pass-form");
  const editSessionForm = document.getElementById("edit-session-form");
  const issueForm = document.getElementById("issue-form");
  const issueFilterForm = document.getElementById("edit-issue-filters-form");
  const issueViewButtons = document.querySelectorAll("[data-edit-issue-view]");
  const openPassButton = document.getElementById("open-edit-pass-btn");
  const openEditSessionButton = document.getElementById("open-edit-session-modal-btn");
  const closeEditSessionStartButton = document.getElementById("close-edit-session-start-btn");
  const startEditSessionButton = document.getElementById("start-edit-session-btn");
  const endEditSessionButton = document.getElementById("end-edit-session-btn");
  const leaveEditFocusModeButton = document.getElementById("leave-edit-focus-mode-btn");
  const cancelEndEditSessionButton = document.getElementById("cancel-end-edit-session-btn");
  const confirmEndEditSessionButton = document.getElementById("confirm-end-edit-session-btn");
  const openIssueButton = document.getElementById("open-issue-modal-btn");
  const resetIssueFiltersButton = document.getElementById("reset-edit-issue-filters-btn");
  const viewAllSessionsButton = document.getElementById("view-all-edit-sessions-btn");
  const closePassButton = document.getElementById("close-edit-pass-btn");
  const closeEditSessionButton = document.getElementById("close-edit-session-btn");
  const closeIssueButton = document.getElementById("close-issue-modal-btn");

  function openEditPassFlow() {
    const unresolvedCount = getCurrentPassUnresolvedIssueCount(currentBundle());
    if (unresolvedCount > 0) {
      showToast(
        "Resolve this pass first",
        `${formatNumber(unresolvedCount)} unresolved issue${unresolvedCount === 1 ? "" : "s"} still belong to the current pass. Clear them before changing passes.`
      );
      return;
    }
    openEditPassModal();
  }

  function openEditSessionFlow() {
    if (getActiveFocusSession()) {
      showToast("Session already running", "Return to focus mode from the timer chip or end the current session before starting another.");
      return;
    }
    openEditSessionStartModal();
  }

  if (openPassButton) {
    openPassButton.onclick = openEditPassFlow;
  }

  if (openEditSessionButton) {
    openEditSessionButton.onclick = openEditSessionFlow;
  }

  if (startEditSessionButton) {
    startEditSessionButton.onclick = () => {
      startEditingSession();
    };
  }

  if (endEditSessionButton) {
    endEditSessionButton.onclick = () => {
      openEndEditSessionConfirmModal();
    };
  }

  if (leaveEditFocusModeButton) {
    leaveEditFocusModeButton.onclick = () => {
      leaveEditingFocusMode();
    };
  }

  if (cancelEndEditSessionButton) {
    cancelEndEditSessionButton.onclick = () => {
      closeEndEditSessionConfirmModal();
    };
  }

  if (confirmEndEditSessionButton) {
    confirmEndEditSessionButton.onclick = () => {
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
        passScope: String(issueFilterForm.elements.passScope?.value || "current"),
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

  if (closePassButton) {
    closePassButton.onclick = () => {
      closeEditPassModal();
    };
  }

  if (closeEditSessionButton) {
    closeEditSessionButton.onclick = () => {
      closeEditSessionModal();
    };
  }

  if (closeEditSessionStartButton) {
    closeEditSessionStartButton.onclick = () => {
      closeEditSessionStartModal();
    };
  }

  if (closeIssueButton) {
    closeIssueButton.onclick = () => {
      closeIssueModal();
    };
  }

  if (passModal) {
    passModal.onclick = (event) => {
      if (event.target === passModal) closeEditPassModal();
    };
  }

  if (editSessionModal) {
    editSessionModal.onclick = (event) => {
      if (event.target === editSessionModal) closeEditSessionModal();
    };
  }

  if (editSessionStartModal) {
    editSessionStartModal.onclick = (event) => {
      if (event.target === editSessionStartModal) closeEditSessionStartModal();
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

  if (passForm) {
    passForm.onsubmit = (event) => {
      event.preventDefault();
      const formData = new FormData(passForm);
      const passStage = String(formData.get("passStage") || "Developmental");
      const passName = String(formData.get("passName") || "").trim() || defaultPassName(passStage);
      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        editing: {
          ...projectBundle.editing,
          passStage,
          passStatus: String(formData.get("passStatus") || "Not started"),
          passName,
          passObjective: String(formData.get("passObjective") || "").trim(),
          progressCurrent: number(formData.get("progressCurrent")),
          progressTotal: number(formData.get("progressTotal"))
        }
      }));
      closeEditPassModal();
      persistAndRender();
      showToast("Pass updated", `${passName} is now the active editing pass.`);
    };
  }

  if (editSessionForm) {
    editSessionForm.onsubmit = (event) => {
      event.preventDefault();
      const formData = new FormData(editSessionForm);
      const isEditingExisting = Boolean(editingEditSessionId);
      const session = normalizeSession({
        id: editingEditSessionId || createId(),
        type: "edit",
        date: new Date(`${formData.get("sessionDate")}T12:00:00`).toISOString(),
        durationMinutes: Math.max(1, number(formData.get("durationMinutes"))),
        wordsEdited: Math.max(0, number(formData.get("wordsEdited"))),
        notes: String(formData.get("sessionNotes") || "").trim(),
        passName: bundle.editing.passName || defaultPassName(bundle.editing.passStage),
        sectionLabel: String(formData.get("sectionLabel") || "").trim()
      });

      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        sessions: isEditingExisting
          ? projectBundle.sessions.map((item) => item.id === editingEditSessionId ? session : item)
          : [session, ...projectBundle.sessions]
      }));

      closeEditSessionModal();
      persistAndRender();
      showToast(isEditingExisting ? "Editing session updated" : "Editing session logged", "Your revision work is now part of the dashboard.");
    };
  }

  if (issueForm) {
    issueForm.onchange = (event) => {
      const target = event.target;
      if (!target?.name) return;

      if (target.name === "priority") {
        issueForm.dataset.priorityTouched = "true";
        return;
      }

      if (target.name === "issuePassKey") {
        const nextPassKey = normalizeEdit2PassKey(issueForm.elements.issuePassKey?.value || "developmental");
        const previousPassKey = issueForm.dataset.lastPassKey || nextPassKey;
        const previousDefaultPriority = getEditIssueDefaultPriority(previousPassKey);
        const priorityField = issueForm.elements.priority;
        const currentPriority = String(priorityField?.value || "");
        const shouldSyncPriority = issueForm.dataset.mode === "create"
          && priorityField
          && (issueForm.dataset.priorityTouched !== "true" || currentPriority === previousDefaultPriority);

        if (shouldSyncPriority) {
          priorityField.value = getEditIssueDefaultPriority(nextPassKey);
        }
        issueForm.dataset.lastPassKey = nextPassKey;
      }
    };

    issueForm.onsubmit = (event) => {
      event.preventDefault();
      const formData = new FormData(issueForm);
      const isEditingExisting = Boolean(editingIssueId);
      const existingIssue = isEditingExisting
        ? bundle.issues.find((item) => item.id === editingIssueId)
        : null;
      const issuePassKey = normalizeEdit2PassKey(
        formData.get("issuePassKey"),
        existingIssue?.passName || bundle.editing.passStage
      );
      const nextWorkflowStatusRaw = String(
        formData.get("issueStatus")
        || (existingIssue?.status === "Resolved"
          ? "resolved"
          : existingIssue?.workflowStatus || "open")
      );
      const nextWorkflowStatus = nextWorkflowStatusRaw === "resolved"
        ? "resolved"
        : nextWorkflowStatusRaw === "in_progress"
          ? "in_progress"
          : "open";
      const nextStatus = nextWorkflowStatus === "resolved" ? "Resolved" : "Open";
      const issue = normalizeIssue({
        id: editingIssueId || createId(),
        title: String(formData.get("title") || "").trim(),
        type: String(formData.get("type") || "General"),
        sectionLabel: String(formData.get("sectionLabel") || "").trim(),
        priority: String(formData.get("priority") || existingIssue?.priority || getEditIssueDefaultPriority(issuePassKey)),
        status: nextStatus,
        notes: String(formData.get("notes") || "").trim(),
        createdAt: isEditingExisting
          ? existingIssue?.createdAt || new Date().toISOString()
          : new Date().toISOString(),
        resolvedAt: nextStatus === "Resolved"
          ? existingIssue?.resolvedAt || new Date().toISOString()
          : "",
        passName: getEditIssuePassLabel(issuePassKey),
        workflowStatus: nextWorkflowStatus,
        textLocation: String(formData.get("textLocation") || "").trim()
      });

      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        issues: isEditingExisting
          ? projectBundle.issues.map((item) => item.id === editingIssueId ? issue : item)
          : [issue, ...projectBundle.issues]
      }));

      editIssueBoardView = issue.status === "Resolved" ? "resolved" : "current";
      closeIssueModal();
      persistAndRender();
      showToast(isEditingExisting ? "Issue updated" : "Issue added", "That editing problem has been filed away for the current pass.");
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
      if (action === "start-session") {
        openEditSessionFlow();
        return;
      }
      if (action === "filter-section") {
        editIssueBoardView = "current";
        editIssueFilters = {
          ...editIssueFilters,
          passScope: "current",
          section: String(button.dataset.section || "all")
        };
        render();
        return;
      }
      if (action === "change-pass") {
        openEditPassFlow();
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

function openEditPassModal() {
  const modal = document.getElementById("edit-pass-modal");
  const form = document.getElementById("edit-pass-form");
  const editing = currentBundle()?.editing || createDefaultEditingState();
  form.elements.passStage.value = editing.passStage || "Developmental";
  form.elements.passStatus.value = editing.passStatus || "Not started";
  form.elements.passName.value = editing.passName || defaultPassName(editing.passStage);
  form.elements.passObjective.value = editing.passObjective || "";
  form.elements.progressCurrent.value = String(number(editing.progressCurrent));
  form.elements.progressTotal.value = String(number(editing.progressTotal));
  modal.classList.remove("hidden");
}

function closeEditPassModal() {
  const modal = document.getElementById("edit-pass-modal");
  modal.classList.add("hidden");
}

function openEditSessionModal(sessionId = null) {
  const modal = document.getElementById("edit-session-modal");
  const form = document.getElementById("edit-session-form");
  const bundle = currentBundle();
  const passCopy = document.getElementById("edit-session-pass-copy");
  const title = document.getElementById("edit-session-title");
  const copy = document.getElementById("edit-session-copy");
  const submit = document.getElementById("edit-session-submit-btn");
  const existingSession = sessionId ? bundle?.sessions.find((item) => item.id === sessionId) : null;

  editingEditSessionId = sessionId;
  form.reset();
  passCopy.textContent = `Active pass: ${bundle?.editing?.passName || defaultPassName(bundle?.editing?.passStage)}`;

  if (existingSession) {
    title.textContent = "Edit Editing Session";
    copy.textContent = "Update the revision log for this session.";
    form.elements.sessionDate.value = toInputDate(existingSession.date);
    form.elements.durationMinutes.value = String(Math.max(1, number(existingSession.durationMinutes)));
    form.elements.sectionLabel.value = existingSession.sectionLabel || "";
    form.elements.wordsEdited.value = String(number(existingSession.wordsEdited));
    form.elements.sessionNotes.value = existingSession.notes || "";
    submit.textContent = "Save changes";
  } else {
    title.textContent = "Editing Session Complete";
    copy.textContent = pendingCompletedEditSession
      ? `You edited for ${describeMinutes(pendingCompletedEditSession.durationMinutes)}. Add what you worked on before you move on.`
      : "Capture what you worked on, how much you edited, and anything you want to remember.";
    form.elements.sessionDate.value = toInputDate(pendingCompletedEditSession?.endedAt || new Date().toISOString());
    form.elements.durationMinutes.value = String(Math.max(1, number(pendingCompletedEditSession?.durationMinutes || editSessionDraftMinutes)));
    form.elements.sectionLabel.value = "";
    form.elements.wordsEdited.value = "0";
    form.elements.sessionNotes.value = "";
    submit.textContent = "Save editing session";
  }

  modal.classList.remove("hidden");
}

function closeEditSessionModal() {
  const modal = document.getElementById("edit-session-modal");
  const form = document.getElementById("edit-session-form");
  form.reset();
  editingEditSessionId = null;
  pendingCompletedEditSession = null;
  modal.classList.add("hidden");
}

function openEditSessionStartModal() {
  const modal = document.getElementById("edit-session-start-modal");
  const title = document.getElementById("edit-session-start-title");
  const copy = document.getElementById("edit-session-start-copy");
  title.textContent = "Start Editing Session";
  copy.textContent = "Choose how long you want to edit, then begin.";
  syncEditSessionDial(editSessionDraftMinutes);
  modal.classList.remove("hidden");
}

function closeEditSessionStartModal() {
  const modal = document.getElementById("edit-session-start-modal");
  modal.classList.add("hidden");
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
  const dialWrap = document.querySelector("#edit-session-start-modal .session-dial-wrap");
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
  activeEditingSession = {
    startedAt: Date.now(),
    plannedMinutes: editSessionDraftMinutes,
    endsAt: Date.now() + (editSessionDraftMinutes * 60000)
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
  const passCopy = document.getElementById("issue-pass-copy");
  const sectionSelect = document.getElementById("issue-section-select");
  const title = document.getElementById("issue-modal-title");
  const copy = document.getElementById("issue-modal-copy");
  const submit = document.getElementById("issue-submit-btn");
  const bundle = currentBundle();
  const currentPassName = bundle?.editing?.passName || defaultPassName(bundle?.editing?.passStage);
  const currentChapterLabel = getCurrentEdit2ChapterLabel(bundle);
  const issue = issueId ? bundle?.issues.find((item) => item.id === issueId) : null;
  const sectionLabels = getEditIssueSectionOptions(bundle);

  editingIssueId = issueId;
  form.reset();
  form.dataset.mode = issue ? "edit" : "create";
  form.dataset.priorityTouched = "false";

  if (!issue && !sectionLabels.length) {
    showToast("Create a chapter first", "Add a chapter to the manuscript structure before logging an issue.");
    openEdit2ChapterModal?.();
    return;
  }

  passCopy.textContent = currentChapterLabel
    ? `This issue will start in ${currentChapterLabel}. Choose the pass it belongs to, then keep the note lightweight enough to capture while reading.`
    : `Choose the pass this issue belongs to and place it inside one of your existing chapters so the manuscript map can surface it correctly.`;
  if (sectionSelect) {
    sectionSelect.innerHTML = sectionLabels
      .map((sectionLabel) => `<option value="${escapeAttr(sectionLabel)}">${escapeHtml(sectionLabel)}</option>`)
      .join("");
  }

  if (issue) {
    const issuePassKey = normalizeEdit2PassKey(issue.passName, bundle?.editing?.passStage);
    title.textContent = "Edit Issue";
    copy.textContent = "Update the issue so it stays easy to place in the right chapter and pass.";
    form.elements.title.value = issue.title || "";
    form.elements.issuePassKey.value = issuePassKey;
    form.elements.type.value = issue.type || "General";
    form.elements.sectionLabel.value = issue.sectionLabel || "";
    form.elements.priority.value = issue.priority || getEditIssueDefaultPriority(issuePassKey);
    form.elements.issueStatus.value = issue.status === "Resolved"
      ? "resolved"
      : issue.workflowStatus === "in_progress"
        ? "in_progress"
        : "open";
    form.elements.textLocation.value = issue.textLocation || "";
    form.elements.notes.value = issue.notes || "";
    form.dataset.lastPassKey = issuePassKey;
    submit.textContent = "Save changes";
  } else {
    const issuePassKey = normalizeEdit2PassKey(currentPassName, bundle?.editing?.passStage);
    title.textContent = "Add Open Issue";
    copy.textContent = "Capture a problem now, assign it to the right pass, and drop it into the right chapter before you move on.";
    form.elements.issuePassKey.value = issuePassKey;
    form.elements.type.value = "Pacing";
    form.elements.sectionLabel.value = sectionLabels.includes(currentChapterLabel) ? currentChapterLabel : (sectionLabels[0] || "");
    form.elements.priority.value = getEditIssueDefaultPriority(issuePassKey);
    form.elements.issueStatus.value = "open";
    form.elements.textLocation.value = "";
    form.dataset.lastPassKey = issuePassKey;
    submit.textContent = "Save issue";
  }

  modal.classList.remove("hidden");
}

function closeIssueModal() {
  const modal = document.getElementById("issue-modal");
  const form = document.getElementById("issue-form");
  form.reset();
  delete form.dataset.mode;
  delete form.dataset.priorityTouched;
  delete form.dataset.lastPassKey;
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
          <p class="small-copy">${issue.passName ? escapeHtml(issue.passName) : "No pass assigned"}</p>
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
      ${issue.notes ? `<p class="issue-note">${escapeHtml(issue.notes)}</p>` : ""}
    </div>
  `;
}
