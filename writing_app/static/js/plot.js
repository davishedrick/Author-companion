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
  },
  premise: {
    label: "Premise",
    singular: "premise note",
    kicker: "Core promise",
    description: "Clarify the central story engine, reader promise, and the question the manuscript keeps testing.",
    navCopy: "Hooks, loglines, central questions, promises, and the story's core pressure.",
    emptyCopy: "Add the premise, promise, or core dramatic question that helps every other choice stay aligned.",
    prompts: [
      {
        label: "Capture",
        copy: "The situation, the pressure, and why this story needs to be told now."
      },
      {
        label: "Watch for",
        copy: "Promises the opening makes, genre expectations, and where the manuscript drifts from its center."
      }
    ],
    fields: {
      title: {
        label: "Premise title",
        placeholder: "Example: A reluctant heir must bargain with the empire she plans to burn"
      },
      summary: {
        label: "Core promise",
        placeholder: "Political fantasy about loyalty, inheritance, and the cost of impossible bargains"
      },
      anchor: {
        label: "Central question",
        placeholder: "Can Mara save her brother without becoming the ruler she hates?"
      },
      detail: {
        label: "Genre or reader expectation",
        placeholder: "Court intrigue, escalating betrayals, and a morally expensive victory"
      },
      notes: {
        label: "Notes",
        placeholder: "Alternate loglines, market comps, tonal guardrails, or themes to protect"
      }
    }
  },
  themes: {
    label: "Themes",
    singular: "theme",
    kicker: "Meaning and resonance",
    description: "Track the ideas, arguments, and emotional patterns the manuscript keeps returning to.",
    navCopy: "Recurring questions, moral tensions, motifs, symbols, and emotional arguments.",
    emptyCopy: "Add the ideas or questions you want the reader to feel building under the plot.",
    prompts: [
      {
        label: "Capture",
        copy: "The theme, where it appears, and what tension makes it interesting."
      },
      {
        label: "Watch for",
        copy: "Scenes that repeat the idea too plainly or miss a chance to complicate it."
      }
    ],
    fields: {
      title: {
        label: "Theme",
        placeholder: "Example: Freedom always asks for collateral"
      },
      summary: {
        label: "Meaning",
        placeholder: "Every escape creates an obligation to someone left behind"
      },
      anchor: {
        label: "Where it appears",
        placeholder: "Mara's bargains, her brother's captivity, and the dockworker uprising"
      },
      notes: {
        label: "Notes",
        placeholder: "Motifs, symbols, reversals, or scenes that carry this idea"
      }
    }
  },
  timeline: {
    label: "Timeline",
    singular: "timeline event",
    kicker: "Sequence and causality",
    description: "Track when events happen so cause, consequence, memory, and pacing stay coherent.",
    navCopy: "Backstory, present action, deadlines, reveals, flashbacks, and chronology checks.",
    emptyCopy: "Add events that anchor the order of the story or explain why pressure arrives when it does.",
    prompts: [
      {
        label: "Capture",
        copy: "What happened, when it happened, and what it caused."
      },
      {
        label: "Watch for",
        copy: "Contradictory dates, impossible travel, forgotten deadlines, and reveals arriving too early."
      }
    ],
    fields: {
      title: {
        label: "Event",
        placeholder: "Example: The harbor gates close"
      },
      summary: {
        label: "When",
        placeholder: "Night three, two hours before the coronation vote"
      },
      anchor: {
        label: "Cause or consequence",
        placeholder: "Traps the rebels inside the city and exposes Mara's stolen pass"
      },
      notes: {
        label: "Notes",
        placeholder: "Dependencies, continuity risks, calendar notes, or related scenes"
      }
    }
  },
  plotThreads: {
    label: "Plot Threads",
    singular: "plot thread",
    kicker: "Open loops",
    description: "Track promises, mysteries, subplots, and payoffs so nothing important disappears.",
    navCopy: "Subplots, reveals, clues, mysteries, emotional threads, and delayed payoffs.",
    emptyCopy: "Add a thread when the story opens a loop you will need to develop or resolve later.",
    prompts: [
      {
        label: "Capture",
        copy: "What is opened, who notices it, and what resolution would satisfy the reader."
      },
      {
        label: "Watch for",
        copy: "Threads that vanish, resolve too neatly, or need a stronger escalation beat."
      }
    ],
    fields: {
      title: {
        label: "Thread",
        placeholder: "Example: Who paid for the assassination attempt?"
      },
      summary: {
        label: "Current state",
        placeholder: "Opened in chapter four, suspected by Mara, hidden from the council"
      },
      anchor: {
        label: "Payoff or next beat",
        placeholder: "Reveal the sponsor through the burned ledger in act three"
      },
      notes: {
        label: "Notes",
        placeholder: "Clues, red herrings, emotional stakes, or places to reinforce the thread"
      }
    }
  },
  scenes: {
    label: "Scenes",
    singular: "scene",
    kicker: "Scene inventory",
    description: "Track planned, drafted, or missing scenes and the job each scene needs to do.",
    navCopy: "Scene ideas, set pieces, missing bridges, emotional turns, and revision targets.",
    emptyCopy: "Add scenes that need a clear purpose before drafting or revision.",
    prompts: [
      {
        label: "Capture",
        copy: "The scene's purpose, conflict, turn, and where it belongs."
      },
      {
        label: "Watch for",
        copy: "Scenes with no turn, repeated beats, or bridges that exist only to move people around."
      }
    ],
    fields: {
      title: {
        label: "Scene title",
        placeholder: "Example: Mara steals the council seal"
      },
      summary: {
        label: "Scene purpose",
        placeholder: "Force Mara to choose speed over secrecy"
      },
      anchor: {
        label: "Turn or outcome",
        placeholder: "She succeeds, but exposes her brother's location"
      },
      detail: {
        label: "Placement",
        placeholder: "Act two midpoint, after the docks betrayal"
      },
      notes: {
        label: "Notes",
        placeholder: "Sensory cues, conflict notes, missing setup, or revision concerns"
      }
    }
  },
  relationships: {
    label: "Relationships",
    singular: "relationship",
    kicker: "Connection and friction",
    description: "Track relationship arcs, alliances, betrayals, power imbalances, and emotional debt.",
    navCopy: "Romance, family, rivalry, mentorship, alliances, betrayals, and shifting trust.",
    emptyCopy: "Add relationships that change the story because trust, need, or history keeps moving.",
    prompts: [
      {
        label: "Capture",
        copy: "Who is connected, what each person wants, and what makes the bond unstable."
      },
      {
        label: "Watch for",
        copy: "Relationships that stay static, change without evidence, or need sharper turning points."
      }
    ],
    fields: {
      title: {
        label: "Relationship",
        placeholder: "Example: Mara and Iven"
      },
      summary: {
        label: "Current dynamic",
        placeholder: "Protective siblings split by ambition, guilt, and political leverage"
      },
      anchor: {
        label: "Pressure point",
        placeholder: "Iven knows Mara caused the raid that captured him"
      },
      detail: {
        label: "Arc",
        placeholder: "From rescue fantasy to honest accountability"
      },
      notes: {
        label: "Notes",
        placeholder: "History, wounds, secrets, intimacy beats, or betrayal points"
      }
    }
  },
  cultures: {
    label: "Cultures",
    singular: "culture note",
    kicker: "Customs and social texture",
    description: "Track social practices, values, customs, taboos, class signals, and daily life.",
    navCopy: "Customs, food, etiquette, institutions, class behavior, dialect, and social expectations.",
    emptyCopy: "Add cultural details that shape how characters behave, judge, celebrate, or hide.",
    prompts: [
      {
        label: "Capture",
        copy: "What the custom is, who follows it, and what it reveals."
      },
      {
        label: "Watch for",
        copy: "Details that feel decorative but do not affect choices, conflict, or belonging."
      }
    ],
    fields: {
      title: {
        label: "Custom or social detail",
        placeholder: "Example: Salt-bread mourning"
      },
      summary: {
        label: "Meaning",
        placeholder: "Families share salted bread before naming the dead"
      },
      anchor: {
        label: "Story effect",
        placeholder: "Mara refuses the rite and publicly rejects her father's faction"
      },
      notes: {
        label: "Notes",
        placeholder: "Class differences, regional versions, sensory details, or scene uses"
      }
    }
  },
  magicSystems: {
    label: "Magic Systems",
    singular: "magic rule",
    kicker: "Power with limits",
    description: "Track abilities, costs, limits, loopholes, training, and consequences.",
    navCopy: "Magic, powers, rituals, supernatural rules, costs, exceptions, and failure modes.",
    emptyCopy: "Add magical or supernatural rules that need consistency and real consequence.",
    prompts: [
      {
        label: "Capture",
        copy: "What the power does, what it costs, and what it cannot do."
      },
      {
        label: "Watch for",
        copy: "Convenient exceptions, missing costs, unclear limits, and abilities that solve too much."
      }
    ],
    fields: {
      title: {
        label: "Power or rule",
        placeholder: "Example: Oathfire burns only spoken lies"
      },
      summary: {
        label: "Limit",
        placeholder: "It reveals intent, but cannot prove facts the speaker believes are true"
      },
      anchor: {
        label: "Cost or consequence",
        placeholder: "Each use scars the speaker's tongue and shortens their voice"
      },
      notes: {
        label: "Notes",
        placeholder: "Training, loopholes, visuals, cultural attitudes, or plot risks"
      }
    }
  },
  technology: {
    label: "Technology",
    singular: "technology note",
    kicker: "Tools and constraints",
    description: "Track inventions, devices, systems, resources, and technical limits.",
    navCopy: "Devices, weapons, infrastructure, communication, transport, science, and constraints.",
    emptyCopy: "Add technology or practical systems that shape what characters can do.",
    prompts: [
      {
        label: "Capture",
        copy: "What it does, who has access, and what limitation creates story pressure."
      },
      {
        label: "Watch for",
        copy: "Tools that become too convenient, inconsistent access, or missing maintenance costs."
      }
    ],
    fields: {
      title: {
        label: "Technology",
        placeholder: "Example: Signal-glass relays"
      },
      summary: {
        label: "Function",
        placeholder: "Transmit coded flashes between towers across the harbor"
      },
      anchor: {
        label: "Limit or access",
        placeholder: "Only licensed guild operators can read the full code"
      },
      notes: {
        label: "Notes",
        placeholder: "Materials, failures, operators, cost, or scene implications"
      }
    }
  },
  research: {
    label: "Research",
    singular: "research note",
    kicker: "Facts and references",
    description: "Track factual references, sources, questions, and accuracy checks.",
    navCopy: "Research notes, source links, fact checks, expert questions, and realism constraints.",
    emptyCopy: "Add research notes when a factual choice needs evidence or later verification.",
    prompts: [
      {
        label: "Capture",
        copy: "The fact, source, uncertainty, and where it affects the manuscript."
      },
      {
        label: "Watch for",
        copy: "Unsupported assumptions, outdated references, and places where a fact changes story logic."
      }
    ],
    fields: {
      title: {
        label: "Research topic",
        placeholder: "Example: 1890s harbor quarantine procedure"
      },
      summary: {
        label: "Known fact",
        placeholder: "Ships waited outside port until health officers cleared the manifest"
      },
      anchor: {
        label: "Source or use",
        placeholder: "Used in chapter seven during the plague inspection"
      },
      detail: {
        label: "Open question",
        placeholder: "Confirm whether private cargo could be inspected before passengers"
      },
      notes: {
        label: "Notes",
        placeholder: "Source links, citations, expert contacts, or decisions made"
      }
    }
  },
  memoirPeople: {
    label: "Memoir People",
    singular: "person",
    kicker: "Real people and boundaries",
    description: "Track real people, composite characters, privacy boundaries, and emotional context.",
    navCopy: "Family, friends, mentors, antagonists, composites, consent notes, and privacy concerns.",
    emptyCopy: "Add people whose role, boundaries, or emotional context matters to the manuscript.",
    prompts: [
      {
        label: "Capture",
        copy: "Who they are, why they matter, and what boundary or truth needs care."
      },
      {
        label: "Watch for",
        copy: "Unclear consent, flattened complexity, avoidant scenes, and places where truth needs precision."
      }
    ],
    fields: {
      title: {
        label: "Person or composite",
        placeholder: "Example: Aunt L."
      },
      summary: {
        label: "Role in the story",
        placeholder: "Caretaker, witness, and the first person to name what was happening"
      },
      anchor: {
        label: "Boundary or sensitivity",
        placeholder: "Use initials and avoid identifying workplace details"
      },
      detail: {
        label: "Arc or emotional function",
        placeholder: "Represents safety before becoming a source of complicated grief"
      },
      notes: {
        label: "Notes",
        placeholder: "Consent, composites, privacy decisions, scene memories, or fact checks"
      }
    }
  },
  memories: {
    label: "Memories",
    singular: "memory",
    kicker: "Lived moments",
    description: "Track remembered moments, sensory anchors, emotional turns, and memoir scene seeds.",
    navCopy: "Memoir scenes, sensory fragments, formative moments, flashbacks, and emotional evidence.",
    emptyCopy: "Add memories that might become scenes or explain why an event still matters.",
    prompts: [
      {
        label: "Capture",
        copy: "What happened, what you remember physically, and what changed afterward."
      },
      {
        label: "Watch for",
        copy: "Beautiful fragments that need context, missing causality, or memories carrying too much at once."
      }
    ],
    fields: {
      title: {
        label: "Memory",
        placeholder: "Example: The blue kitchen after the storm"
      },
      summary: {
        label: "What happened",
        placeholder: "We waited by candlelight while the ceiling leaked into mixing bowls"
      },
      anchor: {
        label: "Sensory anchor",
        placeholder: "Wet plaster, metal bowls, and the smell of gas from the stove"
      },
      detail: {
        label: "Why it matters",
        placeholder: "The first time I understood adults could be afraid and still act calm"
      },
      notes: {
        label: "Notes",
        placeholder: "Timeline, people present, emotional residue, or scenes it connects to"
      }
    }
  },
  objects: {
    label: "Objects",
    singular: "object",
    kicker: "Meaningful things",
    description: "Track objects, artifacts, documents, heirlooms, clues, and recurring symbols.",
    navCopy: "Artifacts, props, letters, heirlooms, evidence, symbols, and objects with emotional weight.",
    emptyCopy: "Add objects that carry meaning, trigger action, or need continuity tracking.",
    prompts: [
      {
        label: "Capture",
        copy: "What the object is, who controls it, and what meaning it gathers."
      },
      {
        label: "Watch for",
        copy: "Objects that vanish, change hands unclearly, or become symbolic without enough grounding."
      }
    ],
    fields: {
      title: {
        label: "Object",
        placeholder: "Example: The cracked ivory compass"
      },
      summary: {
        label: "Meaning or function",
        placeholder: "A family heirloom that points toward debts instead of north"
      },
      anchor: {
        label: "Who has it",
        placeholder: "Mara steals it from Iven before the harbor escape"
      },
      notes: {
        label: "Notes",
        placeholder: "Continuity, symbolism, chain of custody, or scenes where it appears"
      }
    }
  },
  questions: {
    label: "Questions",
    singular: "open question",
    kicker: "Decisions to resolve",
    description: "Track unresolved craft, continuity, research, and story logic questions.",
    navCopy: "Open decisions, continuity questions, research unknowns, and revision puzzles.",
    emptyCopy: "Add questions that should stay visible until the manuscript gives you an answer.",
    prompts: [
      {
        label: "Capture",
        copy: "The question, what depends on it, and what kind of answer would unlock progress."
      },
      {
        label: "Watch for",
        copy: "Questions that hide bigger structural issues or decisions you keep postponing."
      }
    ],
    fields: {
      title: {
        label: "Question",
        placeholder: "Example: Why does the council spare Iven?"
      },
      summary: {
        label: "What depends on it",
        placeholder: "Mara's midpoint choice and the credibility of the council's threat"
      },
      anchor: {
        label: "Possible answer",
        placeholder: "They need his bloodline to legitimize the vote"
      },
      notes: {
        label: "Notes",
        placeholder: "Options, risks, related scenes, or what to test in revision"
      }
    }
  }
};

