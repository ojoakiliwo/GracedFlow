import { Link, NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import clsx from "clsx";
import { Menu, X } from "lucide-react";
import { Button } from "./ui";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/about", label: "About" },
  { to: "/founder", label: "Founder" },
  { to: "/give", label: "Give" },
  { to: "/prayer", label: "Prayer" },
];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/brand/igc-logo.png"
              alt="Infinitely Graced Church"
              className="h-11 w-11 object-contain"
            />
            <div className="leading-tight">
              <p className="font-display text-lg font-semibold text-brand-900">
                Infinitely Graced
              </p>
              <p className="text-[11px] uppercase tracking-widest text-gold-600">
                Church
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  clsx(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-brand-800"
                      : "text-ink-500 hover:text-brand-700",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            <Link to="/login" className="ml-2">
              <Button size="sm">Member Login</Button>
            </Link>
          </nav>

          <button
            className="rounded-lg p-2 text-ink-600 md:hidden"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-ink-100 px-4 py-3 md:hidden">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-600"
              >
                {l.label}
              </NavLink>
            ))}
            <Link to="/login" onClick={() => setOpen(false)}>
              <Button size="sm" className="mt-2 w-full">
                Member Login
              </Button>
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-ink-100 bg-brand-950 text-brand-200">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-3">
              <img
                src="/brand/igc-logo.png"
                alt="IGC"
                className="h-12 w-12 rounded-full bg-white/95 object-contain p-0.5"
              />
              <p className="font-display text-xl font-semibold text-white">
                Infinitely Graced Church
              </p>
            </div>
            <p className="mt-4 max-w-sm text-sm text-brand-300">
              A family flowing in His infinite grace — reaching lives, building people,
              and transforming our community for Christ.
            </p>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-white">Service Times</p>
            <ul className="space-y-1.5 text-sm text-brand-300">
              <li>Sunday Service — 9:00 AM</li>
              <li>Wednesday Prayer — 5:30 PM</li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-white">Quick Links</p>
            <ul className="space-y-1.5 text-sm text-brand-300">
              <li>
                <Link to="/about" className="hover:text-white">
                  About the Church
                </Link>
              </li>
              <li>
                <Link to="/founder" className="hover:text-white">
                  Founding President
                </Link>
              </li>
              <li>
                <Link to="/give" className="hover:text-white">
                  Give / Tithe
                </Link>
              </li>
              <li>
                <Link to="/prayer" className="hover:text-white">
                  Prayer Request
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white">
                  Worker Login
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-brand-400">
          © {new Date().getFullYear()} Infinitely Graced Church · Powered by GracedFlow
        </div>
      </footer>
    </div>
  );
}
