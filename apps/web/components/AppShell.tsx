"use client";

import { Img } from "@/components/Img";
import React, { useEffect, useState } from "react";
import Link from "next/navigation";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector, useAppDispatch } from "../store";
import { useLogoutMutation, useGetMeQuery, useGetMyCoursesQuery } from "../store/apiSlice";
import { logoutAction } from "../store/authSlice";
import { isAuthPage, rolesFor, type Role } from "../store/routeAccess";

interface AppShellProps {
  children: React.ReactNode;
  activeNav?: string;
}

export function AppShell({ children, activeNav }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutTrigger] = useLogoutMutation();

  // Try fetching current user on mount if authenticated
  useGetMeQuery(undefined, { skip: !isAuthenticated && !user });
  const { data: myCourses } = useGetMyCoursesQuery(undefined, { skip: !user });

  // Second layer behind proxy.ts: once the user is known, leave pages this role may not open.
  useEffect(() => {
    const allowed = rolesFor(pathname);
    if (user && allowed && !allowed.includes(user.role as Role)) router.replace("/");
    if (user && isAuthPage(pathname)) router.replace(new URLSearchParams(window.location.search).get("next") || "/");
  }, [user, pathname, router]);

  const handleLogout = async () => {
    try {
      await logoutTrigger().unwrap();
    } catch {}
    dispatch(logoutAction());
    router.push("/login");
  };

  // Calendar / To-do / Archived / Settings have no pages in the spec's route list, so they are not linked.
  const navItems = [
    { label: "Home", href: "/", icon: "home" },
    { label: "Live", href: "/live", icon: "videocam" },
    ...(user?.role === "instructor" || user?.role === "admin" ? [{ label: "Teach", href: "/instructor/courses", icon: "school" }] : []),
    ...(user?.role === "admin" ? [{ label: "Admin", href: "/admin", icon: "admin_panel_settings" }] : []),
  ];

  const secondaryNavItems = [{ label: "Certificates", href: "/certificates", icon: "verified" }];

  // Full-screen routes render without the shell: live room (dark stage) and auth pages.
  if (/^\/live\/[^/]+/.test(pathname ?? "") || pathname === "/login" || pathname === "/register") {
    return <>{children}</>;
  }

  return (
    <div className="bg-canvas min-h-screen text-ink flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-card focus:text-primary focus:px-4 focus:py-2 focus:rounded-full">Skip to content</a>
      {/* Desktop Left Rail Sidebar (280px) */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-[280px] bg-card z-50 flex-col shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-border">
        {/* Brand Header */}
        <div className="h-16 px-space-md flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <button
              className="p-space-xs text-ink-secondary hover:text-ink hover:bg-canvas rounded-lg transition-colors"
              type="button"
              aria-label="Toggle menu"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <NextLink href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg">
                <Img name="logo" alt="" className="w-full h-full object-cover rounded-[inherit]" fallback={<>L</>} />
              </div>
              <span className="font-headline-md text-headline-md text-primary tracking-tight font-bold">
                Learnly
              </span>
            </NextLink>
          </div>
        </div>

        {/* Navigation scroll area */}
        <div className="flex-1 overflow-y-auto px-space-sm py-space-sm flex flex-col justify-between gap-space-md">
          <div className="flex flex-col gap-space-sm">
            <nav aria-label="Primary" className="flex flex-col gap-space-xs">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <NextLink
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-full transition-colors font-label-md text-label-md ${
                      isActive
                        ? "bg-primary text-white font-semibold"
                        : "text-ink-secondary hover:bg-canvas hover:text-ink"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </NextLink>
                );
              })}
            </nav>

            {/* Enrolled Courses Quicklinks */}
            <div className="pt-space-sm">
              <div className="flex items-center justify-between px-space-md py-space-xs cursor-pointer group">
                <span className="font-label-sm text-label-sm text-ink-secondary uppercase tracking-wider font-semibold group-hover:text-ink">
                  Enrolled
                </span>
                <span className="material-symbols-outlined text-[18px] text-ink-secondary group-hover:text-ink">
                  expand_more
                </span>
              </div>
              <div className="mt-space-xs flex flex-col gap-space-xs">
                {(myCourses?.enrolments ?? []).slice(0, 6).map((e) => (
                  <NextLink
                    key={e.course.id}
                    href={`/courses/${e.course.id}`}
                    className="flex items-center gap-space-sm px-space-md py-space-sm rounded-xl text-ink-secondary hover:bg-canvas hover:text-ink transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-chip-done-bg text-chip-done-fg flex items-center justify-center font-label-md text-label-md font-bold shrink-0">
                      {e.course.code?.[0] ?? "C"}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-md text-label-md truncate text-ink font-medium">{e.course.title}</span>
                      <span className="font-caption text-caption text-ink-secondary truncate">{e.course.term}</span>
                    </div>
                  </NextLink>
                ))}
              </div>
            </div>
          </div>

          {/* Secondary Footer Nav */}
          <nav aria-label="Secondary" className="flex flex-col gap-space-xs pt-space-md border-t border-border">
            {secondaryNavItems.map((item) => (
              <NextLink
                key={item.href}
                href={item.href}
                className="flex items-center gap-space-sm px-space-md py-space-sm rounded-full text-ink-secondary hover:bg-canvas hover:text-ink transition-colors font-label-md text-label-md"
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span>{item.label}</span>
              </NextLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content Area (offset by 280px on desktop) */}
      <div className="md:pl-[280px] flex-1 flex flex-col min-h-screen pb-16 md:pb-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 h-16 bg-card/80 backdrop-blur-xl border-b border-border z-40 px-margin-sm md:px-margin flex items-center justify-between">
          {/* Search bar */}
          <div className="flex items-center gap-space-md flex-1 max-w-md">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-space-sm top-1/2 -translate-y-1/2 text-ink-secondary text-[20px]">
                search
              </span>
              <input
                aria-label="Search courses, lessons and topics"
                className="w-full pl-10 pr-space-md py-space-xs bg-canvas rounded-full font-body-md text-body-md text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary transition-all"
                placeholder="Search courses, lessons, topics..."
                type="text"
              />
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-space-sm md:gap-space-md">
            <NextLink
              href={user?.role === "instructor" || user?.role === "admin" ? "/instructor/courses?new=1" : user ? "/live" : "/login"}
              className="hidden sm:inline-flex items-center gap-space-xs px-space-md py-space-xs bg-primary text-white rounded-full font-label-md text-label-md hover:bg-primary-hover transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Create or Join</span>
            </NextLink>

            <button
              className="p-space-xs text-ink-secondary hover:text-ink hover:bg-canvas rounded-full transition-colors relative"
              type="button"
              aria-label="Notifications"
            >
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger ring-2 ring-card"></span>
            </button>

            {/* User Profile / Menu */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-space-sm pl-space-xs cursor-pointer focus:outline-none"
                  type="button"
                >
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm ring-2 ring-primary/20">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-card rounded-xl shadow-overlay border border-border py-2 z-50">
                    <div className="px-4 py-2 border-b border-border">
                      <p className="font-label-md text-ink truncate">{user.name}</p>
                      <p className="font-caption text-ink-secondary truncate">{user.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-caption text-caption capitalize">
                        {user.role}
                      </span>
                    </div>
                    {user.role === "instructor" && (
                      <NextLink
                        href="/instructor/courses"
                        className="block px-4 py-2 text-body-md hover:bg-canvas text-ink"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Instructor Studio
                      </NextLink>
                    )}
                    {user.role === "admin" && (
                      <NextLink
                        href="/admin/users"
                        className="block px-4 py-2 text-body-md hover:bg-canvas text-ink"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Admin Dashboard
                      </NextLink>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-body-md text-danger hover:bg-canvas"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <NextLink
                  href="/login"
                  className="px-space-md py-space-xs text-primary font-label-md hover:underline"
                >
                  Log in
                </NextLink>
                <NextLink
                  href="/register"
                  className="px-space-md py-space-xs bg-primary text-white rounded-full font-label-md text-label-md hover:bg-primary-hover shadow-sm"
                >
                  Sign up
                </NextLink>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main id="main" className="flex-1 w-full">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar (< 768px) matching B1 Mobile Mockup */}
      <nav aria-label="Mobile" className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around z-50 px-2 shadow-lg">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <NextLink
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 gap-0.5 text-xs font-medium transition-colors ${
                isActive ? "text-primary font-bold" : "text-ink-secondary hover:text-ink"
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              <span>{item.label}</span>
            </NextLink>
          );
        })}
        <NextLink
          href="/certificates"
          className={`flex flex-col items-center justify-center flex-1 py-1 gap-0.5 text-xs font-medium transition-colors ${
            pathname === "/certificates" ? "text-primary font-bold" : "text-ink-secondary hover:text-ink"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">verified</span>
          <span>Certificates</span>
        </NextLink>
      </nav>
    </div>
  );
}
