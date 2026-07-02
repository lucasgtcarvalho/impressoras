"use client";

import Link from "next/link";

const reports = [
  {
    href: "/reports/print-jobs",
    title: "Impressões por Período",
    description: "Relatório detalhado de páginas impressas por data",
  },
  {
    href: "/reports/counters",
    title: "Contadores",
    description: "Relatório de contadores por equipamento ou cliente com exportação CSV/XML",
  },
  {
    href: "/reports/supplies",
    title: "Uso de Suprimentos",
    description: "Níveis de toner e suprimentos por impressora",
  },
];

export default function ReportsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Relatórios</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <Link key={r.href} href={r.href}>
            <div className="border rounded-lg p-6 hover:shadow-md cursor-pointer">
              <h2 className="font-semibold text-lg mb-2">{r.title}</h2>
              <p className="text-gray-500 text-sm">{r.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
