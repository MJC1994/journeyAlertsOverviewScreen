import { PASSENGER_LIMITS } from "../config.js";

function todayISO() {
  const now = new Date();
  return formatISO(now);
}

function formatISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function snapTime(date = new Date()) {
  const minutes = date.getMinutes();
  const snapped = Math.ceil(minutes / 15) * 15;
  date = new Date(date);
  date.setMinutes(snapped % 60, 0, 0);
  if (snapped === 60) date.setHours(date.getHours() + 1);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function createInitialState() {
  const now = new Date();
  const outwardTime = snapTime(now);
  const returnAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return {
    ticketType: "single",
    activePanel: "ticket",
    originName: "London Bridge",
    originNlc: "5148",
    destinationName: "Kingston",
    destinationNlc: "5565",
    outwardDate: todayISO(),
    outwardTime,
    outwardMode: "Depart",
    returnDate: formatISO(returnAt),
    returnTime: snapTime(returnAt),
    returnMode: "Depart",
    adults: 1,
    children: 0,
    railcards: [],
    seasonStart: todayISO(),
    seasonUntil: "",
    seasonLengths: ["weekly"],
    seasonPassenger: "adult",
    seasonRailcard: false,
    viaName: "",
    viaNlc: "",
    avoidName: "",
    avoidNlc: "",
    discountCode: "",
    discountApplied: false,
    itineraryExpanded: false,
  };
}

export function isSeason(state) {
  return state.ticketType === "season";
}

export function needsReturn(state) {
  return state.ticketType === "return" || state.ticketType === "open";
}

export function validationErrors(state) {
  const errors = [];
  if (!state.originNlc || !state.destinationNlc) {
    errors.push("Choose origin and destination stations.");
  }
  if (state.originNlc && state.destinationNlc && state.originNlc === state.destinationNlc) {
    errors.push("Origin and destination must be different.");
  }

  if (isSeason(state)) {
    if (!state.seasonStart) errors.push("Choose a season start date.");
    if (!state.seasonLengths.length) errors.push("Choose at least one season length.");
    if (state.seasonLengths.includes("custom") && !state.seasonUntil) {
      errors.push("Choose an until date for a custom season.");
    }
    if (state.seasonUntil && state.seasonUntil <= state.seasonStart) {
      errors.push("Until date must be after the start date.");
    }
  } else {
    if (!state.outwardDate || !state.outwardTime) {
      errors.push("Choose an outbound date and time.");
    }
    if (state.ticketType === "return") {
      if (!state.returnDate || !state.returnTime) {
        errors.push("Choose a return date and time.");
      } else {
        const out = `${state.outwardDate}T${state.outwardTime}:00`;
        const back = `${state.returnDate}T${state.returnTime}:00`;
        if (back < out) errors.push("Return must be after outbound.");
      }
    }
    const total = state.adults + state.children;
    if (total < 1) errors.push("Add at least one traveller.");
    if (total > PASSENGER_LIMITS.maxTotal) {
      errors.push(`Maximum ${PASSENGER_LIMITS.maxTotal} travellers.`);
    }
  }

  if (state.viaNlc && state.avoidNlc && state.viaNlc === state.avoidNlc) {
    errors.push("Via and avoid cannot be the same station.");
  }
  return errors;
}

export function createStore(initial = createInitialState()) {
  let state = { ...initial };
  const listeners = new Set();

  return {
    get() {
      return state;
    },
    set(patch) {
      state = { ...state, ...patch };
      for (const listener of listeners) listener(state);
    },
    update(fn) {
      state = fn({ ...state });
      for (const listener of listeners) listener(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export { todayISO, formatISO, snapTime };
