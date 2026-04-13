function persistAndRender() {
  if (state.activeProjectId) {
    updateCurrentBundle((bundle) => {
      return {
        ...bundle,
        milestones: milestoneTargets.filter((target) => number(bundle.project.currentWordCount) >= target)
      };
    });
  }
  saveState();
  render();
}

let floatingFocusTimerDock = "top-right";
let floatingFocusTimerResizeBound = false;
let floatingFocusTimerPosition = null;
let sidebarCollapseResizeBound = false;

function getActiveFocusSession() {
  const activeSessions = [];
  if (activeWritingSession) {
    activeSessions.push({
      type: "write",
      plannedMinutes: number(activeWritingSession.plannedMinutes),
      endsAt: number(activeWritingSession.endsAt),
      startedAt: number(activeWritingSession.startedAt),
      focusMode: Boolean(writingSessionInFocusMode)
    });
  }
  if (activeEditingSession) {
    activeSessions.push({
      type: "edit",
      plannedMinutes: number(activeEditingSession.plannedMinutes),
      endsAt: number(activeEditingSession.endsAt),
      startedAt: number(activeEditingSession.startedAt),
      focusMode: Boolean(editingSessionInFocusMode)
    });
  }
  return activeSessions.sort((a, b) => b.startedAt - a.startedAt)[0] || null;
}

function getFloatingFocusTimerBounds(widget) {
  const margin = 16;
  const contentRect = document.querySelector(".content-shell")?.getBoundingClientRect();
  const width = widget.offsetWidth || 300;
  const height = widget.offsetHeight || 170;
  const contentLeft = contentRect ? contentRect.left + margin : margin;
  const contentRight = contentRect ? contentRect.right - width - margin : window.innerWidth - width - margin;
  const minLeft = Math.max(margin, contentLeft);
  const maxLeft = Math.max(minLeft, Math.min(window.innerWidth - width - margin, contentRight));
  const minTop = margin;
  const maxTop = Math.max(minTop, window.innerHeight - height - margin);
  return { minLeft, maxLeft, minTop, maxTop };
}

function clampFloatingFocusTimerPosition(widget, position) {
  if (!widget || !position) return null;
  const bounds = getFloatingFocusTimerBounds(widget);
  const left = Number(position.left);
  const top = Number(position.top);
  return {
    left: Math.min(bounds.maxLeft, Math.max(bounds.minLeft, Number.isFinite(left) ? left : bounds.minLeft)),
    top: Math.min(bounds.maxTop, Math.max(bounds.minTop, Number.isFinite(top) ? top : bounds.minTop))
  };
}

function getFloatingFocusTimerAnchors(widget) {
  const bounds = getFloatingFocusTimerBounds(widget);
  const horizontalSteps = 5;
  const verticalSteps = 4;
  const anchors = [];
  for (let yIndex = 0; yIndex < verticalSteps; yIndex += 1) {
    const verticalRatio = verticalSteps === 1 ? 0 : yIndex / (verticalSteps - 1);
    const top = Math.round(bounds.minTop + ((bounds.maxTop - bounds.minTop) * verticalRatio));
    for (let xIndex = 0; xIndex < horizontalSteps; xIndex += 1) {
      const horizontalRatio = horizontalSteps === 1 ? 0 : xIndex / (horizontalSteps - 1);
      const left = Math.round(bounds.minLeft + ((bounds.maxLeft - bounds.minLeft) * horizontalRatio));
      anchors.push({
        dock: `grid-${yIndex}-${xIndex}`,
        left,
        top
      });
    }
  }
  return anchors;
}

function applyFloatingFocusTimerPosition(position = null) {
  const widget = document.getElementById("floating-focus-timer");
  if (!widget || widget.classList.contains("hidden")) return;
  const anchors = getFloatingFocusTimerAnchors(widget);
  const nextPosition = clampFloatingFocusTimerPosition(widget, position || floatingFocusTimerPosition)
    || anchors.find((anchor) => anchor.dock === floatingFocusTimerDock)
    || anchors[0];
  floatingFocusTimerPosition = {
    left: nextPosition.left,
    top: nextPosition.top
  };
  widget.style.left = `${nextPosition.left}px`;
  widget.style.top = `${nextPosition.top}px`;
}

