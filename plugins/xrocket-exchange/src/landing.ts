import { HOSTED_MCP_URL, HOSTED_ORIGIN } from "./links.js";
import { VERSION } from "./version.js";

const MCP_CONFIG = JSON.stringify(
  { mcpServers: { xrocket: { url: HOSTED_MCP_URL } } },
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
  <title>xRocket MCP — autonomous CEX trading for AI agents</title>
  <meta name="description" content="Set a daily trading limit, connect xRocket locally, and let your AI agent trade. Transfers and withdrawals stay locked behind explicit approval.">
  <meta name="theme-color" content="#080a08">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Give your agent a limit. It trades.">
  <meta property="og:description" content="Autonomous xRocket trading over MCP, bounded by one daily value limit.">
  <meta property="og:url" content="${HOSTED_ORIGIN}/">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="${HOSTED_ORIGIN}/">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/landing.css">
  <script src="/landing.js" defer></script>
</head>
<body data-version="${VERSION}">
  <a class="skip-link" href="#trade">Skip to setup</a>
  <header class="topbar frame">
    <a class="brand" href="/" aria-label="xRocket MCP home">
      <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M19 3c5 2 8 5 10 10L18 24 8 14C10 8 14 5 19 3Z"/><circle cx="20" cy="11" r="2"/><path d="m10 18-6 2 8 8 2-6"/></svg>
      <span>xRocket</span><b>MCP</b>
    </a>
    <nav aria-label="Main navigation">
      <a href="#trade">Set up</a>
      <a href="#demo">Market data</a>
      <a href="https://github.com/nakazanie-ton/myrocket">GitHub</a>
      <a class="nav-action" href="#trade">Connect agent</a>
    </nav>
  </header>

  <main>
    <section class="hero frame">
      <div class="hero-copy">
        <p class="signal"><span></span> xRocket spot · MCP</p>
        <h1>Give your agent<br>a limit. <em>It trades.</em></h1>
        <p class="lead">Set one daily value limit. Add your API key locally. Give the agent a strategy.</p>
        <div class="actions">
          <a class="button primary" href="#trade">Set up the agent</a>
          <a class="button text-button" href="#how">See how it works <span>↘</span></a>
        </div>
        <p class="microcopy">Orders run automatically inside the limit. Transfers and withdrawals do not.</p>
      </div>

      <div class="mandate" aria-label="Example autonomous trading mandate">
        <div class="mandate-head">
          <div><span class="status-dot"></span> AGENT MANDATE</div>
          <span>TESTNET</span>
        </div>
        <div class="limit-row">
          <span>Daily limit</span>
          <strong>100 <small>USD</small></strong>
        </div>
        <div class="usage">
          <div><span>Used today</span><b>24.80 USD</b></div>
          <i><span></span></i>
          <small>75.20 USD available</small>
        </div>
        <dl class="permissions">
          <div><dt>Markets</dt><dd>ALL SPOT</dd></div>
          <div><dt>Orders</dt><dd class="on">AUTONOMOUS</dd></div>
          <div><dt>Transfers</dt><dd class="off">LOCKED</dd></div>
          <div><dt>Withdrawals</dt><dd class="off">LOCKED</dd></div>
        </dl>
        <div class="activity">
          <div class="activity-head"><span>Recent execution</span><span>VALUE</span><span>STATUS</span></div>
          <div><span><b>BUY</b> GRAM–USDT</span><span>8.00</span><i>FILLED</i></div>
          <div><span><b>SELL</b> BTC–USDT</span><span>12.40</span><i>FILLED</i></div>
          <div><span><b>BUY</b> XROCK–USDT</span><span>4.40</span><i>WORKING</i></div>
        </div>
      </div>
    </section>

    <section class="ticker" aria-label="Product capabilities">
      <div><span>01</span> LIVE MARKET DATA</div>
      <div><span>02</span> AUTONOMOUS ORDERS</div>
      <div><span>03</span> LOCAL CREDENTIALS</div>
      <div><span>04</span> HARD DAILY LIMIT</div>
    </section>

    <section class="setup frame" id="trade">
      <div class="section-label">SETUP / 01</div>
      <div class="setup-heading">
        <h2>One limit.<br>One local config.</h2>
        <p>No symbol list is required. The agent can trade any available spot pair inside the daily value limit you set.</p>
      </div>

      <div class="configurator">
        <div class="config-controls">
          <div class="field-group">
            <label for="limit-amount">Daily trading limit</label>
            <div class="limit-control">
              <input id="limit-amount" inputmode="decimal" value="100" aria-describedby="limit-help">
              <input id="limit-asset" list="limit-assets" value="USD" maxlength="16" aria-label="Limit asset">
              <datalist id="limit-assets"><option value="USD"><option value="USDT"><option value="TONCOIN"><option value="BTC"></datalist>
            </div>
            <p id="limit-help">All agent orders together cannot exceed this value per UTC day.</p>
          </div>
          <fieldset>
            <legend>Environment</legend>
            <label><input type="radio" name="environment" value="testnet" checked><span>Testnet</span></label>
            <label><input type="radio" name="environment" value="mainnet"><span>Mainnet</span></label>
          </fieldset>
          <div class="locked-row"><span>Transfers</span><b>EXPLICIT ONLY</b></div>
          <div class="locked-row"><span>Withdrawals</span><b>EXPLICIT ONLY</b></div>
        </div>

        <div class="command-panel">
          <div class="command-head"><span>GENERATED COMMAND</span><span>v${VERSION}</span></div>
          <pre id="trade-command">npx -y xrocket-mcp@${VERSION} trading-config --limit 100 --asset USD</pre>
          <button class="copy-command" type="button" data-copy="trade-command">Copy command</button>
          <p>Run locally. The command prints the MCP config with a token placeholder and your limit.</p>
        </div>
      </div>

      <ol class="steps" id="how">
        <li>
          <span>01</span><h3>Get the key</h3>
          <p>Sign in to xRocket. Open <strong>Menu → Settings → Exchange settings → API token</strong>.</p>
          <a href="/open" rel="nofollow">Open xRocket ↗</a>
        </li>
        <li>
          <span>02</span><h3>Add it locally</h3>
          <p>Run the generated command, paste its JSON into your MCP client, and replace the placeholder on your machine.</p>
        </li>
        <li>
          <span>03</span><h3>Give it a strategy</h3>
          <p>Tell your agent what to trade and when. Orders inside the limit execute without asking again.</p>
          <button type="button" data-copy-text="Use xRocket on testnet. Trade GRAM-USDT with this strategy: [describe strategy]. Stay inside the configured daily trading limit. Do not transfer or withdraw funds.">Copy starter prompt</button>
        </li>
      </ol>
      <p class="secret-note"><b>API keys stay local.</b> This website and the hosted MCP endpoint never receive account credentials.</p>
      <p class="copy-status" aria-live="polite"></p>
    </section>

    <section class="proof frame">
      <div class="section-label">CONTROL / 02</div>
      <h2>The agent gets execution.<br>Not the keys to everything.</h2>
      <div class="control-table">
        <div class="table-head"><span>CAPABILITY</span><span>BEHAVIOUR</span><span>CONTROL</span></div>
        <div><strong>Market + limit orders</strong><span>Runs automatically</span><b class="green">DAILY LIMIT</b></div>
        <div><strong>Order cancellation</strong><span>Runs automatically</span><b class="green">TRADING SCOPE</b></div>
        <div><strong>Internal transfers</strong><span>Prepared, then approved</span><b>EXPLICIT</b></div>
        <div><strong>External withdrawals</strong><span>Prepared, then approved</span><b>EXPLICIT</b></div>
        <div><strong>Unknown write result</strong><span>Never sent twice</span><b>FAIL CLOSED</b></div>
      </div>
    </section>

    <section class="demo frame" id="demo">
      <div>
        <div class="section-label">PUBLIC DEMO / 03</div>
        <h2>Market data.<br>No account needed.</h2>
        <p>Connect the hosted endpoint for prices, books, trades, candles, fees, and market rules. It cannot access an account or trade.</p>
      </div>
      <div class="demo-config">
        <div class="command-head"><span>STREAMABLE HTTP</span><span>PUBLIC</span></div>
        <code id="mcp-url">${HOSTED_MCP_URL}</code>
        <button type="button" data-copy="mcp-url">Copy URL</button>
        <details>
          <summary>Generic client JSON</summary>
          <pre id="mcp-config">${escapeHtml(MCP_CONFIG)}</pre>
          <button type="button" data-copy="mcp-config">Copy JSON</button>
        </details>
      </div>
    </section>

    <section class="closing frame">
      <p>YOUR STRATEGY.<br>YOUR LIMIT.</p>
      <h2>Let the agent<br>run the orders.</h2>
      <a class="button primary" href="#trade">Configure xRocket MCP</a>
    </section>
  </main>

  <footer class="frame">
    <p>xRocket MCP v${VERSION} · unofficial open-source integration</p>
    <nav aria-label="Package and policy links">
      <a href="https://github.com/nakazanie-ton/myrocket">Source</a>
      <a href="https://www.npmjs.com/package/xrocket-mcp">npm</a>
      <a href="https://github.com/nakazanie-ton/myrocket/blob/main/PRIVACY.md">Privacy</a>
      <a href="https://github.com/nakazanie-ton/myrocket/blob/main/TERMS.md">Terms</a>
    </nav>
  </footer>
</body>
</html>`;

export const LANDING_SCRIPT = `(() => {
  const status = document.querySelector('.copy-status');
  const amount = document.getElementById('limit-amount');
  const asset = document.getElementById('limit-asset');
  const command = document.getElementById('trade-command');
  const version = document.body.dataset.version;
  const showStatus = (message) => {
    if (!status) return;
    status.textContent = message;
    window.clearTimeout(showStatus.timeout);
    showStatus.timeout = window.setTimeout(() => { status.textContent = ''; }, 2400);
  };
  const updateCommand = () => {
    const raw = amount && amount.value.trim();
    const safeAmount = /^(?:0|[1-9]\\d*)(?:\\.\\d+)?$/.test(raw || '') && /[1-9]/.test(raw || '') ? raw : '100';
    const rawAsset = asset && asset.value.trim();
    const selectedAsset = /^[A-Za-z0-9]{2,16}$/.test(rawAsset || '') ? rawAsset.toUpperCase() : 'USD';
    const invalidAsset = Boolean(rawAsset) && selectedAsset === 'USD' && rawAsset.toUpperCase() !== 'USD';
    if (asset) asset.setAttribute('aria-invalid', String(invalidAsset));
    const environment = document.querySelector('input[name="environment"]:checked');
    const mainnet = environment && environment.value === 'mainnet' ? ' --mainnet' : '';
    if (command) command.textContent = 'npx -y xrocket-mcp@' + version + ' trading-config --limit ' + safeAmount + ' --asset ' + selectedAsset + mainnet;
  };
  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value.trim());
      showStatus('Copied.');
    } catch {
      showStatus('Copy failed. Select the text and copy it manually.');
    }
  };
  document.addEventListener('input', updateCommand);
  document.addEventListener('change', updateCommand);
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-copy], [data-copy-text]');
    if (!button) return;
    const targetId = button.getAttribute('data-copy');
    const target = targetId ? document.getElementById(targetId) : null;
    const value = button.getAttribute('data-copy-text') || (target ? target.textContent : '');
    if (value) void copy(value);
  });
  updateCommand();
})();`;

export const LANDING_STYLES = `
#limit-asset{border-left:1px solid var(--line-strong);font-size:12px;text-transform:uppercase}#limit-asset[aria-invalid="true"]{box-shadow:inset 0 0 0 2px var(--red)}
:root{color-scheme:dark;--bg:#080a08;--surface:#0d100d;--line:#2a3029;--line-strong:#465044;--text:#f3f5f0;--muted:#929b8f;--acid:#c7ff4f;--red:#ff735d}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:"Arial Narrow","Helvetica Neue",Arial,sans-serif;line-height:1.45}body::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.035;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:64px 64px}a{color:inherit;text-decoration:none}button,input,select{font:inherit}.frame{width:min(1180px,calc(100% - 48px));margin-inline:auto}.skip-link{position:fixed;left:16px;top:-100px;background:var(--acid);color:#080a08;padding:10px 14px;z-index:50}.skip-link:focus{top:16px}.topbar{height:78px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:9px;font-size:16px;font-weight:800;letter-spacing:-.02em}.brand svg{width:27px;height:27px;fill:var(--text)}.brand svg circle{fill:var(--bg)}.brand b{color:var(--muted);font-size:11px;letter-spacing:.12em}.topbar nav{display:flex;align-items:center;gap:28px}.topbar nav a{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}.topbar nav a:hover,.topbar nav a:focus-visible{color:var(--text)}.topbar .nav-action{color:var(--bg);background:var(--acid);padding:11px 15px}.hero{min-height:690px;padding:92px 0 105px;display:grid;grid-template-columns:1.05fr .95fr;gap:78px;align-items:center}.signal,.section-label,.command-head,.mandate-head,.table-head{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase}.signal{display:flex;align-items:center;gap:10px;color:var(--muted);margin:0 0 28px}.signal span,.status-dot{width:7px;height:7px;border-radius:50%;background:var(--acid);box-shadow:0 0 0 4px rgba(199,255,79,.08)}h1,h2,h3,p{margin-top:0}h1{font-size:clamp(54px,6.5vw,88px);line-height:.91;letter-spacing:-.07em;margin:0 0 30px;font-weight:760}h1 em{color:var(--acid);font-style:normal}.lead{max-width:570px;color:#c9cec5;font-size:19px;line-height:1.55;margin-bottom:34px}.actions{display:flex;align-items:center;gap:22px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 19px;font-size:13px;font-weight:800;letter-spacing:.04em}.button.primary{background:var(--acid);color:#080a08}.button:hover{filter:brightness(1.06)}.text-button{padding-inline:0;color:var(--muted)}.text-button span{color:var(--acid);margin-left:9px}.microcopy{margin:25px 0 0;color:#6f786d;font-size:12px}.mandate{border:1px solid var(--line-strong);background:var(--surface);box-shadow:16px 16px 0 #030403}.mandate-head{height:52px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);color:var(--muted)}.mandate-head div{display:flex;align-items:center;gap:10px;color:var(--text)}.limit-row{padding:27px 24px 23px;display:flex;align-items:end;justify-content:space-between}.limit-row>span{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}.limit-row strong{font-size:48px;line-height:1;letter-spacing:-.05em}.limit-row small{color:var(--muted);font-size:13px;letter-spacing:.08em}.usage{padding:0 24px 25px}.usage>div,.usage>small{display:flex;justify-content:space-between;color:var(--muted);font-size:11px}.usage b{color:var(--text)}.usage i{display:block;height:3px;background:#252b24;margin:10px 0 8px}.usage i span{display:block;width:24.8%;height:100%;background:var(--acid)}.permissions{display:grid;grid-template-columns:1fr 1fr;margin:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.permissions div{padding:16px 20px;display:flex;justify-content:space-between;border-right:1px solid var(--line);border-bottom:1px solid var(--line);font-size:11px}.permissions div:nth-child(2n){border-right:0}.permissions div:nth-last-child(-n+2){border-bottom:0}.permissions dt{color:var(--muted)}.permissions dd{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;letter-spacing:.08em}.permissions .on{color:var(--acid)}.permissions .off{color:var(--red)}.activity{padding:18px 20px 14px}.activity>div{display:grid;grid-template-columns:1.5fr .6fr .5fr;gap:10px;padding:9px 0;border-bottom:1px solid #20251f;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px}.activity>div:last-child{border-bottom:0}.activity .activity-head{color:#687065;letter-spacing:.1em}.activity b{color:var(--acid);font-weight:500;margin-right:5px}.activity i{font-style:normal;color:var(--muted);text-align:right}.ticker{min-height:72px;border-block:1px solid var(--line);display:grid;grid-template-columns:repeat(4,1fr)}.ticker div{display:flex;align-items:center;justify-content:center;gap:14px;border-right:1px solid var(--line);font-size:10px;font-weight:800;letter-spacing:.1em}.ticker div:last-child{border-right:0}.ticker span{color:var(--acid);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.setup,.proof,.demo{padding-block:118px}.section-label{color:var(--acid);margin-bottom:30px}.setup-heading{display:grid;grid-template-columns:1.15fr .85fr;gap:80px;align-items:end;margin-bottom:55px}.setup-heading h2,.proof h2,.demo h2,.closing h2{font-size:clamp(43px,5.4vw,68px);line-height:.95;letter-spacing:-.06em;margin:0}.setup-heading p,.demo>div>p{max-width:520px;color:var(--muted);font-size:17px;margin:0}.configurator{display:grid;grid-template-columns:.9fr 1.1fr;border:1px solid var(--line-strong);background:var(--surface)}.config-controls{padding:30px;border-right:1px solid var(--line)}.field-group label,fieldset legend{display:block;margin-bottom:12px;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em}.limit-control{display:grid;grid-template-columns:1fr 130px;border:1px solid var(--line-strong)}.limit-control input,.limit-control select{height:60px;border:0;background:#090b09;color:var(--text);padding:0 17px;outline:none}.limit-control input{font-size:25px;font-weight:800}.limit-control select{border-left:1px solid var(--line-strong);font-size:12px;font-weight:800}.limit-control input:focus,.limit-control select:focus{box-shadow:inset 0 0 0 2px var(--acid)}.field-group p{font-size:11px;color:#717a6f;margin:10px 0 25px}fieldset{border:0;padding:0;margin:0 0 24px;display:grid;grid-template-columns:1fr 1fr}fieldset legend{grid-column:1/-1}fieldset label input{position:absolute;opacity:0}fieldset label span{height:43px;border:1px solid var(--line-strong);display:grid;place-items:center;color:var(--muted);font-size:11px;text-transform:uppercase;cursor:pointer}fieldset label+label span{border-left:0}fieldset input:checked+span{background:var(--acid);color:#080a08;font-weight:800}.locked-row{display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid var(--line);font-size:11px}.locked-row span{color:var(--muted)}.locked-row b{color:var(--red);font-size:9px;letter-spacing:.08em}.command-panel{padding:30px;display:flex;flex-direction:column}.command-head{display:flex;justify-content:space-between;color:var(--muted);margin-bottom:17px}.command-panel pre{white-space:pre-wrap;overflow-wrap:anywhere;min-height:116px;padding:20px;margin:0;background:#050605;border:1px solid var(--line);color:#e3e8df;font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}.copy-command,.demo-config>button,.demo-config details button,.steps button{cursor:pointer;border:0;background:var(--acid);color:#080a08;min-height:42px;padding:0 15px;font-size:11px;font-weight:800;letter-spacing:.05em}.command-panel .copy-command{align-self:flex-start;margin-top:15px}.command-panel>p{color:var(--muted);font-size:11px;margin:auto 0 0;padding-top:24px}.steps{list-style:none;padding:0;margin:48px 0 0;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.steps li{min-height:268px;padding:26px 28px 25px 0;border-right:1px solid var(--line)}.steps li+li{padding-left:28px}.steps li:last-child{border-right:0}.steps>li>span{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--acid)}.steps h3{font-size:22px;letter-spacing:-.03em;margin:55px 0 12px}.steps p{min-height:62px;color:var(--muted);font-size:13px;line-height:1.6}.steps a,.steps button{display:inline-flex;margin-top:11px;color:var(--text);font-size:11px;font-weight:800;border-bottom:1px solid var(--line-strong)}.steps button{background:none;padding:0 0 4px;min-height:0}.secret-note{margin:22px 0 0;color:var(--muted);font-size:12px}.secret-note b{color:var(--text)}.copy-status{position:fixed;right:20px;bottom:20px;z-index:20;min-width:0;margin:0;background:var(--acid);color:#080a08;font-size:11px;font-weight:800}.copy-status:not(:empty){padding:10px 14px}.proof{border-top:1px solid var(--line)}.proof h2{max-width:850px;margin-bottom:58px}.control-table{border-top:1px solid var(--line-strong)}.control-table>div{display:grid;grid-template-columns:1.15fr 1fr .55fr;gap:25px;align-items:center;min-height:68px;border-bottom:1px solid var(--line);font-size:13px}.control-table span{color:var(--muted)}.control-table b{font:9px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}.control-table b.green{color:var(--acid)}.control-table .table-head{min-height:43px;color:#697167}.demo{border-top:1px solid var(--line);display:grid;grid-template-columns:1fr 1fr;gap:95px}.demo>div>p{margin-top:24px}.demo-config{border:1px solid var(--line-strong);background:var(--surface);padding:24px}.demo-config code,.demo-config pre{display:block;padding:18px;background:#050605;border:1px solid var(--line);font:11px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere;white-space:pre-wrap}.demo-config>button{margin-top:12px}.demo-config details{margin-top:22px;border-top:1px solid var(--line);padding-top:17px}.demo-config summary{cursor:pointer;color:var(--muted);font-size:11px}.demo-config details pre{margin:15px 0 10px}.closing{margin-block:20px 110px;padding:70px;border:1px solid var(--line-strong);display:grid;grid-template-columns:.6fr 1.4fr auto;gap:50px;align-items:center}.closing>p{font:10px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--acid);margin:0}.closing h2{font-size:55px}footer{min-height:95px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;color:#6f776d;font-size:10px}footer p{margin:0}footer nav{display:flex;gap:23px}footer a:hover{color:var(--text)}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--acid);outline-offset:3px}
@media(max-width:900px){.hero{grid-template-columns:1fr;gap:65px}.mandate{max-width:630px}.ticker{grid-template-columns:1fr 1fr}.ticker div:nth-child(2){border-right:0}.ticker div:nth-child(-n+2){border-bottom:1px solid var(--line)}.setup-heading,.demo{grid-template-columns:1fr;gap:35px}.configurator{grid-template-columns:1fr}.config-controls{border-right:0;border-bottom:1px solid var(--line)}.closing{grid-template-columns:1fr;align-items:start}.closing h2{font-size:48px}}
@media(max-width:650px){.frame{width:min(100% - 28px,1180px)}.topbar{height:68px}.topbar nav>a:not(.nav-action){display:none}.hero{padding:67px 0 80px;min-height:auto}h1{font-size:52px}.lead{font-size:17px}.actions{align-items:stretch;flex-direction:column}.text-button{justify-content:flex-start}.mandate{box-shadow:8px 8px 0 #030403}.permissions{grid-template-columns:1fr}.permissions div{border-right:0}.permissions div:nth-last-child(-n+2){border-bottom:1px solid var(--line)}.permissions div:last-child{border-bottom:0}.ticker{grid-template-columns:1fr}.ticker div{min-height:52px;border-right:0;border-bottom:1px solid var(--line)!important}.ticker div:last-child{border-bottom:0!important}.setup,.proof,.demo{padding-block:82px}.setup-heading h2,.proof h2,.demo h2{font-size:44px}.config-controls,.command-panel{padding:20px}.limit-control{grid-template-columns:1fr 100px}.steps{grid-template-columns:1fr}.steps li,.steps li+li{min-height:auto;padding:24px 0;border-right:0;border-bottom:1px solid var(--line)}.steps li:last-child{border-bottom:0}.steps h3{margin-top:30px}.steps p{min-height:auto}.control-table>div{grid-template-columns:1fr;gap:7px;padding:16px 0}.control-table .table-head{display:none}.closing{padding:34px;margin-bottom:75px}.closing h2{font-size:43px}footer{align-items:flex-start;flex-direction:column;gap:16px;padding-block:25px}footer nav{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;

export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#080a08"/><path d="M37 8c9 3 15 9 18 18L36 45 19 28C22 18 28 11 37 8Z" fill="#f3f5f0"/><circle cx="39" cy="23" r="4" fill="#080a08"/><path d="m22 34-9 3 14 14 3-9" fill="#c7ff4f"/></svg>`;

export const ROBOTS_TXT = `User-agent: *\nAllow: /\nSitemap: ${HOSTED_ORIGIN}/sitemap.xml\n`;

export const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${HOSTED_ORIGIN}/</loc></url></urlset>\n`;
