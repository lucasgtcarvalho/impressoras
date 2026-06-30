"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { formatNumber } from "@/lib/utils";
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
}

export default function DashboardPage() {
  const [stats, setStats] = useState<GlobalStats | null>(null);

  useEffect(() => {
    api.get("/dashboard/global").then(({ data }) => setStats(data));
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
    { label: "Alertas Abertos", value: stats.openAlerts, color: stats.criticalAlerts > 0 ? "bg-red-500" : "bg-yellow-500" },
    { label: "Online", value: stats.onlinePrinters, color: "bg-green-500" },
    { label: "Offline", value: stats.offlinePrinters, color: "bg-gray-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Global</h1>
        <p className="text-sm text-gray-500 mt-1">
          Visão geral da operação
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
          <h2 className="text-lg font-semibold mb-4">Páginas no Mês</h2>
          <p className="text-3xl font-bold text-blue-600">
            {formatNumber(stats.totalPagesThisMonth)}
          </p>
          <p className="text-sm text-gray-500 mt-1">total de páginas impressas</p>
        </div>

        <div className="card-shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Top Clientes por Volume</h2>
          <div className="space-y-3">
            {stats.topClients.map((c, i) => (
              <Link
                key={c.clientId}
                href={`/clients/${c.clientId}`}
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-400">#{i + 1}</span>
                  <span className="text-sm font-medium">{c.clientName}</span>
                </div>
                <span className="text-sm text-gray-600">
                  {formatNumber(c.totalPages)} págs
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