function syncFloatingFocusTimer() {
  const widget = document.getElementById("floating-focus-timer");
  const label = document.getElementById("floating-focus-label");
  const clock = document.getElementById("floating-focus-clock");
  const meta = document.getElementById("floating-focus-meta");
  const returnButton = document.getElementById("floating-focus-return-btn");
  const endButton = document.getElementById("floating-focus-end-btn");
  if (!widget || !label || !clock || !meta || !returnButton || !endButton) return;

  const session = getActiveFocusSession();
  if (!session || session.focusMode) {
    widget.classList.add("hidden");
    return;
  }

  const remainingSeconds = Math.max(0, Math.round((session.endsAt - Date.now()) / 1000));
  const wasHidden = widget.classList.contains("hidden");
  widget.dataset.sessionType = session.type;
  label.textContent = session.type === "edit" ? "Editing session running" : "Writing session running";
  meta.textContent = `${describeMinutes(session.plannedMinutes)} planned. Keep the timer nearby while you review the rest of the project.`;
  clock.textContent = formatClock(remainingSeconds);
  returnButton.textContent = "Expand";
  endButton.textContent = session.type === "edit" ? "End editing session" : "End writing session";
  widget.classList.remove("hidden");
  if (wasHidden || !floatingFocusTimerPosition) {
    applyFloatingFocusTimerPosition();
  }
}

function bindFloatingFocusTimer() {
  const widget = document.getElementById("floating-focus-timer");
  const returnButton = document.getElementById("floating-focus-return-btn");
  const endButton = document.getElementById("floating-focus-end-btn");
  if (!widget || !returnButton || !endButton || widget.dataset.bound === "true") return;
  widget.dataset.bound = "true";

  let dragState = null;

  const setDragSelectionState = (isDragging) => {
    document.body.classList.toggle("dragging-floating-focus-timer", Boolean(isDragging));
  };

  const clampToBounds = (left, top) => {
    const bounds = getFloatingFocusTimerBounds(widget);
    return {
      left: Math.min(bounds.maxLeft, Math.max(bounds.minLeft, left)),
      top: Math.min(bounds.maxTop, Math.max(bounds.minTop, top))
    };
  };

  const snapToNearestAnchor = (left, top) => {
    const anchors = getFloatingFocusTimerAnchors(widget);
    const snapped = anchors.reduce((closest, anchor) => {
      const closestDistance = Math.hypot(closest.left - left, closest.top - top);
      const nextDistance = Math.hypot(anchor.left - left, anchor.top - top);
      return nextDistance < closestDistance ? anchor : closest;
    });
    floatingFocusTimerDock = snapped.dock;
    floatingFocusTimerPosition = {
      left: snapped.left,
      top: snapped.top
    };
    applyFloatingFocusTimerPosition(snapped);
  };

  widget.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    if (widget.classList.contains("hidden")) return;
    event.preventDefault();
    const rect = widget.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    widget.classList.add("dragging");
    setDragSelectionState(true);
    widget.setPointerCapture(event.pointerId);
  });

  widget.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    event.preventDefault();
    const next = clampToBounds(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
    floatingFocusTimerPosition = next;
    widget.style.left = `${next.left}px`;
    widget.style.top = `${next.top}px`;
  });

  const releaseDrag = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    event.preventDefault();
    const rect = widget.getBoundingClientRect();
    snapToNearestAnchor(rect.left, rect.top);
    widget.classList.remove("dragging");
    setDragSelectionState(false);
    if (widget.hasPointerCapture(event.pointerId)) widget.releasePointerCapture(event.pointerId);
    dragState = null;
  };

  widget.addEventListener("pointerup", releaseDrag);
  widget.addEventListener("pointercancel", releaseDrag);
  widget.addEventListener("lostpointercapture", () => {
    widget.classList.remove("dragging");
    setDragSelectionState(false);
    dragState = null;
  });
  widget.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });

  returnButton.addEventListener("click", () => {
    const session = getActiveFocusSession();
    if (!session) return;
    if (session.type === "edit") {
      enterEditingFocusMode?.();
      return;
    }
    enterWritingFocusMode?.();
  });

  endButton.addEventListener("click", () => {
    const session = getActiveFocusSession();
    if (!session) return;
    if (session.type === "edit") {
      openEndEditSessionConfirmModal?.();
      return;
    }
    openEndSessionConfirmModal?.();
  });
}

async function initializeApp() {
  remoteSyncSuspended = true;
  try {
    const remoteSnapshot = await fetchRemoteState();
    applyPersistedSnapshot(remoteSnapshot);
    persistenceMode = "remote";
  } catch (error) {
    persistenceMode = "local";
    console.warn("Using browser storage fallback.", error);
  }
  render();
  remoteSyncSuspended = false;
}

