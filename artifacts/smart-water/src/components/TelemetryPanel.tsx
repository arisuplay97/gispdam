import React, { useState } from "react";
import { Valve, usePostTelemetry, getListValvesQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioReceiver } from "lucide-react";
import { toast } from "sonner";

export function TelemetryPanel({ valves }: { valves: Valve[] }) {
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
        toast.success(`Telemetry sent to ${selectedValveId}`);
        queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      }
    });
  };

  return (
    <Card className="bg-card/90 backdrop-blur-md border-primary/30 shadow-[0_0_20px_rgba(0,255,255,0.05)]">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-sm font-mono uppercase flex items-center gap-2 text-primary">
          <RadioReceiver className="w-4 h-4" /> Telemetry Simulator
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-mono text-muted-foreground uppercase">Target Node</label>
          <Select value={selectedValveId} onValueChange={setSelectedValveId}>
            <SelectTrigger className="font-mono bg-background/50 border-primary/20 text-xs h-8">
              <SelectValue placeholder="Select a valve..." />
            </SelectTrigger>
            <SelectContent className="font-mono">
              {valves.map(v => (
                <SelectItem key={v.id} value={v.valveId}>{v.valveId} - {v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between">
            <label className="text-xs font-mono text-muted-foreground uppercase">Pressure Input</label>
            <span className="text-xs font-mono font-bold text-primary">{pressure.toFixed(1)} bar</span>
          </div>
          <Slider 
            value={[pressure]} 
            onValueChange={(v) => setPressure(v[0])} 
            max={10} 
            step={0.1}
            className="[&_[role=slider]]:border-primary [&_[role=slider]]:bg-primary [&_[role=slider]]:shadow-[0_0_10px_rgba(0,255,255,0.8)]"
          />
        </div>

        <Button 
          onClick={handleSendTelemetry}
          disabled={!selectedValveId || postTelemetry.isPending}
          className="w-full font-mono text-xs uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(0,255,255,0.3)]"
        >
          {postTelemetry.isPending ? "Transmitting..." : "Transmit Data"}
        </Button>
      </CardContent>
    </Card>
  );
}
