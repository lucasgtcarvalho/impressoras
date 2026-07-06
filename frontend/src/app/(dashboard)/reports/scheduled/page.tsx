"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface ScheduledReport {
  id: string;
  name: string;
  email: string;
  dayOfMonth: number;
  hour: number;
  minute: number;
  isActive: boolean;
  lastRunAt: string | null;
  client: { id: string; name: string };
}

export default function ScheduledReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editReport, setEditReport] = useState<ScheduledReport | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    clientId: "",
    name: "",
    email: "",
    dayOfMonth: 1,
    hour: 8,
    minute: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rRes, cRes] = await Promise.all([
        api.get("/scheduled-reports"),
        api.get("/clients?limit=200"),
      ]);
      setReports(rRes.data || []);
      setClients(cRes.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditReport(null);
    setForm({ clientId: "", name: "", email: "", dayOfMonth: 1, hour: 8, minute: 0 });
    setShowModal(true);
  };

  const openEdit = (r: ScheduledReport) => {
    setEditReport(r);
    setForm({
      clientId: r.client.id,
      name: r.name,
      email: r.email,
      dayOfMonth: r.dayOfMonth,
      hour: r.hour,
      minute: r.minute,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editReport) {
        await api.put(`/scheduled-reports/${editReport.id}`, {
          name: form.name,
          email: form.email,
          dayOfMonth: form.dayOfMonth,
          hour: form.hour,
          minute: form.minute,
        });
      } else {
        await api.post("/scheduled-reports", form);
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: ScheduledReport) => {
    if (!confirm(`Excluir agendamento "${r.name}"?`)) return;
    await api.delete(`/scheduled-reports/${r.id}`);
    loadData();
  };

  const handleToggle = async (r: ScheduledReport) => {
    await api.put(`/scheduled-reports/${r.id}`, { isActive: !r.isActive });
    loadData();
  };

  const padTime = (n: number) => n.toString().padStart(2, "0");

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatorios Agendados</h1>
          <p className="text-sm text-gray-500 mt-1">Envio automatico mensal de contadores por email em XML e PDF</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Novo Agendamento
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Nenhum relatorio agendado</p>
        </div>
      ) : (
        <div className="card-shadow overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Nome</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Dia</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Horario</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Ultimo Envio</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">Dia {r.dayOfMonth}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{padTime(r.hour)}:{padTime(r.minute)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {r.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{r.lastRunAt ? new Date(r.lastRunAt).toLocaleString("pt-BR") : "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(r)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">Editar</button>
                      <button onClick={() => handleToggle(r)} className={`px-2 py-1 text-xs rounded ${r.isActive ? "text-yellow-600 hover:bg-yellow-50" : "text-green-600 hover:bg-green-50"}`}>
                        {r.isActive ? "Pausar" : "Ativar"}
                      </button>
                      <button onClick={() => handleDelete(r)} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">{editReport ? "Editar Agendamento" : "Novo Agendamento"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cliente *</label>
                <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} disabled={!!editReport}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md disabled:bg-gray-100">
                  <option value="">Selecione...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nome do Relatorio *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Emails de Destino (separados por virgula) *</label>
                <input type="text" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email1@empresa.com, email2@empresa.com"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dia do Mes (1-28)</label>
                  <input type="number" min={1} max={28} value={form.dayOfMonth}
                    onChange={(e) => setForm({ ...form, dayOfMonth: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hora (0-23)</label>
                  <input type="number" min={0} max={23} value={form.hour}
                    onChange={(e) => setForm({ ...form, hour: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Minuto (0-59)</label>
                  <input type="number" min={0} max={59} value={form.minute}
                    onChange={(e) => setForm({ ...form, minute: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md" />
                </div>
              </div>
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
    </div>
  );
}