function applyThemePreference() {
  const themePreference = state.themePreference === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = themePreference;
}

function canCollapseSidebar() {
  return window.innerWidth > 1080 && isProjectWorkspaceView(activeView);
}

function getSidebarCollapseIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m14.5 6-6 6 6 6" />
    </svg>
  `;
}

function applySidebarCollapseState() {
  const appShell = document.querySelector(".app-shell");
  const collapseButton = document.getElementById("sidebar-collapse-btn");
  if (!appShell) return;
  const shouldCollapse = canCollapseSidebar() && Boolean(state.sidebarCollapsed) && !appShell.classList.contains("no-sidebar");
  appShell.classList.toggle("sidebar-collapsed", shouldCollapse);
  if (collapseButton) {
    collapseButton.classList.toggle("is-collapsed", shouldCollapse);
    collapseButton.setAttribute("aria-label", shouldCollapse ? "Expand sidebar" : "Collapse sidebar");
    collapseButton.setAttribute("title", shouldCollapse ? "Expand sidebar" : "Collapse sidebar");
  }
  applyFloatingFocusTimerPosition();
}

function bindSidebarCollapseToggle() {
  const collapseButton = document.getElementById("sidebar-collapse-btn");
  if (collapseButton && collapseButton.dataset.bound !== "true") {
    collapseButton.dataset.bound = "true";
    collapseButton.addEventListener("click", () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      applySidebarCollapseState();
      saveState();
    });
  }
  if (!sidebarCollapseResizeBound) {
    window.addEventListener("resize", () => {
      applySidebarCollapseState();
    });
    sidebarCollapseResizeBound = true;
  }
}

function syncThemePreferenceControls() {
  const themeInputs = document.querySelectorAll("input[name='themePreference']");
  if (!themeInputs.length) return;
  const themePreference = state.themePreference === "dark" ? "dark" : "light";
  themeInputs.forEach((input) => {
    input.checked = input.value === themePreference;
  });
}

function render() {
  const bundle = currentBundle();
  if (!bundle && !["dashboard", "plot", "edit", "goals", "projects", "create-project"].includes(activeView)) {
    activeView = "dashboard";
  }
  if (!bundle && activeView === "projects") {
    activeView = "dashboard";
  }
  applyThemePreference();
  const appShell = document.querySelector(".app-shell");
  appShell.classList.toggle("no-sidebar", !isProjectWorkspaceView(activeView));
  renderBrand(bundle);
  renderNav(bundle);
  renderSidebarFooter(bundle);
  renderProjects();
  renderCreateProject();
  renderDashboard(bundle);
  renderPlotDashboard(bundle);
  renderEditDashboard(bundle);
  renderGoalsDashboard(bundle);
  renderSessions(bundle);
  renderEditProject(bundle);
  views.forEach((view) => {
    if (!bundle && ["sessions", "edit-project"].includes(view)) {
      document.getElementById(`view-${view}`).classList.add("hidden");
      return;
    }
    document.getElementById(`view-${view}`).classList.toggle("hidden", activeView !== view);
  });
  bindImportExportModals();
  bindSidebarCollapseToggle();
  applySidebarCollapseState();
  bindFloatingFocusTimer();
  syncFloatingFocusTimer();
  saveState();
}

function renderBrand(bundle) {
  document.getElementById("brand").innerHTML = bundle && isProjectWorkspaceView(activeView) ? `
    <div class="brand-head">
      <div class="brand-copy">
        <h1>The Author Engine</h1>
        <p>${escapeHtml(bundle.project.bookTitle)}</p>
      </div>
      <button class="sidebar-collapse-btn" id="sidebar-collapse-btn" type="button" aria-label="Collapse sidebar" title="Collapse sidebar">
        ${getSidebarCollapseIcon()}
      </button>
    </div>
  ` : `
    <div class="brand-head">
      <div class="brand-copy">
        <h1>The Author Engine</h1>
        <p>Write. Track. Finish.</p>
      </div>
    </div>
  `;
}

function getNavIcon(view) {
  const icons = {
    plot: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 18h14" />
        <path d="M7 15l3-3 3 2 4-5" />
        <path d="M16 7h1.5V8.5" />
      </svg>
    `,
    dashboard: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
      </svg>
    `,
    edit: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h5l9.5-9.5a2.1 2.1 0 0 0-5-5L4 15v5Z" />
        <path d="m13 6 5 5" />
      </svg>
    `,
    goals: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1.5" />
      </svg>
    `,
  };
  return icons[view] || "";
}

function renderNav(bundle) {
  const nav = document.getElementById("nav");
  const availableViews = (bundle && isProjectWorkspaceView(activeView)) || (!bundle && WORKSPACE_VIEWS.includes(activeView))
    ? ["plot", "dashboard", "edit", "goals"]
    : [];
  const highlightedView = availableViews.includes(activeView) ? activeView : "";
  const navLabels = {
    plot: "Plot",
    dashboard: "Write",
    edit: "Edit",
    goals: "Goals",
  };
  nav.innerHTML = availableViews.map((view) => `
    <button data-view="${view}" class="${highlightedView === view ? "active" : ""}" aria-label="${navLabels[view] || (view.charAt(0).toUpperCase() + view.slice(1))}" title="${navLabels[view] || (view.charAt(0).toUpperCase() + view.slice(1))}">
      <span class="nav-icon">${getNavIcon(view)}</span>
      <span class="nav-label">${navLabels[view] || (view.charAt(0).toUpperCase() + view.slice(1))}</span>
    </button>
  `).join("");

  [...nav.querySelectorAll("button")].forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.view;
      saveState();
      render();
    });
  });
}

function getSidebarFooterIcon(action) {
  const icons = {
    projects: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
      </svg>
    `,
    settings: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 4.5h1.3l.5 2.1a5.8 5.8 0 0 1 1.7.7l1.8-1.2 1 1-1.2 1.8a5.8 5.8 0 0 1 .7 1.7l2.1.5v1.3l-2.1.5a5.8 5.8 0 0 1-.7 1.7l1.2 1.8-1 1-1.8-1.2a5.8 5.8 0 0 1-1.7.7l-.5 2.1H12.1l-.5-2.1a5.8 5.8 0 0 1-1.7-.7l-1.8 1.2-1-1 1.2-1.8a5.8 5.8 0 0 1-.7-1.7l-2.1-.5v-1.3l2.1-.5a5.8 5.8 0 0 1 .7-1.7L7.1 7.1l1-1 1.8 1.2a5.8 5.8 0 0 1 1.7-.7Z" />
      </svg>
    `,
    logout: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10" />
        <path d="M14 8.5 18 12l-4 3.5" />
        <path d="M9 12h9" />
      </svg>
    `,
  };
  return icons[action] || "";
}

