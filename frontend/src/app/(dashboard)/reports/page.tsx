"use client";

export default function ReportsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Relatórios</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="border rounded-lg p-6 hover:shadow-md cursor-pointer">
          <h2 className="font-semibold text-lg mb-2">Impressões por Período</h2>
          <p className="text-gray-500 text-sm">
            Relatório detalhado de páginas impressas por data
          </p>
        </div>
        <div className="border rounded-lg p-6 hover:shadow-md cursor-pointer">
          <h2 className="font-semibold text-lg mb-2">Custos por Cliente</h2>
          <p className="text-gray-500 text-sm">
            Resumo de custos de impressão por cliente
          </p>
        </div>
        <div className="border rounded-lg p-6 hover:shadow-md cursor-pointer">
          <h2 className="font-semibold text-lg mb-2">Uso de Suprimentos</h2>
          <p className="text-gray-500 text-sm">
            Níveis de toner e suprimentos por impressora
          </p>
        </div>
      </div>
    </div>
  );
}
