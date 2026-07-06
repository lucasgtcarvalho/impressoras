"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/utils";

export default function PrinterDetailPage() {
  const { id, printerId } = useParams();
  const router = useRouter();
  const [printer, setPrinter] = useState<any>(null);
  const [counterHistory, setCounterHistory] = useState<any[]>([]);
  const [supplyHistory, setSupplyHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("info");
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    loadData();
  }, [printerId]);

  useEffect(() => {
    if (activeTab === "supplies") loadSupplyHistory();
  }, [activeTab]);

  const loadData = async () => {
    const [printerRes, counterRes] = await Promise.all([
      api.get(`/printers/${printerId}`),
      api.get(`/printers/${printerId}/counter-history?limit=30`),
    ]);
    setPrinter(printerRes.data);
    setCounterHistory(counterRes.data || []);
  };

  const loadSupplyHistory = async () => {
    if (supplyHistory.length > 0) return;
    try {
      const res = await api.get(`/printers/${printerId}/supply-history?limit=200`);
      setSupplyHistory(res.data || []);
    } catch {}
  };

  const handleRename = async () => {
    try {
      const { data } = await api.put(`/printers/${printerId}`, { displayName: editValue });
      setPrinter((prev: any) => ({ ...prev, displayName: data.displayName }));
      setEditing(false);
    } catch { }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/printers/${printerId}`);
      router.push(`/clients/${id}/printers`);
    } catch { }
  };

  if (!printer) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const tabs = [
    { key: "info", label: "Informações" },
    { key: "supplies", label: "Suprimentos" },
    { key: "counters", label: "Contadores" },
    { key: "events", label: "Eventos" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditing(false); }}
                className="text-2xl font-bold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent w-full max-w-md"
                autoFocus
              />
              <button onClick={handleRename} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Salvar</button>
              <button onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="text-2xl font-bold text-gray-900 truncate">
                {printer.displayName || printer.name}
              </h1>
              <button
                onClick={() => { setEditValue(printer.displayName || printer.name || ""); setEditing(true); }}
                className="text-gray-400 hover:text-blue-600 transition-opacity"
                title="Renomear"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}
          <p className="text-sm text-gray-500 mt-1">
            {printer.model} · {printer.ipAddress}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600 font-medium">Excluir impressora?</span>
              <button onClick={handleDelete} className="px-3 py-1 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">Sim</button>
              <button onClick={() => setConfirmingDelete(false)} className="px-3 py-1 text-sm font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Não</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} className="px-3 py-1 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50">
              Excluir
            </button>
          )}
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              printer.status === "online"
                ? "bg-green-100 text-green-700"
                : printer.status === "error"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {printer.status}
            {printer.statusDetail ? ` · ${printer.statusDetail}` : ""}
          </span>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "info" && (
        <div className="card-shadow p-6 grid grid-cols-2 gap-4">
          {[
            { label: "Fabricante", value: printer.manufacturer },
            { label: "Modelo", value: printer.model },
            { label: "Número de Série", value: printer.serialNumber },
            { label: "IP", value: printer.ipAddress },
            { label: "MAC", value: printer.macAddress },
            { label: "Hostname", value: printer.hostname },
            { label: "Localização", value: printer.location },
            { label: "Firmware", value: printer.firmwareVersion },
            { label: "Mono/Color", value: printer.isMonochrome ? "Mono" : "Color" },
            { label: "Descoberta", value: printer.discoveryMethod },
            { label: "Último Contato", value: printer.lastContactAt ? formatDate(printer.lastContactAt) : "-" },
            { label: "Total de Páginas", value: formatNumber(printer.totalPages) },
          ].map((item) => (
            <div key={item.label}>
              <span className="text-xs text-gray-500">{item.label}</span>
              <p className="text-sm font-medium mt-0.5">{item.value || "-"}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "supplies" && (() => {
        const latestByType = new Map<string, any>();
        (printer.supplyLevels || []).forEach((s: any) => {
          if (!latestByType.has(s.supplyType)) latestByType.set(s.supplyType, s);
        });
        const uniqueSupplies = Array.from(latestByType.values());

        const historyByType = new Map<string, { date: string; level: number }[]>();
        supplyHistory.forEach((s: any) => {
          if (!historyByType.has(s.supplyType)) historyByType.set(s.supplyType, []);
          historyByType.get(s.supplyType)!.push({
            date: new Date(s.collectedAt).toLocaleDateString("pt-BR"),
            level: s.levelPercent ?? 0,
          });
        });

        const tonerKey = [...historyByType.keys()].find(k => k.startsWith("toner"));
        const tonerData = tonerKey ? historyByType.get(tonerKey)! : [];

        const replacements: { index: number; date: string }[] = [];
        for (let i = 1; i < tonerData.length; i++) {
          if (tonerData[i].level > tonerData[i - 1].level + 30) {
            replacements.push({ index: i, date: tonerData[i].date });
          }
        }

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uniqueSupplies.map((supply: any, i: number) => (
                <div key={i} className="card-shadow p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium capitalize">
                      {supply.supplyType.replace("_", " ")}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        supply.levelPercent > 20
                          ? "bg-green-100 text-green-700"
                          : supply.levelPercent > 10
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {supply.levelPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        supply.levelPercent > 20
                          ? "bg-green-500"
                          : supply.levelPercent > 10
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${supply.levelPercent}%` }}
                    />
                  </div>
                  {supply.supplyName && (
                    <p className="text-xs text-gray-500 mt-1">{supply.supplyName}</p>
                  )}
                </div>
              ))}
              {uniqueSupplies.length === 0 && (
                <p className="text-sm text-gray-500">Nenhum suprimento registrado</p>
              )}
            </div>

            {tonerData.length > 1 && (
              <div className="card-shadow p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Historico de Nivel do Toner
                </h3>
                <div className="relative">
                  <svg viewBox={`0 0 ${Math.max(tonerData.length * 40, 400)} 200`} className="w-full h-48">
                    <defs>
                      <linearGradient id="tonerGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    <polygon
                      points={tonerData.map((d, i) => {
                        const x = (i / (tonerData.length - 1)) * Math.max(tonerData.length * 40, 400);
                        const y = 180 - (d.level / 100) * 160;
                        return `${x},${y}`;
                      }).join(" ") + ` ${Math.max(tonerData.length * 40, 400)},180 0,180`}
                      fill="url(#tonerGrad)"
                    />
                    <polyline
                      points={tonerData.map((d, i) => {
                        const x = (i / (tonerData.length - 1)) * Math.max(tonerData.length * 40, 400);
                        const y = 180 - (d.level / 100) * 160;
                        return `${x},${y}`;
                      }).join(" ")}
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2"
                    />
                    {tonerData.map((d, i) => {
                      const x = (i / (tonerData.length - 1)) * Math.max(tonerData.length * 40, 400);
                      const y = 180 - (d.level / 100) * 160;
                      const isReplacement = replacements.some(r => r.index === i);
                      return (
                        <g key={i}>
                          <circle cx={x} cy={y} r={isReplacement ? 6 : 3} fill={isReplacement ? "#EF4444" : "#3B82F6"} stroke="#fff" strokeWidth="1.5" />
                          {isReplacement && (
                            <text x={x} y={y - 12} textAnchor="middle" fontSize="9" fill="#EF4444" fontWeight="bold">Troca</text>
                          )}
                        </g>
                      );
                    })}
                    {[0, 25, 50, 75, 100].map(v => (
                      <g key={v}>
                        <line x1="0" y1={180 - (v / 100) * 160} x2={Math.max(tonerData.length * 40, 400)} y2={180 - (v / 100) * 160} stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="4" />
                        <text x="-5" y={184 - (v / 100) * 160} textAnchor="end" fontSize="9" fill="#9CA3AF">{v}%</text>
                      </g>
                    ))}
                  </svg>
                  {replacements.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1" />
                      {replacements.length} troca{replacements.length > 1 ? "s" : ""} detectada{replacements.length > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === "counters" && (
        <div className="card-shadow overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Data
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                  Total
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                  Mono
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                  Color
                </th>
              </tr>
            </thead>
            <tbody>
              {counterHistory.map((c: any) => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(c.collectedAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {formatNumber(c.totalPages)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {formatNumber(c.monoPages)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {formatNumber(c.colorPages)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "events" && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
          <p>Histórico de eventos disponível em breve</p>
        </div>
      )}
    </div>
  );
}
