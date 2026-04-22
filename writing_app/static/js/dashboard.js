function renderDashboard(bundle) {
  if (!bundle) {
    document.getElementById("view-dashboard").innerHTML = renderWorkspaceEmptyState("Write");
    bindWorkspaceEmptyActions();
    return;
  }
  if (isProjectPublished(bundle)) {
    document.getElementById("view-dashboard").innerHTML = `
      <section class="grid dashboard-grid">
        <div class="stack">
          ${renderPublishedProjectDashboard(bundle)}
        </div>
      </section>
    `;
    bindDashboardEvents(bundle);
    return;
  }
  const stats = getStats(bundle);
  const completion = bundle.completion || createDefaultCompletionState();
  const isManuscriptComplete = Boolean(completion.isManuscriptComplete);
  const deadlineLabel = bundle.project.deadline ? formatDate(bundle.project.deadline) : "Flexible timeline";
  const completionLabel = stats.estimatedCompletionDate ? formatDate(stats.estimatedCompletionDate) : "Build pace to predict";
  const momentumState = stats.momentum === "Increasing"
    ? { icon: "↑", label: "Accelerating", className: "up", detail: `Projected finish ${completionLabel}` }
    : stats.momentum === "Slowing"
      ? { icon: "↓", label: "Declining", className: "down", detail: `Pace is slipping. Finish forecast ${completionLabel}` }
      : { icon: "→", label: "Steady", className: "flat", detail: `Projected finish ${completionLabel}` };
  const targetWordCount = Math.max(1, number(bundle.project.targetWordCount));
  const currentWordCount = number(bundle.project.currentWordCount);
  const completionCheckpoints = getProjectCompletionCheckpoints(targetWordCount);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySessions = [...getWriteSessions(bundle)]
    .filter((session) => dateKey(session.date) === todayKey)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  document.getElementById("view-dashboard").innerHTML = `
    <section class="grid dashboard-grid">
      <div class="stack">
        ${isManuscriptComplete
          ? renderCompletedManuscriptDashboard(bundle, stats)
          : renderActiveManuscriptDashboard(
            bundle,
            stats,
            todaySessions,
            momentumState,
            deadlineLabel,
            completionCheckpoints,
            currentWordCount,
            targetWordCount
          )}
      </div>
    </section>
  `;

  bindDashboardEvents(bundle);
}

function renderActiveManuscriptDashboard(bundle, stats, todaySessions, momentumState, deadlineLabel, completionCheckpoints, currentWordCount, targetWordCount) {
  return `
    <section class="card">
      <div class="writing-launch">
        <div class="writing-launch-copy">
          <div>
            <h3>Get writing</h3>
            <p>Start a focused session, let the timer run, then record your words when you finish.</p>
          </div>
          <div class="writing-launch-meta">
            <span class="pill">${formatNumber(todaySessions.length)} session${todaySessions.length === 1 ? "" : "s"} today</span>
            <span class="pill">${formatNumber(stats.wordsToday)} words written today</span>
          </div>
        </div>
        <button class="primary-btn writing-launch-cta" id="open-session-modal-btn" type="button">Start writing session</button>
      </div>
    </section>

    <section class="card hero">
      <div class="hero-panel">
        <div class="section-head" style="margin-bottom: 10px;">
          <div>
            <p class="small-copy">Current manuscript</p>
            <h2 class="hero-title">${escapeHtml(bundle.project.bookTitle || "Untitled Manuscript")}</h2>
          </div>
          <button class="ghost-btn manuscript-complete-btn" id="open-manuscript-complete-modal-btn" type="button">Manuscript complete</button>
        </div>
        <div class="hero-meta">
          <span class="pill">Target ${formatNumber(bundle.project.targetWordCount)} words</span>
          <span class="pill">${deadlineLabel}</span>
          <span class="pill">Reversible</span>
          <span class="pill">Confirmation required</span>
        </div>

        <div class="progress-block">
          <div class="progress-label-row">
            <span
              class="progress-info-icon"
              aria-label="manuscript word count"
              data-tooltip="manuscript word count"
              tabindex="0"
            >?</span>
            <span>${stats.totalProgress.toFixed(1)}%</span>
          </div>
          <div class="progress-rail progress-rail-checkpoints" aria-label="Book completion progress">
            <div class="progress-fill" style="width: ${stats.totalProgress}%"></div>
            ${completionCheckpoints.map((checkpoint, index) => `
              <span
                class="progress-checkpoint ${currentWordCount >= checkpoint ? "reached" : ""} ${index === 0 ? "edge-start" : ""} ${index === completionCheckpoints.length - 1 ? "edge-end" : ""}"
                style="left: ${((checkpoint / targetWordCount) * 100).toFixed(3)}%;"
                title="${formatNumber(checkpoint)} words"
                aria-hidden="true"
              >
                <span class="progress-checkpoint-label">${formatCompactCheckpoint(checkpoint)}</span>
              </span>
            `).join("")}
          </div>
        </div>

        <div class="signal-band">
          <div class="signal-card">
            <div class="signal-icon">${momentumState.icon}</div>
            <div class="signal-copy">
              <strong>Momentum</strong>
              <div class="momentum-status ${momentumState.className}">${momentumState.label}</div>
              <p>${momentumState.detail}</p>
            </div>
          </div>
          <div class="signal-card">
            <div class="signal-icon">🔥</div>
            <div class="signal-copy">
              <strong>Streak</strong>
              <span>${formatNumber(stats.currentStreak)} days</span>
              <p>Longest streak ${formatNumber(stats.longestStreak)} days</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="section-head">
        <div>
          <h3>History</h3>
          <p>All writing sessions logged today.</p>
        </div>
        <button class="ghost-btn" id="view-all-sessions-btn" type="button">Open history</button>
      </div>
      <div class="list">
        ${todaySessions.length ? todaySessions.map((session) => renderSessionCard(bundle, session)).join("") : `<div class="empty">No sessions logged today.</div>`}
      </div>
    </section>
  `;
}

