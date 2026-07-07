"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { formatNumber, formatDate } from "@/lib/utils";

export default function ClientDetailPage() {
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const [client, setClient] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [printers, setPrinters] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientRes, statsRes, printersRes, alertsRes] = await Promise.all([
        api.get(`/clients/${id}`),
        api.get(`/clients/${id}/stats`),
        api.get(`/printers?clientId=${id}&limit=5`),
        api.get("/alerts", { params: { clientId: id, status: "open", limit: 10 } }),
      ]);
      setClient(clientRes.data);
      setStats(statsRes.data);
      setPrinters(printersRes.data.data || []);
      setAlerts(alertsRes.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAgent = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/clients/${id}/agent-download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      const safeName = client.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9\u00C0-\u024F-]/g, "");
      link.href = url;
      link.setAttribute("download", `PrintMonitor-Agent-${safeName}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Erro ao baixar o agente. Verifique se os arquivos estao disponiveis no servidor.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!client) return <p>Cliente nao encontrado</p>;

  const cards = [
    { label: "Impressoras", value: stats?.totalPrinters || 0 },
    { label: "Online", value: stats?.onlinePrinters || 0, color: "text-green-600" },
    { label: "Offline", value: stats?.offlinePrinters || 0, color: "text-red-600" },
    { label: "Alertas", value: stats?.openAlerts || 0 },
    { label: "Agentes", value: stats?.activeAgents || 0 },
  ];

  const severityBadge = (s: string) => {
    if (s === "critical") return "px-1.5 py-0.5 text-xs font-medium rounded text-red-700 bg-red-50 shrink-0";
    if (s === "warning") return "px-1.5 py-0.5 text-xs font-medium rounded text-yellow-700 bg-yellow-50 shrink-0";
    return "px-1.5 py-0.5 text-xs font-medium rounded text-blue-700 bg-blue-50 shrink-0";
  };

  const severityLabel = (s: string) => {
    if (s === "critical") return "CRIT";
    if (s === "warning") return "AVISO";
    return "INFO";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {client.document && `${client.document} · `}
            {client.email}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Link
                href={`/clients/${id}/edit`}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Editar
              </Link>
              <Link
                href={`/clients/${id}/settings`}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Configuracoes
              </Link>
            </>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">Codigo de Ativacao</p>
            <p className="text-lg font-mono text-blue-900 mt-1">
              {client.activationCode}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                navigator.clipboard.writeText(client.activationCode)
              }
              className="text-sm px-3 py-1.5 border border-blue-300 rounded-md text-blue-700 hover:bg-blue-100"
            >
              Copiar
            </button>
            <button
              onClick={handleDownloadAgent}
              disabled={downloading}
              className="text-sm px-3 py-1.5 bg-blue-600 rounded-md text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {downloading ? "Baixando..." : "Download Agente"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card-shadow p-4">
            <span className="text-sm text-gray-500">{card.label}</span>
            <p className={`text-xl font-bold mt-1 ${card.color || "text-gray-900"}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Impressoras</h2>
            <Link
              href={`/clients/${id}/printers`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Ver todas
            </Link>
          </div>
          <div className="space-y-2">
            {printers.map((p) => (
              <Link
                key={p.id}
                href={`/clients/${id}/printers/${p.id}`}
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md"
              >
                <div>
                  <p className="text-sm font-medium">{p.displayName || p.name}</p>
                  <p className="text-xs text-gray-500">{p.ipAddress}</p>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    p.status === "online"
                      ? "bg-green-100 text-green-700"
                      : p.status === "error"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {p.status}
                </span>
              </Link>
            ))}
            {printers.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                Nenhuma impressora encontrada
              </p>
            )}
          </div>
        </div>

        <div className="card-shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Ultimos Eventos</h2>
            <Link
              href={`/clients/${id}/alerts`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Ver todos
            </Link>
          </div>
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.slice(0, 8).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={severityBadge(a.severity)}>
                      {severityLabel(a.severity)}
                    </span>
                    <span className="text-sm truncate">{a.title}</span>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">
                    {formatDate(a.occurredAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              Nenhum evento recente
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
