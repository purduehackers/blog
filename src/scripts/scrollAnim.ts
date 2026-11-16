/*
 * Scroll-triggered animations using data attributes and Intersection Observer
 * Detects scroll position or when an element leaves view
 */

if (typeof window !== "undefined") {
  const cleanups: Array<() => void> = [];

  function run() {
    while (cleanups.length) cleanups.pop()!();

    const scrollThresholdEls = document.querySelectorAll<HTMLElement>("[data-scroll-threshold]");
    const sentinelEls = document.querySelectorAll<HTMLElement>("[data-sentinel]");

    if (scrollThresholdEls.length > 0) {
      let rafId: number | null = null;
      const state = new Map<HTMLElement, boolean>();

      function update() {
        const scrollY = window.scrollY;
        scrollThresholdEls.forEach((el) => {
          const threshold = Number(el.dataset.scrollThreshold) || 48;
          const scrolled = scrollY > threshold;
          if (state.get(el) !== scrolled) {
            state.set(el, scrolled);
            el.setAttribute("data-scrolled", scrolled ? "true" : "false");
          }
        });
        rafId = null;
      }

      function onScroll() {
        if (rafId === null) rafId = requestAnimationFrame(update);
      }

      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        if (rafId !== null) cancelAnimationFrame(rafId);
      });
      update();
    }

    // Set data-past-sentinel when the sentinel's top has passed the viewport top
    if (sentinelEls.length > 0) {
      const bySelector = new Map<string, HTMLElement[]>();
      sentinelEls.forEach((el) => {
        const sel = (el.dataset.sentinel || "").trim();
        if (!sel) return;
        if (!bySelector.has(sel)) bySelector.set(sel, []);
        bySelector.get(sel)!.push(el);
      });

      let sentinelRafId: number | null = null;
      const sentinelState = new Map<string, boolean>();

      function updateSentinels() {
        bySelector.forEach((subscribers, selector) => {
          const sentinel = document.querySelector(selector);
          if (!sentinel) return;
          const rect = sentinel.getBoundingClientRect();
          const past = rect.top <= 0;
          if (sentinelState.get(selector) !== past) {
            sentinelState.set(selector, past);
            subscribers.forEach((el) =>
              el.setAttribute("data-past-sentinel", past ? "true" : "false")
            );
          }
        });
        sentinelRafId = null;
      }

      function onSentinelScroll() {
        if (sentinelRafId === null) sentinelRafId = requestAnimationFrame(updateSentinels);
      }

      window.addEventListener("scroll", onSentinelScroll, { passive: true });
      cleanups.push(() => {
        window.removeEventListener("scroll", onSentinelScroll);
        if (sentinelRafId !== null) cancelAnimationFrame(sentinelRafId);
      });
      updateSentinels();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
  document.addEventListener("astro:page-load", run);
  document.addEventListener("astro:before-swap", () => {
    while (cleanups.length) cleanups.pop()!();
  });
}
