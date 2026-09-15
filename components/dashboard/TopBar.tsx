import Image from "next/image";
import { Avatar } from "./Avatar";
import { LiveIndicator } from "./LiveIndicator";
import type { User } from "@/types";

const navItems = [
  { label: "Dashboard", active: true },
  { label: "Tickets" },
  { label: "Incidents" },
  { label: "Services" },
  { label: "Activity" },
];

export function TopBar({ orgName, self }: { orgName: string; self: User }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-6">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center size-5">
            <Image
              src="/assets/logo.png"
              alt="Logo"
              width={20}
              height={20}
              priority
              className="size-5"
            />
          </span>
          <span className="text-sm font-medium text-ink">{orgName}</span>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <span
              key={item.label}
              className={
                item.active
                  ? "rounded-md px-3 py-1.5 text-sm font-medium text-ink bg-panel-raised"
                  : "rounded-md px-3 py-1.5 text-sm text-ink-dim hover:text-ink transition-colors"
              }
            >
              {item.label}
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <LiveIndicator connected />
        <Avatar initials={self.initials} online size="sm" title={self.name} />
      </div>
    </header>
  );
}
