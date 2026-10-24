/* Brute Browser (Web) — app logic */
'use strict';

/* ---------- Notes ---------- */
const BUNDLED_NOTES = [
  { name: 'Authorized pentest scripts', file: '/notes/authorized-pentest-scripts.txt' },
  { name: 'Google dorks master', file: '/notes/google-dorks-master.txt' },
  { name: 'Inject script gdorks', file: '/notes/inject-script-gdorks.txt' },
  { name: 'Google dork lists 2', file: '/notes/google-dorks-lists2.txt' },
];
const NOTE_KEY = 'brute-notes-v1';
let notesOpen = null; /* null=list, {kind:'bundled'|'custom', ...} */

function loadCustomNotes() {
  try { return JSON.parse(localStorage.getItem(NOTE_KEY) || '[]'); } catch { return []; }
}
function saveCustomNotes(list) { localStorage.setItem(NOTE_KEY, JSON.stringify(list)); }

function renderNoteList() {
  const ul = $('note-list');
  ul.innerHTML = '';
  const add = (label, cls, onOpen) => {
    const li = document.createElement('li');
    li.className = cls;
    li.textContent = label;
    li.addEventListener('click', onOpen);
    ul.appendChild(li);
  };
  for (const n of BUNDLED_NOTES) add(n.name + '  (built-in)', 'note-bundled', async () => {
    const text = await fetch(n.file).then(r => r.ok ? r.text() : 'Failed to load note').catch(e => 'Failed to load: ' + e.message);
    showNote({ kind: 'bundled', name: n.name, text });
  });
  for (let i = loadCustomNotes().length - 1; i >= 0; i--) {
    const n = loadCustomNotes()[i];
    add(n.name + '  (custom)', 'note-custom', () => showNote({ kind: 'custom', index: i, name: n.name, text: n.text }));
  }
  $("#note-empty")?.remove();
  if (!BUNDLED_NOTES.length && !loadCustomNotes().length) {
    const p = document.createElement('p');
    p.id = 'note-empty';
    p.className = 'hint';
    p.textContent = 'No notes yet. Create one below.';
    ul.appendChild(p);
  }
}

function showNote(note) {
  notesOpen = note;
  $('note-list').classList.add('hidden');
  $('btn-new-note').classList.add('hidden');
  $('note-view').classList.remove('hidden');
  $('note-view-title').textContent = note.name;
  $('note-view-text').textContent = note.text;
  $('btn-note-delete').classList.toggle('hidden', note.kind !== 'custom');
}

function closeNote() {
  notesOpen = null;
  $('note-view').classList.add('hidden');
  $('note-list').classList.remove('hidden');
  $('btn-new-note').classList.remove('hidden');
}

$('btn-note-close').addEventListener('click', closeNote);
$('btn-note-delete').addEventListener('click', () => {
  if (!notesOpen || notesOpen.kind !== 'custom') return;
  const list = loadCustomNotes();
  list.splice(notesOpen.index, 1);
  saveCustomNotes(list);
  renderNoteList();
  closeNote();
});

$('btn-new-note').addEventListener('click', () => {
  $('note-list').classList.add('hidden');
  $('note-view').classList.add('hidden');
  $('note-form').classList.remove('hidden');
  $('note-title').value = '';
  $('note-text').value = '';
  $('note-file').value = '';
  $('note-title').focus();
});
$('btn-note-cancel').addEventListener('click', () => {
  $('note-form').classList.add('hidden');
  $('note-list').classList.remove('hidden');
  $('btn-new-note').classList.remove('hidden');
});

$('note-file').addEventListener('change', () => {
  const f = $('note-file').files[0];
  if (!f) return;
  f.text().then(t => {
    $('note-text').value = t;
    if (!$('note-title').value) $('note-title').value = f.name.replace(/\.(txt|md|text|log)$/i, '');
  });
});

$('btn-note-save').addEventListener('click', () => {
  const name = $('note-title').value.trim() || 'Untitled note';
  const text = $('note-text').value;
  if (!text.trim()) return;
  const list = loadCustomNotes();
  list.unshift({ name, text, at: Date.now() });
  saveCustomNotes(list.slice(0, 50));
  $('note-form').classList.add('hidden');
  renderNoteList();
  $('note-list').classList.remove('hidden');
  $('btn-new-note').classList.remove('hidden');
});

