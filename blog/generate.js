#!/usr/bin/env node
/* =========================================================================
   AUTO BLOG GENERATOR  —  SEO-compounding engine
   Each run: publishes the next queued evergreen article, then regenerates the
   SEO infrastructure (sitemap.xml, feed.xml, per-post JSON-LD, internal links)
   from posts.json so the whole site keeps compounding in search — hands-free.

   Run:  node blog/generate.js            (publish next queued post + rebuild SEO)
         node blog/generate.js --rebuild  (rebuild SEO files only, no new post)
         node blog/generate.js --dry      (print what it would publish)
   ========================================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BLOG = __dirname;
const POSTS_JSON = path.join(BLOG, 'posts.json');
const TEMPLATE = path.join(BLOG, '_post_template.html');
const SITE = 'https://ats-checker.pages.dev';

// Content library — evergreen articles, rotated FIFO via .queue.json
const LIBRARY = [
  { title:"How to Beat an ATS: 7 Formatting Rules Recruiters Agree On", read:"6 min read",
    excerpt:"Most resumes are rejected by software before a human sees them. Follow these 7 formatting rules to get through the filter.",
    body:`<p>Applicant Tracking Systems (ATS) parse your resume before a recruiter ever does. If the software can't read it, you're out — no matter how qualified.</p>
      <h2>1. Use a standard, single-column layout</h2><p>Avoid tables, text boxes, and multi-column designs. Plain top-to-bottom text parses most reliably.</p>
      <h2>2. Stick to common section headings</h2><p>"Work Experience", "Education", "Skills" — not clever labels an ATS won't recognize.</p>
      <h2>3. Don't use images for text</h2><p>Logos and styled headers get lost. Keep contact info as real text.</p>
      <h2>4. Match the job description's keywords</h2><p>Mirror the exact terms from the posting — "Project Manager", not "Projects Lead".</p>
      <h2>5. Use standard fonts</h2><p>Arial, Calibri, and Times parse cleanly. Decorative fonts can break extraction.</p>
      <h2>6. Send a .docx or plain-text when allowed</h2><p>PDFs are usually fine today, but some older systems prefer Word.</p>
      <h2>7. Quantify everything</h2><p>"Increased sales 23%" beats "Responsible for sales growth."</p>` },
  { title:"The 50 Keywords That Make or Break Your Tech Resume", read:"5 min read",
    excerpt:"A data-backed look at the skill keywords ATS and recruiters search for most in software and data roles.",
    body:`<p>If you're in tech, certain keywords act as gates. Missing them can drop your match score hard.</p>
      <h2>Engineering</h2><p>JavaScript, Python, AWS, Docker, Kubernetes, Terraform, React, SQL, CI/CD, microservices.</p>
      <h2>Data</h2><p>SQL, Python, machine learning, ETL, Tableau, statistics, A/B testing, segmentation.</p>
      <h2>Cross-functional</h2><p>Agile, Scrum, stakeholder management, roadmaps, KPIs, ownership.</p>` },
  { title:"Resume Action Verbs That Survive ATS Scans", read:"4 min read",
    excerpt:"Weak verbs get filtered out. Swap 'responsible for' for these high-signal action verbs.",
    body:`<p>ATS and recruiters both reward strong, specific verbs. Replace vague phrasing with these:</p>
      <ul><li>Led, Built, Launched</li><li>Increased, Reduced, Improved</li><li>Designed, Delivered, Automated</li><li>Negotiated, Scaled, Optimized</li></ul>
      <p>Pair each verb with a number: "Scaled the onboarding funnel, cutting time-to-first-value by 31%."</p>` },
  { title:"Why Your PDF Resume Might Be Invisible (and How to Fix It)", read:"5 min read",
    excerpt:"PDFs aren't always safe. Here's when to use PDF vs Word, and how to test readability.",
    body:`<p>Modern ATS usually read PDFs well — but not always. Three failure modes:</p>
      <ol><li>Scanned PDFs (images of text) — nothing is extractable.</li><li>Embedded fonts that don't ship with the parser.</li><li>Complex layouts with overlapping text.</li></ol>
      <p>Fix: export your resume from a word processor (not a design tool), use standard fonts, and test by copying text out of the PDF. If you can't select the text, the ATS can't either.</p>` },
  { title:"Tailoring Your Resume Per Job: A 10-Minute System", read:"6 min read",
    excerpt:"You don't need 20 resumes. You need one strong base and a fast tailoring loop.",
    body:`<p>Tailoring feels slow because people rewrite from scratch. Instead:</p>
      <ol><li>Keep a master resume with every bullet you've ever used.</li><li>For each application, paste the job description into a checker.</li><li>Note the missing keywords and swap in relevant bullets from your master.</li><li>Ship it. Total: ~10 minutes.</li></ol>` },
  // --- extra evergreen angles for longer compounding without repetition ---
  { title:"ATS-Friendly Resume Templates: What Actually Passes", read:"5 min read",
    excerpt:"Not all 'ATS templates' are equal. Here's what formats survive parsing and which to avoid.",
    body:`<p>A template is only useful if software can read it. The winners:</p>
      <ul><li>Reverse-chronological, single column</li><li>Standard section headers</li><li>Native .docx or clean PDF</li></ul>
      <p>Avoid: graphic-heavy designs, two-column layouts, icons for skills, and headers/footers with critical info.</p>` },
  { title:"How Recruiters Actually Use ATS (and Why Your Score Matters)", read:"5 min read",
    excerpt:"A peek behind the curtain: what recruiters see on their screen and how ranking works.",
    body:`<p>When a recruiter opens an ATS, they see a parsed, searchable version of your resume plus a keyword-match percentage. Candidates below the threshold are often filtered out of the initial list.</p>
      <p>That's why matching the posting's language isn't gaming the system — it's how the software decides whether a human ever sees your application.</p>` },
  { title:"Common ATS Mistakes That Get Resumes Rejected", read:"6 min read",
    excerpt:"The small formatting choices that silently tank your application before a human reads it.",
    body:`<p>Top silent killers:</p>
      <ol><li>Headings like 'Stuff I Did' instead of 'Experience'</li><li>Putting contact info in a header/footer</li><li>Using a template with text boxes</li><li>Submitting only a scanned PDF</li><li>Ignoring the exact keywords in the posting</li></ol>` }
];

const QUEUE = path.join(BLOG, '.queue.json');

const loadQueue = () => { try { return JSON.parse(fs.readFileSync(QUEUE,'utf8')); } catch { return LIBRARY.map((_,i)=>i); } };
const saveQueue = q => fs.writeFileSync(QUEUE, JSON.stringify(q,null,2));
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const loadPosts = () => { try { return JSON.parse(fs.readFileSync(POSTS_JSON,'utf8')); } catch { return []; } };

function relatedLinks(posts, currentSlug){
  return posts.filter(p=>p.slug!==currentSlug).slice(0,3)
    .map(p=>`<li><a href="${p.slug}.html">${p.title}</a></li>`).join("");
}

function jsonLd(post){
  return `<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"BlogPosting",
  "headline":${JSON.stringify(post.title)},
  "description":${JSON.stringify(post.excerpt)},
  "datePublished":${JSON.stringify(post.date)},
  "dateModified":${JSON.stringify(post.date)},
  "author":{"@type":"Organization","name":"ATS Resume Checker"},
  "mainEntityOfPage":{"@type":"WebPage","@id":${JSON.stringify(SITE+"/blog/"+post.slug+".html")}},
  "publisher":{"@type":"Organization","name":"ATS Resume Checker"}
}
<\/script>`;
}

function renderPost(post, posts){
  const tpl = fs.readFileSync(TEMPLATE,'utf8');
  const related = relatedLinks(posts, post.slug);
  const internal = `
    <hr style="border-color:#232a45;margin:30px 0">
    <p><a class="card cta" style="display:inline-block;padding:12px 18px;border-radius:12px"
       href="../">→ Run the free ATS Resume Checker on your resume</a></p>
    ${related ? `<h3 style="margin-top:24px">Related reading</h3><ul class="rel">${related}</ul>` : ''}
    <p class="muted">Want done-for-you templates? <a href="../#tips">See the ATS template pack →</a></p>`;
  return tpl
    .replace(/\{\{TITLE\}\}/g, post.title)
    .replace(/\{\{EXCERPT\}\}/g, post.excerpt)
    .replace(/\{\{DATE\}\}/g, post.date)
    .replace(/\{\{READ\}\}/g, post.read)
    .replace(/\{\{BODY\}\}/g, post.body + internal)
    .replace('</head>', jsonLd(post) + '\n</head>');
}

function buildSitemap(posts){
  const urls = [
    `  <url><loc>${SITE}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${SITE}/blog/</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`
  ].concat(posts.map(p=>`  <url><loc>${SITE}/blog/${p.slug}.html</loc><lastmod>${p.date}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function buildFeed(posts){
  const items = posts.slice(0,20).map(p=>`    <item>
      <title>${p.title}</title>
      <link>${SITE}/blog/${p.slug}.html</link>
      <guid>${SITE}/blog/${p.slug}.html</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description>${p.excerpt}</description>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>ATS Resume Blog</title>\n    <link>${SITE}/blog/</link>\n    <description>Evergreen ATS resume tips that get you past the robots and into interviews.</description>\n${items}\n  </channel>\n</rss>\n`;
}

function rebuildSEO(posts){
  fs.writeFileSync(path.join(ROOT,'sitemap.xml'), buildSitemap(posts));
  fs.writeFileSync(path.join(ROOT,'feed.xml'), buildFeed(posts));
  // rewrite every post so JSON-LD + internal links stay current
  posts.forEach(p=> fs.writeFileSync(path.join(BLOG, p.slug+'.html'), renderPost(p, posts)));
}

function main(){
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const rebuildOnly = args.includes('--rebuild');
  let posts = loadPosts();

  if(!rebuildOnly){
    const queue = loadQueue();
    if(queue.length === 0){ console.log('Queue empty — re-seeding.'); saveQueue(LIBRARY.map((_,i)=>i)); }
    else {
      const idx = queue.shift();
      const post = LIBRARY[idx % LIBRARY.length];
      const slug = slugify(post.title);
      const date = new Date().toISOString().slice(0,10);
      if(dry){ console.log(`[dry] would publish: ${post.title}`); saveQueue(queue); return; }
      posts.unshift({ title:post.title, slug, date, read:post.read, excerpt:post.excerpt });
      fs.writeFileSync(POSTS_JSON, JSON.stringify(posts,null,2));
      saveQueue(queue);
      console.log(`Published: blog/${slug}.html`);
    }
  }

  rebuildSEO(posts);
  console.log(`SEO rebuilt: ${posts.length} posts → sitemap.xml + feed.xml + JSON-LD`);
}

main();
