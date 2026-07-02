"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { formatNumber } from "@/lib/utils";

interface SupplyInfo {
  supplyType: string;
  supplyName: string | null;
  levelPercent: number | null;
  status: string;
  collectedAt: string;
}

interface PrinterSupply {
  id: string;
  name: string;
  ipAddress: string | null;
  model: string | null;
  location: string | null;
  client: { id: string; name: string } | null;
  supplyLevels: SupplyInfo[];
}

function SupplyBar({ level }: { level: number | null }) {
  if (level === null) {
    return (
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div className="bg-gray-400 h-2.5 rounded-full w-0" />
      </div>
    );
  }
  const color =
    level <= 5
      ? "bg-red-600"
      : level <= 15
        ? "bg-yellow-500"
        : level <= 50
          ? "bg-blue-500"
          : "bg-green-500";
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div
        className={`${color} h-2.5 rounded-full`}
        style={{ width: `${Math.min(level, 100)}%` }}
      />
    </div>
  );
}

export default function SuppliesReport() {
  const [printers, setPrinters] = useState<PrinterSupply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/printers?limit=100")
      .then(({ data }) => setPrinters(data.data))
      .finally(() => setLoading(false));
  }, []);

  const printersWithSupplies = printers.filter(
    (p) => p.supplyLevels && p.supplyLevels.length > 0
  );
  const printersWithoutSupplies = printers.filter(
    (p) => !p.supplyLevels || p.supplyLevels.length === 0
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Uso de Suprimentos
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total de Impressoras</p>
          <p className="text-2xl font-bold">{printers.length}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Com Suprimentos</p>
          <p className="text-2xl font-bold text-blue-600">
            {printersWithSupplies.length}
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Sem Suprimentos</p>
          <p className="text-2xl font-bold text-gray-500">
            {printersWithoutSupplies.length}
          </p>
        </div>
      </div>

      {printersWithSupplies.length > 0 && (
        <div className="card-shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold">
              Suprimentos por Impressora
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                    Impressora
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                    Modelo
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                    Suprimento
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                    Nível
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                    Barra
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                    Cliente
                  </th>
                </tr>
              </thead>
              <tbody>
                {printersWithSupplies.map((printer) =>
                  printer.supplyLevels.map((supply, idx) => (
                    <tr
                      key={`${printer.id}-${supply.supplyType}-${idx}`}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      {idx === 0 && (
                        <>
                          <td
                            rowSpan={printer.supplyLevels.length}
                            className="px-4 py-3 text-sm font-medium text-gray-800 align-top"
                          >
                            {printer.name || printer.ipAddress}
                          </td>
                          <td
                            rowSpan={printer.supplyLevels.length}
                            className="px-4 py-3 text-sm text-gray-600 align-top"
                          >
                            {printer.model || "-"}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {supply.supplyName || supply.supplyType}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {supply.levelPercent !== null
                          ? `${supply.levelPercent}%`
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-32">
                          <SupplyBar level={supply.levelPercent} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            supply.status === "ok" || supply.status === "normal"
                              ? "bg-green-100 text-green-700"
                              : supply.status === "low"
                                ? "bg-yellow-100 text-yellow-700"
                                : supply.status === "critical"
                                  ? "bg-red-100 text-red-700"
                                  : supply.status === "empty"
                                    ? "bg-gray-100 text-gray-700"
                                    : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {supply.status}
                        </span>
                      </td>
                      {idx === 0 && (
                        <td
                          rowSpan={printer.supplyLevels.length}
                          className="px-4 py-3 text-sm text-gray-600 align-top"
                        >
                          {printer.client?.name || "-"}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {printersWithoutSupplies.length > 0 && (
        <div className="card-shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold">
              Impressoras sem Suprimentos ({printersWithoutSupplies.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                    Nome
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                    IP
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                    Modelo
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                    Cliente
                  </th>
                </tr>
              </thead>
              <tbody>
                {printersWithoutSupplies.map((printer) => (
                  <tr
                    key={printer.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {printer.name || printer.ipAddress}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {printer.ipAddress || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {printer.model || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {printer.client?.name || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
