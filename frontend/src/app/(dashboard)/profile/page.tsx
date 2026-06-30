"use client";

import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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
            <span className="text-xs text-gray-500">Permissão</span>
            <p className="text-sm font-medium capitalize">
              {user.role?.replace("_", " ")}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Último Login</span>
            <p className="text-sm font-medium">
              {user.lastLoginAt ? formatDate(user.lastLoginAt) : "-"}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <button
            onClick={logout}
            className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50"
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