function renderCompletedManuscriptDashboard(bundle, stats) {
  const completion = bundle.completion || createDefaultCompletionState();
  const completedAt = completion.completedAt || new Date().toISOString();
  const writingSessions = [...getWriteSessions(bundle)].sort((a, b) => new Date(b.date) - new Date(a.date));
  const finalWordCount = Math.max(number(bundle.project.currentWordCount), number(completion.completionWordCount));
  const targetWordCount = Math.max(1, number(bundle.project.targetWordCount));
  const firstWritingDate = writingSessions.length
    ? [...writingSessions].sort((a, b) => new Date(a.date) - new Date(b.date))[0].date
    : (bundle.project.projectStartDate || completedAt);
  const draftDays = Math.max(1, daysBetween(firstWritingDate, completedAt) + 1);
  const completionDifference = finalWordCount - targetWordCount;
  const completionStatus = completionDifference >= 0
    ? `Finished ${formatNumber(completionDifference)} words over the original target.`
    : `Finished ${formatNumber(Math.abs(completionDifference))} words under the original target.`;
  const recentSessions = writingSessions.slice(0, 5);
  const bestDayLabel = stats.bestDay.key
    ? `${formatNumber(stats.bestDay.words)} words on ${formatDate(stats.bestDay.key)}`
    : "No writing day has been logged yet.";

  return `
    <section class="card manuscript-complete-hero">
      <div class="section-head">
        <div>
          <p class="small-copy">Completed manuscript</p>
          <h2 class="hero-title">${escapeHtml(bundle.project.bookTitle || "Untitled Manuscript")}</h2>
          <p class="muted">Marked complete on ${formatDate(completedAt)}. The Write workspace is now showing the manuscript's final drafting snapshot until you choose to reopen it.</p>
        </div>
        <div class="manuscript-complete-actions">
          <span class="pill">Final word count ${formatNumber(finalWordCount)}</span>
          <button class="ghost-btn" id="reopen-manuscript-btn" type="button">Reopen manuscript</button>
        </div>
      </div>
      <div class="manuscript-complete-banner">
        <div>
          <strong>Draft finished</strong>
          <p>${completionStatus}</p>
        </div>
        <div class="manuscript-complete-banner-meta">
          <span class="pill">${formatNumber(writingSessions.length)} writing sessions</span>
          <span class="pill">${formatHours(stats.totalDuration)} tracked drafting time</span>
        </div>
      </div>
    </section>

    <section class="card manuscript-complete-summary">
      <div class="section-head">
        <div>
          <h3>Final Stats</h3>
          <p>The Write workspace has been condensed into the clearest completion snapshot we have right now.</p>
        </div>
      </div>
      <div class="metrics">
        <div class="metric"><div class="label">Final word count</div><div class="value">${formatNumber(finalWordCount)}</div></div>
        <div class="metric"><div class="label">Draft span</div><div class="value">${formatNumber(draftDays)} days</div></div>
        <div class="metric"><div class="label">Average session</div><div class="value">${formatNumber(stats.avgSession)} words</div></div>
        <div class="metric"><div class="label">Longest streak</div><div class="value">${formatNumber(stats.longestStreak)} days</div></div>
      </div>
    </section>

    <section class="card manuscript-complete-highlights">
      <div class="section-head">
        <div>
          <h3>Writing Highlights</h3>
          <p>The details that feel most useful at the end of a manuscript are collected here without the drafting controls getting in the way.</p>
        </div>
      </div>
      <div class="manuscript-complete-highlight-grid">
        <article class="manuscript-complete-highlight">
          <p class="small-copy">Best day</p>
          <strong>${escapeHtml(bestDayLabel)}</strong>
        </article>
        <article class="manuscript-complete-highlight">
          <p class="small-copy">Daily average</p>
          <strong>${formatNumber(stats.dailyAverage)} words per day</strong>
        </article>
        <article class="manuscript-complete-highlight">
          <p class="small-copy">Most productive weekday</p>
          <strong>${escapeHtml(getWeekdayName(stats.mostProductiveDayIndex))}</strong>
        </article>
        <article class="manuscript-complete-highlight">
          <p class="small-copy">Total written</p>
          <strong>${formatNumber(stats.totalWritten)} words logged</strong>
        </article>
      </div>
    </section>

    <section class="card">
      <div class="section-head">
        <div>
          <h3>Writing Log</h3>
          <p>Your recent sessions stay visible here in case you want a quick look back at the finish.</p>
        </div>
        <button class="ghost-btn" id="view-all-sessions-btn" type="button">Open history</button>
      </div>
      <div class="list">
        ${recentSessions.length ? recentSessions.map((session) => renderSessionCard(bundle, session)).join("") : `<div class="empty">No writing sessions logged yet.</div>`}
      </div>
    </section>
  `;
}

function getPublishedProjectSnapshot(bundle, stats = getStats(bundle), editStats = getEditStats(bundle)) {
  const completion = bundle.completion || createDefaultCompletionState();
  const publication = bundle.publication || createDefaultPublicationState();
  const writingSessions = [...getWriteSessions(bundle)].sort((a, b) => new Date(b.date) - new Date(a.date));
  const editingSessions = [...getEditSessions(bundle)].sort((a, b) => new Date(b.date) - new Date(a.date));
  const targetWordCount = Math.max(1, number(bundle.project.targetWordCount));
  const finalWordCount = Math.max(
    number(bundle.project.currentWordCount),
    number(completion.completionWordCount),
    number(publication.publishedWordCount)
  );
  const projectStartDate = bundle.project.projectStartDate
    || writingSessions.at(-1)?.date
    || completion.completedAt
    || publication.publishedAt
    || new Date().toISOString();
  const completionDate = completion.completedAt || publication.publishedAt || new Date().toISOString();
  const publishedAt = publication.publishedAt || new Date().toISOString();
  const draftSpanDays = Math.max(1, daysBetween(projectStartDate, publishedAt) + 1);
  const completionDifference = finalWordCount - targetWordCount;
  const targetSummary = completionDifference > 0
    ? `${formatNumber(completionDifference)} words over the original target`
    : completionDifference < 0
      ? `${formatNumber(Math.abs(completionDifference))} words under the original target`
      : "Exactly on the original target";
  const progressCurrent = number(bundle.editing.progressCurrent);
  const progressTotal = number(bundle.editing.progressTotal);
  const unitLower = getStructureUnitLower(bundle);
  const unitPlural = getStructureUnitPlural(bundle);
  const unitPluralLower = unitPlural.toLowerCase();
  const bestDayLabel = stats.bestDay.key
    ? `${formatNumber(stats.bestDay.words)} words on ${formatDate(stats.bestDay.key)}`
    : "No writing day was logged.";
  const outstandingIssueCount = getOutstandingIssueCount(bundle);

  return {
    completion,
    publication,
    writingSessions,
    editingSessions,
    targetWordCount,
    finalWordCount,
    projectStartDate,
    completionDate,
    publishedAt,
    draftSpanDays,
    completionDifference,
    targetSummary,
    progressCurrent,
    progressTotal,
    bestDayLabel,
    outstandingIssueCount,
    issueSummary: `${formatNumber(editStats.resolvedIssueCount)} resolved / ${formatNumber(outstandingIssueCount)} open`,
    currentPassLabel: bundle.editing.passName || defaultPassName(bundle.editing.passStage),
    structureUnitPlural: unitPlural,
    sectionsSummary: progressTotal > 0
      ? `${formatNumber(progressCurrent)} of ${formatNumber(progressTotal)} ${unitPluralLower} logged in the final pass`
      : `No ${unitLower} target was logged in the editing pass`,
    finalProgressPercent: targetWordCount > 0 ? Math.min(999, (finalWordCount / targetWordCount) * 100) : 0
  };
}

