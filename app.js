/* =========================================================================
   Free ATS Resume Checker — client-side analysis + monetization config.
   Nothing is uploaded. All scoring happens in the browser.
   ========================================================================= */

/* ----------------------------- CONFIG -----------------------------------
   EDIT THESE to activate monetization. They are placeholders until you
   paste your own IDs. Everything works without them (links stay inert).
   - KOFI:        create a page at ko-fi.com (no approval needed). Paste URL.
   - GUMROAD:     create a product at gumroad.com, paste the product URL.
   - AFF1 / AFF2: any affiliate link (ResumeGenius, Indeed, Fiverr, etc.)
   ----------------------------------------------------------------------- */
const CONFIG = {
  KOFI_URL:   "https://ko-fi.com/YOUR_USERNAME",          // ← free, instant payouts
  GUMROAD_URL:"https://YOURNAME.gumroad.com/l/ats-pack",  // ← your template pack
  AFF1_URL:   "https://example.com/affiliate/resume-builder",
  AFF1_DESC:  "Use a proven builder that formats for ATS by default.",
  AFF2_URL:   "https://example.com/affiliate/resume-writer",
  AFF2_DESC:  "Hire a vetted writer to rewrite your resume.",
};

/* ----------------------------- helpers --------------------------------- */
const STOP = new Set(("a an the and or but if then of to in on at for with without by from as is are was were be been being this that these those it its we you your our i he she they them his her their not no do does did have has had will would can could should may might must into over under between during before after about above below out up down off than so such only also more most less least very just own same other another each any all both few many much several some most").split(" "));
const SKILL_HINTS = ["js","javascript","python","java","c++","c#","go","golang","rust","sql","aws","azure","gcp","docker","kubernetes","terraform","react","vue","angular","node","typescript","excel","salesforce","seo","marketing","project management","agile","scrum","leadership","communication","data analysis","design","writing","accounting","nursing","teaching","data","machine learning","ml","ai","cloud","devops","cybersecurity","security","qa","testing","product","operations","human resources","hr","finance","legal","engineering","customer success","sales"];
// generic words that are NOT useful as ATS keywords
const GENERIC = new Set(("need senior software engineer strong skills experience required must ability with that have our you your team work etc using use including role position company year years candidate candidates job description apply applying prefer preferred plus also within across make made get got".split(" ")));

function tokenize(text){
  return (text || "").toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").split(/\s+/).filter(Boolean);
}
function isStop(t){ return STOP.has(t) || t.length < 2; }

// Extract meaningful keywords from the job description.
// Strategy: hard-skill phrases (SKILL_HINTS) that appear + content words the
// posting emphasizes (frequency >= 2). Generic words are excluded so the
// match denominator stays meaningful.
function jdKeywords(jd){
  const lower = jd.toLowerCase();
  const phrases = [];
  for(const s of SKILL_HINTS){ if(lower.includes(s)) phrases.push(s); }
  const tokens = tokenize(jd);
  const freq = {};
  for(const t of tokens){ if(!isStop(t) && !GENERIC.has(t)) freq[t] = (freq[t]||0)+1; }
  const frequent = Object.entries(freq)
    .filter(([k,v]) => v>=2 && k.length>2)
    .map(([k])=>k);
  const seen = new Set(), out = [];
  for(const p of phrases){ if(!seen.has(p)){ seen.add(p); out.push(p); } }
  for(const f of frequent){ if(!seen.has(f)){ seen.add(f); out.push(f); } }
  return out.slice(0, 30);
}

function countMatches(resumeLower, keywords){
  const present = [], missing = [];
  for(const k of keywords){
    if(resumeLower.includes(k)) present.push(k); else missing.push(k);
  }
  return { present, missing };
}

/* ----------------------------- analysis -------------------------------- */
function analyze(resumeText, jdText, resumeLower){
  const keywords = jdKeywords(jdText);
  const { present, missing } = countMatches(resumeLower, keywords);
  const total = keywords.length || 1;
  const keywordScore = Math.round((present.length/total) * 70); // up to 70 pts

  // formatting / quality heuristics
  let fmt = 0; const tips = [];
  if(resumeLower.includes("@") && /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(resumeText)) fmt += 8;
  else { tips.push("Add a clear email and phone number near the top — ATS parsers need contact info in plain text."); }
  if(resumeText.length > 1500) fmt += 8; else tips.push("Your resume looks short. Aim for 1–2 pages with concrete achievements.");
  if(!/table|<table/.test(resumeText) && resumeText.split(/\n/).length > 5) fmt += 8; else tips.push("Avoid tables and text boxes — many ATS can't read them. Use plain bullet points.");
  if(/\b(led|built|increased|reduced|launched|managed|created|improved|delivered)\b/.test(resumeLower)) fmt += 8; else tips.push("Use strong action verbs (Led, Built, Increased) — ATS favors measurable impact.");
  if(/\d/.test(resumeLower) && /%|\$|k\b|million|hours|users|customers/.test(resumeLower)) fmt += 8; else tips.push("Quantify results with numbers (e.g. 'grew revenue 23%') — ATS and recruiters reward metrics.");
  fmt = Math.min(fmt, 40);

  const score = Math.min(100, keywordScore + fmt);

  // keyword tips
  if(missing.length){
    const top = missing.slice(0,8).join(", ");
    tips.unshift(`Add these job-description keywords your resume is missing: ${top}.`);
  } else if(present.length){
    tips.unshift("Great — your resume already contains the key terms from this posting.");
  }

  return { score, keywordPct: Math.round(present.length/total*100), present, missing, tips };
}

