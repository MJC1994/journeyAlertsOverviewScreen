import { searchStations, stationSearch } from "fuzzy-stations";

export function attachStationPicker(input, hidden, { initialCrs } = {}) {
  const list = document.createElement("ul");
  list.id = `${input.id}-suggestions`;
  list.className = "station-suggestions";
  list.hidden = true;
  list.setAttribute("role", "listbox");
  input.parentElement.appendChild(list);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");

  let items = [];
  let activeIndex = -1;

  if (initialCrs) {
    const station = stationSearch.findByCrs(initialCrs);
    if (station?.nlc) {
      input.value = station.name;
      hidden.value = station.nlc;
    }
  }

  function close() {
    list.hidden = true;
    list.innerHTML = "";
    items = [];
    activeIndex = -1;
    input.setAttribute("aria-expanded", "false");
  }

  function select(station) {
    input.value = station.name;
    hidden.value = station.nlc;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    close();
  }

  function highlight() {
    [...list.children].forEach((item, index) => {
      item.setAttribute("aria-selected", String(index === activeIndex));
    });
  }

  function render() {
    list.innerHTML = "";
    items.forEach((result, index) => {
      const item = document.createElement("li");
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", "false");
      item.innerHTML = `<span class="suggestion-pin">${result.station.crs}</span><span class="suggestion-name">${result.station.name}</span>`;
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        select(result.station);
      });
      list.appendChild(item);
      if (index === activeIndex) item.setAttribute("aria-selected", "true");
    });
    list.hidden = items.length === 0;
    input.setAttribute("aria-expanded", String(items.length > 0));
  }

  function search(query) {
    if (!query.trim()) {
      close();
      return;
    }
    items = searchStations(query, { limit: 8 }).filter((result) => result.station.nlc);
    activeIndex = items.length ? 0 : -1;
    render();
  }

  input.addEventListener("input", () => {
    hidden.value = "";
    search(input.value);
  });

  input.addEventListener("focus", () => {
    if (input.value.trim()) search(input.value);
  });

  input.addEventListener("keydown", (event) => {
    if (list.hidden) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      highlight();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      highlight();
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      select(items[activeIndex].station);
    } else if (event.key === "Escape") {
      close();
    }
  });

  input.addEventListener("blur", () => {
    const query = input.value.trim();
    if (!query) {
      input.value = "";
      hidden.value = "";
      close();
      return;
    }

    if (hidden.value) {
      close();
      return;
    }

    const byCrs = query.length === 3 ? stationSearch.findByCrs(query) : undefined;
    const fallback = byCrs?.nlc ? byCrs : items[0]?.station;
    if (fallback?.nlc) {
      select(fallback);
      return;
    }
    close();
  });
}
