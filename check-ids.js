const fs = require('fs');
const src = fs.readFileSync('public/app.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
const refs = new Set([...src.matchAll(/\$\('([a-z-]+)'\)/g)].map(m => m[1]));
const missing = [...refs].filter(id => !html.includes('id="' + id + '"'));
console.log('ids referenced but missing in HTML:', missing.length ? missing : 'none');
const funcs = new Set([...src.matchAll(/function (\w+)/g)].map(m => m[1]));
console.log('total referenced ids:', refs.size, '(all present unless listed above)');
