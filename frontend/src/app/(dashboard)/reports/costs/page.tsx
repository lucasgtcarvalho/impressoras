"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { formatNumber } from "@/lib/utils";

interface ClientStat {
  clientId: string;
  clientName: string;
  totalPages: number;
  totalJobs: number;
  colorPages: number;
  monoPages: number;
  estimatedCost: number;
}

export default function CostsReport() {
  const [loading, setLoading] = useState(true);
  const [clientStats, setClientStats] = useState<ClientStat[]>([]);
  const [costMono, setCostMono] = useState(0.10);
  const [costColor, setCostColor] = useState(0.50);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() =>
    new Date().toISOString().split("T")[0]
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: clientsData } = await api.get("/clients?limit=100");
      const clients = clientsData.data;

      const stats = await Promise.all(
        clients.map(async (c: any) => {
          try {
            const jobsRes = await api.get("/jobs", {
              params: { clientId: c.id, dateFrom, dateTo, limit: 1 },
            });
            const summary = jobsRes.data.summary || {
              totalPages: 0,
              totalJobs: 0,
              colorPages: 0,
              monoPages: 0,
            };
            return {
              clientId: c.id,
              clientName: c.name,
              totalPages: summary.totalPages || 0,
              totalJobs: summary.totalJobs || 0,
              colorPages: summary.colorPages || 0,
              monoPages: summary.monoPages || 0,
            };
          } catch {
            return {
              clientId: c.id,
              clientName: c.name,
              totalPages: 0,
              totalJobs: 0,
              colorPages: 0,
              monoPages: 0,
            };
          }
        })
      );

      const withCost = stats.map((s) => ({
        ...s,
        estimatedCost:
          s.monoPages * costMono + s.colorPages * costColor,
      }));
      withCost.sort((a, b) => b.estimatedCost - a.estimatedCost);
      setClientStats(withCost);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const totalCost = clientStats.reduce((s, c) => s + c.estimatedCost, 0);
  const totalPages = clientStats.reduce((s, c) => s + c.totalPages, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Custos por Cliente
      </h1>

      <form onSubmit={handleFilter} className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            De
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Até
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Custo P&amp;B (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={costMono}
            onChange={(e) => setCostMono(Number(e.target.value))}
            className="border rounded px-3 py-2 text-sm w-24"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Custo Cor (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={costColor}
            onChange={(e) => setCostColor(Number(e.target.value))}
            className="border rounded px-3 py-2 text-sm w-24"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Calcular
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Total de Clientes</p>
              <p className="text-2xl font-bold">{clientStats.length}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Total de Páginas</p>
              <p className="text-2xl font-bold">{formatNumber(totalPages)}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Custo Total Estimado</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {formatNumber(totalCost)}
              </p>
            </div>
          </div>

          {clientStats.length > 0 ? (
            <div className="card-shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                        Cliente
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                        Total Páginas
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                        P&amp;B
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                        Cor
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                        Total Trabalhos
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                        Custo Estimado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientStats.map((c) => (
                      <tr
                        key={c.clientId}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {c.clientName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                          {formatNumber(c.totalPages)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                          {formatNumber(c.monoPages)}
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-600 text-right">
                          {formatNumber(c.colorPages)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                          {formatNumber(c.totalJobs)}
                        </td>
                        <td className="px-4 py-3 text-sm text-green-600 text-right font-medium">
                          R$ {formatNumber(c.estimatedCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">
                Nenhum dado encontrado para o período selecionado
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
