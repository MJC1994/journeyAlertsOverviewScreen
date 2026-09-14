import { PASSENGER_LIMITS, RAILCARDS } from "./config.js";
import { escapeHtml } from "./format.js";

export function attachPassengerControls({ adultsInput, childrenInput, listEl, addButton, onChange }) {
  adultsInput.min = String(PASSENGER_LIMITS.minAdults);
  adultsInput.max = String(PASSENGER_LIMITS.maxAdults);
  childrenInput.min = String(PASSENGER_LIMITS.minChildren);
  childrenInput.max = String(PASSENGER_LIMITS.maxChildren);

  function selectedCodes() {
    return [...listEl.querySelectorAll("select")]
      .map((select) => select.value)
      .filter(Boolean);
  }

  function passengerCounts() {
    return {
      adults: clampCount(adultsInput.value, PASSENGER_LIMITS.minAdults, PASSENGER_LIMITS.maxAdults),
      children: clampCount(childrenInput.value, PASSENGER_LIMITS.minChildren, PASSENGER_LIMITS.maxChildren),
    };
  }

  function maxRailcards() {
    const { adults, children } = passengerCounts();
    return Math.max(1, Math.min(PASSENGER_LIMITS.maxTotal, adults + children));
  }

  function addRow(code = "") {
    if (listEl.children.length >= maxRailcards()) return;
    const row = document.createElement("div");
    row.className = "railcard-row";
    row.innerHTML = `
      <select aria-label="Railcard">
        <option value="">Choose a railcard</option>
        ${RAILCARDS.map((card) => `<option value="${escapeHtml(card.code)}"${card.code === code ? " selected" : ""}>${escapeHtml(card.name)}</option>`).join("")}
      </select>
      <button type="button" class="railcard-remove" aria-label="Remove railcard">Remove</button>
    `;
    row.querySelector(".railcard-remove").addEventListener("click", () => {
      row.remove();
      updateAddButton();
      onChange?.();
    });
    row.querySelector("select").addEventListener("change", () => onChange?.());
    listEl.appendChild(row);
    updateAddButton();
    onChange?.();
  }

  function trimRows() {
    while (listEl.children.length > maxRailcards()) {
      listEl.lastElementChild.remove();
    }
    updateAddButton();
  }

  function updateAddButton() {
    addButton.hidden = listEl.children.length >= maxRailcards();
  }

  function validate() {
    const { adults, children } = passengerCounts();
    if (adults + children < 1) return "Choose at least one passenger.";
    if (adults + children > PASSENGER_LIMITS.maxTotal) return "Choose at most 9 passengers.";
    return null;
  }

  function setCount(input, next) {
    const min = Number(input.min);
    const max = Number(input.max);
    const { adults, children } = passengerCounts();
    const other = input === adultsInput ? children : adults;
    const clamped = Math.min(max, Math.max(min, next));
    input.value = String(Math.min(clamped, PASSENGER_LIMITS.maxTotal - other));
    trimRows();
    syncSteppers();
    onChange?.();
  }

  function syncSteppers() {
    const { adults, children } = passengerCounts();
    const total = adults + children;
    for (const button of document.querySelectorAll(".stepper-btn")) {
      const input = button.dataset.step === "adults" ? adultsInput : childrenInput;
      const delta = Number(button.dataset.delta);
      const value = Number(input.value);
      const atMin = delta < 0 && value <= Number(input.min);
      const atMax = delta > 0 && (value >= Number(input.max) || total >= PASSENGER_LIMITS.maxTotal);
      button.disabled = atMin || atMax;
    }
  }

  addButton.addEventListener("click", () => addRow());
  adultsInput.addEventListener("change", () => {
    trimRows();
    syncSteppers();
    onChange?.();
  });
  childrenInput.addEventListener("change", () => {
    trimRows();
    syncSteppers();
    onChange?.();
  });

  document.querySelectorAll(".stepper-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.dataset.step === "adults" ? adultsInput : childrenInput;
      setCount(input, Number(input.value) + Number(button.dataset.delta));
    });
  });

  updateAddButton();
  syncSteppers();

  return { selectedCodes, passengerCounts, validate, syncSteppers };
}

export function railcardNames(codes) {
  return codes.map((code) => RAILCARDS.find((card) => card.code === code)?.name || code);
}

function clampCount(value, min, max) {
  const number = Number.parseInt(String(value), 10);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}
