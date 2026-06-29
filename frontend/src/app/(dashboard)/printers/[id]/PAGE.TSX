"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/utils";

export default function PrinterDetailPage() {
  const { id } = useParams();
  const [printer, setPrinter] = useState<any>(null);
  const [counterHistory, setCounterHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("info");

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    const [printerRes, counterRes] = await Promise.all([
      api.get(`/printers/${id}`),
      api.get(`/printers/${id}/counter-history?limit=30`),
    ]);
    setPrinter(printerRes.data);
    setCounterHistory(counterRes.data || []);
  };

  if (!printer) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const displayName = printer.hostname || printer.name || printer.ipAddress;

  const tabs = [
    { key: "info", label: "Informações" },
    { key: "supplies", label: "Suprimentos" },
    { key: "counters", label: "Contadores" },
    { key: "events", label: "Eventos" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/printers" className="text-sm text-blue-600 hover:underline">
          &larr; Voltar para impressoras
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {printer.model ? `${printer.model} · ` : ""}
            {printer.ipAddress}
          </p>
        </div>
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
        <div className="bg-white rounded-lg border border-gray-200 p-6 grid grid-cols-2 gap-4">
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

      {activeTab === "supplies" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {printer.supplyLevels?.slice(0, 8).map((supply: any, i: number) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
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
        </div>
      )}

      {activeTab === "counters" && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Data</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Mono</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Color</th>
              </tr>
            </thead>
            <tbody>
              {counterHistory.map((c: any) => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(c.collectedAt)}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatNumber(c.totalPages)}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatNumber(c.monoPages)}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatNumber(c.colorPages)}</td>
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