let editingPlotSectionId = PLOT_SECTION_IDS[0];
let editingPlotEntryId = null;

function plotSectionConfig(sectionId) {
  return PLOT_SECTION_CONFIG[sectionId] || PLOT_SECTION_CONFIG[PLOT_SECTION_IDS[0]];
}

function activePlotSectionIds(bundle) {
  const activeSections = Array.isArray(bundle?.plot?.activeSections)
    ? bundle.plot.activeSections
    : DEFAULT_PLOT_SECTION_IDS;
  const normalizedSections = [...new Set(activeSections)].filter((sectionId) => PLOT_SECTION_IDS.includes(sectionId));
  return normalizedSections.length ? normalizedSections : [...DEFAULT_PLOT_SECTION_IDS];
}

function inactivePlotSectionIds(bundle) {
  const activeSections = activePlotSectionIds(bundle);
  return PLOT_SECTION_IDS.filter((sectionId) => !activeSections.includes(sectionId));
}

function plotArchivedSectionIds(bundle) {
  return inactivePlotSectionIds(bundle).filter((sectionId) => plotEntriesForSection(bundle, sectionId).length > 0);
}

const PLOT_TAB_PICKER_GROUPS = [
  {
    label: "Story Core",
    sectionIds: ["characters", "relationships", "premise", "themes", "plotThreads", "scenes"]
  },
  {
    label: "World",
    sectionIds: ["locations", "worldRules", "history", "mythology", "cultures", "objects"]
  },
  {
    label: "Systems and Reference",
    sectionIds: ["glossary", "timeline", "magicSystems", "technology", "research", "questions"]
  },
  {
    label: "Memoir",
    sectionIds: ["memoirPeople", "memories"]
  }
];

