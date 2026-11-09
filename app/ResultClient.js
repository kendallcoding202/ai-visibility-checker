'use client';
import { SITE } from './site.js';
import { useState } from 'react';
import { TRACKER, CITATION } from './links.js';
import { trackerInput, citationInput, runCost, VIS_PRICE, CIT_PRICE } from '../lib/apifyInput.js';

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

// Copy during the click, before the new tab takes focus. The async clipboard API can hang or
// reject once focus moves; the textarea path finishes in the same turn, and a blocked clipboard
// falls back to a prompt that shows the JSON.
function copyNow(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (ok) return true;
  } catch { /* prompt below */ }
  window.prompt('Copy this:', text);
  return false;
}

// Apify Store has no URL parameter for per-visitor Actor input, so one click copies the ready JSON
// and opens the Actor in a new tab. The href is a fixed apify.com URL; user input never enters it.
function CopyAndOpen({ json, href, children }) {
  const [done, setDone] = useState(false);
  return (<a className="cta" target="_blank" rel="noopener" href={href}
    onClick={() => { copyNow(json); setDone(true); setTimeout(() => setDone(false), 2500); }}>{done ? 'Input copied ✓ Apify opened in a new tab' : children}</a>);
}

export function TrackerCTA({ d }) {
  const input = trackerInput(d);
  const json = JSON.stringify(input, null, 2);
  const answers = input.prompts.length * input.engines.length;
  return (<div className="ctabox" id="track">
    <h3 style={{ marginTop: 0 }}>Track this weekly on Apify</h3>
    <p>Run these same {input.prompts.length} questions for {d.brand} vs {input.competitors.slice(0, 3).join(', ') || 'your competitors'} on ChatGPT, Gemini &amp; Perplexity every week, with share of voice, sentiment, gap prompts and a shareable report. {answers} answers = ${runCost(input, VIS_PRICE).toFixed(2)} per run with the prefilled input, no API keys, no subscription.</p>
    <div className="share">
      <CopyAndOpen json={json} href={TRACKER('result-cta')}>Copy my input &amp; open the tracker →</CopyAndOpen>
    </div>
    <ol className="steps"><li>Click <b>Copy my input &amp; open the tracker</b>. Your input is now on the clipboard.</li><li>On Apify, click <b>Try for free</b>, then switch the input from <b>Manual</b> to <b>JSON</b> and paste.</li><li>Click <b>Start</b>. Add a weekly schedule to keep tracking.</li></ol>
  </div>);
}

export function CitationCTA({ d }) {
  const input = citationInput(d);
  if (!input.prompts.length) return null;
  const answers = input.prompts.length * input.engines.length;
  return (<p className="muted">See every URL ChatGPT and Perplexity cite for these {input.prompts.length} questions, and whether your domain is one of them:{' '}
    <CopyAndOpen json={JSON.stringify(input, null, 2)} href={CITATION('result-sources')}>Copy input &amp; open the AI Citation Tracker →</CopyAndOpen>{' '}
    {answers} answers = ${runCost(input, CIT_PRICE).toFixed(2)}. Add your domain to <code>yourDomains</code> after pasting.</p>);
}
