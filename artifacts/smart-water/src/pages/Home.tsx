import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

import {
  useListValves,
  useListPipes,
  useListSources,
  useGetDashboardStats,
  useGetPressureHistory,
} from "@workspace/api-client-react";

import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ScadaMap } from "@/components/ScadaMap";
import { TelemetryPanel } from "@/components/TelemetryPanel";

export default function Home() {
  const [editMode, setEditMode] = useState(false);

  const { data: valves, isLoading: isLoadingValves } = useListValves();
  const { data: pipes, isLoading: isLoadingPipes } = useListPipes();
  const { data: sources, isLoading: isLoadingSources } = useListSources();
  const { data: stats, isLoading: isLoadingStats } = useGetDashboardStats();
  const { data: pressureHistory } = useGetPressureHistory();

  const isLoading = isLoadingValves || isLoadingPipes || isLoadingSources || isLoadingStats;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground selection:bg-primary/30">
      <DashboardSidebar 
        stats={stats} 
        pressureHistory={pressureHistory} 
        editMode={editMode}
        setEditMode={setEditMode}
      />
      
      <main className="flex-1 relative">
        <div className="absolute inset-0 z-0">
          <ScadaMap 
            valves={valves || []}
            pipes={pipes || []}
            sources={sources || []}
            editMode={editMode}
          />
        </div>
        
        <div className="absolute top-4 right-4 z-10 w-80 space-y-4">
          <TelemetryPanel valves={valves || []} />
        </div>
      </main>
    </div>
  );
}
