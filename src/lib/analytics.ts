// Optional PostHog usage analytics. DISABLED by default for WorkspaceAlberta
// appliance privacy — set WA_ANALYTICS=1 or ENABLE_ANALYTICS=1 to opt in.
// The phc_ token is a write-only public key (safe to ship in the client).
import posthog from "posthog-js";

const TOKEN = "phc_m2hP39w8y2gLPvHgDvSXAu6xcZ3agjf4ruL56rGcMZEe";

let ready = false;

// Analytics are disabled by default for privacy; opt in via environment
function analyticsEnabled(): boolean {
  // Check for opt-in environment variables (injected at build time or runtime)
  if (typeof window !== "undefined") {
    // @ts-expect-error — injected by build or electron
    const env = window.__WA_ENV__ ?? {};
    if (env.WA_ANALYTICS === "1" || env.ENABLE_ANALYTICS === "1") return true;
  }
  // Check localStorage for explicit opt-in
  if (typeof localStorage !== "undefined" && localStorage.getItem("wa-analytics-opt-in") === "1") {
    return true;
  }
  return false;
}

export function initAnalytics() {
  if (ready || !analyticsEnabled()) return;
  posthog.init(TOKEN, {
    api_host: "https://us.i.posthog.com",
    autocapture: true,
    capture_pageview: false, // single-window desktop app — no page routes
    person_profiles: "identified_only",
    persistence: "localStorage",
  });
  ready = true;
  const platform = navigator.userAgent.includes("Electron") ? "desktop" : "browser";
  // one-time install marker — app_first_open counts installs
  if (!localStorage.getItem("wa-installed")) {
    localStorage.setItem("wa-installed", new Date().toISOString());
    posthog.capture("app_first_open", { platform, app: "workspacealberta" });
  }
  posthog.capture("app_opened", { platform, app: "workspacealberta" });
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!ready) return;
  posthog.capture(event, { ...props, app: "workspacealberta" });
}

export function identifyEmail(email: string) {
  if (!ready) return;
  posthog.identify(email, { email, app: "workspacealberta" });
  posthog.capture("email_submitted");
}

// first-run email gate state
const GATE_KEY = "wa-email-gate";
export function emailGateDone(): boolean {
  // Also check legacy key for migration
  return Boolean(localStorage.getItem(GATE_KEY) || localStorage.getItem("omb-email-gate"));
}
export function setEmailGateDone(status: "submitted" | "skipped") {
  localStorage.setItem(GATE_KEY, status);
}
