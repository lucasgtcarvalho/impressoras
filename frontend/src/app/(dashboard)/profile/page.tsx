"use client";

import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils";

function roleLabel(role: string) {
  const map: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Tecnico",
    client_manager: "Cliente",
    operator: "Operador",
  };
  return map[role] || role;
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Perfil</h1>
      </div>

      <div className="card-shadow p-6 space-y-4">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-xl font-bold text-blue-600">
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{user.name}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-gray-500">Nome</span>
            <p className="text-sm font-medium">{user.name}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">E-mail</span>
            <p className="text-sm font-medium">{user.email}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Permissao</span>
            <p className="text-sm font-medium">{roleLabel(user.role)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Ultimo Login</span>
            <p className="text-sm font-medium">
              {user.lastLoginAt ? formatDate(user.lastLoginAt) : "-"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
