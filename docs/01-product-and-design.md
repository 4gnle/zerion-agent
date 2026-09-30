# Product and visual specification

## The promise

Convert one short sentence into a reviewable Arbitrum ETH-to-USDC swap or an Ethereum-to-Arbitrum native ETH bridge. Users still connect and approve in their wallet. “One sentence” means less form filling, not permissionless execution. Primary demo: `Hey, swap half my ETH for USDC`.

The audience is someone who already has a desktop wallet and ETH on Arbitrum. No onboarding into crypto, wallet creation, deposits, portfolio explorer, trading advice, or token discovery.

## Fixed scope

| Decision | Requirement |
|---|---|
| Network | Swaps on Arbitrum; bridges Ethereum → Arbitrum; connected chain visible/changeable in header |
| Sell | Native ETH; not WETH |
| Buy | Native Circle USDC; not bridged USDC.e |
| Recipient | The currently connected wallet only |
| Wallet | One installed injected desktop EOA wallet, owner selected if multiple |
| Amounts | Half; integer 1–100%; positive decimal ETH, up to 18 places |
| Exposure | Fixed prototype cap: 0.002 ETH per swap; never silently clamp |
| Language | English, one AI intent extraction, constrained to this single swap task |
| Runtime cost | Small OpenAI API bill; local app; Zerion free tier subject to access verification |
| Execution | Owner clicks each action and confirms each wallet request |
| Modes | Live or clearly labeled simulation, selected at server startup |

Reverse direction, dollar amounts, “all/max,” arbitrary fractions, other chains/tokens, follow-up conversation, limit orders, scheduled transactions, permits/Permit2 signatures, smart accounts and other/reverse bridges are out of scope. A concise refusal is the complete handling of an unsupported edge case.

## Intent extraction contract

Use one short server-side OpenAI request to interpret the sentence, using the schema and system prompt in `07-intent-contract.md`. Accept ordinary paraphrases, politeness and case differences. Support half, whole percentages, and exact decimal ETH quantities. The model returns meaning only: it does not calculate balances, select addresses, get quotes, write UI prose, use tools or sign anything.

Require a complete, unambiguous single instruction. Missing values trigger a short request to rephrase the full instruction; no multi-turn chat state. Dollars, additional recipients, conditions, unsupported assets/chains and multiple actions must be rejected, not silently removed. Maximum input length: 160 characters. Check the extracted object again in deterministic code.

`fixtures/intent-cases.json` supplies acceptance cases. Unit tests mock extraction; a small separately invoked smoke evaluation checks the actual model. Simulation without an OpenAI key supports only the fixture examples and is marked “Scripted simulation”; do not build a second general parser.

## Page composition

Design a restrained, finished financial tool called **Wallet Agent**. No imitation Zerion logo or claim of affiliation. Footer: “Powered by” followed by the official Zerion logo. Per the owner's request, include the official local `public/brand/zerion-lockup.svg` as a small footer attribution linking to https://zerion.io/. Keep Wallet Agent as the primary name and keep simulation labeling in the demo wallet and transaction states, without any top mode banner. Preserve the logo's colors, proportions and clear space.

