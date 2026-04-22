const PLOT_SECTION_CONFIG = {
  characters: {
    label: "Characters",
    singular: "character",
    kicker: "Cast and pressure",
    description: "Track who matters, what they want, and what keeps pushing against them.",
    navCopy: "POV characters, antagonists, allies, and the emotional friction between them.",
    emptyCopy: "Start with protagonists, antagonistic forces, and any relationship that changes the story.",
    prompts: [
      {
        label: "Capture",
        copy: "Role in the story, what they want right now, and the pressure shaping their choices."
      },
      {
        label: "Watch for",
        copy: "Contradictions, secrets, leverage points, loyalties, and any relationship that can spark conflict."
      }
    ],
    fields: {
      title: {
        label: "Character name",
        placeholder: "Example: Mara Vale"
      },
      summary: {
        label: "Motivation and goals",
        placeholder: "Win back her family name, protect her brother, and prove she can lead"
      },
      anchor: {
        label: "Internal and external conflicts",
        placeholder: "Torn between loyalty and ambition while hunted by the council she betrayed"
      },
      detail: {
        label: "Character arc",
        placeholder: "Moves from self-protective control toward trust, sacrifice, and honest leadership"
      },
      notes: {
        label: "Notes",
        placeholder: "Voice, wounds, secrets, relationships, scene ideas, or anything else worth tracking"
      }
    }
  },
  locations: {
    label: "Locations",
    singular: "location",
    kicker: "Places with story weight",
    description: "Map where the story moves and what each place does to your characters.",
    navCopy: "Cities, rooms, landscapes, hidden spaces, and any setting that changes the tone or stakes.",
    emptyCopy: "Add the places that hold conflict, secrets, danger, memory, or status in your story.",
    prompts: [
      {
        label: "Capture",
        copy: "What the place is, why it matters, and what kind of scene energy it naturally creates."
      },
      {
        label: "Watch for",
        copy: "Sensory identity, social power, threat level, travel friction, and what characters gain or lose there."
      }
    ],
    fields: {
      title: {
        label: "Location name",
        placeholder: "Example: Glassmarket Docks"
      },
      summary: {
        label: "Story function",
        placeholder: "Black-market trade hub where alliances get tested"
      },
      anchor: {
        label: "Signature detail",
        placeholder: "Salt haze, lantern smoke, and the sound of chains in the fog"
      },
      notes: {
        label: "Notes",
        placeholder: "Mood, history, class signals, layout cues, hidden routes, or scene ideas"
      }
    }
  },
  glossary: {
    label: "Glossary",
    singular: "term",
    kicker: "Language and terminology",
    description: "Keep your invented terms, titles, slang, and recurring references consistent.",
    navCopy: "Story-specific vocabulary, institutions, ceremonial language, and recurring shorthand.",
    emptyCopy: "Start with terms that readers need to understand early or words that appear repeatedly.",
    prompts: [
      {
        label: "Capture",
        copy: "The term itself, what it means on the page, and when a reader needs that knowledge."
      },
      {
        label: "Watch for",
        copy: "Tone drift, repeated exposition, cultural nuance, and places where a term carries subtext."
      }
    ],
    fields: {
      title: {
        label: "Term",
        placeholder: "Example: Sunbinding"
      },
      summary: {
        label: "Meaning",
        placeholder: "A blood oath that locks one life to another"
      },
      anchor: {
        label: "Usage or nuance",
        placeholder: "Used reverently by priests, fearfully by common citizens"
      },
      notes: {
        label: "Notes",
        placeholder: "Pronunciation, related terms, context, or scenes where it first appears"
      }
    }
  },
  worldRules: {
    label: "World Rules",
    singular: "rule",
    kicker: "Systems and consequences",
    description: "Define the laws, limits, and costs that make the world feel believable.",
    navCopy: "Magic systems, political rules, social contracts, taboo boundaries, and hard constraints.",
    emptyCopy: "Add the rules readers need to trust, especially the ones that create consequences when broken.",
    prompts: [
      {
        label: "Capture",
        copy: "What the rule governs, where it applies, and what characters think it lets them get away with."
      },
      {
        label: "Watch for",
        copy: "Costs, loopholes, edge cases, enforcement, and what happens when someone defies it."
      }
    ],
    fields: {
      title: {
        label: "Rule or law",
        placeholder: "Example: No oath may be broken under moonlight"
      },
      summary: {
        label: "What it governs",
        placeholder: "All public vows made before the civic altar"
      },
      anchor: {
        label: "Consequence or cost",
        placeholder: "Breaking it leaves a visible brand and strips legal standing"
      },
      notes: {
        label: "Notes",
        placeholder: "Exceptions, enforcers, origin, social effect, or scene implications"
      }
    }
  },
  history: {
    label: "History",
    singular: "historical event",
    kicker: "Events that still echo",
    description: "Track the moments in the past that still shape power, fear, and identity in the present.",
    navCopy: "Wars, betrayals, reforms, disasters, inheritances, collapses, and regime shifts.",
    emptyCopy: "Add the historical events characters still reference, fear, or benefit from in the present story.",
    prompts: [
      {
        label: "Capture",
        copy: "The event, when it happened, and who still feels its effects now."
      },
      {
        label: "Watch for",
        copy: "Inherited trauma, propaganda, disputed memory, and how history changes who gets believed."
      }
    ],
    fields: {
      title: {
        label: "Event or era",
        placeholder: "Example: The Ashfall Accord"
      },
      summary: {
        label: "When or where",
        placeholder: "Forty years earlier, after the harbor fires"
      },
      anchor: {
        label: "Why it matters now",
        placeholder: "It still dictates trade law and who may inherit city titles"
      },
      notes: {
        label: "Notes",
        placeholder: "Witnesses, contested versions, emotional residue, or links to current conflict"
      }
    }
  },
  mythology: {
    label: "Mythology",
    singular: "myth",
    kicker: "Belief and symbolic meaning",
    description: "Track the stories people tell to explain the world, justify power, or survive fear.",
    navCopy: "Creation myths, saints, monsters, ritual stories, symbols, and inherited superstitions.",
    emptyCopy: "Add the beliefs that shape ritual, fear, morality, and the emotional logic of the world.",
    prompts: [
      {
        label: "Capture",
        copy: "What the myth says, what it symbolizes, and who takes it literally versus metaphorically."
      },
      {
        label: "Watch for",
        copy: "Ritual behavior, sacred imagery, false beliefs, and where mythology quietly drives plot choices."
      }
    ],
    fields: {
      title: {
        label: "Myth, figure, or belief",
        placeholder: "Example: The Lantern Mother"
      },
      summary: {
        label: "Meaning or story",
        placeholder: "A spirit said to guide the dead only if they die truthfully"
      },
      anchor: {
        label: "How it shapes belief",
        placeholder: "Families leave lamps burning to prove innocence to their ancestors"
      },
      notes: {
        label: "Notes",
        placeholder: "Symbols, rituals, contradictions, sect differences, or scenes tied to this belief"
      }
    }
  }
};

