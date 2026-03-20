import { initPaywall, gate, showPricingModal, renderUsageMeter } from "./services/paywallUI.js";
import { validators, guardSubmit } from "./utils/validate.js";
import { saveDoc, getUserDocs, tsToString } from "./services/firestoreService.js";
import { apiFetch } from "./config/env.js";
import { toast } from "./utils/toast.js";
import { initAuthModal } from "./utils/helpers.js";
import { authService } from "./services/authService.js";

let currentUser = null;
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

document.getElementById("btn-optimize").addEventListener("click", async () => {
  // Validate inputs before processing
  if (!guardSubmit([
    { id: 'headline', rules: [validators.required], label: 'Headline' },
    { id: 'target-role', rules: [validators.required], label: 'Target role' }
  ], toast)) return;

    const payload = { headline: document.getElementById("headline").value, about: document.getElementById("about").value, experience: document.getElementById("experience").value, skills: document.getElementById("skills").value, targetRole: document.getElementById("target-role").value, targetIndustry: document.getElementById("target-industry").value, targetJD: document.getElementById("target-jd").value };
  if(!payload.headline && !payload.about) return toast.warning("Please fill in at least your headline and about section.");
  document.querySelector(".btn-text").classList.add("hidden"); document.querySelector(".btn-loader").classList.remove("hidden"); document.getElementById("btn-optimize").disabled=true;
  try {
    const res = await apiFetch("/api/linkedin-optimize", payload);
    const data = await res.json();
    const grid = document.getElementById("sections-grid");
    grid.innerHTML = Object.entries(data.optimized||{}).map(([key,val]) => `<div class="result-block"><h4>${key.replace(/([A-Z])/g,' $1').trim()}</h4><div class="optimized-text">${val}</div><button class="btn-icon copy-btn" data-text="${encodeURIComponent(val)}">📋 Copy</button></div>`).join("");
    grid.querySelectorAll(".copy-btn").forEach(b => b.addEventListener("click", () => navigator.clipboard.writeText(decodeURIComponent(b.dataset.text))));
    document.getElementById("results").classList.remove("hidden");
    document.getElementById("results").scrollIntoView({behavior:"smooth"});
  } catch(e) { toast.error("Failed: "); }
  finally { document.querySelector(".btn-text").classList.remove("hidden"); document.querySelector(".btn-loader").classList.add("hidden"); document.getElementById("btn-optimize").disabled=false; }
});

document.getElementById("btn-save")?.addEventListener("click", async () => {
  if(!currentUser) { authModal.classList.remove("hidden"); return; }
  
  await saveDoc("linkedin-optimizations", currentUser?.uid || '', { userId: currentUser.uid, targetRole: document.getElementById("target-role").value, createdAt: serverTimestamp() });
  toast.success("Saved!");
});
