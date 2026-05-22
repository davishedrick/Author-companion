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
let startSessionMenuDocumentBound = false;
let globalHeaderMenuDocumentBound = false;
let projectCardMenuDocumentBound = false;
let publishCelebrationTimer = null;
let pendingReopenProjectId = null;
let activityRangeKey = "7";
let activityScreenMode = "summary";

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

function getBundleById(projectId) {
  return state.projects.find((project) => project.id === projectId) || null;
}

function getWorkspaceLandingView(bundle = currentBundle()) {
  if (isProjectPublished(bundle)) return "dashboard";
  return preferredWorkspaceView();
}

function applyUrlViewOverride() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  if (!requestedView) return;
  if (requestedView === "edit" && currentBundle() && !isProjectPublished(currentBundle())) {
    activeView = "edit";
    lastWorkspaceView = "edit";
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

function renderScriptorLogoMark() {
  return `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id="scriptor-logo-bg" cx="50%" cy="50%" r="72%">
          <stop offset="0" stop-color="#f2f2f0"></stop>
          <stop offset="0.42" stop-color="#b9b9b7"></stop>
          <stop offset="0.74" stop-color="#6f6f6d"></stop>
          <stop offset="1" stop-color="#303030"></stop>
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="10" fill="url(#scriptor-logo-bg)"></rect>
      <text x="24" y="37" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="42" font-weight="900" fill="#050505">S</text>
    </svg>
  `;
}

function renderChevronIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6"></path>
    </svg>
  `;
}

function renderAvatarPlaceholder() {
  return `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="18" r="8"></circle>
      <path d="M10.5 41c1.8-8 7-12 13.5-12s11.7 4 13.5 12"></path>
    </svg>
  `;
}

function syncProfilePhotoControls() {
  const preview = document.getElementById("profile-photo-preview");
  const removeButton = document.getElementById("remove-profile-photo-btn");
  const profilePhoto = normalizeProfilePhoto(state.profilePhoto);
  if (preview) {
    preview.innerHTML = profilePhoto
      ? `<img src="${profilePhoto}" alt="" />`
      : renderAvatarPlaceholder();
  }
  if (removeButton) removeButton.disabled = !profilePhoto;
}

function render() {
  applyUrlViewOverride();
  const bundle = currentBundle();
  if (activeView === "edit2") {
    activeView = "edit";
  }
  if (!bundle && !["projects", "create-project"].includes(activeView)) {
    activeView = "projects";
  }
  if (bundle && isProjectPublished(bundle) && !["dashboard", "projects", "create-project"].includes(activeView)) {
    activeView = "dashboard";
  }
  applyThemePreference();
  const appShell = document.querySelector(".app-shell");
  appShell.classList.toggle("no-sidebar", !isPrimaryWorkspaceView(activeView));
  appShell.classList.toggle("projects-context", ["projects", "create-project"].includes(activeView));
  appShell.classList.toggle("project-context", Boolean(bundle) && !["projects", "create-project"].includes(activeView));
  renderBrand(bundle);
  renderProjectSelector(bundle);
  renderGlobalNav(bundle);
  renderHeaderAction(bundle);
  renderAvatarMenu();
  renderNav(bundle);
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
  bindProjectPublicationModals();
  bindFloatingFocusTimer();
  syncFloatingFocusTimer();
  saveState();
}

function renderBrand(bundle) {
  document.getElementById("brand").innerHTML = `
    <button class="brand-home-btn" id="brand-home-btn" type="button" aria-label="View all projects">
      <span class="brand-mark" aria-hidden="true">${renderScriptorLogoMark()}</span>
      <span>Scriptor</span>
    </button>
  `;
  document.getElementById("brand-home-btn")?.addEventListener("click", () => {
    activeView = "projects";
    saveState();
    render();
  });
}

function getNavIcon(view) {
  const icons = {
    tracker: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
      </svg>
    `,
    session: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7.5" />
        <path d="M12 8v4l3 2" />
      </svg>
    `,
    plot: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 7v14" />
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H12V5H6.5A2.5 2.5 0 0 0 4 7.5v12Z" />
        <path d="M20 19.5A2.5 2.5 0 0 0 17.5 17H12V5h5.5A2.5 2.5 0 0 1 20 7.5v12Z" />
      </svg>
    `,
    dashboard: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    `,
    edit: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
        <path d="M9 15h3l8.5-8.5a2.1 2.1 0 0 0-3-3L9 12v3Z" />
        <path d="m16 5 3 3" />
      </svg>
    `,
    goals: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1.5" />
      </svg>
    `,
    publish: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 4h9l3 3v13H6z" />
        <path d="M15 4v4h4" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    `,
  };
  return icons[view] || "";
}

function closeStartSessionMenu() {
  const trigger = document.getElementById("start-session-menu-btn");
  const menu = document.getElementById("start-session-menu");
  if (!trigger) return;
  trigger.setAttribute("aria-expanded", "false");
  menu?.classList.add("hidden");
}

function openStartSessionMenu() {
  const trigger = document.getElementById("start-session-menu-btn");
  const menu = document.getElementById("start-session-menu");
  if (!trigger || !menu) return;
  trigger.setAttribute("aria-expanded", "true");
  menu.classList.remove("hidden");
}

function toggleStartSessionMenu() {
  const menu = document.getElementById("start-session-menu");
  if (!menu) return;
  if (menu.classList.contains("hidden")) {
    openStartSessionMenu();
  } else {
    closeStartSessionMenu();
  }
}

function closeProjectSelectorMenu() {
  const trigger = document.getElementById("project-selector-btn");
  const menu = document.getElementById("project-selector-menu");
  trigger?.setAttribute("aria-expanded", "false");
  menu?.classList.add("hidden");
}

function closeAvatarMenu() {
  const trigger = document.getElementById("avatar-menu-btn");
  const menu = document.getElementById("avatar-menu-popover");
  trigger?.setAttribute("aria-expanded", "false");
  menu?.classList.add("hidden");
}

function closeGlobalHeaderMenus(except = "") {
  if (except !== "project") closeProjectSelectorMenu();
  if (except !== "session") closeStartSessionMenu();
  if (except !== "avatar") closeAvatarMenu();
}

function toggleGlobalMenu(menuName) {
  const config = {
    project: ["project-selector-btn", "project-selector-menu"],
    session: ["start-session-menu-btn", "start-session-menu"],
    avatar: ["avatar-menu-btn", "avatar-menu-popover"]
  }[menuName];
  if (!config) return;
  const [triggerId, menuId] = config;
  const trigger = document.getElementById(triggerId);
  const menu = document.getElementById(menuId);
  if (!trigger || !menu) return;
  const willOpen = menu.classList.contains("hidden");
  closeGlobalHeaderMenus(menuName);
  trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
  menu.classList.toggle("hidden", !willOpen);
}

function bindGlobalHeaderDismissal() {
  if (globalHeaderMenuDocumentBound) return;
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".global-header")) closeGlobalHeaderMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeGlobalHeaderMenus();
  });
  globalHeaderMenuDocumentBound = true;
}

