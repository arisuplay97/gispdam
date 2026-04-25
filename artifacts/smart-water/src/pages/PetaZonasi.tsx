import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Tooltip, useMap, ZoomControl, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Filter, RefreshCcw, Download, AlertTriangle, CheckCircle, Info, Droplets, Gauge, Maximize, Minimize, Printer, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { zonasiData, getGeoJsonFeatures, ZonasiData } from '../data/zonasiData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Fix Leaflet default icon issue if needed, but we don't use markers here so it's fine.

const statusColors = {
  normal: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500', fill: '#7cb342' },
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-500', fill: '#fbc02d' },
  critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-500', fill: '#e53935' }
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    // Bind a permanent text label
    const regionName = feature.properties.kecamatan || "Kecamatan";
    layer.bindTooltip(
      `<span style="color: #334155; font-weight: 700; font-size: 11px; text-shadow: 1px 1px 0 rgba(255,255,255,0.8), -1px -1px 0 rgba(255,255,255,0.8), 1px -1px 0 rgba(255,255,255,0.8), -1px 1px 0 rgba(255,255,255,0.8);">${regionName}</span>`, 
      {
        permanent: true,
        direction: 'center',
        className: 'bg-transparent border-0 shadow-none'
      }
    );

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
      {/* Print Styles */}
      <style>{`
        @media print {
          body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          .print-hide { display: none !important; }
          .leaflet-control-layers, .leaflet-control-zoom { display: none !important; }
          .print-full { 
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
          }
          body { overflow: hidden !important; }
        }
        /* Pindahkan posisi kontrol layer Leaflet ke tengah kanan */
        .leaflet-top.leaflet-right {
          top: 50% !important;
          transform: translateY(-50%);
        }
      `}</style>

      {/* Compact Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-2 flex flex-wrap gap-2 justify-between items-center shadow-sm z-10 print-hide">
        <h1 className="text-sm md:text-base font-bold text-slate-800">Peta Zonasi Wilayah Layanan</h1>
        <div className="flex space-x-1 md:space-x-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 text-xs">
            <RefreshCcw className="w-3.5 h-3.5 mr-1 hidden sm:inline" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={resetFilter} className="text-slate-600 h-8 text-xs">
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="text-slate-600 h-8 text-xs">
            <Printer className="w-3.5 h-3.5 mr-1 hidden sm:inline" /> Cetak
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden px-2 md:px-4 pb-2 md:pb-4 pt-2 md:pt-4 gap-2 md:gap-4 relative">
        
        {/* Sidebar */}
        <div className={`absolute md:relative z-[1001] md:z-auto h-[calc(100%-1rem)] md:h-auto flex flex-col gap-4 print-hide transition-all duration-300 ${sidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 overflow-hidden'}`}>
          <Card className="flex-1 flex flex-col shadow-2xl md:shadow-sm border-slate-200 overflow-hidden min-w-[288px] bg-white">
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

        {/* Map Area Wrapper */}
        <div className="flex-1 flex gap-2 relative">
          
          {/* Sidebar Toggle Button (Outside Map) */}
          <div className="absolute md:static left-0 top-1/2 -translate-y-1/2 md:translate-y-0 flex flex-col justify-center print-hide z-[1002] md:z-50 pointer-events-auto">
            <Button 
              variant="outline" 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="h-16 w-6 p-0 bg-white border-slate-200 text-slate-600 hover:bg-slate-100 rounded-r-md md:rounded shadow-md md:shadow-sm flex items-center justify-center border-l-0 md:border-l"
              title={sidebarOpen ? "Sembunyikan Panel" : "Tampilkan Panel"}
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </Button>
          </div>

          <div ref={mapWrapperRef} className={`flex-1 relative rounded-xl overflow-hidden shadow-sm print-full ${isFullscreen ? 'z-[9999] border-0 fixed inset-0' : 'border border-slate-200'}`}>
            <MapContainer 
              center={[-8.70, 116.30]} 
              zoom={11} 
            className="w-full h-full z-0"
            zoomControl={false}
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Peta Dasar (Light)">
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="OpenStreetMap">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Google Satellite">
                <TileLayer
                  attribution='&copy; Google'
                  url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                  maxZoom={20}
                />
              </LayersControl.BaseLayer>
            </LayersControl>
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
            <ZoomControl position="bottomright" />
            <MapUpdater center={mapCenter} zoom={mapZoom} />
          </MapContainer>

          {/* Map Title Overlay */}
          <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur px-4 py-3 rounded-lg shadow-md border border-slate-200 pointer-events-none max-w-md">
            <h2 className="text-sm font-bold text-slate-800 leading-tight">
              PETA ZONASI WILAYAH LAYANAN AIR<br />
              PERUMDAM TIRTA ARDHIA RINJANI
            </h2>
          </div>

          {/* North Arrow with UBTS */}
          <div className="absolute top-4 right-4 z-[1000] pointer-events-none drop-shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100" height="100">
              <defs>
                <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#e0e0e0"/>
                  <stop offset="100%" stopColor="#b8b8b8"/>
                </radialGradient>
              </defs>

              <circle cx="300" cy="300" r="152" fill="url(#ringGrad)" stroke="#111" strokeWidth="5"/>
              <circle cx="300" cy="300" r="132" fill="none" stroke="#111" strokeWidth="3"/>
              <circle cx="300" cy="300" r="122" fill="none" stroke="#111" strokeWidth="1.5"/>

              <path d="M 305,178 Q 370,195 422,295 Q 395,255 345,215 Q 330,200 305,178 Z" fill="#111" opacity="0.18"/>
              <path d="M 295,422 Q 230,405 178,305 Q 205,345 255,385 Q 270,400 295,422 Z" fill="#111" opacity="0.18"/>
              <path d="M 295,178 Q 230,195 178,295 Q 205,255 255,215 Q 270,200 295,178 Z" fill="#111" opacity="0.18"/>
              <path d="M 305,422 Q 370,405 422,305 Q 395,345 345,385 Q 330,400 305,422 Z" fill="#111" opacity="0.18"/>

              <g fill="none" stroke="#111" strokeWidth="2.5">
                <circle cx="300" cy="150" r="5.5"/>
                <circle cx="359" cy="159" r="5.5"/>
                <circle cx="409" cy="185" r="5.5"/>
                <circle cx="441" cy="231" r="5.5"/>
                <circle cx="452" cy="300" r="5.5"/>
                <circle cx="441" cy="369" r="5.5"/>
                <circle cx="409" cy="415" r="5.5"/>
                <circle cx="359" cy="441" r="5.5"/>
                <circle cx="300" cy="452" r="5.5"/>
                <circle cx="241" cy="441" r="5.5"/>
                <circle cx="191" cy="415" r="5.5"/>
                <circle cx="159" cy="369" r="5.5"/>
                <circle cx="148" cy="300" r="5.5"/>
                <circle cx="159" cy="231" r="5.5"/>
                <circle cx="191" cy="185" r="5.5"/>
                <circle cx="241" cy="159" r="5.5"/>
              </g>

              <g fill="#111">
                <polygon points="300,143  294,157  306,157"/>
                <polygon points="359,152  349,164  360,168"/>
                <polygon points="406,178  394,186  399,198"/>
                <polygon points="437,224  424,229  430,242"/>
                <polygon points="457,300  443,294  443,306"/>
                <polygon points="437,376  430,358  424,371"/>
                <polygon points="406,422  399,402  394,414"/>
                <polygon points="359,448  360,432  349,436"/>
                <polygon points="300,457  306,443  294,443"/>
                <polygon points="241,448  252,436  240,432"/>
                <polygon points="194,422  206,414  201,402"/>
                <polygon points="163,376  176,371  170,358"/>
                <polygon points="143,300  157,306  157,294"/>
                <polygon points="163,224  170,242  176,229"/>
                <polygon points="194,178  201,198  206,186"/>
                <polygon points="241,152  240,168  252,164"/>
              </g>

              <polygon points="300,300 282,235 300,50 318,235" fill="#1a1a1a"/>
              <polygon points="300,300 300,50 318,235"          fill="#888"/>
              <polygon points="300,300 282,365 300,550 318,365" fill="#1a1a1a"/>
              <polygon points="300,300 282,365 300,550"         fill="#888"/>
              <polygon points="300,300 235,282 50,300 235,318"  fill="#1a1a1a"/>
              <polygon points="300,300 50,300 235,318"          fill="#888"/>
              <polygon points="300,300 365,282 550,300 365,318" fill="#1a1a1a"/>
              <polygon points="300,300 365,318 550,300"         fill="#888"/>
              <polygon points="300,300 314,286 392,208 286,314" fill="#1a1a1a"/>
              <polygon points="300,300 392,208 314,286"         fill="#666"/>
              <polygon points="300,300 314,314 392,392 286,286" fill="#1a1a1a"/>
              <polygon points="300,300 392,392 314,314"         fill="#666"/>
              <polygon points="300,300 286,314 208,392 314,286" fill="#1a1a1a"/>
              <polygon points="300,300 208,392 286,314"         fill="#666"/>
              <polygon points="300,300 286,286 208,208 314,314" fill="#1a1a1a"/>
              <polygon points="300,300 208,208 286,286"         fill="#666"/>

              <polygon points="300,300 282,235 300,50 318,235"   fill="none" stroke="#111" strokeWidth="1.5" strokeLinejoin="round"/>
              <polygon points="300,300 282,365 300,550 318,365"  fill="none" stroke="#111" strokeWidth="1.5" strokeLinejoin="round"/>
              <polygon points="300,300 235,282 50,300 235,318"   fill="none" stroke="#111" strokeWidth="1.5" strokeLinejoin="round"/>
              <polygon points="300,300 365,282 550,300 365,318"  fill="none" stroke="#111" strokeWidth="1.5" strokeLinejoin="round"/>
              <polygon points="300,300 314,286 392,208 286,314"  fill="none" stroke="#111" strokeWidth="1" strokeLinejoin="round"/>
              <polygon points="300,300 314,314 392,392 286,286"  fill="none" stroke="#111" strokeWidth="1" strokeLinejoin="round"/>
              <polygon points="300,300 286,314 208,392 314,286"  fill="none" stroke="#111" strokeWidth="1" strokeLinejoin="round"/>
              <polygon points="300,300 286,286 208,208 314,314"  fill="none" stroke="#111" strokeWidth="1" strokeLinejoin="round"/>

              <circle cx="300" cy="300" r="24" fill="#d0d0d0" stroke="#111" strokeWidth="3.5"/>
              <circle cx="300" cy="300" r="9"  fill="#111"/>

              <text x="300" y="40" textAnchor="middle" fontFamily="'Arial Black', Arial, sans-serif" fontSize="68" fontWeight="900" fill="#111">U</text>
              <text x="55" y="322" textAnchor="middle" fontFamily="'Arial Black', Arial, sans-serif" fontSize="68" fontWeight="900" fill="#111">B</text>
              <text x="545" y="322" textAnchor="middle" fontFamily="'Arial Black', Arial, sans-serif" fontSize="68" fontWeight="900" fill="#111">T</text>
              <text x="300" y="592" textAnchor="middle" fontFamily="'Arial Black', Arial, sans-serif" fontSize="68" fontWeight="900" fill="#111">S</text>
            </svg>
          </div>

          {/* Fullscreen Button */}
          <Button 
            variant="secondary" 
            size="icon" 
            onClick={toggleFullscreen} 
            className="absolute top-[calc(50%-3.5rem)] right-2.5 z-[1000] shadow-md bg-white hover:bg-slate-100 print-hide"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 z-[1000] bg-white/90 backdrop-blur px-3 py-2 md:px-4 md:py-3 rounded-lg shadow-md border border-slate-200 pointer-events-none max-w-[200px] md:max-w-[280px]">
            <h4 className="text-[10px] md:text-xs font-bold text-slate-700 mb-1 md:mb-2 uppercase tracking-wider">Legenda Status</h4>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded opacity-80 border" style={{ backgroundColor: statusColors.normal.fill, borderColor: '#558b2f' }}></div>
                <span className="text-sm font-medium text-slate-700">Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded opacity-80 border" style={{ backgroundColor: statusColors.warning.fill, borderColor: '#f57f17' }}></div>
                <span className="text-sm font-medium text-slate-700">Perlu Perhatian</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded opacity-80 border" style={{ backgroundColor: statusColors.critical.fill, borderColor: '#c62828' }}></div>
                <span className="text-sm font-medium text-slate-700">Kritis</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200/60">
              <p className="text-[10px] leading-tight text-slate-700 font-bold italic">
                *Warna merupakan indikator prioritas pemantauan, bukan menunjukkan seluruh wilayah kecamatan mengalami gangguan.
              </p>
            </div>
          </div>

          {/* Detail Panel Float */}
          {selectedZone && (
            <div className="absolute top-2 right-2 left-10 md:top-4 md:right-20 md:left-auto md:w-80 max-w-sm z-[1000] animate-in fade-in slide-in-from-right-4 duration-300 print-hide">
              <Card className="shadow-2xl md:shadow-lg border-0 ring-1 ring-slate-200">
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
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={`${statusColors[selectedZone.status].bg} ${statusColors[selectedZone.status].text} hover:${statusColors[selectedZone.status].bg} border-0`}>
                      {statusLabels[selectedZone.status]}
                    </Badge>
                    <div 
                      className="text-xs font-bold px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200 shadow-sm flex items-center gap-1 cursor-help" 
                      title="Batas Skor: Hijau (>80), Kuning (50-80), Merah (<50)"
                    >
                      <Gauge className="w-3 h-3 text-slate-400" />
                      Skor Wilayah: {selectedZone.skorKinerja}
                    </div>
                  </div>
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
    </div>
  );
}
