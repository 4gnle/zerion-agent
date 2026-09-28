# Product and visual specification

## The promise

Convert one short sentence into a reviewable USDC-to-ETH swap. Users still connect and approve in their wallet. “One sentence” means less form filling, not permissionless execution. Primary demo: `Hey, swap half my USDC for ETH`.

The audience is someone who already has a desktop wallet and USDC on Base. No onboarding into crypto, wallet creation, deposits, portfolio explorer, trading advice, or token discovery.

## Fixed scope

| Decision | Requirement |
|---|---|
| Network | Base mainnet only; visible before entry and review |
| Sell | Circle-issued Base USDC; never USDbC, USDT or ticker lookalikes |
| Buy | Native ETH; not WETH |
| Recipient | The currently connected wallet only |
| Wallet | One installed injected desktop EOA wallet, owner selected if multiple |
| Amounts | Half; integer 1–100%; positive decimal USDC, up to 6 places |
| Exposure | Fixed prototype cap: 10 USDC per swap; never silently clamp |
| Language | English, one AI intent extraction, constrained to this single swap task |
| Runtime cost | Small OpenAI API bill; local app; Zerion free tier subject to access verification |
| Execution | Owner clicks each action and confirms each wallet request |
| Modes | Live or clearly labeled simulation, selected at server startup |

Reverse direction, native-ETH selling, dollar amounts, “all/max,” arbitrary fractions, multiple chains/tokens, follow-up conversation, limit orders, scheduled transactions, permits/Permit2 signatures, smart accounts and bridges are out of scope. A concise refusal is the complete handling of an unsupported edge case.

## Intent extraction contract

Use one short server-side OpenAI request to interpret the sentence, using the schema and system prompt in `07-intent-contract.md`. Accept ordinary paraphrases, politeness and case differences. Support half, whole percentages, and exact decimal USDC quantities. The model returns meaning only: it does not calculate balances, select addresses, get quotes, write UI prose, use tools or sign anything.

Require a complete, unambiguous single instruction. Missing values trigger a short request to rephrase the full instruction; no multi-turn chat state. Dollars, additional recipients, conditions, unsupported assets/chains and multiple actions must be rejected, not silently removed. Maximum input length: 160 characters. Check the extracted object again in deterministic code.

`fixtures/intent-cases.json` supplies acceptance cases. Unit tests mock extraction; a small separately invoked smoke evaluation checks the actual model. Simulation without an OpenAI key supports only the fixture examples and is marked “Scripted simulation”; do not build a second general parser.

## Page composition

Design a restrained, finished financial tool called **Half**. No imitation Zerion logo or claim of affiliation. Text footer: “Independent prototype · Quotes via Zerion” in live mode; “Independent prototype · Simulated data” in simulation. Per the owner's request, include the official local `public/brand/zerion-lockup.svg` as a small footer attribution linking to https://zerion.io/. Keep Half as the primary name and retain the mode-specific disclosure. Preserve the logo's colors, proportions and clear space.

- Keep the design as simple as possible: neutral surfaces, one input, one review card and only essential controls. No decorative sections or extra visual flourishes.
- Page background `#F7F7F7`; surface `#FFFFFF`; text `#171717`; secondary `#595959`; borders `#E0E0E0`; error `#A82B32`. Use official Zerion Blue `#56ACFF` for primary button backgrounds and loading indicators (source: https://design.zerion.io/color). Use dark `#06003C` button text for readable contrast. Secondary actions remain quiet text controls; loading indicators include a visible text status. No green accent or tinted accent panels.
- Use a system sans stack, with tabular numbers. No downloaded font or image dependency except the locally stored official Zerion attribution logo. Typography: heading 40/44 desktop, 30/34 mobile; body 16/24; metadata 13/18; main amounts 32/38.
- Header max-width 1080px; name left; visible Base badge and connect/account control right. Thin divider. Page padding 24px desktop, 16px mobile.
- Main column max-width 680px, top margin 64px desktop/32px mobile. Small eyebrow “A simpler way to swap”, heading “Swap in a sentence”, one short line explaining the supported pair.
- Composer: one accessible text input or 2-row textarea with a clear Send arrow button. Placeholder “Swap half my USDC for ETH”. Visible label, not just placeholder. Example chip “Swap half my USDC for ETH” fills input; does not submit.
- After submission, a compact user sentence bubble above the review card. Keep only the current attempt plus its state; no long chat history, sidebar, fake assistant avatars or typing theatrics.
- Review card uses 20px radius, 24px padding, subtle border. Prominent stacked “You pay” and “You receive (estimated)” amounts, simple circular text token markers, downward arrow between. Below: network, minimum quoted output, slippage, estimated network fee, provider fee and route. Small “Details” disclosure for USDC contract, recipient, spender and fee inclusion notes.
- One full-width primary button, 48px high; one quiet Edit action. No competing calls to action. Before approval, explain “First allow this amount of USDC, then confirm the swap.”
- Stages are plain text: “Allow USDC” → “Confirm swap” → “Confirmed”. Show only stages applicable to the actual route.
- Success: small check icon, “Swap confirmed”, input amount, transaction link. Retain “Quoted output” if the actual received ETH has not been independently decoded. Never relabel the estimate as a measured receipt.
- CSS transitions only: 120–180ms opacity/translate up to 4px; honor reduced motion. No animation library, gradients, charts, mascot, confetti or landing page.

## Interaction copy and behavior

| Situation | Message/action |
|---|---|
| No wallet connected | “Connect your wallet to use your Base balance.” Preserve sentence. |
| No injected wallet | “Open this demo in a desktop browser with an Ethereum wallet extension.” |
| Wrong network | “Switch to Base to continue.” User-triggered Switch button; no automatic loop. |
| Invalid sentence | “Try: Swap half my USDC for ETH. This demo supports USDC → ETH on Base.” |
| Insufficient USDC | “Your Base balance is lower than this amount.” Edit input. |
| Above demo cap | “This prototype supports swaps up to 10 USDC. Enter a smaller amount.” |
| No ETH for fees | “You need ETH on Base for network fees.” No purchasing widget. |
| Smallest unit rounds to zero | “This amount is too small to swap.” |
| Quote loading | “Getting a quote…” Stable skeleton; no fake numbers. |
| Quote expired | “Refresh this quote before continuing.” Refresh button. |
| Approval pending | “Waiting for USDC approval…” Show approval hash link. |
| User rejected | “Request cancelled in your wallet. Nothing was submitted for this step.” |
| Approval succeeded; swap cancelled | “USDC allowance is set. The swap was not submitted.” |
| Pending/unknown after send | “Still checking this transaction. Don’t submit another swap yet.” Check status + hash link. |
| Live provider fails | “Couldn't get a live quote. Try again.” No switch to fake quotes. |
| Simulation | Persistent “Simulation · No real funds or wallet signatures”. CTA “Simulate swap”. |

Use native controls, visible focus, 44px minimum touch targets, live-region status updates and textual states in addition to color. Enter submits when idle; Enter never confirms a transaction. Disable concurrent submits synchronously. At 390px width, no horizontal scrolling; full addresses wrap/copy inside Details. Mobile layout is supported; mobile wallet connection is explicitly not.
