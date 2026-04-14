import { MapContainer, TileLayer, Marker, Polyline, Popup, FeatureGroup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { EditControl } from "react-leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

import { useCreateValve, useCreatePipe, useDeleteValve, getListValvesQueryKey, getListPipesQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Valve, Pipe, WaterSource } from "@workspace/api-client-react";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface ScadaMapProps {
  valves: Valve[];
  pipes: Pipe[];
  sources: WaterSource[];
  editMode: boolean;
}

export function ScadaMap({ valves, pipes, sources, editMode }: ScadaMapProps) {
  const queryClient = useQueryClient();
  const createValve = useCreateValve();
  const createPipe = useCreatePipe();
  const deleteValve = useDeleteValve();

  const getValveColor = (status: string) => {
    switch(status) {
      case 'normal': return '#16a34a';
      case 'warning': return '#f59e0b';
      case 'critical': return '#dc2626';
      default: return '#2563eb';
    }
  };

  const statusLabel = (status: string) => {
    switch(status) {
      case 'normal': return 'Normal';
      case 'warning': return 'Peringatan';
      case 'critical': return 'Kritis';
      default: return status;
    }
  };

  const createValveIcon = (status: string) => {
    const color = getValveColor(status);
    return L.divIcon({
      className: 'bg-transparent',
      html: `<div style="width: 16px; height: 16px; border-radius: 50%; background-color: ${color}; border: 2px solid white; box-shadow: 0 1px 4px rgba(15,23,42,0.35);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
  };

  const createSourceIcon = () => {
    return L.divIcon({
      className: 'bg-transparent',
      html: `<div style="width: 20px; height: 20px; background-color: #2563eb; border: 2px solid white; box-shadow: 0 1px 4px rgba(15,23,42,0.35); transform: rotate(45deg);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  };

  const onCreated = (e: any) => {
    const { layerType, layer } = e;

    if (layerType === 'marker') {
      const { lat, lng } = layer.getLatLng();
      const idStr = `V-${Math.floor(Math.random() * 1000)}`;
      createValve.mutate({
        data: {
          valveId: idStr,
          name: `Valve Baru ${idStr}`,
          lat,
          lng,
          pressure: 6.0
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          toast.success("Valve berhasil ditambahkan");
        },
        onError: () => {
          toast.error("Gagal menambahkan valve");
        }
      });
    } else if (layerType === 'polyline') {
      const latlngs = layer.getLatLngs();
      const coords = latlngs.map((ll: any) => [ll.lng, ll.lat]);

      createPipe.mutate({
        data: {
          name: `Pipa-${Math.floor(Math.random() * 1000)}`,
          coordinates: coords
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPipesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          toast.success("Pipa berhasil ditambahkan");
        },
        onError: () => {
          toast.error("Gagal menambahkan pipa");
        }
      });
    }
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[-8.65, 116.31]}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />

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

        {sources.map(source => (
          <Marker
            key={`source-${source.id}`}
            position={[source.lat, source.lng]}
            icon={createSourceIcon()}
          >
            <Popup>
              <div className="min-w-[160px] rounded-md bg-white p-2 text-slate-800">
                <h3 className="font-semibold text-blue-700">{source.name}</h3>
                <p className="mt-1 text-sm text-slate-500">Sumber air</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {pipes.map(pipe => (
          <Polyline
            key={`pipe-${pipe.id}`}
            positions={pipe.coordinates.map(c => [c[1], c[0]])}
            color="#2563eb"
            weight={4}
            opacity={0.75}
          >
            <Popup>
              <div className="min-w-[180px] rounded-md bg-white p-2 text-slate-800">
                <h3 className="font-semibold text-blue-700">{pipe.name}</h3>
                <p className="text-sm">Diameter: {pipe.diameter || 'Belum diisi'} mm</p>
                <p className="text-sm">Material: {pipe.material || 'Belum diisi'}</p>
              </div>
            </Popup>
          </Polyline>
        ))}

        {valves.map(valve => (
          <Marker
            key={`valve-${valve.id}`}
            position={[valve.lat, valve.lng]}
            icon={createValveIcon(valve.status)}
          >
            <Popup>
              <div className="min-w-[200px] rounded-md bg-white p-2 text-slate-800">
                <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-semibold text-blue-700">{valve.valveId}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium
                    ${valve.status === 'normal' ? 'bg-green-50 text-green-700 border border-green-200' :
                      valve.status === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-red-50 text-red-700 border border-red-200'}`}>
                    {statusLabel(valve.status)}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm"><span className="text-slate-500">Nama:</span> {valve.name}</p>
                  <p className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Tekanan:</span>
                    <span className={`font-semibold
                      ${valve.status === 'normal' ? 'text-green-700' :
                      valve.status === 'warning' ? 'text-amber-700' :
                      'text-red-700'}`}>
                      {valve.pressure.toFixed(2)} bar
                    </span>
                  </p>
                </div>
                {editMode && (
                  <div className="mt-3 flex justify-end border-t border-slate-200 pt-3">
                    <button
                      className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                      onClick={() => {
                        deleteValve.mutate({ id: valve.id }, {
                          onSuccess: () => {
                            queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
                            queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
                            toast.success("Valve berhasil dihapus");
                          },
                          onError: () => {
                            toast.error("Gagal menghapus valve");
                          }
                        });
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute bottom-6 left-6 z-[1000] rounded-lg border border-slate-200 bg-white/95 p-4 shadow-md">
        <h4 className="mb-3 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-800">Legenda</h4>
        <div className="space-y-3 text-sm text-slate-700">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-full border-2 border-white bg-green-600 shadow-sm"></div>
            <span>Normal ({">"}5 bar)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-full border-2 border-white bg-amber-500 shadow-sm"></div>
            <span>Peringatan (2-5 bar)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-full border-2 border-white bg-red-600 shadow-sm"></div>
            <span>Kritis ({"<"}2 bar)</span>
          </div>
          <div className="flex items-center gap-3 border-t border-slate-200 pt-2">
            <div className="h-4 w-4 rotate-45 border-2 border-white bg-blue-700 shadow-sm"></div>
            <span>Sumber air</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-[3px] w-6 bg-blue-700"></div>
            <span>Pipa</span>
          </div>
        </div>
      </div>
    </div>
  );
}
