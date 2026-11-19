"use strict";
/* Leonida Legends — GTA 6 trophy guide + tracker.
   All data lives in app/data/*.json; progress lives in localStorage only.
   No network is used at runtime. */

const STORE_KEY = "gta6-trophy-guide-v1";
const SOURCE_URLS = {
  GTABase: "https://www.gtabase.com/articles/gta-6/gta-6-achievements-trophies-list-ps5-xbox-series",
  "Output Lag": "https://outputlag.com/guides/gta-6-trophy-list/",
  PowerPyx: "https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/"
};

const state = {
  trophies: [],
  roadmap: null,
  earned: new Set(),
  spoilers: true,
  kind: "all",
  grade: "all",
  query: "",
  hideEarned: false,
  onlyUnconfirmed: false,
  selected: null
};

const $ = (id) => document.getElementById(id);

function loadStoredState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.earned)) state.earned = new Set(saved.earned);
    if (typeof saved.spoilers === "boolean") state.spoilers = saved.spoilers;
  } catch (err) { /* corrupt save: start fresh, never crash */ }
}

function saveStoredState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      earned: [...state.earned],
      spoilers: state.spoilers
    }));
  } catch (err) { /* storage full or blocked: progress just won't persist */ }
}

function gradeCounts() {
  const counts = { Platinum: 0, Gold: 0, Silver: 0, Bronze: 0 };
  for (const t of state.trophies) counts[t.grade] = (counts[t.grade] || 0) + 1;
  return counts;
}

function earnedByGrade(grade) {
  return state.trophies.filter((t) => t.grade === grade && state.earned.has(t.id)).length;
}

function renderProgress() {
  const total = state.trophies.length;
  const earned = state.earned.size;
  const pct = total ? Math.round((earned / total) * 100) : 0;
  $("progressText").textContent = earned + " of " + total + " earned";
  $("progressPct").textContent = pct + "%";
  const fill = $("progressFill");
  fill.style.width = pct + "%";
  fill.parentElement.setAttribute("aria-valuenow", String(earned));
  const c = gradeCounts();
  $("gradeCounts").textContent =
    "Platinum " + earnedByGrade("Platinum") + "/" + c.Platinum +
    " · Gold " + earnedByGrade("Gold") + "/" + c.Gold +
    " · Silver " + earnedByGrade("Silver") + "/" + c.Silver +
    " · Bronze " + earnedByGrade("Bronze") + "/" + c.Bronze;
}

function trophyIsMasked(t) {
  return state.spoilers && t.hidden && !state.earned.has(t.id);
}

function trophyMatchesFilters(t) {
  if (state.kind === "story" && !t.kinds.includes("story")) return false;
  if (state.kind === "missable" && !t.missable) return false;
  if (state.kind === "collectibles" && !t.kinds.includes("collectibles")) return false;
  if (state.kind === "activities" && !t.kinds.includes("activities")) return false;
  if (state.grade !== "all" && t.grade !== state.grade) return false;
  if (state.hideEarned && state.earned.has(t.id)) return false;
  if (state.onlyUnconfirmed && !t.unconfirmed) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    const hay = (t.name + " " + t.description + " " + t.guide).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function trophyRow(t) {
  const li = document.createElement("li");
  li.className = "trophy-row" + (state.earned.has(t.id) ? " earned" : "");
  li.dataset.id = t.id;

  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "trophy-check";
  check.checked = state.earned.has(t.id);
  check.setAttribute("aria-label", "Mark " + (trophyIsMasked(t) ? "hidden trophy" : t.name) + " as earned");
  check.addEventListener("click", (ev) => {
    ev.stopPropagation();
    toggleEarned(t.id, check.checked);
  });
  li.appendChild(check);

  const body = document.createElement("div");
  const name = document.createElement("div");
  name.className = "trophy-name";
  name.textContent = trophyIsMasked(t) ? "Hidden Trophy" : t.name;
  body.appendChild(name);
  const desc = document.createElement("div");
  desc.className = "trophy-desc";
  desc.textContent = trophyIsMasked(t)
    ? "A hidden story trophy. Earn it — or turn spoilers off — to see its name and description."
    : t.description;
  body.appendChild(desc);
  const meta = document.createElement("div");
  meta.className = "trophy-meta";
  const badge = document.createElement("span");
  badge.className = "badge " + t.grade;
  badge.textContent = t.grade;
  meta.appendChild(badge);
  for (const kind of t.kinds) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = kind;
    meta.appendChild(tag);
  }
  if (t.missable) {
    const tag = document.createElement("span");
    tag.className = "tag missable";
    tag.textContent = "Potentially missable";
    meta.appendChild(tag);
  }
  if (t.unconfirmed) {
    const tag = document.createElement("span");
    tag.className = "tag unconfirmed";
    tag.textContent = "Method unconfirmed";
    meta.appendChild(tag);
  }
  if (t.target) {
    const tag = document.createElement("span");
    tag.className = "tag target";
    tag.textContent = "Target: " + t.target.toLocaleString("en-US") + " " + t.targetLabel;
    meta.appendChild(tag);
  }
  body.appendChild(meta);
  li.appendChild(body);

  const open = document.createElement("span");
  open.className = "tag";
  open.textContent = "Guide →";
  li.appendChild(open);

  li.addEventListener("click", () => showDetail(t.id));
  return li;
}

