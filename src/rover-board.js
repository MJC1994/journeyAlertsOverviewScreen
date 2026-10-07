import { escapeHtml } from "./format.js";
import { railcardNames } from "./passengers.js";

export function renderRoverBoard({ product, startDate, adults, children, railcards }) {
  const party = [
    adults ? `${adults} ${adults === 1 ? "Adult" : "Adults"}` : null,
    children ? `${children} ${children === 1 ? "Child" : "Children"}` : null,
  ].filter(Boolean);
  const cards = railcardNames(railcards);
  const cardLabel = cards.length > 1 ? `${cards.length} Railcards` : cards[0] || "No Railcard";

  return `<div class="fare-board">
    <section class="fare-section">
      <h3>Rover Tickets</h3>
      <ul class="fare-list">
        <li>
          <div class="fare-copy">
            <span class="fare-name">${escapeHtml(product.name)}</span>
            <span class="fare-route">Unlimited travel within a specified area</span>
            <span class="fare-tag">${escapeHtml(startDate ? `From ${startDate}` : "Choose a start date")}</span>
          </div>
        </li>
      </ul>
      <p class="fare-empty">${escapeHtml([...party, cardLabel].filter(Boolean).join(" · "))}</p>
    </section>
  </div>`;
}
