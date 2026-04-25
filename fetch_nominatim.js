const https = require('https');
const fs = require('fs');

const kecamatans = [
  "Praya", "Praya Tengah", "Praya Timur", "Praya Barat", "Praya Barat Daya",
  "Jonggat", "Kopang", "Janapria", "Batukliang", "Batukliang Utara", "Pringgarata", "Pujut"
];

let geojson = {
  type: "FeatureCollection",
  features: []
};

let completed = 0;

kecamatans.forEach(kec => {
  const url = `https://nominatim.openstreetmap.org/search.php?q=Kecamatan+${encodeURIComponent(kec)},+Lombok+Tengah&polygon_geojson=1&format=json`;
  
  https.get(url, { headers: { 'User-Agent': 'NodeJS GeoJSON Fetcher' } }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const polygonMatch = json.find(item => item.geojson && (item.geojson.type === 'Polygon' || item.geojson.type === 'MultiPolygon'));
        
        if (polygonMatch) {
          geojson.features.push({
            type: "Feature",
            properties: { nama: kec, id: kec.toLowerCase().replace(/ /g, '-') },
            geometry: polygonMatch.geojson
          });
          console.log(`Found polygon for ${kec}`);
        } else {
          console.log(`No polygon found for ${kec}`);
        }
      } catch (e) {
        console.error(`Error parsing ${kec}`);
      }
      
      completed++;
      if (completed === kecamatans.length) {
        fs.writeFileSync('lombok_tengah_real.json', JSON.stringify(geojson, null, 2));
        console.log('Done!');
      }
    });
  });
});
