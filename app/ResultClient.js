'use client';
import { SITE } from './site.js';
import { useState } from 'react';
import { TRACKER } from './links.js';

function useCopy() {
  const [done, setDone] = useState(false);
  return [done, async (text) => { try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy this:', text); } setDone(true); setTimeout(() => setDone(false), 2500); }];
}

export function ShareLink({ id, brand, score }) {
  const [done, copy] = useCopy();
  const url = `${SITE}/r/${id}`;
  const text = `ChatGPT gave ${brand} an AI visibility score of ${score}/100. Check yours free:`;
  return (<div className="share">
    <button type="button" className="ghost" onClick={() => copy(url)}>{done ? 'Link copied ✓' : '🔗 Copy share link'}</button>
    <a className="ghost" target="_blank" rel="noopener" href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}>Post on X</a>
    <a className="ghost" target="_blank" rel="noopener" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}>Share on LinkedIn</a>
    <span className="muted">No email or sign-up. The link shows this anonymous result only.</span>
  </div>);
}

// Apify has no URL parameter for prefilling Actor input, so we hand over a ready JSON input to paste.
export function trackerInput(d) {
  const comps = [...new Set([...(d.competitorHits ?? []).map((c) => c.name), ...(d.topBrands ?? []).map((b) => b.name)])].slice(0, 5);
  return {
    brand: d.brand, competitors: comps, prompts: d.rows.map((r) => r.prompt), category: d.category,
    engines: ['chatgpt-search', 'gemini-knowledge'], samplesPerPrompt: 1,
    trackingName: `${d.brand}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-weekly',
  };
}

export function TrackerCTA({ d }) {
  const [done, copy] = useCopy();
  const input = trackerInput(d);
  const answers = input.prompts.length * input.engines.length;
  return (<div className="ctabox" id="track">
    <h3 style={{ marginTop: 0 }}>Track this weekly in the AI Visibility Tracker</h3>
    <p>Run these same {input.prompts.length} questions for {d.brand} vs {input.competitors.slice(0, 3).join(', ') || 'your competitors'} on ChatGPT + Gemini every week, with share of voice, sentiment, gap prompts and a shareable report. {answers} answers = ${(answers * 0.04).toFixed(2)} per run with the prefilled input, no API keys, no subscription. You can add Perplexity too.</p>
    <div className="share">
      <button type="button" onClick={() => copy(JSON.stringify(input, null, 2))}>{done ? 'Input copied ✓' : '1. Copy your tracker input'}</button>
      <a className="cta" target="_blank" rel="noopener" href={TRACKER('result-cta')}>2. Open the tracker on Apify →</a>
    </div>
    <ol className="steps"><li>Click <b>Copy your tracker input</b>.</li><li>On Apify, click <b>Try for free</b>, then switch the input from <b>Manual</b> to <b>JSON</b> and paste.</li><li>Click <b>Start</b>. Add a weekly schedule to keep tracking.</li></ol>
  </div>);
}
