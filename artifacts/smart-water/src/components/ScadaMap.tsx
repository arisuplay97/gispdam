import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  FeatureGroup,
  LayersControl,
  useMapEvents,
  Circle,
  ZoomControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { EditControl } from "react-leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import { LineChart, Line, Tooltip as RechartsTooltip, YAxis } from "recharts";

import {
  useCreateValve,
  useCreatePipe,
  useDeleteValve,
  useUpdateValve,
  getListValvesQueryKey,
  getListPipesQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Valve, Pipe, WaterSource, PressureRecord } from "@workspace/api-client-react";

// ─── Fix default Leaflet icon URLs ─────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ─── Types ──────────────────────────────────────────────────────────────────
interface PipelineFeature {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: { id: string; name: string; targetValveId?: string; from_name?: string; to_name?: string };
}

interface PipelineGeoJSON {
  type: "FeatureCollection";
  features: PipelineFeature[];
}

export interface ScadaMapProps {
  valves: Valve[];
  pipes: Pipe[];
  sources: WaterSource[];
  editMode: boolean;
  addValveMode: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  pipelineGeoJSON?: PipelineGeoJSON;
  pressureHistory?: PressureRecord[];
  showHeatmap: boolean;
  pipelineWeight?: number;
}

// ─── Inner: Map click handler ────────────────────────────────────────────────
function MapClickHandler({
  active,
  onMapClick,
}: {
  active: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (active && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// ─── Inner: Valve popup with mini pressure chart ──────────────────────────
function ValvePopupContent({
  valve,
  pressureHistory,
  editMode,
  onDelete,
}: {
  valve: Valve;
  pressureHistory: PressureRecord[];
  editMode: boolean;
  onDelete: () => void;
  onUpdatePressure: (id: number, delta: number) => void;
}) {
  // Get the last 5 pressure records for this valve (chronological order)
  const valveHistory = pressureHistory
    .filter((r) => r.valveId === valve.valveId)
    .slice(-5);

  const statusLabels: Record<string, string> = {
    normal: "Normal",
    warning: "Peringatan",
    critical: "Kritis",
  };

  const statusColor =
    valve.status === "normal"
      ? "text-green-700"
      : valve.status === "warning"
      ? "text-amber-700"
      : "text-red-700";

  const badgeCls =
    valve.status === "normal"
      ? "bg-green-50 text-green-700 border border-green-200"
      : valve.status === "warning"
      ? "bg-amber-50 text-amber-700 border border-amber-200"
      : "bg-red-50 text-red-700 border border-red-200";

  return (
    <div style={{ minWidth: 230 }} className="rounded-md bg-white text-slate-800">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
        <h3 className="font-semibold text-blue-700">{valve.valveId}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeCls}`}>
          {statusLabels[valve.status] ?? valve.status}
        </span>
      </div>

      {/* Info rows */}
      <div className="space-y-1 mb-3">
        <p className="text-sm">
          <span className="text-slate-500">Nama:</span> {valve.name}
        </p>
        <p className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Tekanan:</span>
          <span className={`font-semibold ${statusColor}`}>
            {valve.pressure.toFixed(2)} bar
          </span>
        </p>
        <p className="text-xs text-slate-400">
          Lat: {valve.lat.toFixed(6)}&nbsp;&nbsp;Lng: {valve.lng.toFixed(6)}
        </p>
      </div>

      {/* Mini pressure trend chart (last 5 records) */}
      {valveHistory.length > 0 ? (
        <div className="border-t border-slate-100 pt-2">
          <p className="mb-1.5 text-xs font-medium text-slate-500">
            📈 Tren Tekanan (5 terakhir)
          </p>
          <LineChart
            width={226}
            height={64}
            data={valveHistory}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          >
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9 }} />
            <RechartsTooltip
              contentStyle={{ fontSize: "10px", padding: "3px 7px", borderRadius: 6 }}
              formatter={(val: number) => [`${val.toFixed(2)} bar`, "Tekanan"]}
              labelFormatter={() => ""}
            />
            <Line
              type="monotone"
              dataKey="pressure"
              stroke="#1d4ed8"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#1d4ed8" }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </div>
      ) : (
        <div className="border-t border-slate-100 pt-2">
          <p className="text-xs text-slate-400 italic">Belum ada data riwayat tekanan</p>
        </div>
      )}

      {/* Control buttons */}
      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-200 pt-2">
        <button
          className="rounded bg-blue-600 py-1.5 text-xs font-medium text-white shadow hover:bg-blue-700 transition"
          onClick={() => onUpdatePressure(valve.id, 1.0)}
        >
          Buka Valve (+)
        </button>
        <button
          className="rounded bg-slate-600 py-1.5 text-xs font-medium text-white shadow hover:bg-slate-700 transition"
          onClick={() => onUpdatePressure(valve.id, -1.0)}
        >
          Tutup Valve (-)
        </button>
      </div>

      {/* Delete button (edit mode only) */}
      {editMode && (
        <div className="mt-2 flex justify-end">
          <button
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition shadow"
            onClick={onDelete}
          >
            Hapus Valve
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main ScadaMap component ─────────────────────────────────────────────────
export function ScadaMap({
  valves,
  pipes,
  sources,
  editMode,
  addValveMode,
  onMapClick,
  pipelineGeoJSON,
  pressureHistory = [],
  showHeatmap,
  pipelineWeight = 5,
}: ScadaMapProps) {
  const queryClient = useQueryClient();
  const createValve = useCreateValve();
  const createPipe = useCreatePipe();
  const deleteValve = useDeleteValve();
  const updateValve = useUpdateValve();

  const handleUpdatePressure = (id: number, delta: number) => {
    const valve = valves.find((v) => v.id === id);
    if (!valve) return;
    const newPressure = Math.max(0, valve.pressure + delta);
    updateValve.mutate({
      id,
      data: {
        name: valve.name,
        lat: valve.lat,
        lng: valve.lng,
        pressure: newPressure,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["pipelines-geojson"] });
        toast.success(`Valve ${delta > 0 ? "dibuka" : "ditutup"}. Tekanan: ${newPressure.toFixed(2)} bar`);
      },
      onError: () => toast.error("Gagal mengupdate valve"),
    });
  };

  // ── Icon factories ─────────────────────────────────────────────────────
  const createValveIcon = (status: string) => {
    const colors: Record<string, string> = {
      normal: "#16a34a",
      warning: "#f59e0b",
      critical: "#dc2626",
    };
    const color = colors[status] ?? "#2563eb";

    const glowMap: Record<string, string> = {
      normal: "0 0 8px rgba(22,163,74,0.75), 0 0 0 3px rgba(22,163,74,0.2)",
      warning: "0 0 8px rgba(245,158,11,0.75), 0 0 0 3px rgba(245,158,11,0.2)",
      critical: "0 0 10px rgba(220,38,38,0.9), 0 0 0 4px rgba(220,38,38,0.2)",
    };
    const glow = glowMap[status] ?? "0 1px 4px rgba(15,23,42,0.35)";
    const pulse = status === "critical"
      ? "animation: criticalPulse 1.1s ease-in-out infinite;"
      : "";

    return L.divIcon({
      className: "bg-transparent",
      html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:${glow};${pulse}"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  };

  const createSourceIcon = () =>
    L.divIcon({
      className: "bg-transparent",
      html: `<div style="position:relative;width:26px;height:26px">
        <div style="position:absolute;inset:0;background:#1d4ed8;border:3px solid white;box-shadow:0 0 14px rgba(29,78,216,0.8),0 0 0 5px rgba(29,78,216,0.18);border-radius:50% 50% 0 50%;transform:rotate(45deg);"></div>
        <div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(29,78,216,0.4);animation:sourceRipple 1.8s ease-out infinite;"></div>
      </div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

  // ── Leaflet-draw created handler ───────────────────────────────────────
  const onCreated = (e: any) => {
    const { layerType, layer } = e;

    if (layerType === "marker") {
      const { lat, lng } = layer.getLatLng();
      const idStr = `V-${Math.floor(Math.random() * 9000) + 1000}`;
      createValve.mutate(
        { data: { valveId: idStr, name: `Valve ${idStr}`, lat, lng, pressure: 6.0 } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
            queryClient.invalidateQueries({ queryKey: ["pipelines-geojson"] });
            toast.success("Valve berhasil ditambahkan");
          },
          onError: () => toast.error("Gagal menambahkan valve"),
        }
      );
    } else if (layerType === "polyline") {
      const latlngs = layer.getLatLngs();
      const coords = latlngs.map((ll: any) => [ll.lng, ll.lat]);
      createPipe.mutate(
        { data: { name: `Pipa-${Math.floor(Math.random() * 9000) + 1000}`, coordinates: coords } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPipesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
            toast.success("Pipa berhasil ditambahkan");
          },
          onError: () => toast.error("Gagal menambahkan pipa"),
        }
      );
    }
  };

  return (
    <div className={`relative h-full w-full${addValveMode ? " map-add-valve-mode" : ""}`}>
      <MapContainer
        center={[-8.655, 116.315]}
        zoom={14}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        {/* Zoom control moved to bottom-right */}
        <ZoomControl position="bottomright" />

        {/* Map click handler for "Add Valve" mode */}
        <MapClickHandler active={addValveMode} onMapClick={onMapClick} />

        {/* ── Layer Control: Updated Basemaps with Google Maps 2025 ── */}
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="🛰 Google Hybrid (2025)">
            <TileLayer
              url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              attribution='&copy; <a href="https://maps.google.com">Google Maps</a> 2025'
              maxZoom={22}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="🌍 Google Satellite">
            <TileLayer
              url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
              maxZoom={22}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="🗺 OpenStreetMap (Standar)">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="🛰 Esri World Imagery">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS"
              maxZoom={20}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="⛰ OpenTopoMap (Topografi)">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution='Map data: &copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)'
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* ── Animated Topological Pipelines (from /api/pipelines/geojson) ── */}
        {(pipelineGeoJSON?.features || []).map((feature) => {
          const positions = feature.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number]
          );
          return (
            <Polyline
              key={feature.properties.id}
              positions={positions}
              pathOptions={{
                color: "#38bdf8",
                weight: pipelineWeight,
                opacity: 0.95,
                className: "pipeline-animated",
              }}
            >
              <Popup>
                <div style={{ minWidth: 180 }} className="text-slate-800">
                  <h3 className="font-semibold text-blue-700 text-sm">{feature.properties.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Dari: <strong>{feature.properties.from_name ?? "Reservoir"}</strong>
                  </p>
                  <p className="text-xs text-slate-500">
                    Ke: <strong>{feature.properties.to_name ?? "Valve"}</strong>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Topologi Radial • Animasi Aliran Aktif</p>
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* ── Manually drawn pipes (stored in DB) ───────────────────── */}
        {pipes.map((pipe) => (
          <Polyline
            key={`pipe-${pipe.id}`}
            positions={pipe.coordinates.map((c) => [c[1], c[0]] as [number, number])}
            pathOptions={{
              color: "#a855f7",
              weight: Math.max(2, pipelineWeight - 2),
              opacity: 0.8,
              dashArray: "8 5",
            }}
          >
            <Popup>
              <div style={{ minWidth: 180 }} className="text-slate-800">
                <h3 className="font-semibold text-purple-700 text-sm">{pipe.name}</h3>
                <p className="text-xs mt-1">Diameter: {pipe.diameter ?? "—"} mm</p>
                <p className="text-xs">Material: {pipe.material ?? "—"}</p>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* ── Heatmap layer (pseudo-heatmap via Circle markers) ──────── */}
        {showHeatmap &&
          valves.map((valve) => (
            <Circle
              key={`heat-${valve.id}`}
              center={[valve.lat, valve.lng]}
              radius={Math.max(80, (10 - valve.pressure) * 100)}
              pathOptions={{
                fillColor:
                  valve.status === "critical"
                    ? "#dc2626"
                    : valve.status === "warning"
                    ? "#f59e0b"
                    : "#16a34a",
                fillOpacity: 0.22,
                stroke: false,
              }}
            />
          ))}

        {/* ── Water source markers ───────────────────────────────────── */}
        {sources.map((source) => (
          <Marker
            key={`source-${source.id}`}
            position={[source.lat, source.lng]}
            icon={createSourceIcon()}
          >
            <Popup>
              <div style={{ minWidth: 160 }} className="text-slate-800">
                <h3 className="font-semibold text-blue-700">{source.name}</h3>
                <p className="mt-1 text-sm text-slate-500">💧 Sumber Air PDAM</p>
                <p className="text-xs text-slate-400 mt-1">
                  {source.lat.toFixed(6)}, {source.lng.toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ── Valve markers with mini chart popup ───────────────────── */}
        {valves.map((valve) => (
          <Marker
            key={`valve-${valve.id}`}
            position={[valve.lat, valve.lng]}
            icon={createValveIcon(valve.status)}
          >
            <Popup minWidth={240} maxWidth={280}>
              <ValvePopupContent
                valve={valve}
                pressureHistory={pressureHistory}
                editMode={editMode}
                onUpdatePressure={handleUpdatePressure}
                onDelete={() => {
                  deleteValve.mutate(
                    { id: valve.id },
                    {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
                        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
                        queryClient.invalidateQueries({ queryKey: ["pipelines-geojson"] });
                        toast.success("Valve berhasil dihapus");
                      },
                      onError: () => toast.error("Gagal menghapus valve"),
                    }
                  );
                }}
              />
            </Popup>
          </Marker>
        ))}

        {/* ── Leaflet Draw (edit mode) ───────────────────────────────── */}
        {editMode && (
          <FeatureGroup>
            <EditControl
              position="topleft"
              onCreated={onCreated}
              draw={{
                rectangle: false,
                circle: false,
                circlemarker: false,
                polygon: false,
              }}
            />
          </FeatureGroup>
        )}
      </MapContainer>

      {/* ── Legend overlay ────────────────────────────────────────────── */}
      <div className="absolute bottom-6 left-6 z-[1000] rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm">
        <h4 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Legenda
        </h4>
        <div className="space-y-2 text-xs text-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="h-3.5 w-3.5 rounded-full border-2 border-white bg-green-600 shadow" />
            <span>Normal (&gt;5 bar)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-500 shadow" />
            <span>Peringatan (2–5 bar)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-3.5 w-3.5 rounded-full border-2 border-white bg-red-600 shadow" />
            <span>Kritis (&lt;2 bar)</span>
          </div>
          <div className="flex items-center gap-2.5 border-t border-slate-200 pt-2">
            <div className="h-3.5 w-3.5 rotate-45 border-2 border-white bg-blue-700 shadow" />
            <span>Sumber Air</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-[3px] w-5 rounded bg-blue-500" style={{ background: "repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 6px, transparent 6px, transparent 10px)" }} />
            <span>Pipa Utama (animasi)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-[3px] w-5 rounded" style={{ background: "repeating-linear-gradient(90deg, #7c3aed 0, #7c3aed 4px, transparent 4px, transparent 8px)" }} />
            <span>Pipa Tambahan</span>
          </div>
        </div>
      </div>

      {/* ── Add Valve Mode banner ───────────────────────────────────── */}
      {addValveMode && (
        <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-xl ring-2 ring-blue-300 animate-pulse">
          🎯 Klik pada peta untuk menentukan koordinat valve baru
        </div>
      )}
    </div>
  );
}
