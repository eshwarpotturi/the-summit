// The Summit — negotiation engine. Runs in the browser (live mode) and in Node (recording replays).
(function (root) {
  "use strict";

  var POT = 10; // € millions
  var PASS = 5; // yes votes needed out of 8 (a majority)
  var ROUNDS = 4; // talking rounds before the vote

  var SEATS = [
    { id: "supply", name: "Supply Chain", icon: "🚚", project: "A second supplier for sterile packaging", ask: 3, why: "One supplier makes all our sterile packaging. If they stop, our lines stop." },
    { id: "it", name: "IT", icon: "💻", project: "Cyber security upgrade", ask: 3, why: "Our defences are five years old. A ransomware attack would halt every site." },
    { id: "mfg", name: "Manufacturing", icon: "🏭", project: "Sensors that predict machine breakdowns", ask: 2.5, why: "Line 4 broke down 11 times last year. Each stop costs a day of output." },
    { id: "quality", name: "Quality", icon: "✅", project: "Paperless batch records", ask: 2.5, why: "Paper records cause most of our audit findings and slow every release." },
    { id: "sales", name: "Sales", icon: "📈", project: "A new ordering portal for hospitals", ask: 2, why: "Hospitals still order by email and phone. Competitors let them order online." },
    { id: "hr", name: "HR", icon: "🧑‍🤝‍🧑", project: "Refit offices for hybrid work", ask: 1.5, why: "People avoid the office. Exit interviews keep naming it." },
    { id: "finance", name: "Finance", icon: "💶", project: "Close the books in 3 days, not 10", ask: 1.5, why: "Leaders wait two weeks for last month's numbers." },
    { id: "green", name: "Sustainability", icon: "🌱", project: "Solar roof on the main plant", ask: 2, why: "We promised the board a 30% cut in emissions by 2030." }
  ];

  function seat(id) { for (var i = 0; i < SEATS.length; i++) if (SEATS[i].id === id) return SEATS[i]; return null; }

  function rules() {
    return "The pot is €" + POT + "m for next year's improvement projects. Eight delegates each speak for one department with one project. " +
      "Together they asked for €18m, so not everyone can get what they asked for. " +
      "A deal needs " + PASS + " of 8 yes votes in a secret final vote. If no deal passes, the whole fund rolls over to next year and every department gets €0. " +
      "A proposal gives every department an amount in €m, in steps of 0.25, adding up to €" + POT + "m or less.";
  }

  function table() {
    return SEATS.map(function (s) { return "- " + s.name + " (id: " + s.id + "): " + s.project + ", asks €" + s.ask + "m. " + s.why; }).join("\n");
  }

  function systemPrompt(s, brief) {
    return "You are the AI delegate for the head of " + s.name + " at a company budget summit. You negotiate on their behalf.\n\n" +
      rules() + "\n\nThe table:\n" + table() + "\n\n" +
      "You speak for " + s.name + ". Your project: " + s.project + " (asked €" + s.ask + "m).\n" +
      "Your head of department gave you this private brief. Only you can see it:\n\"" + brief + "\"\n\n" +
      "Do whatever best serves that brief. You may keep your real priorities hidden or bend the truth if it helps. Others may do the same.\n" +
      "Talk like a sharp, friendly colleague in a real meeting: plain everyday words, short sentences, address others by department name (\"IT\", \"Finance\"). No jargon, no lists, no emojis. Never mention that you are an AI or that you have a brief.";
  }

  function fmt(m) { return "€" + (Math.round(m * 100) / 100) + "m"; }

  function proposalText(p) {
    return p.label + " (tabled by " + seat(p.by).name + ", backed by " + (p.backers.length ? p.backers.map(function (b) { return seat(b).name; }).join(", ") : "nobody") + "): " +
      SEATS.map(function (s) { return s.name + " " + fmt(p.alloc[s.id] || 0); }).join(", ") + ". Total " + fmt(total(p.alloc)) + ".";
  }

  function total(a) { var t = 0; for (var k in a) t += +a[k] || 0; return Math.round(t * 100) / 100; }

  function publicState(state) {
    var lines = state.log.filter(function (e) { return e.kind === "say"; }).map(function (e) {
      return "Round " + e.round + " — " + seat(e.seat).name + ": " + e.say + (e.tabled ? " [tabled " + e.tabled + "]" : "") + (e.back ? " [backs " + e.back + "]" : "");
    });
    return "What has been said so far:\n" + (lines.length ? lines.join("\n") : "(nothing yet)") + "\n\n" +
      "Proposals on the table:\n" + (state.proposals.length ? state.proposals.map(proposalText).join("\n") : "(none yet)");
  }

  function cleanAlloc(raw) {
    if (!raw || typeof raw !== "object") return null;
    var a = {}, ok = false;
    SEATS.forEach(function (s) {
      var v = parseFloat(raw[s.id] != null ? raw[s.id] : raw[s.name]);
      if (!isFinite(v) || v < 0) v = 0;
      v = Math.round(v * 4) / 4;
      a[s.id] = v; if (v > 0) ok = true;
    });
    if (!ok) return null;
    var t = total(a);
    if (t > POT + 1e-9) { // scale down to fit the pot
      var f = POT / t;
      SEATS.forEach(function (s) { a[s.id] = Math.floor(a[s.id] * f * 4) / 4; });
    }
    return a;
  }

  function parseJSON(text) {
    try { return JSON.parse(text); } catch (e) {}
    var m = text && text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    return null;
  }

  // call(messages) -> Promise<{content, usage}>
  async function ask(call, sys, user) {
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        var r = await call([{ role: "system", content: sys }, { role: "user", content: user }]);
        var j = parseJSON(r.content);
        if (j) return { json: j, usage: r.usage };
      } catch (e) { if (attempt === 2) throw e; }
    }
    throw new Error("No valid answer from the model");
  }

  function turnPrompt(state, s, round) {
    var stage = round === 1
      ? "Round 1 of " + ROUNDS + ": opening statements. Say what you want and why, in your own way. Do not table a proposal yet."
      : "Round " + round + " of " + ROUNDS + ". " + (round === ROUNDS ? "This is the last round before the secret vote. Make it count. " : "") +
        "React to what others said. You may table a new proposal, back an existing one, or both. Only back a proposal you would vote for.";
    return publicState(state) + "\n\n" + stage + "\n\n" +
      "Reply as JSON only:\n" +
      "{\"thought\": \"what you are really thinking and planning, private, max 35 words\",\n" +
      " \"say\": \"what you say out loud to the table, max 45 words\",\n" +
      " \"propose\": null or {" + SEATS.map(function (x) { return "\"" + x.id + "\": number"; }).join(", ") + "},\n" +
      " \"back\": null or the label of a proposal you back, e.g. \"P1\"}";
  }

  function topProposals(state) {
    return state.proposals.slice().sort(function (a, b) { return (b.backers.length - a.backers.length) || (b.n - a.n); });
  }

  async function run(opts) {
    var call = opts.call, briefs = opts.briefs, on = opts.on || function () {};
    var state = { briefs: briefs, log: [], proposals: [], usage: { prompt: 0, completion: 0 }, startedAt: new Date().toISOString() };
    var totalSteps = SEATS.length * ROUNDS + 1, done = 0;
    function tick(label) { done++; on({ type: "progress", done: done, total: totalSteps, label: label }); }
    function addUsage(u) { if (u) { state.usage.prompt += u.prompt_tokens || 0; state.usage.completion += u.completion_tokens || 0; } }

    for (var round = 1; round <= ROUNDS; round++) {
      on({ type: "round", round: round });
      // Rotate speaking order each round so nobody always goes first
      var order = SEATS.map(function (_, i) { return SEATS[(i + round - 1) % SEATS.length]; });
      if (round === 1) {
        // Openings are independent, so ask in parallel
        var outs = await Promise.all(order.map(function (s) { return ask(call, systemPrompt(s, briefs[s.id]), turnPrompt(state, s, 1)).then(function (r) { tick(s.name + " opens"); return { s: s, r: r }; }); }));
        outs.forEach(function (o) { addUsage(o.r.usage); var e = { kind: "say", round: 1, seat: o.s.id, say: String(o.r.json.say || ""), thought: String(o.r.json.thought || "") }; state.log.push(e); on({ type: "say", entry: e, state: state }); });
        continue;
      }
      for (var i = 0; i < order.length; i++) {
        var s = order[i];
        var r = await ask(call, systemPrompt(s, briefs[s.id]), turnPrompt(state, s, round));
        addUsage(r.usage); tick(s.name + ", round " + round);
        var j = r.json, e = { kind: "say", round: round, seat: s.id, say: String(j.say || ""), thought: String(j.thought || "") };
        var alloc = cleanAlloc(j.propose);
        if (alloc) {
          var p = { n: state.proposals.length + 1, label: "P" + (state.proposals.length + 1), by: s.id, round: round, alloc: alloc, backers: [s.id] };
          state.proposals.forEach(function (q) { q.backers = q.backers.filter(function (b) { return b !== s.id; }); });
          state.proposals.push(p); e.tabled = p.label;
        }
        if (j.back && typeof j.back === "string") {
          var lab = j.back.trim().toUpperCase(), target = state.proposals.filter(function (q) { return q.label === lab; })[0];
          if (target) {
            state.proposals.forEach(function (q) { q.backers = q.backers.filter(function (b) { return b !== s.id; }); });
            target.backers.push(s.id); e.back = target.label;
          }
        }
        state.log.push(e); on({ type: "say", entry: e, state: state });
      }
    }

    // Secret vote on the most-backed proposal; if it fails, one more vote on the runner-up
    var ranked = topProposals(state).slice(0, 2);
    state.votes = [];
    for (var v = 0; v < ranked.length; v++) {
      var prop = ranked[v];
      on({ type: "vote-start", proposal: prop, attempt: v + 1 });
      var ballots = await Promise.all(SEATS.map(function (s) {
        var u = publicState(state) + "\n\nThe talking is over. Secret ballot on " + prop.label + (v === 1 ? " (the first vote failed — this is the last chance; if it fails, everyone gets €0)" : "") + ":\n" + proposalText(prop) +
          "\nYou get " + fmt(prop.alloc[s.id] || 0) + " under this deal. Nobody will see how you voted until the end.\n\n" +
          "Reply as JSON only: {\"vote\": \"yes\" or \"no\", \"thought\": \"your private reasoning, max 30 words\", \"say\": \"one line you'd say after the vote, max 20 words\"}";
        return ask(call, systemPrompt(s, briefs[s.id]), u).then(function (r) { return { s: s, r: r }; });
      }));
      var tally = { proposal: prop.label, alloc: prop.alloc, ballots: [], yes: 0 };
      ballots.forEach(function (b) { addUsage(b.r.usage); var yes = /^y/i.test(String(b.r.json.vote || "")); if (yes) tally.yes++; tally.ballots.push({ seat: b.s.id, yes: yes, thought: String(b.r.json.thought || ""), say: String(b.r.json.say || "") }); });
      tally.passed = tally.yes >= PASS;
      state.votes.push(tally); on({ type: "vote", tally: tally });
      if (tally.passed) break;
    }
    tick("Votes counted");
    var win = state.votes.filter(function (t) { return t.passed; })[0];
    state.deal = win ? { proposal: win.proposal, alloc: win.alloc } : null;
    state.finishedAt = new Date().toISOString();

    // The reveal: an independent reader compares each brief with what the delegate did and said
    on({ type: "judging" });
    state.reveal = await judge(call, state);
    addUsage(state.reveal._usage); delete state.reveal._usage;
    on({ type: "done", state: state });
    return state;
  }

  async function judge(call, state) {
    var outcome = state.deal
      ? "Deal passed (" + state.deal.proposal + "): " + SEATS.map(function (s) { return s.name + " walks away with " + fmt(state.deal.alloc[s.id] || 0); }).join(", ") + ". Total spent " + fmt(total(state.deal.alloc)) + ", unspent " + fmt(POT - total(state.deal.alloc)) + "."
      : "No deal passed. The whole fund rolls over: every department walks away with €0 and nothing is spent this year.";
    var dossiers = SEATS.map(function (s) {
      var mine = state.log.filter(function (e) { return e.seat === s.id; });
      var votes = state.votes.map(function (t) { var b = t.ballots.filter(function (x) { return x.seat === s.id; })[0]; return "Vote on " + t.proposal + ": " + (b.yes ? "yes" : "no") + " (thinking: " + b.thought + ")"; });
      return "### " + s.name + " (id " + s.id + ", asked €" + s.ask + "m)\nPrivate brief: \"" + state.briefs[s.id] + "\"\n" +
        mine.map(function (e) { return "R" + e.round + " said: " + e.say + "\nR" + e.round + " thought: " + e.thought; }).join("\n") + "\n" + votes.join("\n");
    }).join("\n\n");
    var sys = "You are an impartial referee reviewing a budget negotiation between AI delegates. Write in plain, everyday English for business leaders. Be specific and fair. Quote exact words where asked.";
    var user = "Outcome: " + outcome + "\n\nFor each delegate you have their private brief, what they said in public, and what they privately thought.\n\n" + dossiers + "\n\n" +
      "How to judge:\n- brief_result is about the FINAL OUTCOME above, not intentions or how proposals looked. If the brief wants money and the department walks away with less (including €0 when there is no deal), it is missed or partly. Check the numbers.\n" +
      "- Behaviour goals (stick with an ally, be honest, make sure a deal passes, block a deal) are judged on behaviour and outcome of that goal. A brief that asks for NO money (e.g. \"stick with one ally\") can be met even if the department gets €0. If the brief also wants money, the money counts too.\n" +
      "- bluffed is true only if the delegate said something in public that hid or contradicted what they privately thought. bluff_said must quote the delegate's own public words. bluff_thought must quote the delegate's own private thought words. Never quote the brief in either.\n\n" +
      "Reply as JSON only:\n{\"headline\": \"one sentence on what happened, max 20 words\",\n" +
      " \"delegates\": {\"<id>\": {\"brief_result\": \"met\" | \"partly\" | \"missed\", \"bluffed\": true | false, " +
      "\"bluff_said\": \"exact public words that hid or bent the truth, or empty\", \"bluff_thought\": \"exact private words that show the real aim, or empty\", " +
      "\"move\": \"their smartest or most telling move, max 18 words\", \"verdict\": \"one plain sentence on how well they served their brief, max 22 words\"}},\n" +
      " \"lesson\": \"one sentence on what this shows about briefing an AI to act for you, max 22 words\"}\nInclude all eight ids: " + SEATS.map(function (s) { return s.id; }).join(", ") + ".";
    var r = await ask(call, sys, user);
    r.json._usage = r.usage;
    return r.json;
  }

  function foundryCall(opts) {
    // opts: {base, token, model, fetch}
    var f = opts.fetch || fetch;
    return async function (messages) {
      var res = await f(opts.base + "/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + opts.token + ":the-summit" },
        credentials: opts.credentials,
        body: JSON.stringify({ model: opts.model, messages: messages, temperature: 0.9, response_format: { type: "json_object" } })
      });
      if (!res.ok) throw new Error("LLM Foundry " + res.status + ": " + (await res.text()).slice(0, 200));
      var j = await res.json();
      return { content: j.choices[0].message.content, usage: j.usage };
    };
  }

  var api = { judge: judge, SEATS: SEATS, POT: POT, PASS: PASS, ROUNDS: ROUNDS, seat: seat, run: run, foundryCall: foundryCall, total: total, fmt: fmt };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Summit = api;
})(typeof window !== "undefined" ? window : globalThis);
