"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { PrintJob } from "@/types";
import { formatDate, formatNumber } from "@/lib/utils";

export default function ClientJobsPage() {
  const { id } = useParams();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    username: "",
    computerName: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, [id, page, filters]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const params: any = { clientId: id, page, limit: 50 };
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.username) params.username = filters.username;
      if (filters.computerName) params.computerName = filters.computerName;

      const { data } = await api.get("/jobs", { params });
      setJobs(data.data);
      setSummary(data.summary);
      setTotalPages(data.meta.totalPages);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bilhetagem</h1>
        <p className="text-sm text-gray-500 mt-1">
          Histórico de trabalhos de impressão
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <span className="text-xs text-gray-500">Total de Páginas</span>
            <p className="text-lg font-bold">{formatNumber(summary.totalPages)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <span className="text-xs text-gray-500">Total de Jobs</span>
            <p className="text-lg font-bold">{formatNumber(summary.totalJobs)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <span className="text-xs text-gray-500">Páginas Coloridas</span>
            <p className="text-lg font-bold">{formatNumber(summary.colorPages)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <span className="text-xs text-gray-500">Páginas Mono</span>
            <p className="text-lg font-bold">{formatNumber(summary.monoPages)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <input
          type="text"
          placeholder="Usuário..."
          value={filters.username}
          onChange={(e) => setFilters({ ...filters, username: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <input
          type="text"
          placeholder="Computador..."
          value={filters.computerName}
          onChange={(e) => setFilters({ ...filters, computerName: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Documento
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Usuário
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Computador
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Impressora
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                  Páginas
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Duplex
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                  Data
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium truncate max-w-[200px]">
                    {j.documentName || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {j.username || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {j.computerName || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {j.printer?.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    {j.pages || 0}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {j.isDuplex ? "Sim" : "Não"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">
                    {j.printedAt ? formatDate(j.printedAt) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-sm text-gray-600">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
