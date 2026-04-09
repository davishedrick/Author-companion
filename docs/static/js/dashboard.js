function renderDashboard(bundle) {
  if (!bundle) {
    document.getElementById("view-dashboard").innerHTML = renderWorkspaceEmptyState("Write");
    bindWorkspaceEmptyActions();
    return;
  }
  const stats = getStats(bundle);
  const deadlineLabel = bundle.project.deadline ? formatDate(bundle.project.deadline) : "Flexible timeline";
  const completionLabel = stats.estimatedCompletionDate ? formatDate(stats.estimatedCompletionDate) : "Build pace to predict";
  const momentumState = stats.momentum === "Increasing"
    ? { icon: "↑", label: "Accelerating", className: "up", detail: `Projected finish ${completionLabel}` }
    : stats.momentum === "Slowing"
      ? { icon: "↓", label: "Declining", className: "down", detail: `Pace is slipping. Finish forecast ${completionLabel}` }
      : { icon: "→", label: "Steady", className: "flat", detail: `Projected finish ${completionLabel}` };
  const reachedMilestones = milestoneTargets.filter((target) => number(bundle.project.currentWordCount) >= target);
  const nextMilestone = milestoneTargets.find((target) => number(bundle.project.currentWordCount) < target);
  const milestoneSummary = reachedMilestones.length
    ? `Milestones reached: ${reachedMilestones.map((target) => formatNumber(target)).join(", ")} words.`
    : "No milestones reached yet.";
  const milestoneSubtext = nextMilestone
    ? `${milestoneSummary} Next milestone: ${formatNumber(nextMilestone)} words.`
    : `${milestoneSummary} All milestone markers cleared.`;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySessions = [...getWriteSessions(bundle)]
    .filter((session) => dateKey(session.date) === todayKey)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  document.getElementById("view-dashboard").innerHTML = `
    <section class="grid dashboard-grid">
      <div class="stack">
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
          </div>
          <div class="hero-meta">
            <span class="pill">Target ${formatNumber(bundle.project.targetWordCount)} words</span>
            <span class="pill">${deadlineLabel}</span>
          </div>

            <div class="progress-block">
              <div class="progress-label-row">
                <strong>Book completion</strong>
                <span>${stats.totalProgress.toFixed(1)}%</span>
              </div>
              <div class="progress-rail">
                <div class="progress-fill" style="width: ${stats.totalProgress}%"></div>
              </div>
              <p class="small-copy" style="margin-top: 10px;">${milestoneSubtext}</p>
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

          <div class="writing-workspace-note">
            <div>
              <h3 style="margin-bottom: 4px;">Goals moved into the shared layer</h3>
              <p>Use the project bar at the top for goal planning, archives, and the progress heatmap. This dashboard stays focused on drafting momentum.</p>
            </div>
            <button class="ghost-btn" id="open-goals-view-btn" type="button">Open Goals</button>
          </div>
        </section>

        <section class="card">
          <div class="section-head">
            <div>
              <h3>Session History</h3>
              <p>All writing sessions logged today.</p>
            </div>
            <button class="ghost-btn" id="view-all-sessions-btn" type="button">View all sessions</button>
          </div>
          <div class="list">
            ${todaySessions.length ? todaySessions.map((session) => renderSessionCard(bundle, session)).join("") : `<div class="empty">No sessions logged today.</div>`}
          </div>
        </section>
      </div>
    </section>
  `;

  bindDashboardEvents(bundle);
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
  const openGoalsViewButton = document.getElementById("open-goals-view-btn");
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

  if (openGoalsViewButton) {
    openGoalsViewButton.onclick = () => {
      activeView = "goals";
      render();
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
            <h2 class="hero-title">Goals Dashboard</h2>
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

  if (goalForm?.elements?.type && goalForm.dataset.goalTypeBound !== "true") {
    goalForm.dataset.goalTypeBound = "true";
    goalForm.elements.type.addEventListener("change", (event) => {
      applyGoalTypePreset(goalForm, event.target.value);
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
      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        goals: [{
          id: createId(),
          type: formData.get("type"),
          title: formData.get("title").trim(),
          targetValue: number(formData.get("targetValue")),
          createdAt: new Date().toISOString()
        }, ...projectBundle.goals]
      }));
      closeGoalModal();
      persistAndRender();
      showToast("Goal added", "Your new goal is now visible on the goals dashboard.");
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
  applyGoalTypePreset(form, "write_words");
  title.textContent = "Create Goal";
  copy.textContent = "Set a simple daily target you can review quickly from the goals dashboard.";
  modal.classList.remove("hidden");
}

function closeGoalModal() {
  const modal = document.getElementById("goal-modal");
  const form = document.getElementById("goal-form");
  form.reset();
  modal.classList.add("hidden");
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