function renderPublishedProjectDashboard(bundle) {
  const stats = getStats(bundle);
  const editStats = getEditStats(bundle);
  const summary = getPublishedProjectSnapshot(bundle, stats, editStats);
  const title = bundle.project.bookTitle || "Untitled Manuscript";
  const writingNarrative = `You wrote ${formatNumber(stats.totalWritten)} words across ${formatNumber(summary.writingSessions.length)} writing session${summary.writingSessions.length === 1 ? "" : "s"} over ${formatNumber(summary.draftSpanDays)} days.`;
  const editingNarrative = `You tracked ${formatHours(editStats.totalMinutes)} of revision time, logged ${formatNumber(summary.editingSessions.length)} editing session${summary.editingSessions.length === 1 ? "" : "s"}, and closed ${formatNumber(editStats.resolvedIssueCount)} issue${editStats.resolvedIssueCount === 1 ? "" : "s"} before publishing.`;

  return `
    <section class="card published-hero">
      <div class="section-head">
        <div>
          <p class="published-kicker">Published project</p>
          <h2 class="hero-title">${escapeHtml(title)}</h2>
          <p class="muted">Published on ${formatDate(summary.publishedAt)}. This project now opens to a locked, scrollable final-stats view until you choose to re-open it.</p>
        </div>
        <div class="published-actions">
          <span class="pill">Published</span>
          <span class="pill">${escapeHtml(summary.targetSummary)}</span>
          <span class="pill">${formatNumber(editStats.resolvedIssueCount)} resolved issues</span>
          <button class="ghost-btn" id="open-reopen-project-modal-btn" type="button">Re-open project</button>
          <button class="primary-btn" id="download-published-report-btn" type="button">Download final stats PDF</button>
        </div>
      </div>
      <div class="published-highlight-grid">
        <article class="published-highlight">
          <p class="small-copy">Final word count</p>
          <strong>${formatNumber(summary.finalWordCount)}</strong>
          <span>${summary.finalProgressPercent.toFixed(1)}% of the original target</span>
        </article>
        <article class="published-highlight">
          <p class="small-copy">Draft completed</p>
          <strong>${formatDate(summary.completionDate)}</strong>
          <span>${formatNumber(summary.draftSpanDays)} tracked days from project start to publication</span>
        </article>
        <article class="published-highlight">
          <p class="small-copy">Editing closed out</p>
          <strong>${escapeHtml(bundle.editing.passStage)}</strong>
          <span>${escapeHtml(summary.sectionsSummary)}</span>
        </article>
      </div>
    </section>

    <section class="card">
      <div class="section-head">
        <div>
          <h3>Overall Stats</h3>
          <p>The project is locked now, so this page holds the clearest top-line snapshot of the manuscript as published.</p>
        </div>
      </div>
      <div class="metrics published-metrics">
        <div class="metric"><div class="label">Writing sessions</div><div class="value">${formatNumber(summary.writingSessions.length)}</div></div>
        <div class="metric"><div class="label">Editing sessions</div><div class="value">${formatNumber(summary.editingSessions.length)}</div></div>
        <div class="metric"><div class="label">Writing time</div><div class="value">${formatHours(stats.totalDuration)}</div></div>
        <div class="metric"><div class="label">Editing time</div><div class="value">${formatHours(editStats.totalMinutes)}</div></div>
        <div class="metric"><div class="label">Longest streak</div><div class="value">${formatNumber(stats.longestStreak)} days</div></div>
        <div class="metric"><div class="label">Outstanding issues</div><div class="value">${formatNumber(summary.outstandingIssueCount)}</div></div>
      </div>
    </section>

    <section class="published-summary-grid">
      <article class="card published-summary-card">
        <div class="section-head">
          <div>
            <h3>Writing Summary</h3>
            <p>${escapeHtml(writingNarrative)}</p>
          </div>
        </div>
        <div class="published-stat-list">
          <div class="published-stat-row"><strong>Total written</strong><span>${formatNumber(stats.totalWritten)} words</span></div>
          <div class="published-stat-row"><strong>Daily average</strong><span>${formatNumber(stats.dailyAverage)} words/day</span></div>
          <div class="published-stat-row"><strong>Average session</strong><span>${formatNumber(stats.avgSession)} words</span></div>
          <div class="published-stat-row"><strong>Best day</strong><span>${escapeHtml(summary.bestDayLabel)}</span></div>
          <div class="published-stat-row"><strong>Most productive weekday</strong><span>${escapeHtml(getWeekdayName(stats.mostProductiveDayIndex))}</span></div>
        </div>
      </article>

      <article class="card published-summary-card">
        <div class="section-head">
          <div>
            <h3>Editing Summary</h3>
            <p>${escapeHtml(editingNarrative)}</p>
          </div>
        </div>
        <div class="published-stat-list">
          <div class="published-stat-row"><strong>Final pass</strong><span>${escapeHtml(summary.currentPassLabel)}</span></div>
          <div class="published-stat-row"><strong>Stage</strong><span>${escapeHtml(bundle.editing.passStage)} (${escapeHtml(bundle.editing.passStatus)})</span></div>
          <div class="published-stat-row"><strong>${escapeHtml(summary.structureUnitPlural)} logged</strong><span>${escapeHtml(summary.sectionsSummary)}</span></div>
          <div class="published-stat-row"><strong>Words edited</strong><span>${formatNumber(editStats.totalWordsEdited)} words</span></div>
          <div class="published-stat-row"><strong>Issue board</strong><span>${escapeHtml(summary.issueSummary)}</span></div>
        </div>
      </article>

      <article class="card published-summary-card">
        <div class="section-head">
          <div>
            <h3>Timeline</h3>
            <p>The big milestone dates that mark how the manuscript moved from draft to published archive.</p>
          </div>
        </div>
        <div class="published-stat-list">
          <div class="published-stat-row"><strong>Project start</strong><span>${formatDate(summary.projectStartDate)}</span></div>
          <div class="published-stat-row"><strong>Manuscript completed</strong><span>${formatDate(summary.completionDate)}</span></div>
          <div class="published-stat-row"><strong>Project published</strong><span>${formatDate(summary.publishedAt)}</span></div>
          <div class="published-stat-row"><strong>Target result</strong><span>${escapeHtml(summary.targetSummary)}</span></div>
          <div class="published-stat-row"><strong>Final word count captured</strong><span>${formatNumber(summary.finalWordCount)} words</span></div>
        </div>
      </article>
    </section>
  `;
}

function getWeekdayName(index) {
  const safeIndex = Number.isInteger(index) && index >= 0 && index <= 6 ? index : 0;
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][safeIndex];
}

