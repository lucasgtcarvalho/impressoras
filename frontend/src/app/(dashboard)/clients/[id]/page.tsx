"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { formatNumber, formatDate } from "@/lib/utils";

export default function ClientDetailPage() {
  const { id } = useParams();
  const [client, setClient] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [printers, setPrinters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientRes, statsRes, printersRes] = await Promise.all([
        api.get(`/clients/${id}`),
        api.get(`/clients/${id}/stats`),
        api.get(`/printers?clientId=${id}&limit=5`),
      ]);
      setClient(clientRes.data);
      setStats(statsRes.data);
      setPrinters(printersRes.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!client) return <p>Cliente não encontrado</p>;

  const cards = [
    { label: "Impressoras", value: stats?.totalPrinters || 0 },
    { label: "Online", value: stats?.onlinePrinters || 0, color: "text-green-600" },
    { label: "Offline", value: stats?.offlinePrinters || 0, color: "text-red-600" },
    { label: "Alertas", value: stats?.openAlerts || 0 },
    { label: "Agentes", value: stats?.activeAgents || 0 },
    { label: "Páginas no Mês", value: formatNumber(stats?.totalPagesThisMonth || 0) },
  ];

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
            Configurações
          </Link>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">Código de Ativação</p>
          <p className="text-lg font-mono text-blue-900 mt-1">
            {client.activationCode}
          </p>
        </div>
        <button
          onClick={() =>
            navigator.clipboard.writeText(client.activationCode)
          }
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Copiar
        </button>
      </div>

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
            <h2 className="text-lg font-semibold">Top Usuários</h2>
            <Link
              href={`/clients/${id}/jobs`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Ver bilhetagem
            </Link>
          </div>
          {stats?.topUsers?.length > 0 ? (
            <div className="space-y-2">
              {stats.topUsers.map((u: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md"
                >
                  <span className="text-sm font-medium">{u.username}</span>
                  <span className="text-sm text-gray-600">
                    {formatNumber(u.totalPages)} págs
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              Nenhum dado de bilhetagem
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