function renderSidebarFooter(bundle) {
  const footer = document.getElementById("sidebar-footer");
  if (!isProjectWorkspaceView(activeView)) {
    footer.innerHTML = "";
    return;
  }
  footer.innerHTML = `
    <div class="sidebar-footer-actions">
      ${bundle ? `
        <button class="sidebar-text-btn" id="view-all-projects-btn" type="button" aria-label="View all projects" title="View all projects">
          <span class="sidebar-action-icon">${getSidebarFooterIcon("projects")}</span>
          <span class="sidebar-action-label">View all projects</span>
        </button>
      ` : ""}
      <button class="sidebar-text-btn" id="open-settings-modal-btn" type="button" aria-label="Settings" title="Settings">
        <span class="sidebar-action-icon">${getSidebarFooterIcon("settings")}</span>
        <span class="sidebar-action-label">Settings</span>
      </button>
      ${persistenceMode === "remote" ? `
        <a class="sidebar-text-btn" id="logout-link" href="/logout" aria-label="Log out" title="Log out">
          <span class="sidebar-action-icon">${getSidebarFooterIcon("logout")}</span>
          <span class="sidebar-action-label">Log out</span>
        </a>
      ` : ""}
    </div>
  `;
  if (bundle) {
    document.getElementById("view-all-projects-btn").addEventListener("click", () => {
      activeView = "projects";
      saveState();
      render();
    });
  }
  document.getElementById("open-settings-modal-btn").addEventListener("click", () => {
    syncThemePreferenceControls();
    openSettingsModal();
  });
}

