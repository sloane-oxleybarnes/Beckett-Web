import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border mt-24 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative h-8 w-32">
            <Image
              src="/brand/beckett-horizontal-logo.png"
              alt="Beckett"
              fill
              sizes="128px"
              className="object-contain object-left"
            />
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-light">
            <Link href="/features" className="hover:text-ink transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="hover:text-ink transition-colors">
              Pricing
            </Link>
            <Link href="/beta" className="hover:text-ink transition-colors">
              Beta
            </Link>
            <Link href="/privacy" className="hover:text-ink transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-ink transition-colors">
              Terms of Service
            </Link>
            <a href="mailto:hello@meetbeckett.co" className="hover:text-ink transition-colors">
              Contact
            </a>
            <a
              href="https://www.instagram.com/meet.beckett/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink transition-colors"
            >
              Instagram
            </a>
            <a
              href="https://www.linkedin.com/company/beckett-communication-app/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink transition-colors"
            >
              LinkedIn
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61592588274956"
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink transition-colors"
            >
              Facebook
            </a>
            <Link href="/auth/login" className="hover:text-ink transition-colors">
              Sign in
            </Link>
          </nav>
          <p className="text-sm text-ink-light">
            &copy; {new Date().getFullYear()} Beckett Labs Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
