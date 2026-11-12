import { ImageResponse } from 'next/og';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Free AI Visibility Checker';
export default function OG() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '72px 80px', background: '#12211c', color: '#f7f6f2' }}>
      <div style={{ display: 'flex', fontSize: 28, letterSpacing: 0.2, color: '#d7f5ea' }}>Free AI Visibility Checker</div>
      <div style={{ display: 'flex', fontSize: 68, fontWeight: 700, lineHeight: 1.08, maxWidth: 980 }}>Does ChatGPT recommend your brand?</div>
      <div style={{ display: 'flex', fontSize: 30, color: '#c9d6cf' }}>Mentions · rank · competitors · cited sources, in 30 seconds</div>
    </div>, size);
}
