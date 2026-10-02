// Mobile sheets are laid out full screen and revealed with a clip-path that
// starts on the tapped control, so nothing reflows while they animate.
export function setSheetOrigin(panel, rect) {
  const width = document.documentElement.clientWidth;
  const height = window.innerHeight;
  const top = Math.min(Math.max(0, rect.top), height);
  const left = Math.min(Math.max(0, rect.left), width);
  panel.style.setProperty("--sheet-t", `${top}px`);
  panel.style.setProperty("--sheet-l", `${left}px`);
  panel.style.setProperty("--sheet-r", `${Math.max(0, width - rect.right)}px`);
  panel.style.setProperty("--sheet-b", `${Math.max(0, height - rect.bottom)}px`);
  panel.style.setProperty("--sheet-radius", "28px");
}
