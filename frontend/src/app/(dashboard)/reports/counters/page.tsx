"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface Printer {
  id: string;
  name: string;
  model: string | null;
  serialNumber: string | null;
  ipAddress: string | null;
  totalPages: number;
  lastContactAt: string | null;
  client: { id: string; name: string } | null;
}

interface Client {
  id: string;
  name: string;
}

interface ReportRow {
  printer: string;
  model: string;
  serial: string;
  ip: string;
  client: string;
  pages: number;
  lastCollect: string;
}

export default function CountersReport() {
  const [mode, setMode] = useState<"equipment" | "client">("equipment");
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/printers?limit=100"),
      api.get("/clients?limit=100"),
    ]).then(([printersRes, clientsRes]) => {
      setPrinters(printersRes.data.data);
      setClients(clientsRes.data.data);
    });
  }, []);

  const generateReport = () => {
    setLoading(true);
    setGenerated(false);

    let filtered = printers;

    if (mode === "equipment" && selectedPrinter) {
      filtered = printers.filter((p) => p.id === selectedPrinter);
    } else if (mode === "client" && selectedClient) {
      filtered = printers.filter((p) => p.client?.id === selectedClient);
    }

    const rows: ReportRow[] = filtered.map((p) => ({
      printer: p.name || p.ipAddress || "-",
      model: p.model || "-",
      serial: p.serialNumber || "-",
      ip: p.ipAddress || "-",
      client: p.client?.name || "-",
      pages: p.totalPages,
      lastCollect: p.lastContactAt
        ? new Date(p.lastContactAt).toLocaleString("pt-BR")
        : "-",
    }));

    rows.sort((a, b) => b.pages - a.pages);
    setReportData(rows);
    setGenerated(true);
    setLoading(false);
  };

  const totalPages = reportData.reduce((s, r) => s + r.pages, 0);

  const exportCSV = () => {
    const header = "Impressora;Modelo;Serial;IP;Cliente;Total de Paginas;Ultima Coleta";
    const rows = reportData.map(
      (r) =>
        `"${r.printer}";"${r.model}";"${r.serial}";"${r.ip}";"${r.client}";${r.pages};"${r.lastCollect}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-contadores.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXML = () => {
    const rowsXml = reportData
      .map(
        (r) =>
          `  <impressora>
    <nome>${escapeXml(r.printer)}</nome>
    <modelo>${escapeXml(r.model)}</modelo>
    <serial>${escapeXml(r.serial)}</serial>
    <ip>${escapeXml(r.ip)}</ip>
    <cliente>${escapeXml(r.client)}</cliente>
    <totalPaginas>${r.pages}</totalPaginas>
    <ultimaColeta>${escapeXml(r.lastCollect)}</ultimaColeta>
  </impressora>`
      )
      .join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<relatorio>
  <tipo>Contadores de Impressoras</tipo>
  <geradoEm>${new Date().toLocaleString("pt-BR")}</geradoEm>
  <impressoras>
${rowsXml}
  </impressoras>
</relatorio>`;
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-contadores.xml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Relatório de Contadores
      </h1>

      <div className="bg-white border rounded-lg p-6 space-y-4">
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="equipment"
              checked={mode === "equipment"}
              onChange={() => setMode("equipment")}
              className="text-blue-600"
            />
            <span className="text-sm font-medium">Por Equipamento</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="client"
              checked={mode === "client"}
              onChange={() => setMode("client")}
              className="text-blue-600"
            />
            <span className="text-sm font-medium">Por Cliente</span>
          </label>
        </div>

        <div>
          {mode === "equipment" ? (
            <select
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full max-w-md"
            >
              <option value="">Todas as Impressoras</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.ipAddress} ({p.model || "sem modelo"})
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full max-w-md"
            >
              <option value="">Todos os Clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={generateReport}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Gerando..." : "Gerar Relatório"}
        </button>
      </div>

      {generated && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              <strong>{reportData.length}</strong> equipamento(s) encontrado(s)
            </p>
            <div className="flex gap-2">
              <button
                onClick={exportCSV}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
              >
                Exportar CSV
              </button>
              <button
                onClick={exportXML}
                className="bg-amber-600 text-white px-4 py-2 rounded text-sm hover:bg-amber-700"
              >
                Exportar XML
              </button>
            </div>
          </div>

          <div className="card-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Impressora</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Modelo</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Serial</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">IP</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Cliente</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Total de Páginas</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Última Coleta</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.printer}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.model}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.serial}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.ip}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.client}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right font-mono">
                        {r.pages.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{r.lastCollect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
