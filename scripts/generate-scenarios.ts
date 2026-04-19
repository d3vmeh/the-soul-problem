import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';

const Scenario = z.object({
  prompt: z.string().min(40),
  metadata: z.object({
    relationship: z.string(),
    transgression: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
  }),
});
const Scenarios = z.array(Scenario).length(20);

async function main() {
  const prompt = readFileSync('data/scenarios-prompt.txt', 'utf8');
  const anthropic = new Anthropic();

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content[0].type === 'text' ? res.content[0].text : '';
    try {
      const json = JSON.parse(text);
      const parsed = Scenarios.parse(json);
      writeFileSync('data/scenarios.json', JSON.stringify(parsed, null, 2) + '\n');
      console.log(`wrote 20 scenarios (attempt ${attempt})`);
      return;
    } catch (e) {
      console.warn(`attempt ${attempt} failed:`, (e as Error).message);
    }
  }
  throw new Error('gave up after 3 attempts');
}

main().catch(e => { console.error(e); process.exit(1); });