let editingPlotSectionId = PLOT_SECTION_IDS[0];
let editingPlotEntryId = null;

function plotSectionConfig(sectionId) {
  return PLOT_SECTION_CONFIG[sectionId] || PLOT_SECTION_CONFIG[PLOT_SECTION_IDS[0]];
}

function currentPlotSectionId(bundle) {
  const sectionId = bundle?.plot?.activeSection;
  return PLOT_SECTION_IDS.includes(sectionId) ? sectionId : PLOT_SECTION_IDS[0];
}

function plotEntriesForSection(bundle, sectionId) {
  return Array.isArray(bundle?.plot?.sections?.[sectionId]) ? bundle.plot.sections[sectionId] : [];
}

function renderPlotDashboard(bundle) {
  const view = document.getElementById("view-plot");
  if (!bundle) {
    view.innerHTML = renderWorkspaceEmptyState("Story");
    bindWorkspaceEmptyActions();
    return;
  }

  const activeSectionId = currentPlotSectionId(bundle);
  const activeSection = plotSectionConfig(activeSectionId);
  const activeEntries = plotEntriesForSection(bundle, activeSectionId);

  view.innerHTML = `
    <section class="stack">
      <section class="plot-workspace">
        <div class="plot-section-nav-wrap">
          <div hidden>
            <h3>Story Categories</h3>
          </div>
          <div class="plot-section-nav" role="group" aria-label="Story categories">
            ${PLOT_SECTION_IDS.map((sectionId) => renderPlotSectionTab(bundle, sectionId, activeSectionId)).join("")}
          </div>
        </div>

        <section class="card plot-section-detail" id="plot-section-panel" aria-labelledby="plot-tab-${activeSectionId}">
          <div class="section-head">
            <div>
              <p class="small-copy">${activeSection.kicker}</p>
              <h3>${activeSection.label}</h3>
              <p>${activeSection.description}</p>
            </div>
            <div class="meta-line">
              <button class="primary-btn" id="add-active-plot-entry-btn" type="button">${`Add ${activeSection.singular}`}</button>
            </div>
          </div>
          <div class="plot-entry-grid">
            ${activeEntries.length ? activeEntries.map((entry) => renderPlotEntryCard(activeSectionId, entry)).join("") : `
              <div class="empty plot-empty">
                <strong>${activeSection.label} are empty right now.</strong>
                <p>${activeSection.emptyCopy}</p>
              </div>
            `}
          </div>
        </section>
      </section>
    </section>
  `;

  bindPlotDashboardEvents(bundle);
}

