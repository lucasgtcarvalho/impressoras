"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Client } from "@/types";
import { formatDate, formatNumber } from "@/lib/utils";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/clients");
      setClients(data.data);
    } finally {
      setLoading(false);
    }
  };

  const filtered = clients.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.document?.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie seus clientes
          </p>
        </div>
        <Link
          href="/clients/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          Novo Cliente
        </Link>
      </div>

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Buscar por nome ou CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80 px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Nenhum cliente encontrado</p>
          <p className="text-sm mt-1">
            Clique em "Novo Cliente" para cadastrar o primeiro.
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
                  CNPJ
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Agentes
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Impressoras
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Alertas
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Criado em
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${client.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {client.document || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                        client.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {client.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {formatNumber(client.agentsCount)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {formatNumber(client.printersCount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {client.openAlertsCount > 0 ? (
                      <span className="text-red-600 text-sm font-medium">
                        {client.openAlertsCount}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(client.createdAt)}
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