function getProjectCompletionCheckpoints(targetWordCount) {
  const target = Math.max(1, number(targetWordCount));
  const desiredSegments = target <= 30000 ? 4 : target <= 90000 ? 5 : 6;
  const candidateSteps = [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
  const fallbackStep = Math.max(500, Math.round(target / desiredSegments));
  const step = candidateSteps.reduce((best, candidate) => {
    const candidateSegments = target / candidate;
    const bestSegments = target / best;
    const candidateScore = Math.abs(candidateSegments - desiredSegments);
    const bestScore = Math.abs(bestSegments - desiredSegments);
    return candidateScore < bestScore ? candidate : best;
  }, fallbackStep);
  const checkpoints = [];
  for (let checkpoint = step; checkpoint < target; checkpoint += step) {
    checkpoints.push(checkpoint);
  }
  return checkpoints;
}

function formatCompactCheckpoint(value) {
  const amount = Math.max(0, number(value));
  if (amount >= 1000000) return `${Math.round(amount / 100000) / 10}m`;
  if (amount >= 1000) return `${Math.round(amount / 100) / 10}k`.replace(".0k", "k");
  return String(Math.round(amount));
}

function bindDashboardEvents(bundle) {
  const sessionModal = document.getElementById("session-modal");
  const sessionCompleteModal = document.getElementById("session-complete-modal");
  const endSessionConfirmModal = document.getElementById("end-session-confirm-modal");
  const openSessionButton = document.getElementById("open-session-modal-btn");
  const closeSessionButton = document.getElementById("close-session-modal-btn");
  const closeSessionCompleteButton = document.getElementById("close-session-complete-btn");
  const startSessionButton = document.getElementById("start-session-btn");
  const endSessionButton = document.getElementById("end-session-btn");
  const leaveFocusModeButton = document.getElementById("leave-writing-focus-mode-btn");
  const cancelEndSessionButton = document.getElementById("cancel-end-session-btn");
  const confirmEndSessionButton = document.getElementById("confirm-end-session-btn");
  const manuscriptCompleteModal = document.getElementById("manuscript-complete-modal");
  const openManuscriptCompleteButton = document.getElementById("open-manuscript-complete-modal-btn");
  const closeManuscriptCompleteButton = document.getElementById("close-manuscript-complete-modal-btn");
  const cancelManuscriptCompleteButton = document.getElementById("cancel-manuscript-complete-btn");
  const reopenManuscriptButton = document.getElementById("reopen-manuscript-btn");
  const downloadPublishedReportButton = document.getElementById("download-published-report-btn");
  const prevHeatmapButton = document.getElementById("heatmap-prev-month-btn");
  const nextHeatmapButton = document.getElementById("heatmap-next-month-btn");
  const viewAllSessionsButton = document.getElementById("view-all-sessions-btn");

  if (openSessionButton) {
    openSessionButton.onclick = () => {
      if (getActiveFocusSession()) {
        showToast("Session already running", "Return to focus mode from the timer chip or end the current session before starting another.");
        return;
      }
      openSessionModal();
    };
  }

  if (startSessionButton) {
    startSessionButton.onclick = () => {
      const startCountInput = document.getElementById("session-start-word-count");
      if (!startCountInput) return;
      const startWordCount = number(startCountInput.value);
      if (startCountInput.value === "" || startWordCount < 0) {
        startCountInput.reportValidity();
        return;
      }
      startWritingSession(startWordCount);
    };
  }

  if (endSessionButton) {
    endSessionButton.onclick = () => {
      openEndSessionConfirmModal();
    };
  }

  if (leaveFocusModeButton) {
    leaveFocusModeButton.onclick = () => {
      leaveWritingFocusMode();
    };
  }

  if (cancelEndSessionButton) {
    cancelEndSessionButton.onclick = () => {
      closeEndSessionConfirmModal();
    };
  }

  if (confirmEndSessionButton) {
    confirmEndSessionButton.onclick = () => {
      closeEndSessionConfirmModal();
      finishActiveWritingSession(false);
    };
  }

  if (openManuscriptCompleteButton) {
    openManuscriptCompleteButton.onclick = () => {
      if (getActiveFocusSession()) {
        showToast("Session already running", "Finish or end the active session before marking the manuscript complete.");
        return;
      }
      openManuscriptCompleteModal(bundle);
    };
  }

  if (closeManuscriptCompleteButton) {
    closeManuscriptCompleteButton.onclick = () => {
      closeManuscriptCompleteModal();
    };
  }

  if (cancelManuscriptCompleteButton) {
    cancelManuscriptCompleteButton.onclick = () => {
      closeManuscriptCompleteModal();
    };
  }

  if (reopenManuscriptButton) {
    reopenManuscriptButton.onclick = () => {
      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        completion: createDefaultCompletionState()
      }));
      persistAndRender();
      showToast("Manuscript reopened", "The Write workspace is live again in case you want to add more words.");
    };
  }

  if (downloadPublishedReportButton) {
    downloadPublishedReportButton.onclick = () => {
      downloadPublishedProjectPdf(bundle);
    };
  }

  if (closeSessionButton) {
    closeSessionButton.onclick = () => {
      closeSessionModal();
    };
  }

  if (closeSessionCompleteButton) {
    closeSessionCompleteButton.onclick = () => {
      closeSessionCompleteModal();
    };
  }

  sessionModal.onclick = (event) => {
    if (event.target === sessionModal) {
      closeSessionModal();
    }
  };

  sessionCompleteModal.onclick = (event) => {
    if (event.target === sessionCompleteModal) {
      closeSessionCompleteModal();
    }
  };

  endSessionConfirmModal.onclick = (event) => {
    if (event.target === endSessionConfirmModal) {
      closeEndSessionConfirmModal();
    }
  };

  if (manuscriptCompleteModal) {
    manuscriptCompleteModal.onclick = (event) => {
      if (event.target === manuscriptCompleteModal) {
        closeManuscriptCompleteModal();
      }
    };
  }

  if (viewAllSessionsButton) {
    viewAllSessionsButton.onclick = () => {
      sessionsReturnView = "dashboard";
      activeView = "sessions";
      render();
    };
  }

  document.getElementById("session-complete-form").onsubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const durationMinutes = Math.max(1, number(formData.get("durationMinutes")));
    const sessionDate = formData.get("sessionDate") || toInputDate(new Date().toISOString());
    const sessionNotes = String(formData.get("sessionNotes") || "").trim();

    if (editingSessionId) {
      const wordsWritten = Math.max(0, number(formData.get("sessionWordsWritten")));
      updateCurrentBundle((projectBundle) => {
        const existingSession = projectBundle.sessions.find((item) => item.id === editingSessionId);
        if (!existingSession) return projectBundle;

        const updatedSession = {
          ...existingSession,
          wordsWritten,
          durationMinutes,
          date: new Date(`${sessionDate}T12:00:00`).toISOString(),
          notes: sessionNotes
        };

        return {
          ...projectBundle,
          sessions: projectBundle.sessions.map((item) => item.id === editingSessionId ? updatedSession : item),
          project: {
            ...projectBundle.project,
            currentWordCount: Math.max(
              0,
              number(projectBundle.project.currentWordCount)
                - number(existingSession.wordsWritten)
                + updatedSession.wordsWritten
            )
          }
        };
      });

      showToast("Session updated", "Your edits have been saved and the manuscript total was reconciled.");
    } else {
      if (!pendingCompletedSession) return;
      const endWordCount = number(formData.get("sessionEndWordCount"));
      const startWordCount = number(pendingCompletedSession.startWordCount);
      const wordsWritten = Math.max(0, endWordCount - startWordCount);
      const session = {
        id: createId(),
        wordsWritten,
        wordsEdited: 0,
        notes: sessionNotes,
        durationMinutes,
        date: new Date(`${sessionDate}T12:00:00`).toISOString()
      };

      updateCurrentBundle((projectBundle) => {
        const sessions = [...projectBundle.sessions, session];
        const updatedBundle = {
          ...projectBundle,
          sessions,
          project: {
            ...projectBundle.project,
            currentWordCount: Math.max(
              0,
              number(projectBundle.project.currentWordCount)
                + session.wordsWritten
            )
          }
        };
        const unlockedMilestones = milestoneTargets.filter((target) =>
          number(updatedBundle.project.currentWordCount) >= target && !updatedBundle.milestones.includes(target)
        );
        if (unlockedMilestones.length) {
          showToast("Milestone reached", `You crossed ${formatNumber(unlockedMilestones[0])} words. Keep the momentum going.`);
        } else {
          showToast("Session logged", `${formatNumber(session.wordsWritten)} words calculated and added to the manuscript.`);
        }
        return updatedBundle;
      });
    }

    closeSessionCompleteModal();
    persistAndRender();
  };

  const manuscriptCompleteForm = document.getElementById("manuscript-complete-form");
  if (manuscriptCompleteForm) {
    manuscriptCompleteForm.onsubmit = (event) => {
      event.preventDefault();
      const form = event.target;
      const formData = new FormData(form);
      const confirmationValue = String(formData.get("completionConfirmation") || "").trim().toUpperCase();

      if (confirmationValue !== "COMPLETE") {
        showToast("Type COMPLETE to confirm", "This extra step helps prevent an accidental manuscript completion.");
        form.elements.completionConfirmation?.focus();
        return;
      }

      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        completion: {
          isManuscriptComplete: true,
          completedAt: new Date().toISOString(),
          completionWordCount: number(projectBundle.project.currentWordCount)
        }
      }));

      closeManuscriptCompleteModal();
      persistAndRender();
      launchManuscriptCompleteConfetti();
      showToast("Manuscript marked complete", "The Write workspace is now showing final manuscript stats. Reopen it anytime if more drafting is needed.");
    };
  }

  bindSessionDial();
  bindSessionActions();

}

