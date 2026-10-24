const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/app.js', 'utf8');

const virtualConsole = new (require('jsdom').VirtualConsole)();
let errors = [];
virtualConsole.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
virtualConsole.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  url: 'http://localhost:8787/',
  runScripts: 'dangerously',
  virtualConsole,
});
const { window } = dom;
window.onerror = (msg) => errors.push('window.onerror: ' + msg);

try {
  window.eval(js);
} catch (e) {
  errors.push('boot threw: ' + e.message);
}

// simulate typing a URL and submitting the nav form
try {
  const addr = window.document.getElementById('address');
  addr.value = 'example.com';
  const form = window.document.getElementById('nav-form');
  const ev = new window.Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(ev);
  const iframe = window.document.getElementById('viewport');
  console.log('after submit -> iframe.src =', iframe.getAttribute('src') || iframe.src);
  console.log('address bar =', addr.value);
} catch (e) {
  errors.push('navigate threw: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n'));
}

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n---\n') : 'no boot/navigation errors detected');
