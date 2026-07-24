#!/usr/bin/env node
/* =========================================================================
   AUTO BLOG GENERATOR
   Generates a new evergreen ATS-resume article from a local content library,
   renders it to blog/<slug>.html, and updates blog/posts.json (for the index).
   Designed to be run on a schedule (launchd / cron) so the site grows itself
   and attracts free search traffic WITHOUT any manual interaction.

   Run:  node blog/generate.js            (publishes the next queued post)
         node blog/generate.js --dry       (prints what it would publish)
   ========================================================================= */
const fs = require('fs');
const path = require('path');

const BLOG = __dirname;
const POSTS_JSON = path.join(BLOG, 'posts.json');
const TEMPLATE = path.join(BLOG, '_post_template.html');

// Content library — each entry is an evergreen article. The generator
// rotates through them (FIFO from a queue file) so output is varied.
const LIBRARY = [
  {
    title: "How to Beat an ATS: 7 Formatting Rules Recruiters Agree On",
    read: "6 min read",
    excerpt: "Most resumes are rejected by software before a human sees them. Follow these 7 formatting rules to get through the filter.",
    body: `<p>Applicant Tracking Systems (ATS) parse your resume before a recruiter ever does. If the software can't read it, you're out — no matter how qualified.</p>
      <h2>1. Use a standard, single-column layout</h2><p>Avoid tables, text boxes, and multi-column designs. Plain top-to-bottom text parses most reliably.</p>
      <h2>2. Stick to common section headings</h2><p>"Work Experience", "Education", "Skills" — not clever labels an ATS won't recognize.</p>
      <h2>3. Don't use images for text</h2><p>Logos and styled headers get lost. Keep contact info as real text.</p>
      <h2>4. Match the job description's keywords</h2><p>Mirror the exact terms from the posting — "Project Manager", not "Projects Lead".</p>
      <h2>5. Use standard fonts</h2><p>Arial, Calibri, and Times parse cleanly. Decorative fonts can break extraction.</p>
      <h2>6. Send a .docx or plain-text when allowed</h2><p>PDFs are usually fine today, but some older systems prefer Word.</p>
      <h2>7. Quantify everything</h2><p>"Increased sales 23%" beats "Responsible for sales growth."</p>
      <p>Run your draft through a checker before you apply — see where you lose points.</p>`
  },
  {
    title: "The 50 Keywords That Make or Break Your Tech Resume",
    read: "5 min read",
    excerpt: "A data-backed look at the skill keywords ATS and recruiters search for most in software and data roles.",
    body: `<p>If you're in tech, certain keywords act as gates. Missing them can drop your match score hard.</p>
      <h2>Engineering</h2><p>JavaScript, Python, AWS, Docker, Kubernetes, Terraform, React, SQL, CI/CD, microservices.</p>
      <h2>Data</h2><p>SQL, Python, machine learning, ETL, Tableau, statistics, A/B testing, segmentation.</p>
      <h2>Cross-functional</h2><p>Agile, Scrum, stakeholder management, roadmaps, KPIs, ownership.</p>
      <p>Don't stuff them — weave the ones you genuinely have into your experience bullets. Our checker shows exactly which keywords a specific posting expects.</p>`
  },
  {
    title: "Resume Action Verbs That Survive ATS Scans",
    read: "4 min read",
    excerpt: "Weak verbs get filtered out. Swap 'responsible for' for these high-signal action verbs.",
    body: `<p>ATS and recruiters both reward strong, specific verbs. Replace vague phrasing with these:</p>
      <ul><li>Led, Built, Launched</li><li>Increased, Reduced, Improved</li><li>Designed, Delivered, Automated</li><li>Negotiated, Scaled, Optimized</li></ul>
      <p>Pair each verb with a number: "Scaled the onboarding funnel, cutting time-to-first-value by 31%."</p>
      <p>Not sure your verbs land? Run the free checker and read the tips it generates for your exact resume.</p>`
  },
  {
    title: "Why Your PDF Resume Might Be Invisible (and How to Fix It)",
    read: "5 min read",
    excerpt: "PDFs aren't always safe. Here's when to use PDF vs Word, and how to test readability.",
    body: `<p>Modern ATS usually read PDFs well — but not always. Three failure modes:</p>
      <ol><li>Scanned PDFs (images of text) — nothing is extractable.</li><li>Embedded fonts that don't ship with the parser.</li><li>Complex layouts with overlapping text.</li></ol>
      <p>Fix: export your resume from a word processor (not a design tool), use standard fonts, and test by copying text out of the PDF. If you can't select the text, the ATS can't either.</p>`
  },
  {
    title: "Tailoring Your Resume Per Job: A 10-Minute System",
    read: "6 min read",
    excerpt: "You don't need 20 resumes. You need one strong base and a fast tailoring loop.",
    body: `<p>Tailoring feels slow because people rewrite from scratch. Instead:</p>
      <ol><li>Keep a master resume with every bullet you've ever used.</li><li>For each application, paste the job description into a checker.</li><li>Note the missing keywords and swap in relevant bullets from your master.</li><li>Ship it. Total: ~10 minutes.</li></ol>
      <p>This loop is exactly what our free tool automates — paste resume + JD, get the gap list.</p>`
  }
];

const QUEUE = path.join(BLOG, '.queue.json');

function loadQueue(){
  try { return JSON.parse(fs.readFileSync(QUEUE,'utf8')); }
  catch { return LIBRARY.map((_,i)=>i); } // fresh FIFO of indices
}
function saveQueue(q){ fs.writeFileSync(QUEUE, JSON.stringify(q,null,2)); }

function render(template, post, date){
  return template
    .replace(/\{\{TITLE\}\}/g, post.title)
    .replace(/\{\{EXCERPT\}\}/g, post.excerpt)
    .replace(/\{\{DATE\}\}/g, date)
    .replace(/\{\{READ\}\}/g, post.read)
    .replace(/\{\{BODY\}\}/g, post.body);
}

function slugify(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

function main(){
  const dry = process.argv.includes('--dry');
  const queue = loadQueue();
  if(queue.length === 0){ console.log('Queue empty — re-seeding library.'); saveQueue(LIBRARY.map((_,i)=>i)); return; }
  const idx = queue.shift();
  const post = LIBRARY[idx % LIBRARY.length];
  const slug = slugify(post.title);
  const date = new Date().toISOString().slice(0,10);

  if(dry){ console.log(`[dry] would publish #${idx}: ${post.title} → blog/${slug}.html`); saveQueue(queue); return; }

  const html = render(fs.readFileSync(TEMPLATE,'utf8'), post, date);
  fs.writeFileSync(path.join(BLOG, slug + '.html'), html);

  // update posts.json (newest first)
  let posts = [];
  try { posts = JSON.parse(fs.readFileSync(POSTS_JSON,'utf8')); } catch {}
  posts.unshift({ title:post.title, slug, date, read:post.read, excerpt:post.excerpt });
  fs.writeFileSync(POSTS_JSON, JSON.stringify(posts,null,2));
  saveQueue(queue);

  console.log(`Published: blog/${slug}.html (${posts.length} posts total)`);
}

main();
