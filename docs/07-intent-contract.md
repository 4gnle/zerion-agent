# One-call instruction extraction

The source of truth is `IntentSchema` in lib/intent.ts and `INTENT_SYSTEM_PROMPT` in lib/intent.server.ts. Keep both aligned with fixtures/intent-cases.json.

One OpenAI Responses structured extraction, server-only key, model gpt-4.1-mini-2025-04-14 by default, store false, 300 output tokens, 15-second timeout, zero SDK retries. No tools, history, balances, wallet address or agent loop are sent to the model.

Required strict fields: status (ready/needs_clarification/unsupported), sellToken (ETH/other/null), buyToken (USDC/ETH/other/null), chain (arbitrum/ethereum/other/null), amountType (percentage/exact/null), amount (string/null), recipient (self/other/null), reason (none/missing_amount/missing_asset/unsupported_request). Ready requires all supported fields, a positive amount and reason none. The model never returns transactions or addresses.

Accept half, integer percentages 1–100 or positive exact ETH decimals up to 18 places. Omitted chain means Arbitrum, omitted recipient means self; assets must be explicit. Bridge ETH from Ethereum to Arbitrum maps to buyToken ETH and chain ethereum; both source and destination must be explicit. Reject Base, other/reverse bridges, other assets/chains/recipients, dollar values, max/all, exponent/comma notation, >18 decimals, fractional percentages, conditions, schedules, negation, multiple actions and instruction injection. Never drop an unsupported clause to manufacture a valid action.

Local text guards bound length to 160 and reject dollars, explicit recipients and multiple numeric amounts. Deterministic schema/semantic validation follows extraction. BigInt amount math, cap, funding and gas checks are separate; a model-ready 100% intent still fails the gas reserve rule. Refusal, incomplete response, malformed output and service errors fail visibly without a quote or signing.

Simulation uses the same extraction when keyed. Without a key only fixture phrases are supported and the page says Scripted simulation. Live mode never silently falls back. Unit tests use fixtures; `npm run test:intent:live` is a separately invoked, bounded paid suite, not a default check.

Four focused bridge model cases passed: exact amount, half, rejected reverse direction and rejected Base destination. `npm run test:intent:live -- --bridge` is a separately authorized paid check.
