"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListIcon, XIcon } from "@phosphor-icons/react";
import { Avatar } from "@/components/dashboard/Avatar";
import { LiveIndicator } from "@/components/dashboard/LiveIndicator";
import type { User } from "@/types";
import { PATHS } from "@/utils/paths";

const navItems = [
  { label: "Dashboard", href: PATHS.DASHBOARD },
  { label: "Tickets", href: PATHS.TICKETS },
  { label: "Incidents", href: PATHS.INCIDENTS },
  { label: "Services", href: PATHS.SERVICES },
  { label: "Activity", href: PATHS.ACTIVITY },
];

export function TopBar({ orgName, self }: { orgName: string; self: User }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const activeLabel =
    navItems.find((item) => isActive(item.href))?.label ?? "Menu";

  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-6">
        <div className="flex shrink-0 items-center gap-2">
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
          <span className="hidden text-sm font-medium text-ink sm:inline">
            {orgName}
          </span>
        </div>

        {/* Tablet and up: room for all five tabs side by side. */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "rounded-md px-3 py-1.5 text-sm font-medium text-ink bg-panel-raised"
                    : "rounded-md px-3 py-1.5 text-sm text-ink-dim hover:text-ink transition-colors"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Phone: one button naming the page you're on. Tap it to see the
            other four — nothing to scroll to find, nothing squeezed. */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label="Open navigation menu"
          className="flex items-center gap-1.5 rounded-md bg-panel-raised px-2.5 py-1.5 text-sm font-medium text-ink md:hidden"
        >
          {menuOpen ? (
            <XIcon size={14} weight="bold" />
          ) : (
            <ListIcon size={14} weight="bold" />
          )}
          {activeLabel}
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <LiveIndicator connected />
        <Avatar
          initials={self.initials}
          seed={self.id}
          online
          size="sm"
          title={self.name}
        />
      </div>

      {menuOpen && (
        <>
          {/* Invisible tap-outside-to-close catcher, not a page-darkening
              overlay — this is a small menu, not a full mobile drawer. */}
          <div
            className="fixed inset-0 z-10 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute left-3 top-full z-20 mt-1.5 flex w-44 flex-col gap-0.5 rounded-lg border border-line bg-panel-raised p-1 shadow-lg md:hidden">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={
                    active
                      ? "rounded-md bg-panel px-3 py-2 text-left text-sm font-medium text-ink"
                      : "rounded-md px-3 py-2 text-left text-sm text-ink-dim hover:text-ink"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </header>
  );
}
