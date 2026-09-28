# Half — Zerion interview demo build kit

**Goal:** record a polished 3–5 minute demonstration by tomorrow, September 29, 2026: “Hey, swap half my USDC for ETH.”

This bundle contains execution instructions, design decisions, API research, acceptance criteria and a read-only probe. It is **not an implemented app**. Put these files in the root of the repository you create and let Codex build there.

The final scope is one conversational flow: **USDC → native ETH, Base, same wallet, explicit review and wallet signing.** OpenAI interprets the sentence; regular code handles balances, amounts and transaction decisions. No general agent, cross-chain routing, token search, wallet creation or backend custody.

<a href="https://zerion.io/"><img src="public/brand/zerion-lockup.svg" alt="Zerion" width="112" /></a>

Independent prototype · Planned quote integration via Zerion.

## Start in five steps

1. Create your repository. Extract the **contents** of `zerion-demo-kit/` into its root so `AGENTS.md` sits beside the future `package.json`. Preserve any existing files; don't overwrite a working project blindly.
2. Open that repo in your local Codex app, IDE extension or CLI. Sign in with your **ChatGPT account** for development. Do not use your app's OpenAI API key to authenticate Codex if you want development to stay within the subscription.
3. Copy `.env.example` to `.env.local` and fill in `OPENAI_API_KEY`, `ZERION_API_KEY` and your **public** `DEMO_WALLET_ADDRESS`. Keys stay on your machine; never paste a seed phrase/private key into anything. Keep `APP_MODE=simulation` initially.
4. Give Codex the launch prompt below. It should start building immediately and keep `STATUS.md` current.
5. After the live quote probe works, the agent can identify the compatible atomic route and help set `ZERION_ATOMIC_SOURCE_ID`. Set `APP_MODE=live`, restart, and complete the manual wallet smoke test. Record locally at `http://127.0.0.1:3000`; no deployment or domain is needed.

If credentials aren't ready, start Codex anyway. It can finish the UI, mocked integrations, math and tests before keys arrive. Simulation is a development/rehearsal fallback, not a substitute for a claimed live swap.

## Paste this into Codex

```text
Read AGENTS.md, STATUS.md and START_HERE.md in this repository. Execute the build
now; don't stop at a plan. Use the referenced docs only as their phase requires.
The latest decision is to use one OpenAI API call for intent extraction; I can
pay for that small runtime API cost. Keep Codex development within my existing
subscription, with one agent and no paid fallback or extra credits.

Build the complete local Half demo, attempt the live integration when my env
keys are present, verify the acceptance checks, and leave the app ready for me
to review and sign a small test transaction. Never sign or send a transaction
for me. Missing keys should not block the rest of the implementation. Update
STATUS.md at each milestone and finish with the run command and exact next step.
```

## What you need to obtain

| Item | Action |
|---|---|
| OpenAI API access | Create a project key in the [OpenAI platform](https://platform.openai.com/), with billing available. API billing is separate from ChatGPT. |
| Zerion key | Use [Zerion dashboard](https://dashboard.zerion.io/). Verify current Developer plan access and any card requirement. |
| Local tooling | Node 22+ compatible environment, npm, Codex and a desktop browser. Agent verifies dependency requirements. |
| Wallet | An installed EVM wallet extension and a small dedicated ordinary EOA account. Prefer the Zerion extension if you already use it; no need to switch a working wallet. |
| Live test funds | Circle USDC **on Base**, plus ETH **on Base** for gas. Funds on Ethereum or Base Sepolia won't work for this demo. |

The probe uses only Node built-ins and can run before app dependencies exist:

```bash
node --env-file=.env.local scripts/probe-zerion.mjs
```

It makes asset lookup and quote requests, prints a sanitized route summary and never signs or broadcasts. An unfunded wallet can yield an informational quote; that does not prove execution readiness. No user key was available when this kit was prepared.

## Cost and time expectations

| Item | Planning assumption |
|---|---|
| Codex development | Existing $20 subscription; usage-limited, not guaranteed to finish before limits. |
| App AI calls | Roughly $0.64 per 1,000 illustrative parses at the documented model rate; usually much less for this demo. A small API balance is sufficient. |
| Zerion | Advertised free Developer tier; actual account/endpoint access must be probed. |
| Hosting | $0 additional: record localhost. |
| Live funds | A small balance such as 5–10 USDC plus ETH gas funding; this is capital being swapped, not all a fee. Actual gas, provider and funding/withdrawal fees vary. |

Do not buy assets or transfer funds until live API access and route compatibility are established. If acquiring Base funds is expensive or slow, don't miss the deadline for it: show live quotes and clearly disclose any simulated execution.

**Planning estimate:** about 7–10 focused implementation hours plus owner setup and recording, with dependencies already available. It is not a guarantee. End today with the vertical slice; use tomorrow for the live check, fixes and video. Their email asks for work you built, not a production launch. If the new integration is still blocked, an existing project demo remains an option.

## Keep Codex usage under control

- One repo, one agent, one active task. No parallel agents or repeated audits of unchanged code.
- Use standard speed and an appropriate coding model already included in your account. Avoid escalating every task to maximum reasoning; no particular model is required by this kit.
- Keep AGENTS small. Agent reads phase-specific files rather than pasting the full kit or this conversation into every prompt.
- Save progress in STATUS; resume with: `Read AGENTS.md and STATUS.md, then implement only the next incomplete milestone.`
- Check remaining usage in Codex's dashboard or `/status` where supported. Limits depend on account, model, task size and current usage; no prompt can guarantee two days of uninterrupted included work.
- Use fake providers for tests. Run the paid model smoke once. No repeated AI “review everything” loop.
- If interrupted by a limit, preserve the repo and wait for reset; do not silently enable API billing for Codex. App API permission is separate.

## File map

| File | Read/use when |
|---|---|
| `AGENTS.md` | Small persistent project instructions |
| `START_HERE.md` | Complete execution brief and milestones |
| `STATUS.md` | Resume/checkpoint state |
| `docs/01-product-and-design.md` | Exact scope, UI, copy and states |
| `docs/02-implementation.md` | Architecture, amount math and transaction lifecycle |
| `docs/03-zerion-contract.md` | Verified provider wire contract |
| `docs/04-acceptance.md` | Focused tests and owner live smoke |
| `docs/05-research-and-audit.md` | Evidence, corrections, risks and unverified assumptions |
| `docs/06-video.md` | Recording plan and speaking outline |
| `docs/07-intent-contract.md` | Exact model, structured schema and system prompt |
| `fixtures/intent-cases.json` | Intent acceptance examples |
| `scripts/probe-zerion.mjs` | Read-only early integration check |
| `.env.example`, `.gitignore` | Safe local setup |

Research date: September 28, 2026. Official source links and verification limits are in the research audit.
