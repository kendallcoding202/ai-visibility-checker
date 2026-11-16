import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setResolver, resetAgent, audit } from './websiteAudit.js';

const mockResolver = {
  resolve4: async () => ['93.184.216.34'],
  resolve6: async () => [],
};

test('robots.txt: partial disallow does not block', async () => {
  setResolver(mockResolver);
  resetAgent();
  const robotsTxt = `User-agent: GPTBot
Disallow: /private/
`;
  const result = await audit('http://example.com', 'Test', 'test', 'Test');
  assert.equal(result.accessible, false);
});

test('robots.txt: * Disallow / blocks all bots', () => {
  const robotsTxt = `User-agent: *
Disallow: /
`;
  const lines = robotsTxt.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const groups = [];
  let currentGroup = { agents: [], rules: [] };
  
  for (const line of lines) {
    if (/^User-agent:/i.test(line)) {
      const agent = line.replace(/^User-agent:\s*/i, '').trim();
      if (currentGroup.agents.length > 0 || currentGroup.rules.length > 0) {
        groups.push(currentGroup);
        currentGroup = { agents: [], rules: [] };
      }
      currentGroup.agents.push(agent.toLowerCase());
    } else if (/^(Disallow|Allow):/i.test(line)) {
      currentGroup.rules.push(line);
    }
  }
  if (currentGroup.agents.length > 0 || currentGroup.rules.length > 0) {
    groups.push(currentGroup);
  }

  const wildcardGroup = groups.find((g) => g.agents.includes('*'));
  assert.ok(wildcardGroup);
  const hasDisallowRoot = wildcardGroup.rules.some((r) => /^Disallow:\s*\/\s*$/i.test(r));
  assert.equal(hasDisallowRoot, true);
});

test('robots.txt: specific group overrides wildcard', () => {
  const robotsTxt = `User-agent: *
Disallow: /

User-agent: GPTBot
Allow: /
`;
  const lines = robotsTxt.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const groups = [];
  let currentGroup = { agents: [], rules: [] };
  
  for (const line of lines) {
    if (/^User-agent:/i.test(line)) {
      const agent = line.replace(/^User-agent:\s*/i, '').trim();
      if (currentGroup.agents.length > 0 || currentGroup.rules.length > 0) {
        groups.push(currentGroup);
        currentGroup = { agents: [], rules: [] };
      }
      currentGroup.agents.push(agent.toLowerCase());
    } else if (/^(Disallow|Allow):/i.test(line)) {
      currentGroup.rules.push(line);
    }
  }
  if (currentGroup.agents.length > 0 || currentGroup.rules.length > 0) {
    groups.push(currentGroup);
  }

  const botGroup = groups.find((g) => g.agents.includes('gptbot'));
  assert.ok(botGroup);
  const hasAllowRoot = botGroup.rules.some((r) => /^Allow:\s*\/\s*$/i.test(r));
  assert.equal(hasAllowRoot, true);
});

test('robots.txt: bot in different group not affected', () => {
  const robotsTxt = `User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Allow: /
`;
  const lines = robotsTxt.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const groups = [];
  let currentGroup = { agents: [], rules: [] };
  
  for (const line of lines) {
    if (/^User-agent:/i.test(line)) {
      const agent = line.replace(/^User-agent:\s*/i, '').trim();
      if (currentGroup.agents.length > 0 || currentGroup.rules.length > 0) {
        groups.push(currentGroup);
        currentGroup = { agents: [], rules: [] };
      }
      currentGroup.agents.push(agent.toLowerCase());
    } else if (/^(Disallow|Allow):/i.test(line)) {
      currentGroup.rules.push(line);
    }
  }
  if (currentGroup.agents.length > 0 || currentGroup.rules.length > 0) {
    groups.push(currentGroup);
  }

  const gptbotGroup = groups.find((g) => g.agents.includes('gptbot'));
  const claudebotGroup = groups.find((g) => g.agents.includes('claudebot'));
  assert.ok(gptbotGroup);
  assert.ok(claudebotGroup);
  assert.notEqual(gptbotGroup, claudebotGroup);
});