function bindImportExportModals() {
  const settingsModal = document.getElementById("settings-modal");
  const closeSettingsButton = document.getElementById("close-settings-modal-btn");
  const chooseImportButton = document.getElementById("choose-import-csv-btn");
  const exportWriteButton = document.getElementById("export-write-modal-btn");
  const exportEditButton = document.getElementById("export-edit-modal-btn");
  const exportAllButton = document.getElementById("export-all-modal-btn");
  const importProjectCsvInput = document.getElementById("import-project-csv-input");
  const themeInputs = document.querySelectorAll("input[name='themePreference']");
  const hasBundle = Boolean(currentBundle());

  if (closeSettingsButton) {
    closeSettingsButton.onclick = () => {
      closeSettingsModal();
    };
  }

  if (chooseImportButton) {
    chooseImportButton.onclick = () => {
      importProjectCsvInput?.click();
    };
  }

  if (importProjectCsvInput && importProjectCsvInput.dataset.modalBound !== "true") {
    importProjectCsvInput.dataset.modalBound = "true";
    importProjectCsvInput.addEventListener("change", () => {
      closeSettingsModal();
    });
  }

  if (exportWriteButton) {
    exportWriteButton.disabled = !hasBundle;
    exportWriteButton.onclick = () => {
      if (!hasBundle) return;
      downloadCurrentProjectCsv("write");
      closeSettingsModal();
    };
  }

  if (exportEditButton) {
    exportEditButton.disabled = !hasBundle;
    exportEditButton.onclick = () => {
      if (!hasBundle) return;
      downloadCurrentProjectCsv("edit");
      closeSettingsModal();
    };
  }

  if (exportAllButton) {
    exportAllButton.disabled = !hasBundle;
    exportAllButton.onclick = () => {
      if (!hasBundle) return;
      downloadCurrentProjectCsv("all");
      closeSettingsModal();
    };
  }

  if (settingsModal) {
    settingsModal.onclick = (event) => {
      if (event.target === settingsModal) closeSettingsModal();
    };
  }

  themeInputs.forEach((input) => {
    if (input.dataset.bound === "true") return;
    input.dataset.bound = "true";
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.themePreference = input.value === "dark" ? "dark" : "light";
      applyThemePreference();
      saveState();
    });
  });
  syncThemePreferenceControls();
}

function renderProjects() {
  const hasProjects = state.projects.length > 0;
  document.getElementById("view-projects").innerHTML = `
    <section class="stack">
      <section class="card">
        <div class="section-head">
          <div>
            <p class="small-copy">The Author Engine</p>
            <h2 class="hero-title">Projects Dashboard</h2>
            <p class="muted">A focused writing tracker built to make progress visible, measurable, and satisfying.</p>
          </div>
          <div class="meta-line">
            <button class="primary-btn" id="open-create-project-btn" type="button">Create new project</button>
          </div>
        </div>
        <input id="import-project-csv-input" class="hidden" type="file" accept=".csv,text/csv" />
        ${hasProjects ? `
          <div class="projects-grid">
            ${state.projects.map(renderProjectCard).join("")}
          </div>
        ` : `
          <div class="empty">No projects yet. Create one to start tracking your manuscript.</div>
        `}
      </section>
    </section>
  `;

  bindProjectEvents();
}

function renderCreateProject() {
  document.getElementById("view-create-project").innerHTML = `
    <section class="stack">
      <section class="card">
        <div class="section-head">
          <div>
            <h2>Create New Project</h2>
            <p>Start with the essentials, then refine everything later inside the project dashboard.</p>
          </div>
        </div>
        ${renderCreateProjectForm()}
      </section>
    </section>
  `;
  bindCreateProjectEvents();
}

function renderCreateProjectForm() {
  return `
    <form id="create-project-form" class="form-grid">
      <label class="full">Project title
        <input name="bookTitle" placeholder="Example: The Hollow Orchard" required />
      </label>
      <label>Target word count estimate
        <input type="number" min="0" name="targetWordCount" value="80000" required />
      </label>
      <label>Words written so far
        <input type="number" min="0" name="currentWordCount" value="0" required />
      </label>
      <label class="full">Deadline to completion
        <input type="date" name="deadline" />
      </label>
      <div class="full">
        <button class="primary-btn" type="submit">Create project</button>
      </div>
    </form>
  `;
}

