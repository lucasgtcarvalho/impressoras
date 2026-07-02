"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { formatNumber, formatDate } from "@/lib/utils";
import Link from "next/link";

interface GlobalStats {
  totalClients: number;
  activeAgents: number;
  totalPrinters: number;
  onlinePrinters: number;
  offlinePrinters: number;
  openAlerts: number;
  criticalAlerts: number;
  totalPagesThisMonth: number;
  topClients: { clientId: string; clientName: string; totalPages: number }[];
  alertsBySeverity?: { severity: string; count: number }[];
}

interface Alert {
  id: string;
  title: string;
  severity: "info" | "warning" | "critical";
  status: string;
  occurredAt: string;
  client?: { id: string; name: string };
  printer?: { id: string; name: string; ipAddress: string };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    api.get("/dashboard/global").then(({ data }) => setStats(data));
    api.get("/alerts", { params: { status: "open", limit: 10 } }).then(({ data }) => setAlerts(data.data || []));
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const cards = [
    { label: "Clientes", value: stats.totalClients, color: "bg-blue-500" },
    { label: "Agentes Ativos", value: stats.activeAgents, color: "bg-green-500" },
    { label: "Impressoras", value: stats.totalPrinters, color: "bg-purple-500" },
    { label: "Online", value: stats.onlinePrinters, color: "bg-green-500" },
    { label: "Offline", value: stats.offlinePrinters, color: "bg-gray-500" },
    { label: "Alertas", value: stats.openAlerts, color: stats.criticalAlerts > 0 ? "bg-red-500" : "bg-yellow-500" },
  ];

  const severityColor = (s: string) => {
    if (s === "critical") return "bg-red-500";
    if (s === "warning") return "bg-yellow-500";
    return "bg-blue-400";
  };

  const severityText = (s: string) => {
    if (s === "critical") return "text-red-700 bg-red-50";
    if (s === "warning") return "text-yellow-700 bg-yellow-50";
    return "text-blue-700 bg-blue-50";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Global</h1>
        <p className="text-sm text-gray-500 mt-1">
          Visao geral da operacao
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card-shadow p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{card.label}</span>
              <div className={`w-2 h-2 rounded-full ${card.color}`} />
            </div>
            <p className="text-2xl font-bold mt-2">{formatNumber(card.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Alertas por Severidade</h2>
            <Link href="/alerts" className="text-sm text-blue-600 hover:text-blue-800">
              Ver todos
            </Link>
          </div>
          <div className="space-y-3">
            {(["critical", "warning", "info"] as const).map((sev) => {
              const item = stats.alertsBySeverity?.find((a) => a.severity === sev);
              const count = item?.count || 0;
              return (
                <div key={sev} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${severityColor(sev)}`} />
                    <span className="text-sm capitalize">
                      {sev === "critical" ? "Critico" : sev === "warning" ? "Atencao" : "Informativo"}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-600">{count}</span>
                </div>
              );
            })}
            {stats.openAlerts === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum alerta aberto</p>
            )}
          </div>
        </div>

        <div className="card-shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Ultimos Eventos</h2>
            <Link href="/alerts" className="text-sm text-blue-600 hover:text-blue-800">
              Ver todos
            </Link>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${severityText(a.severity)} shrink-0`}>
                    {a.severity === "critical" ? "CRIT" : a.severity === "warning" ? "AVISO" : "INFO"}
                  </span>
                  <span className="text-sm truncate">{a.title}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-xs text-gray-400">{a.client?.name}</span>
                  <span className="text-xs text-gray-400">{formatDate(a.occurredAt)}</span>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum evento recente</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
