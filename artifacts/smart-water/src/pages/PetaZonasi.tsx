import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Filter, RefreshCcw, Download, AlertTriangle, CheckCircle, Info, Droplets, Gauge, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { zonasiData, getGeoJsonFeatures, ZonasiData } from '../data/zonasiData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Fix Leaflet default icon issue if needed, but we don't use markers here so it's fine.

const statusColors = {
  normal: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500', fill: '#22c55e' },
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-500', fill: '#eab308' },
  critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-500', fill: '#ef4444' }
};

const statusLabels = {
  normal: 'Normal',
  warning: 'Perlu Perhatian',
  critical: 'Kritis'
};

// Component to handle map focus
const MapUpdater = ({ center, zoom }: { center: [number, number], zoom: number }) => {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

export default function PetaZonasi() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedZone, setSelectedZone] = useState<ZonasiData | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-8.70, 116.30]);
  const [mapZoom, setMapZoom] = useState(11);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapWrapperRef = React.useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapWrapperRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Compute summary
  const summary = useMemo(() => {
    return {
      total: zonasiData.length,
      normal: zonasiData.filter(d => d.status === 'normal').length,
      warning: zonasiData.filter(d => d.status === 'warning').length,
      critical: zonasiData.filter(d => d.status === 'critical').length,
      avgTekanan: (zonasiData.reduce((acc, curr) => acc + curr.tekananRataRata, 0) / zonasiData.length).toFixed(1),
      totalKeluhan: zonasiData.reduce((acc, curr) => acc + curr.jumlahKeluhan, 0)
    };
  }, []);

  // Filter data
  const filteredData = useMemo(() => {
    return zonasiData.filter(zone => {
      const matchSearch = zone.nama.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || zone.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [searchTerm, statusFilter]);

  const [geoJsonData, setGeoJsonData] = useState<any>(null);

  React.useEffect(() => {
    fetch('/data/lombok_tengah.geojson')
      .then(res => res.json())
      .then(data => {
        setGeoJsonData(data);
      })
      .catch(err => console.error("Failed to load geojson", err));
  }, []);

  const handleZoneClick = (zone: ZonasiData) => {
    setSelectedZone(zone);
    // Simple center calculation based on first coordinate
    const coords = zone.coordinates[0][0];
    setMapCenter([coords[1], coords[0]]);
    setMapZoom(13);
  };

  const resetFilter = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSelectedZone(null);
    setMapCenter([-8.70, 116.30]);
    setMapZoom(11);
  };

  const getStyle = (feature: any) => {
    const zone = zonasiData.find(z => z.nama === feature.properties.kecamatan);
    const status = zone ? (zone.status as keyof typeof statusColors) : 'normal';
    const isSelected = zone && selectedZone?.id === zone.id;
    return {
      fillColor: statusColors[status].fill,
      weight: isSelected ? 3 : 1,
      opacity: 1,
      color: isSelected ? '#000' : 'white',
      fillOpacity: isSelected ? 0.9 : 0.6
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    // Bind a simple tooltip
    layer.bindTooltip(feature.properties.kecamatan || "Kecamatan", {
      direction: 'center',
      className: 'bg-white font-semibold text-slate-800 shadow-sm border border-slate-200 px-2 py-1 rounded'
    });

    layer.on({
      mouseover: (e: any) => {
        const layer = e.target;
        layer.setStyle({
          weight: 3,
          color: '#666',
          fillOpacity: 0.8
        });
      },
      mouseout: (e: any) => {
        const layer = e.target;
        layer.setStyle(getStyle(feature));
      },
      click: () => {
        const zone = zonasiData.find(z => z.nama === feature.properties.kecamatan);
        if (zone) handleZoneClick(zone);
      }
    });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Peta Zonasi Layanan PDAM Lombok Tengah</h1>
          <p className="text-sm text-slate-500 mt-1">Monitoring kondisi layanan air berbasis sistem gravitasi per kecamatan</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => window.location.reload()} className="text-blue-600 border-blue-200 hover:bg-blue-50">
            <RefreshCcw className="w-4 h-4 mr-2" /> Refresh Data
          </Button>
          <Button variant="outline" onClick={resetFilter} className="text-slate-600">
            Reset Filter
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Download className="w-4 h-4 mr-2" /> Export Laporan
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden px-6 pb-6 pt-6 gap-6">
        
        {/* Sidebar */}
        <div className="w-80 flex flex-col gap-4">
          <Card className="flex-1 flex flex-col shadow-sm border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input 
                  placeholder="Cari kecamatan..." 
                  className="pl-9 bg-slate-50 border-slate-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="warning">Perlu Perhatian</SelectItem>
                  <SelectItem value="critical">Kritis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {filteredData.map(zone => (
                <div 
                  key={zone.id}
                  onClick={() => handleZoneClick(zone)}
                  className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors border ${selectedZone?.id === zone.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-slate-800">{zone.nama}</h3>
                    <Badge className={`${statusColors[zone.status].bg} ${statusColors[zone.status].text} hover:${statusColors[zone.status].bg} border-0 shadow-none`}>
                      {statusLabels[zone.status]}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <div>Tekanan: <span className="font-medium text-slate-700">{zone.tekananRataRata} bar</span></div>
                    <div>Level Bak: <span className="font-medium text-slate-700">{zone.levelBak}%</span></div>
                    <div className="col-span-2">Keluhan: <span className="font-medium text-slate-700">{zone.jumlahKeluhan}</span></div>
                  </div>
                </div>
              ))}
              {filteredData.length === 0 && (
                <div className="text-center p-4 text-slate-500 text-sm">Tidak ada data ditemukan</div>
              )}
            </div>
          </Card>
        </div>

        {/* Map Area */}
        <div ref={mapWrapperRef} className={`flex-1 relative rounded-xl overflow-hidden shadow-sm ${isFullscreen ? 'z-[9999] border-0' : 'border border-slate-200'}`}>
          <MapContainer 
            center={[-8.70, 116.30]} 
            zoom={11} 
            className="w-full h-full z-0"
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {geoJsonData && (
              <GeoJSON 
                key="zonasi-layer"
                data={geoJsonData} 
                style={getStyle}
                onEachFeature={onEachFeature}
              >
                <Tooltip sticky>
                  {/* Tooltip handled implicitly or we could bind it here */}
                </Tooltip>
              </GeoJSON>
            )}
            <MapUpdater center={mapCenter} zoom={mapZoom} />
          </MapContainer>

          {/* Map Controls & Overlays */}
          <Button 
            variant="secondary" 
            size="icon" 
            onClick={toggleFullscreen} 
            className="absolute top-4 right-4 z-[1000] shadow-md bg-white hover:bg-slate-100"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>

          {/* Legend */}
          <div className="absolute bottom-6 left-6 z-[1000] bg-white/90 backdrop-blur px-4 py-3 rounded-lg shadow-md border border-slate-200 pointer-events-none">
            <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Legenda Status</h4>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500 opacity-80 border border-green-700"></div>
                <span className="text-sm font-medium text-slate-700">Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500 opacity-80 border border-yellow-700"></div>
                <span className="text-sm font-medium text-slate-700">Perlu Perhatian</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500 opacity-80 border border-red-700"></div>
                <span className="text-sm font-medium text-slate-700">Kritis</span>
              </div>
            </div>
          </div>

          {/* Detail Panel Float */}
          {selectedZone && (
            <div className="absolute top-16 right-4 w-80 z-[1000] animate-in fade-in slide-in-from-right-4 duration-300">
              <Card className="shadow-lg border-0 ring-1 ring-slate-200">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg text-slate-800">{selectedZone.nama}</CardTitle>
                      <CardDescription className="text-xs mt-1">Update: {selectedZone.updateTerakhir}</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setSelectedZone(null)}>
                      &times;
                    </Button>
                  </div>
                  <Badge className={`w-fit mt-2 ${statusColors[selectedZone.status].bg} ${statusColors[selectedZone.status].text} hover:${statusColors[selectedZone.status].bg} border-0`}>
                    {statusLabels[selectedZone.status]}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Rata-rata Tekanan</p>
                      <p className="font-semibold text-slate-800 flex items-center"><Gauge className="w-4 h-4 mr-1 text-slate-400"/> {selectedZone.tekananRataRata} bar</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Tekanan Ujung</p>
                      <p className="font-semibold text-slate-800 flex items-center"><Gauge className="w-4 h-4 mr-1 text-slate-400"/> {selectedZone.tekananUjung} bar</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Level Bak</p>
                      <p className="font-semibold text-slate-800 flex items-center"><Droplets className="w-4 h-4 mr-1 text-blue-400"/> {selectedZone.levelBak}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Debit Rata-rata</p>
                      <p className="font-semibold text-slate-800">{selectedZone.debitRataRata} L/s</p>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <p className="text-xs font-semibold text-slate-700 mb-1 flex items-center"><Info className="w-3 h-3 mr-1"/> Catatan Kondisi</p>
                    <p className="text-sm text-slate-600">{selectedZone.catatan}</p>
                  </div>

                  <div className={`p-3 rounded-lg border ${selectedZone.status === 'normal' ? 'bg-green-50 border-green-100 text-green-800' : selectedZone.status === 'warning' ? 'bg-yellow-50 border-yellow-100 text-yellow-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                    <p className="text-xs font-semibold mb-1">Rekomendasi Tindakan</p>
                    <p className="text-sm">{selectedZone.rekomendasi}</p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500">Jumlah Keluhan: <span className="font-bold text-slate-800 text-base ml-1">{selectedZone.jumlahKeluhan}</span></p>
                    <Button size="sm" variant="outline" className="h-8 text-xs">Detail Keluhan</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
