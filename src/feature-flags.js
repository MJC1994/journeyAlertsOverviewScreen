const STORAGE_KEY = "journey.featureFlags.v1";

const DEFAULTS = {
  showSearchTickets: false,
  showStadiums: false,
  showSavedStations: false,
  allowSearch: false,
};

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function normalize(raw = {}) {
  return {
    showSearchTickets: Boolean(raw.showSearchTickets),
    showStadiums: Boolean(raw.showStadiums),
    showSavedStations: Boolean(raw.showSavedStations),
    allowSearch: Boolean(raw.allowSearch),
  };
}

let flags = normalize({ ...DEFAULTS, ...readStored() });

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
}

function applyDom() {
  document.body.classList.toggle("flag-show-search-tickets", flags.showSearchTickets);
  document.body.classList.toggle("flag-show-stadiums", flags.showStadiums);
  document.body.classList.toggle("flag-show-saved-stations", flags.showSavedStations);
  document.body.classList.toggle("flag-allow-search", flags.allowSearch);
}

export function getFeatureFlags() {
  return { ...flags };
}

export function isFeatureEnabled(key) {
  return Boolean(flags[key]);
}

export function setFeatureFlag(key, value) {
  if (!(key in DEFAULTS)) return getFeatureFlags();
  flags = { ...flags, [key]: Boolean(value) };
  persist();
  applyDom();
  document.dispatchEvent(new CustomEvent("feature-flags-change", { detail: getFeatureFlags() }));
  return getFeatureFlags();
}

export function attachFeatureFlags() {
  const root = document.querySelector(".feature-flags");
  if (!root) {
    applyDom();
    return getFeatureFlags();
  }

  const controls = {
    showSearchTickets: root.querySelector("#flag-show-search-tickets"),
    showStadiums: root.querySelector("#flag-show-stadiums"),
    showSavedStations: root.querySelector("#flag-show-saved-stations"),
    allowSearch: root.querySelector("#flag-allow-search"),
  };

  for (const [key, input] of Object.entries(controls)) {
    if (!input) continue;
    input.checked = flags[key];
    input.addEventListener("change", () => setFeatureFlag(key, input.checked));
  }

  applyDom();

  document.addEventListener("click", (event) => {
    if (!(root instanceof HTMLDetailsElement) || !root.open) return;
    if (root.contains(event.target)) return;
    root.open = false;
  });

  return getFeatureFlags();
}