function renderPlotSectionTab(bundle, sectionId, activeSectionId) {
  const config = plotSectionConfig(sectionId);
  const count = plotEntriesForSection(bundle, sectionId).length;
  return `
    <button
      class="plot-section-tab ${sectionId === activeSectionId ? "active" : ""}"
      id="plot-tab-${sectionId}"
      data-plot-section="${sectionId}"
      type="button"
      aria-pressed="${sectionId === activeSectionId ? "true" : "false"}"
      aria-controls="plot-section-panel"
    >
      <span class="plot-section-count">${formatNumber(count)}</span>
      <strong class="plot-section-title">${config.label}</strong>
    </button>
  `;
}

function renderPlotEntryCard(sectionId, entry) {
  const section = plotSectionConfig(sectionId);
  return `
    <article class="item plot-entry-card">
      <div class="item-top">
        <div>
          <h4>${escapeHtml(entry.title || "Untitled entry")}</h4>
        </div>
        <div class="goal-actions">
          <button class="icon-btn" type="button" data-action="edit-plot-entry" data-section-id="${sectionId}" data-id="${entry.id}" aria-label="Edit ${section.singular}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4"></path>
              <path d="M13.5 6.5l4 4"></path>
            </svg>
          </button>
          <button class="icon-btn" type="button" data-action="delete-plot-entry" data-section-id="${sectionId}" data-id="${entry.id}" aria-label="Delete ${section.singular}">
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
      <div class="plot-entry-copy">
        ${renderPlotEntryField(section.fields.summary, entry.summary)}
        ${renderPlotEntryField(section.fields.anchor, entry.anchor)}
        ${section.fields.detail ? renderPlotEntryField(section.fields.detail, entry.detail) : ""}
        ${entry.notes ? renderPlotEntryField(section.fields.notes, entry.notes, "plot-entry-note") : ""}
      </div>
    </article>
  `;
}

function renderPlotEntryField(field, value, className = "") {
  if (!field) return "";
  const classes = className ? ` class="${className}"` : "";
  return `<p${classes}><strong>${escapeHtml(field.label)}</strong> ${escapeHtml(value || "Not added yet")}</p>`;
}

function bindPlotDashboardEvents(bundle) {
  const activeSectionId = currentPlotSectionId(bundle);
  const openButtons = [document.getElementById("add-active-plot-entry-btn")].filter(Boolean);

  openButtons.forEach((button) => {
    button.onclick = () => {
      openPlotEntryModal(activeSectionId);
    };
  });

  document.querySelectorAll("[data-plot-section]").forEach((button) => {
    button.onclick = () => {
      const sectionId = button.dataset.plotSection;
      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        plot: {
          ...projectBundle.plot,
          activeSection: sectionId
        }
      }));
      saveState();
      render();
    };
  });

  document.querySelectorAll("[data-action='edit-plot-entry']").forEach((button) => {
    button.onclick = () => {
      openPlotEntryModal(button.dataset.sectionId, button.dataset.id);
    };
  });

  document.querySelectorAll("[data-action='delete-plot-entry']").forEach((button) => {
    button.onclick = () => {
      const sectionId = button.dataset.sectionId;
      const entryId = button.dataset.id;
      const section = plotSectionConfig(sectionId);
      updateCurrentBundle((projectBundle) => ({
        ...projectBundle,
        plot: {
          ...projectBundle.plot,
          sections: {
            ...projectBundle.plot.sections,
            [sectionId]: projectBundle.plot.sections[sectionId].filter((entry) => entry.id !== entryId)
          }
        }
      }));
      persistAndRender();
      showToast(`${section.label} updated`, `That ${section.singular} was removed from the story atlas.`);
    };
  });

  bindPlotEntryModal();
}

