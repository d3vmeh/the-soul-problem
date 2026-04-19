import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { spawnSync } from 'node:child_process';

const commands: string[][] = [
  ['npx', 'tsx', 'scripts/seed-scenarios.ts'],
  ['npx', 'tsx', 'scripts/seed-screener.ts'],
  ['npx', 'tsx', 'scripts/seed-responses.ts'],
];

for (const cmd of commands) {
  console.log(`\n> ${cmd.join(' ')}`);
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`command failed with code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}
