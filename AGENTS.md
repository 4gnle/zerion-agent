# Build contract

Build **Wallet Agent**, the narrow conversational swap demo in this repository. Target: a recordable interview demo in two working days, using the existing Codex subscription and a small separately authorized OpenAI API budget. These are project requirements, not permission to bypass the agent's platform rules.

## Read efficiently

1. Read `STATUS.md`, then `START_HERE.md`.
2. Read `docs/01-product-and-design.md` for UI work; `docs/02-implementation.md` for application work.
3. Read `docs/03-zerion-contract.md` for the live adapter and `docs/07-intent-contract.md` for AI extraction; `docs/04-acceptance.md` for verification.
4. `docs/05-research-and-audit.md` and `docs/06-video.md` are reference/handoff material. Do not load every document on every turn.

## Non-negotiable scope

- One page; ETH → native USDC swap on Arbitrum, or native ETH bridge from Ethereum to Arbitrum; same wallet receives output. Header network selector and balances support Ethereum/Arbitrum; history covers all wallet networks.
- English commands: half, whole integer percentages, or exact decimal ETH amounts (18 decimals, 0.002 ETH cap, gas reserve required). One OpenAI structured extraction call; deterministic validation; no open-ended conversation.
- Next.js App Router + TypeScript + CSS + wagmi + viem + TanStack Query + Zod + OpenAI SDK. Use npm and one lockfile. Use stable compatible packages; verify installed major-version APIs once.
- Injected desktop EOA wallet only. No WalletConnect, mobile connection, smart accounts, permits, reverse/other bridges, backend signing, or deployed contracts.
- Real mode and clearly marked simulation. Never silently replace live failures with fake success.
- Stop before signing or broadcasting money-moving transactions. The owner reviews and signs in their own wallet. Never request private keys or seed phrases.

## Work style and budget

Use one agent and one working thread. Do not launch subagents, repeated whole-repo reviews, image generation, research sweeps, or background tasks. Do not buy credits, upgrade services, enable paid fallback, or change subscription plans. The owner may supply OPENAI_API_KEY for the app; never use it to bill Codex development. If allowance is exhausted, leave a checkpoint; the owner can resume after reset.

Prefer targeted reads and `rg`; batch independent reads. Build a working vertical slice before polish. Use existing decisions; do not ask for font, framework, state-library, or color preferences. Ask only for missing credentials, owner signing, or an actual scope conflict. Keep progress messages short; do not print entire files, lockfiles, API payloads, or secrets.

Complete reversible local work without repeated approval. Missing credentials block live verification, not simulation, UI, parser, tests, or handoff. Limit a stalled external integration to 45 minutes before documenting the exact blocker. Do not switch providers or expand scope to overcome it.

Update `STATUS.md` at milestones and before stopping: done, next, commands, blockers, tests and known gaps. Keep it under 60 lines. Use honest verification statuses. No test means no claim of passing. Do not publish, submit the application, or send messages unless the owner separately requests it.
