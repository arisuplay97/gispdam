import fs from "fs";
import path from "path";
import { db, valvesTable, sourcesTable, pipesTable } from "@workspace/db";

// File paths
const JSON_DIR = path.resolve(process.cwd(), "../../json"); // relative to api-server
const RESERVOIR_FILE = path.join(JSON_DIR, "reservoir.geojson");
const VALVE_FILE = path.join(JSON_DIR, "valve.geojson");
const PIPE_FILE = path.join(JSON_DIR, "perpipaan.geojson");

async function seedData() {
  console.log("Menghapus data lama (Truncate)...");
  
  // Truncate
  await db.delete(pipesTable);
  await db.delete(valvesTable);
  await db.delete(sourcesTable);

  console.log("Data lama berhasil dihapus.");

  // Seed Reservoir
  console.log("Membaca reservoir.geojson ...");
  const reservoirData = JSON.parse(fs.readFileSync(RESERVOIR_FILE, "utf-8"));
  let resCount = 0;
  for (const feature of reservoirData.features) {
    if (feature.geometry?.type === "Point") {
      const props = feature.properties || {};
      const lat = props.lat;
      const lng = props.long;
      if (lat && lng) {
        await db.insert(sourcesTable).values({
          name: props.nama || `Reservoir ${props.fid}`,
          lat: Number(lat),
          lng: Number(lng),
          elevasi: props.elevasi ? Number(props.elevasi) : null,
          buildYear: props.thn_pmbgn ? Number(props.thn_pmbgn) : null,
          capacity: props.kpsts_trpsg ? String(props.kpsts_trpsg) : null,
          condition: props.kondisi ? String(props.kondisi) : null,
        });
        resCount++;
      }
    }
  }
  console.log(`Berhasil insert ${resCount} reservoir.`);

  // Seed Valve
  console.log("Membaca valve.geojson ...");
  const valveData = JSON.parse(fs.readFileSync(VALVE_FILE, "utf-8"));
  let valveCount = 0;
  for (const feature of valveData.features) {
    if (feature.geometry?.type === "Point") {
      const props = feature.properties || {};
      // Anomali: properties x = lat, y = lng. Tapi geometry.coordinates sudah berformat [lng, lat].
      // Kita pakai geometry coordinates karena yang paling valid format geojsannya.
      const coords = feature.geometry.coordinates; // [lng, lat]
      const lng = coords[0];
      const lat = coords[1];
      
      const valveId = `V-${props.fid || Date.now()}-${valveCount}`;
      
      await db.insert(valvesTable).values({
        valveId: valveId,
        name: props.jns_valve || `Valve ${props.fid}`,
        lat: Number(lat),
        lng: Number(lng),
        pressure: 5.0, // default dummy
        status: "normal", // default dummy
        diameter: props.diameter ? Number(props.diameter) : null,
        installYear: props.thn_psng ? Number(props.thn_psng) : null,
        condition: props.kondisi ? String(props.kondisi) : null,
        functionStatus: props.fungsi ? String(props.fungsi) : null,
        description: props.keterangan ? String(props.keterangan) : null,
      });
      valveCount++;
    }
  }
  console.log(`Berhasil insert ${valveCount} valve.`);

  // Seed Pipes
  console.log("Membaca perpipaan.geojson ...");
  const pipeData = JSON.parse(fs.readFileSync(PIPE_FILE, "utf-8"));
  let pipeCount = 0;
  for (const feature of pipeData.features) {
    if (feature.geometry?.type === "LineString") {
      const props = feature.properties || {};
      const coords = feature.geometry.coordinates; // array [lng, lat]
      
      const diamFloat = parseFloat(String(props.diameter).replace(",", "."));
      
      await db.insert(pipesTable).values({
        name: `Pipa ${props.jns_pipa || ""} ${props.fid || pipeCount}`,
        coordinates: coords,
        diameter: isNaN(diamFloat) ? null : diamFloat,
        material: props.jns_pipa ? String(props.jns_pipa) : null,
        networkType: props.jaringan ? String(props.jaringan) : null,
        installYear: props.thn_pasang ? Number(props.thn_pasang) : null,
        condition: props.kondisi ? String(props.kondisi) : null,
        length: props.panjang ? Number(props.panjang) : null,
        zone: props.zona ? String(props.zona) : null,
        spam: props.spam ? String(props.spam) : null,
      });
      pipeCount++;
    }
  }
  console.log(`Berhasil insert ${pipeCount} pipa.`);

  console.log("SELESAI - Semua data GeoJSON berhasil diimport!");
  process.exit(0);
}

seedData().catch((err) => {
  console.error("Terjadi error saat import:", err);
  process.exit(1);
});
