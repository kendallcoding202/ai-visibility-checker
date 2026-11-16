// Fix kit generation for local service businesses.

export function generateLocalBusinessSchema(businessName, service, city, state) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: businessName,
    description: `${service} in ${city}, ${state}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'YOUR_STREET_ADDRESS_HERE',
      addressLocality: city,
      addressRegion: state,
      postalCode: 'YOUR_ZIP_CODE_HERE',
      addressCountry: 'US',
    },
    telephone: 'YOUR_PHONE_NUMBER_HERE',
    openingHours: 'YOUR_HOURS_HERE (e.g., Mo-Fr 09:00-17:00)',
    priceRange: '$$',
  };
}

export function generateFAQQuestions(businessName, service, city, state) {
  return [
    `What services does ${businessName} offer in ${city}?`,
    `How long has ${businessName} been providing ${service} in ${city}, ${state}?`,
    `What areas around ${city} does ${businessName} serve?`,
    `How do I schedule an appointment with ${businessName}?`,
    `What are the hours of operation for ${businessName}?`,
  ];
}

export function generateLlmsTxt(businessName, service, city, state) {
  return [
    `# ${businessName}`,
    '',
    `${businessName} provides ${service} in ${city}, ${state}.`,
    '',
    '## Services',
    `- ${service}`,
    '- [Add other services here]',
    '',
    '## Contact',
    '- Phone: YOUR_PHONE_NUMBER_HERE',
    '- Address: YOUR_ADDRESS_HERE',
    '- Hours: YOUR_HOURS_HERE',
  ].join('\n');
}

export function generateRobotsTxt() {
  return [
    'User-agent: GPTBot',
    'Allow: /',
    '',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    '',
    'User-agent: ChatGPT-User',
    'Allow: /',
    '',
    'User-agent: ClaudeBot',
    'Allow: /',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    '',
    '# Optional: Google-Extended controls AI training use (not search indexing)',
    'User-agent: Google-Extended',
    'Allow: /',
  ].join('\n');
}

export function buildLocalFixList(result, auditResult) {
  const fixes = [];

  if (!auditResult || auditResult.skipped || !auditResult.accessible) {
    return { fixes: [], audit: auditResult };
  }

  if (!auditResult.hasLocalBusinessSchema) {
    fixes.push({
      type: 'schema',
      title: 'Add LocalBusiness structured data',
      description: 'Add this JSON-LD script to your homepage <head> section. Replace placeholders with your actual information.',
      priority: 'high',
    });
  }

  if (!auditResult.hasServiceInMeta) {
    fixes.push({
      type: 'meta',
      title: 'Add service and city to your homepage title and headings',
      description: `Include "${result.service}" and "${result.city}" in your <title> tag and <h1> heading.`,
      priority: 'high',
    });
  }

  if (!auditResult.hasFAQ) {
    fixes.push({
      type: 'faq',
      title: 'Add FAQ section to your website',
      description: 'AI assistants reference FAQ content when answering customer questions.',
      priority: 'medium',
    });
  }

  if (!auditResult.hasLlmsTxt) {
    fixes.push({
      type: 'llms',
      title: 'Create an llms.txt file',
      description: 'Place this file at the root of your website to provide AI-readable information.',
      priority: 'low',
    });
  }

  if (auditResult.robotsBlocked && auditResult.robotsBlocked.length > 0) {
    fixes.push({
      type: 'robots',
      title: `Allow AI crawlers in robots.txt (currently blocking: ${auditResult.robotsBlocked.join(', ')})`,
      description: 'Update your robots.txt to allow AI assistants to read your site.',
      priority: 'high',
    });
  }

  return { fixes, audit: auditResult };
}
