"use client";

import { useState, useEffect } from "react";
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
  Moon,
  Sun,
  LogOut,
  UserCog,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Impressoras", href: "/printers", icon: Printer },
  { label: "Clientes", href: "/clients", icon: Users },
  { label: "Alertas", href: "/alerts", icon: Bell },
  { label: "Relatorios", href: "/reports", icon: BarChart3 },
];

function roleLabel(role: string) {
  const map: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Tecnico",
    client_manager: "Cliente",
    operator: "Cliente",
  };
  return map[role] || role;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [search, setSearch] = useState("");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem("theme") === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  const filteredItems = navItems.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  return (
    <aside className="w-64 bg-white dark:bg-[#111827] border-r border-gray-100 dark:border-gray-800 h-screen flex flex-col">
      <div className="px-0.5 py-2 border-b border-gray-100 dark:border-gray-800">
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
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1E293B] hover:text-gray-700 dark:hover:text-gray-200"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 flex-shrink-0",
                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-400 dark:text-gray-500"
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
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1E293B] hover:text-gray-700 dark:hover:text-gray-200"
            )}
          >
            <UserCog
              className={cn(
                "w-5 h-5 flex-shrink-0",
                pathname.startsWith("/users")
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-400 dark:text-gray-500"
              )}
            />
            <span>Usuarios</span>
          </Link>
        )}
      </nav>

      <div className="border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1E293B] hover:text-gray-700 dark:hover:text-gray-200 transition-all duration-200"
        >
          {dark ? (
            <Sun className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          ) : (
            <Moon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          )}
          <span>{dark ? "Tema claro" : "Tema escuro"}</span>
        </button>

        <div className="px-3 py-3">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1E293B] transition-all duration-200 group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                {user?.name || "Usuario"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {roleLabel(user?.role)}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
