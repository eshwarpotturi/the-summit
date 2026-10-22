// Re-runs only the referee on a saved replay. Usage: FOUNDRY_TOKEN=... node rejudge.js replays/a.json
const fs = require("fs");
const S = require("./engine.js");
const LEDGER = __dirname + "/../summit-spend.json";
const file = process.argv[2];
const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);
const ledger = JSON.parse(fs.readFileSync(LEDGER));
if (ledger.usd > 9) throw new Error("Spend cap reached");
const raw = S.foundryCall({ base: "https://llmfoundry.straivedemo.com", token: process.env.FOUNDRY_TOKEN, model: "gpt-4.1" });
let spent = 0;
const call = async (m) => { const r = await raw(m); spent += (r.usage.prompt_tokens * 2 + r.usage.completion_tokens * 8) / 1e6; return r; };
(async () => {
  console.log(`${ts()} 0/1 re-judging ${file}`);
  const s = JSON.parse(fs.readFileSync(file));
  s.reveal = await S.judge(call, s); delete s.reveal._usage;
  s.costUSD = +(s.costUSD + spent).toFixed(4);
  fs.writeFileSync(file, JSON.stringify(s, null, 1));
  ledger.usd += spent; ledger.runs.push({ rejudge: file, usd: +spent.toFixed(4) }); fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
  console.log(`${ts()} 1/1 done $${spent.toFixed(3)}; total $${ledger.usd.toFixed(3)}`);
  for (const [k, v] of Object.entries(s.reveal.delegates)) console.log(k, v.brief_result, v.bluffed ? "BLUFF" : "", "|", v.bluff_said, "|", v.bluff_thought, "|", v.verdict);
  console.log(s.reveal.headline, "/", s.reveal.lesson);
})();
