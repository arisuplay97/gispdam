import React, { useRef, useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, FeatureGroup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { EditControl } from "react-leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

import { useCreateValve, useCreatePipe, useUpdateValve, useDeleteValve, useUpdatePipe, useDeletePipe, getListValvesQueryKey, getListPipesQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Valve, Pipe, WaterSource } from "@workspace/api-client-react";

// Fix leaflet icon paths
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
  const updateValve = useUpdateValve();
  const deleteValve = useDeleteValve();
  
  const getValveColor = (status: string) => {
    switch(status) {
      case 'normal': return '#00ff00';
      case 'warning': return '#ffff00';
      case 'critical': return '#ff0000';
      default: return '#00ffff';
    }
  };

  const createValveIcon = (status: string) => {
    const color = getValveColor(status);
    return L.divIcon({
      className: 'bg-transparent',
      html: `<div style="width: 16px; height: 16px; border-radius: 50%; background-color: ${color}; box-shadow: 0 0 10px ${color}, 0 0 20px ${color}; border: 2px solid #000;"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
  };

  const createSourceIcon = () => {
    return L.divIcon({
      className: 'bg-transparent',
      html: `<div style="width: 20px; height: 20px; background-color: #00ffff; box-shadow: 0 0 10px #00ffff; border: 2px solid #000; transform: rotate(45deg);"></div>`,
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
          name: `New Valve ${idStr}`,
          lat,
          lng,
          pressure: 6.0
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          toast.success("Valve created");
        }
      });
    } else if (layerType === 'polyline') {
      const latlngs = layer.getLatLngs();
      const coords = latlngs.map((ll: any) => [ll.lng, ll.lat]);
      
      createPipe.mutate({
        data: {
          name: `Pipe-${Math.floor(Math.random() * 1000)}`,
          coordinates: coords
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPipesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          toast.success("Pipe created");
        }
      });
    }
  };

  return (
    <div className="w-full h-full relative">
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
            <Popup className="scada-popup">
              <div className="bg-card text-card-foreground p-3 rounded-md border border-primary/50 shadow-[0_0_15px_rgba(0,255,255,0.2)]">
                <h3 className="font-bold text-primary font-mono">{source.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">Water Source</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {pipes.map(pipe => (
          <Polyline 
            key={`pipe-${pipe.id}`}
            positions={pipe.coordinates.map(c => [c[1], c[0]])}
            color="#00ffff"
            weight={3}
            opacity={0.6}
            dashArray="5, 10"
          >
            <Popup>
              <div className="bg-card text-card-foreground p-3 rounded-md border border-primary/50 shadow-[0_0_15px_rgba(0,255,255,0.2)]">
                <h3 className="font-bold text-primary font-mono">{pipe.name}</h3>
                <p className="text-xs">Diameter: {pipe.diameter || 'Unknown'}mm</p>
                <p className="text-xs">Material: {pipe.material || 'Unknown'}</p>
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
              <div className="bg-card text-card-foreground p-3 rounded-md border border-primary/50 shadow-[0_0_15px_rgba(0,255,255,0.2)] min-w-[200px]">
                <div className="flex justify-between items-center mb-2 border-b border-border pb-2">
                  <h3 className="font-bold text-primary font-mono">{valve.valveId}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wider font-bold
                    ${valve.status === 'normal' ? 'bg-green-500/20 text-green-500 border border-green-500/50' : 
                      valve.status === 'warning' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 
                      'bg-red-500/20 text-red-500 border border-red-500/50'}`}>
                    {valve.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm"><span className="text-muted-foreground">Name:</span> {valve.name}</p>
                  <p className="text-sm flex items-center justify-between">
                    <span className="text-muted-foreground">Pressure:</span>
                    <span className={`font-mono text-lg font-bold
                      ${valve.status === 'normal' ? 'text-green-400' : 
                      valve.status === 'warning' ? 'text-yellow-400' : 
                      'text-red-400'}`}>
                      {valve.pressure.toFixed(2)} bar
                    </span>
                  </p>
                </div>
                {editMode && (
                  <div className="mt-3 pt-3 border-t border-border flex justify-end">
                    <button 
                      className="text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded hover:bg-destructive/90"
                      onClick={() => {
                        deleteValve.mutate({ id: valve.id }, {
                          onSuccess: () => {
                            queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
                          }
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-[1000] bg-card/90 backdrop-blur-md p-4 rounded-lg border border-primary/30 shadow-[0_0_20px_rgba(0,255,255,0.1)]">
        <h4 className="text-primary font-mono text-sm uppercase font-bold tracking-widest mb-3 border-b border-primary/20 pb-2">Legend</h4>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-[#00ff00] shadow-[0_0_10px_#00ff00] border-2 border-black"></div>
            <span>Normal ({">"}5 bar)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-[#ffff00] shadow-[0_0_10px_#ffff00] border-2 border-black"></div>
            <span>Warning (2-5 bar)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-[#ff0000] shadow-[0_0_10px_#ff0000] border-2 border-black"></div>
            <span>Critical ({"<"}2 bar)</span>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-border/50">
            <div className="w-4 h-4 bg-[#00ffff] shadow-[0_0_10px_#00ffff] border-2 border-black transform rotate-45"></div>
            <span>Water Source</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-[2px] border-b-2 border-dashed border-[#00ffff]"></div>
            <span>Pipe</span>
          </div>
        </div>
      </div>
    </div>
  );
}
