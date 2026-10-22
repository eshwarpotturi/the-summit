// Records a summit for replay. Usage: FOUNDRY_TOKEN=... node record.js <briefset> <outfile>
const fs = require("fs");
const S = require("./engine.js");

const PRICE = { "gpt-4.1": [2, 8], "gpt-4.1-mini": [0.4, 1.6] }; // USD per million tokens (in, out)
const MODEL = process.env.MODEL || "gpt-4.1";
const CAP_USD = parseFloat(process.env.CAP_USD || "9");
const LEDGER = __dirname + "/../summit-spend.json"; // kept outside the repo

const BRIEFS = {
  a: {
    supply: "Get the full €3m. A supply stop would cost us more than everything else on this list.",
    it: "Cyber security is non-negotiable. Get at least €2m and team up with whoever backs security.",
    mfg: "Get something, even €1m. But make sure Quality doesn't end up with more than us.",
    quality: "Paperless records must be funded or we fail the next audit. Bluff if you need to.",
    sales: "Get more money than anyone else at the table. Winning matters.",
    hr: "I'd honestly settle for €0.5m. Don't let them know that.",
    finance: "Leave at least €1m of the pot unspent. Make everyone feel heard while you do it.",
    green: "Find one ally early and stick with them no matter what."
  },
  b: {
    supply: "Be completely honest about what we need and why. No games.",
    it: "Get €3m. Scare them about ransomware if you have to.",
    mfg: "Form a factory-floor alliance with Quality and Supply Chain.",
    quality: "We need €2.5m. Don't accept less than €1.5m.",
    sales: "Charm everyone. Make sure we get at least €1m.",
    hr: "Get the full €1.5m. People are leaving; this matters more than they think.",
    finance: "Make sure a deal passes. A rolled-over fund looks terrible to the board.",
    green: "Block any deal that gives us nothing. The board promise is public."
  }
};

const set = process.argv[2] || "a", out = process.argv[3] || `replays/${set}.json`;
const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER)) : { usd: 0, runs: [] };
const [pin, pout] = PRICE[MODEL];
let spent = 0;

const raw = S.foundryCall({ base: "https://llmfoundry.straivedemo.com", token: process.env.FOUNDRY_TOKEN, model: MODEL });
const call = async (m) => {
  if (ledger.usd + spent > CAP_USD) throw new Error(`Spend cap reached: $${(ledger.usd + spent).toFixed(2)}`);
  const r = await raw(m);
  spent += (r.usage.prompt_tokens * pin + r.usage.completion_tokens * pout) / 1e6;
  return r;
};

(async () => {
  console.log(`${ts()} start set=${set} model=${MODEL} spent so far $${ledger.usd.toFixed(2)} cap $${CAP_USD}`);
  const state = await S.run({
    call, briefs: BRIEFS[set],
    on: (e) => {
      if (e.type === "progress") console.log(`${ts()} ${e.done}/${e.total} ${e.label} ($${spent.toFixed(3)})`);
      if (e.type === "vote") console.log(`${ts()} vote on ${e.tally.proposal}: ${e.tally.yes} yes — ${e.tally.passed ? "PASSED" : "failed"}`);
    }
  });
  state.model = MODEL; state.costUSD = +spent.toFixed(4); state.set = set;
  fs.mkdirSync(require("path").dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(state, null, 1));
  ledger.usd += spent; ledger.runs.push({ set, out, usd: +spent.toFixed(4), at: new Date().toISOString() });
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  console.log(`${ts()} done: ${state.deal ? "deal " + state.deal.proposal : "NO DEAL"}; run cost $${spent.toFixed(3)}; total $${ledger.usd.toFixed(3)}`);
})().catch((e) => { ledger.usd += spent; fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1)); console.error(ts(), "ERROR", e.message, `spent $${spent.toFixed(3)}`); process.exit(1); });
