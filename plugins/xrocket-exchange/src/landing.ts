import { HOSTED_MCP_URL, HOSTED_ORIGIN } from "./links.js";
import { VERSION } from "./version.js";

const MCP_CONFIG = JSON.stringify(
  {
    mcpServers: {
      xrocket: {
        url: HOSTED_MCP_URL,
      },
    },
  },
  null,
  2,
);

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const LANDING_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>xRocket MCP — trade from your AI with explicit approval</title>
  <meta name="description" content="Prepare, review, and execute xRocket orders through a local MCP client. Start on testnet; keep the account token local.">
  <meta name="theme-color" content="#090a18">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Trade xRocket from your AI">
  <meta property="og:description" content="Market context, order estimates, explicit approval, and guarded execution through MCP.">
  <meta property="og:url" content="${HOSTED_ORIGIN}/">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="${HOSTED_ORIGIN}/">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/landing.css">
  <script src="/landing.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#trade">Skip to trading setup</a>
  <header class="nav shell">
    <a class="brand" href="/" aria-label="xRocket MCP home">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" role="img">
          <path d="M37 8c9 3 15 9 18 18L36 45 19 28C22 18 28 11 37 8Z" fill="currentColor"/>
          <circle cx="39" cy="23" r="4" fill="#6967ff"/>
          <path d="m22 34-9 3 14 14 3-9" fill="#ffd36a"/>
        </svg>
      </span>
      <span>xRocket <span class="muted">MCP</span></span>
    </a>
    <nav aria-label="Project links">
      <a href="https://github.com/nakazanie-ton/myrocket">GitHub</a>
      <a href="#trade">Trading</a>
      <a href="#connect">Market demo</a>
      <a href="#examples">Examples</a>
      <a class="nav-cta" href="#trade">Set up</a>
    </nav>
  </header>

  <main>
    <section class="hero shell">
      <div class="hero-copy">
        <p class="eyebrow"><span></span> Local execution · testnet first</p>
        <h1>Trade xRocket from your AI. <em>Review every order.</em></h1>
        <p class="lede">Ask your MCP client to prepare an order. It returns the market rules, estimate, fee, relevant balance, and exact intent. Nothing is submitted until you explicitly approve.</p>
        <div class="hero-actions">
          <a class="button primary" href="#trade">Set up trading</a>
          <a class="button secondary" href="#connect">Try market demo</a>
        </div>
        <ul class="trust" aria-label="Service boundaries">
          <li>Token stays local</li>
          <li>Estimate before execution</li>
          <li>Single-use approval receipt</li>
        </ul>
      </div>
      <div class="terminal" aria-label="Example guarded order flow">
        <div class="terminal-head"><span></span><span></span><span></span><b>Testnet order</b></div>
        <div class="message user">Prepare a market buy of GRAM-USDT using 10 USDT. Do not execute yet.</div>
        <div class="message agent">
          <div class="agent-label"><span class="spark">✦</span> xRocket MCP</div>
          <p><strong>Prepared — not submitted</strong></p>
          <div class="quote-grid">
            <span>Buy GRAM-USDT<small>market · IOC</small></span>
            <span>10 USDT<small>exact requested funds</small></span>
            <span>Fee + estimate<small>from xRocket API</small></span>
            <span>Balance + rules<small>included in the preview</small></span>
          </div>
          <p class="terminal-note">Awaiting your explicit approval. The receipt expires and can be used once.</p>
        </div>
      </div>
    </section>

    <section class="section shell" id="trade">
      <div class="section-heading">
        <p class="kicker">Your first guarded order</p>
        <h2>Sign in once. Keep the token on your machine.</h2>
        <p>The local MCP profile can read your account and trade. The hosted website never receives your token.</p>
      </div>
      <div class="setup-grid">
        <article class="setup-card featured">
          <div class="step">1</div>
          <h3>Sign in and create an API token</h3>
          <p>Open xRocket, then go to <strong>Menu → Settings → Exchange settings → API token</strong>.</p>
          <a class="small-button inline-button" href="/open" rel="nofollow">Open xRocket <span aria-hidden="true">↗</span></a>
          <p class="hint warning">The token has broad account access. Put it only in your local MCP client's secret or environment settings — never in chat.</p>
        </article>
        <article class="setup-card">
          <div class="step">2</div>
          <h3>Generate the trading config</h3>
          <div class="copy-row">
            <code id="trade-command">npx -y xrocket-mcp@${VERSION} trading-config</code>
            <button type="button" data-copy="trade-command">Copy</button>
          </div>
          <p class="hint">Run it locally, paste the printed JSON into your MCP client, then replace the token placeholder locally. This starts on testnet and enables trading only.</p>
        </article>
        <article class="setup-card">
          <div class="step">3</div>
          <h3>Prepare, review, approve</h3>
          <p class="starter">“On testnet, prepare a market buy of GRAM-USDT using 10 USDT. Show the estimate, fee, balances, rules, and exact intent. Do not execute until I explicitly approve.”</p>
          <button class="small-button" type="button" data-copy-text="On testnet, prepare a market buy of GRAM-USDT using 10 USDT. Show the estimate, fee, balances, rules, and exact intent. Do not execute until I explicitly approve.">Copy prompt</button>
        </article>
      </div>
      <div class="trade-note">
        <strong>Going live later?</strong>
        <span>After testing, run <code>npx -y xrocket-mcp@${VERSION} trading-config --mainnet</code>. This explicitly opens the separate mainnet trading gate; transfers and withdrawals remain disabled.</span>
      </div>
      <p class="copy-status" aria-live="polite"></p>
    </section>

    <section class="section shell" id="connect">
      <div class="section-heading compact">
        <p class="kicker">No-account market demo</p>
        <h2>Try the data before connecting your account.</h2>
        <p>The remote endpoint is useful for prices, spreads, order books, trades, candles, fees, and market rules. It is structurally unable to trade.</p>
      </div>
      <div class="setup-grid demo-grid">
        <article class="setup-card featured">
          <h3>Remote MCP endpoint</h3>
          <div class="copy-row">
            <code id="mcp-url">${HOSTED_MCP_URL}</code>
            <button type="button" data-copy="mcp-url">Copy URL</button>
          </div>
          <p class="hint">Choose Streamable HTTP in a compatible MCP client. No login or token is required.</p>
        </article>
        <article class="setup-card">
          <h3>Generic client JSON</h3>
          <pre id="mcp-config"><code>${escapeHtml(MCP_CONFIG)}</code></pre>
          <button class="small-button" type="button" data-copy="mcp-config">Copy config</button>
        </article>
      </div>
    </section>

    <section class="section examples shell" id="examples">
      <div class="section-heading compact">
        <p class="kicker">Trade by intent</p>
        <h2>Say the outcome and the safety boundary.</h2>
      </div>
      <div class="prompt-grid">
        <button class="prompt" type="button" data-copy-text="Prepare a limit buy of GRAM-USDT: size 1000 GRAM at 0.003 USDT, GTC. Show the estimate and exact intent. Do not execute.">
          <span>01</span><strong>Prepare a limit order</strong><small>Review size, price, fee, rules, and available balance before anything is sent.</small>
        </button>
        <button class="prompt" type="button" data-copy-text="Show my active xRocket orders and explain which funds are currently held.">
          <span>02</span><strong>Inspect active orders</strong><small>Read private order and trading-balance state without changing it.</small>
        </button>
        <button class="prompt" type="button" data-copy-text="Prepare cancellation of this xRocket order. Show the exact order first and wait for my approval.">
          <span>03</span><strong>Cancel with review</strong><small>Bind cancellation to the exact current order and approve it separately.</small>
        </button>
      </div>
    </section>

    <section class="section shell boundary">
      <div>
        <p class="kicker">Two hard boundaries</p>
        <h2>Demo is remote. Trading is local.</h2>
      </div>
      <p>The hosted MCP cannot see balances, accounts, orders, or tokens. The local trading template enables orders, but keeps transfers and withdrawals off. Every order still requires prepare and explicit approval before execution.</p>
      <a href="https://github.com/nakazanie-ton/myrocket/blob/main/docs/SAFETY.md">Read the safety model <span aria-hidden="true">→</span></a>
    </section>

    <section class="final-cta shell">
      <div>
        <p class="kicker">Start without live-money risk</p>
        <h2>Prepare your first testnet order.</h2>
      </div>
      <div class="hero-actions">
        <a class="button primary" href="#trade">Set up trading</a>
        <a class="button secondary" href="/open" rel="nofollow">Open xRocket <span aria-hidden="true">↗</span></a>
      </div>
    </section>
  </main>

  <footer class="shell">
    <p>xRocket MCP v${VERSION} · unofficial open-source integration</p>
    <nav aria-label="Legal and package links">
      <a href="https://github.com/nakazanie-ton/myrocket/blob/main/PRIVACY.md">Privacy</a>
      <a href="https://github.com/nakazanie-ton/myrocket/blob/main/TERMS.md">Terms</a>
      <a href="https://www.npmjs.com/package/xrocket-mcp">npm</a>
      <a href="https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.nakazanie-ton%2Fxrocket">MCP Registry</a>
    </nav>
  </footer>
