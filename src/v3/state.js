import { PASSENGER_LIMITS } from "../config.js";

function formatISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function snapTime(date = new Date()) {
  const copy = new Date(date);
  const minutes = copy.getMinutes();
  const snapped = Math.ceil(minutes / 15) * 15;
  copy.setMinutes(snapped % 60, 0, 0);
  if (snapped === 60) copy.setHours(copy.getHours() + 1);
  return `${String(copy.getHours()).padStart(2, "0")}:${String(copy.getMinutes()).padStart(2, "0")}`;
}

export function createInitialState() {
  const now = new Date();
  const returnAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return {
    ticketType: "single",
    step: "ticket",
    originName: "",
    originNlc: "",
    destinationName: "",
    destinationNlc: "",
    outwardDate: formatISO(now),
    outwardTime: snapTime(now),
    outwardMode: "Depart",
    returnDate: formatISO(returnAt),
    returnTime: snapTime(returnAt),
    returnMode: "Depart",
    adults: 1,
    children: 0,
    railcards: [],
    seasonStart: formatISO(now),
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
  };
}

export function isSeason(state) {
  return state.ticketType === "season";
}

export function needsReturn(state) {
  return state.ticketType === "return";
}

export function stepOrder(state) {
  if (isSeason(state)) {
    return ["ticket", "route", "when", "travellers", "length", "extras"];
  }
  return ["ticket", "route", "when", "travellers", "extras"];
}

export function stepMeta(id) {
  return (
    {
      ticket: { label: "Ticket", title: "What ticket?" },
      route: { label: "Route", title: "Where to?" },
      when: { label: "When", title: "When?" },
      travellers: { label: "Who", title: "Who’s going?" },
      length: { label: "Length", title: "How long?" },
      extras: { label: "Extras", title: "Anything else?" },
    }[id] || { label: id, title: id }
  );
}

export function validationErrors(state) {
  const errors = [];
  if (!state.originNlc || !state.destinationNlc) errors.push("Choose From and To stations.");
  if (state.originNlc && state.destinationNlc && state.originNlc === state.destinationNlc) {
    errors.push("From and To must be different.");
  }
  if (isSeason(state)) {
    if (!state.seasonStart) errors.push("Choose a start date.");
    if (!state.seasonLengths.length) errors.push("Choose at least one season length.");
    if (state.seasonLengths.includes("custom") && !state.seasonUntil) {
      errors.push("Choose an until date for custom length.");
    }
    if (state.seasonUntil && state.seasonUntil <= state.seasonStart) {
      errors.push("Until must be after start.");
    }
  } else {
    if (!state.outwardDate || !state.outwardTime) errors.push("Choose outbound date and time.");
    if (needsReturn(state)) {
      if (!state.returnDate || !state.returnTime) errors.push("Choose return date and time.");
      else {
        const out = `${state.outwardDate}T${state.outwardTime}:00`;
        const back = `${state.returnDate}T${state.returnTime}:00`;
        if (back < out) errors.push("Return must be after outbound.");
      }
    }
    if (state.adults + state.children < 1) errors.push("Add at least one traveller.");
    if (state.adults + state.children > PASSENGER_LIMITS.maxTotal) {
      errors.push(`Max ${PASSENGER_LIMITS.maxTotal} travellers.`);
    }
  }
  if (state.viaNlc && state.avoidNlc && state.viaNlc === state.avoidNlc) {
    errors.push("Via and avoid cannot match.");
  }
  return errors;
}

export function createStore(initial = createInitialState()) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
