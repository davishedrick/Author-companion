let editSessionDraftMinutes = 45;
let activeEditingSession = null;
let editingSessionInFocusMode = true;
let pendingCompletedEditSession = null;
let editSessionTimerHandle = null;

function renderEditDashboard(bundle) {
  const view = document.getElementById("view-edit");
  if (!bundle) {
    view.innerHTML = renderWorkspaceEmptyState("Edit");
    bindWorkspaceEmptyActions();
    return;
  }

  const editStats = getEditStats(bundle);
  const progressCurrent = number(bundle.editing.progressCurrent);
  const progressTotal = number(bundle.editing.progressTotal);
  const progressPercent = progressTotal > 0 ? Math.min(100, (progressCurrent / progressTotal) * 100) : 0;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEditSessions = [...getEditSessions(bundle)]
    .filter((session) => dateKey(session.date) === todayKey)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const issuePriorityRank = { High: 0, Medium: 1, Low: 2 };
  const issueStatusRank = { Open: 0, Deferred: 1, Resolved: 2 };
  const issues = [...bundle.issues]
    .sort((a, b) => {
      const statusDelta = (issueStatusRank[a.status] ?? 99) - (issueStatusRank[b.status] ?? 99);
      if (statusDelta !== 0) return statusDelta;
      const priorityDelta = (issuePriorityRank[a.priority] ?? 99) - (issuePriorityRank[b.priority] ?? 99);
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  const visibleIssues = issues.filter((issue) => issue.status !== "Resolved");
  const resolvedIssues = issues.filter((issue) => issue.status === "Resolved");
  const currentPassIssues = visibleIssues.filter((issue) => !issue.passName || issue.passName === bundle.editing.passName);
  const issueList = (currentPassIssues.length ? currentPassIssues : visibleIssues).slice(0, 6);
  const resolvedIssueArchive = resolvedIssues.slice(0, 8);
  const issueCounts = issueList.reduce((summary, issue) => {
    summary[issue.type] = (summary[issue.type] || 0) + 1;
    return summary;
  }, {});
  const topIssueTypes = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const lastSession = editStats.lastSession;

  view.innerHTML = `
    <section class="stack">
      <section class="card">
        <div class="writing-launch">
          <div class="writing-launch-copy">
            <div>
              <h3>Get editing</h3>
              <p>Jump into a revision pass, log the section you touched, and capture what changed before you move on.</p>
            </div>
            <div class="writing-launch-meta">
              <span class="pill">${formatNumber(todayEditSessions.length)} session${todayEditSessions.length === 1 ? "" : "s"} today</span>
              <span class="pill">${formatHours(editStats.minutesToday)} edited today</span>
            </div>
          </div>
          <button class="primary-btn writing-launch-cta" id="open-edit-session-modal-btn" type="button">Start editing session</button>
        </div>
      </section>

      <section class="card hero">
        <div class="hero-panel pass-focus">
          <div class="section-head">
            <div>
              <p class="small-copy">Edit dashboard</p>
              <h2 class="hero-title">${escapeHtml(bundle.editing.passName || defaultPassName(bundle.editing.passStage))}</h2>
              <p class="pass-copy">${escapeHtml(bundle.editing.passObjective || "Define what this pass is trying to improve so the dashboard can support the work.")}</p>
            </div>
            <div class="meta-line">
              <button class="ghost-btn" id="open-edit-pass-btn" type="button">Change pass</button>
            </div>
          </div>
          <div class="hero-meta">
            <span class="badge">${escapeHtml(bundle.editing.passStage || "Developmental")}</span>
            <span class="pill">${escapeHtml(bundle.editing.passStatus || "Not started")}</span>
            <span class="pill">${formatNumber(editStats.currentPassIssueCount)} open issue${editStats.currentPassIssueCount === 1 ? "" : "s"} in this pass</span>
          </div>
          <div class="progress-block">
            <div class="progress-label-row">
              <strong>Pass progress</strong>
              <span>${progressTotal > 0 ? `${formatNumber(progressCurrent)} / ${formatNumber(progressTotal)} sections` : "No section target yet"}</span>
            </div>
            <div class="progress-rail">
              <div class="progress-fill" style="width:${progressPercent}%"></div>
            </div>
          </div>
          <div class="snapshot-grid">
            <div class="snapshot-card">
              <strong>Last worked on</strong>
              <p>${lastSession?.sectionLabel ? escapeHtml(lastSession.sectionLabel) : "Nothing logged yet"}</p>
              <span>${lastSession ? formatDate(lastSession.date) : "Log an editing session to start building history."}</span>
            </div>
            <div class="snapshot-card">
              <strong>Current pass hours</strong>
              <p>${formatHours(editStats.currentPassMinutes)}</p>
              <span>${formatNumber(editStats.sessionCount)} editing session${editStats.sessionCount === 1 ? "" : "s"} recorded overall</span>
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <div>
            <h3>Hours Edited</h3>
            <p>Track how much revision time is actually going into the manuscript.</p>
          </div>
        </div>
        <div class="metrics">
          <div class="metric"><div class="label">Today</div><div class="value">${formatHours(editStats.minutesToday)}</div></div>
          <div class="metric"><div class="label">This week</div><div class="value">${formatHours(editStats.minutesWeek)}</div></div>
          <div class="metric"><div class="label">Current pass</div><div class="value">${formatHours(editStats.currentPassMinutes)}</div></div>
          <div class="metric"><div class="label">Average session</div><div class="value">${formatNumber(editStats.averageSessionMinutes)} min</div></div>
        </div>
      </section>

      <section class="card open-issues-focus">
        <div class="section-head">
          <div>
            <h3>Open Issues</h3>
            <p>Capture problems now so you can refer back to them while editing.</p>
          </div>
          <button class="ghost-btn" id="open-issue-modal-btn" type="button">Add issue</button>
        </div>
        <div class="list">
          ${issueList.length ? issueList.map(renderIssueCard).join("") : `<div class="empty">No open issues yet. Add one when something needs a second pass.</div>`}
        </div>
      </section>

      <section class="card issue-archive">
        <div class="section-head">
          <div>
            <h3>Resolved Archive</h3>
            <p>Keep a lightweight record of the issues you already closed during this project.</p>
          </div>
        </div>
        <div class="list">
          ${resolvedIssueArchive.length ? resolvedIssueArchive.map((issue) => renderIssueCard(issue, { archived: true })).join("") : `<div class="empty">Resolved issues will collect here once you start closing them out.</div>`}
        </div>
      </section>

      <section class="edit-columns">
        <section class="card">
          <div class="section-head">
            <div>
              <h3>Session History</h3>
              <p>All editing sessions logged today.</p>
            </div>
            <div class="meta-line">
              <button class="ghost-btn" id="view-all-edit-sessions-btn" type="button">View all sessions</button>
            </div>
          </div>
          <div class="list">
            ${todayEditSessions.length ? todayEditSessions.map((session) => renderSessionCard(bundle, session)).join("") : `<div class="empty">No editing sessions logged today.</div>`}
          </div>
        </section>

        <section class="card">
          <div class="section-head">
            <div>
              <h3>Issue Breakdown</h3>
              <p>See which kinds of problems are stacking up in this pass.</p>
            </div>
          </div>
          <div class="issue-breakdown">
            ${topIssueTypes.length ? topIssueTypes.map(([label, count]) => `
              <div class="issue-breakdown-row">
                <strong>${escapeHtml(label)}</strong>
                <span>${formatNumber(count)} issue${count === 1 ? "" : "s"}</span>
              </div>
            `).join("") : `<div class="empty">Issue types will appear here once you start filing problems.</div>`}
          </div>
        </section>
      </section>

      <section class="card">
        <div class="section-head">
          <div>
            <h3>Pass Snapshot</h3>
            <p>A quick read on how the current pass is moving.</p>
          </div>
        </div>
        <div class="snapshot-grid">
          <div class="snapshot-card">
            <strong>Words edited</strong>
            <p>${formatNumber(editStats.totalWordsEdited)}</p>
            <span>Across all editing sessions</span>
          </div>
          <div class="snapshot-card">
            <strong>Issues resolved</strong>
            <p>${formatNumber(editStats.resolvedIssueCount)}</p>
            <span>Problems marked complete</span>
          </div>
          <div class="snapshot-card">
            <strong>Status</strong>
            <p>${escapeHtml(bundle.editing.passStatus || "Not started")}</p>
            <span>${escapeHtml(bundle.editing.passStage || "Developmental")}</span>
          </div>
          <div class="snapshot-card">
            <strong>Sections remaining</strong>
            <p>${progressTotal > 0 ? formatNumber(Math.max(progressTotal - progressCurrent, 0)) : "Set target"}</p>
            <span>${progressTotal > 0 ? `Out of ${formatNumber(progressTotal)} total` : "Add a section target in Change pass."}</span>
          </div>
        </div>
      </section>
    </section>
  `;

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
  const openPassButton = document.getElementById("open-edit-pass-btn");
  const openEditSessionButton = document.getElementById("open-edit-session-modal-btn");
  const closeEditSessionStartButton = document.getElementById("close-edit-session-start-btn");
  const startEditSessionButton = document.getElementById("start-edit-session-btn");
  const endEditSessionButton = document.getElementById("end-edit-session-btn");
  const leaveEditFocusModeButton = document.getElementById("leave-edit-focus-mode-btn");
  const cancelEndEditSessionButton = document.getElementById("cancel-end-edit-session-btn");
  const confirmEndEditSessionButton = document.getElementById("confirm-end-edit-session-btn");
  const openIssueButton = document.getElementById("open-issue-modal-btn");
  const viewAllSessionsButton = document.getElementById("view-all-edit-sessions-btn");
  const closePassButton = document.getElementById("close-edit-pass-btn");
  const closeEditSessionButton = document.getElementById("close-edit-session-btn");
  const closeIssueButton = document.getElementById("close-issue-modal-btn");

  if (openPassButton) {
    openPassButton.onclick = () => {
      openEditPassModal();
    };
  }

  if (openEditSessionButton) {
    openEditSessionButton.onclick = () => {
      if (getActiveFocusSession()) {
        showToast("Session already running", "Return to focus mode from the timer chip or end the current session before starting another.");
        return;
      }
      openEditSessionStartModal();
    };
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
    issueForm.onsubmit = (event) => {
      event.preventDefault();
      const formData = new FormData(issueForm);
      const isEditingExisting = Boolean(editingIssueId);
      const issue = normalizeIssue({
        id: editingIssueId || createId(),
        title: String(formData.get("title") || "").trim(),
        type: String(formData.get("type") || "General"),
        sectionLabel: String(formData.get("sectionLabel") || "").trim(),
        priority: String(formData.get("priority") || "Medium"),
        status: String(formData.get("status") || "Open"),
        notes: String(formData.get("notes") || "").trim(),
        createdAt: isEditingExisting
          ? bundle.issues.find((item) => item.id === editingIssueId)?.createdAt || new Date().toISOString()
          : new Date().toISOString(),
        passName: bundle.editing.passName || defaultPassName(bundle.editing.passStage)
      });

      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        issues: isEditingExisting
          ? projectBundle.issues.map((item) => item.id === editingIssueId ? issue : item)
          : [issue, ...projectBundle.issues]
      }));

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
      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        issues: projectBundle.issues.map((issue) => {
          if (issue.id !== issueId) return issue;
          return {
            ...issue,
            status: issue.status === "Resolved" ? "Open" : "Resolved"
          };
        })
      }));
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
  const title = document.getElementById("issue-modal-title");
  const copy = document.getElementById("issue-modal-copy");
  const submit = document.getElementById("issue-submit-btn");
  const issue = issueId ? currentBundle()?.issues.find((item) => item.id === issueId) : null;

  editingIssueId = issueId;
  form.reset();
  passCopy.textContent = `Filed under: ${currentBundle()?.editing?.passName || defaultPassName(currentBundle()?.editing?.passStage)}`;

  if (issue) {
    title.textContent = "Edit Open Issue";
    copy.textContent = "Update the problem so it stays useful during the pass.";
    form.elements.title.value = issue.title || "";
    form.elements.type.value = issue.type || "General";
    form.elements.priority.value = issue.priority || "Medium";
    form.elements.sectionLabel.value = issue.sectionLabel || "";
    form.elements.status.value = issue.status || "Open";
    form.elements.notes.value = issue.notes || "";
    submit.textContent = "Save changes";
  } else {
    title.textContent = "Add Open Issue";
    copy.textContent = "Capture a problem now so you can come back to it during the pass.";
    form.elements.type.value = "Pacing";
    form.elements.priority.value = "Medium";
    form.elements.status.value = "Open";
    submit.textContent = "Save issue";
  }

  modal.classList.remove("hidden");
}

function closeIssueModal() {
  const modal = document.getElementById("issue-modal");
  const form = document.getElementById("issue-form");
  form.reset();
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
        ${issue.sectionLabel ? `<span class="pill">${escapeHtml(issue.sectionLabel)}</span>` : ""}
      </div>
      ${issue.notes ? `<p class="issue-note">${escapeHtml(issue.notes)}</p>` : ""}
    </div>
  `;
}
