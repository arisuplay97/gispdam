export interface ZonasiData {
  id: string;
  nama: string;
  status: 'normal' | 'warning' | 'critical';
  tekananRataRata: number;
  tekananUjung: number;
  levelBak: number;
  debitRataRata: number;
  jumlahKeluhan: number;
  updateTerakhir: string;
  catatan: string;
  rekomendasi: string;
  // GeoJSON polygon coordinates (mock)
  coordinates: number[][][];
}

export const zonasiData: ZonasiData[] = [
  {
    id: "praya",
    nama: "Praya",
    status: "normal",
    tekananRataRata: 2.8,
    tekananUjung: 2.1,
    levelBak: 78,
    debitRataRata: 7.2,
    jumlahKeluhan: 1,
    updateTerakhir: "2026-04-25 08:00",
    catatan: "Distribusi stabil di area pusat layanan",
    rekomendasi: "Monitoring rutin",
    coordinates: [[[116.25165063509462,-8.6625],[116.25165063509462,-8.637500000000001],[116.23,-8.625],[116.20834936490539,-8.637500000000001],[116.20834936490539,-8.6625],[116.23,-8.675],[116.25165063509462,-8.6625]]]
  },
  {
    id: "praya-tengah",
    nama: "Praya Tengah",
    status: "warning",
    tekananRataRata: 1.7,
    tekananUjung: 1.1,
    levelBak: 52,
    debitRataRata: 5.4,
    jumlahKeluhan: 4,
    updateTerakhir: "2026-04-25 08:10",
    catatan: "Tekanan mulai turun di area ujung jaringan",
    rekomendasi: "Pantau tekanan ujung dan cek jam puncak pemakaian",
    coordinates: [[[116.29495190528384,-8.6625],[116.29495190528384,-8.637500000000001],[116.27330127018922,-8.625],[116.2516506350946,-8.637500000000001],[116.2516506350946,-8.6625],[116.27330127018922,-8.675],[116.29495190528384,-8.6625]]]
  },
  {
    id: "praya-timur",
    nama: "Praya Timur",
    status: "warning",
    tekananRataRata: 1.5,
    tekananUjung: 1.0,
    levelBak: 49,
    debitRataRata: 5.1,
    jumlahKeluhan: 5,
    updateTerakhir: "2026-04-25 08:30",
    catatan: "Perlu monitoring tambahan pada jalur distribusi",
    rekomendasi: "Cek tekanan ujung dan kemungkinan hambatan aliran",
    coordinates: [[[116.33825317547307,-8.6625],[116.33825317547307,-8.637500000000001],[116.31660254037845,-8.625],[116.29495190528384,-8.637500000000001],[116.29495190528384,-8.6625],[116.31660254037845,-8.675],[116.33825317547307,-8.6625]]]
  },
  {
    id: "praya-barat",
    nama: "Praya Barat",
    status: "normal",
    tekananRataRata: 2.5,
    tekananUjung: 1.9,
    levelBak: 70,
    debitRataRata: 6.0,
    jumlahKeluhan: 2,
    updateTerakhir: "2026-04-25 08:20",
    catatan: "Kondisi layanan relatif aman",
    rekomendasi: "Pertahankan monitoring rutin",
    coordinates: [[[116.38155444566229,-8.6625],[116.38155444566229,-8.637500000000001],[116.35990381056767,-8.625],[116.33825317547306,-8.637500000000001],[116.33825317547306,-8.6625],[116.35990381056767,-8.675],[116.38155444566229,-8.6625]]]
  },
  {
    id: "praya-barat-daya",
    nama: "Praya Barat Daya",
    status: "warning",
    tekananRataRata: 1.6,
    tekananUjung: 1.0,
    levelBak: 45,
    debitRataRata: 4.9,
    jumlahKeluhan: 5,
    updateTerakhir: "2026-04-25 08:15",
    catatan: "Tekanan fluktuatif di beberapa titik",
    rekomendasi: "Cek tekanan ujung dan pola pemakaian pelanggan",
    coordinates: [[[116.27330127018924,-8.7],[116.27330127018924,-8.675],[116.25165063509462,-8.6625],[116.23,-8.675],[116.23,-8.7],[116.25165063509462,-8.7125],[116.27330127018924,-8.7]]]
  },
  {
    id: "jonggat",
    nama: "Jonggat",
    status: "normal",
    tekananRataRata: 2.7,
    tekananUjung: 2.0,
    levelBak: 74,
    debitRataRata: 6.8,
    jumlahKeluhan: 1,
    updateTerakhir: "2026-04-25 08:05",
    catatan: "Aliran stabil",
    rekomendasi: "Monitoring rutin",
    coordinates: [[[116.31660254037845,-8.7],[116.31660254037845,-8.675],[116.29495190528384,-8.6625],[116.27330127018922,-8.675],[116.27330127018922,-8.7],[116.29495190528384,-8.7125],[116.31660254037845,-8.7]]]
  },
  {
    id: "kopang",
    nama: "Kopang",
    status: "critical",
    tekananRataRata: 0.8,
    tekananUjung: 0.4,
    levelBak: 24,
    debitRataRata: 3.4,
    jumlahKeluhan: 9,
    updateTerakhir: "2026-04-25 08:25",
    catatan: "Tekanan rendah, indikasi air tidak sampai ke beberapa area",
    rekomendasi: "Prioritaskan pengecekan lapangan dan cek level reservoir",
    coordinates: [[[116.35990381056767,-8.7],[116.35990381056767,-8.675],[116.33825317547306,-8.6625],[116.31660254037844,-8.675],[116.31660254037844,-8.7],[116.33825317547306,-8.7125],[116.35990381056767,-8.7]]]
  },
  {
    id: "janapria",
    nama: "Janapria",
    status: "warning",
    tekananRataRata: 1.4,
    tekananUjung: 0.9,
    levelBak: 41,
    debitRataRata: 4.2,
    jumlahKeluhan: 6,
    updateTerakhir: "2026-04-25 08:18",
    catatan: "Masih perlu perhatian pada tekanan ujung",
    rekomendasi: "Pantau area ujung jaringan dan evaluasi distribusi",
    coordinates: [[[116.25165063509462,-8.737499999999999],[116.25165063509462,-8.7125],[116.23,-8.7],[116.20834936490539,-8.7125],[116.20834936490539,-8.737499999999999],[116.23,-8.75],[116.25165063509462,-8.737499999999999]]]
  },
  {
    id: "batukliang",
    nama: "Batukliang",
    status: "normal",
    tekananRataRata: 2.4,
    tekananUjung: 1.8,
    levelBak: 68,
    debitRataRata: 5.9,
    jumlahKeluhan: 2,
    updateTerakhir: "2026-04-25 08:12",
    catatan: "Kondisi aman",
    rekomendasi: "Monitoring rutin",
    coordinates: [[[116.29495190528384,-8.737499999999999],[116.29495190528384,-8.7125],[116.27330127018922,-8.7],[116.2516506350946,-8.7125],[116.2516506350946,-8.737499999999999],[116.27330127018922,-8.75],[116.29495190528384,-8.737499999999999]]]
  },
  {
    id: "batukliang-utara",
    nama: "Batukliang Utara",
    status: "critical",
    tekananRataRata: 0.7,
    tekananUjung: 0.3,
    levelBak: 21,
    debitRataRata: 3.0,
    jumlahKeluhan: 10,
    updateTerakhir: "2026-04-25 08:28",
    catatan: "Zona kritis, tekanan sangat rendah",
    rekomendasi: "Cek level bak, tekanan ujung, dan potensi hambatan distribusi",
    coordinates: [[[116.33825317547307,-8.737499999999999],[116.33825317547307,-8.7125],[116.31660254037845,-8.7],[116.29495190528384,-8.7125],[116.29495190528384,-8.737499999999999],[116.31660254037845,-8.75],[116.33825317547307,-8.737499999999999]]]
  },
  {
    id: "pringgarata",
    nama: "Pringgarata",
    status: "normal",
    tekananRataRata: 2.6,
    tekananUjung: 1.9,
    levelBak: 72,
    debitRataRata: 6.1,
    jumlahKeluhan: 1,
    updateTerakhir: "2026-04-25 08:14",
    catatan: "Distribusi baik",
    rekomendasi: "Monitoring rutin",
    coordinates: [[[116.38155444566229,-8.737499999999999],[116.38155444566229,-8.7125],[116.35990381056767,-8.7],[116.33825317547306,-8.7125],[116.33825317547306,-8.737499999999999],[116.35990381056767,-8.75],[116.38155444566229,-8.737499999999999]]]
  },
  {
    id: "pujut",
    nama: "Pujut",
    status: "critical",
    tekananRataRata: 0.9,
    tekananUjung: 0.5,
    levelBak: 28,
    debitRataRata: 3.7,
    jumlahKeluhan: 8,
    updateTerakhir: "2026-04-25 08:40",
    catatan: "Tekanan rendah pada sebagian wilayah, terutama area ujung layanan",
    rekomendasi: "Prioritaskan pengecekan jaringan dan evaluasi distribusi gravitasi",
    coordinates: [[[116.31660254037845,-8.775],[116.31660254037845,-8.750000000000002],[116.29495190528384,-8.7375],[116.27330127018922,-8.750000000000002],[116.27330127018922,-8.775],[116.29495190528384,-8.787500000000001],[116.31660254037845,-8.775]]]
  }
];

export const getGeoJsonFeatures = () => {
  return {
    type: "FeatureCollection",
    features: zonasiData.map(zone => ({
      type: "Feature",
      properties: {
        id: zone.id,
        nama: zone.nama,
        status: zone.status,
        tekananRataRata: zone.tekananRataRata,
        tekananUjung: zone.tekananUjung,
        levelBak: zone.levelBak,
        debitRataRata: zone.debitRataRata,
        jumlahKeluhan: zone.jumlahKeluhan,
        updateTerakhir: zone.updateTerakhir,
        catatan: zone.catatan,
        rekomendasi: zone.rekomendasi
      },
      geometry: {
        type: "Polygon",
        coordinates: zone.coordinates
      }
    }))
  };
};