- Keep the design as simple as possible: neutral surfaces, one input, one review card and only essential controls. No decorative sections or extra visual flourishes.
- Page background `#F7F7F7`; surface `#FFFFFF`; text `#171717`; secondary `#595959`; borders `#E0E0E0`; error `#A82B32`. Use official Zerion Blue `#56ACFF` for primary button backgrounds and loading indicators (source: https://design.zerion.io/color). Use dark `#06003C` button text for readable contrast. Secondary actions remain quiet text controls; loading indicators include a visible text status. No green accent or tinted accent panels.
- Use a system sans stack, with tabular numbers. No downloaded font or image dependency except the locally stored official Zerion attribution logo. Typography: heading 40/44 desktop, 30/34 mobile; body 16/24; metadata 13/18; main amounts 32/38.
- Header max-width 1080px; name left; connected-chain label (Arbitrum or Ethereum) and connect/account control right; disconnected and unsupported wallets get neutral status labels; simulation displays its demo Arbitrum chain. Subtle section borders and 16px rounded outer panels, following the owner’s final Zerion screenshot reference. Page padding 16px desktop, 12px mobile.
- Main content max-width 680px inside a wider bordered surface, beside a 260px softly shaded History panel. Heading “Wallet Agent” and the supported pair. No eyebrow labels or descriptive copy beneath the composer.
- Composer: one accessible text input or 2-row textarea with a circular blue Send button and a crisp SVG arrow. Placeholder “Swap half my ETH for USDC”. Visible label “What would you like to do?”, not just placeholder. Example chip “Swap half my ETH for USDC” fills input; does not submit.
- When connected in live mode, show Your Balance immediately right of the wallet address; its dropdown shows ETH and native USDC on the connected Arbitrum or Ethereum network. Include loading, retry/refresh and unsupported-network states; never show missing data as zero.
- A left sidebar shows wallet history from all indexed networks with refresh, pagination, pending state and clear unverified token labels. On narrow screens it follows the main panel.
- After submission, a compact user sentence bubble above the review card. Keep only the current attempt plus its state; no long chat history, sidebar, fake assistant avatars or typing theatrics.
- Review card uses 24px radius (20px mobile), 24px padding, soft neutral background and thin border. Prominent stacked “You pay” and “You receive (estimated)” amounts, simple circular text token markers, downward arrow between. Below: network, minimum quoted output, slippage, estimated network fee, provider fee and route. Small “Details” disclosure for USDC contract, recipient and fee inclusion notes.
- One full-width primary button, 48px high; one quiet Edit action. No competing calls to action. Explain that ETH must cover both input and gas.
- Stages are plain text: “Confirm swap” → “Confirmed”. Show only stages applicable to the actual route.
- Success: small check icon, “Swap confirmed”, input amount, transaction link. Retain “Quoted output” if the actual received USDC has not been independently decoded. Never relabel the estimate as a measured receipt.
- CSS transitions only: 120–180ms opacity/translate up to 4px; honor reduced motion. No animation library, gradients, charts, mascot, confetti or landing page.

## Interaction copy and behavior

| Situation | Message/action |
|---|---|
| No wallet connected | “Connect your wallet to use your Arbitrum balance.” Preserve sentence. |
| No injected wallet | “Open this demo in a desktop browser with an Ethereum wallet extension.” |
| Wrong network | “Switch to Arbitrum to continue.” User-triggered Switch button; no automatic loop. |
| Invalid sentence | “Try: Swap half my ETH for USDC. This demo supports ETH → USDC on Arbitrum.” |
| Insufficient ETH | “Your Arbitrum balance is lower than this amount.” Edit input. |
| Above demo cap | “This prototype supports swaps up to 0.002 ETH. Enter a smaller amount.” |
| No ETH for fees | “You need ETH on Arbitrum for network fees.” No purchasing widget. |
| Smallest unit rounds to zero | “This amount is too small to swap.” |
| Quote loading | “Getting a quote…” Stable skeleton; no fake numbers. |
| Quote expired | “Refresh this quote before continuing.” Refresh button. |
| Approval pending | “Waiting for USDC approval…” Show approval hash link. |
| User rejected | “Request cancelled in your wallet. Nothing was submitted for this step.” |
| Pending/unknown after send | “Still checking this transaction. Don’t submit another swap yet.” Check status + hash link. |
| Live provider fails | “Couldn't get a live quote. Try again.” No switch to fake quotes. |
| Simulation | “Demo wallet” header and labeled simulated quote/completion; no top simulation banner. CTA “Simulate swap”. |

Use native controls, visible focus, 44px minimum touch targets, live-region status updates and textual states in addition to color. Enter submits when idle; Enter never confirms a transaction. Disable concurrent submits synchronously. At 390px width, no horizontal scrolling; full addresses wrap/copy inside Details. Mobile layout is supported; mobile wallet connection is explicitly not.