function currentPlotSectionId(bundle) {
  const sectionId = bundle?.plot?.activeSection;
  const activeSections = activePlotSectionIds(bundle);
  return activeSections.includes(sectionId) ? sectionId : activeSections[0];
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
  const activeSectionIds = activePlotSectionIds(bundle);
  const activeSection = plotSectionConfig(activeSectionId);
  const activeEntries = plotEntriesForSection(bundle, activeSectionId);
  const inactiveSectionIds = inactivePlotSectionIds(bundle);

  view.innerHTML = `
    <section class="stack">
      <section class="plot-workspace">
        <div class="plot-section-nav-wrap">
          <div hidden>
            <h3>Story Categories</h3>
          </div>
          <div class="plot-section-nav" role="group" aria-label="Story categories">
            <button
              class="plot-add-tab-btn"
              id="open-plot-tab-modal-btn"
              type="button"
              aria-label="Add Story tab"
              ${inactiveSectionIds.length ? "" : "disabled"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </button>
            ${activeSectionIds.map((sectionId) => renderPlotSectionTab(bundle, sectionId, activeSectionId)).join("")}
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
          <div class="plot-section-utility">
            <button class="plot-remove-tab-link" id="remove-active-plot-section-btn" type="button" ${activeSectionIds.length <= 1 ? "disabled" : ""} title="Content stays saved if this tab is added back later">
              <span class="sidebar-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 7h14"></path>
                  <path d="M9 7V4h6v3"></path>
                  <path d="M8 7l1 12h6l1-12"></path>
                  <path d="M10 11v5"></path>
                  <path d="M14 11v5"></path>
                </svg>
              </span>
              <span>Remove tab</span>
            </button>
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
  const openTabModalButton = document.getElementById("open-plot-tab-modal-btn");
  const removeSectionButton = document.getElementById("remove-active-plot-section-btn");

  openButtons.forEach((button) => {
    button.onclick = () => {
      openPlotEntryModal(activeSectionId);
    };
  });

  if (openTabModalButton) {
    openTabModalButton.onclick = () => {
      openPlotTabModal();
    };
  }

  if (removeSectionButton) {
    removeSectionButton.onclick = () => {
      removePlotSection(activeSectionId);
    };
  }

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
  bindPlotTabModal();
}

function selectedPlotTabIds() {
  return Array.from(document.querySelectorAll("[data-plot-tab-choice].is-selected"))
    .map((button) => button.dataset.plotTabChoice)
    .filter(Boolean);
}

function renderPlotTabChoices(bundle) {
  const inactiveSectionIds = inactivePlotSectionIds(bundle);
  if (!inactiveSectionIds.length) {
    return `<p class="plot-tab-picker-empty">All Story tabs are active.</p>`;
  }
  const inactiveSectionSet = new Set(inactiveSectionIds);
  const orderedSectionIds = PLOT_TAB_PICKER_GROUPS.flatMap((group) => group.sectionIds)
    .filter((sectionId) => inactiveSectionSet.has(sectionId));
  const remainingSectionIds = inactiveSectionIds.filter((sectionId) => !orderedSectionIds.includes(sectionId));
  return [...orderedSectionIds, ...remainingSectionIds]
    .map((sectionId) => renderPlotTabChoice(bundle, sectionId))
    .join("");
}

function renderPlotTabChoice(bundle, sectionId) {
  const config = plotSectionConfig(sectionId);
  return `
    <button
      class="plot-tab-choice"
      type="button"
      data-plot-tab-choice="${escapeAttr(sectionId)}"
      aria-pressed="false"
    >
      <span>${escapeHtml(config.label)}</span>
    </button>
  `;
}

function syncPlotTabModalState() {
  const bundle = currentBundle();
  const copy = document.getElementById("plot-tab-saved-copy");
  const submitButton = document.getElementById("plot-tab-submit-btn");
  if (!bundle || !copy || !submitButton) return;
  const sectionIds = selectedPlotTabIds();
  submitButton.disabled = !sectionIds.length;
  if (!sectionIds.length) {
    const inactiveCount = inactivePlotSectionIds(bundle).length;
    const archivedSectionCount = plotArchivedSectionIds(bundle).length;
    if (!inactiveCount) {
      copy.textContent = "All Story tabs are already active.";
      return;
    }
    copy.textContent = archivedSectionCount
      ? `${formatNumber(archivedSectionCount)} hidden ${archivedSectionCount === 1 ? "tab has" : "tabs have"} saved content.`
      : "Pick one or more tabs to add them to the Story workspace.";
    return;
  }
  const savedEntryCount = sectionIds.reduce((total, sectionId) => total + plotEntriesForSection(bundle, sectionId).length, 0);
  if (savedEntryCount) {
    copy.textContent = `${formatNumber(savedEntryCount)} saved ${savedEntryCount === 1 ? "entry" : "entries"} will return across ${formatNumber(sectionIds.length)} selected ${sectionIds.length === 1 ? "tab" : "tabs"}.`;
    return;
  }
  if (sectionIds.length === 1) {
    copy.textContent = plotSectionConfig(sectionIds[0]).navCopy;
    return;
  }
  copy.textContent = `${formatNumber(sectionIds.length)} Story tabs selected. Add them together when you're ready.`;
}

