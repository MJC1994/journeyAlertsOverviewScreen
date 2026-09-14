export function attachPillSwitch(root) {
  if (!root) return { refresh() {} };

  let pill = root.querySelector(":scope > .pill-switch-pill");
  if (!pill) {
    pill = document.createElement("span");
    pill.className = "pill-switch-pill";
    pill.setAttribute("aria-hidden", "true");
    root.prepend(pill);
  }
  root.classList.add("pill-switch");

  let placed = false;

  function refresh({ animate = true } = {}) {
    const selected = selectedButton(root);
    if (!selected || selected.offsetWidth === 0) return;
    const shouldAnimate = animate && placed;
    if (!shouldAnimate) pill.style.transition = "none";
    pill.style.width = `${selected.offsetWidth}px`;
    pill.style.height = `${selected.offsetHeight}px`;
    pill.style.transform = `translate(${selected.offsetLeft}px, ${selected.offsetTop}px)`;
    if (!shouldAnimate) {
      pill.getBoundingClientRect();
      pill.style.transition = "";
    }
    placed = true;
  }

  const observer = new MutationObserver(() => refresh());
  for (const button of root.querySelectorAll("button")) {
    observer.observe(button, { attributes: true, attributeFilter: ["aria-selected"] });
  }
  new ResizeObserver(() => refresh({ animate: placed })).observe(root);
  window.addEventListener("resize", () => refresh({ animate: false }));
  requestAnimationFrame(() => refresh({ animate: false }));
  document.fonts?.ready?.then(() => refresh({ animate: false }));

  return { refresh };
}

function selectedButton(root) {
  return [...root.querySelectorAll('[aria-selected="true"]')].find((button) => button.parentElement === root) || null;
}