function renderProjectCard(bundle) {
  const stats = getStats(bundle);
  return `
    <div class="card project-card">
      <div>
        <p class="small-copy">Project</p>
        <h3 class="hero-title">${escapeHtml(bundle.project.bookTitle)}</h3>
        <div class="meta-line">
          <span class="pill">${formatNumber(bundle.project.currentWordCount)} / ${formatNumber(bundle.project.targetWordCount)} words</span>
          <span class="pill">${bundle.project.deadline ? `Due ${formatDate(bundle.project.deadline)}` : "No deadline"}</span>
        </div>
      </div>
      <div class="progress-block">
        <div class="progress-label-row">
          <strong>Completion</strong>
          <span>${stats.totalProgress.toFixed(1)}%</span>
        </div>
        <div class="progress-rail">
          <div class="progress-fill" style="width:${stats.totalProgress}%"></div>
        </div>
      </div>
      <div class="metrics" style="grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 0;">
        <div class="metric">
          <div class="label">Words today</div>
          <div class="value">${formatNumber(stats.wordsToday)}</div>
        </div>
        <div class="metric">
          <div class="label">Current streak</div>
          <div class="value">${formatNumber(stats.currentStreak)}</div>
        </div>
      </div>
      <div class="meta-line">
        <button class="primary-btn" data-action="open-project" data-id="${bundle.id}">Open project</button>
        <button class="ghost-btn" data-action="edit-project" data-id="${bundle.id}">Edit project</button>
        <button class="inline-btn" data-action="delete-project" data-id="${bundle.id}">Delete</button>
      </div>
    </div>
  `;
}



function renderSessions(bundle) {
  const view = document.getElementById("view-sessions");
  if (!bundle) {
    view.innerHTML = "";
    return;
  }
  const sessions = [...bundle.sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
  view.innerHTML = `
    <section class="stack">
      <section class="card">
        <div class="section-head">
          <div>
            <h2>All Sessions</h2>
            <p>View and delete every session logged for this project.</p>
          </div>
          <button class="ghost-btn" id="back-to-dashboard-btn" type="button">Back to dashboard</button>
        </div>
        <div class="list">
          ${sessions.length ? sessions.map((session) => renderSessionCard(bundle, session)).join("") : `<div class="empty">No sessions logged yet.</div>`}
        </div>
      </section>
    </section>
  `;
  const backButton = document.getElementById("back-to-dashboard-btn");
  if (backButton) {
    backButton.addEventListener("click", () => {
      activeView = sessionsReturnView;
      render();
    });
  }
  bindSessionActions();
}

function renderEditProject(bundle) {
  const view = document.getElementById("view-edit-project");
  if (!bundle) {
    view.innerHTML = "";
    return;
  }
  view.innerHTML = `
    <section class="stack">
      <section class="card">
        <div class="section-head">
          <div>
            <h2>Edit Project</h2>
            <p>Update the manuscript setup from its own dedicated page.</p>
          </div>
          <button class="ghost-btn" id="back-to-projects-btn" type="button">Back to projects</button>
        </div>
        <form id="project-form" class="form-grid triple">
          <label class="full">Book title
            <input name="bookTitle" value="${escapeAttr(bundle.project.bookTitle)}" placeholder="Book title" />
          </label>
          <label>Target word count
            <input type="number" min="0" name="targetWordCount" value="${escapeAttr(bundle.project.targetWordCount)}" />
          </label>
          <label>Current word count
            <input type="number" min="0" name="currentWordCount" value="${escapeAttr(bundle.project.currentWordCount)}" />
          </label>
          <label>Deadline
            <input type="date" name="deadline" value="${escapeAttr(bundle.project.deadline)}" />
          </label>
          <label>Daily target
            <input type="number" min="0" name="dailyTarget" value="${escapeAttr(bundle.project.dailyTarget)}" />
          </label>
          <label>Project start date
            <input type="date" name="projectStartDate" value="${escapeAttr(bundle.project.projectStartDate)}" />
          </label>
          <div class="full">
            <button class="primary-btn" type="submit">Save project</button>
          </div>
        </form>
      </section>
    </section>
  `;
  bindEditProjectEvents();
}

function bindCreateProjectEvents() {
  const createForm = document.getElementById("create-project-form");
  if (!createForm) return;
  createForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const bundle = createProjectBundle(
      formData.get("bookTitle").trim(),
      formData.get("targetWordCount"),
      formData.get("currentWordCount"),
      formData.get("deadline")
    );
    state.projects.unshift(bundle);
    state.activeProjectId = bundle.id;
    activeView = preferredWorkspaceView();
    persistAndRender();
    showToast("Project created", `${bundle.project.bookTitle} is ready for tracking.`);
  });
}

