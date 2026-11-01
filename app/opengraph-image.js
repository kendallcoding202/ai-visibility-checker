import { ImageResponse } from 'next/og';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Free AI Visibility Checker';
export default function OG() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: 'linear-gradient(135deg,#0b1020,#1e2a5a)', color: 'white' }}>
      <div style={{ fontSize: 34, color: '#8ab4ff' }}>Free AI Visibility Checker</div>
      <div style={{ fontSize: 72, fontWeight: 800, marginTop: 20, lineHeight: 1.1 }}>Does ChatGPT recommend your brand?</div>
      <div style={{ fontSize: 32, marginTop: 30, color: '#c9d4f0' }}>Mentions · rank · competitors · cited sources, in 30 seconds</div>
    </div>, size);
}
