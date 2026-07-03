"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import {
  LayoutDashboard,
  Printer,
  Users,
  Bell,
  BarChart3,
  Search,
  LogOut,
  UserCog,
} from "lucide-react";

function roleLabel(role: string) {
  const map: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Tecnico",
    client_manager: "Cliente",
  };
  return map[role] || role;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [search, setSearch] = useState("");
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const isClientUser = user?.role === "client_manager" || user?.role === "operator";
  const clientId = user?.clientLinks?.[0]?.client?.id || user?.clientIds?.[0];
  const dashboardHref = isClientUser && clientId ? `/clients/${clientId}` : "/dashboard";

  const allItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, dynamicHref: true },
    { label: "Impressoras", href: "/printers", icon: Printer, clientFilter: true },
    { label: "Clientes", href: "/clients", icon: Users, adminOnly: true },
    { label: "Alertas", href: "/alerts", icon: Bell, clientFilter: true },
    { label: "Relatorios", href: "/reports", icon: BarChart3 },
  ];

  const navItems = allItems.filter((item: any) => !item.adminOnly || isAdmin);

  const filteredItems = navItems.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  const resolveHref = (item: typeof allItems[0]) => {
    if (item.label === "Dashboard" && item.dynamicHref) return dashboardHref;
    if (isClientUser && clientId && item.clientFilter) {
      if (item.href === "/printers") return `/printers?clientId=${clientId}`;
      if (item.href === "/alerts") return `/alerts?clientId=${clientId}`;
    }
    return item.href;
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-100 h-screen flex flex-col">
      <div className="px-0.5 py-2 border-b border-gray-100">
        <Link href="/dashboard" className="flex justify-center">
          <img src="/logo.png" alt="CloudSpool" className="h-48 w-auto" />
        </Link>
      </div>

      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {filteredItems.map((item) => {
          const href = resolveHref(item);
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href)) ||
            (item.label === "Dashboard" && isClientUser && pathname.startsWith("/clients/"));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 flex-shrink-0",
                  isActive
                    ? "text-blue-600"
                    : "text-gray-400"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/users"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              pathname.startsWith("/users")
                ? "bg-blue-50 text-blue-700"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            )}
          >
            <UserCog
              className={cn(
                "w-5 h-5 flex-shrink-0",
                pathname.startsWith("/users")
                  ? "text-blue-600"
                  : "text-gray-400"
              )}
            />
            <span>Usuarios</span>
          </Link>
        )}
      </nav>

      <div className="border-t border-gray-100">
        <div className="px-3 py-3">
          <Link href="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-all duration-200 group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">
                {user?.name || "Usuario"}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {roleLabel(user?.role)}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>
    </aside>
  );
}