function bindProjectEvents() {
  const openCreateButton = document.getElementById("open-create-project-btn");
  const importProjectCsvInput = document.getElementById("import-project-csv-input");
  if (openCreateButton) {
    openCreateButton.addEventListener("click", () => {
      activeView = "create-project";
      render();
    });
  }

  if (importProjectCsvInput) {
    importProjectCsvInput.addEventListener("change", () => {
      handleImportProjectFile(importProjectCsvInput.files?.[0]);
      importProjectCsvInput.value = "";
    });
  }

  document.querySelectorAll("[data-action='open-project']").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeProjectId = button.dataset.id;
      activeView = preferredWorkspaceView();
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action='edit-project']").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeProjectId = button.dataset.id;
      activeView = "edit-project";
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action='delete-project']").forEach((button) => {
    button.addEventListener("click", () => {
      const projectId = button.dataset.id;
      state.projects = state.projects.filter((project) => project.id !== projectId);
      if (state.activeProjectId === projectId) {
        state.activeProjectId = state.projects[0]?.id || null;
        activeView = state.activeProjectId ? preferredWorkspaceView() : DEFAULT_VIEW;
      }
      persistAndRender();
    });
  });
}


function bindEditProjectEvents() {
  const form = document.getElementById("project-form");
  const backButton = document.getElementById("back-to-projects-btn");
  if (backButton) {
    backButton.addEventListener("click", () => {
      activeView = "projects";
      saveState();
      render();
    });
  }
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    updateCurrentBundle((projectBundle) => ({
      ...projectBundle,
      project: {
        ...projectBundle.project,
        bookTitle: String(formData.get("bookTitle") || "").trim() || projectBundle.project.bookTitle,
        targetWordCount: number(formData.get("targetWordCount")),
        currentWordCount: number(formData.get("currentWordCount")),
        deadline: String(formData.get("deadline") || ""),
        dailyTarget: number(formData.get("dailyTarget")),
        projectStartDate: String(formData.get("projectStartDate") || "") || projectBundle.project.projectStartDate
      }
    }));
    activeView = "projects";
    persistAndRender();
    showToast("Project updated", "Your manuscript settings have been saved.");
  });
}

function renderGoalCard(goal) {
  return `
    <div class="item" data-goal-id="${goal.id}">
      <div class="item-top">
        <h4>${escapeHtml(goal.title)}</h4>
        <div class="goal-actions">
          <button class="inline-btn" type="button" data-action="archive-goal" data-id="${goal.id}">Archive</button>
        </div>
      </div>
      <div class="progress-block"><div class="progress-rail"><div class="progress-fill" style="width: ${goal.progress}%"></div></div></div>
      <div class="meta-line">
        <span class="pill">${goalTypeContext(goal.type)} ${goal.trackedToday ? `(${formatNumber(goal.liveValue)} / ${formatNumber(goal.targetValueToday)} ${goalUnit(goal.type)})` : "(Not scheduled today)"}</span>
      </div>
      <p class="small-copy" style="margin-top: 10px;">${escapeHtml(goalScheduleSummary(goal))}</p>
      <p class="small-copy">${escapeHtml(goalWindowSummary(goal))}</p>
    </div>
  `;
}

function renderArchivedGoalCard(goal) {
  return `
    <div class="item" data-goal-id="${goal.id}">
      <div class="item-top">
        <h4>${escapeHtml(goal.title)}</h4>
        <div class="goal-actions">
          <span class="pill">Archived ${escapeHtml(formatDate(goal.archivedAt || goal.createdAt))}</span>
          <button class="inline-btn" type="button" data-action="restore-goal" data-id="${goal.id}">Restore</button>
          <button class="inline-btn" type="button" data-action="delete-goal-permanently" data-id="${goal.id}">Delete permanently</button>
        </div>
      </div>
      <div class="meta-line">
        <span class="pill">${goalTypeContext(goal.type)} target plan</span>
      </div>
      <p class="small-copy" style="margin-top: 10px;">${escapeHtml(goalScheduleSummary(goal))}</p>
      <p class="small-copy">${escapeHtml(goalWindowSummary(goal))}</p>
      <p class="small-copy" style="margin-top: 10px;">This goal is no longer active, but days that were tracked against it will keep showing the right target in the heatmap.</p>
    </div>
  `;
}