function renderProjectSelector(bundle) {
  const shell = document.getElementById("project-selector");
  if (!shell) return;
  const inProjectPage = ["projects", "create-project"].includes(activeView);
  if (!bundle || inProjectPage) {
    shell.innerHTML = "";
    return;
  }

  const activeProjects = state.projects.filter((project) => !isProjectArchived(project));
  const recentProjects = [
    bundle,
    ...activeProjects.filter((project) => project.id !== bundle.id)
  ].slice(0, 4);

  shell.innerHTML = `
    <button class="project-selector-btn" id="project-selector-btn" type="button" aria-haspopup="menu" aria-expanded="false">
      <span>${escapeHtml(bundle.project.bookTitle || "Untitled project")}</span>
      <span class="menu-chevron" aria-hidden="true">${renderChevronIcon()}</span>
    </button>
    <div class="project-selector-menu hidden" id="project-selector-menu" role="menu">
      ${recentProjects.map((project) => `
        <button class="${project.id === bundle.id ? "active" : ""}" type="button" data-project-select="${escapeAttr(project.id)}" role="menuitem">
          ${escapeHtml(project.project.bookTitle || "Untitled project")}
        </button>
      `).join("")}
      <div class="menu-divider"></div>
      <button type="button" data-project-select="all" role="menuitem">View all projects</button>
    </div>
  `;

  document.getElementById("project-selector-btn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleGlobalMenu("project");
  });
  shell.querySelectorAll("[data-project-select]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      closeProjectSelectorMenu();
      if (button.dataset.projectSelect === "all") {
        activeView = "projects";
      } else {
        state.activeProjectId = button.dataset.projectSelect;
        activeView = getWorkspaceLandingView(getBundleById(button.dataset.projectSelect));
      }
      saveState();
      render();
    });
  });
}

function renderGlobalNav(bundle) {
  const nav = document.getElementById("global-nav");
  if (!nav) return;
  const inProjectPage = ["projects", "create-project"].includes(activeView);
  if (!bundle || inProjectPage) {
    nav.innerHTML = "";
    return;
  }

  const topLevelItems = [
    { key: "tracker", label: "Tracker", view: getWorkspaceLandingView(bundle), active: isPrimaryWorkspaceView(activeView) },
    { key: "activity", label: "Activity", view: "sessions", active: activeView === "sessions" },
    { key: "goals", label: "Goals", view: "goals", active: activeView === "goals" }
  ];

  nav.innerHTML = topLevelItems.map((item) => `
    <button class="${item.active ? "active" : ""}" type="button" data-global-view="${item.view}" aria-label="${item.label}">
      <span class="nav-icon">${getNavIcon(item.key === "tracker" ? "tracker" : item.key === "activity" ? "session" : "goals")}</span>
      <span>${item.label}</span>
    </button>
  `).join("");

  nav.querySelectorAll("[data-global-view]").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.globalView;
      if (activeView === "sessions") activityScreenMode = "summary";
      saveState();
      render();
    });
  });
}

function renderHeaderAction(bundle) {
  const shell = document.getElementById("header-action");
  if (!shell) return;
  const onProjectsSurface = ["projects", "create-project"].includes(activeView) || !bundle;
  if (onProjectsSurface) {
    shell.innerHTML = `<button class="primary-btn header-primary-btn" id="open-create-project-btn" type="button">Create new project</button>`;
    return;
  }

  shell.innerHTML = `
    <div class="nav-session-shell" id="start-session-menu-shell">
      <button class="nav-session-trigger header-primary-btn" id="start-session-menu-btn" type="button" aria-haspopup="menu" aria-expanded="false">
        <span>Start session</span>
        <span class="menu-chevron" aria-hidden="true">${renderChevronIcon()}</span>
      </button>
      <div class="start-session-menu hidden" id="start-session-menu" role="menu">
        <button type="button" data-session-action="write" role="menuitem">Writing session</button>
        <button type="button" data-session-action="edit" role="menuitem">Editing session</button>
        <button type="button" data-session-action="log-previous" role="menuitem">Log previous session</button>
      </div>
    </div>
  `;
  bindStartSessionMenu();
}

function renderAvatarMenu() {
  const shell = document.getElementById("avatar-menu");
  if (!shell) return;
  const profilePhoto = normalizeProfilePhoto(state.profilePhoto);
  shell.innerHTML = `
    <button class="avatar-menu-btn" id="avatar-menu-btn" type="button" aria-label="User menu" aria-haspopup="menu" aria-expanded="false">
      <span class="avatar-image">${profilePhoto ? `<img src="${profilePhoto}" alt="" />` : renderAvatarPlaceholder()}</span>
    </button>
    <div class="avatar-menu-popover hidden" id="avatar-menu-popover" role="menu">
      <div class="avatar-menu-name">DavisHedrick</div>
      <button type="button" id="avatar-settings-btn" role="menuitem">Settings</button>
      ${persistenceMode === "remote" ? `<a href="/logout" role="menuitem">Log out</a>` : ""}
    </div>
  `;
  document.getElementById("avatar-menu-btn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleGlobalMenu("avatar");
  });
  document.getElementById("avatar-settings-btn")?.addEventListener("click", () => {
    closeAvatarMenu();
    syncThemePreferenceControls();
    syncProfilePhotoControls();
    openSettingsModal();
  });
  bindGlobalHeaderDismissal();
}

function startSidebarSession(action) {
  if (!currentBundle()) {
    showToast("Create a project first", "Sessions need an active project so the handoff has somewhere to land.");
    return;
  }
  if (getActiveFocusSession()) {
    showToast("Session already running", "Return to focus mode from the timer chip or end the current session before starting another.");
    return;
  }

  clearPendingSessionSnapshotContext();
  closeStartSessionMenu();

  if (!action || action === "start") {
    openSessionModal();
    return;
  }
  if (action === "write") {
    openWritingSessionStartModal();
    return;
  }
  if (action === "edit") {
    openEditSessionStartModal();
    return;
  }
  if (action === "log-previous") {
    openPreviousSessionChoiceModal();
    return;
  }
  if (action === "log-previous-writing") {
    openPastWritingSessionModal();
    return;
  }
  if (action === "log-previous-editing") {
    openPastEditingSessionModal();
  }
}

function bindStartSessionMenu() {
  const shell = document.getElementById("start-session-menu-shell");
  const trigger = document.getElementById("start-session-menu-btn");
  const menu = document.getElementById("start-session-menu");
  if (!shell || !trigger || shell.dataset.bound === "true") return;
  shell.dataset.bound = "true";

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menu) {
      toggleGlobalMenu("session");
      return;
    }
    startSidebarSession("start");
  });

  menu?.querySelectorAll("[data-session-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      startSidebarSession(button.dataset.sessionAction);
    });
  });

  if (!startSessionMenuDocumentBound) {
    document.addEventListener("click", (event) => {
      if (!event.target.closest("#start-session-menu-shell")) closeStartSessionMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeStartSessionMenu();
    });
    startSessionMenuDocumentBound = true;
  }
}