function renderGoalsDashboard(bundle) {
  const view = document.getElementById("view-goals");
  if (!bundle) {
    view.innerHTML = renderWorkspaceEmptyState("Goals");
    bindWorkspaceEmptyActions();
    return;
  }

  const activeGoals = activeGoalsForBundle(bundle).map((goal) => evaluateGoal(bundle, goal));
  const archivedGoals = archivedGoalsForBundle(bundle);
  const wordGoals = activeGoals.filter((goal) => goal.type === "write_words");
  const minuteGoals = activeGoals.filter((goal) => goal.type === "write_minutes");
  const totalLiveProgress = activeGoals.reduce((sum, goal) => sum + goal.liveValue, 0);

  view.innerHTML = `
    <section class="stack">
      <section class="card">
        <div class="section-head">
          <div>
            <p class="small-copy">Shared project layer</p>
            <h2 class="hero-title">Goals Workspace</h2>
            <p class="muted">Manage active targets, preserve archived context, and inspect day-by-day progress history in one place.</p>
          </div>
          <button class="primary-btn" id="open-goal-modal-btn" type="button">Create goal</button>
        </div>
        <div class="metrics">
          <div class="metric"><div class="label">Active goals</div><div class="value">${formatNumber(activeGoals.length)}</div></div>
          <div class="metric"><div class="label">Archived goals</div><div class="value">${formatNumber(archivedGoals.length)}</div></div>
          <div class="metric"><div class="label">Word-count goals</div><div class="value">${formatNumber(wordGoals.length)}</div></div>
          <div class="metric"><div class="label">Time goals</div><div class="value">${formatNumber(minuteGoals.length)}</div></div>
          <div class="metric"><div class="label">Tracked effort today</div><div class="value">${formatNumber(totalLiveProgress)}</div><div class="hint">Across all active goals</div></div>
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <div>
            <h3>Active Goals</h3>
            <p>These are the targets currently shaping new progress days.</p>
          </div>
        </div>
        <div class="goal-editor-list">
          ${activeGoals.length ? activeGoals.map((goal) => renderGoalCard(goal)).join("") : `<div class="empty">No active goals yet.</div>`}
        </div>
      </section>

      ${archivedGoals.length ? `
        <section class="card">
          <div class="section-head">
            <div>
              <h3>Archived Goals</h3>
              <p>Past goal targets stay here so old heatmap days keep the context they were earned under.</p>
            </div>
          </div>
          <div class="goal-editor-list archived-goal-list">
            ${archivedGoals.map((goal) => renderArchivedGoalCard(goal)).join("")}
          </div>
        </section>
      ` : ""}

      ${renderGoalHeatmap(bundle)}
    </section>
  `;

  bindGoalsDashboardEvents(bundle);
}

function bindGoalsDashboardEvents(bundle) {
  const goalModal = document.getElementById("goal-modal");
  const goalForm = document.getElementById("goal-form");
  const openGoalButton = document.getElementById("open-goal-modal-btn");
  const closeGoalButton = document.getElementById("close-goal-modal-btn");
  const prevHeatmapButton = document.getElementById("heatmap-prev-month-btn");
  const nextHeatmapButton = document.getElementById("heatmap-next-month-btn");

  if (openGoalButton) {
    openGoalButton.onclick = () => {
      openGoalModal();
    };
  }

  if (closeGoalButton) {
    closeGoalButton.onclick = () => {
      closeGoalModal();
    };
  }

  if (goalForm && goalForm.dataset.goalTypeBound !== "true") {
    goalForm.dataset.goalTypeBound = "true";
    goalForm.elements.type?.addEventListener("change", (event) => {
      applyGoalTypePreset(goalForm, event.target.value);
      syncGoalFormState(goalForm);
    });
    goalForm.elements.scheduleMode?.addEventListener("change", () => {
      syncGoalFormState(goalForm);
      applyGoalTypePreset(goalForm, goalForm.elements.type.value);
    });
    goalForm.elements.trackingMode?.addEventListener("change", () => {
      syncGoalFormState(goalForm);
    });
  }

  if (goalModal) {
    goalModal.onclick = (event) => {
      if (event.target === goalModal) {
        closeGoalModal();
      }
    };
  }

  if (goalForm) {
    goalForm.onsubmit = (event) => {
      event.preventDefault();
      const formData = new FormData(event.target);
      const trackingMode = formData.get("trackingMode") === "date_range" ? "date_range" : "ongoing";
      const scheduleMode = formData.get("scheduleMode") === "custom_days" ? "custom_days" : "daily";
      const startDate = String(formData.get("startDate") || toInputDate(new Date().toISOString()));
      const endDate = trackingMode === "date_range" ? String(formData.get("endDate") || "") : "";
      const targetValue = Math.max(1, number(formData.get("targetValue")));
      const dayTargets = GOAL_DAY_KEYS.reduce((targets, dayKey) => {
        targets[dayKey] = Math.max(0, number(formData.get(`target_${dayKey}`)));
        return targets;
      }, {});

      if (trackingMode === "date_range") {
        if (!endDate) {
          goalForm.elements.endDate.reportValidity();
          return;
        }
        if (new Date(endDate) < new Date(startDate)) {
          showToast("Goal dates need a tweak", "Choose an end date that comes after the start date.");
          return;
        }
      }

      if (scheduleMode === "custom_days" && !Object.values(dayTargets).some((value) => value > 0)) {
        showToast("Add at least one target day", "Custom schedules need one or more days with a target greater than zero.");
        return;
      }

      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        goals: [{
          id: createId(),
          type: formData.get("type"),
          title: formData.get("title").trim(),
          targetValue: scheduleMode === "custom_days" ? Math.max(...Object.values(dayTargets)) || targetValue : targetValue,
          createdAt: new Date().toISOString(),
          trackingMode,
          startDate,
          endDate,
          scheduleMode,
          dayTargets
        }, ...projectBundle.goals]
      }));
      closeGoalModal();
      persistAndRender();
      showToast("Goal added", "Your new goal is now visible in the Goals workspace.");
    };
  }

  if (prevHeatmapButton) {
    prevHeatmapButton.onclick = () => {
      heatmapMonthOffset -= 1;
      render();
    };
  }

  if (nextHeatmapButton) {
    nextHeatmapButton.onclick = () => {
      heatmapMonthOffset += 1;
      render();
    };
  }

  bindHeatmapInteractions(bundle);

  document.querySelectorAll("[data-action='archive-goal']").forEach((button) => {
    button.onclick = () => {
      const goal = bundle.goals.find((item) => item.id === button.dataset.id);
      if (!goal) return;
      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        goals: projectBundle.goals.map((item) => item.id === goal.id
          ? { ...item, status: "archived", archivedAt: new Date().toISOString() }
          : item
        )
      }));
      persistAndRender();
      showToast("Goal archived", "That goal moved into the archive, and its old heatmap days will still make sense.");
    };
  });

  document.querySelectorAll("[data-action='restore-goal']").forEach((button) => {
    button.onclick = () => {
      const goal = bundle.goals.find((item) => item.id === button.dataset.id);
      if (!goal) return;
      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        goals: projectBundle.goals.map((item) => item.id === goal.id
          ? { ...item, status: "active", archivedAt: "" }
          : item
        )
      }));
      persistAndRender();
      showToast("Goal restored", "That goal is active again and will count toward new heatmap days going forward.");
    };
  });

  document.querySelectorAll("[data-action='delete-goal-permanently']").forEach((button) => {
    button.onclick = () => {
      const goal = bundle.goals.find((item) => item.id === button.dataset.id);
      if (!goal || goal.status !== "archived") return;
      const confirmed = window.confirm("Delete this archived goal permanently? Past heatmap days tied to it will lose that goal context.");
      if (!confirmed) return;
      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        goals: projectBundle.goals.filter((item) => item.id !== goal.id)
      }));
      persistAndRender();
      showToast("Archived goal deleted", "That archived goal was removed permanently.");
    };
  });
}