function renderList() {
  const list = $("trophyList");
  list.textContent = "";
  let shown = 0;
  for (const t of state.trophies) {
    if (!trophyMatchesFilters(t)) continue;
    list.appendChild(trophyRow(t));
    shown += 1;
  }
  $("filterStatus").textContent = shown === state.trophies.length
    ? "Showing all " + state.trophies.length + " trophies."
    : "Showing " + shown + " of " + state.trophies.length + " trophies.";
  renderProgress();
}

function toggleEarned(id, earned) {
  if (earned) state.earned.add(id); else state.earned.delete(id);
  saveStoredState();
  renderList();
  if (state.selected === id) showDetail(id);
}

function sourceLinks(names) {
  return names.map((n) => {
    const url = SOURCE_URLS[n] || "#";
    return { name: n, url };
  });
}

function showDetail(id) {
  const t = state.trophies.find((x) => x.id === id);
  if (!t) return;
  state.selected = id;
  const panel = $("detailPanel");
  const body = $("detailBody");
  body.textContent = "";

  const h2 = document.createElement("h2");
  h2.textContent = trophyIsMasked(t) ? "Hidden Trophy" : t.name;
  body.appendChild(h2);
  const desc = document.createElement("p");
  desc.className = "trophy-desc";
  desc.textContent = trophyIsMasked(t)
    ? "This is a hidden story trophy. Turn spoilers off or earn it to reveal the official name and description."
    : t.description;
  body.appendChild(desc);
  const meta = document.createElement("p");
  meta.className = "trophy-meta";
  const badge = document.createElement("span");
  badge.className = "badge " + t.grade;
  badge.textContent = t.grade;
  meta.appendChild(badge);
  if (t.missable) {
    const tag = document.createElement("span");
    tag.className = "tag missable";
    tag.textContent = "Potentially missable — see the roadmap warnings";
    meta.appendChild(tag);
  }
  if (t.unconfirmed) {
    const tag = document.createElement("span");
    tag.className = "tag unconfirmed";
    tag.textContent = "Method unconfirmed at launch";
    meta.appendChild(tag);
  }
  body.appendChild(meta);

  if (t.unconfirmed) {
    const warn = document.createElement("p");
    warn.className = "warn";
    warn.textContent = "No confirmed unlock method exists yet for this trophy. The guide below gives only what the official description says — nothing is invented.";
    body.appendChild(warn);
  }

  const guideTitle = document.createElement("h3");
  guideTitle.textContent = "How to unlock it";
  body.appendChild(guideTitle);
  const guide = document.createElement("p");
  guide.textContent = t.guide;
  body.appendChild(guide);
  if (t.target) {
    const target = document.createElement("p");
    target.textContent = "Target: " + t.target.toLocaleString("en-US") + " " + t.targetLabel + ".";
    body.appendChild(target);
  }

  const srcTitle = document.createElement("h3");
  srcTitle.textContent = "Sources";
  body.appendChild(srcTitle);
  const src = document.createElement("p");
  src.className = "sources";
  src.textContent = "Guide written in our own words from: ";
  sourceLinks(t.sources).forEach((s, i) => {
    if (i > 0) src.appendChild(document.createTextNode(", "));
    const a = document.createElement("a");
    a.href = s.url;
    a.textContent = s.name;
    a.target = "_blank";
    a.rel = "noopener";
    src.appendChild(a);
  });
  src.appendChild(document.createTextNode(". Official names and descriptions are shown as PlayStation publishes them."));
  body.appendChild(src);

  const earnedBtn = document.createElement("button");
  earnedBtn.type = "button";
  earnedBtn.textContent = state.earned.has(t.id) ? "Mark as not earned" : "Mark as earned";
  earnedBtn.addEventListener("click", () => toggleEarned(t.id, !state.earned.has(t.id)));
  body.appendChild(earnedBtn);

  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderRoadmap() {
  const r = state.roadmap;
  if (!r) return;
  $("roadmapNote").textContent = r.note || "";
  const stages = $("roadmapStages");
  stages.textContent = "";
  for (const stage of r.stages) {
    const li = document.createElement("li");
    const h3 = document.createElement("h3");
    h3.textContent = stage.title;
    li.appendChild(h3);
    if (stage.details) {
      const ul = document.createElement("ul");
      for (const d of stage.details) {
        const item = document.createElement("li");
        item.textContent = d;
        ul.appendChild(item);
      }
      li.appendChild(ul);
    }
    if (stage.trophies) {
      const p = document.createElement("p");
      p.textContent = "Trophies in this stage: " + stage.trophies.join(", ") + ".";
      li.appendChild(p);
    }
    stages.appendChild(li);
  }
  const miss = $("missableList");
  miss.textContent = "";
  const box = r.stages.find((s) => s.missables);
  if (box) {
    for (const m of box.missables) {
      const item = document.createElement("li");
      item.textContent = m.trophy + " — " + m.note;
      miss.appendChild(item);
    }
  }
}

function exportProgress() {
  const payload = {
    app: "gta6-trophy-guide",
    version: 1,
    exportedAt: new Date().toISOString(),
    spoilers: state.spoilers,
    earned: [...state.earned].sort()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gta6-trophy-progress.json";
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
      if (!data || !Array.isArray(data.earned)) throw new Error("bad file");
      const valid = new Set(state.trophies.map((t) => t.id));
      const earned = data.earned.filter((id) => valid.has(id));
      state.earned = new Set(earned);
      if (typeof data.spoilers === "boolean") {
        state.spoilers = data.spoilers;
        $("spoilerToggle").checked = state.spoilers;
      }
      saveStoredState();
      renderList();
      if (state.selected) showDetail(state.selected);
      alert("Imported progress: " + earned.length + " trophies earned.");
    } catch (err) {
      alert("That file is not a valid progress export — nothing was changed.");
    }
  };
  reader.readAsText(file);
}