function renderNav(bundle) {
  const nav = document.getElementById("nav");
  if (!nav) return;
  const isTrackerContext = bundle && isPrimaryWorkspaceView(activeView);
  const isPublishedBundle = isProjectPublished(bundle);
  const availableViews = isTrackerContext
    ? (isPublishedBundle ? ["dashboard"] : ["dashboard", "plot", "edit"])
    : [];
  const highlightedView = availableViews.includes(activeView) ? activeView : "";
  const navLabels = {
    plot: "Story",
    dashboard: isPublishedBundle ? "Final stats" : "Write",
    edit: "Edit"
  };

  nav.innerHTML = `
    <div class="nav-main">
      ${availableViews.map((view) => `
        <button data-view="${view}" class="${highlightedView === view ? "active" : ""}" aria-label="${navLabels[view] || (view.charAt(0).toUpperCase() + view.slice(1))}">
          <span class="nav-icon">${getNavIcon(view)}</span>
          <span class="nav-label">${navLabels[view] || (view.charAt(0).toUpperCase() + view.slice(1))}</span>
        </button>
      `).join("")}
    </div>
  `;

  [...nav.querySelectorAll("button[data-view]")].forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.view;
      saveState();
      render();
    });
  });
}

function showProjectPublishedCelebration(bundle = currentBundle()) {
  const screen = document.getElementById("published-celebration-screen");
  const title = document.getElementById("published-celebration-title");
  const copy = document.getElementById("published-celebration-copy");
  if (!screen || !title || !copy || !bundle) return;

  const projectTitle = bundle.project.bookTitle || "This project";
  title.textContent = `${projectTitle} published`;
  copy.textContent = "The workspace is now locked into a final stats view, and you can still re-open it later if more work is needed.";
  screen.classList.remove("hidden");
  screen.classList.add("is-visible");
  clearTimeout(publishCelebrationTimer);
  publishCelebrationTimer = setTimeout(() => {
    screen.classList.remove("is-visible");
    screen.classList.add("hidden");
  }, 2600);
}

function openPublishProjectModal(bundle = currentBundle()) {
  const modal = document.getElementById("publish-project-modal");
  const title = document.getElementById("publish-project-title");
  const copy = document.getElementById("publish-project-copy");
  const summary = document.getElementById("publish-project-summary-copy");
  const input = document.getElementById("publish-project-confirmation");
  if (!modal || !title || !copy || !summary || !input || !bundle) return;

  const eligibility = getPublishEligibility(bundle);
  const projectTitle = bundle.project.bookTitle || "Untitled project";

  title.textContent = `Publish ${projectTitle}`;
  copy.textContent = "This removes the normal workspace tabs and turns the project into a locked, scrollable final-stats page. It stays reversible from the stats page or the projects view.";
  summary.textContent = eligibility.canPublish
    ? `${projectTitle} is ready to publish with ${formatNumber(number(bundle.project.currentWordCount))} words and no remaining open issues.`
    : eligibility.reasons.join(" ");
  input.value = "";
  modal.classList.remove("hidden");
  requestAnimationFrame(() => input.focus());
}

function closePublishProjectModal() {
  const modal = document.getElementById("publish-project-modal");
  const input = document.getElementById("publish-project-confirmation");
  if (!modal || !input) return;
  modal.classList.add("hidden");
  input.value = "";
}

function openReopenProjectModal(projectId = state.activeProjectId) {
  const modal = document.getElementById("reopen-project-modal");
  const title = document.getElementById("reopen-project-title");
  const copy = document.getElementById("reopen-project-copy");
  const summary = document.getElementById("reopen-project-summary-copy");
  const input = document.getElementById("reopen-project-confirmation");
  const bundle = getBundleById(projectId);
  if (!modal || !title || !copy || !summary || !input || !bundle) return;

  pendingReopenProjectId = projectId;
  title.textContent = `Re-open ${bundle.project.bookTitle || "project"}`;
  copy.textContent = "This restores the normal workspace tabs so you can move through Write, Story, Edit, and Goals again. The published badge will disappear until you publish it another time.";
  summary.textContent = "Re-opening does not delete any writing or editing history. If you also want to draft again, you can reopen the manuscript separately once the workspace returns.";
  input.value = "";
  modal.classList.remove("hidden");
  requestAnimationFrame(() => input.focus());
}

function closeReopenProjectModal() {
  const modal = document.getElementById("reopen-project-modal");
  const input = document.getElementById("reopen-project-confirmation");
  if (!modal || !input) return;
  modal.classList.add("hidden");
  input.value = "";
  pendingReopenProjectId = null;
}

function bindProjectPublicationModals() {
  const publishModal = document.getElementById("publish-project-modal");
  const publishForm = document.getElementById("publish-project-form");
  const closePublishButton = document.getElementById("close-publish-project-modal-btn");
  const cancelPublishButton = document.getElementById("cancel-publish-project-btn");
  const reopenModal = document.getElementById("reopen-project-modal");
  const reopenForm = document.getElementById("reopen-project-form");
  const closeReopenButton = document.getElementById("close-reopen-project-modal-btn");
  const cancelReopenButton = document.getElementById("cancel-reopen-project-btn");
  const publishedReopenButton = document.getElementById("open-reopen-project-modal-btn");

  if (closePublishButton) closePublishButton.onclick = () => closePublishProjectModal();
  if (cancelPublishButton) cancelPublishButton.onclick = () => closePublishProjectModal();
  if (closeReopenButton) closeReopenButton.onclick = () => closeReopenProjectModal();
  if (cancelReopenButton) cancelReopenButton.onclick = () => closeReopenProjectModal();

  if (publishModal) {
    publishModal.onclick = (event) => {
      if (event.target === publishModal) closePublishProjectModal();
    };
  }

  if (reopenModal) {
    reopenModal.onclick = (event) => {
      if (event.target === reopenModal) closeReopenProjectModal();
    };
  }

  if (publishedReopenButton) {
    publishedReopenButton.onclick = () => {
      if (!state.activeProjectId) return;
      openReopenProjectModal(state.activeProjectId);
    };
  }

  if (publishForm) {
    publishForm.onsubmit = (event) => {
      event.preventDefault();
      const bundle = currentBundle();
      if (!bundle) return;

      const confirmationValue = String(new FormData(publishForm).get("publishConfirmation") || "").trim().toUpperCase();
      if (confirmationValue !== "PUBLISH") {
        showToast("Type PUBLISH to confirm", "This extra step helps prevent an accidental project publication.");
        publishForm.elements.publishConfirmation?.focus();
        return;
      }

      const eligibility = getPublishEligibility(bundle);
      if (!eligibility.canPublish) {
        closePublishProjectModal();
        showToast("Publish is locked", eligibility.reasons.join(" "));
        return;
      }

      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        publication: {
          isPublished: true,
          publishedAt: new Date().toISOString(),
          publishedWordCount: Math.max(
            number(projectBundle.project.currentWordCount),
            number(projectBundle.completion?.completionWordCount)
          )
        }
      }));

      closePublishProjectModal();
      activeView = "dashboard";
      persistAndRender();
      showProjectPublishedCelebration(currentBundle());
      showToast("Project published", "The workspace is now a final stats archive. You can re-open it anytime if more work is needed.");
    };
  }

  if (reopenForm) {
    reopenForm.onsubmit = (event) => {
      event.preventDefault();
      const projectId = pendingReopenProjectId || state.activeProjectId;
      const bundle = getBundleById(projectId);
      if (!projectId || !bundle) return;

      const confirmationValue = String(new FormData(reopenForm).get("reopenConfirmation") || "").trim().toUpperCase();
      if (confirmationValue !== "REOPEN") {
        showToast("Type REOPEN to confirm", "This extra step helps prevent accidentally unlocking a published project.");
        reopenForm.elements.reopenConfirmation?.focus();
        return;
      }

      const shouldReturnToWorkspace = state.activeProjectId === projectId && isProjectWorkspaceView(activeView);

      state.projects = state.projects.map((projectBundle) => projectBundle.id === projectId
        ? {
          ...projectBundle,
          publication: createDefaultPublicationState()
        }
        : projectBundle);

      if (shouldReturnToWorkspace) {
        activeView = preferredWorkspaceView();
      }

      closeReopenProjectModal();
      persistAndRender();
      showToast("Project re-opened", `${bundle.project.bookTitle || "This project"} is back in workspace mode.`);
    };
  }
}