function bindHeatmapInteractions(bundle) {
  const detailPanel = document.getElementById("heatmap-detail-panel");
  const cells = [...document.querySelectorAll("[data-heatmap-day]")];
  if (!detailPanel || !cells.length) return;

  const { days } = getHeatmapMonth(bundle, heatmapMonthOffset);
  const dayLookup = new Map(days.filter((day) => !day.outsideMonth).map((day) => [day.key, day]));

  const updateSelection = (key) => {
    const day = dayLookup.get(key);
    if (!day) return;
    selectedHeatmapDayKey = key;
    detailPanel.innerHTML = renderHeatmapDayDetail(day);
    cells.forEach((cell) => {
      cell.classList.toggle("is-selected", cell.dataset.heatmapDay === key);
    });
  };

  cells.forEach((cell) => {
    cell.addEventListener("mouseenter", () => updateSelection(cell.dataset.heatmapDay));
    cell.addEventListener("focus", () => updateSelection(cell.dataset.heatmapDay));
    cell.addEventListener("click", () => updateSelection(cell.dataset.heatmapDay));
  });
}


function openSessionModal() {
  const modal = document.getElementById("session-modal");
  const title = document.getElementById("session-modal-title");
  const copy = document.getElementById("session-modal-copy");
  const bundle = currentBundle();
  const startCountInput = document.getElementById("session-start-word-count");
  title.textContent = "Start Writing Session";
  copy.textContent = "Choose how long you want to write, add your current word count, then begin.";
  if (startCountInput) {
    startCountInput.value = String(number(bundle?.project?.currentWordCount));
  }
  syncSessionDial(sessionDraftMinutes);
  modal.classList.remove("hidden");
}

function closeSessionModal() {
  const modal = document.getElementById("session-modal");
  modal.classList.add("hidden");
}

function openSessionCompleteModal() {
  const modal = document.getElementById("session-complete-modal");
  const form = document.getElementById("session-complete-form");
  const title = document.getElementById("session-complete-title");
  const copy = document.getElementById("session-complete-copy");
  const startCountCopy = document.getElementById("session-start-count-copy");
  const submit = document.getElementById("session-submit-btn");
  const endWordCountField = document.getElementById("session-end-word-count-field");
  const wordsWrittenField = document.getElementById("session-words-written-field");
  const endWordCountInput = form.elements.sessionEndWordCount;
  const wordsWrittenInput = form.elements.sessionWordsWritten;
  const durationInput = form.elements.durationMinutes;
  const sessionDateInput = form.elements.sessionDate;
  const sessionNotesInput = form.elements.sessionNotes;

  form.reset();

  if (editingSessionId) {
    const session = currentBundle()?.sessions.find((item) => item.id === editingSessionId);
    if (!session) {
      editingSessionId = null;
      return;
    }

    title.textContent = "Edit session";
    copy.textContent = "Update the logged session details and save your changes.";
    if (startCountCopy) {
      startCountCopy.textContent = "Editing a past session will automatically reconcile your manuscript word count.";
    }
    endWordCountField.classList.add("hidden");
    wordsWrittenField.classList.remove("hidden");
    endWordCountInput.required = false;
    wordsWrittenInput.required = true;
    wordsWrittenInput.value = String(number(session.wordsWritten));
    durationInput.value = String(Math.max(1, number(session.durationMinutes)));
    sessionDateInput.value = toInputDate(session.date);
    sessionNotesInput.value = session.notes || "";
    submit.textContent = "Save changes";
  } else {
    title.textContent = "Session complete";
    copy.textContent = pendingCompletedSession
      ? `You wrote for ${describeMinutes(pendingCompletedSession.durationMinutes)}. Add your current manuscript word count to calculate words written.`
      : "Add your current manuscript word count to calculate words written.";
    if (startCountCopy) {
      startCountCopy.textContent = pendingCompletedSession
        ? `Starting manuscript count: ${formatNumber(number(pendingCompletedSession.startWordCount))} words.`
        : "";
    }
    endWordCountField.classList.remove("hidden");
    wordsWrittenField.classList.add("hidden");
    endWordCountInput.required = true;
    wordsWrittenInput.required = false;
    durationInput.value = String(Math.max(1, number(pendingCompletedSession?.durationMinutes || sessionDraftMinutes)));
    sessionDateInput.value = toInputDate(pendingCompletedSession?.endedAt || new Date().toISOString());
    sessionNotesInput.value = "";
    submit.textContent = "Save session";
  }

  modal.classList.remove("hidden");
}

function openEndSessionConfirmModal() {
  const modal = document.getElementById("end-session-confirm-modal");
  modal.classList.remove("hidden");
}

function closeEndSessionConfirmModal() {
  const modal = document.getElementById("end-session-confirm-modal");
  modal.classList.add("hidden");
}

function closeSessionCompleteModal() {
  const modal = document.getElementById("session-complete-modal");
  const form = document.getElementById("session-complete-form");
  form.reset();
  pendingCompletedSession = null;
  editingSessionId = null;
  modal.classList.add("hidden");
}

function openManuscriptCompleteModal(bundle = currentBundle()) {
  const modal = document.getElementById("manuscript-complete-modal");
  const form = document.getElementById("manuscript-complete-form");
  const title = document.getElementById("manuscript-complete-modal-title");
  const copy = document.getElementById("manuscript-complete-modal-copy");
  const summary = document.getElementById("manuscript-complete-summary-copy");
  if (!modal || !form || !bundle) return;

  const currentWords = number(bundle.project.currentWordCount);
  const targetWords = Math.max(1, number(bundle.project.targetWordCount));
  const difference = currentWords - targetWords;

  form.reset();
  title.textContent = "Mark manuscript complete";
  copy.textContent = "This changes the Write workspace into a final stats view. It will not delete sessions or project data, and you can reopen the manuscript later if you need more drafting time.";
  summary.textContent = difference >= 0
    ? `You are currently at ${formatNumber(currentWords)} words, which is ${formatNumber(difference)} words over target. Type COMPLETE to confirm.`
    : `You are currently at ${formatNumber(currentWords)} of ${formatNumber(targetWords)} words. If this draft is finished anyway, you can still mark it complete and reopen later if needed.`;
  modal.classList.remove("hidden");
  window.requestAnimationFrame(() => form.elements.completionConfirmation?.focus());
}

function closeManuscriptCompleteModal() {
  const modal = document.getElementById("manuscript-complete-modal");
  const form = document.getElementById("manuscript-complete-form");
  form?.reset();
  modal?.classList.add("hidden");
}

function launchManuscriptCompleteConfetti() {
  document.querySelector(".manuscript-confetti-burst")?.remove();
  const burst = document.createElement("div");
  burst.className = "manuscript-confetti-burst";
  burst.setAttribute("aria-hidden", "true");

  const colors = ["#b85c38", "#efb262", "#7a9e7e", "#5c7c91", "#f6e8d5", "#2a211d"];
  for (let index = 0; index < 64; index += 1) {
    const piece = document.createElement("span");
    piece.className = "manuscript-confetti-piece";
    piece.style.setProperty("--confetti-left", `${Math.round(Math.random() * 100)}%`);
    piece.style.setProperty("--confetti-drift", `${Math.round((Math.random() - 0.5) * 220)}px`);
    piece.style.setProperty("--confetti-delay", `${(Math.random() * 0.35).toFixed(2)}s`);
    piece.style.setProperty("--confetti-duration", `${(2.3 + (Math.random() * 1.8)).toFixed(2)}s`);
    piece.style.setProperty("--confetti-size", `${6 + Math.round(Math.random() * 8)}px`);
    piece.style.setProperty("--confetti-height", `${10 + Math.round(Math.random() * 12)}px`);
    piece.style.setProperty("--confetti-color", colors[index % colors.length]);
    piece.style.setProperty("--confetti-rotate", `${Math.round(Math.random() * 360)}deg`);

    const core = document.createElement("span");
    core.className = "manuscript-confetti-piece-core";
    piece.append(core);
    burst.append(piece);
  }

  document.body.append(burst);
  window.setTimeout(() => burst.remove(), 5000);
}

