"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  clientLinks?: { client: { id: string; name: string } }[];
}

interface Client {
  id: string;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pwdUserId, setPwdUserId] = useState("");
  const [pwdName, setPwdName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "operator",
    clientId: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, cRes] = await Promise.all([
        api.get("/users?limit=100"),
        api.get("/clients?limit=200"),
      ]);
      setUsers(uRes.data.data || []);
      setClients(cRes.data.data || []);
    } finally { setLoading(false); }
  };

  const roleOptions = [
    { value: "super_admin", label: "Super Admin" },
    { value: "admin", label: "Tecnico (acesso a todos clientes)" },
    { value: "client_manager", label: "Cliente (vinculado a cliente especifico)" },
  ];

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: "bg-purple-100 text-purple-700",
      admin: "bg-blue-100 text-blue-700",
      client_manager: "bg-green-100 text-green-700",
    };
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      admin: "Tecnico",
      client_manager: "Cliente",
    };
    return { color: colors[role] || "bg-gray-100", label: labels[role] || role };
  };

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: "", email: "", password: "", role: "operator", clientId: "" });
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, clientId: "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editUser) {
        const body: any = { name: form.name, role: form.role };
        if (form.password) body.password = form.password;
        await api.put(`/users/${editUser.id}`, body);
      } else {
        const body: any = { name: form.name, email: form.email, password: form.password, role: form.role };
        if (form.clientId) body.clientIds = [form.clientId];
        await api.post("/users", body);
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (u: User) => {
    if (!confirm(`${u.isActive ? "Desativar" : "Ativar"} usuario ${u.name}?`)) return;
    await api.put(`/users/${u.id}`, { isActive: !u.isActive });
    loadData();
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) { alert("Senha deve ter no minimo 6 caracteres"); return; }
    await api.put(`/users/${pwdUserId}`, { password: newPassword });
    setShowPassword(false);
    setNewPassword("");
    alert("Senha alterada");
  };

  const isClientRole = (role: string) => role === "client_manager";

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">Gerenciamento de usuarios do sistema</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Novo Usuario
        </button>
      </div>

      <div className="card-shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Permissao</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ultimo Login</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const rb = roleBadge(u.role);
              return (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${rb.color}`}>{rb.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {u.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">Editar</button>
                      <button onClick={() => { setPwdUserId(u.id); setPwdName(u.name); setShowPassword(true); }} className="px-2 py-1 text-xs text-yellow-600 hover:bg-yellow-50 rounded">Senha</button>
                      <button onClick={() => handleToggleActive(u)} className={`px-2 py-1 text-xs rounded ${u.isActive ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}>
                        {u.isActive ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhum usuario encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">{editUser ? "Editar Usuario" : "Novo Usuario"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nome</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md" />
              </div>
              {!editUser && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email (login)</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md" />
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">{editUser ? "Nova Senha (deixe em branco para manter)" : "Senha"}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md" placeholder={editUser ? "••••••" : "minimo 6 caracteres"} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Permissao</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md">
                  {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {!editUser && isClientRole(form.role) && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cliente vinculado</label>
                  <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md">
                    <option value="">Selecione...</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-1">Alterar Senha</h2>
            <p className="text-sm text-gray-500 mb-4">{pwdName}</p>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md" placeholder="Nova senha (min 6)" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowPassword(false); setNewPassword(""); }} className="px-4 py-2 text-sm border border-gray-200 rounded-md">Cancelar</button>
              <button onClick={handleChangePassword} className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700">Alterar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