function bindImportExportModals() {
  const settingsModal = document.getElementById("settings-modal");
  const closeSettingsButton = document.getElementById("close-settings-modal-btn");
  const chooseImportButton = document.getElementById("choose-import-csv-btn");
  const exportWriteButton = document.getElementById("export-write-modal-btn");
  const exportEditButton = document.getElementById("export-edit-modal-btn");
  const exportAllButton = document.getElementById("export-all-modal-btn");
  const importProjectCsvInput = document.getElementById("import-project-csv-input");
  const profilePhotoInput = document.getElementById("profile-photo-input");
  const chooseProfilePhotoButton = document.getElementById("choose-profile-photo-btn");
  const removeProfilePhotoButton = document.getElementById("remove-profile-photo-btn");
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

  if (chooseProfilePhotoButton) {
    chooseProfilePhotoButton.onclick = () => {
      profilePhotoInput?.click();
    };
  }

  if (profilePhotoInput && profilePhotoInput.dataset.bound !== "true") {
    profilePhotoInput.dataset.bound = "true";
    profilePhotoInput.addEventListener("change", () => {
      const file = profilePhotoInput.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showToast("Choose an image", "Profile photos need to be an image file.");
        profilePhotoInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        state.profilePhoto = normalizeProfilePhoto(reader.result);
        saveState();
        renderAvatarMenu();
        syncProfilePhotoControls();
        profilePhotoInput.value = "";
      };
      reader.readAsDataURL(file);
    });
  }

  if (removeProfilePhotoButton) {
    removeProfilePhotoButton.onclick = () => {
      state.profilePhoto = "";
      saveState();
      renderAvatarMenu();
      syncProfilePhotoControls();
    };
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
  syncProfilePhotoControls();
}

