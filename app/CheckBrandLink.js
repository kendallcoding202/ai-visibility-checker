'use client';
import { usePathname } from 'next/navigation';
import { checkBrandHref } from '../lib/checkLink.js';

export default function CheckBrandLink() {
  return <a href={checkBrandHref(usePathname())}>Check your brand</a>;
}