const SNIPPETS = [
  { cat: 'Page info', items: [
    { name: 'Page stats', desc: 'Title, word count, element/link/image totals', usage: 'Returns one summary object — run while a page is open.',
      code: `return {title:document.title,words:document.body.innerText.split(/\\s+/).length,elements:document.getElementsByTagName('*').length,links:document.links.length,images:document.images.length};` },
    { name: 'Meta tags', desc: 'Every meta name/property and its content', usage: 'Great for SEO checks — output is name/content pairs.',
      code: `return [...document.querySelectorAll('meta')].map(m=>[m.name||m.getAttribute('property'),(m.content||'').slice(0,120)]).filter(x=>x[0]);` },
    { name: 'Heading outline', desc: 'h1–h3 hierarchy of the page', usage: 'Shows document structure like a table of contents.',
      code: `return [...document.querySelectorAll('h1,h2,h3')].map(h=>h.tagName+' '+h.textContent.trim().slice(0,80));` },
    { name: 'Detect frameworks', desc: 'React, Vue, jQuery, Next, Angular markers', usage: 'Returns detected libraries, or none.',
      code: `const h=[];if(window.React)h.push('React');if(window.jQuery)h.push('jQuery '+window.jQuery.fn.jquery);if(window.Vue)h.push('Vue');if(window.__NEXT_DATA__)h.push('Next.js');if(window.angular||window.ng)h.push('Angular');return h.length?h:['none detected'];` },
    { name: 'Viewport & screen', desc: 'Window, screen size and pixel ratio', usage: 'Returns viewport vs screen dims plus DPR and page height.',
      code: `return {viewport:innerWidth+'x'+innerHeight,screen:screen.width+'x'+screen.height,dpr:devicePixelRatio,scrollHeight:document.documentElement.scrollHeight};` },
  ]},
  { cat: 'DOM & content', items: [
    { name: 'DOM census', desc: 'Element tag counts, sorted by frequency', usage: 'Run on heavy pages to see what bloats the DOM.',
      code: `const m={};for(const e of document.getElementsByTagName('*'))m[e.tagName]=(m[e.tagName]||0)+1;return Object.entries(m).sort((a,b)=>b[1]-a[1]);` },
    { name: 'All links', desc: 'First 100 anchors as text -> URL', usage: 'Handy for quick crawl/audit of where a page points.',
      code: `return [...document.links].slice(0,100).map(a=>a.textContent.trim().slice(0,60)+' -> '+(a.href||''));` },
    { name: 'All images', desc: 'Image sources and dimensions', usage: 'Returns up to 50 src + natural size pairs — spot broken/tiny images.',
      code: `return [...document.images].slice(0,50).map(i=>[i.currentSrc||i.src,i.naturalWidth+'x'+i.naturalHeight]);` },
    { name: 'Hidden elements', desc: 'Elements currently display:none', usage: 'Reveals DOM content that is not visible on screen.',
      code: `return [...document.querySelectorAll('*')].filter(e=>getComputedStyle(e).display==='none').slice(0,50).map(e=>e.tagName+'.'+e.className).slice(0,30);` },
    { name: 'Text-node count', desc: 'Sample of the page text volume', usage: 'Returns a whitespace-split text-node sample count for the body.',
      code: `const n=document.body.innerText.match(/\\S+/g)||[];return 'sample check: '+n.length+' text nodes on page';` },
  ]},
  { cat: 'Forms & data', items: [
    { name: 'List forms', desc: 'Actions, methods and field names', usage: 'Returns every form with its fields — useful for building API calls.',
      code: `return [...document.forms].map(f=>({action:f.action,method:f.method,fields:[...f.elements].map(e=>e.name||e.type).filter(Boolean)}));` },
    { name: 'Autofill targets', desc: 'Every input/select/textarea inventory', usage: 'Returns tag, name, type, id — map form targets fast.',
      code: `return [...document.querySelectorAll('input,select,textarea')].map(e=>({tag:e.tagName,name:e.name,type:e.type||null,id:e.id}));` },
    { name: 'LocalStorage dump', desc: 'All local keys/values', usage: 'Returns key -> value, values truncated to 200 chars.',
      code: `const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=String(localStorage.getItem(k)).slice(0,200)}return o;` },
    { name: 'SessionStorage dump', desc: 'All session keys/values', usage: 'Same as the LocalStorage dump but for the session store.',
      code: `const o={};for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);o[k]=String(sessionStorage.getItem(k)).slice(0,200)}return o;` },
    { name: 'Cookies', desc: 'Cookie keys and raw string', usage: 'Non-httpOnly cookies only — counts and lists key names.',
      code: `const c=document.cookie;return {count:c?c.split(';').length:0,keys:c?c.split(';').map(s=>s.split('=')[0].trim()):[],raw:c};` },
  ]},
  { cat: 'Network & performance', items: [
    { name: 'Timing metrics', desc: 'DCL, load and first paint times', usage: 'Returns ms timings from the Navigation Timing API.',
      code: `const nav=performance.getEntriesByType('navigation')[0],p=performance.getEntriesByType('paint');return {domContentLoadedMs:Math.round(nav.domContentLoadedEventEnd),loadMs:Math.round(nav.loadEventEnd),transferSize:nav.transferSize,firstPaintMs:p.length?Math.round(p[0].startTime):null};` },
    { name: 'Resource summary', desc: 'Requests count by initiator type', usage: 'Groups requests by type (script, link, img, fetch…).',
      code: `const t={};for(const r of performance.getEntriesByType('resource'))t[r.initiatorType]=(t[r.initiatorType]||0)+1;return t;` },
    { name: 'Slowest resources', desc: 'Top 10 requests by duration', usage: 'Best for spotting slow CDN/doc/script calls.',
      code: `return performance.getEntriesByType('resource').sort((a,b)=>b.duration-a.duration).slice(0,10).map(r=>Math.round(r.duration)+'ms '+(r.name.split('/').pop().slice(0,60)));` },
    { name: 'Network capture', desc: 'What fetch/XHR has been used', usage: 'Reads the request hook log the shim keeps since page load.',
      code: `return window.__BB_NET||['(no hooks — page loaded before capture)'];` },
    { name: 'Lazy-load scroll', desc: 'Auto-scrolls to trigger lazy images', usage: 'Runs an auto-scroll; wait a few seconds, then re-run Page stats.',
      code: `let y=0;const t=setInterval(()=>{y+=600;scrollTo(0,y);if(y>document.body.scrollHeight){clearInterval(t);scrollTo(0,0)}},120);return 'scrolling to trigger lazy-load — check again shortly';` },
  ]},
];