function bindPlotTabChoices() {
  document.querySelectorAll("[data-plot-tab-choice]").forEach((button) => {
    button.onclick = () => {
      const isSelected = !button.classList.contains("is-selected");
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
      syncPlotTabModalState();
    };
  });
}

function openPlotTabModal() {
  const bundle = currentBundle();
  const modal = document.getElementById("plot-tab-modal");
  const form = document.getElementById("plot-tab-form");
  const picker = document.getElementById("plot-tab-picker");
  if (!bundle || !modal || !form || !picker) return;
  form.reset();
  picker.innerHTML = renderPlotTabChoices(bundle);
  bindPlotTabChoices();
  document.getElementById("plot-tab-submit-btn").disabled = true;
  syncPlotTabModalState();
  modal.classList.remove("hidden");
}

function closePlotTabModal() {
  const modal = document.getElementById("plot-tab-modal");
  const form = document.getElementById("plot-tab-form");
  form?.reset();
  modal?.classList.add("hidden");
}

function bindPlotTabModal() {
  const modal = document.getElementById("plot-tab-modal");
  const closeButton = document.getElementById("close-plot-tab-modal-btn");
  const form = document.getElementById("plot-tab-form");

  if (closeButton) {
    closeButton.onclick = () => {
      closePlotTabModal();
    };
  }
  if (modal) {
    modal.onclick = (event) => {
      if (event.target === modal) closePlotTabModal();
    };
  }
  if (form) {
    form.onsubmit = (event) => {
      event.preventDefault();
      const sectionIds = selectedPlotTabIds();
      if (!sectionIds.length) {
        syncPlotTabModalState();
        return;
      }
      closePlotTabModal();
      addPlotSections(sectionIds);
    };
  }
}

