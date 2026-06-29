"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Printer } from "@/types";
import { formatDate, formatNumber } from "@/lib/utils";

export default function PrintersPage() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/printers?limit=100")
      .then(({ data }) => setPrinters(data.data))
      .finally(() => setLoading(false));
  }, []);

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
            Instale o agente no cliente para descobrir impressoras automaticamente.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Nome</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">IP</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Modelo</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Serial</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Total Páginas</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Último Contato</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Cliente</th>
              </tr>
            </thead>
            <tbody>
              {printers.map((printer: Printer) => (
                <tr key={printer.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/printers/${printer.id}`} className="text-blue-600 hover:underline font-medium">
                      {printer.name || printer.ipAddress}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{printer.ipAddress}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{printer.model || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{printer.serialNumber || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      printer.status === "online" ? "bg-green-100 text-green-700" :
                      printer.status === "offline" ? "bg-red-100 text-red-700" :
                      printer.status === "error" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {printer.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatNumber(printer.totalPages ?? 0)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{printer.lastContactAt ? formatDate(printer.lastContactAt) : "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{printer.client?.name || printer.client?.id?.substring(0, 8) || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
