// Leonida Trophy Guide — tracker logic for the 55 GTA VI PlayStation 5 trophies.
// Vanilla JS, no libraries. All data comes from local JSON files under app/data/.
// Progress and settings live in localStorage under one key; nothing leaves the browser.

const STORAGE_KEY = "gta6-trophy-guide-v1";
const GRADE_ORDER = ["Platinum", "Gold", "Silver", "Bronze"];
const KIND_LABELS = {
  all: "All",
  story: "Story",
  missable: "Missable",
  collectibles: "Collectibles",
  activities: "Activities",
  completion: "Completion",
  online: "Online",
};
const DEMO_EARNED = [
  "just-like-paradise",
  "paradise-lost",
  "trust",
  "cunning-stunts",
  "master-of-none",
  "stick-fiddler",
  "baited-my-tackle",
  "whip-it-good",
  "treat-yo-self",
  "personal-best",
  "actions-speak-louder",
  "the-goodtime-state",
];

let trophies = [];
let roadmap = null;
let byId = new Map();

const state = {
  earned: new Set(),
  spoilers: true,
  kind: "all",
  grade: "",
  search: "",
  hideEarned: false,
  sort: "guide",
  selected: null,
  view: "trophies",
};

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ---------- persistence ----------

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.earned)) {
      state.earned = new Set(data.earned.filter((id) => typeof id === "string"));
    }
    if (typeof data.spoilers === "boolean") state.spoilers = data.spoilers;
  } catch (err) {
    // A corrupt save must never break the guide; start clean.
    console.warn("Could not read saved progress:", err);
  }
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ app: "gta6-trophy-guide", earned: [...state.earned].sort(), spoilers: state.spoilers })
    );
  } catch (err) {
    console.warn("Could not save progress:", err);
  }
}

// ---------- data ----------

async function loadData() {
  const [trophyRes, roadmapRes] = await Promise.all([
    fetch("data/trophies.json"),
    fetch("data/roadmap.json"),
  ]);
  if (!trophyRes.ok) throw new Error("Could not load data/trophies.json");
  if (!roadmapRes.ok) throw new Error("Could not load data/roadmap.json");
  const trophyDoc = await trophyRes.json();
  roadmap = await roadmapRes.json();
  trophies = trophyDoc.trophies;
  byId = new Map(trophies.map((t) => [t.id, t]));
}

// ---------- derived ----------

function isMasked(t) {
  return state.spoilers && t.hidden && !state.earned.has(t.id);
}

function displayName(t) {
  return isMasked(t) ? "Hidden Trophy" : t.name;
}

function displayDesc(t) {
  return isMasked(t) ? "Earn this trophy to reveal its name and description." : t.description;
}

function kindMatches(t) {
  if (state.kind === "all") return true;
  if (state.kind === "missable") return t.missable === true;
  if (state.kind === "online") return false;
  return t.kind.includes(state.kind);
}

