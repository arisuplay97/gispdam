import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useGetMonitoringData, useListMonitoringPoints } from "@workspace/api-client-react";
import { ArrowLeft, Database, Calendar } from "lucide-react";
import { useNetworkNodeNames } from "@/hooks/useNetworkNodes";

export default function DataBulanan() {
  const [, navigate] = useLocation();
  const { data: rawMonitoringData, isLoading, error } = useGetMonitoringData();
  const { data: dbPoints } = useListMonitoringPoints();
  const { data: customNames } = useNetworkNodeNames();

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Urutkan dan filter data per bulan
  const sortedData = useMemo(() => {
    if (!rawMonitoringData) return [];
    
    // Konversi object ke array
    const allData = Object.values(rawMonitoringData);
    
    // Filter by month
    const filtered = allData.filter(d => {
      if (!d.date) return false;
      const rowDate = new Date(d.date);
      const rowMonth = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, "0")}`;
      return rowMonth === selectedMonth;
    });

    // Sort by date descending
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawMonitoringData, selectedMonth]);

  const getName = (id: string) => {
    if (customNames?.[id]) return customNames[id];
    const pt = dbPoints?.find(p => p.pointId === id);
    return pt?.name || id;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-600 bg-white rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Data Pemantauan Riwayat</h1>
                <p className="text-sm text-slate-500">Tabel seluruh riwayat bacaan dari database</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-10 text-slate-500">Memuat data dari database...</div>
            ) : error ? (
              <div className="text-center py-10 text-red-500">
                <p className="font-bold">Gagal terhubung ke Database!</p>
                <p className="text-sm mt-1">Pastikan server/database PostgreSQl berjalan.</p>
              </div>
            ) : sortedData.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                <Database className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-700">Tidak Ada Data</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  Tabel <b>monitoring_data</b> di database kosong untuk bulan {selectedMonth}. 
                  Silakan pastikan Auto-Seed berhasil dijalankan atau isi melalui aplikasi Mobile.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold tracking-wider rounded-t-lg">
                    <tr>
                      <th className="px-5 py-4 rounded-tl-lg">Tanggal</th>
                      <th className="px-5 py-4">Titik Jaringan</th>
                      <th className="px-5 py-4">Sesi</th>
                      <th className="px-5 py-4 text-right">Tinggi Air (cm)</th>
                      <th className="px-5 py-4 text-right rounded-tr-lg">Tekanan (bar)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedData.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-700">
                          {new Date(row.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-800">{getName(row.pointId)}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.session === "pagi" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}`}>
                            {row.session.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-700">{row.tinggiAir !== null ? row.tinggiAir : "—"}</td>
                        <td className="px-5 py-3 text-right tabular-nums font-medium text-blue-600">{row.tekanan !== null ? row.tekanan.toFixed(2) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
