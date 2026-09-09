"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { EllipsisVertical, LogOut, MapPin, Sun } from "lucide-react";
import type { ElementType, ReactNode } from "react";

import { Avatar } from "@/components/shared/avatar";
import { Logo } from "@/components/shared/logo";
import { NotificationBell } from "@/components/shared/notification-bell";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import type { NotificationScope } from "@/lib/api/notifications-api";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

export type NavItem = { label: string; href: string; icon: ElementType };

type RoleShellProps = {
  roleLabel: string;
  navItems: NavItem[];
  homeHref: string;
  /** Which API prefix the bell reads from. Omit to hide the bell. */
  notificationScope?: NotificationScope;
  children: ReactNode;
};

export function RoleShell({
  roleLabel,
  navItems,
  homeHref,
  notificationScope,
  children,
}: RoleShellProps) {
  const pathname = usePathname();
  const { currentUser, logout } = useAuth();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const primaryTabs = navItems.slice(0, 3);
  const overflowTabs = navItems.slice(3);

  return (
    // Theme classes are on <html> (see ThemeProvider) so portalled popups
    // inherit them; the shell only paints its own surface.
    <div className="bg-background text-foreground flex min-h-screen">
      <aside className="border-border bg-card/60 sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r px-4 py-6 lg:flex">
        <Link href={homeHref} className="flex items-center gap-2 px-2 font-medium tracking-tight">
          <Logo className="size-8" px={32} />
          BulanTanom
        </Link>

        <nav className="mt-6 flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_0_14px_-2px_var(--primary)]"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    !active && "group-hover:text-primary",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-border mt-auto flex flex-col gap-3 border-t px-2 pt-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={currentUser?.name ?? "?"} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{currentUser?.name}</p>
              <p className="text-muted-foreground text-xs">{roleLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            <LogOut className="size-3.5" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/80 sticky top-0 z-10 flex items-center gap-4 border-b px-6 py-2.5 text-sm backdrop-blur-md">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            Layuan Farm
          </span>
          <span className="text-muted-foreground hidden items-center gap-1.5 sm:flex">
            <Sun className="size-3.5" />
            28°C · Partly sunny
          </span>
          <div className="ml-auto flex items-center gap-2">
            {/* Admin has no notification events of its own, so the bell is
                rendered only for the roles that actually receive them. */}
            {notificationScope && <NotificationBell scope={notificationScope} />}
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-8">{children}</main>

        <nav className="border-border bg-card/80 fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t px-2 py-2 backdrop-blur-md lg:hidden">
          {primaryTabs.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}

          {overflowTabs.length > 0 && (
            <MenuPrimitive.Root>
              <MenuPrimitive.Trigger className="text-muted-foreground flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[11px] font-medium">
                <EllipsisVertical className="size-5" />
                More
              </MenuPrimitive.Trigger>
              <MenuPrimitive.Portal>
                <MenuPrimitive.Positioner side="top" align="end" sideOffset={8}>
                  <MenuPrimitive.Popup className="bg-popover text-popover-foreground border-border min-w-40 rounded-lg border p-1 shadow-md">
                    {overflowTabs.map((item) => {
                      const Icon = item.icon;
                      return (
                        <MenuPrimitive.LinkItem
                          key={item.href}
                          closeOnClick
                          render={<Link href={item.href} />}
                          className="hover:bg-accent flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none"
                        >
                          <Icon className="size-4" />
                          {item.label}
                        </MenuPrimitive.LinkItem>
                      );
                    })}
                    <div className="bg-border my-1 h-px" />
                    <MenuPrimitive.Item
                      onClick={logout}
                      className="hover:bg-accent flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none"
                    >
                      <LogOut className="size-4" />
                      Log out
                    </MenuPrimitive.Item>
                  </MenuPrimitive.Popup>
                </MenuPrimitive.Positioner>
              </MenuPrimitive.Portal>
            </MenuPrimitive.Root>
          )}
        </nav>
      </div>
    </div>
  );
}
