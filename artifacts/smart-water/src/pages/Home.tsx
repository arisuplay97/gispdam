import { useState } from "react";

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

  const { data: valves } = useListValves();
  const { data: pipes } = useListPipes();
  const { data: sources } = useListSources();
  const { data: stats } = useGetDashboardStats();
  const { data: pressureHistory } = useGetPressureHistory();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900">
      <DashboardSidebar
        stats={stats}
        pressureHistory={pressureHistory}
        editMode={editMode}
        setEditMode={setEditMode}
      />

      <main className="relative flex-1">
        <div className="absolute inset-0 z-0">
          <ScadaMap
            valves={valves || []}
            pipes={pipes || []}
            sources={sources || []}
            editMode={editMode}
          />
        </div>

        <div className="absolute right-4 top-4 z-10 w-80 space-y-4">
          <TelemetryPanel valves={valves || []} />
        </div>
      </main>
    </div>
  );
}