function sanitizePdfText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "");
}

function escapePdfText(value) {
  return sanitizePdfText(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrapPdfText(text, maxChars = 88) {
  const source = sanitizePdfText(text).replace(/\s+/g, " ").trim();
  if (!source) return [""];

  const words = source.split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    if (!currentLine) {
      currentLine = word;
      return;
    }
    if (`${currentLine} ${word}`.length <= maxChars) {
      currentLine = `${currentLine} ${word}`;
      return;
    }
    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

function buildPublishedProjectPdf(bundle) {
  const stats = getStats(bundle);
  const editStats = getEditStats(bundle);
  const summary = getPublishedProjectSnapshot(bundle, stats, editStats);
  const title = bundle.project.bookTitle || "Untitled Manuscript";
  const pageCommands = [[]];
  let pageIndex = 0;
  let cursorY = 752;

  const startNewPage = () => {
    pageIndex += 1;
    pageCommands[pageIndex] = [];
    cursorY = 752;
  };

  const ensureSpace = (requiredHeight = 18) => {
    if (cursorY - requiredHeight < 58) {
      startNewPage();
    }
  };

  const addLine = (text, options = {}) => {
    const font = options.font || "F1";
    const size = options.size || 12;
    const x = options.x ?? 56;
    const leading = options.leading || Math.round(size * 1.45);
    ensureSpace(leading);
    pageCommands[pageIndex].push(`BT /${font} ${size} Tf 1 0 0 1 ${x} ${cursorY} Tm (${escapePdfText(text)}) Tj ET`);
    cursorY -= leading;
  };

  const addGap = (amount = 10) => {
    ensureSpace(amount);
    cursorY -= amount;
  };

  const addParagraph = (text, options = {}) => {
    const {
      font = "F1",
      size = 12,
      x = 56,
      leading = Math.round(size * 1.45),
      gapBefore = 0,
      gapAfter = 10,
      maxChars = 88
    } = options;
    if (gapBefore) addGap(gapBefore);
    wrapPdfText(text, maxChars).forEach((line) => addLine(line, { font, size, x, leading }));
    if (gapAfter) addGap(gapAfter);
  };

  addParagraph("Final Stats Report", { font: "F2", size: 24, gapAfter: 6, maxChars: 42 });
  addParagraph(title, { font: "F2", size: 18, gapAfter: 4, maxChars: 50 });
  addParagraph(`Published ${formatDate(summary.publishedAt)}`, { size: 12, gapAfter: 16, maxChars: 72 });

  addParagraph("Overview", { font: "F2", size: 15, gapAfter: 6, maxChars: 60 });
  addParagraph(`${title} finished at ${formatNumber(summary.finalWordCount)} words, ${summary.targetSummary}. The project remains locked into final stats mode until it is explicitly re-opened.`, { gapAfter: 10 });
  addParagraph(`Writing time tracked: ${formatHours(stats.totalDuration)}. Editing time tracked: ${formatHours(editStats.totalMinutes)}. Outstanding issues at publication: ${formatNumber(summary.outstandingIssueCount)}.`, { gapAfter: 16 });

  addParagraph("Writing Summary", { font: "F2", size: 15, gapAfter: 6, maxChars: 60 });
  [
    `Total written: ${formatNumber(stats.totalWritten)} words`,
    `Writing sessions: ${formatNumber(summary.writingSessions.length)}`,
    `Daily average: ${formatNumber(stats.dailyAverage)} words per day`,
    `Average session: ${formatNumber(stats.avgSession)} words`,
    `Best day: ${summary.bestDayLabel}`,
    `Most productive weekday: ${getWeekdayName(stats.mostProductiveDayIndex)}`,
    `Longest streak: ${formatNumber(stats.longestStreak)} days`
  ].forEach((line) => addParagraph(line, { gapAfter: 4 }));
  addGap(10);

  addParagraph("Editing Summary", { font: "F2", size: 15, gapAfter: 6, maxChars: 60 });
  [
    `Final pass: ${summary.currentPassLabel}`,
    `Stage and status: ${bundle.editing.passStage} (${bundle.editing.passStatus})`,
    `${summary.structureUnitPlural} logged in final pass: ${summary.sectionsSummary}`,
    `Editing sessions: ${formatNumber(summary.editingSessions.length)}`,
    `Words edited: ${formatNumber(editStats.totalWordsEdited)} words`,
    `Resolved issues: ${formatNumber(editStats.resolvedIssueCount)}`
  ].forEach((line) => addParagraph(line, { gapAfter: 4 }));
  addGap(10);

  addParagraph("Timeline", { font: "F2", size: 15, gapAfter: 6, maxChars: 60 });
  [
    `Project start: ${formatDate(summary.projectStartDate)}`,
    `Manuscript completed: ${formatDate(summary.completionDate)}`,
    `Project published: ${formatDate(summary.publishedAt)}`,
    `Tracked span from start to publish: ${formatNumber(summary.draftSpanDays)} days`
  ].forEach((line) => addParagraph(line, { gapAfter: 4 }));
  addGap(10);

  addParagraph("Re-open Note", { font: "F2", size: 15, gapAfter: 6, maxChars: 60 });
  addParagraph("Re-opening the project restores the normal workspace tabs. It does not delete any writing or editing history, and the project can be published again later.", { gapAfter: 0 });

  const totalPages = pageCommands.length;
  const pageIds = pageCommands.map((_, index) => 5 + (index * 2));
  const contentIds = pageCommands.map((_, index) => 6 + (index * 2));
  const objectMap = new Map([
    [1, "<< /Type /Catalog /Pages 2 0 R >>"],
    [2, `<< /Type /Pages /Count ${totalPages} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`],
    [3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"],
    [4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"]
  ]);

  pageCommands.forEach((commands, index) => {
    const footer = `BT /F1 10 Tf 1 0 0 1 56 32 Tm (${escapePdfText(`Page ${index + 1} of ${totalPages}`)}) Tj ET`;
    const stream = [...commands, footer].join("\n");
    objectMap.set(contentIds[index], `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    objectMap.set(
      pageIds[index],
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentIds[index]} 0 R >>`
    );
  });

  const highestObjectId = 4 + (totalPages * 2);
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let objectId = 1; objectId <= highestObjectId; objectId += 1) {
    offsets[objectId] = pdf.length;
    pdf += `${objectId} 0 obj\n${objectMap.get(objectId)}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${highestObjectId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let objectId = 1; objectId <= highestObjectId; objectId += 1) {
    pdf += `${String(offsets[objectId]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${highestObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function downloadPublishedProjectPdf(bundle = currentBundle()) {
  if (!bundle) return;
  const pdf = buildPublishedProjectPdf(bundle);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `${slugifyFilePart(bundle.project.bookTitle)}-final-stats-${stamp}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast("PDF downloaded", "Your final stats report was saved as a PDF.");
}

function syncSessionDial(minutes = sessionDraftMinutes) {
  const dialValue = document.getElementById("session-dial-value");
  const dialProgress = document.getElementById("session-dial-progress");
  const dialHandle = document.getElementById("session-dial-handle");
  const dialCaption = document.getElementById("session-dial-caption");
  if (!dialValue || !dialProgress || !dialHandle || !dialCaption) return;
  const clampedMinutes = Math.min(120, Math.max(15, Math.round(number(minutes) / 5) * 5 || 25));
  sessionDraftMinutes = clampedMinutes;
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
  dialCaption.textContent = `${describeMinutes(clampedMinutes)} of focused writing time.`;
}

function bindSessionDial() {
  const dial = document.getElementById("session-dial");
  const dialWrap = document.querySelector("#session-start-modal .session-dial-wrap");
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
    syncSessionDial(minutes);
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
    dialWrap.classList.add("dragging");
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
    dialWrap.classList.remove("dragging");
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
    dialWrap.classList.remove("dragging");
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      pendingPointer = null;
    }
  });

  syncSessionDial(sessionDraftMinutes);
}

function stopWritingSessionTimer() {
  if (sessionTimerHandle) {
    clearInterval(sessionTimerHandle);
    sessionTimerHandle = null;
  }
}

function enterWritingFocusMode() {
  if (!activeWritingSession) return;
  writingSessionInFocusMode = true;
  document.getElementById("writing-session-screen")?.classList.remove("hidden");
  syncFloatingFocusTimer?.();
  updateWritingSessionScreen();
}

function leaveWritingFocusMode() {
  if (!activeWritingSession) return;
  writingSessionInFocusMode = false;
  document.getElementById("writing-session-screen")?.classList.add("hidden");
  syncFloatingFocusTimer?.();
}

let isWritingSessionMinimized = false;

function setWritingSessionMinimized(minimized) {
  const screen = document.getElementById("writing-session-screen");
  isWritingSessionMinimized = Boolean(minimized);
  screen?.classList.toggle("hidden", isWritingSessionMinimized);
  syncFloatingFocusTimer?.();
}

function updateWritingSessionScreen() {
  const screen = document.getElementById("writing-session-screen");
  const clock = document.getElementById("writing-session-clock");
  const copy = document.getElementById("writing-session-copy");
  if (!screen || !clock || !copy || !activeWritingSession) return;
  const remainingSeconds = (activeWritingSession.endsAt - Date.now()) / 1000;
  if (remainingSeconds <= 0) {
    clock.textContent = "00:00";
    syncFloatingFocusTimer?.();
    finishActiveWritingSession(true);
    return;
  }
  screen.classList.toggle("hidden", !writingSessionInFocusMode);
  clock.textContent = formatClock(remainingSeconds);
  copy.textContent = `${describeMinutes(activeWritingSession.plannedMinutes)} session in progress`;
  syncFloatingFocusTimer?.();
}

function startWritingSession(startWordCount) {
  activeWritingSession = {
    startedAt: Date.now(),
    plannedMinutes: sessionDraftMinutes,
    endsAt: Date.now() + (sessionDraftMinutes * 60000),
    startWordCount: number(startWordCount)
  };
  writingSessionInFocusMode = true;
  isWritingSessionMinimized = false;
  closeEndSessionConfirmModal();
  closeSessionModal();
  setWritingSessionMinimized(false);
  updateWritingSessionScreen();
  stopWritingSessionTimer();
  sessionTimerHandle = setInterval(updateWritingSessionScreen, 250);
}

function finishActiveWritingSession(autoCompleted = false) {
  if (!activeWritingSession) return;
  const endedAt = Date.now();
  const elapsedMinutes = Math.max(1, Math.round((endedAt - activeWritingSession.startedAt) / 60000));
  pendingCompletedSession = {
    durationMinutes: autoCompleted ? activeWritingSession.plannedMinutes : elapsedMinutes,
    endedAt: new Date(endedAt).toISOString(),
    startWordCount: number(activeWritingSession.startWordCount)
  };
  activeWritingSession = null;
  writingSessionInFocusMode = true;
  closeEndSessionConfirmModal();
  stopWritingSessionTimer();
  isWritingSessionMinimized = false;
  document.getElementById("writing-session-screen").classList.add("hidden");
  syncFloatingFocusTimer?.();
  openSessionCompleteModal();
}

function openGoalModal() {
  const modal = document.getElementById("goal-modal");
  const form = document.getElementById("goal-form");
  const title = document.getElementById("goal-modal-title");
  const copy = document.getElementById("goal-modal-copy");
  form.reset();
  form.elements.type.value = "write_words";
  form.elements.trackingMode.value = "ongoing";
  form.elements.scheduleMode.value = "daily";
  form.elements.startDate.value = toInputDate(new Date().toISOString());
  form.elements.endDate.value = "";
  applyGoalTypePreset(form, "write_words");
  syncGoalFormState(form);
  title.textContent = "Create Goal";
  copy.textContent = "Set a goal that can run for a custom stretch of time and change by day when your writing rhythm does.";
  modal.classList.remove("hidden");
}

function closeGoalModal() {
  const modal = document.getElementById("goal-modal");
  const form = document.getElementById("goal-form");
  form.reset();
  syncGoalFormState(form);
  modal.classList.add("hidden");
}

function syncGoalFormState(form) {
  if (!form?.elements) return;
  const trackingMode = form.elements.trackingMode?.value === "date_range" ? "date_range" : "ongoing";
  const scheduleMode = form.elements.scheduleMode?.value === "custom_days" ? "custom_days" : "daily";
  const endDateField = document.getElementById("goal-end-date-field");
  const customScheduleFields = document.getElementById("goal-custom-schedule-fields");
  const sharedTargetField = document.getElementById("goal-target-field");

  if (endDateField) {
    endDateField.classList.toggle("hidden", trackingMode !== "date_range");
  }
  if (form.elements.endDate) {
    form.elements.endDate.required = trackingMode === "date_range";
  }
  if (customScheduleFields) {
    customScheduleFields.classList.toggle("hidden", scheduleMode !== "custom_days");
  }
  if (sharedTargetField) {
    sharedTargetField.classList.toggle("hidden", scheduleMode === "custom_days");
  }
  if (form.elements.targetValue) {
    form.elements.targetValue.required = scheduleMode !== "custom_days";
  }
}

function bindSessionActions() {
  document.querySelectorAll("[data-action='edit-session']").forEach((button) => {
    button.addEventListener("click", () => {
      const session = currentBundle()?.sessions.find((item) => item.id === button.dataset.id);
      if (!session) return;
      if (session.type === "edit") {
        openEditSessionModal(session.id);
        return;
      }
      editingSessionId = button.dataset.id;
      openSessionCompleteModal();
    });
  });

  document.querySelectorAll("[data-action='delete-session']").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = button.dataset.id;
      const deletedSession = currentBundle()?.sessions.find((item) => item.id === sessionId);
      updateCurrentBundle((projectBundle) => {
        const session = projectBundle.sessions.find((item) => item.id === sessionId);
        const nextWordCount = session?.type === "edit"
          ? number(projectBundle.project.currentWordCount)
          : Math.max(0, number(projectBundle.project.currentWordCount) - number(session?.wordsWritten));
        return {
          ...projectBundle,
          sessions: projectBundle.sessions.filter((item) => item.id !== sessionId),
          project: {
            ...projectBundle.project,
            currentWordCount: nextWordCount
          }
        };
      });
      persistAndRender();
      showToast("Session deleted", deletedSession?.type === "edit" ? "That editing session was removed from your history." : "That session was removed from your history.");
    });
  });

}
