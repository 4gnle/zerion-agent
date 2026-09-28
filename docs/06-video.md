# Record a clear 3–5 minute interview demo

Target ~4 minutes. Camera for the first 20–30 seconds if convenient, then screen. The interview request supplied by the owner is the brief; no account access or submission is part of this kit.

## Before recording

- Finish one owner-signed live smoke test if possible. Save the working commit/state. Do not redesign the UI on recording day.
- Use the production local server after build if convenient; disable notifications, hide private tabs/keys, use a small dedicated wallet. Never expose wallet recovery material.
- Confirm Base, USDC balance and ETH gas before starting. “Half” uses the current balance, so an earlier test changes the exact amount in the recording. Do not script a fixed number unless it matches the screen.
- Use 1440×900 or a comfortable similar desktop capture with readable text; crop dead browser area. Test the microphone with a 15-second recording.
- A video can show a recorded real transaction; do not repeatedly spend gas to chase a perfect take. Clearly indicate cuts/time jumps through waiting periods.
- If only simulation works, say so at the start of the demo and leave its label visible. If live quotes work but execution doesn't, identify that exact boundary. Never describe a fake hash as mainnet execution.

## Speaking outline

### 0:00–0:25 — intro

“Hi, I'm Angel. I'm a software engineer with experience across frontend development, product decisions and building products end to end. Recently I've been exploring a small interaction idea for crypto: turning a swap request into something you can review and sign without filling out a form.”

Adjust the experience wording to your actual background. Be clear this is a recent prototype built for the exploration; don't invent users or business results.

### 0:25–0:50 — problem and scope

“This is Half. It does one thing: swap USDC into ETH on Base. The idea is that I can say what I want in ordinary language, but still see exactly what will happen before I authorize it. I kept it to one pair and one chain so I could concentrate on the interaction and the transaction states.”

Show the scope badge and wallet. Briefly mention current mode if simulated or quote-only.

### 0:50–2:15 — working demo

Type: “Hey, swap half my USDC for ETH.”

“The model extracts the intention. The application reads my Base balance and calculates the actual amount. It doesn't ask the model to do the money math.”

Show the resolved fraction, sell amount, expected ETH, minimum, network and fees. Open Details once, briefly.

“The quote comes from Zerion. Before anything moves, I can check the amount and destination. If I haven't allowed the router to spend this USDC, the first step is an allowance for this amount. After that confirms, the app refreshes the quote before I sign the swap.”

Perform the applicable wallet steps. If allowance already exists, explain that it skips that step. Don't manufacture an approval request just to show it.

“Here it is pending, and now confirmed on Base.” Show the explorer link only if it corresponds to a real successful transaction. If still pending, say it is pending; do not stall the entire video waiting indefinitely.

### 2:15–3:20 — two decisions you owned

“First, language understanding and execution are separate. The model returns a small structured object. It doesn't provide contract addresses or transaction data, and it cannot sign. The code restricts the chain, token pair, recipient and amount.”

“Second, I used chat only for entering the intention. Confirmation is a structured card, because people need to compare numbers and understand approvals. I also treat cancellation, stale quotes and wallet changes as normal product states, not just error messages.”

Show one quick non-money-moving edge case, such as an unsupported chain request or cancellation state you can demonstrate honestly. One is enough.

### 3:20–4:00 — what you'd change

“This is a deliberately narrow prototype. Next, I'd test whether people actually prefer the sentence input to a compact swap form, and whether the approval step is clear. I'd also strengthen route validation before broadening token or wallet support. I didn't want to add more capabilities before understanding whether this interaction helps.”

Say what you personally built and how AI helped: “I used Codex to accelerate implementation; I chose the scope, interaction and validation boundaries, and reviewed and tested the transaction flow.” Only make that testing claim once you actually did it.

## Submission checks

Keep within 3–5 minutes. Verify audio and the exported file. If sharing a video link, check view permissions in a signed-out window; if uploading a file, verify the upload completed. Use the form from the recruiter's email. The assistant does not submit on your behalf without a separate request.
