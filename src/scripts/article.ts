/** Reading tools derive from the rendered article, including imported newsletters. */
export function initializeArticle() {
  const article = document.querySelector<HTMLElement>("[data-article-body]");
  if (!article) return;

  initializeContents(article);

  const readingTime = document.querySelector<HTMLElement>(
    "[data-reading-time]",
  );
  const readingLabel = document.querySelector<HTMLElement>(
    "[data-reading-time-label]",
  );
  if (readingTime && readingLabel) {
    const copy = article.cloneNode(true) as HTMLElement;
    copy
      .querySelectorAll(
        "script, style, astro-island, button, input, select, textarea, [data-no-reading-time]",
      )
      .forEach((element) => element.remove());
    const words =
      copy.textContent?.trim().split(/\s+/).filter(Boolean).length ?? 0;
    readingLabel.textContent = `${Math.max(1, Math.ceil(words / 225))} minute read`;
    readingTime.hidden = false;
  }

  const copyButton =
    document.querySelector<HTMLButtonElement>("[data-copy-url]");
  const copyLabel = document.querySelector<HTMLElement>("[data-copy-label]");
  const copyIcon = document.querySelector<HTMLElement>("[data-copy-icon]");
  const copiedIcon = document.querySelector<HTMLElement>("[data-copied-icon]");
  if (copyButton && copyLabel && copyIcon && copiedIcon) {
    copyButton.hidden = false;
    let reset: ReturnType<typeof setTimeout>;
    copyButton.addEventListener("click", async () => {
      clearTimeout(reset);
      try {
        await navigator.clipboard.writeText(
          `${window.location.origin}${window.location.pathname}`,
        );
        copyLabel.textContent = "Copied!";
        copyIcon.hidden = true;
        copiedIcon.hidden = false;
      } catch {
        copyLabel.textContent = "Copy from the address bar";
      }
      reset = setTimeout(() => {
        copyLabel.textContent = "Copy URL";
        copyIcon.hidden = false;
        copiedIcon.hidden = true;
      }, 2500);
    });
  }
}

function initializeContents(article: HTMLElement) {
  const panel = document.querySelector<HTMLElement>("[data-article-contents]");
  const list = panel?.querySelector<HTMLOListElement>(
    "[data-article-contents-list]",
  );
  const toggle = panel?.querySelector<HTMLDetailsElement>(
    "[data-article-contents-toggle]",
  );
  if (!panel || !list || !toggle) return;

  const headings = Array.from(
    article.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
  ).filter(
    (heading) =>
      !heading.closest("astro-island, [data-no-toc], [hidden]") &&
      heading.textContent?.trim(),
  );
  if (headings.length < 2) return;

  // Keep a flat list: legacy posts mix heading levels for peer sections.
  // Every link reserves the same indicator space, including the active link.
  const links = headings.map((heading) => {
    const label = heading.textContent!.trim().replace(/\s+/g, " ");
    if (!heading.id) {
      const base =
        label
          .normalize("NFKD")
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-|-$/g, "") || "section";
      let id = base;
      let suffix = 2;
      while (document.getElementById(id)) id = `${base}-${suffix++}`;
      heading.id = id;
    }

    const link = document.createElement("a");
    link.href = `#${encodeURIComponent(heading.id)}`;
    link.textContent = label;
    const item = document.createElement("li");
    item.append(link);
    list.append(item);
    return link;
  });

  panel.hidden = false;
  document
    .querySelector("[data-article-layout]")
    ?.classList.add("has-article-contents");
  const desktop = window.matchMedia("(min-width: 1100px)");
  toggle.open = desktop.matches;
  desktop.addEventListener("change", (event) => {
    toggle.open = event.matches;
  });

  let current = -1;
  const updateCurrent = () => {
    let next = 0;
    for (let index = 0; index < headings.length; index++) {
      if (headings[index]!.getBoundingClientRect().top > 120) break;
      next = index;
    }
    if (next === current) return;
    links[current]?.removeAttribute("aria-current");
    links[next]!.setAttribute("aria-current", "location");
    current = next;
  };
  let scheduled = false;
  const scheduleUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updateCurrent();
    });
  };
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.addEventListener("load", scheduleUpdate, { once: true });
  updateCurrent();
}
