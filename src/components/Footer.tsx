"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconShield, IconUsers, IconLock, IconDocument } from "@/lib/icons";

export default function Footer() {
  const pathname = usePathname();
  
  // Hide footer on specific pages where it takes up too much space (like active chat or dashboard)
  if (pathname === "/chat" || pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="footer-container">
      <div className="footer-content">
        <div className="footer-brand-section">
          <Link href="/" className="footer-brand">
            around<span>U</span>
          </Link>
          <p className="footer-tagline">
            Anonymous, secure, and 18+. Meet strangers nearby and chat instantly. All data is deleted every 24 hours.
          </p>
        </div>

        <div className="footer-links-grid">
          <div className="footer-column">
            <h4>Platform</h4>
            <Link href="/about"><IconUsers size={16} /> About Us</Link>
            <Link href="/groups"><IconUsers size={16} /> Groups</Link>
            <Link href="/dating"><IconUsers size={16} /> Dating</Link>
          </div>

          <div className="footer-column">
            <h4>Legal</h4>
            <Link href="/privacy"><IconShield size={16} /> Privacy Policy</Link>
            <Link href="/terms"><IconDocument size={16} /> Terms of Service</Link>
            <Link href="/cookies"><IconShield size={16} /> Cookie Policy</Link>
          </div>


        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} AroundU. All rights reserved. 18+ Only.</p>
      </div>
    </footer>
  );
}