function renderProjects() {
  const activeProjects = state.projects.filter((project) => !isProjectArchived(project));
  const archivedProjects = state.projects
    .filter(isProjectArchived)
    .sort((a, b) => new Date(b.archivedAt || 0) - new Date(a.archivedAt || 0));
  const hasActiveProjects = activeProjects.length > 0;
  document.getElementById("view-projects").innerHTML = `
    <section class="projects-board-shell">
      <section class="projects-board">
        <h2>Projects</h2>
        <input id="import-project-csv-input" class="hidden" type="file" accept=".csv,text/csv" />
        ${hasActiveProjects ? `
          <div class="projects-grid">
            ${activeProjects.map(renderProjectCard).join("")}
          </div>
        ` : `
          <div class="projects-grid">
            <div class="project-card project-card-empty-state">
              <h3>No projects yet</h3>
              <p>Create a project to start tracking a manuscript.</p>
            </div>
          </div>
        `}
      </section>
      ${archivedProjects.length ? `
        <section class="card">
          <div class="section-head">
            <div>
              <h3>Archived projects</h3>
              <p>Archived projects stay recoverable here until you choose to permanently delete them.</p>
            </div>
          </div>
          <div class="projects-grid">
            ${archivedProjects.map((bundle) => renderProjectCard(bundle, { archived: true })).join("")}
          </div>
        </section>
      ` : ""}
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
            <h2>Create new project</h2>
            <p>Start with the essentials, then refine everything later inside the project workspace.</p>
          </div>
          <button class="route-chip" id="back-to-projects-from-create-btn" type="button" aria-label="Back to projects">
            <span class="route-chip-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="m14.5 6-6 6 6 6" />
              </svg>
            </span>
            <span>Back</span>
          </button>
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
      ${renderProjectTypeFields("create")}
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

function renderProjectTypeFields(scope, project = {}) {
  const projectType = normalizeProjectType(project.manuscriptType);
  const structureUnitLabel = normalizeStructureUnitLabel(project.structureUnitLabel, projectType);
  const structureUnitChoice = STRUCTURE_UNIT_OPTIONS.includes(structureUnitLabel) ? structureUnitLabel : "custom";
  return `
    <label>Manuscript type
      <select name="manuscriptType" id="${scope}-manuscript-type">
        ${PROJECT_TYPE_OPTIONS.map((type) => `<option value="${escapeAttr(type)}" ${projectType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}
      </select>
    </label>
    <label>Structure unit
      <select name="structureUnitChoice" id="${scope}-structure-unit-choice">
        ${STRUCTURE_UNIT_OPTIONS.map((unit) => `<option value="${escapeAttr(unit)}" ${structureUnitChoice === unit ? "selected" : ""}>${escapeHtml(unit)}</option>`).join("")}
        <option value="custom" ${structureUnitChoice === "custom" ? "selected" : ""}>Custom</option>
      </select>
    </label>
    <label class="${structureUnitChoice === "custom" ? "" : "hidden"}" id="${scope}-custom-structure-unit-field">Custom structure unit
      <input name="customStructureUnitLabel" value="${structureUnitChoice === "custom" ? escapeAttr(structureUnitLabel) : ""}" placeholder="Example: Entry" />
    </label>
  `;
}

function syncProjectStructureUnitFields(form, forceDefault = false) {
  if (!form) return;
  const typeInput = form.elements.manuscriptType;
  const unitChoice = form.elements.structureUnitChoice;
  const customInput = form.elements.customStructureUnitLabel;
  if (!typeInput || !unitChoice || !customInput) return;
  const defaultUnit = defaultStructureUnitForProjectType(typeInput.value);
  if (forceDefault) {
    unitChoice.value = defaultUnit && STRUCTURE_UNIT_OPTIONS.includes(defaultUnit) ? defaultUnit : "custom";
    customInput.value = "";
  }
  const customField = form.querySelector("[id$='custom-structure-unit-field']");
  const isCustom = unitChoice.value === "custom";
  customField?.classList.toggle("hidden", !isCustom);
  customInput.required = isCustom;
}

function getProjectFormStructureUnitLabel(form) {
  const choice = String(form.elements.structureUnitChoice?.value || "");
  if (choice === "custom") {
    return normalizeStructureUnitLabel(form.elements.customStructureUnitLabel?.value, form.elements.manuscriptType?.value);
  }
  return normalizeStructureUnitLabel(choice, form.elements.manuscriptType?.value);
}

function bindProjectTypeFields(form) {
  if (!form || form.dataset.projectTypeBound === "true") return;
  form.dataset.projectTypeBound = "true";
  form.elements.manuscriptType?.addEventListener("change", () => syncProjectStructureUnitFields(form, true));
  form.elements.structureUnitChoice?.addEventListener("change", () => syncProjectStructureUnitFields(form));
  syncProjectStructureUnitFields(form);
}

function projectCardProjectedFinish(stats) {
  return stats.estimatedCompletionDate ? formatDate(stats.estimatedCompletionDate) : "Build pace";
}

function projectCardGoalSummary(todaysGoals) {
  if (!todaysGoals.length) return "No active goals today";
  return "All active goals";
}

function projectCardDailyGoalProgress(todaysGoals) {
  if (!todaysGoals.length) return 0;
  const averageProgress = todaysGoals.reduce((sum, goal) => {
    return sum + Math.min(100, Math.max(0, number(goal.progress)));
  }, 0) / todaysGoals.length;
  return Math.round(averageProgress);
}

function projectCardLifecycleStep(bundle) {
  if (isProjectPublished(bundle)) return "published";
  if (bundle?.completion?.isManuscriptComplete) return "editing";
  return "drafting";
}

function renderProjectCardLifecycle(bundle) {
  const activeStep = projectCardLifecycleStep(bundle);
  const rank = { drafting: 0, editing: 1, published: 2 };
  const steps = [
    { key: "drafting", label: "Drafting" },
    { key: "editing", label: "Editing" },
    { key: "published", label: "Published" }
  ];
  return `
    <div class="project-card-lifecycle" aria-label="Project lifecycle: ${activeStep}">
      ${steps.map((step, index) => `
        <span class="project-card-stage ${step.key === activeStep ? "is-active" : ""} ${rank[step.key] < rank[activeStep] ? "is-complete" : ""}">
          ${step.label}
        </span>
        ${index < steps.length - 1 ? `<span class="project-card-stage-line ${index < rank[activeStep] ? "is-complete" : ""}" aria-hidden="true"></span>` : ""}
      `).join("")}
    </div>
  `;
}

function renderProjectCard(bundle, options = {}) {
  const { archived = false } = options;
  const stats = getStats(bundle);
  const published = isProjectPublished(bundle);
  const openIssueCount = getOutstandingIssueCount(bundle);
  const projectedFinish = projectCardProjectedFinish(stats);
  const activeTodayGoals = activeGoalsForBundle(bundle)
    .map((goal) => evaluateGoal(bundle, goal))
    .filter((goal) => goal.trackedToday);
  const dailyGoalProgress = projectCardDailyGoalProgress(activeTodayGoals);
  return `
    <div
      class="project-card ${published ? "project-card-published" : ""} ${archived ? "archived-project" : ""} ${archived ? "" : "project-card--interactive"}"
      ${archived ? "" : `role="button" tabindex="0" data-project-card-open="${escapeAttr(bundle.id)}" aria-label="Open ${escapeAttr(bundle.project.bookTitle || "Untitled project")}"`}
    >
      ${archived ? "" : `
        <div class="project-card-menu">
          <button class="project-card-menu-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Project actions">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="12" r="1.4"></circle>
              <circle cx="12" cy="12" r="1.4"></circle>
              <circle cx="19" cy="12" r="1.4"></circle>
            </svg>
          </button>
          <div class="project-card-overflow-menu hidden" role="menu">
            ${published
              ? `<button type="button" data-action="reopen-project" data-id="${bundle.id}" role="menuitem">Re-open project</button>`
              : `<button type="button" data-action="edit-project" data-id="${bundle.id}" role="menuitem">Edit project</button>`}
            <button type="button" data-action="archive-project" data-id="${bundle.id}" role="menuitem">Archive project</button>
          </div>
        </div>
      `}
      <p class="project-card-genre">${escapeHtml(bundle.project.manuscriptType || "Novel")}</p>
      <h3>${escapeHtml(bundle.project.bookTitle || "Untitled project")}</h3>
      ${archived ? `<p class="project-card-status-copy">Archived ${escapeHtml(formatDate(bundle.archivedAt || new Date().toISOString()))}</p>` : ""}
      ${published ? `<p class="project-card-status-copy">Published ${escapeHtml(formatDate(bundle.publication?.publishedAt || new Date().toISOString()))}</p>` : ""}
      ${renderProjectCardLifecycle(bundle)}
      <div class="project-card-stat-row" aria-label="Project overview stats">
        <article>
          <strong>${escapeHtml(projectedFinish)}</strong>
          <span>Projected finish</span>
        </article>
        <article>
          <strong>${formatNumber(openIssueCount)}</strong>
          <span>Open issues</span>
        </article>
        <article>
          <strong>${formatNumber(number(bundle.project.currentWordCount))}</strong>
          <span>Words</span>
        </article>
      </div>
      <div class="project-card-goals">
        <div class="project-card-overall-progress">
          <span class="project-card-progress-ring" style="--project-card-progress:${dailyGoalProgress}%"></span>
          <div>
            <strong>${formatNumber(dailyGoalProgress)}%</strong>
            <h4>Overall progress</h4>
            <p>${escapeHtml(projectCardGoalSummary(activeTodayGoals))}</p>
          </div>
        </div>
      </div>
      ${archived ? `
        <div class="project-card-actions">
          <button class="ghost-btn" data-action="restore-project" data-id="${bundle.id}">Restore</button>
          <button class="inline-btn" data-action="delete-project-permanently" data-id="${bundle.id}">Delete permanently</button>
        </div>
      ` : ""}
    </div>
  `;
}

function getActivityRangeOptions() {
  return [
    { key: "today", label: "Today", days: 1, copy: "today" },
    { key: "7", label: "7D", days: 7, copy: "the last 7 days" },
    { key: "30", label: "30D", days: 30, copy: "the last 30 days" },
    { key: "all", label: "All", days: null, copy: "all time" }
  ];
}

function getActivityRangeConfig() {
  return getActivityRangeOptions().find((option) => option.key === activityRangeKey) || getActivityRangeOptions()[1];
}

function getSessionDateObject(session) {
  const date = new Date(session?.date || "");
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function getActivityRangeStart(bundle, config = getActivityRangeConfig()) {
  const today = startOfDay(new Date());
  if (config.key === "all") {
    const sessionDates = (bundle?.sessions || [])
      .map(getSessionDateObject)
      .filter(Boolean)
      .sort((a, b) => a - b);
    return sessionDates[0] || today;
  }
  const start = new Date(today);
  start.setDate(today.getDate() - Math.max(0, number(config.days) - 1));
  return start;
}

function getActivityRangeSessions(bundle, config = getActivityRangeConfig()) {
  const today = startOfDay(new Date());
  const start = getActivityRangeStart(bundle, config);
  return (bundle?.sessions || [])
    .filter((session) => {
      const sessionDate = getSessionDateObject(session);
      return sessionDate && sessionDate >= start && sessionDate <= today;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getActivityDailyActivity(bundle, config = getActivityRangeConfig()) {
  const today = startOfDay(new Date());
  const start = getActivityRangeStart(bundle, config);
  const dayCount = Math.max(1, daysBetween(start, today) + 1);
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const daySessions = (bundle?.sessions || []).filter((session) => dateKey(session.date) === key);
    const writingSessions = daySessions.filter((session) => session.type !== "edit");
    const editingSessions = daySessions.filter((session) => session.type === "edit");
    return {
      key,
      label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      shortLabel: config.key === "today" ? "Today" : date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
      sessions: daySessions.length,
      writingSessions: writingSessions.length,
      editingSessions: editingSessions.length,
      words: writingSessions.reduce((sum, session) => sum + number(session.wordsWritten), 0),
      minutes: daySessions.reduce((sum, session) => sum + number(session.durationMinutes), 0),
      editingMinutes: editingSessions.reduce((sum, session) => sum + number(session.durationMinutes), 0)
    };
  });
}

function summarizeActivityRange(rangeSessions) {
  const writingSessions = rangeSessions.filter((session) => session.type !== "edit");
  const editingSessions = rangeSessions.filter((session) => session.type === "edit");
  const words = writingSessions.reduce((sum, session) => sum + number(session.wordsWritten), 0);
  const minutes = rangeSessions.reduce((sum, session) => sum + number(session.durationMinutes), 0);
  const editingMinutes = editingSessions.reduce((sum, session) => sum + number(session.durationMinutes), 0);
  return { writingSessions, editingSessions, words, minutes, editingMinutes };
}

function getActivityMomentumLabel(days) {
  if (!days.length || days.reduce((sum, day) => sum + day.words, 0) <= 0) return "No trend";
  if (days.length < 4) return "Active";
  const midpoint = Math.floor(days.length / 2);
  const earlier = days.slice(0, midpoint).reduce((sum, day) => sum + day.words, 0);
  const later = days.slice(midpoint).reduce((sum, day) => sum + day.words, 0);
  if (later > earlier * 1.08) return "Increasing";
  if (later < earlier * 0.92) return "Slowing";
  return "Steady";
}

function renderActivityRangeTabs() {
  return `
    <div class="activity-range-tabs" aria-label="Activity date range">
      ${getActivityRangeOptions().map((option) => `
        <button
          class="${option.key === activityRangeKey ? "active" : ""}"
          type="button"
          data-activity-range="${option.key}"
          aria-pressed="${option.key === activityRangeKey ? "true" : "false"}"
        >${option.label}</button>
      `).join("")}
    </div>
  `;
}

function renderMiniSparkline(values = []) {
  const series = values.length ? values.map(number) : [0];
  const width = 160;
  const height = 50;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = Math.max(1, max - min);
  const points = series.map((value, index) => {
    const x = series.length === 1 ? width / 2 : 8 + (index * (width - 16)) / Math.max(1, series.length - 1);
    const y = height - 8 - ((value - min) / range) * (height - 16);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return `
    <svg class="activity-sparkline" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <polyline fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
      ${series.map((value, index) => {
        const x = series.length === 1 ? width / 2 : 8 + (index * (width - 16)) / Math.max(1, series.length - 1);
        const y = height - 8 - ((value - min) / range) * (height - 16);
        return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.4" fill="currentColor"></circle>`;
      }).join("")}
    </svg>
  `;
}

function renderActivityLineIcon(icon) {
  const icons = {
    writing: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h16"></path>
        <path d="M7 16.5 17.6 5.9a2 2 0 0 1 2.8 2.8L9.8 19.3 5 20Z"></path>
        <path d="m15.8 7.7 2.8 2.8"></path>
      </svg>
    `,
    editing: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="3"></rect>
        <path d="m8 12 3 3 5-6"></path>
      </svg>
    `,
    words: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6h14"></path>
        <path d="M5 11h14"></path>
        <path d="M5 16h10"></path>
        <path d="M5 20h6"></path>
      </svg>
    `,
    time: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 3h6"></path>
        <circle cx="12" cy="13" r="7"></circle>
        <path d="M12 9v4l3 2"></path>
      </svg>
    `,
    milestone: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 21V4"></path>
        <path d="M6 5h11l-1.5 4L17 13H6"></path>
      </svg>
    `
  };
  return icons[icon] || icons.writing;
}

function renderActivityTrendChart(days, config = getActivityRangeConfig()) {
  const width = 760;
  const height = 238;
  const average = days.length
    ? days.reduce((sum, day) => sum + day.words, 0) / days.length
    : 0;
  const max = Math.max(...days.map((day) => day.words), average, 1);
  const yForValue = (value) => height - 36 - (number(value) / max) * (height - 78);
  const points = days.map((day, index) => {
    const x = days.length === 1 ? width / 2 : 56 + (index * (width - 112)) / Math.max(1, days.length - 1);
    const y = yForValue(day.words);
    return { ...day, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const baseline = height - 36;
  const area = points.length
    ? `${points[0].x},${baseline} ${polyline} ${points[points.length - 1].x},${baseline}`
    : "";
  const averageY = yForValue(average);
  const labelStep = Math.max(1, Math.ceil(days.length / 7));
  const tickValues = [0.25, 0.5, 0.75, 1].map((ratio) => Math.round(max * ratio));
  const lastPoint = points[points.length - 1];
  return `
    <div class="activity-chart-legend" aria-hidden="true">
      <span><i class="activity-legend-dot words"></i>Words written</span>
      <span><i class="activity-legend-dot average"></i>Daily average</span>
    </div>
    <svg class="activity-chart-svg" viewBox="0 0 ${width} ${height}" aria-label="Writing progress for ${config.copy}">
      ${tickValues.map((tick) => {
        const y = yForValue(tick);
        return `
          <line class="activity-chart-grid" x1="56" y1="${y.toFixed(2)}" x2="${width - 34}" y2="${y.toFixed(2)}"></line>
          <text class="activity-chart-y-label" x="40" y="${(y + 4).toFixed(2)}" text-anchor="end">${formatCompactCheckpoint(tick)}</text>
        `;
      }).join("")}
      <line class="activity-chart-axis" x1="56" y1="${baseline}" x2="${width - 34}" y2="${baseline}"></line>
      <polygon class="activity-chart-area" points="${area}" />
      <line class="activity-chart-average" x1="56" y1="${averageY.toFixed(2)}" x2="${width - 34}" y2="${averageY.toFixed(2)}"></line>
      <polyline class="activity-chart-line" fill="none" points="${polyline}" />
      ${points.map((point, index) => `
        <circle class="activity-chart-dot" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${index === points.length - 1 ? 5 : 3.5}" />
      `).join("")}
      ${points.map((point, index) => index % labelStep === 0 || index === points.length - 1 ? `
        <text class="activity-chart-x-label" x="${point.x.toFixed(2)}" y="${height - 13}" text-anchor="middle">${escapeHtml(point.shortLabel)}</text>
      ` : "").join("")}
      ${lastPoint ? `
        <g class="activity-chart-callout" transform="translate(${Math.min(width - 214, Math.max(72, lastPoint.x - 102)).toFixed(2)} ${Math.max(24, lastPoint.y - 62).toFixed(2)})">
          <rect width="188" height="52" rx="10"></rect>
          <text x="14" y="22">Latest</text>
          <text x="174" y="22" text-anchor="end">${formatNumber(lastPoint.words)}</text>
          <text x="14" y="40">Average</text>
          <text x="174" y="40" text-anchor="end">${formatNumber(Math.round(average))}</text>
        </g>
      ` : ""}
    </svg>
  `;
}

function renderActivityTimeline(sessions, expanded = false) {
  if (!sessions.length) return `<div class="empty">No recent activity yet.</div>`;
  const visibleSessions = expanded ? sessions : sessions.slice(0, 5);
  return visibleSessions.map((session) => {
    const isEdit = session.type === "edit";
    const title = isEdit
      ? `Edited for ${formatNumber(session.durationMinutes)} minutes`
      : `Wrote for ${formatNumber(session.durationMinutes)} minutes`;
    const netCopy = formatSessionNetWords(session);
    return `
      <article class="activity-timeline-item ${isEdit ? "editing" : "writing"}">
        <span class="activity-timeline-dot">${renderActivityLineIcon(isEdit ? "editing" : "writing")}</span>
        <div>
          <time>${escapeHtml(formatRelativeTime(session.date))}</time>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(netCopy)} · ${formatNumber(session.durationMinutes)}m${session.sectionLabel ? ` · ${escapeHtml(session.sectionLabel)}` : ""}</p>
        </div>
      </article>
    `;
  }).join("");
}

function bindActivityBoardActions(bundle) {
  document.querySelectorAll("[data-activity-range]").forEach((button) => {
    button.addEventListener("click", () => {
      activityRangeKey = button.dataset.activityRange || "7";
      renderSessions(bundle);
    });
  });

  document.getElementById("activity-view-all-btn")?.addEventListener("click", () => {
    activityScreenMode = "all";
    renderSessions(bundle);
  });
}

function renderAllActivityPage(bundle) {
  const view = document.getElementById("view-sessions");
  const sessions = [...bundle.sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
  view.innerHTML = `
    <section class="activity-board activity-all-board">
      <div class="activity-board-top">
        <div class="activity-hero-copy">
          <h2>All activity</h2>
        </div>
        <button class="activity-text-btn" id="activity-summary-btn" type="button">Back to activity</button>
      </div>
      <div class="activity-all-list">
        ${sessions.length ? sessions.map((session) => renderSessionCard(bundle, session)).join("") : `<div class="empty">No activity logged yet.</div>`}
      </div>
    </section>
  `;
  document.getElementById("activity-summary-btn")?.addEventListener("click", () => {
    activityScreenMode = "summary";
    renderSessions(bundle);
  });
  bindSessionActions();
}



function renderSessions(bundle) {
  const view = document.getElementById("view-sessions");
  if (!bundle) {
    view.innerHTML = "";
    return;
  }
  if (activityScreenMode === "all") {
    renderAllActivityPage(bundle);
    return;
  }
  const config = getActivityRangeConfig();
  const sessions = getActivityRangeSessions(bundle, config);
  const recentDays = getActivityDailyActivity(bundle, config);
  const summary = summarizeActivityRange(sessions);
  const momentumLabel = getActivityMomentumLabel(recentDays);
  view.innerHTML = `
    <section class="activity-board">
      <div class="activity-board-top">
        <div class="activity-hero-copy">
          <h2>Activity</h2>
        </div>
        ${renderActivityRangeTabs()}
      </div>
      <div class="activity-layout">
        <div class="activity-main">
          <section class="activity-kpi-panel">
            <article class="activity-kpi-card writing">
              <span class="activity-kpi-icon">${renderActivityLineIcon("writing")}</span>
              <span>Writing sessions</span>
              <strong>${formatNumber(summary.writingSessions.length)}</strong>
              ${renderMiniSparkline(recentDays.map((day) => day.writingSessions))}
            </article>
            <article class="activity-kpi-card editing">
              <span class="activity-kpi-icon">${renderActivityLineIcon("editing")}</span>
              <span>Editing sessions</span>
              <strong>${formatNumber(summary.editingSessions.length)}</strong>
              ${renderMiniSparkline(recentDays.map((day) => day.editingSessions))}
            </article>
            <article class="activity-kpi-card words">
              <span class="activity-kpi-icon">${renderActivityLineIcon("words")}</span>
              <span>Words written</span>
              <strong>${formatNumber(summary.words)}</strong>
              ${renderMiniSparkline(recentDays.map((day) => day.words))}
            </article>
            <article class="activity-kpi-card time">
              <span class="activity-kpi-icon">${renderActivityLineIcon("time")}</span>
              <span>Hours focused</span>
              <strong>${(summary.minutes / 60).toFixed(1)}</strong>
              ${renderMiniSparkline(recentDays.map((day) => day.minutes))}
            </article>
          </section>
          <section class="activity-chart-card">
            <div class="activity-chart-head">
              <div>
                <h3>Writing progress</h3>
                <p>Words across ${escapeHtml(config.copy)}.</p>
              </div>
            </div>
            <div class="chart-shell activity-trend-chart">
              ${renderActivityTrendChart(recentDays, config)}
            </div>
            <div class="activity-narrative-strip">
              <article>
                <strong>${escapeHtml(momentumLabel)}</strong>
                <span>Writing momentum</span>
              </article>
              <article>
                <strong>${formatNumber(Math.round(summary.words / Math.max(1, recentDays.length)))} words</strong>
                <span>Daily average</span>
              </article>
              <article>
                <strong>${formatHours(summary.editingMinutes)}</strong>
                <span>Revision time in range</span>
              </article>
            </div>
          </section>
        </div>
        <aside class="activity-timeline-card">
          <div class="activity-timeline-head">
            <h3>Recent activity</h3>
            <button class="activity-text-btn" id="activity-view-all-btn" type="button">View all</button>
          </div>
          <div class="activity-timeline-list">
            ${renderActivityTimeline(sessions, false)}
          </div>
        </aside>
      </div>
    </section>
  `;
  bindActivityBoardActions(bundle);
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
            <h2>Edit project</h2>
            <p>Update the manuscript setup from its own dedicated page.</p>
          </div>
          <button class="route-chip" id="back-to-projects-btn" type="button" aria-label="Back to projects">
            <span class="route-chip-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="m14.5 6-6 6 6 6" />
              </svg>
            </span>
            <span>Back</span>
          </button>
        </div>
        <form id="project-form" class="form-grid triple">
          <label class="full">Book title
            <input name="bookTitle" value="${escapeAttr(bundle.project.bookTitle)}" placeholder="Book title" />
          </label>
          ${renderProjectTypeFields("edit", bundle.project)}
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
  const backButton = document.getElementById("back-to-projects-from-create-btn");
  if (backButton) {
    backButton.addEventListener("click", () => {
      activeView = "projects";
      saveState();
      render();
    });
  }
  if (!createForm) return;
  bindProjectTypeFields(createForm);
  createForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const bundle = createProjectBundle(
      formData.get("bookTitle").trim(),
      formData.get("targetWordCount"),
      formData.get("currentWordCount"),
      formData.get("deadline"),
      formData.get("manuscriptType"),
      getProjectFormStructureUnitLabel(createForm)
    );
    state.projects.unshift(bundle);
    state.activeProjectId = bundle.id;
    activeView = getWorkspaceLandingView(bundle);
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

  document.querySelectorAll(".project-card-menu-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const menu = button.parentElement?.querySelector(".project-card-overflow-menu");
      const willOpen = menu?.classList.contains("hidden");
      document.querySelectorAll(".project-card-overflow-menu").forEach((item) => item.classList.add("hidden"));
      document.querySelectorAll(".project-card-menu-btn").forEach((item) => item.setAttribute("aria-expanded", "false"));
      if (menu && willOpen) {
        menu.classList.remove("hidden");
        button.setAttribute("aria-expanded", "true");
      }
    });
  });

  if (!projectCardMenuDocumentBound) {
    document.addEventListener("click", (event) => {
      if (event.target.closest(".project-card-menu")) return;
      document.querySelectorAll(".project-card-overflow-menu").forEach((item) => item.classList.add("hidden"));
      document.querySelectorAll(".project-card-menu-btn").forEach((item) => item.setAttribute("aria-expanded", "false"));
    });
    projectCardMenuDocumentBound = true;
  }

  function openProjectCard(projectId) {
    if (!projectId) return;
    state.activeProjectId = projectId;
    activeView = getWorkspaceLandingView(getBundleById(projectId));
    saveState();
    render();
  }

  document.querySelectorAll("[data-project-card-open]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, textarea, [role='menu']")) return;
      openProjectCard(card.dataset.projectCardOpen);
    });
    card.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      if (event.target.closest("button, a, input, select, textarea, [role='menu']")) return;
      event.preventDefault();
      openProjectCard(card.dataset.projectCardOpen);
    });
  });

  document.querySelectorAll("[data-action='open-project']").forEach((button) => {
    button.addEventListener("click", () => {
      openProjectCard(button.dataset.id);
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

  document.querySelectorAll("[data-action='reopen-project']").forEach((button) => {
    button.addEventListener("click", () => {
      openReopenProjectModal(button.dataset.id);
    });
  });

  document.querySelectorAll("[data-action='archive-project']").forEach((button) => {
    button.addEventListener("click", () => {
      const projectId = button.dataset.id;
      const bundle = getBundleById(projectId);
      state.projects = state.projects.map((project) => project.id === projectId
        ? normalizeProjectBundle({ ...project, status: "archived", archivedAt: new Date().toISOString() })
        : project
      );
      if (state.activeProjectId === projectId) {
        state.activeProjectId = state.projects.find((project) => !isProjectArchived(project))?.id || null;
        activeView = state.activeProjectId ? getWorkspaceLandingView(currentBundle()) : "projects";
      }
      persistAndRender();
      showToast("Project archived", `${bundle?.project?.bookTitle || "This project"} moved to Archived Projects.`);
    });
  });

  document.querySelectorAll("[data-action='restore-project']").forEach((button) => {
    button.addEventListener("click", () => {
      const projectId = button.dataset.id;
      const bundle = getBundleById(projectId);
      state.projects = state.projects.map((project) => project.id === projectId
        ? normalizeProjectBundle({ ...project, status: "active", archivedAt: "" })
        : project
      );
      persistAndRender();
      showToast("Project restored", `${bundle?.project?.bookTitle || "This project"} is active again.`);
    });
  });

  document.querySelectorAll("[data-action='delete-project-permanently']").forEach((button) => {
    button.addEventListener("click", () => {
      const projectId = button.dataset.id;
      const bundle = getBundleById(projectId);
      if (!isProjectArchived(bundle)) return;
      const confirmed = window.confirm(`Permanently delete "${bundle.project.bookTitle}"? This cannot be undone.`);
      if (!confirmed) return;
      state.projects = state.projects.filter((project) => project.id !== projectId);
      persistAndRender();
      showToast("Project deleted", `${bundle.project.bookTitle || "This project"} was permanently deleted.`);
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
  bindProjectTypeFields(form);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    updateCurrentBundle((projectBundle) => ({
      ...projectBundle,
      project: {
        ...projectBundle.project,
        bookTitle: String(formData.get("bookTitle") || "").trim() || projectBundle.project.bookTitle,
        manuscriptType: normalizeProjectType(formData.get("manuscriptType")),
        structureUnitLabel: getProjectFormStructureUnitLabel(form),
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
        <span class="pill">${goalTypeContext(goal.type)} (${goalProgressText(goal)})</span>
      </div>
      <p class="small-copy" style="margin-top: 10px;">${escapeHtml(goalScheduleSummary(goal, currentBundle()))}</p>
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
      <p class="small-copy" style="margin-top: 10px;">${escapeHtml(goalScheduleSummary(goal, currentBundle()))}</p>
      <p class="small-copy">${escapeHtml(goalWindowSummary(goal))}</p>
      <p class="small-copy" style="margin-top: 10px;">This goal is no longer active, but days that were tracked against it will keep showing the right target in the heatmap.</p>
    </div>
  `;
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
        ${issue.sectionLabel ? `<span class="pill">${escapeHtml(issue.sectionLabel)}</span>` : ""}
      </div>
      ${issue.snippet ? `<blockquote class="issue-snippet">${escapeHtml(issue.snippet)}</blockquote>` : ""}
      ${issue.notes ? `<p class="issue-note">${escapeHtml(issue.notes)}</p>` : ""}
    </div>
  `;
}

function formatSessionNetWords(session) {
  const netWords = getSessionManuscriptWordDelta(session);
  return `Net: ${formatSignedNumber(netWords)} ${Math.abs(netWords) === 1 ? "word" : "words"}`;
}

function formatEditingSessionWordTitle(session) {
  return formatSessionNetWords(session);
}

function formatEditingSessionWordDetail(session) {
  return "";
}

function renderSessionCard(bundle, session) {
  const isEditSession = session.type === "edit";
  const snapshot = getSnapshotForSession(bundle, session.id);
  const title = isEditSession
    ? formatEditingSessionWordTitle(session)
    : formatSessionNetWords(session);
  const editingWordDetail = isEditSession ? formatEditingSessionWordDetail(session) : "";
  const sectionPill = session.sectionLabel ? `<span class="pill">${escapeHtml(session.sectionLabel)}</span>` : "";
  const statusPill = snapshot
    ? `<span class="pill">${escapeHtml(sessionSnapshotOutcomeLabel(snapshot.outcomeStatus))}</span>`
    : "";
  const accomplished = snapshot?.accomplished
    ? `<p class="small-copy" style="margin-top: 10px;"><strong>You:</strong> ${escapeHtml(snapshot.accomplished)}</p>`
    : "";
  const nextStep = snapshot
    ? `<p class="small-copy" style="margin-top: 6px;"><strong>Next:</strong> ${escapeHtml(defaultSnapshotNextStep(snapshot))}</p>`
    : "";
  const blocker = snapshot?.outcomeStatus === "blocked" && snapshot?.blocker
    ? `<p class="small-copy" style="margin-top: 6px;"><strong>Blocked by:</strong> ${escapeHtml(snapshot.blocker)}</p>`
    : "";
  return `
    <div class="item">
      <div class="item-top">
        <div>
          <p class="session-kind">${isEditSession ? "Editing session" : "Writing session"}</p>
          <h4>${title}</h4>
          ${editingWordDetail ? `<p class="small-copy">${escapeHtml(editingWordDetail)}</p>` : ""}
          <p class="small-copy">${formatDate(session.date)} (${formatRelativeTime(session.date)})</p>
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
        ${sectionPill}
        ${statusPill}
      </div>
      ${accomplished}
      ${nextStep}
      ${blocker}
      ${session.notes && !snapshot?.notes ? `<p class="small-copy" style="margin-top: 10px;">${escapeHtml(session.notes)}</p>` : ""}
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