</body>
</html>`;

export const LANDING_SCRIPT = `(() => {
  const status = document.querySelector('.copy-status');
  const showStatus = (message) => {
    if (!status) return;
    status.textContent = message;
    window.clearTimeout(showStatus.timeout);
    showStatus.timeout = window.setTimeout(() => { status.textContent = ''; }, 2400);
  };
  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value.trim());
      showStatus('Copied.');
    } catch {
      showStatus('Copy failed. Select the text and copy it manually.');
    }
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-copy], [data-copy-text]');
    if (!button) return;
    const targetId = button.getAttribute('data-copy');
    const target = targetId ? document.getElementById(targetId) : null;
    const value = button.getAttribute('data-copy-text') || (target ? target.textContent : '');
    if (value) void copy(value);
  });
})();`;

export const LANDING_STYLES = `
:root{color-scheme:dark;--bg:#090a18;--panel:#111326;--panel-2:#171a31;--line:#292d4a;--text:#f7f7ff;--muted:#a8adc8;--violet:#7775ff;--violet-2:#a29fff;--gold:#ffd36a;--green:#70e0ac;--shadow:0 24px 80px rgba(0,0,0,.35)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 76% 8%,rgba(106,103,255,.17),transparent 31rem),radial-gradient(circle at 10% 38%,rgba(49,201,155,.07),transparent 28rem),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}a{color:inherit;text-decoration:none}button{font:inherit}.shell{width:min(1160px,calc(100% - 40px));margin-inline:auto}.skip-link{position:fixed;left:16px;top:-100px;background:#fff;color:#090a18;padding:10px 14px;border-radius:10px;z-index:50}.skip-link:focus{top:16px}.nav{height:84px;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:11px;font-size:18px;font-weight:760;letter-spacing:-.02em}.brand-mark{width:36px;height:36px;display:grid;place-items:center;border-radius:11px;background:linear-gradient(145deg,#8e8cff,#5552e8);box-shadow:0 10px 28px rgba(105,103,255,.35);color:white}.brand-mark svg{width:27px;height:27px}.muted{color:var(--muted);font-weight:600}.nav nav,.hero-actions,.trust,footer nav{display:flex;align-items:center;gap:24px}.nav nav a{font-size:14px;color:var(--muted);transition:color .2s}.nav nav a:hover,.nav nav a:focus-visible{color:var(--text)}.nav .nav-cta{color:var(--text);border:1px solid var(--line);padding:9px 15px;border-radius:11px}.hero{min-height:640px;display:grid;grid-template-columns:1.02fr .98fr;gap:68px;align-items:center;padding-block:72px 104px}.eyebrow,.kicker{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:800;color:var(--violet-2)}.eyebrow{display:flex;align-items:center;gap:9px;margin:0 0 23px}.eyebrow span{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 5px rgba(112,224,172,.1)}h1,h2,h3,p{margin-top:0}h1{font-size:clamp(48px,6vw,78px);line-height:.98;letter-spacing:-.06em;margin-bottom:26px;max-width:760px}h1 em{display:block;font-style:normal;color:var(--violet-2)}.lede{font-size:19px;line-height:1.65;color:var(--muted);max-width:650px;margin-bottom:32px}.button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:49px;padding:0 20px;border-radius:13px;font-size:15px;font-weight:760;transition:transform .2s,border-color .2s,background .2s}.button:hover{transform:translateY(-2px)}.button:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid rgba(162,159,255,.55);outline-offset:3px}.primary{background:linear-gradient(135deg,#8481ff,#5c58eb);box-shadow:0 15px 34px rgba(91,88,235,.27)}.secondary{border:1px solid var(--line);background:rgba(17,19,38,.55)}.secondary:hover{border-color:#464b72;background:var(--panel)}.trust{list-style:none;padding:0;margin:26px 0 0;gap:20px;color:var(--muted);font-size:13px}.trust li::before{content:"✓";color:var(--green);margin-right:7px;font-weight:900}.terminal{border:1px solid var(--line);border-radius:22px;background:linear-gradient(160deg,rgba(23,26,49,.97),rgba(13,15,31,.98));box-shadow:var(--shadow);overflow:hidden;transform:rotate(1deg)}.terminal-head{height:52px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:7px;padding:0 18px;color:var(--muted);font-size:12px}.terminal-head span{width:8px;height:8px;border-radius:50%;background:#353955}.terminal-head span:first-child{background:#f47f78}.terminal-head span:nth-child(2){background:#f2c86b}.terminal-head span:nth-child(3){background:#64d59a}.terminal-head b{margin-left:auto;font-weight:650}.message{margin:18px;padding:17px 19px;border-radius:15px;font-size:14px}.message.user{margin-left:64px;background:#232744;color:#e8e9fb}.message.agent{border:1px solid #303552;background:#101225;margin-right:36px}.agent-label{font-size:12px;font-weight:800;color:var(--violet-2);text-transform:uppercase;letter-spacing:.11em;margin-bottom:17px}.spark{color:var(--gold);margin-right:5px}.message.agent p{margin-bottom:14px}.quote-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.quote-grid span{border:1px solid #292e49;background:#171a31;border-radius:11px;padding:12px;font-weight:700}.quote-grid small{display:block;color:var(--muted);font-weight:500;margin-top:3px}.terminal-note{color:var(--muted);font-size:12px;margin-top:15px!important;margin-bottom:0!important}.section{padding-block:100px;border-top:1px solid rgba(41,45,74,.72)}.section-heading{max-width:710px;margin-bottom:40px}.section-heading.compact{max-width:680px}.kicker{margin-bottom:13px}h2{font-size:clamp(34px,5vw,54px);line-height:1.04;letter-spacing:-.045em;margin-bottom:18px}.section-heading>p:last-child,.boundary>p{color:var(--muted);font-size:17px}.setup-grid{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:15px}.demo-grid{grid-template-columns:1.35fr 1fr}.setup-card{position:relative;min-width:0;padding:27px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(150deg,rgba(23,26,49,.92),rgba(14,16,33,.92))}.setup-card.featured{border-color:#4a4e79}.step{width:31px;height:31px;display:grid;place-items:center;border-radius:9px;background:rgba(119,117,255,.15);color:var(--violet-2);font-weight:800;font-size:13px;margin-bottom:34px}.setup-card h3{font-size:19px;letter-spacing:-.02em;margin-bottom:15px}.setup-card>p{color:#d9daf0}.copy-row{display:flex;align-items:center;gap:10px;border:1px solid #343957;border-radius:12px;background:#0c0e20;padding:7px 7px 7px 13px}.copy-row code{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d9daf0;font-size:12px}.copy-row button,.small-button{cursor:pointer;border:1px solid #42476b;color:var(--text);background:#242844;border-radius:9px;padding:9px 12px;font-weight:750;font-size:12px;white-space:nowrap}.copy-row button:hover,.small-button:hover{background:#303554}.inline-button{display:inline-flex;align-items:center;gap:6px}.hint{color:var(--muted)!important;font-size:12px;margin:13px 0 0}.warning{color:#f0d997!important}.setup-card pre{min-height:112px;overflow:auto;margin:0 0 13px;padding:13px;border:1px solid #303550;border-radius:11px;background:#0c0e20;color:#d9daf0;font-size:11px;line-height:1.55}.starter{min-height:112px;color:#d9daf0;font-size:15px;line-height:1.65}.trade-note{display:flex;gap:18px;margin-top:15px;padding:17px 20px;border:1px solid #343957;border-radius:14px;background:rgba(17,19,38,.72);color:var(--muted);font-size:13px}.trade-note strong{flex:0 0 auto;color:var(--text)}.trade-note code{color:#d9daf0}.copy-status{min-height:24px;color:var(--green);font-size:13px;margin:15px 0 0}.prompt-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.prompt{text-align:left;cursor:pointer;color:var(--text);min-height:220px;padding:25px;border:1px solid var(--line);border-radius:18px;background:rgba(17,19,38,.72);transition:transform .2s,border-color .2s,background .2s}.prompt:hover{transform:translateY(-3px);border-color:#4c517c;background:var(--panel-2)}.prompt>span{display:block;color:var(--violet-2);font-size:12px;font-weight:800;letter-spacing:.12em;margin-bottom:42px}.prompt strong{display:block;font-size:18px;margin-bottom:10px}.prompt small{display:block;color:var(--muted);font-size:13px;line-height:1.6}.boundary{display:grid;grid-template-columns:1fr 1.2fr auto;align-items:end;gap:42px}.boundary h2{margin-bottom:0}.boundary>p{margin-bottom:2px}.boundary>a{color:var(--violet-2);font-weight:750;white-space:nowrap;margin-bottom:5px}.final-cta{margin-block:90px;padding:42px;border:1px solid #3a3f62;border-radius:24px;background:linear-gradient(120deg,rgba(119,117,255,.13),rgba(20,22,43,.9));display:flex;justify-content:space-between;align-items:center;gap:30px}.final-cta h2{font-size:38px;margin:0}.final-cta .kicker{margin-bottom:10px}footer{min-height:100px;padding-block:30px;border-top:1px solid rgba(41,45,74,.72);display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:12px}footer p{margin:0}footer nav{gap:18px}footer a:hover{color:var(--text)}
@media(max-width:900px){.hero{grid-template-columns:1fr;gap:50px;padding-top:52px}.terminal{transform:none;max-width:680px}.setup-grid,.prompt-grid{grid-template-columns:1fr 1fr}.setup-card.featured{grid-column:1/-1}.demo-grid .setup-card.featured{grid-column:auto}.boundary{grid-template-columns:1fr 1fr}.boundary>a{grid-column:1/-1}.final-cta{align-items:flex-start;flex-direction:column}}
@media(max-width:620px){.shell{width:min(100% - 28px,1160px)}.nav{height:70px}.nav nav>a:not(.nav-cta){display:none}.hero{min-height:auto;padding-block:50px 80px}h1{font-size:48px}.lede{font-size:17px}.hero-actions{align-items:stretch;flex-direction:column;gap:10px}.button{width:100%}.trust{display:grid;grid-template-columns:1fr;gap:7px}.terminal{margin-inline:-2px}.message.user{margin-left:34px}.message.agent{margin-right:18px}.quote-grid{grid-template-columns:1fr}.section{padding-block:76px}.setup-grid,.prompt-grid{grid-template-columns:1fr}.setup-card.featured{grid-column:auto}.copy-row{align-items:stretch;flex-direction:column}.copy-row code{white-space:normal;overflow-wrap:anywhere}.copy-row button{width:100%}.trade-note{flex-direction:column}.prompt{min-height:190px}.boundary{grid-template-columns:1fr;gap:20px}.boundary>a{grid-column:auto}.final-cta{margin-block:65px;padding:29px}.final-cta h2{font-size:32px}footer{align-items:flex-start;flex-direction:column;gap:18px}footer nav{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{transition:none!important}}
`;

export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#6967ff"/><path d="M37 8c9 3 15 9 18 18L36 45 19 28C22 18 28 11 37 8Z" fill="#fff"/><circle cx="39" cy="23" r="4" fill="#6967ff"/><path d="m22 34-9 3 14 14 3-9" fill="#ffd36a"/></svg>`;

export const ROBOTS_TXT = `User-agent: *\nAllow: /\nSitemap: ${HOSTED_ORIGIN}/sitemap.xml\n`;

export const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${HOSTED_ORIGIN}/</loc></url></urlset>\n`;
