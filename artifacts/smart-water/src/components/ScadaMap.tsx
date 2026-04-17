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
import { Eye, EyeOff } from "lucide-react";
import { EditControl } from "react-leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import { LineChart, Line, Tooltip as RechartsTooltip, YAxis } from "recharts";
import MarkerClusterGroup from "react-leaflet-cluster";
import { MonitoringLayer, type MonitoringData } from "./MonitoringLayer";

import {
  useCreateValve,
  useCreatePipe,
  useDeleteValve,
  useUpdateValve,
  useDeletePipe,
  getListValvesQueryKey,
  getListPipesQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Valve, Pipe, WaterSource, PressureRecord } from "@workspace/api-client-react";
import { useListCustomers } from "../hooks/useCustomers";
import { useUpdateSource } from "../hooks/useSources";
import React, { useState, useRef, useMemo } from "react";

// ─── Fix default Leaflet icon URLs ─────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ─── Module-level icon factories (must be outside components to be reusable) ───
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

function SourceMarker({ source, editMode, queryClient }: { source: WaterSource, editMode: boolean, queryClient: any }) {
  const [formName, setFormName] = useState(source.name);
  const updateSource = useUpdateSource();
  const markerRef = useRef<L.Marker>(null);

  const handleDragEnd = () => {
    const marker = markerRef.current;
    if (marker) {
      const latLng = marker.getLatLng();
      updateSource.mutate({
        id: source.id,
        data: { lat: latLng.lat, lng: latLng.lng }
      }, {
        onSuccess: () => {
          toast.success("Lokasi Sumber Air diperbarui");
          queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
        },
        onError: () => {
          toast.error("Gagal memperbarui lokasi");
        }
      });
    }
  };

  const handleUpdateName = () => {
    if (!formName.trim()) return;
    updateSource.mutate({
      id: source.id,
      data: { name: formName }
    }, {
      onSuccess: () => {
        toast.success("Nama Sumber Air diperbarui");
        queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      },
      onError: () => {
        toast.error("Gagal memperbarui nama");
      }
    });
  };

  const icon = useMemo(() => createSourceIcon(), []);

  return (
    <Marker
      position={[source.lat, source.lng]}
      icon={icon}
      draggable={editMode}
      eventHandlers={{ dragend: handleDragEnd }}
      ref={markerRef}
    >
      <Popup>
        <div style={{ minWidth: 160 }} className="text-slate-800">
          {!editMode ? (
            <>
              <h3 className="font-semibold text-blue-700">{source.name}</h3>
              <p className="mt-1 text-sm text-slate-500">💧 Sumber Air PDAM</p>
            </>
          ) : (
            <div className="space-y-2 mt-1">
              <label className="text-xs font-semibold text-slate-600 block">Ubah Nama:</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
              />
              <button
                onClick={handleUpdateName}
                disabled={updateSource.isPending}
                className="w-full bg-blue-600 text-white text-xs font-semibold py-1.5 rounded hover:bg-blue-700 transition"
              >
                {updateSource.isPending ? "Menyimpan..." : "Simpan Perbaikan"}
              </button>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-2 border-t border-slate-100 pt-1">
            {source.lat.toFixed(6)}, {source.lng.toFixed(6)}
          </p>
        </div>
      </Popup>
    </Marker>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface PipelineFeature {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: {
    id: string;
    dbId?: number;
    name: string;
    targetValveId?: string;
    from_name?: string;
    to_name?: string;
    diameter_mm?: number | null;
    material?: string | null;
    topology?: string;
  };
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
  addSourceMode?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  pipelineGeoJSON?: PipelineGeoJSON;
  pressureHistory?: PressureRecord[];
  showHeatmap: boolean;
  pipelineWeight?: number;
  pipelineColor?: string;
  pipeWeight?: number;
  pipeColor?: string;
  visibleLayers?: {
    valves: boolean;
    pipelines: boolean;
    customers: boolean;
    serviceLines: boolean;
    sources: boolean;
    pipes: boolean;
    monitoring: boolean;
  };
  onToggleLayer?: (key: string) => void;
  // Monitoring
  monitoringData: Record<string, MonitoringData>;
  onMonitoringSave: (id: string, data: MonitoringData) => void;
  macroUrl: string;
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
  onUpdatePressure,
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
        
        {/* New Metadata Rows from QGIS Import */}
        {((valve as any).diameter || (valve as any).installYear || (valve as any).condition) && (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 my-2 text-[11px] bg-slate-50 p-2 rounded border border-slate-100">
            {(valve as any).diameter && (
              <>
                <span className="text-slate-500">Diameter:</span>
                <span className="font-medium">{(valve as any).diameter} mm</span>
              </>
            )}
            {(valve as any).installYear && (
              <>
                <span className="text-slate-500">Thn Pasang:</span>
                <span className="font-medium">{(valve as any).installYear}</span>
              </>
            )}
            {(valve as any).condition && (
              <>
                <span className="text-slate-500">Kondisi:</span>
                <span className="font-medium">{(valve as any).condition}</span>
              </>
            )}
          </div>
        )}

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
  addSourceMode,
  onMapClick,
  pipelineGeoJSON,
  pressureHistory = [],
  showHeatmap,
  pipelineWeight = 5,
  pipelineColor = "#38bdf8",
  pipeWeight = 3,
  pipeColor = "#a855f7",
  visibleLayers = {
    valves: true, pipelines: true, customers: true,
    serviceLines: true, sources: true, pipes: true, monitoring: true,
  },
  onToggleLayer,
  monitoringData,
  onMonitoringSave,
  macroUrl,
}: ScadaMapProps) {
  const queryClient = useQueryClient();
  const createValve = useCreateValve();
  const createPipe = useCreatePipe();
  const deleteValve = useDeleteValve();
  const updateValve = useUpdateValve();
  const deletePipe = useDeletePipe();

  const { data: rawCustomers } = useListCustomers();
  const customers = Array.isArray(rawCustomers) ? rawCustomers : [];

  // Hover layer highlight state
  const [hoveredLegendLayer, setHoveredLegendLayer] = React.useState<string | null>(null);
  const [showLegend, setShowLegend] = React.useState(true);

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

  // createSourceIcon is now at module level above

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

        {/* Map click handler for "Add Valve" / "Add Source" mode */}
        <MapClickHandler active={addValveMode || Boolean(addSourceMode)} onMapClick={onMapClick} />

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

          <LayersControl.BaseLayer name="🗺 Google Maps (Terbaru)">
            <TileLayer
               url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
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

          <LayersControl.BaseLayer name="✨ Clean Smooth Light">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              maxZoom={20}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="🌑 Peta Gelap (Dark Mode)">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              maxZoom={20}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* ── Animated Topological Pipelines (from /api/pipelines/geojson) ── */}
        {visibleLayers.pipelines && (pipelineGeoJSON?.features || []).map((feature) => {
          const positions = feature.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number]
          );
          return (
            <Polyline
              key={feature.properties.id}
              positions={positions}
              pathOptions={{
                color: pipelineColor,
                weight: hoveredLegendLayer === "pipelines" ? pipelineWeight + 3 : pipelineWeight,
                opacity: visibleLayers.pipelines ? (hoveredLegendLayer === "pipelines" ? 1 : 0.95) : 0,
                className: "pipeline-animated",
              }}
            >
              <Popup>
                <div style={{ minWidth: 190 }} className="text-slate-800">
                  <h3 className="font-semibold text-blue-700 text-sm mb-2">{feature.properties.name}</h3>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] mb-2">
                    <span className="text-slate-500">Dari:</span>
                    <span className="font-medium">{feature.properties.from_name ?? "Reservoir"}</span>
                    <span className="text-slate-500">Ke:</span>
                    <span className="font-medium">{feature.properties.to_name ?? "Valve"}</span>
                    {feature.properties.diameter_mm && (
                      <>
                        <span className="text-slate-500">Diameter:</span>
                        <span className="font-medium">{feature.properties.diameter_mm} mm</span>
                      </>
                    )}
                    {feature.properties.material && (
                      <>
                        <span className="text-slate-500">Material:</span>
                        <span className="font-medium">{feature.properties.material}</span>
                      </>
                    )}
                  </div>
                  {editMode && feature.properties.dbId && (
                    <button
                      className="mt-1 w-full rounded bg-red-600 py-1.5 text-xs font-medium text-white shadow hover:bg-red-700 transition"
                      onClick={() => {
                        deletePipe.mutate({ id: feature.properties.dbId! }, {
                          onSuccess: () => {
                            queryClient.invalidateQueries({ queryKey: getListPipesQueryKey() });
                            queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
                            queryClient.invalidateQueries({ queryKey: ["pipelines-geojson"] });
                            toast.success("Pipa berhasil dihapus");
                          },
                          onError: () => toast.error("Gagal menghapus pipa"),
                        });
                      }}
                    >
                      🗑 Hapus Pipa
                    </button>
                  )}
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* ── Manually drawn pipes (stored in DB) ───────────────────────── */}
        {visibleLayers.pipes && pipes.map((pipe) => (
          <Polyline
            key={`pipe-${pipe.id}`}
            positions={pipe.coordinates.map((c) => [c[1], c[0]] as [number, number])}
            pathOptions={{
              color: pipeColor,
              weight: Math.max(2, pipeWeight),
              opacity: visibleLayers.pipes ? (hoveredLegendLayer === "pipes" ? 1 : 0.85) : 0,
              dashArray: "10 10",
              className: "pipe-db-animated",
            }}
          >
            <Popup>
              <div style={{ minWidth: 180 }} className="text-slate-800">
                <h3 className="font-semibold text-purple-700 text-sm">{pipe.name}</h3>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2 mb-3 text-[10px]">
                  <span className="text-slate-500">Diameter:</span>
                  <span className="font-medium text-slate-700">{pipe.diameter ?? "—"} mm</span>
                  
                  <span className="text-slate-500">Material:</span>
                  <span className="font-medium text-slate-700">{pipe.material ?? "—"}</span>
                  
                  {(pipe as any).zone && (
                    <>
                      <span className="text-slate-500">Zona:</span>
                      <span className="font-medium text-slate-700">{(pipe as any).zone}</span>
                    </>
                  )}
                  
                  {(pipe as any).spam && (
                    <>
                      <span className="text-slate-500">SPAM:</span>
                      <span className="font-medium text-slate-700">{(pipe as any).spam}</span>
                    </>
                  )}
                </div>

                {editMode && (
                  <button
                    className="w-full rounded bg-red-600 py-1.5 text-xs font-medium text-white shadow hover:bg-red-700 transition"
                    onClick={() => {
                      deletePipe.mutate({ id: pipe.id }, {
                        onSuccess: () => {
                          queryClient.invalidateQueries({ queryKey: getListPipesQueryKey() });
                          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
                          toast.success("Pipa berhasil dihapus");
                        },
                        onError: () => toast.error("Gagal menghapus pipa"),
                      });
                    }}
                  >
                    Hapus Pipa
                  </button>
                )}
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

        {/* ── Customer markers + Service Lines ─────────────────────── */}
        <CustomersLayer
          customers={visibleLayers.customers ? customers : []}
          pipelineGeoJSON={pipelineGeoJSON}
          showServiceLines={visibleLayers.serviceLines}
          highlighted={hoveredLegendLayer === "customers" || hoveredLegendLayer === "serviceLines"}
          serviceLineHighlighted={hoveredLegendLayer === "serviceLines"}
        />

        {/* ── Water source markers ───────────────────────────────────── */}
        {visibleLayers.sources && sources.map((source) => (
          <SourceMarker
            key={`source-${source.id}`}
            source={source}
            editMode={editMode}
            queryClient={queryClient}
          />
        ))}

        {/* ── Valve markers with mini chart popup ─────────────────────── */}
        {visibleLayers.valves && valves.map((valve) => (
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
              position="topright"
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

        {/* ── Monitoring Markers (Reservoir + Makrometer) ─────────────── */}
        {visibleLayers.monitoring && (
          <MonitoringLayer
            data={monitoringData}
            onSave={onMonitoringSave}
            macroUrl={macroUrl}
          />
        )}
      </MapContainer>

      {/* ── Interactive Legend (click to toggle, hover to highlight) */}
      {!showLegend ? (
        <button
          onClick={() => setShowLegend(true)}
          className="absolute bottom-6 left-6 z-[1000] flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-sm transition-all hover:bg-white"
        >
          <Eye className="h-4 w-4 text-blue-600" />
          Tampilkan Legenda
        </button>
      ) : (
        <div className="absolute bottom-6 left-6 z-[1000] rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm" style={{ minWidth: 220 }}>
          <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Legenda &amp; Layer
            </h4>
            <button onClick={() => setShowLegend(false)} className="text-slate-400 hover:text-slate-600">
              <EyeOff className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1 text-xs">
            {([
              { key: "valves",       label: "Valve",                swatch: <span className="flex gap-0.5"><span className="h-3 w-3 rounded-full bg-green-600 border border-white shadow" /><span className="h-3 w-3 rounded-full bg-amber-500 border border-white shadow" /><span className="h-3 w-3 rounded-full bg-red-500 border border-white shadow" /></span> },
              { key: "sources",      label: "Sumber Air",           swatch: <span className="h-3.5 w-3.5 rotate-45 border-2 border-white bg-blue-700 shadow inline-block relative"><span className="absolute inset-[-4px] rounded-full border border-blue-400 opacity-50 animate-ping"></span></span> },
              { key: "pipelines",    label: "Pipa Utama",           swatch: <span className="h-[3px] w-5 rounded inline-block" style={{ background: `repeating-linear-gradient(90deg,${pipelineColor} 0,${pipelineColor} 5px,transparent 5px,transparent 9px)` }} /> },
              { key: "pipes",        label: "Pipa Tambahan",        swatch: <span className="h-[3px] w-5 rounded inline-block" style={{ background: `repeating-linear-gradient(90deg,${pipeColor} 0,${pipeColor} 4px,transparent 4px,transparent 8px)` }} /> },
              { key: "customers",    label: "Pelanggan",            swatch: <span className="h-4 w-4 rounded-full border-2 border-white bg-emerald-500 shadow inline-flex items-center justify-center shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span> },
              { key: "serviceLines", label: "Sambungan Pelanggan",  swatch: <span className="h-[2px] w-5 inline-block" style={{ background: "repeating-linear-gradient(90deg,#0ea5e9 0,#0ea5e9 4px,transparent 4px,transparent 7px)" }} /> },
              { key: "monitoring",   label: "Titik Monitoring",     swatch: <span className="h-5 w-5 rounded-full border-2 border-white bg-red-500 shadow inline-flex items-center justify-center shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span> },
            ] as Array<{ key: keyof typeof visibleLayers; label: string; swatch: React.ReactNode }>).map(({ key, label, swatch }) => {
              const isVisible = visibleLayers[key];
              const isHov = hoveredLegendLayer === key;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-all select-none ${isHov ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"} ${!isVisible ? "opacity-50" : ""}`}
                  onMouseEnter={() => setHoveredLegendLayer(key)}
                  onMouseLeave={() => setHoveredLegendLayer(null)}
                  onClick={() => onToggleLayer?.(key)}
                >
                  <span className="w-12 flex justify-center shrink-0">{swatch}</span>
                  <span className={`flex-1 ${isVisible ? "text-slate-700" : "text-slate-400 line-through"}`}>{label}</span>
                  <span className="ml-auto text-slate-400">
                    {isVisible ? <Eye className="h-3.5 w-3.5 text-blue-500" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">Hover untuk sorot • Klik item untuk sembunyikan</p>
        </div>
      )}

      {/* ── Add Valve Mode banner ───────────────────────────────────── */}
      {addValveMode && (
        <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-xl ring-2 ring-blue-300 animate-pulse">
          🎯 Klik pada peta untuk menentukan koordinat valve baru
        </div>
      )}
    </div>
  );
}

// ─── Utility: closest point on line segment ─────────────────────────────────
function getClosestPointOnSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const len2 = ab.x * ab.x + ab.y * ab.y;
  if (len2 === 0) return a;
  let t = (ap.x * ab.x + ap.y * ab.y) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

// ─── Customers Layer ────────────────────────────────────────────────────────
function CustomersLayer({
  customers,
  pipelineGeoJSON,
  showServiceLines = true,
  highlighted = false,
  serviceLineHighlighted = false,
}: {
  customers: any[];
  pipelineGeoJSON: any;
  showServiceLines?: boolean;
  highlighted?: boolean;
  serviceLineHighlighted?: boolean;
}) {
  const createCustomerIcon = (c: any) => {
    const isUnpaid = c.piutang && c.piutang > 0;
    const bgNormal = isUnpaid ? '#ef4444' : '#10b981';
    const bgHighlight = isUnpaid ? '#dc2626' : '#059669';
    const shadowColor = isUnpaid ? 'rgba(239,68,68,0.7)' : 'rgba(16,185,129,0.7)';
    const bg = highlighted ? bgHighlight : bgNormal;
    const size = highlighted ? 26 : 22;
    const shBorder = highlighted ? '3px' : '2px';
    const shadow = highlighted ? `0 0 12px ${shadowColor},0 4px 6px rgba(0,0,0,0.3)` : '0 4px 6px rgba(0,0,0,0.3)';

    return L.divIcon({
      className: "custom-customer-icon",
      html: `
        <div style="background:${bg};border:${shBorder} solid white;border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;box-shadow:${shadow};transition:all 0.2s;">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
    });
  };

  const createClusterCustomIcon = function (cluster: any) {
    return L.divIcon({
      html: `<div style="background-color: #10b981; color: white; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); font-size: 14px;">${cluster.getChildCount()}</div>`,
      className: "custom-marker-cluster",
      iconSize: L.point(34, 34, true),
    });
  };

  return (
    <>
      {/* ── Render Service Lines separately from Markers ── */}
      {showServiceLines && customers.map((c: any) => {
        if (!c.lat || !c.lng) return null;

        let closestPt: [number, number] | null = null;
        let minDist = Infinity;

        if (pipelineGeoJSON?.features) {
          const pt = { x: Number(c.lng), y: Number(c.lat) };
          for (const f of pipelineGeoJSON.features) {
            if (f.geometry?.type !== "LineString") continue;
            const coords = f.geometry.coordinates;
            for (let i = 0; i < coords.length - 1; i++) {
              const a = { x: coords[i][0], y: coords[i][1] };
              const b = { x: coords[i + 1][0], y: coords[i + 1][1] };
              const proj = getClosestPointOnSegment(pt, a, b);
              const dx = pt.x - proj.x;
              const dy = pt.y - proj.y;
              const dist = dx * dx + dy * dy;
              if (dist < minDist) {
                minDist = dist;
                closestPt = [proj.y, proj.x];
              }
            }
          }
        }

        if (!closestPt) return null;

        return (
          <Polyline
            key={`line-${c.id}`}
            positions={[closestPt, [Number(c.lat), Number(c.lng)]]}
            pathOptions={{
              color: serviceLineHighlighted ? "#0284c7" : "#0ea5e9",
              weight: serviceLineHighlighted ? 3 : 2,
              dashArray: serviceLineHighlighted ? "6, 4" : "4, 6",
              opacity: serviceLineHighlighted ? 1 : 0.85,
            }}
          />
        );
      })}

      {/* ── Render Customer Markers with Cluster ── */}
      <MarkerClusterGroup
        chunkedLoading
        iconCreateFunction={createClusterCustomIcon}
        showCoverageOnHover={false}
        maxClusterRadius={50}
      >
        {customers.map((c: any) => {
          if (!c.lat || !c.lng) return null;
          const isUnpaid = c.piutang && c.piutang > 0;
          return (
            <Marker key={`marker-${c.id}`} position={[Number(c.lat), Number(c.lng)]} icon={createCustomerIcon(c)}>
              <Popup className="custom-popup">
                <div className="p-1" style={{ minWidth: 210 }}>
                  <div className="flex items-center gap-2 mb-2 border-b pb-2">
                    <div style={{ background: isUnpaid ? "#fee2e2" : "#d1fae5", padding: 6, borderRadius: "50%", color: isUnpaid ? "#dc2626" : "#059669" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    </div>
                    <div>
                      <h3 style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{c.nama_pelanggan}</h3>
                      <p style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{c.id_pelanggan}</p>
                    </div>
                  </div>
                  <table style={{ fontSize: 11, width: "100%" }}>
                    <tbody>
                      <tr><td style={{ color: "#94a3b8", paddingRight: 8, paddingBottom: 4 }}>Status</td><td style={{ fontWeight: 600, paddingBottom: 4, color: isUnpaid ? "#dc2626" : "#059669" }}>{isUnpaid ? `Belum Bayar (Rp ${c.piutang.toLocaleString('id-ID')})` : "Lunas"}</td></tr>
                      <tr><td style={{ color: "#94a3b8", paddingRight: 8 }}>Alamat</td><td style={{ fontWeight: 500 }}>{c.alamat}</td></tr>
                      <tr><td style={{ color: "#94a3b8" }}>Elevasi</td><td style={{ fontWeight: 600, color: "#059669" }}>{c.elevasi_m} m</td></tr>
                      <tr><td style={{ color: "#94a3b8" }}>SPAM</td><td>{c.spam_name}</td></tr>
                    </tbody>
                  </table>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
    </>
  );
}

// Fix typescript complains
export {};
