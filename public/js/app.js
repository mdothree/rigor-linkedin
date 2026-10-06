import { initPaywall, gate, showPricingModal, renderUsageMeter } from "./services/paywallUI.js";
import { validators, guardSubmit } from "./utils/validate.js";
import { saveDoc, getUserDocs, tsToString } from "./services/firestoreService.js";
import { apiFetch } from "./config/env.js";
import { toast } from "./utils/toast.js";
import {
  initAuthModal, wireAuthNav, openAuthModal, escapeHtml, listItems,
  showToolError, clearToolError, copyToClipboard, showCopiedFeedback
} from "./utils/helpers.js";
import { authService } from "./services/authService.js";

let currentUser = null;
let lastResult = null;

authService.onAuthChanged(async user => {
  currentUser = user;
  const navLoginEl = document.getElementById("nav-login");
  if (navLoginEl) navLoginEl.textContent = user ? "Sign Out" : "Sign In";
  document.getElementById("nav-signup")?.classList.toggle("nav-signup-hidden", !!user);
  await initPaywall(user ? user.uid : null);
  if (user) renderUsageMeter("usage-meter-container", "uses");
});
document.getElementById("nav-upgrade")?.addEventListener("click", () => showPricingModal("pro"));
document.getElementById("nav-manage")?.addEventListener("click", () => showPricingModal("pro"));

initAuthModal(authService);
wireAuthNav(authService, () => currentUser);

const val = id => document.getElementById(id).value.trim();

function setBusy(busy) {
  const btn = document.getElementById("btn-optimize");
  btn.querySelector(".btn-text").classList.toggle("hidden", busy);
  btn.querySelector(".btn-loader").classList.toggle("hidden", !busy);
  btn.disabled = busy;
}

// Text sections (full width, copyable) in display order
const TEXT_SECTIONS = [
  ["optimizedHeadline", "Headline"],
  ["optimizedAbout", "About"],
  ["optimizedExperience", "Experience"]
];

function renderResults(o) {
  const blocks = [];
  const score = Number(o.profileScore);
  if (Number.isFinite(score)) {
    blocks.push(`<div class="result-block wide"><h4>Profile Score</h4><div class="optimized-text"><strong class="profile-score">${Math.max(0, Math.min(100, Math.round(score)))}</strong> / 100</div></div>`);
  }
  if (o.topTip) {
    blocks.push(`<div class="result-block wide"><h4>Top Tip</h4><div class="optimized-text">${escapeHtml(o.topTip)}</div></div>`);
  }
  for (const [key, label] of TEXT_SECTIONS) {
    if (!o[key]) continue;
    const text = Array.isArray(o[key]) ? o[key].join("\n") : String(o[key]);
    blocks.push(`<div class="result-block wide"><h4>${label}</h4><div class="optimized-text">${escapeHtml(text)}</div><button type="button" class="btn-icon copy-btn" data-key="${key}">📋 Copy</button></div>`);
  }
  // Two half-width list blocks; if only one exists, make it full width (no orphan cell)
  const lists = [["recommendedSkills", "Recommended Skills"], ["keywordGaps", "Keyword Gaps"]]
    .filter(([k]) => Array.isArray(o[k]) ? o[k].length : o[k]);
  for (const [k, label] of lists) {
    blocks.push(`<div class="result-block${lists.length === 1 ? " wide" : ""}"><h4>${label}</h4><ul>${listItems(o[k])}</ul></div>`);
  }
  const grid = document.getElementById("sections-grid");
  grid.innerHTML = blocks.join("");
  grid.querySelectorAll(".copy-btn").forEach(b => b.addEventListener("click", async () => {
    const v = o[b.dataset.key];
    await copyToClipboard(Array.isArray(v) ? v.join("\n") : String(v));
    showCopiedFeedback(b, "📋 Copy");
  }));
}

async function optimize() {
  // Same rule as the API: target role + (headline OR about)
  if (!guardSubmit([
    { id: 'target-role', rules: [validators.required], label: 'Target role' }
  ], toast)) return;

  const payload = { headline: val("headline"), about: val("about"), experience: val("experience"), skills: val("skills"), targetRole: val("target-role"), targetIndustry: val("target-industry"), targetJD: val("target-jd") };
  if (!payload.headline && !payload.about) {
    document.getElementById("headline").focus();
    return toast.warning("Please fill in your headline or your About section.");
  }

  clearToolError();
  document.getElementById("results").classList.add("hidden");
  setBusy(true);
  try {
    const data = await apiFetch("/api/linkedin-optimize", payload);
    const o = data?.optimized;
    if (!o || typeof o !== "object" || !Object.keys(o).length) throw new Error("The server returned an empty result.");
    lastResult = { ...o };
    renderResults(o);
    document.getElementById("results").classList.remove("hidden");
    document.getElementById("results").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    lastResult = null;
    showToolError(e, optimize);
  } finally {
    setBusy(false);
  }
}

document.getElementById("btn-optimize").addEventListener("click", optimize);

document.getElementById("btn-save")?.addEventListener("click", async () => {
  if (!currentUser) { openAuthModal("login"); return; }
  try {
    await saveDoc("linkedin-optimizations", currentUser.uid, { targetRole: val("target-role"), optimized: lastResult });
    toast.success("Saved!");
  } catch (e) {
    toast.error(`Couldn't save: ${e?.message || "unknown error"}`);
  }
});
