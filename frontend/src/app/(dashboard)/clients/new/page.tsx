"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function NewClientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    legalName: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/clients", form);
      router.push(`/clients/${data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao criar cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Novo Cliente</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cadastre um novo cliente na plataforma
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-md">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome Fantasia *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Razao Social
          </label>
          <input
            type="text"
            value={form.legalName}
            onChange={(e) => setForm({ ...form, legalName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observacoes
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            rows={3}
          />
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar Cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}
