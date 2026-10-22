# The Summit

**Live demo:** https://eshwarpotturi.github.io/the-summit/

Eight AI delegates negotiate how to share a €10m budget. Each one was briefed in a single line by the department head it speaks for. Then we open the briefs and compare them with what each delegate said, thought and got.

> **The point:** your AI will follow your one line to the letter. Write it well.

## What it is

It's set up like a diplomatic summit:

| Step | What happens |
|---|---|
| 1. Sealed briefs | Each department head writes one line to their AI delegate. Nobody else sees it. |
| 2. The talks | Four rounds. Delegates speak **on the record**, table proposals and form alliances. Each also writes private notes **off the record**, which the presenter can reveal. |
| 3. Secret vote | A deal needs 5 of 8 votes. If the top proposal fails, there's one last vote on the runner-up. If that fails too, the fund rolls over and everyone gets €0. |
| 4. Declassified | We open the briefs. An independent referee marks each brief as met, partly met or missed, and flags any delegate that bluffed, quoting what it said next to what it thought. |

## Why

AI agents will soon negotiate, buy and schedule on our behalf. The only thing they know about what we want is what we tell them. This demo makes that visible in a few minutes. The same table with different one-line briefs gives a completely different result.

## The two replays

Both are recorded runs, unedited. Model: gpt-4.1 via Straive LLM Foundry.

| Replay | What happens |
|---|---|
| **Gridlock** | Every delegate sticks to its brief: Sales wants to beat everyone, Manufacturing won't let Quality get more, Finance wants €1m kept back. No deal passes and everyone gets €0. |
| **The deal** | Finance's brief is "make sure a deal passes". It holds a coalition together and the deal passes 5 to 3. IT walks away with the most money, yet voted against the deal. |

## How to present it

1. Open the link on the big screen. The page is sized for a monitor, with large text.
2. **Step 1:** read out two or three briefs. Click an envelope to open one.
3. **Step 2:** press Play. Press `T` or **Show off the record** at a juicy moment so the room sees what a delegate said next to what it thought.
4. **Step 3:** press **Count the votes**. The ballots turn over one by one.
5. **Step 4:** the reveal. Click any card for the full transcript.
6. Land the one message: *your AI will follow your one line to the letter.*

Keys in step 2: `Space` play or pause, `←` `→` step, `T` show or hide private thoughts.

## Run your own, live

Open **Run your own**, type 8 one-line briefs shouted out by the room and press **Start the summit**.

- Sign in to [LLM Foundry](https://llmfoundry.straivedemo.com/) in the same browser first. The page then uses your session, so no key is needed.
- It takes about 1 to 2 minutes. A run costs about ₹25 with gpt-4.1, or about ₹6 with gpt-4.1-mini.
- The last live run is saved in your browser. Press **Replay last live run** to show it again.

## Questions you may have

**Is the outcome scripted?** No. Nobody writes the talks. Each delegate decides what to say, propose, back and vote for, turn by turn. Running the same briefs twice can give different results.

**Can delegates see each other's briefs or thoughts?** No. Each sees only what was said on the record and the proposals on the table.

**Where do the "off the record" thoughts come from?** At every turn, each delegate returns two things: what it says to the table and a private note on what it is really thinking. Only the first is shared with the other delegates.

**Who decides whether a brief was met?** A separate referee model reads each brief, everything the delegate said and thought, and the final outcome. It is told to judge by what each department actually walks away with.

**Is any real company data used?** No. Departments, projects and amounts are invented.

**What did it cost to build?** About ₹115 of model calls for the recorded runs and tests.

## How it works

| File | Purpose |
|---|---|
| `index.html` | The page: replay, live mode, reveal |
| `engine.js` | The negotiation: seats, rounds, proposals, vote and referee. The same code runs in the browser and in Node. |
| `replays.js` | The recorded runs the page plays |
| `record.js` | Records a new replay: `FOUNDRY_TOKEN=… node record.js a replays/a.json` |
| `rejudge.js` | Re-runs only the referee on a saved replay |
| `replays/` | Raw JSON of each recorded run |
