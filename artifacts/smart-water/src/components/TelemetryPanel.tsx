import React, { useState } from "react";
import { Valve, usePostTelemetry, getListValvesQueryKey, getGetDashboardStatsQueryKey, getGetPressureHistoryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioReceiver, X } from "lucide-react";
import { toast } from "sonner";

export function TelemetryPanel({ valves, onClose }: { valves: Valve[]; onClose: () => void }) {
  const [selectedValveId, setSelectedValveId] = useState<string>("");
  const [pressure, setPressure] = useState<number>(5.0);

  const queryClient = useQueryClient();
  const postTelemetry = usePostTelemetry();

  const handleSendTelemetry = () => {
    if (!selectedValveId) return;

    postTelemetry.mutate({
      data: {
        valveId: selectedValveId,
        pressure: pressure
      }
    }, {
      onSuccess: () => {
        toast.success(`Data telemetri dikirim ke ${selectedValveId}`);
        queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPressureHistoryQueryKey() });
      },
      onError: () => {
        toast.error("Gagal mengirim data telemetri");
      }
    });
  };

  return (
    <Card className="border-slate-200 bg-white/95 shadow-md">
      <CardHeader className="border-b border-slate-200 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <RadioReceiver className="h-4 w-4 text-blue-700" /> Simulasi Telemetri
          </CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Tutup simulasi telemetri"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Target Valve</label>
          <Select value={selectedValveId} onValueChange={setSelectedValveId}>
            <SelectTrigger className="h-9 border-slate-300 bg-white text-sm">
              <SelectValue placeholder="Pilih valve..." />
            </SelectTrigger>
            <SelectContent>
              {valves.map(v => (
                <SelectItem key={v.id} value={v.valveId}>{v.valveId} - {v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between">
            <label className="text-sm text-slate-600">Input Tekanan</label>
            <span className="text-sm font-semibold text-blue-700">{pressure.toFixed(1)} bar</span>
          </div>
          <Slider
            value={[pressure]}
            onValueChange={(v) => setPressure(v[0])}
            max={10}
            step={0.1}
            className="[&_[role=slider]]:border-blue-700 [&_[role=slider]]:bg-blue-700"
          />
        </div>

        <Button
          onClick={handleSendTelemetry}
          disabled={!selectedValveId || postTelemetry.isPending}
          className="w-full bg-blue-700 text-sm text-white hover:bg-blue-800"
        >
          {postTelemetry.isPending ? "Mengirim..." : "Kirim Data"}
        </Button>
      </CardContent>
    </Card>
  );
}
