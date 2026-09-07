import * as LucideIcons from "lucide-react";
import { LucideProps } from "lucide-react";
import { ComponentType, useEffect, useMemo, useRef, useState } from "react";

export type MenuItem = {
  id: number;
  label: string;
  icon: string | null;
  path: string;
  children: MenuItem[];
};

type SidebarProps = {
  menus: MenuItem[];
  currentRoute: string;
  onNavigate: (path: string) => void;
  onOpenPreferences: () => void;
  user: {
    fullName: string;
    email: string;
    roleName: string;
  };
  avatarUrl: string;
  onLogout: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
};

const toPascalCase = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");

const resolveIcon = (iconName: string | null) => {
  const key = toPascalCase(iconName ?? "circle");
  const iconLibrary = LucideIcons as unknown as Record<string, ComponentType<LucideProps>>;
  return iconLibrary[key] ?? LucideIcons.Circle;
};

export const Sidebar = ({ menus, currentRoute, onNavigate, onOpenPreferences, user, avatarUrl, onLogout, onCollapsedChange }: SidebarProps) => {
  const [collapsed, setCollapsedState] = useState(false);
  const setCollapsed = (v: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      if (next !== prev) onCollapsedChange?.(next);
      return next;
    });
  };
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredMenu, setHoveredMenu] = useState<number | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);

  const activeMenuPath = useMemo(() => {
    for (const menu of menus) {
      if (currentRoute === menu.path) return menu.path;
      for (const child of menu.children) {
        if (currentRoute === child.path || currentRoute.startsWith(`${child.path}/`)) return menu.path;
      }
      if (currentRoute.startsWith(menu.path)) return menu.path;
    }
    return "";
  }, [menus, currentRoute]);

  // Auto-expand parent of current route
  useEffect(() => {
    for (const menu of menus) {
      const isParentOfActive = menu.children.some(
        (child) => currentRoute === child.path || currentRoute.startsWith(`${child.path}/`)
      );
      if (isParentOfActive && !expandedMenus.has(menu.id)) {
        setExpandedMenus((prev) => new Set(prev).add(menu.id));
      }
    }
  }, [currentRoute, menus]);

  const toggleMenu = (menuId: number) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  };

  const userInitials = user.fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const pageTitle = useMemo(() => {
    for (const menu of menus) {
      if (currentRoute === menu.path) return menu.label;
      for (const child of menu.children) {
        if (currentRoute === child.path || currentRoute.startsWith(`${child.path}/`)) return child.label;
      }
    }
    return "Dashboard";
  }, [menus, currentRoute]);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-5 py-5 ${collapsed ? "justify-center px-3" : ""}`}>
        <button
          type="button"
          onClick={() => onNavigate("/dashboard")}
          className="flex items-center gap-3 group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-glow">
            <LucideIcons.Box size={18} />
          </div>
          {!collapsed && (
            <span className="font-display text-lg font-bold text-on-surface tracking-tight">
              AssetCore
            </span>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 px-3 py-2 ${collapsed ? "overflow-visible" : "overflow-y-auto"}`}>
        <ul className="space-y-1">
          {menus.map((menu) => {
            const Icon = resolveIcon(menu.icon);
            const hasChildren = menu.children.length > 0;
            const isExpanded = expandedMenus.has(menu.id);
            const isActive = activeMenuPath === menu.path;
            const isHovered = hoveredMenu === menu.id;

            return (
              <li
                key={menu.id}
                className="relative"
                onMouseEnter={() => {
                  if (collapsed && hasChildren) {
                    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                    setHoveredMenu(menu.id);
                  }
                }}
                onMouseLeave={() => {
                  if (collapsed && hasChildren) {
                    hoverTimeout.current = setTimeout(() => setHoveredMenu(null), 150);
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!hasChildren) {
                      onNavigate(menu.path);
                      setMobileOpen(false);
                      return;
                    }
                    if (collapsed) {
                      // In collapsed mode navigate to first child
                      if (menu.children[0]) {
                        onNavigate(menu.children[0].path);
                      }
                      return;
                    }
                    toggleMenu(menu.id);
                  }}
                  title={collapsed ? menu.label : undefined}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150
                    ${
                      isActive
                        ? "bg-primary-container text-on-primary-container"
                        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    }
                    ${collapsed ? "justify-center" : ""}
                  `}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 transition-colors ${
                      isActive
                        ? "text-primary"
                        : "text-on-surface-variant/70 group-hover:text-on-surface-variant"
                    }`}
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate text-left">{menu.label}</span>
                      {hasChildren && (
                        <LucideIcons.ChevronDown
                          size={14}
                          className={`shrink-0 text-on-surface-variant transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </>
                  )}
                </button>

                {/* Children submenu - expanded mode */}
                {hasChildren && isExpanded && !collapsed && (
                  <ul className="mt-1 ml-4 space-y-0.5 border-l-2 border-outline-variant pl-3 animate-fade-in">
                    {menu.children.map((child) => {
                      const ChildIcon = resolveIcon(child.icon);
                      const siblingPaths = menu.children.filter((s) => s.id !== child.id).map((s) => s.path);
                      const isChildActive =
                        currentRoute === child.path || (currentRoute.startsWith(`${child.path}/`) && !siblingPaths.some((sp) => currentRoute === sp || currentRoute.startsWith(`${sp}/`)));

                      return (
                        <li key={child.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onNavigate(child.path);
                              setMobileOpen(false);
                            }}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all duration-150
                              ${
                                isChildActive
                                  ? "bg-primary-container font-medium text-on-primary-container"
                                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                              }
                            `}
                          >
                            <ChildIcon size={15} className={isChildActive ? "text-primary" : "text-on-surface-variant/70"} />
                            <span className="truncate">{child.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Flyout popover - collapsed mode */}
                {collapsed && hasChildren && isHovered && (
                  <div
                    className="absolute left-full top-0 z-50 ml-2 min-w-[180px] rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevation-3 animate-fade-in"
                    onMouseEnter={() => {
                      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                      setHoveredMenu(menu.id);
                    }}
                    onMouseLeave={() => {
                      hoverTimeout.current = setTimeout(() => setHoveredMenu(null), 150);
                    }}
                  >
                    <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      {menu.label}
                    </p>
                    <ul className="py-1 px-1.5">
                      {menu.children.map((child) => {
                        const ChildIcon = resolveIcon(child.icon);
                        const siblingPaths = menu.children.filter((s) => s.id !== child.id).map((s) => s.path);
                        const isChildActive =
                          currentRoute === child.path || (currentRoute.startsWith(`${child.path}/`) && !siblingPaths.some((sp) => currentRoute === sp || currentRoute.startsWith(`${sp}/`)));
                        return (
                          <li key={child.id}>
                            <button
                              type="button"
                              onClick={() => {
                                onNavigate(child.path);
                                setHoveredMenu(null);
                              }}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all duration-150
                                ${
                                  isChildActive
                                    ? "bg-primary-container font-medium text-on-primary-container"
                                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                                }
                              `}
                            >
                              <ChildIcon size={15} className={isChildActive ? "text-primary" : "text-on-surface-variant/70"} />
                              <span className="truncate">{child.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section at bottom */}
      <div className="border-t border-outline-variant p-3">
        <button
          type="button"
          onClick={onOpenPreferences}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-container-high ${collapsed ? "justify-center" : ""}`}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-surface-container-lowest" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[11px] font-bold text-white">
              {userInitials || "U"}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-on-surface">{user.fullName}</p>
              <p className="truncate text-[11px] text-on-surface-variant">{user.roleName}</p>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={onLogout}
          className={`mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-500 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 ${collapsed ? "justify-center" : ""}`}
        >
          <LucideIcons.LogOut size={15} />
          {!collapsed && <span>Cerrar sesion</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-outline-variant bg-surface-container-lowest transition-all duration-300 lg:flex ${
          collapsed ? "w-[68px] overflow-visible" : "w-64"
        }`}
      >
        {sidebarContent}

        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="absolute -right-3 top-8 flex h-6 w-6 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-sm hover:text-on-surface transition focus-ring"
        >
          {collapsed ? <LucideIcons.ChevronRight size={12} /> : <LucideIcons.ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Top bar (mobile + breadcrumb) */}
      <header
        className={`sticky top-0 z-30 border-b border-outline-variant bg-surface-container-lowest/80 backdrop-blur-lg transition-all duration-300 ${
          collapsed ? "lg:pl-[68px]" : "lg:pl-64"
        }`}
      >
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface lg:hidden focus-ring"
          >
            <LucideIcons.Menu size={20} />
          </button>

          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-on-surface">{pageTitle}</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenPreferences}
              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-surface-container-high transition lg:hidden focus-ring"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[10px] font-bold text-white">
                  {userInitials}
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden animate-fade-in">
          <div className="absolute inset-0 bg-scrim/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface-container-lowest shadow-elevation-3 animate-slide-in">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
