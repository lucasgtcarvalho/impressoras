"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils";
import api from "@/lib/api";

function roleLabel(role: string) {
  const map: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Tecnico",
    client_manager: "Cliente",
  };
  return map[role] || role;
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!user) return null;

  const handleChangePassword = async () => {
    setMessage(null);

    if (!currentPassword || !newPassword) {
      setMessage({ type: "error", text: "Preencha todos os campos" });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Nova senha deve ter no minimo 6 caracteres" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "As senhas nao coincidem" });
      return;
    }

    setSaving(true);
    try {
      await api.put("/auth/me/password", { currentPassword, newPassword });
      setMessage({ type: "success", text: "Senha alterada com sucesso!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Erro ao alterar senha",
      });
    } finally {
      setSaving(false);
    }
  };

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

      <div className="card-shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">Alterar Senha</h2>

        {message && (
          <div
            className={`text-sm px-4 py-2 rounded-md ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Senha Atual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nova Senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
              placeholder="Minimo 6 caracteres"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Confirmar Nova Senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleChangePassword}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Alterar Senha"}
          </button>
        </div>
      </div>
    </div>
  );
}
