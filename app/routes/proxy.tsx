// App Proxy route — serves the teacher portal SPA
// Shopify hits /apps/faculty → this loader validates the HMAC and returns HTML
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { liquid } = await authenticate.public.appProxy(request);

  const APP_URL = process.env.SHOPIFY_APP_URL || "";

  return liquid(portalHTML(APP_URL));
}

function portalHTML(appUrl: string): string {
  return `
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200;0,6..72,400;0,6..72,600;1,6..72,200;1,6..72,400&family=Red+Hat+Text:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>${CSS}</style>
<div id="tgc-root"></div>
<script>
window.__TGC_APP_URL__ = ${JSON.stringify(appUrl)};
</script>
<script>${JS}</script>
`;
}

// ─────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────
const CSS = `
:root {
  --tgc-primary: #000000;
  --tgc-navy: #1a2340;
  --tgc-gold: #c9a84c;
  --tgc-gold-light: #e8d9a0;
  --tgc-bg: #ffffff;
  --tgc-card: #ffffff;
  --tgc-border: #e6e6e6;
  --tgc-text: #000000;
  --tgc-text-secondary: #666666;
  --tgc-success: #2e7d4f;
  --tgc-error: #c0392b;
  --tgc-warning: #d4a017;
  --tgc-radius: 6px;
  --tgc-shadow: 0 1px 3px rgba(0,0,0,.06);
  --tgc-shadow-lg: 0 4px 16px rgba(0,0,0,.08);
  --tgc-font: "Newsreader", Georgia, "Times New Roman", serif;
  --tgc-font-sans: "Red Hat Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --tgc-max-w: 920px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--tgc-font-sans);
  background: var(--tgc-bg);
  color: var(--tgc-text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

.tgc-header {
  background: #000;
  color: #fff;
  padding: 18px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid #222;
}

.tgc-logo {
  font-family: var(--tgc-font);
  font-size: 22px;
  font-weight: 200;
  letter-spacing: .3px;
  color: #fff;
}

.tgc-logo span { color: rgba(255,255,255,.6); font-weight: 200; }

.tgc-header-nav { display: flex; gap: 8px; align-items: center; }

.tgc-header-nav a, .tgc-header-nav button {
  color: rgba(255,255,255,.8);
  text-decoration: none;
  font-size: 14px;
  padding: 6px 12px;
  border-radius: var(--tgc-radius);
  border: none;
  background: none;
  cursor: pointer;
  transition: all .15s;
}

.tgc-header-nav a:hover, .tgc-header-nav button:hover {
  background: rgba(255,255,255,.12);
  color: #fff;
}

.tgc-header-nav a.active {
  background: rgba(201,168,76,.2);
  color: var(--tgc-gold);
}

.tgc-main {
  max-width: var(--tgc-max-w);
  margin: 0 auto;
  padding: 32px 24px;
}

.tgc-card {
  background: var(--tgc-card);
  border: 1px solid var(--tgc-border);
  border-radius: var(--tgc-radius);
  padding: 32px;
  box-shadow: var(--tgc-shadow);
  margin-bottom: 24px;
}

.tgc-card h2 {
  font-family: var(--tgc-font);
  font-size: 26px;
  font-weight: 200;
  margin-bottom: 16px;
  color: var(--tgc-text);
  line-height: 1.4;
}

.tgc-card h3 {
  font-family: var(--tgc-font);
  font-size: 18px;
  font-weight: 400;
  margin-bottom: 12px;
  color: var(--tgc-text);
}

.tgc-form-group { margin-bottom: 20px; }

.tgc-form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--tgc-text);
}

.tgc-form-group .hint {
  font-size: 12px;
  color: var(--tgc-text-secondary);
  margin-top: 4px;
}

input[type="text"], input[type="email"], input[type="url"], input[type="number"],
input[type="tel"], textarea, select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--tgc-border);
  border-radius: var(--tgc-radius);
  font-size: 15px;
  font-family: var(--tgc-font-sans);
  background: #fff;
  transition: border-color .15s;
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--tgc-gold);
  box-shadow: 0 0 0 3px rgba(201,168,76,.15);
}

textarea { resize: vertical; min-height: 100px; }

.tgc-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: var(--tgc-radius);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all .15s;
  text-decoration: none;
}

.tgc-btn-primary {
  background: var(--tgc-navy);
  color: #fff;
}

.tgc-btn-primary:hover { background: #243052; }

.tgc-btn-gold {
  background: var(--tgc-gold);
  color: var(--tgc-navy);
}

.tgc-btn-gold:hover { background: #b8972f; }

.tgc-btn-outline {
  background: transparent;
  color: var(--tgc-navy);
  border: 1px solid var(--tgc-border);
}

.tgc-btn-outline:hover { border-color: var(--tgc-navy); }

.tgc-btn-danger {
  background: var(--tgc-error);
  color: #fff;
}

.tgc-btn-sm { padding: 6px 14px; font-size: 13px; }

.tgc-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.tgc-btn-row { display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; }

.tgc-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .3px;
}

.tgc-badge-green { background: #e8f5e9; color: var(--tgc-success); }
.tgc-badge-yellow { background: #fff8e1; color: var(--tgc-warning); }
.tgc-badge-red { background: #fdecea; color: var(--tgc-error); }
.tgc-badge-blue { background: #e3f2fd; color: #1565c0; }
.tgc-badge-gray { background: #f5f5f5; color: #666; }

.tgc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.tgc-table th, .tgc-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--tgc-border);
}

.tgc-table th {
  font-weight: 600;
  color: var(--tgc-text-secondary);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .5px;
}

.tgc-table tr:hover { background: rgba(201,168,76,.04); }

.tgc-stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }

.tgc-stat {
  background: var(--tgc-card);
  border: 1px solid var(--tgc-border);
  border-radius: var(--tgc-radius);
  padding: 20px;
  text-align: center;
}

.tgc-stat-value {
  font-family: var(--tgc-font);
  font-size: 28px;
  font-weight: 700;
  color: var(--tgc-navy);
}

.tgc-stat-label {
  font-size: 12px;
  color: var(--tgc-text-secondary);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-top: 4px;
}

.tgc-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--tgc-navy);
  color: #fff;
  padding: 12px 24px;
  border-radius: var(--tgc-radius);
  font-size: 14px;
  box-shadow: var(--tgc-shadow-lg);
  z-index: 1000;
  animation: tgc-slide-up .3s ease-out;
}

.tgc-toast-error { background: var(--tgc-error); }
.tgc-toast-success { background: var(--tgc-success); }

@keyframes tgc-slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.tgc-loading {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.tgc-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--tgc-border);
  border-top-color: var(--tgc-gold);
  border-radius: 50%;
  animation: tgc-spin .7s linear infinite;
}

@keyframes tgc-spin { to { transform: rotate(360deg); } }

.tgc-login-page {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tgc-login-card {
  max-width: 420px;
  width: 100%;
  text-align: center;
}

.tgc-login-card h1 {
  font-family: var(--tgc-font);
  font-size: 28px;
  color: var(--tgc-navy);
  margin-bottom: 8px;
}

.tgc-login-card p {
  color: var(--tgc-text-secondary);
  margin-bottom: 24px;
}

.tgc-row { display: flex; gap: 16px; }
.tgc-row > * { flex: 1; }

.tgc-divider {
  border: none;
  border-top: 1px solid var(--tgc-border);
  margin: 24px 0;
}

.tgc-empty {
  text-align: center;
  padding: 48px 24px;
  color: var(--tgc-text-secondary);
}

.tgc-empty h3 { color: var(--tgc-navy); margin-bottom: 8px; }

.tgc-progress-bar {
  height: 8px;
  background: var(--tgc-border);
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
}

.tgc-progress-fill {
  height: 100%;
  background: var(--tgc-gold);
  border-radius: 4px;
  transition: width .3s;
}

.tgc-alert {
  padding: 14px 18px;
  border-radius: var(--tgc-radius);
  font-size: 14px;
  margin-bottom: 20px;
}

.tgc-alert-info { background: #e3f2fd; color: #1565c0; border: 1px solid #bbdefb; }
.tgc-alert-warning { background: #fff8e1; color: #8d6e00; border: 1px solid #ffe082; }
.tgc-alert-error { background: #fdecea; color: var(--tgc-error); border: 1px solid #f5c6cb; }
.tgc-alert-success { background: #e8f5e9; color: var(--tgc-success); border: 1px solid #c8e6c9; }

@media (max-width: 700px) {
  .tgc-row { flex-direction: column; }
  .tgc-header { padding: 12px 16px; }
  .tgc-main { padding: 20px 16px; }
  .tgc-card { padding: 20px; }
  .tgc-stat-row { grid-template-columns: repeat(2, 1fr); }
}
`;