function addPlotSection(sectionId) {
  addPlotSections([sectionId]);
}

function addPlotSections(sectionIds) {
  const validSectionIds = [...new Set(sectionIds)].filter((sectionId) => PLOT_SECTION_IDS.includes(sectionId));
  if (!validSectionIds.length) return;
  const finalSectionId = validSectionIds[validSectionIds.length - 1];
  updateCurrentBundle((projectBundle) => {
    const activeSections = activePlotSectionIds(projectBundle);
    const nextActiveSections = [
      ...activeSections,
      ...validSectionIds.filter((sectionId) => !activeSections.includes(sectionId))
    ];
    const nextSections = { ...projectBundle.plot.sections };
    validSectionIds.forEach((sectionId) => {
      nextSections[sectionId] = projectBundle.plot.sections?.[sectionId] || [];
    });
    return {
      ...projectBundle,
      plot: {
        ...projectBundle.plot,
        activeSection: finalSectionId,
        activeSections: nextActiveSections,
        sections: nextSections
      }
    };
  });
  persistAndRender();
  if (validSectionIds.length === 1) {
    const config = plotSectionConfig(validSectionIds[0]);
    showToast(`${config.label} added`, `That Story tab is active again. Any saved ${config.singular} entries are still here.`);
    return;
  }
  showToast(`${formatNumber(validSectionIds.length)} tabs added`, "Those Story tabs are active again. Any saved entries are still here.");
}

function removePlotSection(sectionId) {
  const bundle = currentBundle();
  const activeSections = activePlotSectionIds(bundle);
  if (activeSections.length <= 1) {
    showToast("Keep one Story tab", "The Story workspace needs at least one active category.");
    return;
  }
  if (!activeSections.includes(sectionId)) return;
  const config = plotSectionConfig(sectionId);
  const nextActiveSections = activeSections.filter((activeSectionId) => activeSectionId !== sectionId);
  const nextActiveSection = nextActiveSections[0];
  updateCurrentBundle((projectBundle) => ({
    ...projectBundle,
    plot: {
      ...projectBundle.plot,
      activeSection: nextActiveSection,
      activeSections: nextActiveSections
    }
  }));
  persistAndRender();
  showToast(`${config.label} hidden`, `This tab was removed from view, but its content stays saved and will return if you add it back.`);
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
