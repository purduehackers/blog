import type { clickSummary } from "../lib/admin/clicks";
import type { ratingSummary } from "../lib/admin/ratings";
import { useEffect, useRef, useState } from "react";
import type { ImportedPage } from "../lib/admin/notion";
import type { progress } from "../lib/admin/campaigns";
import "../styles/newsletter-admin.css";
import { imageLayout } from "../lib/admin/image-layout";
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
export default function NewsletterAdmin() {
  const [editions, setEditions] = useState<Summary[]>([]);
  const [page, setPage] = useState<ImportedPage>();
  const [delivery, setDelivery] = useState<Progress>();
  const [clicks, setClicks] = useState<Result["clicks"]>();
  const [ratings, setRatings] = useState<Result["ratings"]>();
  const [url, setUrl] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [sender, setSender] = useState("phackers@purdue.edu");
  const paused = useRef(true);
  const mounted = useRef(true);
  async function request(
    action: string,
    extra: Record<string, string> = {},
    id = page?.id,
  ): Promise<Result> {
    const response = await fetch("/api/admin/newsletters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id, ...extra }),
    });
    const data = (await response.json()) as Result & { message?: string };
    if (!response.ok)
      throw new Error(data.message || "Request failed. Try again.");
    return data;
  }
  function update(data: Result) {
    setPage(data.page);
    setDelivery(data.progress);
    setRatings(data.ratings);
    setClicks(data.clicks);
    setEditions((items) => [
      { ...data.page },
      ...items.filter((p) => p.id !== data.page.id),
    ]);
    if (data.message) setMessage(data.message);
  }
  async function run(
    action: string,
    extra: Record<string, string> = {},
    id = page?.id,
  ) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      update(await request(action, extra, id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The operation failed.");
    } finally {
      setBusy(false);
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
    setBusy(true);
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
      setBusy(false);
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
  const disabled = !ready || busy || sending;
  const preview = page
    ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;color:#241632;background:#faf8fc;margin:0;padding:28px;line-height:1.65;overflow-wrap:anywhere}h1{font-size:32px;line-height:1.2}img{max-width:100%}table{max-width:100%}pre{white-space:pre-wrap}${notionImageStyles}</style></head><body class="notion-content"><p style="font-size:12px;color:#6b21a8;letter-spacing:2px">PURDUE HACKERS / NEWSLETTER</p><h1>${page.title.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)}</h1>${imageLayout(page.html)}</body></html>`
    : "";
  return (
    <div className="newsletter-admin" data-ready={ready}>
      <p className="loading-controls" role="status">
        Loading newsletter controls… If this message remains, reload the page.
      </p>
      <noscript>
        Enable JavaScript to import, preview, and send newsletters.
      </noscript>
      <div className="mailbox">
        <span className={`status-dot ${connected ? "connected" : ""}`} />{" "}
        <span>{sender}</span>
        <span>{connected ? "Connected" : "Setup required"}</span>
      </div>
      {!connected && (
        <p className="setup-note">
          The sender needs to be connected before sending. Follow the Microsoft
          mailbox setup in this project’s README. You can still import and
          preview an edition.
        </p>
      )}
      <div aria-live="polite" aria-atomic="true">
        {message && <p className="notice">{message}</p>}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="admin-workspace">
        <section aria-labelledby="editions-title" className="edition-list">
          <h2 id="editions-title">
            Editions <span>{editions.length}</span>
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setConfirmation("");
              void run("import", { url });
            }}
          >
            <label htmlFor="notion-url">Import from Notion</label>
            <input
              id="notion-url"
              required
              maxLength={2048}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
              placeholder="https://www.notion.so/…"
              aria-describedby="notion-import-hint"
              disabled={disabled}
            />
            <p className="hint" id="notion-import-hint">
              Connect the page to the blog’s Notion integration first. Import
              creates a saved draft.
            </p>
            <button className="primary" disabled={disabled}>
              {busy ? "Working…" : "Import edition"}
            </button>
          </form>
          <div className="saved-editions">
            {editions.length ? (
              editions.map((item) => (
                <button
                  key={item.id}
                  className={`edition-choice ${page?.id === item.id ? "selected" : ""}`}
                  disabled={disabled}
                  aria-pressed={page?.id === item.id}
                  onClick={() => {
                    setConfirmation("");
                    void run("load", {}, item.id);
                  }}
                >
                  <span>{item.title}</span>
                  <small>
                    {item.publishedAt ? "Published" : "Draft"} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString()}
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
          {page ? (
            <>
              <div className="preview-heading">
                <div>
                  <p className="eyebrow">
                    {page.publishedAt ? "Published edition" : "Draft preview"}
                  </p>
                  <h2 id="preview-title">{page.title}</h2>
                </div>
                <button disabled={disabled} onClick={() => void run("load")}>
                  Refresh status
                </button>
              </div>
              <p className="hint">
                This is a saved copy. To include later Notion edits, import the
                page again as a new draft.
              </p>
              <iframe
                title="Newsletter email preview"
                sandbox=""
                srcDoc={preview}
                className="email-preview"
              />
              <section className="admin-step" aria-labelledby="test-heading">
                <div className="step-label">01</div>
                <div>
                  <h3 id="test-heading">Check your inbox</h3>
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
                    <button disabled={disabled || !connected}>Send test</button>
                  </form>
                </div>
              </section>
              <section className="admin-step" aria-labelledby="publish-heading">
                <div className="step-label">02</div>
                <div>
                  <h3 id="publish-heading">Publish to the website</h3>
                  <p>The saved edition becomes public immediately.</p>
                  {page.publishedAt ? (
                    <a
                      className="text-link"
                      href={`/posts/${page.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View published edition ↗
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
              <section className="admin-step" aria-labelledby="send-heading">
                <div className="step-label">03</div>
                <div>
                  <h3 id="send-heading">Send to subscribers</h3>
                  <p>
                    Each reader gets a separate email with an unsubscribe link.
                    Unsubscribed readers are excluded.
                  </p>
                  {delivery?.started ? (
                    <>
                      <p className="delivery-counts" aria-live="polite">
                        {delivery.accepted} accepted · {delivery.skipped}{" "}
                        skipped · {delivery.remaining} remaining
                        {delivery.uncertain + delivery.failed > 0
                          ? ` · ${delivery.uncertain + delivery.failed} need review`
                          : ""}
                      </p>
                      {delivery.issues.map((issue) => (
                        <div className="delivery-issue" key={issue.email}>
                          <strong>{issue.email}</strong>
                          <p>{issue.message}</p>
                          <p>
                            Check this recipient in {sender} Sent Items. Choose
                            “Skip” if sent, or “Retry” only if it was not sent.
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
                            setMessage("Pausing after the current recipient…");
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
                        Keep this tab open during delivery. If it closes, reopen
                        this edition and resume. Accepted means Microsoft queued
                        the email, not confirmed inbox delivery.
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
              {clicks && (
                <section
                  className="admin-step click-stats"
                  aria-labelledby="click-stats-title"
                >
                  <div className="step-label" aria-hidden="true">
                    ↗
                  </div>
                  <div className="click-stats-content">
                    <div className="click-stats-heading">
                      <div>
                        <h3 id="click-stats-title">Link clicks</h3>
                        <p>See where readers follow your links.</p>
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
                          Unique browsers and total clicks by source. Combined
                          counts each browser once across web and email.
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
                              {["web", "email", "combined"].map((source) => (
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
                              ))}
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
                      Combined counts each browser once across web and email.
                      Repeat visits add to clicks.
                    </p>
                    <details className="click-stats-details">
                      <summary>How clicks are counted</summary>
                      <p>
                        Unique browsers estimate readership, not individual
                        people. Known bots and previews are excluded, but email
                        security scanners, multiple devices, and cleared cookies
                        can affect counts. Use Refresh stats to see the latest
                        activity.
                      </p>
                    </details>
                  </div>
                </section>
              )}
              {ratings && (
                <section className="admin-step" aria-label="Newsletter ratings">
                  <div className="step-label">🔥</div>
                  <div>
                    <h3>Reader ratings</h3>
                    <p>
                      {ratings.total} ratings ·{" "}
                      {ratings.average === null
                        ? "No ratings yet"
                        : `${ratings.average.toFixed(1)} / 5 average flames`}
                    </p>
                    <p>
                      🔥 {ratings.one} · 🔥🔥🔥 {ratings.three} · 🔥🔥🔥🔥🔥{" "}
                      {ratings.five}
                    </p>
                  </div>
                </section>
              )}
              <section className="edition-danger" aria-label="Delete edition">
                <div>
                  <h3>Delete this edition</h3>
                  <p>
                    Remove its public page, delivery history, and statistics.
                  </p>
                </div>
                <button
                  className="danger-button"
                  disabled={disabled}
                  onClick={() => void deleteCurrent()}
                >
                  Delete newsletter
                </button>
              </section>
            </>
          ) : (
            <div className="preview-empty">
              <h2 id="preview-title">From Notion to inbox.</h2>
              <p>
                Import an edition to preview it here, send a test, and share it
                with the collective.
              </p>
              <ol className="empty-workflow" aria-label="Newsletter workflow">
                <li>Import from Notion</li>
                <li>Preview and send a test</li>
                <li>Publish and send</li>
              </ol>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
