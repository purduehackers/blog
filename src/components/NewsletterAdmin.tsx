import type { clickSummary } from "../lib/admin/clicks";
import type { ratingSummary } from "../lib/admin/ratings";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  Download,
  Edit2,
  Eye,
  Monitor,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
} from "react-feather";
import type { ImportedPage } from "../lib/admin/notion";
import type { progress } from "../lib/admin/campaigns";
import "../styles/newsletter-admin.css";
import { isPreservedLayout, imageLayout } from "../lib/admin/image-layout";
import { newsletterMediaUrls } from "../lib/admin/media-urls";
import notionImageStyles from "../styles/notion-images.css?inline";

type Progress = Awaited<ReturnType<typeof progress>>;
type Summary = Omit<ImportedPage, "html" | "createdBy">;
interface Result {
  page: ImportedPage;
  progress: Progress;
  clicks: Awaited<ReturnType<typeof clickSummary>>;
  ratings: Awaited<ReturnType<typeof ratingSummary>>;
  message?: string;
}
const editionViews = [
  { id: "preview", label: "Preview", Icon: Eye },
  { id: "delivery", label: "Delivery", Icon: Send },
  { id: "engagement", label: "Engagement", Icon: Activity },
] as const;

export default function NewsletterAdmin() {
  const [editions, setEditions] = useState<Summary[]>([]);
  const [view, setView] =
    useState<(typeof editionViews)[number]["id"]>("preview");
  const [phonePreview, setPhonePreview] = useState(false);
  const [loadingEditions, setLoadingEditions] = useState(true);
  const [openingEdition, setOpeningEdition] = useState<string>();
  const [page, setPage] = useState<ImportedPage>();
  const [delivery, setDelivery] = useState<Progress>();
  const [clicks, setClicks] = useState<Result["clicks"]>();
  const [ratings, setRatings] = useState<Result["ratings"]>();
  const [url, setUrl] = useState("");
  const [importTitle, setImportTitle] = useState("");
  const [importError, setImportError] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [sender, setSender] = useState("phackers@purdue.edu");
  const paused = useRef(true);
  const mounted = useRef(true);
  const importDialog = useRef<HTMLDialogElement>(null);
  const renameDialog = useRef<HTMLDialogElement>(null);
  async function request<T = Result>(
    action: string,
    extra: Record<string, string> = {},
    id = page?.id,
  ): Promise<T> {
    const response = await fetch("/api/admin/newsletters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id, ...extra }),
    });
    const data = (await response.json()) as T & { message?: string };
    if (!response.ok)
      throw new Error(data.message || "Request failed. Try again.");
    return data;
  }
  function updatePage(page: ImportedPage) {
    const { html: _html, createdBy: _createdBy, ...summary } = page;
    setPage(page);
    setEditions((items) =>
      [summary, ...items.filter((p) => p.id !== page.id)].sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          a.id.localeCompare(b.id),
      ),
    );
  }
  function updateStats(data: Omit<Result, "page">) {
    setDelivery(data.progress);
    setRatings(data.ratings);
    setClicks(data.clicks);
  }
  function update(data: Result) {
    updatePage(data.page);
    updateStats(data);
    if (data.message) setMessage(data.message);
  }
  async function selectEdition(id: string) {
    setPendingAction("switch");
    setOpeningEdition(id);
    setView("preview");
    setConfirmation("");
    setMessage("");
    setError("");
    try {
      const [previewResult, statsResult] = await Promise.allSettled([
        request<Pick<Result, "page">>("preview", {}, id).then(({ page }) => {
          updatePage(page);
          setOpeningEdition(undefined);
          setDelivery(undefined);
          setRatings(undefined);
          setClicks(undefined);
        }),
        request<Omit<Result, "page">>("stats", {}, id),
      ]);
      if (previewResult.status === "rejected") throw previewResult.reason;
      if (statsResult.status === "rejected") {
        setError(
          "Could not load delivery status or statistics. Use Refresh status to retry.",
        );
      } else {
        updateStats(statsResult.value);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open this edition.");
    } finally {
      setPendingAction(undefined);
      setOpeningEdition(undefined);
    }
  }
  async function run(
    action: string,
    extra: Record<string, string> = {},
    id = page?.id,
    onSuccess?: () => void,
  ) {
    setPendingAction(action);
    setMessage("");
    setError("");
    try {
      update(await request(action, extra, id));
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The operation failed.");
    } finally {
      setPendingAction(undefined);
    }
  }
  async function importNewsletter() {
    if (disabled) return;
    setPendingAction("import");
    setImportError("");
    setMessage("");
    setError("");
    try {
      update(await request("import", { url: url.trim(), title: importTitle }));
      setMessage("Newsletter imported as a draft.");
      setConfirmation("");
      setView("preview");
      setUrl("");
      setImportTitle("");
      importDialog.current?.close();
    } catch (e) {
      setImportError(
        e instanceof Error
          ? e.message
          : "Could not import the newsletter. Try again.",
      );
    } finally {
      setPendingAction(undefined);
    }
  }
  async function deleteCurrent() {
    if (!page || disabled) return;
    const id = page.id;
    if (
      !window.confirm(
        `Delete “${page.title}”? This permanently removes the saved edition, public page, media, delivery history, and statistics. The Notion source and emails already sent are unchanged.`,
      )
    )
      return;
    setPendingAction("delete");
    setMessage("");
    setError("");
    try {
      await request("delete", { confirmation: "DELETE" }, id);
      setEditions((items) => items.filter((item) => item.id !== id));
      setPage(undefined);
      setDelivery(undefined);
      setClicks(undefined);
      setRatings(undefined);
      setConfirmation("");
      setMessage("Newsletter deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete newsletter.");
    } finally {
      setPendingAction(undefined);
    }
  }
  useEffect(() => {
    mounted.current = true;
    setReady(true);
    (async () => {
      try {
        const response = await fetch("/api/admin/newsletters");
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.message || "Could not load editions.");
        if (mounted.current) {
          setEditions(data.editions);
          setConnected(data.connected);
          setSender(data.sender);
        }
      } catch (e) {
        if (mounted.current)
          setError(e instanceof Error ? e.message : "Could not load editions.");
      } finally {
        if (mounted.current) setLoadingEditions(false);
      }
    })();
    return () => {
      mounted.current = false;
      paused.current = true;
    };
  }, []);
  async function deliver(start: boolean) {
    if (!page) return;
    const id = page.id;
    setSending(true);
    setError("");
    setMessage("");
    paused.current = false;
    try {
      let result = await request(
        start ? "start" : "load",
        start ? { confirmation } : {},
        id,
      );
      update(result);
      while (
        mounted.current &&
        !paused.current &&
        result.progress.remaining > 0 &&
        !result.progress.issues.length
      ) {
        result = await request("next", {}, id);
        if (mounted.current) update(result);
        if (!paused.current)
          await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (mounted.current)
        setMessage(
          result.progress.issues.length
            ? "Delivery paused. Review the recipient below before continuing."
            : paused.current
              ? "Paused. You can resume from this edition later."
              : "Delivery finished. Microsoft has accepted the emails shown below.",
        );
    } catch (e) {
      if (mounted.current)
        setError(
          `${e instanceof Error ? e.message : "Delivery interrupted."} Reload this edition to check saved progress before resuming.`,
        );
    } finally {
      paused.current = true;
      if (mounted.current) setSending(false);
    }
  }
  const busy = pendingAction !== undefined;
  const importing = pendingAction === "import";
  const reimporting = pendingAction === "reimport";
  const disabled = !ready || busy || sending;
  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const deliveryStatus = !delivery
    ? busy
      ? "Loading"
      : "Unavailable"
    : !delivery.started
      ? "Not sent"
      : sending
        ? "Sending"
        : delivery.issues.length
          ? "Needs review"
          : delivery.remaining > 0
            ? "Paused"
            : "Finished";
  const preview = useMemo(
    () =>
      page
        ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;color:#241632;background:#faf8fc;margin:0;padding:28px;line-height:1.65;overflow-wrap:anywhere}h1{font-size:32px;line-height:1.2}img{max-width:100%}table{max-width:100%}pre{white-space:pre-wrap}${isPreservedLayout(page.html) ? "" : notionImageStyles}@media(max-width:600px){.notion-columns,.notion-columns tbody,.notion-columns tr,.notion-column{display:block!important;width:100%!important;box-sizing:border-box}}.notion-column img{max-width:100%;height:auto}</style></head><body class="notion-content"><p style="font-size:12px;color:#6b21a8;letter-spacing:2px">PURDUE HACKERS / NEWSLETTER</p><h1>${page.title.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)}</h1>${imageLayout(newsletterMediaUrls(page.html))}</body></html>`
        : "",
    [page?.title, page?.html],
  );
  return (
    <div className="newsletter-admin" data-ready={ready}>
      <p className="loading-controls" role="status">
        Loading newsletter controls… If this message remains, reload the page.
      </p>
      <noscript>
        Enable JavaScript to import, preview, and send newsletters.
      </noscript>
      <div className="admin-feedback" aria-live="polite" aria-atomic="true">
        {reimporting && (
          <span className="sr-only">Updating preview from Notion.</span>
        )}
        {message && <p className="notice">{message}</p>}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="admin-workspace">
        <section aria-labelledby="editions-title" className="edition-list">
          <div className="editions-header">
            <h2 id="editions-title">Editions</h2>
            <button
              type="button"
              className="primary import-trigger"
              aria-haspopup="dialog"
              disabled={disabled && !importing}
              onClick={() => {
                setImportError("");
                importDialog.current?.showModal();
              }}
            >
              <Download size={16} aria-hidden="true" />
              Import newsletter
            </button>
          </div>
          <div className="saved-editions" aria-busy={loadingEditions}>
            {loadingEditions ? (
              <p className="empty" role="status">
                Loading editions…
              </p>
            ) : editions.length ? (
              editions.map((item) => (
                <button
                  key={item.id}
                  className={`edition-choice ${page?.id === item.id ? "selected" : ""}`}
                  disabled={disabled}
                  aria-pressed={page?.id === item.id}
                  aria-labelledby={`edition-title-${item.id}`}
                  aria-describedby={`edition-meta-${item.id}`}
                  onClick={() => {
                    if (page?.id !== item.id) void selectEdition(item.id);
                  }}
                >
                  <span
                    className="edition-choice-title"
                    id={`edition-title-${item.id}`}
                  >
                    {item.title}
                    <ChevronRight size={15} aria-hidden="true" />
                  </span>
                  <small id={`edition-meta-${item.id}`}>
                    <span
                      className={`edition-state ${item.publishedAt ? "is-published" : ""}`}
                    >
                      {item.publishedAt ? "Published" : "Draft"}
                    </span>
                    <time dateTime={item.createdAt}>
                      {formatDate(item.createdAt)}
                    </time>
                  </small>
                </button>
              ))
            ) : (
              <p className="empty">
                No editions yet. Start with a Notion page.
              </p>
            )}
          </div>
        </section>
        <section
          aria-labelledby="preview-title"
          className="edition-detail"
          aria-busy={busy || sending}
        >
          {openingEdition ? (
            <div className="preview-empty">
              <h2 id="preview-title" role="status">
                Opening{" "}
                {editions.find((item) => item.id === openingEdition)?.title ??
                  "edition"}
                …
              </h2>
              <div className="preview-loading-indicator" aria-hidden="true" />
            </div>
          ) : page ? (
            <>
              <div className="preview-heading">
                <div>
                  <div className="edition-heading-status">
                    <span
                      className={`edition-state ${page.publishedAt ? "is-published" : ""}`}
                    >
                      {page.publishedAt ? "Published" : "Draft"}
                    </span>
                    <span
                      className={`delivery-state ${delivery?.issues.length ? "needs-review" : ""}`}
                    >
                      Email: {deliveryStatus.toLowerCase()}
                    </span>
                  </div>
                  <div className="edition-name">
                    <h2 id="preview-title">{page.title}</h2>
                    <button
                      type="button"
                      className="icon-action"
                      aria-label="Rename newsletter"
                      title="Rename newsletter"
                      aria-haspopup="dialog"
                      disabled={disabled}
                      onClick={() => {
                        setError("");
                        renameDialog.current?.showModal();
                      }}
                    >
                      <Edit2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {page.publishedAt && (
                  <a
                    className="text-link published-link"
                    href={`/posts/${page.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on blog <ArrowUpRight size={15} aria-hidden="true" />
                  </a>
                )}
                <button
                  type="button"
                  className="icon-action danger-button"
                  aria-label="Delete newsletter"
                  title="Delete newsletter"
                  disabled={disabled}
                  onClick={() => void deleteCurrent()}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
              <dl className="edition-meta">
                <div>
                  <dt>Imported</dt>
                  <dd>
                    <time dateTime={page.createdAt}>
                      {formatDate(page.createdAt)}
                    </time>
                  </dd>
                </div>
                {page.publishedAt && (
                  <div>
                    <dt>Published</dt>
                    <dd>
                      <time dateTime={page.publishedAt}>
                        {formatDate(page.publishedAt)}
                      </time>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Layout</dt>
                  <dd>
                    {page.importMode === "notion-layout"
                      ? "Notion original"
                      : "Newsletter"}
                  </dd>
                </div>
              </dl>
              <dialog
                ref={renameDialog}
                className="import-dialog"
                aria-labelledby="rename-dialog-title"
                onClose={(event) =>
                  event.currentTarget.querySelector("form")?.reset()
                }
                onCancel={(event) => {
                  if (pendingAction === "rename") event.preventDefault();
                }}
              >
                <header className="import-dialog-header">
                  <h2 id="rename-dialog-title">Rename newsletter</h2>
                </header>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const title = new FormData(event.currentTarget).get(
                      "title",
                    );
                    void run(
                      "rename",
                      { title: String(title ?? "") },
                      page.id,
                      () => renameDialog.current?.close(),
                    );
                  }}
                >
                  <div className="import-dialog-fields">
                    <div>
                      <label htmlFor="edition-title">Newsletter name</label>
                      <input
                        key={`${page.id}:${page.title}`}
                        id="edition-title"
                        name="title"
                        defaultValue={page.title}
                        required
                        maxLength={200}
                        readOnly={pendingAction === "rename"}
                      />
                    </div>
                    {error && (
                      <p className="notice error" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                  <footer className="import-dialog-footer">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => renameDialog.current?.close()}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="primary"
                      disabled={disabled}
                    >
                      {pendingAction === "rename"
                        ? "Saving name…"
                        : "Save name"}
                    </button>
                  </footer>
                </form>
              </dialog>
              <div
                className="edition-tabs"
                role="tablist"
                aria-label="Edition views"
              >
                {editionViews.map(({ id, label, Icon }, index) => (
                  <button
                    type="button"
                    key={id}
                    id={`tab-${id}`}
                    role="tab"
                    aria-selected={view === id}
                    aria-controls={`panel-${id}`}
                    tabIndex={view === id ? 0 : -1}
                    onClick={() => setView(id)}
                    onKeyDown={(event) => {
                      const last = editionViews.length - 1;
                      const next = {
                        ArrowLeft: index === 0 ? last : index - 1,
                        ArrowRight: index === last ? 0 : index + 1,
                        Home: 0,
                        End: last,
                      }[event.key];
                      const tab =
                        next === undefined ? undefined : editionViews[next]?.id;
                      if (!tab) return;
                      event.preventDefault();
                      setView(tab);
                      document.getElementById(`tab-${tab}`)?.focus();
                    }}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {label}
                    {id === "delivery" && !!delivery?.issues.length && (
                      <span className="review-dot">
                        <span className="sr-only">needs review</span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <section
                className="preview-pane edition-panel"
                id="panel-preview"
                role="tabpanel"
                aria-labelledby="tab-preview"
                hidden={view !== "preview"}
              >
                <div className="pane-heading">
                  <div
                    className="preview-width"
                    role="group"
                    aria-label="Preview width"
                  >
                    <button
                      type="button"
                      aria-pressed={!phonePreview}
                      onClick={() => setPhonePreview(false)}
                    >
                      <Monitor size={15} aria-hidden="true" /> Wide
                    </button>
                    <button
                      type="button"
                      aria-pressed={phonePreview}
                      onClick={() => setPhonePreview(true)}
                    >
                      <Smartphone size={15} aria-hidden="true" /> Phone
                    </button>
                  </div>
                  <div className="preview-actions">
                    <a
                      className="text-link"
                      href={`https://www.notion.so/${page.notionId.replace(/-/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Notion <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-describedby={
                        page.publishedAt ? "reimport-hint" : undefined
                      }
                      onClick={() => void run("reimport")}
                    >
                      <RefreshCw size={14} aria-hidden="true" />
                      {reimporting ? "Reimporting…" : "Reimport from Notion"}
                    </button>
                  </div>
                </div>
                {page.publishedAt && (
                  <p className="preview-hint" id="reimport-hint">
                    Reimporting updates the live edition at the same link.
                  </p>
                )}
                <div
                  className={`preview-stage ${phonePreview ? "is-phone" : ""}`}
                >
                  {reimporting ? (
                    <div className="email-preview preview-loading">
                      <div
                        className="preview-loading-indicator"
                        aria-hidden="true"
                      />
                      <p>Updating preview from Notion…</p>
                    </div>
                  ) : (
                    <iframe
                      title="Newsletter email preview"
                      sandbox=""
                      srcDoc={preview}
                      className="email-preview"
                    />
                  )}
                </div>
              </section>
              <section
                className="edition-panel"
                id="panel-delivery"
                role="tabpanel"
                aria-labelledby="tab-delivery"
                tabIndex={0}
                hidden={view !== "delivery"}
              >
                <div className="mailbox">
                  <span
                    className={`status-dot ${connected ? "connected" : ""}`}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{sender}</strong>
                    <p>
                      {loadingEditions
                        ? "Checking mailbox…"
                        : connected
                          ? "Mailbox connected"
                          : "Mailbox setup required"}
                    </p>
                  </div>
                  <button disabled={disabled} onClick={() => void run("load")}>
                    <RefreshCw size={14} aria-hidden="true" /> Refresh status
                  </button>
                </div>
                {!connected && !loadingEditions && (
                  <p className="setup-note">
                    Follow the Microsoft mailbox setup in the project README to
                    enable sending.
                  </p>
                )}
                <div className="dispatch-panel">
                  <section
                    className="admin-step"
                    aria-labelledby="test-heading"
                  >
                    <div>
                      <h3 id="test-heading">Send a test</h3>
                      <p>Send yourself a test to check the layout and links.</p>
                      <form
                        className="inline-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void run("test", { email: testEmail });
                        }}
                      >
                        <label className="sr-only" htmlFor="test-email">
                          Test recipient email
                        </label>
                        <input
                          type="email"
                          id="test-email"
                          required
                          maxLength={254}
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          placeholder="you@purdue.edu"
                          disabled={disabled}
                        />
                        <button disabled={disabled || !connected}>
                          Send test
                        </button>
                      </form>
                    </div>
                  </section>
                  <section
                    className="admin-step"
                    aria-labelledby="publish-heading"
                  >
                    <div>
                      <h3 id="publish-heading">Website</h3>
                      <p>
                        {page.publishedAt
                          ? "This edition is live on the blog."
                          : "Publish this saved copy to the blog before sending."}
                      </p>
                      {page.publishedAt ? (
                        <a
                          className="text-link"
                          href={`/posts/${page.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View published edition
                        </a>
                      ) : (
                        <button
                          disabled={disabled}
                          onClick={() => void run("publish")}
                        >
                          Publish edition
                        </button>
                      )}
                    </div>
                  </section>
                  <section
                    className="admin-step"
                    aria-labelledby="send-heading"
                  >
                    <div>
                      <div className="send-heading">
                        <h3 id="send-heading">Subscriber email</h3>
                        <span className="delivery-state">{deliveryStatus}</span>
                      </div>
                      <p>
                        Each reader gets a separate email with an unsubscribe
                        link. Unsubscribed readers are excluded.
                      </p>
                      {!delivery ? (
                        <p>
                          {busy
                            ? "Loading delivery status…"
                            : "Refresh status to load delivery details."}
                        </p>
                      ) : delivery.started ? (
                        <>
                          <div className="delivery-progress" aria-live="polite">
                            <label htmlFor="delivery-progress">
                              {delivery.accepted} of {delivery.total} accepted
                            </label>
                            <progress
                              id="delivery-progress"
                              max={delivery.total || 1}
                              value={delivery.accepted}
                            />
                            <dl className="delivery-counts">
                              <div>
                                <dt>Remaining</dt>
                                <dd>{delivery.remaining}</dd>
                              </div>
                              <div>
                                <dt>Skipped</dt>
                                <dd>{delivery.skipped}</dd>
                              </div>
                              <div>
                                <dt>Need review</dt>
                                <dd>{delivery.uncertain + delivery.failed}</dd>
                              </div>
                            </dl>
                          </div>
                          {delivery.issues.map((issue) => (
                            <div className="delivery-issue" key={issue.email}>
                              <strong>{issue.email}</strong>
                              <p>{issue.message}</p>
                              <p>
                                Check this recipient in {sender} Sent Items.
                                Choose “Skip” if sent, or “Retry” only if it was
                                not sent.
                              </p>
                              <button
                                disabled={disabled}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "I reviewed Sent Items. Do not send another email to this recipient.",
                                    )
                                  )
                                    void run("resolve", {
                                      email: issue.email,
                                      resolution: "skip",
                                      confirmation: "REVIEWED",
                                    });
                                }}
                              >
                                Skip recipient
                              </button>{" "}
                              <button
                                disabled={disabled}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "I verified this email was not sent. Allow a retry?",
                                    )
                                  )
                                    void run("resolve", {
                                      email: issue.email,
                                      resolution: "retry",
                                      confirmation: "REVIEWED",
                                    });
                                }}
                              >
                                Retry after review
                              </button>
                            </div>
                          ))}
                          {sending ? (
                            <button
                              onClick={() => {
                                paused.current = true;
                                setMessage(
                                  "Pausing after the current recipient…",
                                );
                              }}
                            >
                              Pause after current email
                            </button>
                          ) : (
                            delivery.remaining > 0 && (
                              <button
                                className="primary"
                                disabled={
                                  busy || !connected || !!delivery.issues.length
                                }
                                onClick={() => void deliver(false)}
                              >
                                Resume delivery
                              </button>
                            )
                          )}
                          <p className="hint">
                            Keep this tab open during delivery. If it closes,
                            reopen this edition and resume. Accepted means
                            Microsoft queued the email, not confirmed inbox
                            delivery.
                          </p>
                        </>
                      ) : (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void deliver(true);
                          }}
                        >
                          <label htmlFor="send-confirmation">
                            Type SEND to confirm
                          </label>
                          <div className="inline-form">
                            <input
                              id="send-confirmation"
                              value={confirmation}
                              onChange={(e) => setConfirmation(e.target.value)}
                              autoComplete="off"
                              disabled={disabled || !page.publishedAt}
                            />
                            <button
                              className="primary"
                              disabled={
                                disabled ||
                                !connected ||
                                !page.publishedAt ||
                                confirmation !== "SEND"
                              }
                            >
                              Send newsletter
                            </button>
                          </div>
                          {!page.publishedAt && (
                            <p className="hint">Publish the edition first.</p>
                          )}
                        </form>
                      )}
                    </div>
                  </section>
                </div>
              </section>
              <section
                className="edition-panel"
                id="panel-engagement"
                role="tabpanel"
                aria-labelledby="tab-engagement"
                tabIndex={0}
                hidden={view !== "engagement"}
              >
                {!clicks && !ratings && (
                  <div className="panel-empty">
                    <p role="status">
                      {busy
                        ? "Loading engagement…"
                        : "Engagement data is unavailable."}
                    </p>
                    {!busy && (
                      <button
                        disabled={disabled}
                        onClick={() => void run("load")}
                      >
                        Refresh stats
                      </button>
                    )}
                  </div>
                )}
                <div className="edition-results">
                  {clicks && (
                    <section
                      className="admin-step click-stats"
                      aria-labelledby="click-stats-title"
                    >
                      <div className="click-stats-content">
                        <div className="click-stats-heading">
                          <div>
                            <h3 id="click-stats-title">Link clicks</h3>
                            <p>
                              Unique browsers and total clicks, by destination.
                            </p>
                          </div>
                          <button
                            disabled={disabled}
                            onClick={() => void run("load")}
                          >
                            Refresh stats
                          </button>
                        </div>
                        <div
                          className="click-table-scroll"
                          role="region"
                          aria-label="Link click statistics"
                          tabIndex={0}
                        >
                          <table className="click-table">
                            <caption className="sr-only">
                              Unique browsers and total clicks by source.
                              Combined counts each browser once across web and
                              email.
                            </caption>
                            <colgroup>
                              <col className="click-link-column" />
                              <col />
                              <col />
                              <col className="click-combined-column" />
                            </colgroup>
                            <thead>
                              <tr>
                                <th scope="col">Destination</th>
                                <th scope="col">Web</th>
                                <th scope="col">Email</th>
                                <th scope="col">Combined</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { url: "All links", counts: clicks.totals },
                                ...clicks.links,
                              ].map((link, index) => (
                                <tr
                                  key={link.url}
                                  className={
                                    index === 0 ? "click-total-row" : undefined
                                  }
                                >
                                  <th scope="row">
                                    {index === 0 ? (
                                      "All links"
                                    ) : (
                                      <span className="click-destination">
                                        {link.url}
                                      </span>
                                    )}
                                  </th>
                                  {["web", "email", "combined"].map(
                                    (source) => (
                                      <td key={source}>
                                        <span className="click-browser-count">
                                          {(
                                            link.counts[source]?.visitors || 0
                                          ).toLocaleString()}{" "}
                                          <span>browsers</span>
                                        </span>
                                        <span className="click-event-count">
                                          {(
                                            link.counts[source]?.clicks || 0
                                          ).toLocaleString()}{" "}
                                          clicks
                                        </span>
                                      </td>
                                    ),
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {clicks.links.length === 0 && (
                          <div className="click-empty">
                            <strong>No link clicks yet</strong>
                            <p>
                              {page.publishedAt
                                ? "Clicks will appear here as readers open links in this edition on the web or in email."
                                : "Publish this edition to start collecting clicks from the web and email."}
                            </p>
                          </div>
                        )}
                        <p className="click-stats-note">
                          Combined counts each browser once across web and
                          email. Repeat visits add to clicks.
                        </p>
                        <details className="click-stats-details">
                          <summary>How clicks are counted</summary>
                          <p>
                            Unique browsers estimate readership, not individual
                            people. Known bots and previews are excluded, but
                            email security scanners, multiple devices, and
                            cleared cookies can affect counts. Use Refresh stats
                            to see the latest activity.
                          </p>
                        </details>
                      </div>
                    </section>
                  )}
                  {ratings && (
                    <section
                      className="admin-step"
                      aria-label="Newsletter ratings"
                    >
                      <div>
                        <h3>Reader ratings</h3>
                        <p className="rating-summary">
                          {ratings.average === null ? (
                            "No ratings yet"
                          ) : (
                            <>
                              <strong>{ratings.average.toFixed(1)}</strong> / 5
                              average flames
                            </>
                          )}
                          <span>
                            {ratings.total.toLocaleString()}{" "}
                            {ratings.total === 1 ? "response" : "responses"}
                          </span>
                        </p>
                        <div className="rating-distribution">
                          {(
                            [
                              [5, "This was gold!", ratings.five],
                              [3, "Solid issue", ratings.three],
                              [1, "Meh", ratings.one],
                            ] as const
                          ).map(([score, label, count]) => (
                            <div className="rating-row" key={score}>
                              <div>
                                <span>
                                  <span aria-hidden="true">🔥</span> {score}{" "}
                                  <span className="rating-label">{label}</span>
                                </span>
                                <strong>{count.toLocaleString()}</strong>
                              </div>
                              <meter
                                min={0}
                                max={ratings.total || 1}
                                value={count}
                                aria-label={`${score} flames: ${count} of ${ratings.total} responses`}
                              />
                            </div>
                          ))}
                        </div>
                        {!ratings.total && (
                          <p className="hint">
                            Readers can rate this edition from their email.
                          </p>
                        )}
                      </div>
                    </section>
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="preview-empty">
              <Eye size={26} aria-hidden="true" />
              <h2 id="preview-title">
                {loadingEditions
                  ? "Loading newsletters…"
                  : editions.length
                    ? "Choose an edition"
                    : "Import your first newsletter"}
              </h2>
              {!loadingEditions && (
                <p>
                  {editions.length
                    ? "Select an edition to preview it, manage delivery, or see how readers engaged."
                    : "Use Import newsletter to create a draft from a Notion page."}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
      <dialog
        ref={importDialog}
        className="import-dialog"
        aria-labelledby="import-dialog-title"
        aria-describedby="import-dialog-description"
        onCancel={(e) => {
          if (importing) e.preventDefault();
        }}
      >
        <header className="import-dialog-header">
          <h2 id="import-dialog-title">Import newsletter</h2>
          <p id="import-dialog-description">
            Create a saved draft from a Notion page.
          </p>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void importNewsletter();
          }}
        >
          <div className="import-dialog-fields">
            <div>
              <label htmlFor="notion-url">Notion page URL</label>
              <input
                id="notion-url"
                required
                maxLength={2048}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                type="url"
                placeholder="https://www.notion.so/…"
                disabled={importing}
              />
            </div>
            <div>
              <label htmlFor="import-title">
                Newsletter name <span>(optional)</span>
              </label>
              <input
                id="import-title"
                value={importTitle}
                onChange={(e) => setImportTitle(e.target.value)}
                maxLength={200}
                placeholder="Use Notion page title"
                disabled={importing}
              />
            </div>
            {importError && (
              <p className="notice error" role="alert">
                {importError}
              </p>
            )}
          </div>
          <footer className="import-dialog-footer">
            <span className="sr-only" role="status">
              {importing ? "Importing newsletter from Notion." : ""}
            </span>
            <button
              type="button"
              disabled={importing}
              onClick={() => importDialog.current?.close()}
            >
              Cancel
            </button>
            <button type="submit" className="primary" disabled={importing}>
              {importing ? "Importing…" : "Import newsletter"}
            </button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
