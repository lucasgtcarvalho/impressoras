"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { Printer } from "@/types";
import { formatDate, formatNumber } from "@/lib/utils";

export default function ClientPrintersPage() {
  const { id } = useParams();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/printers?clientId=${id}&limit=100`)
      .then(({ data }) => setPrinters(data.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Impressoras</h1>
        <p className="text-sm text-gray-500 mt-1">
          {printers.length} equipamento(s) encontrado(s)
        </p>
      </div>

      {printers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Nenhuma impressora encontrada</p>
          <p className="text-sm mt-1">
            Instale o agente no cliente para descobrir impressoras
            automaticamente.
          </p>
        </div>
      ) : (
        <div className="card-shadow overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Nome
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Modelo
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  IP
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                  Total Páginas
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                  Último Contato
                </th>
              </tr>
            </thead>
            <tbody>
              {printers.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${id}/printers/${p.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {p.displayName || p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {p.model || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {p.ipAddress || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        p.status === "online"
                          ? "bg-green-100 text-green-700"
                          : p.status === "error" || p.status === "warning"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {formatNumber(p.totalPages)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">
                    {p.lastContactAt ? formatDate(p.lastContactAt) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
