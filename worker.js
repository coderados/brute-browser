/* Brute Browser proxy worker — fetches pages server-side with UA override,
   strips embedding/CSP blockers, rewrites links back through the proxy,
   and injects a shim script so the parent app can run JS on the page. */

function absolutize(base, u) {
  try { return new URL(u, base).href; } catch { return null; }
}

const SKIP_SCHEME = /^(javascript|data|mailto|tel|blob|about|intent|magnet|ws|wss):/i;

/* Rewrite URL-bearing attributes in HTML so navigation stays in the app.
   Attribute-based (not a full DOM parse) — safe pass for v1. */
function rewriteHtml(html, baseUrl, origin, opts) {
  let out = html;

  const proxied = (val) => {
    const abs = val && absolutize(baseUrl, val.trim());
    if (!abs || SKIP_SCHEME.test(val.trim()) || !/^https?:/i.test(abs)) return null;
    return origin + '/api/proxy?url=' + encodeURIComponent(abs);
  };

  for (const a of ['href', 'src', 'action', 'poster']) {
    const re = new RegExp('(<[^>\\n]*?\\s' + a + '\\s*=\\s*")([^"]*)(")', 'gi');
    out = out.replace(re, (m, pre, val, post) => {
      const p = proxied(val);
      return p ? pre + p + post : m;
    });
  }

  /* srcset: keep descriptors, make URLs absolute so the browser fetches direct */
  out = out.replace(/(\ssrcset\s*=\s*")([^"]*)(")/gi, (m, pre, val, post) => {
    const parts = val.split(',').map((piece) => {
      const seg = piece.trim().split(/\s+/);
      const abs = absolutize(baseUrl, seg[0]);
      if (!abs) return piece.trim();
      return [abs, ...seg.slice(1)].join(' ');
    });
    return pre + parts.join(', ') + post;
  });

  if (!opts.js) {
    out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    out = out.replace(/<script\b[^>]*\/>/gi, '');
  }
  if (!opts.img) {
    out = out.replace(/<img\b[^>]*>/gi, '');
  }

  if (opts.js) {
    const shimTag = '<script src="' + origin + '/api/shim.js"></script>';
    if (/<head[^>]*>/i.test(out)) out = out.replace(/<head([^>]*)>/i, (m) => m + shimTag);
    else out = shimTag + out;
  }
  return out;
}

const HTML_CT = /^text\/html\b/i;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = url.origin;

    if (url.pathname === '/api/shim.js') {
      return new Response(shimSource(), {
        headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    if (url.pathname === '/api/proxy') {
      const target = url.searchParams.get('url');
      const opts = {
        js: url.searchParams.get('js') !== '0',
        img: url.searchParams.get('img') !== '0',
        ck: url.searchParams.get('ck') !== '0',
        ua: url.searchParams.get('ua') || '',
      };
      if (!target) return new Response('missing url', { status: 400 });
      let parsed;
      try { parsed = new URL(target); } catch { return new Response('bad url', { status: 400 }); }
      if (!/^https?:$/.test(parsed.protocol)) return new Response('unsupported scheme', { status: 400 });

      const headers = { 'user-agent': opts.ua || 'BruteBrowser/1.0' };
      const resp = await fetch(parsed.href, {
        headers,
        redirect: 'follow',
      }).catch((e) => ({ err: e }));

      if (resp.err) {
        return new Response('proxy fetch failed: ' + (resp.err?.message || 'unknown'), { status: 502 });
      }

      let out = resp;
      if (!opts.ck) {
        out = new Response(resp.body, resp);
        out.headers.delete('set-cookie');
      }

      const ct = out.headers.get('content-type') || '';
      if (!HTML_CT.test(ct)) {
        return new Response(out.body, {
          status: out.status,
          headers: {
            'content-type': ct || 'application/octet-stream',
            'cache-control': 'no-store',
            'x-brute-url': out.url,
          },
        });
      }

      let text = await out.text();
      text = text.replace(/<base\s[^>]*>/gi, '');
      const rewritten = rewriteHtml(text, out.url, origin, opts);
      return new Response(rewritten, {
        status: out.status,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'x-brute-url': out.url,
        },
      });
    }

    /* Static app assets */
    return env.ASSETS.fetch(request);
  },
};

function shimSource() {
  return `
/* Brute shim — injected into every proxied page: script evaluation in page context,
   fetch/XHR capture, and navigation self-report for the parent app. */
(function () {
  if (window.__BB_SHIM_READY) return;
  window.__BB_SHIM_READY = true;
  window.__BB_NET = [];
  try {
    var oFetch = window.fetch;
    window.fetch = function () {
      var u = String((arguments[0] && arguments[0].url) || arguments[0] || '');
      window.__BB_NET.push('fetch ' + u.slice(0, 200));
      if (window.__BB_NET.length > 200) window.__BB_NET.shift();
      return oFetch.apply(this, arguments);
    };
    var oXOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u) {
      window.__BB_NET.push(String(m).toUpperCase() + ' ' + String(u).slice(0, 200));
      if (window.__BB_NET.length > 200) window.__BB_NET.shift();
      return oXOpen.apply(this, arguments);
    };
  } catch (e) {}

  function reportMeta() {
    try {
      parent.postMessage({
        __bb: true, from: 'shim', kind: 'meta',
        title: document.title, href: window.location.href,
      }, '*');
    } catch (e) {}
  }

  window.addEventListener('load', reportMeta);
  document.addEventListener('DOMContentLoaded', reportMeta);

  window.addEventListener('message', function (ev) {
    var m = ev.data;
    if (!m || m.__bb !== true || m.type !== 'eval' || typeof m.code !== 'string') return;
    var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    var win = window;
    new AsyncFunction(m.code)
      .call(win)
      .then(function (result) {
        parent.postMessage({ __bb: true, type: 'result', id: m.id, error: null,
          result: result === undefined ? null : result }, '*');
      })
      .catch(function (e) {
        parent.postMessage({ __bb: true, type: 'result', id: m.id,
          error: String((e && e.message) || e), result: null }, '*');
      });
  });
})();
`;
}
