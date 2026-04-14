import React, { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DashboardStats, PressureRecord } from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Activity, AlertTriangle, Droplets, Map, Upload, Download, Power, Zap } from "lucide-react";
import { useImportGeoJson, useExportGeoJson, useExportCsv, getListValvesQueryKey, getListPipesQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface DashboardSidebarProps {
  stats?: DashboardStats;
  pressureHistory?: PressureRecord[];
  editMode: boolean;
  setEditMode: (v: boolean) => void;
}

export function DashboardSidebar({ stats, pressureHistory, editMode, setEditMode }: DashboardSidebarProps) {
  const queryClient = useQueryClient();
  const importGeoJson = useImportGeoJson();
  
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        importGeoJson.mutate({ data: json }, {
          onSuccess: (res) => {
            toast.success(`Imported ${res.valvesImported} valves and ${res.pipesImported} pipes`);
            queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListPipesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          },
          onError: () => {
            toast.error("Failed to import GeoJSON");
          }
        });
      } catch (err) {
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  const handleExportGeoJson = async () => {
    window.open('/api/export/geojson', '_blank');
  };

  const handleExportCsv = async () => {
    window.open('/api/export/csv', '_blank');
  };

  return (
    <aside className="w-[380px] bg-sidebar border-r border-sidebar-border h-full flex flex-col z-20 shadow-[4px_0_24px_rgba(0,255,255,0.05)] overflow-y-auto">
      <div className="p-6 border-b border-sidebar-border bg-sidebar-accent/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center border border-primary/50 shadow-[0_0_15px_rgba(0,255,255,0.3)]">
            <Droplets className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold tracking-tight text-glow uppercase">SmartWater</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">SCADA System v1.0</p>
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 space-y-8">
        {/* Status Overview */}
        <section>
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity className="w-3 h-3" /> System Overview
          </h2>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border p-4 rounded-lg relative overflow-hidden group">
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-xs text-muted-foreground uppercase font-mono mb-1">Total Valves</p>
              <p className="text-2xl font-bold font-mono text-glow">{stats?.totalValves || 0}</p>
            </div>
            <div className="bg-card border border-border p-4 rounded-lg relative overflow-hidden group">
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-xs text-muted-foreground uppercase font-mono mb-1">Total Pipes</p>
              <p className="text-2xl font-bold font-mono text-glow">{stats?.totalPipes || 0}</p>
            </div>
          </div>
          
          <div className="mt-3 bg-card border border-border p-4 rounded-lg">
             <p className="text-xs text-muted-foreground uppercase font-mono mb-2">Avg Network Pressure</p>
             <div className="flex items-end gap-2">
               <p className="text-4xl font-bold font-mono text-primary text-glow">{stats?.avgPressure?.toFixed(2) || '0.00'}</p>
               <span className="text-muted-foreground mb-1 font-mono">bar</span>
             </div>
          </div>
        </section>

        {/* Valve Health */}
        <section>
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3" /> Valve Health
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded bg-card border border-border">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#00ff00] glow-green" />
                <span className="font-mono text-sm uppercase">Normal</span>
              </div>
              <span className="font-mono font-bold text-[#00ff00] text-glow">{stats?.normalCount || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded bg-card border border-border">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#ffff00] glow-yellow" />
                <span className="font-mono text-sm uppercase">Warning</span>
              </div>
              <span className="font-mono font-bold text-[#ffff00] text-glow">{stats?.warningCount || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded bg-card border border-border">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#ff0000] glow-red" />
                <span className="font-mono text-sm uppercase">Critical</span>
              </div>
              <span className="font-mono font-bold text-[#ff0000] text-glow">{stats?.criticalCount || 0}</span>
            </div>
          </div>
        </section>

        {/* Pressure Trend */}
        <section>
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <Zap className="w-3 h-3" /> Network Pressure Trend
          </h2>
          <div className="h-48 bg-card border border-border rounded-lg p-3">
            {pressureHistory && pressureHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pressureHistory.slice(-20)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis domain={['auto', 'auto']} stroke="rgba(255,255,255,0.5)" fontSize={10} width={30} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontFamily: 'monospace' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Line type="monotone" dataKey="pressure" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-mono">
                NO DATA AVAILABLE
              </div>
            )}
          </div>
        </section>

        {/* Controls */}
        <section className="pb-6">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <Power className="w-3 h-3" /> Network Controls
          </h2>
          
          <div className="bg-card border border-border p-4 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-mode" className="font-mono uppercase text-xs cursor-pointer flex items-center gap-2">
                <Map className="w-4 h-4 text-primary" /> Map Edit Mode
              </Label>
              <Switch id="edit-mode" checked={editMode} onCheckedChange={setEditMode} className="data-[state=checked]:bg-primary" />
            </div>
            
            <div className="h-px bg-border w-full my-2" />
            
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Button variant="outline" className="w-full font-mono text-xs border-primary/30 hover:border-primary hover:bg-primary/10 hover:text-primary">
                  <Upload className="w-3 h-3 mr-2" /> Import
                </Button>
                <input 
                  type="file" 
                  accept=".geojson,.json" 
                  onChange={handleImport}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <Button variant="outline" onClick={handleExportGeoJson} className="w-full font-mono text-xs border-primary/30 hover:border-primary hover:bg-primary/10 hover:text-primary">
                <Download className="w-3 h-3 mr-2" /> GeoJSON
              </Button>
            </div>
            <Button variant="outline" onClick={handleExportCsv} className="w-full font-mono text-xs border-primary/30 hover:border-primary hover:bg-primary/10 hover:text-primary">
              <Download className="w-3 h-3 mr-2" /> Export CSV
            </Button>
          </div>
        </section>
      </div>
    </aside>
  );
}
