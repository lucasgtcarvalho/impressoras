"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { Alert } from "@/types";
import { formatDate } from "@/lib/utils";

export default function ClientAlertsPage() {
  const { id } = useParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");

  useEffect(() => {
    loadAlerts();
  }, [id, filter]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/alerts", {
        params: { clientId: id, status: filter, limit: 50 },
      });
      setAlerts(data.data);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (alertId: string) => {
    await api.put(`/alerts/${alertId}/resolve`, { note: "Resolvido" });
    loadAlerts();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie os alertas do cliente
        </p>
      </div>

      <div className="flex gap-2">
        {["open", "acknowledged", "resolved"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              filter === s
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "open" ? "Abertos" : s === "acknowledged" ? "Reconhecidos" : "Resolvidos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Nenhum alerta {filter === "open" ? "aberto" : filter}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-white rounded-lg border border-gray-200 p-4 flex items-start justify-between"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-2 h-2 rounded-full ${
                    alert.severity === "critical"
                      ? "bg-red-500"
                      : alert.severity === "warning"
                      ? "bg-yellow-500"
                      : "bg-blue-500"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium">{alert.title}</p>
                  {alert.description && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {alert.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">
                      {formatDate(alert.occurredAt)}
                    </span>
                    {alert.printer && (
                      <span className="text-xs text-gray-400">
                        {alert.printer.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {(alert.status === "open" || alert.status === "acknowledged") && (
                <button
                  onClick={() => handleResolve(alert.id)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Resolver
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
