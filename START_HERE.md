# Execution prompt — start building now

You are the implementation agent for this existing repository. Execute the plan; do not return only a proposal. Build a polished working demo of:

> “Hey, swap half my USDC for ETH.”

Call the product **Half**. It is an independent interview prototype, not an official Zerion product. Ship one excellent transaction flow, not a general crypto chatbot. The delivery target is September 29, 2026, Santiago time; if starting later, use two working days rather than pretending the original date is still ahead.

## First pass

1. Read `AGENTS.md` and `STATUS.md`. Inspect existing repo/package files; preserve user work. These docs already exist, so do not run a scaffold that refuses or overwrites a nonempty directory. Scaffold in a temporary sibling and copy the required app files, or create the few files directly.
2. Read the product, implementation, and intent-contract docs. Make a short working plan and begin immediately.
3. Check Node/npm and the selected dependency compatibility. Use Node 22+ LTS-compatible code. Install stable supported dependencies once, record exact versions in the lockfile, and follow their matching docs. In particular, do not copy wagmi v2 hooks into a v3 install without checking.
4. Check only whether `OPENAI_API_KEY`, `ZERION_API_KEY` and `DEMO_WALLET_ADDRESS` are set, without displaying values. If present, run the provided read-only probe. Otherwise report the missing setup once and continue building simulation. Do not fabricate API access. The app uses one OpenAI call per submitted sentence; no Anthropic integration or multi-provider fallback is needed.

## Required result

- User opens the app, sees “Swap in a sentence” and “USDC → ETH · Base”.
- They connect their installed wallet and submit the sentence.
- The app interprets half against a fresh Base USDC balance, shows the exact amount and a real provider quote, then explicit wallet steps.
- If necessary: user approves an exact USDC allowance, waits for its receipt, reviews a refreshed quote, and signs the swap.
- Pending and confirmed states reflect real receipts; rejected or uncertain outcomes remain recoverable and never auto-resubmit.
- With no key or wallet, a visibly labeled simulation demonstrates the same UI without ever calling wallet signing methods.
- The owner can run locally, test the key scenarios, and record a 3–5 minute video. Hosting is not necessary.

The live path must be attempted when credentials are available. A pretty mock alone is not completion of the requested live integration. If access, liquidity, funding, or route compatibility blocks it, complete everything else and state precisely what remains unverified.

## Deliver in this order

**A — Foundation (~1 hour):** app boots, shell matches design, AI extraction adapter and BigInt amount validation pass mocked fixtures, simulation mode runs.

**B — Read-only live slice (~2 hours):** wallet connection, Base switching, authoritative balances, Zerion metadata/quote adapter. Validate actual response shapes and pin one supported atomic route source after examining a real response.

**C — Transaction flow (~2–3 hours):** limited allowance, updated quote, preflight checks, owner-triggered signing, receipt handling, invalidation and recovery. No agent sends a live transaction.

**D — Finish (~2 hours):** focused tests, one desktop and one mobile-width visual inspection, repair blockers, update README and STATUS. Prepare the owner’s live smoke-test steps and demo script.

These timeboxes are planning estimates, not completion guarantees. Reserve tomorrow for wallet verification and recording. At the first working live flow, freeze features. If live integration remains blocked after its timebox, keep an honest quote-only/simulation demo and give the owner the fastest concrete unblock.

## Stop condition

`npm run build`, typecheck, targeted tests, and the available UI smoke checks pass; every required acceptance item is marked PASS, FAIL, or NOT RUN. Start/leave the local preview if supported. Report the run command, live capability, blocker(s), and the next owner action in under 200 words. Do not write another long proposal.
