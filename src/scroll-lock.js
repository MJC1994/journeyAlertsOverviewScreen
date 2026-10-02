// iOS Safari ignores overflow:hidden on body, so the page can scroll under a
// full-screen sheet. The fixed sheet then paints in one place while touches
// hit-test against the scrolled layout, so taps land above the buttons.
// Pinning the body while a sheet is open keeps the two in step.

const OPEN_CLASS = "is-panel-sheet-open";

let lockedY = null;

function lock() {
  if (lockedY !== null) return;
  lockedY = window.scrollY;
  const { style } = document.body;
  style.position = "fixed";
  style.top = `-${lockedY}px`;
  style.left = "0";
  style.right = "0";
  style.width = "100%";
}

function unlock() {
  if (lockedY === null) return;
  const y = lockedY;
  lockedY = null;
  const { style } = document.body;
  style.position = "";
  style.top = "";
  style.left = "";
  style.right = "";
  style.width = "";
  window.scrollTo(0, y);
}

function sync() {
  if (document.body.classList.contains(OPEN_CLASS)) lock();
  else unlock();
}

export function attachScrollLock() {
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // The keyboard can still pan the window while a sheet input is focused;
  // snap it back once the keyboard goes away so touches line up again.
  const settle = () => {
    if (lockedY !== null && window.scrollY !== 0) window.scrollTo(0, 0);
  };
  document.addEventListener("focusout", () => requestAnimationFrame(settle));
  window.visualViewport?.addEventListener("resize", settle);

  sync();
}
