// Compatibility entry point; the current read-only probe is Arbitrum-only.
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--env-file=.env.local', '--import', 'tsx', 'scripts/probe-arbitrum.ts'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
