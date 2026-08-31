import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  FolderKanban,
  CalendarDays,
  ListChecks,
  Send,
  CalendarClock,
  Share2,
  Clapperboard,
  HandCoins,
  HeartHandshake,
  CalendarRange,
  Settings2,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { Avatar } from "./ui";
import { roleLabel } from "../lib/format";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  min?: "worker" | "pastor" | "admin";
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    title: "Overview",
    items: [{ to: "/app", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "People",
    items: [
      { to: "/app/members", label: "Members", icon: Users },
      { to: "/app/departments", label: "Rooms & Departments", icon: DoorOpen },
      { to: "/app/prayer", label: "Prayer Requests", icon: HeartHandshake },
    ],
  },
  {
    title: "Ministry",
    items: [
      { to: "/app/projects", label: "Projects & Visions", icon: FolderKanban },
      { to: "/app/meetings", label: "Meetings", icon: CalendarDays },
      { to: "/app/tasks", label: "Tasks", icon: ListChecks },
      { to: "/app/events", label: "Events", icon: CalendarRange },
    ],
  },
  {
    title: "Communication",
    items: [
      { to: "/app/messages", label: "Messages (SMS/Email)", icon: Send },
      { to: "/app/automations", label: "Automations", icon: CalendarClock },
      { to: "/app/social", label: "Social Broadcast", icon: Share2 },
      { to: "/app/studio", label: "Broadcast studio", icon: Clapperboard },
    ],
  },
  {
    title: "Finance",
    items: [{ to: "/app/giving", label: "Giving & Donations", icon: HandCoins }],
  },
  {
    title: "Administration",
    items: [{ to: "/app/settings", label: "Settings & Integrations", icon: Settings2 }],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-brand-950 text-brand-100 transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <img
            src="/brand/igc-logo.png"
            alt="IGC"
            className="h-11 w-11 rounded-full bg-white/95 object-contain p-0.5 ring-1 ring-white/20"
          />
          <div>
            <p className="font-display text-lg font-semibold leading-tight text-white">
              Infinitely Graced
            </p>
            <p className="text-xs text-brand-300">Ministry Portal</p>
          </div>
          <button
            className="ml-auto text-brand-300 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="no-scrollbar flex-1 space-y-6 overflow-y-auto px-3 pb-6">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/app"}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-brand-700 text-white shadow-sm"
                          : "text-brand-200 hover:bg-brand-900 hover:text-white",
                      )
                    }
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <a
            href="/"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-brand-200 hover:bg-brand-900 hover:text-white"
          >
            <DoorOpen className="h-[18px] w-[18px]" /> View public site
          </a>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-100 bg-white/80 px-4 backdrop-blur-md sm:px-6">
          <button
            className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-ink-100"
              >
                <Avatar first={user?.first_name} last={user?.last_name} />
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium text-ink-800">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-ink-400">{roleLabel(user?.role)}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-ink-400" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl border border-ink-100 bg-white py-1 shadow-lg"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div className="border-b border-ink-100 px-4 py-2">
                    <p className="truncate text-xs text-ink-400">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      navigate("/login");
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink-950/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}
