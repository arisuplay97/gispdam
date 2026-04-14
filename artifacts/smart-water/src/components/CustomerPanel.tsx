import React, { useState, useEffect } from "react";
import { Users, Plus, X, Edit2, Trash2, MapPin, Save, Loader2, Search } from "lucide-react";
import {
  Customer,
  useListCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
} from "../hooks/useCustomers";

interface CustomerPanelProps {
  onClose: () => void;
  // Let the parent handle turning map-click mode on/off
  // When active, the map overrides standard click to call onLocationSelected
  onActivateMapSelect: (callback: (lat: number, lng: number) => void) => void;
  onDeactivateMapSelect: () => void;
}

export function CustomerPanel({ onClose, onActivateMapSelect, onDeactivateMapSelect }: CustomerPanelProps) {
  const { data: customers = [], isLoading } = useListCustomers();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const [view, setView] = useState<"list" | "form">("list");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form State
  const [formData, setFormData] = useState<Partial<Customer>>({
    nama_pelanggan: "",
    id_pelanggan: "",
    alamat: "",
    elevasi_m: 0,
    spam_name: "SPAM Aiq Bone",
    lat: 0,
    lng: 0,
  });

  // Filtered customers
  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.nama_pelanggan.toLowerCase().includes(q) || c.id_pelanggan.toLowerCase().includes(q) || (c.alamat || "").toLowerCase().includes(q);
  });

  const [isMapSelecting, setIsMapSelecting] = useState(false);

  // Toggle to form
  const handleAdd = () => {
    setEditingCustomer(null);
    const randomId = Math.floor(100000000 + Math.random() * 900000000).toString();
    setFormData({
      nama_pelanggan: "",
      id_pelanggan: randomId,
      alamat: "",
      elevasi_m: 0,
      spam_name: "SPAM Aiq Bone",
      lat: -8.65,
      lng: 116.32,
    });
    setView("form");
  };

  const handleEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData(c);
    setView("form");
  };

  const handleDelete = async (id: string) => {
    if (confirm("Ingin menghapus data pelanggan ini?")) {
      await deleteCustomer.mutateAsync(id);
    }
  };

  const handleSave = async () => {
    if (editingCustomer) {
      await updateCustomer.mutateAsync(formData as Customer);
    } else {
      await createCustomer.mutateAsync(formData as any);
    }
    setView("list");
  };

  // Map Selector Interop
  const startMapSelection = () => {
    setIsMapSelecting(true);
    onActivateMapSelect((lat, lng) => {
      setFormData((prev) => ({ ...prev, lat, lng }));
      setIsMapSelecting(false);
      onDeactivateMapSelect();
    });
  };

  const cancelMapSelection = () => {
    setIsMapSelecting(false);
    onDeactivateMapSelect();
  }

  // Effect cleanup
  useEffect(() => {
    return () => {
      onDeactivateMapSelect();
    };
  }, [onDeactivateMapSelect]);

  if (isMapSelecting) {
    return (
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] bg-blue-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-bounce">
        <MapPin className="h-5 w-5" />
        <span className="font-semibold">Silakan klik lokasi pelanggan di Peta</span>
        <button 
          onClick={cancelMapSelection}
          className="ml-2 bg-white/20 hover:bg-white/30 rounded-full p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-4 top-20 bottom-6 z-[1000] flex justify-center pointer-events-none">
      <div className="w-[800px] h-full max-h-[85vh] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 flex flex-col pointer-events-auto overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Manajemen Data Pelanggan</h2>
              <p className="text-xs text-slate-500">Kelola dan Petakan Distribusi Pelanggan</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-6">
          {view === "list" ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2 bg-slate-100/50 p-3 rounded-lg border border-slate-200">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama, ID, atau alamat..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 shrink-0">
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {filteredCustomers.length}/{customers.length} pelanggan
                  </span>
                  <button
                    onClick={handleAdd}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 flex items-center gap-2 rounded-lg text-sm font-semibold transition-colors shadow-sm whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" /> Tambah Data
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 text-blue-500 animate-spin" /></div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">ID</th>
                        <th className="px-4 py-3 font-semibold">Nama</th>
                        <th className="px-4 py-3 font-semibold">Alamat</th>
                        <th className="px-4 py-3 font-semibold">Elev (m)</th>
                        <th className="px-4 py-3 font-semibold text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCustomers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono text-blue-600 text-xs">{c.id_pelanggan}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{c.nama_pelanggan}</td>
                          <td className="px-4 py-3 min-w-[200px] truncate">{c.alamat}</td>
                          <td className="px-4 py-3">{c.elevasi_m}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="h-4 w-4" /></button>
                              <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <tr><td colSpan={5} className="p-6 text-center text-slate-400">
                          {searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : "Belum ada pelanggan."}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-xl border border-slate-200 rounded-xl bg-slate-50/50 p-6 mx-auto">
              <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2">{editingCustomer ? "Edit Pelanggan" : "Tambah Pelanggan Baru"}</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">No Pelanggan / ID</label>
                    <input type="text" className="w-full rounded-lg border-slate-300 shadow-sm sm:text-sm px-3 py-2 bg-white" 
                           value={formData.id_pelanggan} onChange={(e) => setFormData({...formData, id_pelanggan: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama Lengkap</label>
                    <input type="text" className="w-full rounded-lg border-slate-300 shadow-sm sm:text-sm px-3 py-2 bg-white" 
                           value={formData.nama_pelanggan} onChange={(e) => setFormData({...formData, nama_pelanggan: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Alamat / Desa</label>
                  <textarea className="w-full rounded-lg border-slate-300 shadow-sm sm:text-sm px-3 py-2 bg-white" rows={2}
                            value={formData.alamat} onChange={(e) => setFormData({...formData, alamat: e.target.value})}></textarea>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Elevasi (meter)</label>
                    <input type="number" className="w-full rounded-lg border-slate-300 shadow-sm sm:text-sm px-3 py-2 bg-white" 
                           value={formData.elevasi_m} onChange={(e) => setFormData({...formData, elevasi_m: parseFloat(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Latitude</label>
                    <input type="number" step="any" className="w-full rounded-lg border-slate-300 shadow-sm sm:text-sm px-3 py-2 bg-slate-100 text-slate-500" 
                           value={formData.lat} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Longitude</label>
                    <input type="number" step="any" className="w-full rounded-lg border-slate-300 shadow-sm sm:text-sm px-3 py-2 bg-slate-100 text-slate-500" 
                           value={formData.lng} readOnly />
                  </div>
                </div>

                <div className="mt-2 bg-blue-50/50 border border-blue-100 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Penentuan Lokasi Meter Air</p>
                    <p className="text-xs text-slate-500 mt-1">Sematkan koordinat secara presisi dari peta</p>
                  </div>
                  <button type="button" onClick={startMapSelection} className="flex flex-col items-center gap-1 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 px-4 py-2 rounded-lg transition-all text-xs font-semibold text-slate-600 shadow-sm">
                    <MapPin className="h-5 w-5" />
                    Pilih di Peta
                  </button>
                </div>

                <div className="pt-6 border-t border-slate-200 mt-6 flex justify-end gap-3">
                  <button onClick={() => setView("list")} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-sm transition-colors">Batal</button>
                  <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50">
                    {(createCustomer.isPending || updateCustomer.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Simpan Data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
