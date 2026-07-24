/* Loads the real app.js with a tiny DOM stub and tests the scoring engine. */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/app.js', 'utf8');

// --- minimal stub so app.js loads (it calls applyConfig + addEventListener at load) ---
const fakeEl = () => new Proxy({ style:{}, classList:{add(){},remove(){}},
  addEventListener(){}, set href(v){}, set textContent(v){}, set innerHTML(v){} },
  { get(t,k){ return k in t ? t[k] : (()=>{}); }, set(t,k,v){ t[k]=v; return true; } });
global.document = { getElementById: () => fakeEl() };
global.window = {};

// eval in this scope so top-level function declarations become callable
eval(src);

// --- test cases ---
const resume = `Jane Doe
jane@example.com  (555) 123-4567
Led a team that built a React dashboard, increasing user engagement 23%.
Managed cloud infrastructure on AWS with Docker and Kubernetes.
Improved deployment speed by 40% using Terraform.`;

const jd = `We need a Senior Software Engineer with strong JavaScript and React skills.
Experience with AWS, Docker, Kubernetes, and Terraform is required.
Must have leadership and project management ability.`;

const r = analyze(resume, jd, resume.toLowerCase());
console.log('SCORE:', r.score);
console.log('keyword%:', r.keywordPct);
console.log('found:', r.present.join(', '));
console.log('missing:', r.missing.join(', '));
console.log('tips count:', r.tips.length);

const assert = (c,m)=>{ if(!c){ console.error('FAIL:', m); process.exit(1);} else console.log('ok:', m); };
assert(r.score >= 45 && r.score <= 100, 'tailored resume scores in a sane 45-100 band');
assert(r.present.includes('react'), 'react keyword detected');
assert(r.present.includes('aws'), 'aws keyword detected');
assert(r.tips.length > 0, 'produces tips');

// A resume that contains EVERY jd keyword should be able to reach 85+
const perfect = resume + ' javascript java project management leadership';
const rp = analyze(perfect, jd, perfect.toLowerCase());
console.log('PERFECT SCORE:', rp.score);
assert(rp.score >= 85, 'keyword-perfect tailored resume can reach >=85');

// weak resume should score lower
const weak = `Person. Did stuff.`;
const r2 = analyze(weak, jd, weak.toLowerCase());
console.log('WEAK SCORE:', r2.score);
assert(r2.score < r.score, 'weak resume scores lower than strong');
console.log('\nALL TESTS PASSED');