function bindPlotEntryModal() {
  const modal = document.getElementById("plot-entry-modal");
  const closeButton = document.getElementById("close-plot-entry-modal-btn");
  const form = document.getElementById("plot-entry-form");

  if (closeButton) {
    closeButton.onclick = () => {
      closePlotEntryModal();
    };
  }

  if (modal) {
    modal.onclick = (event) => {
      if (event.target === modal) closePlotEntryModal();
    };
  }

  if (form) {
    form.onsubmit = (event) => {
      event.preventDefault();
      const bundle = currentBundle();
      if (!bundle) return;
      const sectionId = editingPlotSectionId || currentPlotSectionId(bundle);
      const config = plotSectionConfig(sectionId);
      const formData = new FormData(form);
      const entry = normalizePlotEntry({
        id: editingPlotEntryId || createId(),
        title: String(formData.get("title") || "").trim(),
        summary: String(formData.get("summary") || "").trim(),
        anchor: String(formData.get("anchor") || "").trim(),
        detail: String(formData.get("detail") || "").trim(),
        notes: String(formData.get("notes") || "").trim(),
        updatedAt: new Date().toISOString()
      });

      if (!entry.title) {
        form.elements.title.reportValidity();
        return;
      }

      updateCurrentBundle((projectBundle) => {
        const existingEntries = projectBundle.plot.sections[sectionId];
        const nextEntries = editingPlotEntryId
          ? existingEntries.map((item) => item.id === editingPlotEntryId ? entry : item)
          : [entry, ...existingEntries];

        return {
          ...projectBundle,
          plot: {
            ...projectBundle.plot,
            activeSection: sectionId,
            sections: {
              ...projectBundle.plot.sections,
              [sectionId]: nextEntries
            }
          }
        };
      });

      closePlotEntryModal();
      persistAndRender();
      showToast(
        editingPlotEntryId ? `${config.label} updated` : `${config.label} added`,
        editingPlotEntryId
          ? `Your ${config.singular} reference was saved in the story atlas.`
          : `A new ${config.singular} was added to the story atlas.`
      );
    };
  }
}

function openPlotEntryModal(sectionId = currentPlotSectionId(currentBundle()), entryId = null) {
  const bundle = currentBundle();
  const modal = document.getElementById("plot-entry-modal");
  const form = document.getElementById("plot-entry-form");
  if (!bundle || !modal || !form) return;

  const config = plotSectionConfig(sectionId);
  const existingEntry = entryId
    ? plotEntriesForSection(bundle, sectionId).find((entry) => entry.id === entryId)
    : null;

  editingPlotSectionId = sectionId;
  editingPlotEntryId = entryId;

  document.getElementById("plot-entry-modal-title").textContent = existingEntry
    ? `Edit ${config.singular}`
    : `Add ${config.singular}`;
  document.getElementById("plot-entry-modal-copy").textContent = existingEntry
    ? `Refine this ${config.singular} so your story notes stay sharp and searchable.`
    : `Capture a ${config.singular} now so your story logic stays clear as the manuscript expands.`;
  document.getElementById("plot-entry-section-copy").textContent = `${config.label} stay visible from the Story workspace at any time.`;
  document.getElementById("plot-entry-title-label").textContent = config.fields.title.label;
  document.getElementById("plot-entry-summary-label").textContent = config.fields.summary.label;
  document.getElementById("plot-entry-anchor-label").textContent = config.fields.anchor.label;
  const detailField = document.getElementById("plot-entry-detail-field");
  const detailLabel = document.getElementById("plot-entry-detail-label");
  document.getElementById("plot-entry-notes-label").textContent = config.fields.notes.label;
  document.getElementById("plot-entry-submit-btn").textContent = existingEntry ? "Save changes" : `Save ${config.singular}`;

  form.reset();
  form.elements.title.placeholder = config.fields.title.placeholder;
  form.elements.summary.placeholder = config.fields.summary.placeholder;
  form.elements.anchor.placeholder = config.fields.anchor.placeholder;
  if (config.fields.detail && detailField && detailLabel) {
    detailField.classList.remove("hidden");
    detailLabel.textContent = config.fields.detail.label;
    form.elements.detail.placeholder = config.fields.detail.placeholder;
    form.elements.detail.value = existingEntry?.detail || "";
  } else if (detailField) {
    detailField.classList.add("hidden");
    form.elements.detail.value = "";
    form.elements.detail.placeholder = "";
  }
  form.elements.notes.placeholder = config.fields.notes.placeholder;
  form.elements.title.value = existingEntry?.title || "";
  form.elements.summary.value = existingEntry?.summary || "";
  form.elements.anchor.value = existingEntry?.anchor || "";
  form.elements.notes.value = existingEntry?.notes || "";

  modal.classList.remove("hidden");
}

function closePlotEntryModal() {
  const modal = document.getElementById("plot-entry-modal");
  const form = document.getElementById("plot-entry-form");
  form?.reset();
  editingPlotEntryId = null;
  editingPlotSectionId = PLOT_SECTION_IDS[0];
  modal?.classList.add("hidden");
}