function filteredTrophies() {
  const q = state.search.trim().toLowerCase();
  let list = trophies.filter((t) => {
    if (!kindMatches(t)) return false;
    if (state.grade && t.grade !== state.grade) return false;
    if (state.hideEarned && state.earned.has(t.id)) return false;
    if (q) {
      const hay = (t.name + " " + t.description + " " + t.guide).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (state.sort === "name") {
    list = [...list].sort((a, b) => displayName(a).localeCompare(displayName(b)));
  } else if (state.sort === "grade") {
    list = [...list].sort(
      (a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade) || a.name.localeCompare(b.name)
    );
  }
  return list;
}

// ---------- render: header ----------

function renderProgress() {
  const earned = state.earned.size;
  const total = trophies.length;
  const pct = total ? Math.round((earned / total) * 100) : 0;
  $("#progress-text").textContent = earned + " / " + total + " earned";
  $("#progress-pct").textContent = pct + "%";
  const fill = $("#progress-fill");
  fill.style.width = pct + "%";
  $("#progress-bar").setAttribute("aria-valuenow", String(earned));
  const parts = GRADE_ORDER.map((g) => {
    const got = trophies.filter((t) => t.grade === g && state.earned.has(t.id)).length;
    const all = trophies.filter((t) => t.grade === g).length;
    return g + " <b>" + got + "/" + all + "</b>";
  });
  $("#grade-counts").innerHTML = parts.join(" &middot; ");
  $("#spoiler-toggle").checked = state.spoilers;
}

// ---------- render: filters ----------

function renderChips() {
  const wrap = $("#kind-chips");
  wrap.innerHTML = "";
  const counts = {
    all: trophies.length,
    story: trophies.filter((t) => t.kind.includes("story")).length,
    missable: trophies.filter((t) => t.missable).length,
    collectibles: trophies.filter((t) => t.kind.includes("collectibles")).length,
    activities: trophies.filter((t) => t.kind.includes("activities")).length,
    completion: trophies.filter((t) => t.kind.includes("completion")).length,
    online: 0,
  };
  for (const key of Object.keys(KIND_LABELS)) {
    const btn = el("button", "chip" + (state.kind === key ? " active" : ""));
    btn.type = "button";
    btn.textContent = KIND_LABELS[key] + " ";
    const n = el("span", "n", String(counts[key]));
    btn.appendChild(n);
    btn.addEventListener("click", () => {
      state.kind = key;
      renderAll();
    });
    wrap.appendChild(btn);
  }
}

// ---------- render: list ----------

function gradeBadge(t) {
  return el("span", "grade-badge grade-" + t.grade, t.grade);
}

function renderList() {
  const list = $("#trophy-list");
  list.innerHTML = "";
  const shown = filteredTrophies();
  const note = $("#list-note");
  if (state.kind === "online") {
    note.innerHTML =
      "<strong>There are no online trophies.</strong> All 55 trophies unlock in single-player; nothing here needs GTA Online or any other player.";
  } else if (shown.length === 0) {
    note.textContent = "No trophies match these filters.";
  } else {
    note.textContent =
      "Showing " + shown.length + " of " + trophies.length + " trophies. Click a trophy to read its guide and sources.";
  }
  if (shown.length === 0) {
    const empty = el("div", "empty-state");
    if (state.kind === "online") {
      empty.innerHTML = "<strong>No online trophies.</strong><br>Every one of the 55 trophies is earned in single-player.";
    } else {
      empty.textContent = "Nothing matches — clear the search or pick another filter.";
    }
    list.appendChild(empty);
    return;
  }
  for (const t of shown) {
    const li = el("li", "trophy-row" + (state.earned.has(t.id) ? " earned" : "") + (state.selected === t.id ? " selected" : ""));
    li.dataset.id = t.id;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "trophy-check";
    check.checked = state.earned.has(t.id);
    check.setAttribute("aria-label", "Mark " + displayName(t) + " as earned");
    check.addEventListener("click", (ev) => ev.stopPropagation());
    check.addEventListener("change", () => {
      toggleEarned(t.id);
    });

    const main = el("div", "trophy-main");
    const name = el("div", "trophy-name");
    if (isMasked(t)) {
      const masked = el("span", "masked", "Hidden Trophy");
      name.appendChild(masked);
    } else {
      name.textContent = t.name;
    }
    const desc = el("div", "trophy-desc", displayDesc(t));
    const meta = el("div", "trophy-meta");
    for (const k of t.kind) meta.appendChild(el("span", "tag", KIND_LABELS[k] || k));
    if (t.missable) meta.appendChild(el("span", "tag missable", "Missable"));
    if (!t.confirmed) meta.appendChild(el("span", "tag unconfirmed", "Method unconfirmed"));
    if (t.target) meta.appendChild(el("span", "tag target", t.target.count.toLocaleString("en-US") + " " + t.target.unit));
    main.appendChild(name);
    main.appendChild(desc);
    main.appendChild(meta);

    const right = el("div");
    right.appendChild(gradeBadge(t));
    if (state.earned.has(t.id)) right.appendChild(el("div", "earned-mark", "Earned"));

    li.appendChild(check);
    li.appendChild(main);
    li.appendChild(right);
    li.addEventListener("click", () => selectTrophy(t.id));
    list.appendChild(li);
    // Keep a deep-linked trophy in view by scrolling the list only, never the page.
    if (state.selected === t.id) {
      const listRect = list.getBoundingClientRect();
      const rowRect = li.getBoundingClientRect();
      if (rowRect.top < listRect.top || rowRect.bottom > listRect.bottom) {
        list.scrollTop += rowRect.top - listRect.top - 12;
      }
    }
  }
}

// ---------- render: detail ----------

function renderDetail() {
  const box = $("#detail");
  box.innerHTML = "";
  const t = state.selected ? byId.get(state.selected) : null;
  if (!t) {
    box.appendChild(el("p", "detail-placeholder", "Click a trophy in the list to read its guide, step by step, with its sources."));
    const hint = el("p", "detail-placeholder", "Guides are written in our own words and cite their sources beside them. Five methods were still unconfirmed at launch and are marked as such — never trust a method with no source.");
    box.appendChild(hint);
    return;
  }
  const masked = isMasked(t);
  const earned = state.earned.has(t.id);

  const head = el("div", "flag-row");
  head.appendChild(gradeBadge(t));
  if (earned) head.appendChild(el("span", "earned-mark", "Earned"));
  if (t.missable) head.appendChild(el("span", "tag missable", "Missable"));
  if (!t.confirmed) head.appendChild(el("span", "tag unconfirmed", "Method unconfirmed"));
  if (t.hidden) head.appendChild(el("span", "tag", "Hidden on PS5"));
  box.appendChild(head);

  box.appendChild(el("h2", null, masked ? "Hidden Trophy" : t.name));
  const official = el("p", "official");
  if (masked) {
    official.innerHTML = "<em>Official name and description are hidden while spoilers are on. Earn this trophy to reveal them.</em>";
  } else {
    official.textContent = "Official: “" + t.description + "” — " + t.grade + (t.gamerscore ? ", " + t.gamerscore + "G on Xbox" : "");
  }
  box.appendChild(official);

  if (t.missable) {
    const warn = el("p", "missable-note", "Potentially missable — see the guide below and the Missables tab before you pass Chapter 1.");
    box.appendChild(warn);
  }
  if (!t.confirmed) {
    const note = el(
      "p",
      "confirm-note",
      "Method unconfirmed at launch: no guide or tracker has confirmed the exact steps yet. The guide below gives only what the description itself says."
    );
    box.appendChild(note);
  }

  box.appendChild(el("h3", null, "Guide"));
  box.appendChild(el("p", null, t.guide));

  if (t.steps && t.steps.length) {
    box.appendChild(el("h3", null, "Steps"));
    const ol = el("ol", "steps");
    for (const s of t.steps) ol.appendChild(el("li", null, s));
    box.appendChild(ol);
  }

  if (t.target) {
    box.appendChild(el("h3", null, "Progress target"));
    box.appendChild(el("p", null, t.target.count.toLocaleString("en-US") + " " + t.target.unit + "."));
  }

  box.appendChild(el("h3", null, "Sources"));
  const ul = el("ul", "sources");
  for (const s of t.sources) {
    const li = el("li");
    const a = document.createElement("a");
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = s.name;
    li.appendChild(a);
    ul.appendChild(li);
  }
  box.appendChild(ul);

  const row = el("div", "earn-row");
  const btn = el("button", "btn primary", earned ? "Mark as not earned" : "Mark as earned");
  btn.type = "button";
  btn.addEventListener("click", () => toggleEarned(t.id));
  row.appendChild(btn);
  row.appendChild(el("span", null, earned ? "Saved in your browser." : "Your progress is saved in this browser."));
  box.appendChild(row);
}

// ---------- render: roadmap ----------

function renderRoadmap() {
  if (!roadmap) return;
  const intro = $("#roadmap-intro");
  intro.innerHTML = "";
  intro.appendChild(el("p", "lede", roadmap.title));
  intro.appendChild(el("p", null, roadmap.summary));

  const stages = $("#roadmap-stages");
  stages.innerHTML = "";
  for (const stage of roadmap.stages) {
    const li = el("li", "roadmap-stage");
    const h = el("h3", null, "Stage " + stage.stage + " — " + stage.title);
    const when = el("span", "when", stage.when);
    h.appendChild(when);
    li.appendChild(h);
    li.appendChild(el("p", "stage-summary", stage.summary));
    const ul = el("ul");
    for (const p of stage.points) ul.appendChild(el("li", null, p));
    li.appendChild(ul);
    if (stage.trophy_ids && stage.trophy_ids.length) {
      const chips = el("div", "stage-trophies");
      for (const id of stage.trophy_ids) {
        const t = byId.get(id);
        if (!t) continue;
        const a = document.createElement("a");
        a.href = "#/trophy/" + id;
        a.textContent = (state.earned.has(id) ? "✓ " : "") + (isMasked(t) ? "Hidden Trophy" : t.name);
        if (state.earned.has(id)) a.className = "done";
        chips.appendChild(a);
      }
      li.appendChild(chips);
    }
    stages.appendChild(li);
  }

  const warns = $("#roadmap-warnings");
  warns.innerHTML = "";
  for (const w of roadmap.warnings || []) {
    const d = el("div", "warning");
    d.innerHTML = "<strong>Watch out:</strong> " + esc(w);
    warns.appendChild(d);
  }
}

// ---------- render: missables ----------

function renderMissables() {
  const list = $("#missable-list");
  list.innerHTML = "";
  const missable = trophies.filter((t) => t.missable);
  for (const t of missable) {
    const card = el("div", "missable-card");
    card.appendChild(el("h3", null, t.name + " — " + t.grade));
    card.appendChild(el("p", null, t.guide));
    const link = document.createElement("a");
    link.href = "#/trophy/" + t.id;
    link.textContent = "Read the full guide →";
    card.appendChild(link);
    list.appendChild(card);
  }
  const warns = $("#missable-warnings");
  warns.innerHTML = "";
  const extra = [
    "Race Against Yago (Yago's Chapter 3 race, part of Strangers & Freaks) is time-sensitive — it shows an hourglass icon. Do it the moment it appears and save first.",
    "Do not push towards the Irredeemable criminal profile: it is permanent.",
    "There is no mission replay and no New Game Plus — keep manual saves at the start of every chapter and one from just before the final mission.",
  ];
  for (const w of extra) {
    const d = el("div", "warning");
    d.innerHTML = "<strong>Also watch out:</strong> " + esc(w);
    warns.appendChild(d);
  }
}

// ---------- views ----------

function showView(view) {
  state.view = view;
  for (const v of ["trophies", "roadmap", "missables"]) {
    $("#view-" + v).hidden = v !== view;
    const tab = document.querySelector('.tab[data-view="' + v + '"]');
    if (tab) tab.classList.toggle("active", v === view);
  }
}

function selectTrophy(id) {
  if (!byId.has(id)) return;
  state.selected = id;
  showView("trophies");
  renderList();
  renderDetail();
}

function toggleEarned(id) {
  if (state.earned.has(id)) state.earned.delete(id);
  else state.earned.add(id);
  save();
  renderProgress();
  renderList();
  renderDetail();
  renderRoadmap();
}

function renderAll() {
  renderProgress();
  renderChips();
  renderList();
  renderDetail();
  renderRoadmap();
  renderMissables();
}

// ---------- export / import ----------

function exportProgress() {
  const payload = {
    app: "gta6-trophy-guide",
    exported_at: new Date().toISOString(),
    earned: [...state.earned].sort(),
    spoilers: state.spoilers,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gta6-trophy-guide-progress.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!data || !Array.isArray(data.earned)) throw new Error("not a progress file");
      const valid = data.earned.filter((id) => byId.has(id));
      state.earned = new Set(valid);
      if (typeof data.spoilers === "boolean") state.spoilers = data.spoilers;
      save();
      renderAll();
      alert("Imported " + valid.length + " earned trophies.");
    } catch (err) {
      alert("That file is not a valid progress export — nothing was changed.");
    }
  };
  reader.readAsText(file);
}

// ---------- routing ----------

function route() {
  const hash = location.hash || "#/trophies";
  const parts = hash.replace(/^#\//, "").split("/");
  if (parts[0] === "roadmap") {
    showView("roadmap");
  } else if (parts[0] === "missables") {
    showView("missables");
  } else if (parts[0] === "trophy" && parts[1] && byId.has(parts[1])) {
    selectTrophy(parts[1]);
  } else {
    showView("trophies");
  }
}

function applyQueryParams() {
  const params = new URLSearchParams(location.search);
  if (params.get("demo") === "earned") {
    let added = 0;
    for (const id of DEMO_EARNED) {
      if (byId.has(id) && !state.earned.has(id)) {
        state.earned.add(id);
        added++;
      }
    }
    if (added) save();
  }
  const sp = params.get("spoilers");
  if (sp === "off") state.spoilers = false;
  if (sp === "on") state.spoilers = true;
  const trophy = params.get("trophy");
  if (trophy && byId.has(trophy)) state.selected = trophy;
  const view = params.get("view");
  if (view === "roadmap" || view === "missables") state.view = view;
}

// ---------- boot ----------

async function boot() {
  loadSaved();
  try {
    await loadData();
  } catch (err) {
    document.querySelector("main").innerHTML =
      "<p class='empty-state'><strong>Could not load the trophy data.</strong><br>Serve the app/ folder over HTTP (for example: python3 -m http.server) and reload.</p>";
    return;
  }
  applyQueryParams();
  if (!state.selected && trophies.length) state.selected = trophies[0].id;

  $("#spoiler-toggle").addEventListener("change", (ev) => {
    state.spoilers = ev.target.checked;
    save();
    renderAll();
  });
  $("#grade-filter").addEventListener("change", (ev) => {
    state.grade = ev.target.value;
    renderList();
  });
  $("#sort-select").addEventListener("change", (ev) => {
    state.sort = ev.target.value;
    renderList();
  });
  $("#hide-earned").addEventListener("change", (ev) => {
    state.hideEarned = ev.target.checked;
    renderList();
  });
  $("#search-box").addEventListener("input", (ev) => {
    state.search = ev.target.value;
    renderList();
  });
  $("#export-btn").addEventListener("click", exportProgress);
  $("#import-btn").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (file) importProgress(file);
    ev.target.value = "";
  });
  window.addEventListener("hashchange", route);

  renderAll();
  route();
}

boot();