function labelFor(score){
  if(score>=85) return "Excellent — likely to pass most ATS filters.";
  if(score>=70) return "Good — a few tweaks and you're competitive.";
  if(score>=50) return "Fair — improve keyword match and formatting.";
  return "Needs work — tailor it to this job before applying.";
}

/* ----------------------------- UI -------------------------------------- */
const $ = id => document.getElementById(id);
function setStatus(msg, kind){ const s=$("status"); s.textContent=msg; s.className="status"+(kind?" "+kind:""); }

function applyConfig(){
  $("support-link").href = CONFIG.KOFI_URL;
  $("gumroad").href = CONFIG.GUMROAD_URL;
  $("aff1").href = CONFIG.AFF1_URL; $("aff1-desc").textContent = CONFIG.AFF1_DESC;
  $("aff2").href = CONFIG.AFF2_URL; $("aff2-desc").textContent = CONFIG.AFF2_DESC;
}

function render(resumeText, jdText){
  const resumeLower = resumeText.toLowerCase();
  const r = analyze(resumeText, jdText, resumeLower);
  $("score").textContent = r.score;
  $("score-label").textContent = labelFor(r.score);
  // ring
  const circ = 2*Math.PI*52;
  $("ring-fg").style.strokeDasharray = circ;
  $("ring-fg").style.strokeDashoffset = circ * (1 - r.score/100);
  $("ring-fg").style.stroke = r.score>=70 ? "#1f9d55" : r.score>=50 ? "#e0a800" : "#d9534f";
  // breakdown
  $("breakdown").innerHTML =
    `<div class="b-row"><span>Keyword match</span><b>${r.keywordPct}%</b></div>` +
    `<div class="b-row"><span>Keywords found</span><b>${r.present.length}/${r.present.length+r.missing.length}</b></div>`;
  // tips
  $("tips").innerHTML = r.tips.map(t=>`<li>${t}</li>`).join("");
  $("results").classList.remove("hidden");
  $("results").scrollIntoView({behavior:"smooth", block:"start"});
}

/* ----------------------------- pdf ------------------------------------- */
if(window["pdfjsLib"]){
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}
async function extractPdf(file){
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data:buf}).promise;
  let text = "";
  for(let i=1;i<=pdf.numPages;i++){
    const page = await pdf.getPage(i);
    const c = await page.getTextContent();
    text += c.items.map(it=>it.str).join(" ") + "\n";
  }
  return text;
}

/* ----------------------------- wiring ---------------------------------- */
applyConfig();
$("analyze").addEventListener("click", async ()=>{
  const resumeText = $("resume").value.trim();
  const jdText = $("jd").value.trim();
  if(!resumeText){ setStatus("Paste your resume text first.", "err"); return; }
  if(!jdText){ setStatus("Paste the job description too.", "err"); return; }
  setStatus("Analyzing…", "");
  // small delay so the UI can paint
  await new Promise(r=>setTimeout(r, 60));
  try {
    render(resumeText, jdText);
    setStatus("Done. Your resume was analyzed locally — nothing was uploaded.", "ok");
  } catch(e){
    setStatus("Something went wrong: "+e.message, "err");
  }
});
$("clear").addEventListener("click", ()=>{ $("resume").value=""; $("jd").value=""; $("results").classList.add("hidden"); setStatus("","");
});
$("file").addEventListener("change", async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  setStatus("Reading file…","");
  try{
    let text = "";
    if(f.name.endsWith(".pdf")){
      if(!window["pdfjsLib"]){ setStatus("PDF library still loading — try again in a second.", "err"); return; }
      text = await extractPdf(f);
    } else { text = await f.text(); }
    $("resume").value = text;
    setStatus("File loaded into the resume box. Add a job description and analyze.", "ok");
  }catch(err){ setStatus("Could not read file: "+err.message, "err"); }
});
