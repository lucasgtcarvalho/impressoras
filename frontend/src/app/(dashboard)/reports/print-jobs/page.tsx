"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface CounterRecord {
  totalPages: number;
  collectedAt: string;
}

interface PrinterInfo {
  id: string;
  name: string;
  model: string | null;
  totalPages: number;
}

interface DailyPage {
  date: string;
  pages: number;
}

interface PrinterPages {
  name: string;
  model: string;
  pages: number;
}

export default function PrintJobsReport() {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [clientFilter, setClientFilter] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dailyPages, setDailyPages] = useState<DailyPage[]>([]);
  const [printerPages, setPrinterPages] = useState<PrinterPages[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [printersCount, setPrintersCount] = useState(0);

  useEffect(() => {
    api.get("/clients?limit=200").then(({ data }) => setClients(data.data || []));
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      if (clientFilter) params.clientId = clientFilter;
      const { data: printersData } = await api.get("/printers", { params });
      const printers: PrinterInfo[] = printersData.data;
      setPrintersCount(printers.length);

      const allDaily: Record<string, number> = {};
      const allPrinterPages: PrinterPages[] = [];

      for (const p of printers) {
        const { data: history } = await api.get(
          `/printers/${p.id}/counter-history`,
          { params: { dateFrom, dateTo, limit: 500 } }
        );
        const records: CounterRecord[] = history;

        if (records.length > 1) {
          records.sort(
            (a, b) =>
              new Date(a.collectedAt).getTime() -
              new Date(b.collectedAt).getTime()
          );
          const first = records[0];
          const last = records[records.length - 1];
          const diff = last.totalPages - first.totalPages;
          if (diff > 0) {
            allPrinterPages.push({
              name: p.name,
              model: p.model || "-",
              pages: diff,
            });
          }
        }

        for (let i = 1; i < records.length; i++) {
          const prev = records[i - 1];
          const curr = records[i];
          const diff = curr.totalPages - prev.totalPages;
          if (diff > 0) {
            const day = curr.collectedAt.split("T")[0];
            allDaily[day] = (allDaily[day] || 0) + diff;
          }
        }
      }

      const sortedDays = Object.entries(allDaily)
        .map(([date, pages]) => ({ date, pages }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setDailyPages(sortedDays);
      setPrinterPages(allPrinterPages.sort((a, b) => b.pages - a.pages));
      setTotalPages(allPrinterPages.reduce((s, p) => s + p.pages, 0));
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Impressões por Período
      </h1>

      <form onSubmit={handleFilter} className="flex gap-4 items-end flex-wrap">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Cliente
          </label>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Todos os clientes</option>
            {clients.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
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
            Ate
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Filtrar
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
              <p className="text-sm text-gray-500">Total de Páginas</p>
              <p className="text-2xl font-bold">{totalPages.toLocaleString("pt-BR")}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Impressoras</p>
              <p className="text-2xl font-bold">{printersCount}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Dias com Atividade</p>
              <p className="text-2xl font-bold">{dailyPages.length}</p>
            </div>
          </div>

          {printerPages.length > 0 && (
            <div className="card-shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold">
                  Páginas por Impressora ({printerPages.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Impressora</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Modelo</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Páginas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printerPages.map((p, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{p.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.model}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{p.pages.toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {dailyPages.length > 0 && (
            <div className="card-shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold">
                  Páginas por Dia ({dailyPages.length} dias)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Data</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Páginas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyPages.map((d) => (
                      <tr key={d.date} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                          {d.pages.toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {printerPages.length === 0 && dailyPages.length === 0 && (
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