function renderIssueCard(issue) {
  const priorityClass = `priority-${String(issue.priority || "Medium").toLowerCase()}`;
  const statusClass = `status-${String(issue.status || "Open").toLowerCase()}`;
  return `
    <div class="item">
      <div class="item-top">
        <div>
          <p class="session-kind">Open issue</p>
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

function renderSessionCard(bundle, session) {
  const isEditSession = session.type === "edit";
  const title = isEditSession
    ? `${formatNumber(session.wordsEdited)} words edited`
    : `${formatNumber(session.wordsWritten)} words written`;
  const sectionPill = session.sectionLabel ? `<span class="pill">${escapeHtml(session.sectionLabel)}</span>` : "";
  const passPill = isEditSession && session.passName ? `<span class="pill">${escapeHtml(session.passName)}</span>` : "";
  return `
    <div class="item">
      <div class="item-top">
        <div>
          <p class="session-kind">${isEditSession ? "Editing session" : "Writing session"}</p>
          <h4>${title}</h4>
          <p class="small-copy">${formatDate(session.date)}</p>
        </div>
        <div class="goal-actions">
          <button class="icon-btn" type="button" data-action="edit-session" data-id="${session.id}" aria-label="Edit session">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4"></path>
              <path d="M13.5 6.5l4 4"></path>
            </svg>
          </button>
          <button class="icon-btn" type="button" data-action="delete-session" data-id="${session.id}" aria-label="Delete session">
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
        <span class="pill">${formatNumber(session.durationMinutes)} min</span>
        ${passPill}
        ${sectionPill}
      </div>
      ${session.notes ? `<p class="small-copy" style="margin-top: 10px;">${escapeHtml(session.notes)}</p>` : ""}
    </div>
  `;
}

function renderLineChart(bundle) {
  const entries = [...getStats(bundle).groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return `<div class="empty">Log sessions to populate the chart.</div>`;
  let running = 0;
  const series = entries.map(([key, value]) => {
    running += value.words;
    return { key, total: running };
  });
  const width = 720;
  const height = 280;
  const max = Math.max(...series.map((point) => point.total), 1);
  const points = series.map((point, index) => {
    const x = 40 + (index * (width - 80)) / Math.max(1, series.length - 1);
    const y = height - 30 - ((point.total / max) * (height - 70));
    return `${x},${y}`;
  }).join(" ");
  return `
    <svg viewBox="0 0 ${width} ${height}" aria-label="Word count over time line chart">
      <line x1="40" y1="${height - 30}" x2="${width - 20}" y2="${height - 30}" stroke="rgba(96,70,54,0.16)" />
      <line x1="40" y1="20" x2="40" y2="${height - 30}" stroke="rgba(96,70,54,0.16)" />
      <polyline fill="none" stroke="#b85c38" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
      ${series.map((point, index) => {
        const x = 40 + (index * (width - 80)) / Math.max(1, series.length - 1);
        const y = height - 30 - ((point.total / max) * (height - 70));
        return `<circle cx="${x}" cy="${y}" r="4" fill="#b85c38" />`;
      }).join("")}
      <text x="42" y="18" fill="#6d6257" font-size="12">Total words</text>
      <text x="${width - 24}" y="${height - 10}" text-anchor="end" fill="#6d6257" font-size="12">${series[series.length - 1].key}</text>
    </svg>
  `;
}

function renderBarChart(bundle) {
  const entries = [...getStats(bundle).groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return `<div class="empty">Log sessions to populate the chart.</div>`;
  const weekly = new Map();
  entries.forEach(([key, value]) => {
    const date = new Date(key);
    const monday = startOfDay(date);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weekKey = monday.toISOString().slice(0, 10);
    weekly.set(weekKey, (weekly.get(weekKey) || 0) + value.words);
  });
  const series = [...weekly.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8);
  const width = 720;
  const height = 280;
  const max = Math.max(...series.map(([, value]) => value), 1);
  const barWidth = (width - 90) / Math.max(1, series.length);
  return `
    <svg viewBox="0 0 ${width} ${height}" aria-label="Weekly productivity bar chart">
      <line x1="40" y1="${height - 30}" x2="${width - 20}" y2="${height - 30}" stroke="rgba(96,70,54,0.16)" />
      ${series.map(([key, value], index) => {
        const x = 48 + index * barWidth;
        const barHeight = (value / max) * (height - 80);
        const y = height - 30 - barHeight;
        return `
          <rect x="${x}" y="${y}" width="${Math.max(barWidth - 14, 20)}" height="${barHeight}" rx="12" fill="rgba(184,92,56,0.78)" />
          <text x="${x + (Math.max(barWidth - 14, 20) / 2)}" y="${height - 10}" text-anchor="middle" fill="#6d6257" font-size="12">${key.slice(5)}</text>
        `;
      }).join("")}
    </svg>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

initializeApp();

if (!floatingFocusTimerResizeBound) {
  floatingFocusTimerResizeBound = true;
  window.addEventListener("resize", () => {
    if (floatingFocusTimerPosition) {
      applyFloatingFocusTimerPosition(floatingFocusTimerPosition);
    }
    syncFloatingFocusTimer();
  });
}
