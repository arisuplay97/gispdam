import { useState } from "react";
import { RadioReceiver } from "lucide-react";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [telemetryOpen, setTelemetryOpen] = useState(false);

  const { data: valves } = useListValves();
  const { data: pipes } = useListPipes();
  const { data: sources } = useListSources();
  const { data: stats } = useGetDashboardStats();
  const { data: pressureHistory } = useGetPressureHistory();

  const query = searchTerm.trim().toLowerCase();
  const filteredValves = (valves || []).filter((valve) => {
    if (!query) return true;
    return (
      valve.valveId.toLowerCase().includes(query) ||
      valve.name.toLowerCase().includes(query) ||
      valve.status.toLowerCase().includes(query)
    );
  });

  const filteredPipes = (pipes || []).filter((pipe) => {
    if (!query) return true;
    return (
      pipe.name.toLowerCase().includes(query) ||
      (pipe.fromNode || "").toLowerCase().includes(query) ||
      (pipe.toNode || "").toLowerCase().includes(query) ||
      (pipe.material || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900">
      <DashboardSidebar
        stats={stats}
        pressureHistory={pressureHistory}
        editMode={editMode}
        setEditMode={setEditMode}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        valves={valves || []}
        pipes={pipes || []}
      />

      <main className="relative flex-1">
        <div className="absolute inset-0 z-0">
          <ScadaMap
            valves={filteredValves}
            pipes={filteredPipes}
            sources={sources || []}
            editMode={editMode}
          />
        </div>

        {telemetryOpen ? (
          <div className="absolute right-4 top-4 z-10 w-80 space-y-4">
            <TelemetryPanel valves={valves || []} onClose={() => setTelemetryOpen(false)} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setTelemetryOpen(true)}
            className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-md hover:bg-slate-50"
          >
            <RadioReceiver className="h-4 w-4 text-blue-700" />
            Buka Telemetri
          </button>
        )}
      </main>
    </div>
  );
}