function wireEvents() {
  $("kindFilters").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-kind]");
    if (!btn) return;
    state.kind = btn.dataset.kind;
    for (const b of $("kindFilters").querySelectorAll("button")) {
      b.classList.toggle("active", b === btn);
    }
    renderList();
  });
  $("gradeFilter").addEventListener("change", (ev) => {
    state.grade = ev.target.value;
    renderList();
  });
  $("searchBox").addEventListener("input", (ev) => {
    state.query = ev.target.value.trim();
    renderList();
  });
  $("hideEarned").addEventListener("change", (ev) => {
    state.hideEarned = ev.target.checked;
    renderList();
  });
  $("onlyUnconfirmed").addEventListener("change", (ev) => {
    state.onlyUnconfirmed = ev.target.checked;
    renderList();
  });
  $("spoilerToggle").addEventListener("change", (ev) => {
    state.spoilers = ev.target.checked;
    saveStoredState();
    renderList();
    if (state.selected) showDetail(state.selected);
  });
  $("exportBtn").addEventListener("click", exportProgress);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (ev) => {
    if (ev.target.files && ev.target.files[0]) importProgress(ev.target.files[0]);
    ev.target.value = "";
  });
  $("detailClose").addEventListener("click", () => {
    $("detailPanel").hidden = true;
    state.selected = null;
  });
}

async function init() {
  loadStoredState();
  const [trophiesRes, roadmapRes] = await Promise.all([
    fetch("data/trophies.json"),
    fetch("data/roadmap.json")
  ]);
  const trophiesData = await trophiesRes.json();
  state.trophies = trophiesData.trophies;
  state.roadmap = await roadmapRes.json();
  $("spoilerToggle").checked = state.spoilers;
  wireEvents();
  renderRoadmap();
  renderList();
}

init();