function renderSnippets() {
  const wrap = document.getElementById('snippets');
  for (const group of SNIPPETS) {
    const h = document.createElement('h3');
    h.textContent = group.cat;
    wrap.appendChild(h);
    const ul = document.createElement('ul');
    ul.className = 'snippet-list';
    for (const s of group.items) {
      const li = document.createElement('li');
      const name = document.createElement('b');
      name.textContent = s.name;
      const desc = document.createElement('span');
      desc.className = 'snippet-desc';
      desc.textContent = ' — ' + s.desc;
      li.append(name, desc);
      li.title = s.usage;
      li.addEventListener('click', () => {
        jsCode.value = s.code;
        const hint = document.getElementById('snippet-hint');
        hint.textContent = s.name + ' — ' + s.usage;
        hint.classList.remove('hidden');
        jsCode.focus();
      });
      ul.appendChild(li);
    }
    wrap.appendChild(ul);
  }
}

/* ---------- UA presets ---------- */
const UA_PRESETS = [
  { id: 'default', name: 'Use browser default', ua: '' },
  { id: 'chrome-win', name: 'Chrome · Windows', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  { id: 'chrome-android', name: 'Chrome · Android', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' },
  { id: 'safari-ios', name: 'Safari · iPhone', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1' },
  { id: 'firefox', name: 'Firefox · Windows', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0' },
  { id: 'edge', name: 'Edge · Windows', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0' },
  { id: 'googlebot', name: 'Googlebot', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/124.0.0.0 Safari/537.36' },
];

/* ---------- Dom references ---------- */
const $ = (id) => document.getElementById(id);
const addressIn = $('address'), viewport = $('viewport');
const output = $('output'), jsCode = $('js-code');

/* ---------- Settings & history (localStorage) ---------- */
const STORE_KEY = 'brute-web-v1';
let state = { history: [], ua: 'default', uaCustom: '', js: true, img: true, ck: true };

function loadState() {
  try { Object.assign(state, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch { /* fresh */ }
}
function saveState() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

/* ---------- Settings UI wiring ---------- */
const UA_QUICK = $('ua-quick'), UA_QUICK_CUSTOM = $('ua-quick-custom');

function syncUaCustomInputs() {
  const show = state.ua === 'custom';
  $('ua-custom').classList.toggle('hidden', !show);
  UA_QUICK_CUSTOM.classList.toggle('hidden', !show);
  $('ua-custom').value = UA_QUICK_CUSTOM.value = state.uaCustom || '';
}

function populateUaSelect() {
  const opts = UA_PRESETS.slice();
  if (state.ua === 'custom') opts.push({ id: 'custom', name: 'Custom' });
  const build = (sel) => {
    sel.innerHTML = '';
    for (const p of opts) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      sel.appendChild(o);
    }
    if (state.ua !== 'custom') {
      const c = document.createElement('option');
      c.value = 'custom'; c.textContent = 'Custom…';
      sel.appendChild(c);
    }
    sel.value = state.ua;
  };
  build($('ua-select'));
  build(UA_QUICK);
  syncUaCustomInputs();
}
$('ua-select').addEventListener('change', () => selectUa($('ua-select').value));
UA_QUICK.addEventListener('change', () => selectUa(UA_QUICK.value));
function selectUa(id) {
  state.ua = id;
  populateUaSelect();
  saveState();
}
$('ua-custom').addEventListener('change', setUaCustom);
UA_QUICK_CUSTOM.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); setUaCustom(); addressIn.focus(); } });
UA_QUICK_CUSTOM.addEventListener('blur', setUaCustom);
function setUaCustom() {
  state.uaCustom = UA_QUICK_CUSTOM.value.trim();
  $('ua-custom').value = state.uaCustom;
  if (state.ua !== 'custom') { state.ua = 'custom'; populateUaSelect(); }
  saveState();
}
function bindToggle(id, key) {
  $(id).checked = !!state[key];
  $(id).addEventListener('change', () => {
    state[key] = $(id).checked;
    saveState();
  });
}
bindToggle('set-js', 'js');
bindToggle('set-img', 'img');
bindToggle('set-ck', 'ck');

/* ---------- Command scripts ---------- */
/* Each runs inside the proxied page context, serialized as an async function body. */
const COMMANDS = [
  { name: 'Cookie dump', desc: 'document.cookie contents and counts', code: `const c=document.cookie; return {count:c?c.split(';').length:0,keys:c?c.split(';').map(s=>s.split('=')[0].trim()):[],raw:c};` },
  { name: 'DOM overview', desc: 'total nodes, depth, top-level structure', code: `const t=document.documentElement;let depth=0,n=t;while(n.parentElement){depth++;n=n.parentElement}return {nodes:document.getElementsByTagName('*').length,depth,roots:[...t.children].map(e=>e.tagName)};` },
  { name: 'Element census', desc: 'counts per tag type', code: `const m={};for(const e of document.getElementsByTagName('*'))m[e.tagName]=(m[e.tagName]||0)+1;return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,30).map(([k,v])=>k+': '+v).join('\\n');` },
  { name: 'List links', desc: 'all anchors with hrefs', code: `return [...document.links].slice(0,100).map(a=>a.textContent.trim().slice(0,60)+' -> '+(a.href||'')).join('\\n');` },
  { name: 'List images', desc: 'image sources and dims', code: `return [...document.images].slice(0,50).map(i=>[i.currentSrc||i.src,i.naturalWidth+'x'+i.naturalHeight].join(' ')).join('\\n');` },
  { name: 'List forms & inputs', desc: 'forms, method, field names', code: `return [...document.forms].map(f=>({action:f.action,method:f.method,fields:[...f.elements].map(e=>e.name||e.type).filter(Boolean)}));` },
  { name: 'Meta tags dump', desc: 'all meta name/property/content', code: `return [...document.querySelectorAll('meta')].map(m=>({name:m.name||m.getAttribute('property'),content:(m.content||'').slice(0,120)})).filter(m=>m.name);` },
  { name: 'Page title & headings', desc: 'title + h1..h3 outline', code: `return {title:document.title,outline:[...document.querySelectorAll('h1,h2,h3')].map(h=>h.tagName+' '+h.textContent.trim().slice(0,80))};` },
  { name: 'Performance timing', desc: 'DOMContentLoaded, load, paint timings', code: `const nav=performance.getEntriesByType('navigation')[0],p=performance.getEntriesByType('paint');return {domContentLoadedMs:Math.round(nav.domContentLoadedEventEnd),loadMs:Math.round(nav.loadEventEnd),transferSize:nav.transferSize,firstPaintMs:p.length?Math.round(p[0].startTime):null};` },
  { name: 'Resource summary', desc: 'count + bytes by resource type', code: `const t={};for(const r of performance.getEntriesByType('resource'))t[r.initiatorType]=(t[r.initiatorType]||0)+1;return t;` },
  { name: 'Network capture', desc: 'requests seen since page load (fetch/XHR hooks)', code: `return {log:window.__BB_NET||['(no hooks active - page loaded before capture)',]};` },
  { name: 'LocalStorage dump', desc: 'all keys/values', code: `const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=String(localStorage.getItem(k)).slice(0,200)}return o;` },
  { name: 'SessionStorage dump', desc: 'all keys/values', code: `const o={};for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);o[k]=String(sessionStorage.getItem(k)).slice(0,200)}return o;` },
  { name: 'Viewport & display', desc: 'screen, window and DPR info', code: `return {viewport:innerWidth+'x'+innerHeight,screen:screen.width+'x'+screen.height,dpr:devicePixelRatio,scroll:document.documentElement.scrollHeight+'px total'};` },
  { name: 'Detect frameworks', desc: 'React, Next, Vue, jQuery, WordPress markers', code: `const hits=[];if(window.React)hits.push('React');if(window.jQuery)hits.push('jQuery '+window.jQuery.fn.jquery);if(window.Vue)hits.push('Vue');if(window.__NEXT_DATA__)hits.push('Next.js');if(window.nuxt||window.__NUXT__)hits.push('Nuxt');if(window.angular||window.ng)hits.push('Angular');if(window.svelte)hits.push('Svelte');if(document.querySelector('meta[name=generator]'))hits.push('generator: '+document.querySelector('meta[name=generator]').content);return hits.length?hits:['none detected'];` },
];

function renderCommands() {
  const ul = $('cmd-list');
  ul.innerHTML = '';
  for (const c of COMMANDS) {
    const li = document.createElement('li');
    li.innerHTML = `<b>${c.name}</b><span class="desc">${c.desc}</span>`;
    li.querySelector('b').textContent = c.name;
    li.querySelector('.desc').textContent = c.desc;
    li.addEventListener('click', () => {
      const out = runInject(c.code);
      if (out === null) setOutput('No active page. Navigate somewhere first.', 'err');
    });
    ul.appendChild(li);
  }
}

/* ---------- Params shared with proxy worker ---------- */
function pageParams() {
  const p = new URLSearchParams();
  p.set('js', state.js ? '1' : '0');
  p.set('img', state.img ? '1' : '0');
  p.set('ck', state.ck ? '1' : '0');
  const preset = UA_PRESETS.find(x => x.id === state.ua);
  const ua = state.ua === 'custom' ? state.uaCustom : (preset?.ua || '');
  if (ua) p.set('ua', ua);
  return p;
}
function proxiedUrl(userUrl) {
  const p = pageParams();
  p.set('url', userUrl);
  return '/api/proxy?' + p.toString();
}

/* ---------- Navigation ---------- */
let currentUrl = '';

function absolutize(input) {
  let u = input.trim();
  if (!u) return null;
  if (!/^([a-z][a-z0-9+.-]*:)?\/\//i.test(u)) {
    if (/^[\w.-]+\.[a-z]{2,}(\/|$|:)/i.test(u) || u.startsWith('localhost')) u = 'https://' + u;
    else if (!/^https?:\/\//i.test(u)) return u.startsWith('#') ? null : null;
  }
  try { return new URL(u).href; } catch { return null; }
}

function navigate(rawUrl, { pushHistory = true } = {}) {
  const target = absolutize(rawUrl);
  if (!target) return;
  currentUrl = target;
  addressIn.value = target;
  viewport.src = proxiedUrl(target);
  setOutput('', '');
  if (pushHistory) {
    state.history = state.history.filter(h => h.url !== target);
    state.history.unshift({ url: target, at: Date.now() });
    state.history = state.history.slice(0, 100);
    saveState();
    renderHistory();
  }
}

$('nav-form').addEventListener('submit', (e) => {
  e.preventDefault();
  navigate(addressIn.value);
});
$('btn-reload').addEventListener('click', () => { if (currentUrl) navigate(currentUrl, { pushHistory: false }); });
/* Back: reopen previous entry (app-level, mirrors quick re-open on Android) */
$('btn-back').addEventListener('click', () => {
  const prev = state.history.find(h => h.url !== currentUrl);
  if (prev) navigate(prev.url);
});

function renderHistory() {
  const ul = $('history-list');
  ul.innerHTML = '';
  for (const h of state.history.slice(0, 30)) {
    const li = document.createElement('li');
    const title = document.createElement('span');
    title.textContent = h.url.replace(/^https?:\/\//, '').slice(0, 40);
    const time = document.createElement('span');
    time.textContent = new Date(h.at).toLocaleTimeString();
    li.append(title, time);
    li.addEventListener('click', () => navigate(h.url));
    ul.appendChild(li);
  }
}
$('btn-clear-history').addEventListener('click', () => { state.history = []; saveState(); renderHistory(); });

/* ---------- Panel tabs ---------- */
for (const tab of document.querySelectorAll('#tabs .tab')) {
  tab.addEventListener('click', () => {
    for (const t of document.querySelectorAll('#tabs .tab')) t.classList.toggle('active', t === tab);
    for (const p of document.querySelectorAll('.tabpane')) p.classList.toggle('active', p.id === 'tab-' + tab.dataset.tab);
  });
}
$('btn-tools').addEventListener('click', () => $('panel').classList.toggle('hidden'));

/* ---------- Communication with in-page shim ---------- */
let pending = new Map();
let msgId = 0;

function postShim(msg) {
  return new Promise((resolve, reject) => {
    if (!currentUrl || !viewport.src) return reject(new Error('no page loaded'));
    viewport.contentWindow.postMessage(msg, '*');
    const entry = { resolve, reject, timer: 0 };
    entry.timer = setTimeout(() => { pending.delete(entry.id); reject(new Error('timeout - page did not respond')); }, 10000);
    entry.id = msg.id;
    pending.set(msg.id, entry);
  });
}

window.addEventListener('message', (ev) => {
  if (ev.origin !== location.origin) return; /* shim lives on our origin */
  /* Accept only messages that identify themselves as shim responses */
  const d = ev.data;
  if (!d || typeof d !== 'object' || !d.__bb) return;
  if (d.type === 'result' && pending.has(d.id)) {
    const p = pending.get(d.id);
    clearTimeout(p.timer);
    pending.delete(d.id);
    p.resolve(d);
  } else if (d.kind === 'meta' && d.href) {
    /* Shim reports navigation/title changes on the current page */
    try {
      const real = new URL(d.href, location.origin);
      const target = real.searchParams.get('url');
      if (target) {
        currentUrl = target;
        addressIn.value = currentUrl;
        if (!d.title) return;
        document.title = 'Brute — ' + d.title;
      }
    } catch { /* malformed href */ }
  }
});

/* ---------- Inject execution ---------- */
function setOutput(text, cls) {
  output.textContent = text;
  output.className = 'outbox' + (cls ? ' ' + cls : '');
}

function fmt(v) {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v, null, 2) ?? String(v); } catch { return String(v); }
}

async function runInject(code) {
  try {
    setOutput('Running…', '');
    const res = await postShim({ __bb: true, id: 'm' + (++msgId), type: 'eval', code });
    if (res.error) setOutput('Error: ' + res.error, 'err');
    else setOutput(fmt(res.result), 'ok');
    return res;
  } catch (e) {
    setOutput('Error: ' + e.message, 'err');
    return null;
  }
}
$('btn-run-js').addEventListener('click', () => runInject(jsCode.value.trim()));
jsCode.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runInject(jsCode.value.trim());
});

/* ---------- Boot ---------- */
loadState();
populateUaSelect();
renderCommands();
renderSnippets();
renderHistory();
renderNoteList();
setOutput('Ready. Open a page, then run commands or inject JS.', '');