// ─────────────────────────────────────────────
// JavaScript SPA — all user content rendered
// via textContent or the esc() helper which
// uses textContent-based escaping
// ─────────────────────────────────────────────
const JS = `
(function(){
"use strict";

var API = window.__TGC_APP_URL__;
var root = document.getElementById("tgc-root");

// ─── State ───
var state = {
  token: null,
  faculty: null,
  view: "loading",
  viewParam: null,
  offerings: [],
  availability: null,
  media: [],
  loading: false,
  toasts: []
};

// ─── Helpers ───
function $(sel, el) { return (el || document).querySelector(sel); }
function $$(sel, el) { return Array.from((el || document).querySelectorAll(sel)); }

function api(path, opts) {
  opts = opts || {};
  var headers = { "Content-Type": "application/json" };
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  return fetch(API + path, Object.assign({ headers: headers }, opts))
    .then(function(r) {
      if (r.status === 401) { logout(); throw new Error("Session expired"); }
      return r.json().catch(function() {
        // If response isn't valid JSON, return a structured error
        if (!r.ok) throw new Error("Server error (" + r.status + ")");
        return {};
      });
    });
}

function toast(msg, type) {
  var id = Date.now();
  state.toasts.push({ id: id, msg: msg, type: type || "info" });
  renderToasts();
  setTimeout(function() {
    state.toasts = state.toasts.filter(function(t) { return t.id !== id; });
    renderToasts();
  }, 4000);
}

function renderToasts() {
  var container = document.getElementById("tgc-toasts");
  if (!container) {
    container = document.createElement("div");
    container.id = "tgc-toasts";
    document.body.appendChild(container);
  }
  while (container.firstChild) container.removeChild(container.firstChild);
  state.toasts.forEach(function(t) {
    var el = document.createElement("div");
    el.className = "tgc-toast" + (t.type === "error" ? " tgc-toast-error" : t.type === "success" ? " tgc-toast-success" : "");
    el.textContent = t.msg;
    container.appendChild(el);
  });
}

function navigate(hash) {
  window.location.hash = hash;
}

function getHash() {
  var h = window.location.hash.replace(/^#\\/?/, "");
  if (!h || h === "/") return "";
  return h;
}

function statusBadgeHTML(status) {
  if (!status) status = "unknown";
  var map = {
    active: "green", approved: "green", live: "green", synced: "green",
    pending_review: "yellow", pending_approval: "yellow", pending: "yellow",
    draft: "gray", applicant: "blue",
    rejected: "red", suspended: "red", failed: "red",
    changes_requested: "yellow", paused: "gray", archived: "gray",
    public: "green", admin_only: "yellow", private: "gray"
  };
  var c = map[status] || "gray";
  var span = document.createElement("span");
  span.className = "tgc-badge tgc-badge-" + c;
  span.textContent = status.replace(/_/g, " ");
  return span;
}

function esc(s) {
  if (s == null) return "";
  return String(s);
}

function txt(parent, s) {
  parent.appendChild(document.createTextNode(s == null ? "" : String(s)));
}

function el(tag, attrs, children) {
  var e = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(function(k) {
      if (k === "className") e.className = attrs[k];
      else if (k === "style" && typeof attrs[k] === "object") Object.assign(e.style, attrs[k]);
      else if (k.indexOf("on") === 0) e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
  }
  if (children) {
    if (!Array.isArray(children)) children = [children];
    children.forEach(function(c) {
      if (typeof c === "string") e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    });
  }
  return e;
}

function formatDate(d) {
  if (!d) return "\\u2014";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function clearEl(e) { while (e.firstChild) e.removeChild(e.firstChild); }

// ─── Auth ───
function checkAuth() {
  var h = window.location.hash;
  var tokenMatch = h.match(/token=([^&]+)/);
  if (tokenMatch) {
    state.token = tokenMatch[1];
    localStorage.setItem("tgc_jwt", state.token);
    window.location.hash = "#/dashboard";
    return;
  }

  state.token = localStorage.getItem("tgc_jwt");
  if (!state.token) {
    state.view = "login";
    render();
    return;
  }

  loadProfile();
}

function logout() {
  state.token = null;
  state.faculty = null;
  localStorage.removeItem("tgc_jwt");
  navigate("/login");
}

window.__tgcLogout = logout;

function loadProfile() {
  state.loading = true;
  render();
  api("/api/me").then(function(data) {
    if (!data.faculty) {
      state.loading = false;
      state.token = null;
      localStorage.removeItem("tgc_jwt");
      state.view = "login";
      render();
      return;
    }
    state.faculty = data.faculty;
    state.loading = false;
    routeByStatus();
  }).catch(function() {
    state.loading = false;
    state.token = null;
    localStorage.removeItem("tgc_jwt");
    state.view = "login";
    render();
  });
}

function routeByStatus() {
  var h = getHash();
  var s = state.faculty.status;

  if (s === "applicant" && h !== "apply") { navigate("/apply"); return; }
  if ((s === "pending_review" || s === "rejected" || s === "changes_requested") && h !== "status" && h !== "apply") {
    navigate("/status"); return;
  }
  if (!h || h === "login") { navigate("/dashboard"); return; }
  handleRoute();
}

// ─── Router ───
function handleRoute() {
  var h = getHash();
  var parts = h.split("/").filter(Boolean);

  if (!state.token && h !== "login" && h !== "") { state.view = "login"; render(); return; }

  if (parts[0] === "login" || h === "") {
    if (state.token && state.faculty) { routeByStatus(); return; }
    state.view = "login";
  } else if (parts[0] === "apply") { state.view = "apply"; }
  else if (parts[0] === "status") { state.view = "status"; }
  else if (parts[0] === "dashboard") { state.view = "dashboard"; }
  else if (parts[0] === "profile") { state.view = "profile"; }
  else if (parts[0] === "offerings") {
    if (parts[1] === "new") { state.view = "offering-new"; }
    else if (parts[1]) { state.view = "offering-detail"; state.viewParam = parts[1]; }
    else { state.view = "offerings"; }
  }
  else if (parts[0] === "availability") { state.view = "availability"; }
  else if (parts[0] === "media") { state.view = "media"; }
  else if (parts[0] === "policies") { state.view = "policies"; }
  else { state.view = "dashboard"; }

  render();

  // Load data for relevant views
  if (state.view === "offerings" || state.view === "offering-new" || state.view === "offering-detail") loadOfferings();
  if (state.view === "availability") loadAvailability();
  if (state.view === "media") loadMedia();
}

window.addEventListener("hashchange", function() {
  if (state.token && state.faculty) handleRoute();
  else checkAuth();
});

// ─── Render Engine ───
function render() {
  clearEl(root);

  if (state.view === "loading") {
    root.appendChild(el("div", { className: "tgc-loading" }, [el("div", { className: "tgc-spinner" })]));
    return;
  }

  if (state.view === "login") {
    root.appendChild(buildHeader(false));
    root.appendChild(buildLogin());
    return;
  }

  root.appendChild(buildHeader(true));
  var main = el("div", { className: "tgc-main" });

  if (state.loading) {
    main.appendChild(el("div", { className: "tgc-loading" }, [el("div", { className: "tgc-spinner" })]));
  } else {
    switch (state.view) {
      case "apply": main.appendChild(buildApply()); break;
      case "status": main.appendChild(buildStatus()); break;
      case "dashboard": main.appendChild(buildDashboard()); break;
      case "profile": main.appendChild(buildProfile()); break;
      case "offerings": main.appendChild(buildOfferings()); break;
      case "offering-new": main.appendChild(buildOfferingForm(null)); break;
      case "offering-detail": main.appendChild(buildOfferingForm(state.viewParam)); break;
      case "availability": main.appendChild(buildAvailability()); break;
      case "media": main.appendChild(buildMedia()); break;
      case "policies": main.appendChild(buildPolicies()); break;
      default: main.appendChild(buildDashboard());
    }
  }

  root.appendChild(main);
}

// ─── Header ───
function buildHeader(authenticated) {
  var header = el("header", { className: "tgc-header" });
  var logo = el("div", { className: "tgc-logo" }, ["The Global Conservatory "]);
  logo.appendChild(el("span", null, ["Faculty"]));
  header.appendChild(logo);

  var nav = el("nav", { className: "tgc-header-nav" });

  if (authenticated && state.faculty) {
    var s = state.faculty.status;
    var isActive = s === "active" || s === "approved";
    if (isActive) {
      var links = [
        ["dashboard", "Dashboard"], ["profile", "Profile"], ["offerings", "Offerings"],
        ["availability", "Availability"], ["media", "Media"], ["policies", "Policies"]
      ];
      links.forEach(function(l) {
        var a = el("a", { href: "#/" + l[0] }, [l[1]]);
        var v = state.view;
        if (v === l[0] || (v.indexOf("offering") === 0 && l[0] === "offerings")) a.className = "active";
        nav.appendChild(a);
      });
    }
    var logoutBtn = el("button", { onClick: function() { logout(); } }, ["Sign Out"]);
    nav.appendChild(logoutBtn);
  }

  header.appendChild(nav);
  return header;
}

// ─── Login ───
function buildLogin() {
  var wrap = el("div", { className: "tgc-main" });
  var page = el("div", { className: "tgc-login-page" });
  var card = el("div", { className: "tgc-card tgc-login-card" });

  card.appendChild(el("h1", null, ["Faculty Portal"]));
  card.appendChild(el("p", null, ["Sign in with your email to access your teaching dashboard, manage offerings, and update your profile."]));

  var fg = el("div", { className: "tgc-form-group" });
  var emailInput = el("input", { type: "email", id: "tgc-login-email", placeholder: "you@example.com" });
  fg.appendChild(emailInput);
  card.appendChild(fg);

  var msg = el("div", { id: "tgc-login-msg", style: { marginTop: "16px", fontSize: "14px" } });

  // Code input section (hidden initially)
  var codeSection = el("div", { id: "tgc-code-section", style: { display: "none", marginTop: "16px" } });
  var codeLabel = el("p", { style: { fontWeight: "500", marginBottom: "8px" } }, ["Enter the 6-digit code from your email:"]);
  var codeInput = el("input", {
    type: "text",
    id: "tgc-login-code",
    placeholder: "000000",
    maxLength: "6",
    style: {
      width: "100%",
      textAlign: "center",
      fontSize: "24px",
      letterSpacing: "8px",
      fontFamily: "monospace",
      padding: "12px"
    }
  });
  var verifyBtn = el("button", { className: "tgc-btn tgc-btn-gold", style: { width: "100%", marginTop: "12px" } }, ["Verify Code"]);
  codeSection.appendChild(codeLabel);
  codeSection.appendChild(codeInput);
  codeSection.appendChild(verifyBtn);

  var sentEmail = sessionStorage.getItem("tgc_pending_email") || "";

  // Restore code section if user already requested a code (survives page refresh)
  if (sentEmail) {
    emailInput.value = sentEmail;
    codeSection.style.display = "block";
  }

  var sendBtn = el("button", { className: "tgc-btn tgc-btn-gold", style: { width: "100%" } }, [sentEmail ? "Resend Code" : "Send Code"]);
  sendBtn.addEventListener("click", function() {
    var email = emailInput.value.trim();
    if (!email || email.indexOf("@") < 0) {
      clearEl(msg);
      msg.appendChild(el("span", { style: { color: "var(--tgc-error)" } }, ["Please enter a valid email address."]));
      return;
    }
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";

    fetch(API + "/api/auth/request-magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      clearEl(msg);
      if (data.success) {
        sentEmail = email;
        sessionStorage.setItem("tgc_pending_email", email);
        msg.appendChild(el("span", { style: { color: "var(--tgc-success)" } }, ["Code sent! Check your email."]));
        sendBtn.textContent = "Resend Code";
        sendBtn.disabled = false;
        codeSection.style.display = "block";
        codeInput.focus();
      } else {
        msg.appendChild(el("span", { style: { color: "var(--tgc-error)" } }, [data.error || "Something went wrong."]));
        sendBtn.disabled = false;
        sendBtn.textContent = "Send Code";
      }
    })
    .catch(function() {
      clearEl(msg);
      msg.appendChild(el("span", { style: { color: "var(--tgc-error)" } }, ["Network error. Please try again."]));
      sendBtn.disabled = false;
      sendBtn.textContent = "Send Code";
    });
  });

  // Verify code handler
  verifyBtn.addEventListener("click", function() {
    var code = codeInput.value.trim();
    if (!code || code.length !== 6) {
      clearEl(msg);
      msg.appendChild(el("span", { style: { color: "var(--tgc-error)" } }, ["Please enter the 6-digit code from your email."]));
      return;
    }
    verifyBtn.disabled = true;
    verifyBtn.textContent = "Verifying...";

    fetch(API + "/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: sentEmail, code: code })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success && data.token) {
        sessionStorage.removeItem("tgc_pending_email");
        localStorage.setItem("tgc_jwt", data.token);
        state.token = data.token;
        loadProfile();
      } else {
        clearEl(msg);
        msg.appendChild(el("span", { style: { color: "var(--tgc-error)" } }, [data.error || "Invalid code. Please try again."]));
        verifyBtn.disabled = false;
        verifyBtn.textContent = "Verify Code";
      }
    })
    .catch(function() {
      clearEl(msg);
      msg.appendChild(el("span", { style: { color: "var(--tgc-error)" } }, ["Network error. Please try again."]));
      verifyBtn.disabled = false;
      verifyBtn.textContent = "Verify Code";
    });
  });

  // Allow Enter key on inputs
  emailInput.addEventListener("keydown", function(e) { if (e.key === "Enter") sendBtn.click(); });
  codeInput.addEventListener("keydown", function(e) { if (e.key === "Enter") verifyBtn.click(); });

  // Auto-format: only allow digits in code input
  codeInput.addEventListener("input", function() {
    codeInput.value = codeInput.value.replace(/[^0-9]/g, "").slice(0, 6);
  });

  card.appendChild(sendBtn);
  card.appendChild(msg);
  card.appendChild(codeSection);
  card.appendChild(el("hr", { className: "tgc-divider" }));
  card.appendChild(el("p", { style: { fontSize: "13px", color: "var(--tgc-text-secondary)" } }, ["New to TGC? Enter your email to begin the application process."]));

  page.appendChild(card);
  wrap.appendChild(page);
  return wrap;
}

// ─── Apply ───
function buildApply() {
  var f = state.faculty || {};
  var ad = (f.application && f.application.applicationData) || {};
  var isResubmit = f.status === "changes_requested";
  var card = el("div", { className: "tgc-card" });
  card.appendChild(el("h2", { style: { fontFamily: "var(--tgc-font)", fontWeight: "200" } }, [isResubmit ? "Update Your Application" : "Apply to Teach at TGC"]));
  if (isResubmit && f.application && f.application.reviewNotes) {
    var alertBox = el("div", { className: "tgc-alert tgc-alert-warning", style: { marginBottom: "20px" } });
    alertBox.appendChild(el("strong", null, ["Requested changes: "]));
    alertBox.appendChild(document.createTextNode(f.application.reviewNotes));
    card.appendChild(alertBox);
  }
  card.appendChild(el("p", { style: { marginBottom: "24px", color: "var(--tgc-text-secondary)" } }, [isResubmit ? "Make the requested changes and resubmit." : "Complete the form below. Our team reviews every application personally."]));
  card.appendChild(el("p", { style: { marginBottom: "24px", fontSize: "13px", color: "var(--tgc-error)" } }, ["* Indicates required question"]));

  // ─── Helpers ───
  function fg(labelText, inputEl, hint) {
    var g = el("div", { className: "tgc-form-group" });
    g.appendChild(el("label", null, [labelText]));
    g.appendChild(inputEl);
    if (hint) g.appendChild(el("div", { className: "hint" }, [hint]));
    return g;
  }
  function row(children) {
    var r = el("div", { className: "tgc-row" });
    children.forEach(function(c) { r.appendChild(c); });
    return r;
  }
  function selectEl(id, options, selected) {
    var s = el("select", { id: id });
    options.forEach(function(o) {
      var val = typeof o === "string" ? o : o[0];
      var label = typeof o === "string" ? o : o[1];
      var opt = el("option", { value: val }, [label]);
      if (selected && val === selected) opt.selected = true;
      s.appendChild(opt);
    });
    return s;
  }
  function sectionTitle(num, title) {
    var h = el("h3", { style: { fontFamily: "var(--tgc-font)", fontWeight: "400", fontSize: "18px", marginTop: "32px", marginBottom: "4px", paddingBottom: "8px", borderBottom: "2px solid var(--tgc-gold)" } }, ["Section " + num + ": " + title]);
    return h;
  }
  function checkboxGroup(id, options, selectedArr) {
    var wrap = el("div", { id: id, style: { display: "flex", flexDirection: "column", gap: "8px" } });
    options.forEach(function(opt) {
      var val = typeof opt === "string" ? opt : opt[0];
      var label = typeof opt === "string" ? opt : opt[1];
      var lbl = el("label", { style: { display: "flex", alignItems: "center", gap: "8px", fontWeight: "normal", cursor: "pointer" } });
      var cb = el("input", { type: "checkbox", value: val });
      if (selectedArr && selectedArr.indexOf(val) >= 0) cb.checked = true;
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(label));
      wrap.appendChild(lbl);
    });
    return wrap;
  }
  function getChecked(id) {
    var wrap = document.getElementById(id);
    if (!wrap) return [];
    var checked = [];
    var boxes = wrap.querySelectorAll("input[type=checkbox]");
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].checked) checked.push(boxes[i].value);
    }
    return checked;
  }
  function radioGroup(id, options, selected) {
    var wrap = el("div", { id: id, style: { display: "flex", flexDirection: "column", gap: "8px" } });
    options.forEach(function(opt) {
      var val = typeof opt === "string" ? opt : opt[0];
      var label = typeof opt === "string" ? opt : opt[1];
      var lbl = el("label", { style: { display: "flex", alignItems: "center", gap: "8px", fontWeight: "normal", cursor: "pointer" } });
      var rb = el("input", { type: "radio", name: id, value: val });
      if (selected && val === selected) rb.checked = true;
      lbl.appendChild(rb);
      lbl.appendChild(document.createTextNode(label));
      wrap.appendChild(lbl);
    });
    return wrap;
  }
  function getRadio(name) {
    var rb = document.querySelector("input[name='" + name + "']:checked");
    return rb ? rb.value : "";
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ""; }

  // Pre-populate helper
  function p(field) { return isResubmit ? (ad[field] || f[field] || "") : ""; }
  function pa(field) { return isResubmit ? (ad[field] || f[field] || []) : []; }

  // ════════════════════════════════════════════
  // SECTION 1: Identity
  // ════════════════════════════════════════════
  card.appendChild(sectionTitle("1", "Identity"));

  var nameParts = (p("fullName") || "").split(" ");
  var firstName = nameParts[0] || "";
  var lastName = nameParts.slice(1).join(" ") || "";

  card.appendChild(row([
    fg("Full Name *", el("input", { type: "text", id: "app-name", value: isResubmit ? p("fullName") : "" })),
    fg("Public / Stage Name", el("input", { type: "text", id: "app-public", placeholder: "How you want to appear on the site", value: p("publicName") }))
  ]));

  card.appendChild(fg("Phone Number *", el("input", { type: "tel", id: "app-phone", placeholder: "+1234567890", value: p("phone") }), "Format: +<country code><number> (no spaces)"));

  card.appendChild(fg("Country / Time Zone *", el("input", { type: "text", id: "app-country-tz", placeholder: "Italy / Europe/Rome", value: isResubmit ? ((p("country") || "") + (p("timezone") ? " / " + p("timezone") : "")) : "" }), "Example: Italy / Europe/Rome"));

  card.appendChild(fg("Preferred Contact Method *", radioGroup("app-contact-method", ["Email", "WhatsApp", "Telegram", "Other"], p("preferredContactMethod"))));

  // ════════════════════════════════════════════
  // SECTION 2: Teaching Profile
  // ════════════════════════════════════════════
  card.appendChild(sectionTitle("2", "Teaching Profile"));

  var instruments = [["","Select..."],"Voice","Piano","Violin","Viola","Cello","Double Bass","Flute","Oboe","Clarinet","Bassoon","Trumpet","French Horn","Trombone","Tuba","Percussion","Guitar","Harp","Composition","Theory","Conducting","Chamber Music","Music Business","Music Technology","Other"];
  card.appendChild(fg("Primary Instrument / Subject *", selectEl("app-instrument", instruments, p("primaryInstrument"))));

  card.appendChild(fg("Styles / Genres *", checkboxGroup("app-genres", ["Classical", "Jazz", "Pop", "Rock", "Folk", "Film/Media", "Improvisation", "Other"], pa("genres"))));

  card.appendChild(fg("Languages for Teaching *", checkboxGroup("app-langs", ["English", "Italian", "French", "German", "Spanish", "Other"], pa("teachingLanguages"))));

  card.appendChild(fg("Student Age Range *", checkboxGroup("app-ages", [["children_6_12","Children (6\u201312)"], ["teens_13_17","Teens (13\u201317)"], ["adults_18","Adults (18+)"]], pa("studentAgeRange"))));

  // ════════════════════════════════════════════
  // SECTION 3: Credentials
  // ════════════════════════════════════════════
  card.appendChild(sectionTitle("3", "Credentials"));

  card.appendChild(fg("Years of Teaching Experience *", el("input", { type: "number", id: "app-years", min: "0", max: "60", value: isResubmit ? String(p("yearsExperience") || "") : "" })));

  card.appendChild(fg("Highest Music Qualification *", radioGroup("app-qualification", ["Diploma/None", "Bachelor", "Master", "Doctorate", "Other"], p("highestQualification"))));

  card.appendChild(fg("Current / Recent Roles", checkboxGroup("app-roles", ["University/Conservatory Faculty", "Touring/Recording", "Private Studio", "Freelance", "Other"], pa("currentRoles"))));

  var awardsTA = el("textarea", { id: "app-awards", placeholder: "Competitions, awards, notable achievements..." });
  if (isResubmit) awardsTA.value = p("awards") || "";
  card.appendChild(fg("Awards / Notable Achievements", awardsTA));

  var cvTA = el("textarea", { id: "app-cv-links", placeholder: "One link per line: website, CV, press articles..." });
  if (isResubmit) cvTA.value = p("cvLinks") || "";
  card.appendChild(fg("CV / Website / Press Links", cvTA));

  // ════════════════════════════════════════════
  // SECTION 4: Bio & Media
  // ════════════════════════════════════════════
  card.appendChild(sectionTitle("4", "Bio & Media"));

  var bioTA = el("textarea", { id: "app-bio", placeholder: "2-3 sentences about your background and teaching philosophy", maxlength: "500", style: { minHeight: "100px" } });
  if (isResubmit) bioTA.value = p("shortBio") || "";
  card.appendChild(fg("Short Bio (public) *", bioTA, "Max 500 characters \u2014 this will appear on your public profile"));

  card.appendChild(fg("Headshot URL *", el("input", { type: "url", id: "app-head", placeholder: "https://...", value: p("headshotUrl") }), "Direct link to a professional headshot (Google Drive, Dropbox, etc.)"));

  card.appendChild(fg("Portfolio / Work Samples", el("input", { type: "url", id: "app-portfolio", placeholder: "https://...", value: p("portfolioUrl") }), "Link to recordings, videos, or portfolio"));

  card.appendChild(fg("Permanent Zoom Link", el("input", { type: "url", id: "app-zoom", placeholder: "https://zoom.us/j/...", value: p("zoomLink") }), "Static Zoom link for lessons/events. Optional now; will be required at launch."));

  card.appendChild(row([
    fg("Instagram", el("input", { type: "text", id: "app-ig", placeholder: "@handle", value: p("socialInstagram") })),
    fg("YouTube", el("input", { type: "url", id: "app-yt", placeholder: "https://youtube.com/...", value: p("socialYoutube") }))
  ]));

  card.appendChild(fg("Website", el("input", { type: "url", id: "app-web", placeholder: "https://...", value: p("websiteUrl") })));

  // ════════════════════════════════════════════
  // SECTION 5: What You Offer
  // ════════════════════════════════════════════
  card.appendChild(sectionTitle("5", "What You Offer"));

  var classTypeOptions = [
    ["private_lesson", "Private Lesson (Online. 1:1 live session. 30/60/120 minutes.)"],
    ["masterclass", "Masterclass (Online. One-time event. Few performers + observers. 60\u2013120 min.)"],
    ["studio_class", "Studio Class (Online. Fixed cohort, weekly across a term.)"],
    ["group_lesson", "Group Lesson (Online. Short block or ongoing weekly class. Larger cohort.)"]
  ];
  var classTypeCB = checkboxGroup("app-class-types", classTypeOptions, pa("classTypes"));
  card.appendChild(fg("Class Types you are willing to teach *", classTypeCB, "Note: In-person is not included at launch."));

  card.appendChild(fg("Levels you teach *", checkboxGroup("app-levels", ["Beginner", "Intermediate", "Advanced", "Pre-Professional", "Professional"], pa("levels"))));

  card.appendChild(fg("Durations you can teach (online) *", checkboxGroup("app-durations", [["30","30 minutes"], ["60","60 minutes"], ["120","120 minutes"]], pa("durations"))));

  card.appendChild(fg("Typical Weekly Lesson Slots You Can Offer *", el("input", { type: "text", id: "app-weekly-slots", placeholder: "e.g. 10-15 slots per week", value: p("weeklySlots") })));

  card.appendChild(fg("What is your teaching style? *", checkboxGroup("app-style", ["Structured", "Creative", "Exam/Goal Oriented", "Other"], pa("teachingStyle"))));

  // ─── Section 5.1: Masterclass (conditional) ───
  var mcSection = el("div", { id: "app-mc-section", style: { display: "none", paddingLeft: "16px", borderLeft: "3px solid var(--tgc-gold-light)" } });
  mcSection.appendChild(el("h4", { style: { fontFamily: "var(--tgc-font)", fontWeight: "400", marginTop: "16px", marginBottom: "12px" } }, ["Section 5.1: Masterclass Details"]));
  var mcTopicsTA = el("textarea", { id: "app-mc-topics", placeholder: "Topics you would teach in a masterclass..." });
  if (isResubmit) mcTopicsTA.value = p("masterclassTopics") || "";
  mcSection.appendChild(fg("Masterclass Topic Areas", mcTopicsTA));
  mcSection.appendChild(fg("Typical Masterclass Length", radioGroup("app-mc-length", [["60","60 minutes"], ["90","90 minutes"], ["120","120 minutes"]], p("masterclassLength"))));
  mcSection.appendChild(fg("Performer Seats (min\u2013max)", el("input", { type: "text", id: "app-mc-performers", placeholder: "e.g. 4\u20138", value: p("masterclassPerformerSeats") })));
  mcSection.appendChild(fg("Observer Capacity (max)", el("input", { type: "text", id: "app-mc-observers", placeholder: "e.g. 50", value: p("masterclassObserverCapacity") })));
  mcSection.appendChild(fg("Recording OK for ticket holders?", radioGroup("app-mc-recording", ["Yes", "No"], p("masterclassRecordingOk"))));
  card.appendChild(mcSection);

  // ─── Section 5.2: Studio Class (conditional) ───
  var scSection = el("div", { id: "app-sc-section", style: { display: "none", paddingLeft: "16px", borderLeft: "3px solid var(--tgc-gold-light)" } });
  scSection.appendChild(el("h4", { style: { fontFamily: "var(--tgc-font)", fontWeight: "400", marginTop: "16px", marginBottom: "12px" } }, ["Section 5.2: Studio Class Details"]));
  scSection.appendChild(fg("Preferred Term", radioGroup("app-sc-term", ["Sep\u2013Dec", "Sep\u2013May", "Other"], p("studioClassTerm"))));
  scSection.appendChild(fg("Weekly Time Commitment", radioGroup("app-sc-hours", [["2","2 hours"], ["3","3 hours"], ["4","4 hours"]], p("studioClassHours"))));
  scSection.appendChild(fg("Target Cohort Size", radioGroup("app-sc-cohort", ["5\u20138", "9\u201312", "13\u201315"], p("studioClassCohortSize"))));
  scSection.appendChild(fg("Syllabus or Outline (link)", el("input", { type: "url", id: "app-sc-syllabus", placeholder: "https://...", value: p("studioClassSyllabus") })));
  card.appendChild(scSection);

  // ─── Section 5.3: Group Lesson (conditional) ───
  var glSection = el("div", { id: "app-gl-section", style: { display: "none", paddingLeft: "16px", borderLeft: "3px solid var(--tgc-gold-light)" } });
  glSection.appendChild(el("h4", { style: { fontFamily: "var(--tgc-font)", fontWeight: "400", marginTop: "16px", marginBottom: "12px" } }, ["Section 5.3: Group Lesson Details"]));
  var glTopicsTA = el("textarea", { id: "app-gl-topics", placeholder: "Proposed topics for group lessons..." });
  if (isResubmit) glTopicsTA.value = p("groupLessonTopics") || "";
  glSection.appendChild(fg("Proposed Group Lesson Topic(s)", glTopicsTA));
  glSection.appendChild(fg("Format", radioGroup("app-gl-format", ["Ongoing weekly", "6-week block", "8-week block", "12-week block"], p("groupLessonFormat"))));
  glSection.appendChild(fg("Target Class Size", radioGroup("app-gl-size", ["8\u201312", "13\u201318", "19\u201325"], p("groupLessonSize"))));
  card.appendChild(glSection);

  // Toggle conditional sections based on class type checkboxes
  function toggleClassSections() {
    var checked = getChecked("app-class-types");
    mcSection.style.display = checked.indexOf("masterclass") >= 0 ? "block" : "none";
    scSection.style.display = checked.indexOf("studio_class") >= 0 ? "block" : "none";
    glSection.style.display = checked.indexOf("group_lesson") >= 0 ? "block" : "none";
  }
  classTypeCB.addEventListener("change", toggleClassSections);
  // Show on load if resubmit
  if (isResubmit) setTimeout(toggleClassSections, 0);

  // ════════════════════════════════════════════
  // SECTION 6: Pricing
  // ════════════════════════════════════════════
  card.appendChild(sectionTitle("6", "Pricing"));

  card.appendChild(fg("Your Base Rate for a 60-minute online private lesson (USD) *", el("input", { type: "number", id: "app-base-rate", min: "0", step: "5", placeholder: "e.g. 120", value: p("baseRate") }), "TGC sets all final prices from a standard table. Provide your 60-minute (1 hour) base rate. 120-minute rates are derived. Masterclass, Studio, and Group pricing are set by TGC using platform standards."));

  // ════════════════════════════════════════════
  // SECTION 7: Availability & Scheduling
  // ════════════════════════════════════════════
  card.appendChild(sectionTitle("7", "Availability & Scheduling"));

  // Availability grid
  var gridWrap = el("div", { style: { overflowX: "auto", marginBottom: "16px" } });
  var gridLabel = el("label", null, ["Availability *"]);
  gridWrap.appendChild(gridLabel);
  gridWrap.appendChild(el("p", { style: { fontSize: "13px", color: "var(--tgc-text-secondary)", marginBottom: "8px" } }, ["Select your available days and times for teaching."]));
  var table = el("table", { id: "app-avail-grid", style: { width: "100%", borderCollapse: "collapse", fontSize: "12px" } });
  var timeSlots = ["8AM-10AM","10AM-12PM","12PM-2PM","2PM-4PM","4PM-6PM","6PM-8PM","8PM-10PM"];
  var days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  var thead = el("tr");
  thead.appendChild(el("th", { style: { textAlign: "left", padding: "4px 8px" } }));
  timeSlots.forEach(function(t) { thead.appendChild(el("th", { style: { padding: "4px 6px", fontSize: "11px", whiteSpace: "nowrap" } }, [t])); });
  table.appendChild(thead);
  var prevAvail = pa("availability") || {};
  days.forEach(function(day) {
    var tr = el("tr");
    tr.appendChild(el("td", { style: { fontWeight: "600", padding: "6px 8px", whiteSpace: "nowrap" } }, [day]));
    timeSlots.forEach(function(slot) {
      var td = el("td", { style: { textAlign: "center", padding: "4px" } });
      var cb = el("input", { type: "checkbox", className: "avail-cb", "data-day": day, "data-slot": slot });
      if (prevAvail[day] && prevAvail[day].indexOf(slot) >= 0) cb.checked = true;
      td.appendChild(cb);
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  gridWrap.appendChild(table);
  card.appendChild(gridWrap);

  card.appendChild(fg("What time zone are you in? *", el("input", { type: "text", id: "app-tz", placeholder: "e.g. Europe/Rome, America/New_York", value: p("timezone") })));

  // ════════════════════════════════════════════
  // SECTION 8: Technical Set Up
  // ════════════════════════════════════════════
  card.appendChild(sectionTitle("8", "Technical Set Up"));

  card.appendChild(fg("Zoom Familiarity *", radioGroup("app-zoom-familiarity", ["Very Familiar", "Somewhat Familiar", "Need Training"], p("zoomFamiliarity"))));
  card.appendChild(fg("Is your WiFi reliable for video calls? *", radioGroup("app-wifi", ["Yes", "No"], p("wifiReliable"))));
  card.appendChild(fg("Microphone Type *", radioGroup("app-mic", ["Built-in", "USB", "External Pro", "Other"], p("microphoneType"))));
  card.appendChild(fg("Do you have a dedicated camera setup? *", radioGroup("app-camera", ["Yes", "No"], p("dedicatedCamera"))));

  var techTA = el("textarea", { id: "app-tech-setup", placeholder: "Describe your lighting, tools, software..." });
  if (isResubmit) techTA.value = p("techSetupDescription") || "";
  card.appendChild(fg("If yes, Describe Your Full Tech Setup (lighting, tools, etc.)", techTA));

  card.appendChild(fg("Backup Plan for Technical Issues *", radioGroup("app-backup", ["Yes", "No"], p("backupPlan"))));
  card.appendChild(fg("Do you use any AI tools in teaching or prep? *", radioGroup("app-ai-tools", ["Yes", "No"], p("usesAiTools"))));

  var aiTA = el("textarea", { id: "app-ai-explain", placeholder: "Which tools and how you use them..." });
  if (isResubmit) aiTA.value = p("aiToolsExplanation") || "";
  card.appendChild(fg("If yes, please list tools used and explain", aiTA));

  // ════════════════════════════════════════════
  // SECTION 9: Policies & Consent
  // ════════════════════════════════════════════
  card.appendChild(sectionTitle("9", "Policies & Consent"));

  var consentItems = [
    ["consent-paypal", "I agree to payouts via PayPal 7\u201310 days after each lesson. *"],
    ["consent-tax", "I take full responsibility for tax reporting in my jurisdiction. *"],
    ["consent-recording", "I will not record students without consent. *"],
    ["consent-liability", "I understand the platform is not liable for in-person arrangements. *"],
    ["consent-conduct", "I agree to maintain professional, ethical, and non-discriminatory conduct. *"],
    ["consent-contractor", "I agree to TGC\u2019s independent contractor terms. *"],
    ["consent-no-solicit", "I will not solicit students to move off-platform. *"],
    ["consent-profile", "I consent to publish my profile and standard prices. I understand there is a 25% platform fee added to the calculated rate. *"],
    ["consent-refunds", "I acknowledge TGC\u2019s refund and cancellation policy. *"]
  ];

  consentItems.forEach(function(item) {
    var cg = el("div", { style: { marginBottom: "12px" } });
    var lbl = el("label", { style: { display: "flex", alignItems: "flex-start", gap: "8px", fontWeight: "normal", cursor: "pointer" } });
    var cb = el("input", { type: "checkbox", id: item[0] });
    if (isResubmit && ad[item[0]]) cb.checked = true;
    lbl.appendChild(cb);
    lbl.appendChild(el("span", null, [item[1]]));
    cg.appendChild(lbl);
    card.appendChild(cg);
  });

  // ════════════════════════════════════════════
  // SECTION 10: Final Disclosures
  // ════════════════════════════════════════════
  card.appendChild(sectionTitle("10", "Final Disclosures"));

  card.appendChild(fg("Who referred you?", el("input", { type: "text", id: "app-referral", value: p("referral") })));

  var inviteTA = el("textarea", { id: "app-invites", placeholder: "email1@example.com\nemail2@example.com\nemail3@example.com", style: { minHeight: "80px" } });
  if (isResubmit) inviteTA.value = p("inviteEmails") || "";
  card.appendChild(fg("Invite 3 potential colleagues (emails)", inviteTA, "One email per line"));

  card.appendChild(fg("Any disciplinary/legal issues we should be aware of? *", radioGroup("app-legal", ["Yes", "No"], p("legalIssues"))));

  var legalTA = el("textarea", { id: "app-legal-explain", placeholder: "Please explain..." });
  if (isResubmit) legalTA.value = p("legalExplanation") || "";
  card.appendChild(fg("If yes, please explain", legalTA));

  // ════════════════════════════════════════════
  // Before you submit
  // ════════════════════════════════════════════
  card.appendChild(el("hr", { className: "tgc-divider" }));
  var beforeSubmit = el("div", { style: { padding: "20px", background: "#fafafa", borderRadius: "var(--tgc-radius)", marginBottom: "20px" } });
  beforeSubmit.appendChild(el("h4", { style: { marginBottom: "8px" } }, ["Before you submit: What happens next"]));
  beforeSubmit.appendChild(el("p", { style: { fontSize: "14px", color: "var(--tgc-text-secondary)", marginBottom: "8px" } }, ["All submissions are confidential and reviewed by our Executive Board."]));
  beforeSubmit.appendChild(el("p", { style: { fontSize: "14px", color: "var(--tgc-text-secondary)", marginBottom: "8px" } }, ["If accepted, you will be contacted within 2\u20133 weeks to begin the next steps, including contract review, onboarding, and preparation for the Spring 2026 launch."]));
  beforeSubmit.appendChild(el("p", { style: { fontSize: "14px", color: "var(--tgc-text-secondary)" } }, ["We appreciate your time, your artistry, and your interest in joining our founding faculty."]));
  card.appendChild(beforeSubmit);

  var appMsg = el("div", { id: "app-msg", style: { marginTop: "12px", fontSize: "14px" } });

  var submitBtn = el("button", { className: "tgc-btn tgc-btn-gold", style: { width: "100%", padding: "14px", fontSize: "16px" } }, ["Submit Application"]);
  submitBtn.addEventListener("click", function() {
    clearEl(appMsg);

    // Validate required fields
    var errors = [];
    if (!val("app-name")) errors.push("Full name is required.");
    if (!val("app-phone")) errors.push("Phone number is required.");
    if (!val("app-country-tz")) errors.push("Country / Time Zone is required.");
    if (!getRadio("app-contact-method")) errors.push("Preferred contact method is required.");
    if (!val("app-instrument") || val("app-instrument") === "") errors.push("Primary instrument is required.");
    if (getChecked("app-genres").length === 0) errors.push("At least one genre is required.");
    if (getChecked("app-langs").length === 0) errors.push("At least one teaching language is required.");
    if (getChecked("app-ages").length === 0) errors.push("Student age range is required.");
    if (!val("app-years")) errors.push("Years of experience is required.");
    if (!getRadio("app-qualification")) errors.push("Highest qualification is required.");
    if (!val("app-bio")) errors.push("Short bio is required.");
    if (!val("app-head")) errors.push("Headshot URL is required.");
    if (getChecked("app-class-types").length === 0) errors.push("At least one class type is required.");
    if (getChecked("app-levels").length === 0) errors.push("At least one level is required.");
    if (getChecked("app-durations").length === 0) errors.push("At least one duration is required.");
    if (!val("app-weekly-slots")) errors.push("Weekly lesson slots is required.");
    if (getChecked("app-style").length === 0) errors.push("Teaching style is required.");
    if (!val("app-base-rate")) errors.push("Base rate is required.");
    if (!val("app-tz")) errors.push("Time zone is required.");
    if (!getRadio("app-zoom-familiarity")) errors.push("Zoom familiarity is required.");
    if (!getRadio("app-wifi")) errors.push("WiFi reliability is required.");
    if (!getRadio("app-mic")) errors.push("Microphone type is required.");
    if (!getRadio("app-camera")) errors.push("Camera setup is required.");
    if (!getRadio("app-backup")) errors.push("Backup plan answer is required.");
    if (!getRadio("app-ai-tools")) errors.push("AI tools answer is required.");
    if (!getRadio("app-legal")) errors.push("Legal issues answer is required.");

    // Check all consent boxes
    var allConsent = true;
    consentItems.forEach(function(item) {
      if (!document.getElementById(item[0]).checked) allConsent = false;
    });
    if (!allConsent) errors.push("You must agree to all policies in Section 9.");

    if (errors.length > 0) {
      errors.forEach(function(e) {
        appMsg.appendChild(el("div", { style: { color: "var(--tgc-error)", marginBottom: "4px" } }, ["\u2022 " + e]));
      });
      appMsg.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Parse country/timezone
    var ctParts = val("app-country-tz").split("/").map(function(s) { return s.trim(); });
    var country = ctParts[0] || val("app-country-tz");
    var tz = ctParts.length > 1 ? ctParts.slice(1).join("/").trim() : "";
    // If user entered "Italy / Europe/Rome", country=Italy, tz=Europe/Rome
    // Also check the dedicated tz field
    var timezone = val("app-tz") || tz;

    // Collect availability grid
    var availData = {};
    var gridCbs = document.querySelectorAll(".avail-cb:checked");
    for (var i = 0; i < gridCbs.length; i++) {
      var day = gridCbs[i].getAttribute("data-day");
      var slot = gridCbs[i].getAttribute("data-slot");
      if (!availData[day]) availData[day] = [];
      availData[day].push(slot);
    }

    // Collect consent
    var consentData = {};
    consentItems.forEach(function(item) {
      consentData[item[0]] = document.getElementById(item[0]).checked;
    });

    var fullName = val("app-name");
    var body = {
      // Section 1: Identity
      fullName: fullName,
      publicName: val("app-public") || fullName,
      phone: val("app-phone"),
      country: country,
      timezone: timezone,
      preferredContactMethod: getRadio("app-contact-method"),

      // Section 2: Teaching Profile
      primaryInstrument: val("app-instrument"),
      genres: getChecked("app-genres"),
      specialties: getChecked("app-genres"),
      teachingLanguages: getChecked("app-langs"),
      studentAgeRange: getChecked("app-ages"),

      // Section 3: Credentials
      yearsExperience: parseInt(val("app-years")) || null,
      highestQualification: getRadio("app-qualification"),
      currentRoles: getChecked("app-roles"),
      awards: val("app-awards"),
      cvLinks: val("app-cv-links"),

      // Section 4: Bio & Media
      shortBio: val("app-bio"),
      headshotUrl: val("app-head"),
      portfolioUrl: val("app-portfolio"),
      zoomLink: val("app-zoom"),
      socialInstagram: val("app-ig"),
      socialYoutube: val("app-yt"),
      websiteUrl: val("app-web"),

      // Section 5: What You Offer
      classTypes: getChecked("app-class-types"),
      levels: getChecked("app-levels"),
      durations: getChecked("app-durations"),
      weeklySlots: val("app-weekly-slots"),
      teachingStyle: getChecked("app-style"),

      // Section 5.1: Masterclass
      masterclassTopics: val("app-mc-topics"),
      masterclassLength: getRadio("app-mc-length"),
      masterclassPerformerSeats: val("app-mc-performers"),
      masterclassObserverCapacity: val("app-mc-observers"),
      masterclassRecordingOk: getRadio("app-mc-recording"),

      // Section 5.2: Studio Class
      studioClassTerm: getRadio("app-sc-term"),
      studioClassHours: getRadio("app-sc-hours"),
      studioClassCohortSize: getRadio("app-sc-cohort"),
      studioClassSyllabus: val("app-sc-syllabus"),

      // Section 5.3: Group Lesson
      groupLessonTopics: val("app-gl-topics"),
      groupLessonFormat: getRadio("app-gl-format"),
      groupLessonSize: getRadio("app-gl-size"),

      // Section 6: Pricing
      baseRate: parseFloat(val("app-base-rate")) || null,

      // Section 7: Availability
      availability: availData,

      // Section 8: Tech
      zoomFamiliarity: getRadio("app-zoom-familiarity"),
      wifiReliable: getRadio("app-wifi"),
      microphoneType: getRadio("app-mic"),
      dedicatedCamera: getRadio("app-camera"),
      techSetupDescription: val("app-tech-setup"),
      backupPlan: getRadio("app-backup"),
      usesAiTools: getRadio("app-ai-tools"),
      aiToolsExplanation: val("app-ai-explain"),

      // Section 9: Consent
      consents: consentData,

      // Section 10: Final
      referral: val("app-referral"),
      inviteEmails: val("app-invites"),
      legalIssues: getRadio("app-legal"),
      legalExplanation: val("app-legal-explain")
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    api("/api/me/application/submit", { method: "POST", body: JSON.stringify(body) })
      .then(function(data) {
        if (data.success) {
          toast("Application submitted!", "success");
          loadProfile();
        } else {
          toast(data.error || "Failed to submit", "error");
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Application";
        }
      })
      .catch(function(err) {
        toast("Error: " + err.message, "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Application";
      });
  });

  var btnRow = el("div", { className: "tgc-btn-row" });
  btnRow.appendChild(submitBtn);
  card.appendChild(btnRow);
  card.appendChild(appMsg);
  return card;
}

// ─── Status Page ───
function buildStatus() {
  var f = state.faculty;
  var s = f.status;
  var card = el("div", { className: "tgc-card", style: { textAlign: "center" } });

  if (s === "pending_review") {
    card.appendChild(el("h2", null, ["Application Under Review"]));
    card.appendChild(el("p", { style: { color: "var(--tgc-text-secondary)", marginBottom: "16px" } }, ["Thank you for applying to teach at The Global Conservatory. Our team is reviewing your application and will be in touch soon."]));
    card.appendChild(statusBadgeHTML(s));
    card.appendChild(el("p", { style: { marginTop: "24px", fontSize: "14px", color: "var(--tgc-text-secondary)" } }, ["Submitted " + formatDate(f.application && f.application.submittedAt)]));
  } else if (s === "rejected") {
    card.appendChild(el("h2", null, ["Application Not Accepted"]));
    card.appendChild(el("p", { style: { color: "var(--tgc-text-secondary)", marginBottom: "16px" } }, ["Unfortunately, we are unable to accept your application at this time."]));
    card.appendChild(statusBadgeHTML(s));
    if (f.application && f.application.reviewNotes) {
      var alert = el("div", { className: "tgc-alert tgc-alert-info", style: { marginTop: "20px", textAlign: "left" } });
      alert.appendChild(el("strong", null, ["Reviewer notes: "]));
      alert.appendChild(document.createTextNode(f.application.reviewNotes));
      card.appendChild(alert);
    }
  } else if (s === "changes_requested") {
    card.appendChild(el("h2", null, ["Changes Requested"]));
    card.appendChild(el("p", { style: { color: "var(--tgc-text-secondary)", marginBottom: "16px" } }, ["Our team has reviewed your application and requested some changes."]));
    card.appendChild(statusBadgeHTML(s));
    if (f.application && f.application.reviewNotes) {
      var alert2 = el("div", { className: "tgc-alert tgc-alert-warning", style: { marginTop: "20px", textAlign: "left" } });
      alert2.appendChild(el("strong", null, ["Requested changes: "]));
      alert2.appendChild(document.createTextNode(f.application.reviewNotes));
      card.appendChild(alert2);
    }
    var btnRow = el("div", { className: "tgc-btn-row", style: { justifyContent: "center" } });
    var editBtn = el("a", { href: "#/apply", className: "tgc-btn tgc-btn-gold" }, ["Update Application"]);
    btnRow.appendChild(editBtn);
    card.appendChild(btnRow);
  }

  return card;
}

// ─── Dashboard ───
function buildDashboard() {
  var f = state.faculty;
  var frag = document.createDocumentFragment();

  frag.appendChild(el("h2", { style: { fontFamily: "var(--tgc-font)", marginBottom: "24px" } }, ["Welcome back, " + (f.publicName || f.fullName || "Teacher")]));

  var offeringsCount = f.offerings ? f.offerings.length : 0;
  var liveCount = f.offerings ? f.offerings.filter(function(o) { return o.status === "live"; }).length : 0;

  var statRow = el("div", { className: "tgc-stat-row" });
  function addStat(value, label) {
    var s = el("div", { className: "tgc-stat" });
    s.appendChild(el("div", { className: "tgc-stat-value" }, [String(value)]));
    s.appendChild(el("div", { className: "tgc-stat-label" }, [label]));
    statRow.appendChild(s);
  }
  addStat((f.profileCompleteness || 0) + "%", "Profile Complete");
  addStat(offeringsCount, "Offerings");
  addStat(liveCount, "Live");
  addStat(f.acceptingStudents ? "Yes" : "No", "Accepting Students");
  frag.appendChild(statRow);

  // Profile completeness card
  var pCard = el("div", { className: "tgc-card" });
  pCard.appendChild(el("h3", null, ["Profile Completeness"]));
  var bar = el("div", { className: "tgc-progress-bar" });
  bar.appendChild(el("div", { className: "tgc-progress-fill", style: { width: (f.profileCompleteness || 0) + "%" } }));
  pCard.appendChild(bar);
  pCard.appendChild(el("p", { style: { fontSize: "13px", color: "var(--tgc-text-secondary)" } }, [(f.profileCompleteness || 0) < 100 ? "Complete your profile to improve visibility in the faculty directory." : "Your profile is complete."]));
  var pBtnRow = el("div", { className: "tgc-btn-row" });
  pBtnRow.appendChild(el("a", { href: "#/profile", className: "tgc-btn tgc-btn-outline tgc-btn-sm" }, ["Edit Profile"]));
  pCard.appendChild(pBtnRow);
  frag.appendChild(pCard);

  // Pending edits alert
  if (f.profileEdits && f.profileEdits.length > 0) {
    frag.appendChild(el("div", { className: "tgc-alert tgc-alert-info" }, ["You have " + f.profileEdits.length + " pending profile edit(s) awaiting admin review."]));
  }

  // Quick actions
  var qCard = el("div", { className: "tgc-card" });
  qCard.appendChild(el("h3", null, ["Quick Actions"]));
  var qRow = el("div", { className: "tgc-btn-row" });
  qRow.appendChild(el("a", { href: "#/offerings/new", className: "tgc-btn tgc-btn-gold tgc-btn-sm" }, ["New Offering"]));
  qRow.appendChild(el("a", { href: "#/availability", className: "tgc-btn tgc-btn-outline tgc-btn-sm" }, ["Update Availability"]));
  qRow.appendChild(el("a", { href: "#/media", className: "tgc-btn tgc-btn-outline tgc-btn-sm" }, ["Manage Media"]));
  qCard.appendChild(qRow);
  frag.appendChild(qCard);

  // Recent offerings table
  if (f.offerings && f.offerings.length > 0) {
    var oCard = el("div", { className: "tgc-card" });
    oCard.appendChild(el("h3", null, ["Your Offerings"]));
    var table = el("table", { className: "tgc-table" });
    var thead = el("thead");
    var hrow = el("tr");
    ["Title","Type","Status"].forEach(function(h) { hrow.appendChild(el("th", null, [h])); });
    thead.appendChild(hrow);
    table.appendChild(thead);
    var tbody = el("tbody");
    f.offerings.forEach(function(o) {
      var tr = el("tr", { style: { cursor: "pointer" } });
      tr.addEventListener("click", function() { navigate("/offerings/" + o.id); });
      tr.appendChild(el("td", null, [o.title || "Untitled"]));
      tr.appendChild(el("td", null, [(o.offeringType || "").replace(/_/g, " ")]));
      var statusTd = el("td");
      statusTd.appendChild(statusBadgeHTML(o.status));
      tr.appendChild(statusTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    oCard.appendChild(table);
    frag.appendChild(oCard);
  }

  var container = el("div");
  container.appendChild(frag);
  return container;
}

// ─── Profile ───
function buildProfile() {
  var f = state.faculty;
  var card = el("div", { className: "tgc-card" });
  card.appendChild(el("h2", null, ["My Profile"]));
  card.appendChild(el("p", { style: { marginBottom: "20px", color: "var(--tgc-text-secondary)", fontSize: "14px" } }, ["Public-facing fields (marked with *) require admin approval after editing."]));

  function fg(label, inputEl, hint) {
    var g = el("div", { className: "tgc-form-group" });
    g.appendChild(el("label", null, [label]));
    g.appendChild(inputEl);
    if (hint) g.appendChild(el("div", { className: "hint" }, [hint]));
    return g;
  }
  function row(ch) { var r = el("div", { className: "tgc-row" }); ch.forEach(function(c){r.appendChild(c)}); return r; }

  card.appendChild(row([
    fg("Full Name", el("input", { type: "text", id: "p-fullname", value: f.fullName || "" })),
    fg("Public Name *", el("input", { type: "text", id: "p-publicname", value: f.publicName || "" }))
  ]));

  card.appendChild(row([
    fg("Phone", el("input", { type: "tel", id: "p-phone", value: f.phone || "" })),
    fg("Timezone", el("input", { type: "text", id: "p-tz", value: f.timezone || "" }))
  ]));

  card.appendChild(row([
    fg("Country *", el("input", { type: "text", id: "p-country", value: f.country || "" })),
    fg("City *", el("input", { type: "text", id: "p-city", value: f.city || "" }))
  ]));

  card.appendChild(fg("Primary Instrument *", el("input", { type: "text", id: "p-instrument", value: f.primaryInstrument || "" })));
  card.appendChild(fg("Division *", el("input", { type: "text", id: "p-division", value: f.division || "" })));
  card.appendChild(fg("Teaching Languages *", el("input", { type: "text", id: "p-langs", value: (f.teachingLanguages || []).join(", ") }), "Comma-separated"));

  var bioTA = el("textarea", { id: "p-bio" }); bioTA.value = f.shortBio || "";
  card.appendChild(fg("Short Bio *", bioTA));

  var longBioTA = el("textarea", { id: "p-longbio", style: { minHeight: "160px" } }); longBioTA.value = f.longBio || "";
  card.appendChild(fg("Long Bio *", longBioTA));

  var credsTA = el("textarea", { id: "p-creds" }); credsTA.value = f.credentials || "";
  card.appendChild(fg("Credentials *", credsTA));

  card.appendChild(fg("Institutions *", el("input", { type: "text", id: "p-inst", value: f.institutions || "" })));
  card.appendChild(fg("Specialties *", el("input", { type: "text", id: "p-specs", value: (f.specialties || []).join(", ") }), "Comma-separated"));

  card.appendChild(el("hr", { className: "tgc-divider" }));

  card.appendChild(fg("Website *", el("input", { type: "url", id: "p-web", value: f.websiteUrl || "" })));
  card.appendChild(fg("Headshot URL *", el("input", { type: "url", id: "p-head", value: f.headshotUrl || "" })));
  card.appendChild(fg("Intro Video URL *", el("input", { type: "url", id: "p-video", value: f.introVideoUrl || "" })));

  card.appendChild(row([
    fg("Instagram *", el("input", { type: "text", id: "p-ig", value: f.socialInstagram || "" })),
    fg("YouTube *", el("input", { type: "text", id: "p-yt", value: f.socialYoutube || "" }))
  ]));

  card.appendChild(row([
    fg("LinkedIn *", el("input", { type: "text", id: "p-li", value: f.socialLinkedin || "" })),
    fg("Zoom Link", el("input", { type: "url", id: "p-zoom", value: f.zoomLink || "" }))
  ]));

  card.appendChild(el("hr", { className: "tgc-divider" }));

  var accSel = el("select", { id: "p-accepting" });
  var optY = el("option", { value: "true" }, ["Yes"]); if (f.acceptingStudents) optY.selected = true;
  var optN = el("option", { value: "false" }, ["No"]); if (!f.acceptingStudents) optN.selected = true;
  accSel.appendChild(optY); accSel.appendChild(optN);
  card.appendChild(fg("Accepting Students", accSel));

  var saveBtn = el("button", { className: "tgc-btn tgc-btn-gold" }, ["Save Profile"]);
  saveBtn.addEventListener("click", function() {
    var body = {
      publicName: document.getElementById("p-publicname").value.trim(),
      shortBio: document.getElementById("p-bio").value.trim(),
      longBio: document.getElementById("p-longbio").value.trim(),
      credentials: document.getElementById("p-creds").value.trim(),
      institutions: document.getElementById("p-inst").value.trim(),
      specialties: document.getElementById("p-specs").value.split(",").map(function(s){return s.trim()}).filter(Boolean),
      primaryInstrument: document.getElementById("p-instrument").value.trim(),
      division: document.getElementById("p-division").value.trim(),
      country: document.getElementById("p-country").value.trim(),
      city: document.getElementById("p-city").value.trim(),
      teachingLanguages: document.getElementById("p-langs").value.split(",").map(function(s){return s.trim()}).filter(Boolean),
      websiteUrl: document.getElementById("p-web").value.trim(),
      headshotUrl: document.getElementById("p-head").value.trim(),
      introVideoUrl: document.getElementById("p-video").value.trim(),
      socialInstagram: document.getElementById("p-ig").value.trim(),
      socialYoutube: document.getElementById("p-yt").value.trim(),
      socialLinkedin: document.getElementById("p-li").value.trim(),
      phone: document.getElementById("p-phone").value.trim(),
      timezone: document.getElementById("p-tz").value.trim(),
      zoomLink: document.getElementById("p-zoom").value.trim(),
      acceptingStudents: document.getElementById("p-accepting").value === "true"
    };

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    api("/api/me", { method: "PUT", body: JSON.stringify(body) })
      .then(function(data) {
        if (data.success) {
          var msgs = [];
          if (data.freeFieldsUpdated && data.freeFieldsUpdated.length) msgs.push(data.freeFieldsUpdated.length + " field(s) updated");
          if (data.pendingEdit && data.pendingEdit.fields) msgs.push(data.pendingEdit.fields.length + " field(s) sent for review");
          toast(msgs.join(". ") || "Saved", "success");
          loadProfile();
        } else { toast(data.error || "Failed to save", "error"); }
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Profile";
      })
      .catch(function(err) { toast("Error: " + err.message, "error"); saveBtn.disabled = false; saveBtn.textContent = "Save Profile"; });
  });

  var btnRow = el("div", { className: "tgc-btn-row" });
  btnRow.appendChild(saveBtn);
  card.appendChild(btnRow);
  return card;
}

// ─── Offerings List ───
function buildOfferings() {
  var frag = el("div");

  var topRow = el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" } });
  topRow.appendChild(el("h2", { style: { fontFamily: "var(--tgc-font)" } }, ["My Offerings"]));
  topRow.appendChild(el("a", { href: "#/offerings/new", className: "tgc-btn tgc-btn-gold tgc-btn-sm" }, ["New Offering"]));
  frag.appendChild(topRow);

  if (!state.offerings || state.offerings.length === 0) {
    var empty = el("div", { className: "tgc-card tgc-empty" });
    empty.appendChild(el("h3", null, ["No offerings yet"]));
    empty.appendChild(el("p", null, ["Create your first offering to start teaching on TGC."]));
    var eRow = el("div", { className: "tgc-btn-row", style: { justifyContent: "center", marginTop: "16px" } });
    eRow.appendChild(el("a", { href: "#/offerings/new", className: "tgc-btn tgc-btn-gold" }, ["Create Offering"]));
    empty.appendChild(eRow);
    frag.appendChild(empty);
  } else {
    var card = el("div", { className: "tgc-card", style: { padding: "0", overflow: "hidden" } });
    var table = el("table", { className: "tgc-table" });
    var thead = el("thead");
    var hrow = el("tr");
    ["Title","Type","Price","Status",""].forEach(function(h) { hrow.appendChild(el("th", null, [h])); });
    thead.appendChild(hrow);
    table.appendChild(thead);
    var tbody = el("tbody");
    state.offerings.forEach(function(o) {
      var tr = el("tr");
      var titleTd = el("td");
      titleTd.appendChild(el("a", { href: "#/offerings/" + o.id, style: { color: "var(--tgc-navy)", fontWeight: "600", textDecoration: "none" } }, [o.title || "Untitled"]));
      tr.appendChild(titleTd);
      tr.appendChild(el("td", null, [(o.offeringType || "").replace(/_/g, " ")]));
      tr.appendChild(el("td", null, ["$" + Number(o.price).toFixed(2)]));
      var sTd = el("td"); sTd.appendChild(statusBadgeHTML(o.status)); tr.appendChild(sTd);
      tr.appendChild(el("td", null, [el("a", { href: "#/offerings/" + o.id, className: "tgc-btn tgc-btn-outline tgc-btn-sm" }, ["Edit"])]));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    card.appendChild(table);
    frag.appendChild(card);
  }

  return frag;
}

// ─── Offering Form ───
function buildOfferingForm(id) {
  var o = id ? state.offerings.find(function(x) { return x.id === id; }) : null;
  if (id && !o) {
    var notFound = el("div", { className: "tgc-card" });
    notFound.appendChild(el("h2", null, ["Offering Not Found"]));
    notFound.appendChild(el("p", null, ["This offering could not be found. It may have been deleted."]));
    notFound.appendChild(el("button", { className: "tgc-btn tgc-btn-outline", onClick: function() { navigate("/offerings"); } }, ["Back to Offerings"]));
    return notFound;
  }
  var card = el("div", { className: "tgc-card" });
  card.appendChild(el("h2", null, [o ? "Edit Offering" : "New Offering"]));

  if (o && o.adminComments && o.adminComments.length > 0) {
    var alert = el("div", { className: "tgc-alert tgc-alert-info" });
    alert.appendChild(el("strong", null, ["Admin feedback: "]));
    alert.appendChild(document.createTextNode(o.adminComments[0].comment));
    card.appendChild(alert);
  }

  function fg(label, inputEl, hint) {
    var g = el("div", { className: "tgc-form-group" });
    g.appendChild(el("label", null, [label]));
    g.appendChild(inputEl);
    if (hint) g.appendChild(el("div", { className: "hint" }, [hint]));
    return g;
  }
  function row(ch) { var r = el("div", { className: "tgc-row" }); ch.forEach(function(c){r.appendChild(c)}); return r; }
  function selectWithOptions(id, options, selected) {
    var s = el("select", { id: id });
    options.forEach(function(opt) {
      var val = typeof opt === "string" ? opt : opt[0];
      var label = typeof opt === "string" ? opt : opt[1];
      var option = el("option", { value: val }, [label]);
      if (val === selected) option.selected = true;
      s.appendChild(option);
    });
    return s;
  }

  card.appendChild(fg("Offering Type *", selectWithOptions("of-type",
    [["private_lesson","Private Lesson"],["masterclass","Masterclass"],["group_class","Group Class"],["one_time_event","One-Time Event"],["series","Series / Course"]],
    o ? o.offeringType : "private_lesson")));

  card.appendChild(fg("Title *", el("input", { type: "text", id: "of-title", value: o ? (o.title || "") : "" })));
  var descTA = el("textarea", { id: "of-desc" }); descTA.value = o ? (o.description || "") : "";
  card.appendChild(fg("Description", descTA));

  card.appendChild(row([
    fg("Level", selectWithOptions("of-level", [["","Any"],["beginner","Beginner"],["intermediate","Intermediate"],["advanced","Advanced"],["all_levels","All Levels"]], o ? o.level : "")),
    fg("Format", selectWithOptions("of-format", [["","Select..."],["online","Online"],["in_person","In Person"],["hybrid","Hybrid"]], o ? o.format : ""))
  ]));

  card.appendChild(row([
    fg("Duration (min)", el("input", { type: "number", id: "of-dur", value: o ? (o.durationMinutes || "") : "60" })),
    fg("Price (USD) *", el("input", { type: "number", id: "of-price", step: "0.01", min: "0", value: o ? Number(o.price).toFixed(2) : "" }))
  ]));

  card.appendChild(row([
    fg("Capacity", el("input", { type: "number", id: "of-cap", value: o ? (o.capacity || "") : "" }), "Leave empty for 1-on-1"),
    fg("Age Groups", el("input", { type: "text", id: "of-ages", value: o ? (o.ageGroups || []).join(", ") : "" }), "e.g. children, teens, adults")
  ]));

  var prereqTA = el("textarea", { id: "of-prereqs", style: { minHeight: "60px" } }); prereqTA.value = o ? (o.prerequisites || "") : "";
  card.appendChild(fg("Prerequisites", prereqTA));
  var matsTA = el("textarea", { id: "of-mats", style: { minHeight: "60px" } }); matsTA.value = o ? (o.materialsRequired || "") : "";
  card.appendChild(fg("Materials Required", matsTA));
  card.appendChild(fg("Proposed Schedule", el("input", { type: "text", id: "of-sched", value: o ? (o.proposedSchedule || "") : "", placeholder: "e.g. Tuesdays 3-7pm EST" })));

  var btnRow = el("div", { className: "tgc-btn-row" });

  function gatherFields() {
    return {
      offeringType: document.getElementById("of-type").value,
      title: document.getElementById("of-title").value.trim(),
      description: document.getElementById("of-desc").value.trim(),
      level: document.getElementById("of-level").value || null,
      format: document.getElementById("of-format").value || null,
      durationMinutes: parseInt(document.getElementById("of-dur").value) || null,
      price: parseFloat(document.getElementById("of-price").value) || 0,
      capacity: parseInt(document.getElementById("of-cap").value) || null,
      ageGroups: (document.getElementById("of-ages").value || "").split(",").map(function(s){return s.trim()}).filter(Boolean),
      prerequisites: document.getElementById("of-prereqs").value.trim() || null,
      materialsRequired: document.getElementById("of-mats").value.trim() || null,
      proposedSchedule: document.getElementById("of-sched").value.trim() || null
    };
  }

  if (o) {
    var saveBtn = el("button", { className: "tgc-btn tgc-btn-gold" }, ["Save Changes"]);
    saveBtn.addEventListener("click", function() {
      saveBtn.disabled = true;
      api("/api/me/offerings/" + id, { method: "PUT", body: JSON.stringify(gatherFields()) })
        .then(function(data) {
          if (data.success) toast(data.mode === "pending_edit" ? "Changes submitted for review" : "Saved", "success");
          else toast(data.error || "Failed", "error");
          saveBtn.disabled = false;
          loadOfferings();
        })
        .catch(function(err) { toast(err.message, "error"); saveBtn.disabled = false; });
    });
    btnRow.appendChild(saveBtn);

    if (o.status === "draft" || o.status === "rejected" || o.status === "changes_requested") {
      var subBtn = el("button", { className: "tgc-btn tgc-btn-primary" }, ["Submit for Review"]);
      subBtn.addEventListener("click", function() {
        subBtn.disabled = true;
        api("/api/me/offerings/" + id + "/submit", { method: "POST" })
          .then(function(data) {
            if (data.success) { toast("Submitted for review!", "success"); loadOfferings(); navigate("/offerings"); }
            else { toast(data.error || "Failed", "error"); subBtn.disabled = false; }
          })
          .catch(function(err) { toast(err.message, "error"); subBtn.disabled = false; });
      });
      btnRow.appendChild(subBtn);

      var delBtn = el("button", { className: "tgc-btn tgc-btn-danger tgc-btn-sm" }, ["Delete"]);
      delBtn.addEventListener("click", function() {
        if (!confirm("Delete this draft offering?")) return;
        api("/api/me/offerings/" + id, { method: "DELETE" })
          .then(function(data) {
            if (data.success) { toast("Deleted", "success"); loadOfferings(); navigate("/offerings"); }
            else toast(data.error || "Failed", "error");
          })
          .catch(function(err) { toast(err.message || "Delete failed", "error"); });
      });
      btnRow.appendChild(delBtn);
    }

    if (o.status === "live") {
      var pauseBtn = el("button", { className: "tgc-btn tgc-btn-outline tgc-btn-sm" }, ["Pause Offering"]);
      pauseBtn.addEventListener("click", function() {
        if (!confirm("Pause this offering? Students won't be able to book until you resume.")) return;
        pauseBtn.disabled = true;
        api("/api/me/offerings/" + id + "/pause", { method: "POST" })
          .then(function(data) {
            if (data.success) { toast("Offering paused", "success"); loadOfferings(); }
            else { toast(data.error || "Failed", "error"); pauseBtn.disabled = false; }
          })
          .catch(function(err) { toast(err.message, "error"); pauseBtn.disabled = false; });
      });
      btnRow.appendChild(pauseBtn);
    }

    if (o.status === "paused") {
      var resumeBtn = el("button", { className: "tgc-btn tgc-btn-gold tgc-btn-sm" }, ["Resume Offering"]);
      resumeBtn.addEventListener("click", function() {
        resumeBtn.disabled = true;
        api("/api/me/offerings/" + id + "/resume", { method: "POST" })
          .then(function(data) {
            if (data.success) { toast("Offering resumed", "success"); loadOfferings(); }
            else { toast(data.error || "Failed", "error"); resumeBtn.disabled = false; }
          })
          .catch(function(err) { toast(err.message, "error"); resumeBtn.disabled = false; });
      });
      btnRow.appendChild(resumeBtn);
    }

    if (o.status === "pending_approval") {
      var cancelBtn = el("button", { className: "tgc-btn tgc-btn-outline tgc-btn-sm" }, ["Cancel Submission"]);
      cancelBtn.addEventListener("click", function() {
        if (!confirm("Cancel this submission? The offering will go back to draft.")) return;
        cancelBtn.disabled = true;
        api("/api/me/offerings/" + id + "/cancel", { method: "POST" })
          .then(function(data) {
            if (data.success) { toast("Submission cancelled", "success"); loadOfferings(); }
            else { toast(data.error || "Failed", "error"); cancelBtn.disabled = false; }
          })
          .catch(function(err) { toast(err.message, "error"); cancelBtn.disabled = false; });
      });
      btnRow.appendChild(cancelBtn);
    }
  } else {
    var createBtn = el("button", { className: "tgc-btn tgc-btn-gold" }, ["Create Draft"]);
    createBtn.addEventListener("click", function() {
      createBtn.disabled = true;
      api("/api/me/offerings", { method: "POST", body: JSON.stringify(gatherFields()) })
        .then(function(data) {
          if (data.offering) { toast("Offering created as draft", "success"); navigate("/offerings/" + data.offering.id); loadOfferings(); }
          else { toast(data.error || "Failed", "error"); createBtn.disabled = false; }
        })
        .catch(function(err) { toast(err.message, "error"); createBtn.disabled = false; });
    });
    btnRow.appendChild(createBtn);
  }

  btnRow.appendChild(el("a", { href: "#/offerings", className: "tgc-btn tgc-btn-outline" }, ["Cancel"]));
  card.appendChild(btnRow);
  return card;
}

// ─── Availability ───
function buildAvailability() {
  var a = state.availability || {};
  var f = state.faculty;
  var card = el("div", { className: "tgc-card" });
  card.appendChild(el("h2", null, ["Availability Preferences"]));
  card.appendChild(el("p", { style: { marginBottom: "20px", color: "var(--tgc-text-secondary)", fontSize: "14px" } }, ["Set your preferred teaching schedule. This helps us coordinate bookings."]));

  function fg(label, inputEl, hint) {
    var g = el("div", { className: "tgc-form-group" });
    g.appendChild(el("label", null, [label]));
    g.appendChild(inputEl);
    if (hint) g.appendChild(el("div", { className: "hint" }, [hint]));
    return g;
  }
  function row(ch) { var r = el("div", { className: "tgc-row" }); ch.forEach(function(c){r.appendChild(c)}); return r; }

  card.appendChild(fg("Timezone", el("input", { type: "text", id: "av-tz", value: a.timezone || f.timezone || "" })));

  card.appendChild(el("h3", { style: { margin: "20px 0 12px" } }, ["Weekly Hours"]));
  card.appendChild(el("p", { style: { fontSize: "13px", color: "var(--tgc-text-secondary)", marginBottom: "12px" } }, ["For each day, enter available time ranges (e.g. 9:00-12:00, 14:00-17:00)"]));

  var wh = a.weeklyHours || {};
  var days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  days.forEach(function(day) {
    var key = day.toLowerCase();
    var g = el("div", { className: "tgc-form-group", style: { marginBottom: "12px" } });
    var lbl = el("label", { style: { display: "inline-block", width: "100px" } }, [day]);
    var inp = el("input", { type: "text", id: "av-" + key, value: wh[key] || "", placeholder: "e.g. 9:00-12:00, 14:00-17:00", style: { display: "inline-block", width: "calc(100% - 110px)" } });
    g.appendChild(lbl);
    g.appendChild(inp);
    card.appendChild(g);
  });

  card.appendChild(el("hr", { className: "tgc-divider" }));

  card.appendChild(row([
    fg("Lead Time (hours)", el("input", { type: "number", id: "av-lead", value: String(a.leadTimeHours || 24), min: "0" }), "Minimum hours before a booking"),
    fg("Buffer (minutes)", el("input", { type: "number", id: "av-buffer", value: String(a.bufferMinutes || 15), min: "0" }), "Break between sessions")
  ]));

  card.appendChild(fg("Max Sessions Per Day", el("input", { type: "number", id: "av-max", value: String(a.maxSessionsPerDay || ""), min: "0" })));

  var seasonTA = el("textarea", { id: "av-notes", style: { minHeight: "60px" } }); seasonTA.value = a.seasonalNotes || "";
  card.appendChild(fg("Seasonal Notes", seasonTA, "Vacation plans, summer schedules, etc."));

  var adminTA = el("textarea", { id: "av-admin", style: { minHeight: "60px" } }); adminTA.value = a.notesForAdmin || "";
  card.appendChild(fg("Notes for Admin", adminTA));

  card.appendChild(el("hr", { className: "tgc-divider" }));

  var pauseSel = el("select", { id: "av-pause" });
  var optActive = el("option", { value: "false" }, ["Active -- accepting bookings"]); if (!a.pauseMode) optActive.selected = true;
  var optPaused = el("option", { value: "true" }, ["Paused -- not accepting bookings"]); if (a.pauseMode) optPaused.selected = true;
  pauseSel.appendChild(optActive); pauseSel.appendChild(optPaused);
  card.appendChild(fg("Pause Mode", pauseSel));

  var saveBtn = el("button", { className: "tgc-btn tgc-btn-gold" }, ["Save Availability"]);
  saveBtn.addEventListener("click", function() {
    var daysArr = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
    var weeklyH = {};
    daysArr.forEach(function(d) { var v = document.getElementById("av-" + d); if (v) weeklyH[d] = v.value.trim(); });

    var body = {
      timezone: document.getElementById("av-tz").value.trim(),
      weeklyHours: weeklyH,
      leadTimeHours: parseInt(document.getElementById("av-lead").value) || null,
      bufferMinutes: parseInt(document.getElementById("av-buffer").value) || null,
      maxSessionsPerDay: parseInt(document.getElementById("av-max").value) || null,
      seasonalNotes: document.getElementById("av-notes").value.trim(),
      notesForAdmin: document.getElementById("av-admin").value.trim(),
      pauseMode: document.getElementById("av-pause").value === "true"
    };

    saveBtn.disabled = true;
    api("/api/me/availability", { method: "PUT", body: JSON.stringify(body) })
      .then(function(data) {
        if (data.success) { toast("Availability saved", "success"); state.availability = data.availability; }
        else toast(data.error || "Failed", "error");
        saveBtn.disabled = false;
      })
      .catch(function(err) { toast(err.message, "error"); saveBtn.disabled = false; });
  });

  var btnRow = el("div", { className: "tgc-btn-row" });
  btnRow.appendChild(saveBtn);
  card.appendChild(btnRow);
  return card;
}

// ─── Media ───
function buildMedia() {
  var frag = el("div");

  // Upload card
  var upCard = el("div", { className: "tgc-card" });
  upCard.appendChild(el("h2", null, ["Media & Resources"]));
  upCard.appendChild(el("p", { style: { marginBottom: "20px", color: "var(--tgc-text-secondary)", fontSize: "14px" } }, ["Upload photos, videos, recordings, and teaching documents."]));

  var addBox = el("div", { style: { background: "#f9f8f5", border: "2px dashed var(--tgc-border)", borderRadius: "var(--tgc-radius)", padding: "24px", marginBottom: "24px" } });
  addBox.appendChild(el("h3", null, ["Add Media"]));

  function fg(label, inputEl) {
    var g = el("div", { className: "tgc-form-group" });
    g.appendChild(el("label", null, [label]));
    g.appendChild(inputEl);
    return g;
  }
  function row2(ch) { var r = el("div", { className: "tgc-row" }); ch.forEach(function(c){r.appendChild(c)}); return r; }

  addBox.appendChild(fg("URL *", el("input", { type: "url", id: "med-url", placeholder: "https://..." })));

  var typeSel = el("select", { id: "med-type" });
  ["photo","video","recording","document","promo_asset"].forEach(function(t) {
    typeSel.appendChild(el("option", { value: t }, [t.charAt(0).toUpperCase() + t.slice(1).replace("_"," ")]));
  });
  var visSel = el("select", { id: "med-vis" });
  [["public","Public"],["admin_only","Admin Only"],["private","Private"]].forEach(function(v) {
    visSel.appendChild(el("option", { value: v[0] }, [v[1]]));
  });
  addBox.appendChild(row2([fg("Type", typeSel), fg("Visibility", visSel)]));
  addBox.appendChild(fg("Label", el("input", { type: "text", id: "med-label", placeholder: "e.g. Performance at Carnegie Hall" })));

  var addBtn = el("button", { className: "tgc-btn tgc-btn-gold tgc-btn-sm" }, ["Add Media"]);
  addBtn.addEventListener("click", function() {
    var url = document.getElementById("med-url").value.trim();
    if (!url) { toast("URL is required", "error"); return; }
    addBtn.disabled = true;
    api("/api/me/media", { method: "POST", body: JSON.stringify({
      url: url,
      mediaType: document.getElementById("med-type").value,
      visibility: document.getElementById("med-vis").value,
      label: document.getElementById("med-label").value.trim()
    }) })
    .then(function(data) {
      if (data.media) { toast("Media added", "success"); loadMedia(); }
      else toast(data.error || "Failed", "error");
      addBtn.disabled = false;
    })
    .catch(function(err) { toast(err.message, "error"); addBtn.disabled = false; });
  });
  addBox.appendChild(addBtn);
  upCard.appendChild(addBox);

  // Media table
  if (state.media && state.media.length > 0) {
    var table = el("table", { className: "tgc-table" });
    var thead = el("thead");
    var hrow = el("tr");
    ["Label","Type","Visibility",""].forEach(function(h) { hrow.appendChild(el("th", null, [h])); });
    thead.appendChild(hrow);
    table.appendChild(thead);
    var tbody = el("tbody");
    state.media.forEach(function(m) {
      var tr = el("tr");
      var labelTd = el("td");
      labelTd.appendChild(el("a", { href: m.url || "#", target: "_blank", style: { color: "var(--tgc-navy)" } }, [m.label || (m.url ? m.url.substring(0, 40) : "Untitled")]));
      tr.appendChild(labelTd);
      tr.appendChild(el("td", null, [m.mediaType]));
      var visTd = el("td"); visTd.appendChild(statusBadgeHTML(m.visibility)); tr.appendChild(visTd);
      var actTd = el("td");
      var delBtn = el("button", { className: "tgc-btn tgc-btn-danger tgc-btn-sm" }, ["Delete"]);
      delBtn.addEventListener("click", function() {
        if (!confirm("Delete this media?")) return;
        api("/api/me/media/" + m.id, { method: "DELETE" })
          .then(function(data) {
            if (data.success) { toast("Deleted", "success"); loadMedia(); }
            else toast(data.error || "Failed", "error");
          })
          .catch(function(err) { toast("Error: " + err.message, "error"); });
      });
      actTd.appendChild(delBtn);
      tr.appendChild(actTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    upCard.appendChild(table);
  } else {
    upCard.appendChild(el("div", { className: "tgc-empty" }, [el("p", null, ["No media uploaded yet."])]));
  }

  frag.appendChild(upCard);

  // Tech setup card
  var t = state.faculty.tech || {};
  var techCard = el("div", { className: "tgc-card" });
  techCard.appendChild(el("h2", null, ["Tech Setup"]));
  techCard.appendChild(fg("Zoom Link", el("input", { type: "url", id: "tech-zoom", value: t.zoomLink || state.faculty.zoomLink || "" })));
  var techRow = el("div", { className: "tgc-row" });
  techRow.appendChild(fg("Camera Setup", el("input", { type: "text", id: "tech-cam", value: t.cameraSetup || "" })));
  techRow.appendChild(fg("Microphone Setup", el("input", { type: "text", id: "tech-mic", value: t.microphoneSetup || "" })));
  techCard.appendChild(techRow);

  var wifiSel = el("select", { id: "tech-wifi" });
  [["","Select..."],["excellent","Excellent"],["good","Good"],["fair","Fair"],["poor","Poor"]].forEach(function(o) {
    var opt = el("option", { value: o[0] }, [o[1]]);
    if (o[0] === (t.wifiQuality || "")) opt.selected = true;
    wifiSel.appendChild(opt);
  });
  techCard.appendChild(fg("WiFi Quality", wifiSel));

  var backupTA = el("textarea", { id: "tech-backup", style: { minHeight: "60px" } }); backupTA.value = t.backupPlan || "";
  techCard.appendChild(fg("Backup Plan", backupTA));
  var techNotesTA = el("textarea", { id: "tech-notes", style: { minHeight: "60px" } }); techNotesTA.value = t.techNotes || "";
  techCard.appendChild(fg("Tech Notes", techNotesTA));

  var techSaveBtn = el("button", { className: "tgc-btn tgc-btn-gold" }, ["Save Tech Setup"]);
  techSaveBtn.addEventListener("click", function() {
    var body = {
      zoomLink: document.getElementById("tech-zoom").value.trim(),
      cameraSetup: document.getElementById("tech-cam").value.trim(),
      microphoneSetup: document.getElementById("tech-mic").value.trim(),
      wifiQuality: document.getElementById("tech-wifi").value || null,
      backupPlan: document.getElementById("tech-backup").value.trim(),
      techNotes: document.getElementById("tech-notes").value.trim()
    };
    techSaveBtn.disabled = true;
    api("/api/me/tech", { method: "PUT", body: JSON.stringify(body) })
      .then(function(data) {
        if (data.success) toast("Tech setup saved", "success");
        else toast(data.error || "Failed", "error");
        techSaveBtn.disabled = false;
      })
      .catch(function(err) { toast(err.message, "error"); techSaveBtn.disabled = false; });
  });
  var techBtnRow = el("div", { className: "tgc-btn-row" });
  techBtnRow.appendChild(techSaveBtn);
  techCard.appendChild(techBtnRow);

  frag.appendChild(techCard);
  return frag;
}

// ─── Policies ───
function buildPolicies() {
  var card = el("div", { className: "tgc-card" });
  card.appendChild(el("h2", null, ["TGC Faculty Policies"]));
  card.appendChild(el("p", { style: { color: "var(--tgc-text-secondary)", marginBottom: "24px" } }, ["Review the policies governing your participation as a TGC faculty member."]));

  var sections = [
    ["Cancellation Policy", "Teachers must provide at least 24 hours notice for cancellations. Students who cancel less than 24 hours before a lesson forfeit their payment. Teachers who cancel without sufficient notice may have their account flagged."],
    ["Recording Policy", "Lessons may only be recorded with explicit consent from both teacher and student. Teachers must set their recording preference on each offering."],
    ["Code of Conduct", "All faculty members are expected to maintain professional conduct. This includes punctuality, respectful communication, and appropriate lesson content."],
    ["Payout Terms", "TGC processes teacher payouts monthly. The platform retains a commission as disclosed in your faculty agreement. Payout details are available in your dashboard."],
    ["No-Solicitation Agreement", "Faculty members agree not to solicit TGC students for private arrangements outside the platform for 12 months after their last interaction through TGC."]
  ];

  sections.forEach(function(s) {
    card.appendChild(el("h3", null, [s[0]]));
    card.appendChild(el("p", { style: { marginBottom: "16px" } }, [s[1]]));
  });

  card.appendChild(el("hr", { className: "tgc-divider" }));
  card.appendChild(el("p", { style: { fontSize: "13px", color: "var(--tgc-text-secondary)" } }, ["Last updated: March 2026. By using the platform you agree to these terms. Contact faculty@theglobalconservatory.com with questions."]));
  return card;
}

// ─── Data Loaders ───
function loadOfferings() {
  api("/api/me/offerings").then(function(data) {
    state.offerings = data.offerings || [];
    // Re-render only the main content if still on offerings view
    var main = document.querySelector(".tgc-main");
    if (main && (state.view === "offerings" || state.view === "offering-new" || state.view === "offering-detail")) {
      clearEl(main);
      if (state.view === "offerings") main.appendChild(buildOfferings());
      else if (state.view === "offering-new") main.appendChild(buildOfferingForm(null));
      else main.appendChild(buildOfferingForm(state.viewParam));
    }
  }).catch(function(err) { toast("Failed to load offerings", "error"); });
}

function loadAvailability() {
  api("/api/me/availability").then(function(data) {
    state.availability = data.availability;
    var main = document.querySelector(".tgc-main");
    if (main && state.view === "availability") {
      clearEl(main);
      main.appendChild(buildAvailability());
    }
  }).catch(function(err) { toast("Failed to load availability", "error"); });
}

function loadMedia() {
  api("/api/me/media").then(function(data) {
    state.media = data.media || [];
    var main = document.querySelector(".tgc-main");
    if (main && state.view === "media") {
      clearEl(main);
      main.appendChild(buildMedia());
    }
  }).catch(function(err) { toast("Failed to load media", "error"); });
}

// ─── Boot ───
checkAuth();

})();
`;
