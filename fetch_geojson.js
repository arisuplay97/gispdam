const fs = require('fs');
const https = require('https');

const query = `
[out:json];
area["name"="Lombok Tengah"]->.searchArea;
(
  relation["admin_level"="7"](area.searchArea);
);
out geom;
`;

const postData = 'data=' + encodeURIComponent(query);

const options = {
  hostname: 'overpass-api.de',
  port: 443,
  path: '/api/interpreter',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': postData.length,
    'User-Agent': 'NodeJS GeoJSON Fetcher'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      // convert to simple geojson structure
      const geojson = {
        type: "FeatureCollection",
        features: []
      };
      
      if (json.elements) {
        json.elements.forEach(el => {
          if (el.type === 'relation' && el.members) {
            const coords = [];
            let currentLine = [];
            
            // Reconstruct polygon from ways. For a simple script, we just take the coordinates of outer ways.
            // This is a naive reconstruction and might not be perfect for complex multipolygons, but it's better than squares.
            el.members.forEach(member => {
              if (member.type === 'way' && member.role === 'outer' && member.geometry) {
                 const lineCoords = member.geometry.map(pt => [pt.lon, pt.lat]);
                 // Push each way as a separate polygon ring for simplicity
                 coords.push(lineCoords);
              }
            });
            
            if (coords.length > 0) {
              geojson.features.push({
                type: "Feature",
                properties: {
                  nama: el.tags.name,
                  id: el.tags.name.toLowerCase().replace(/ /g, '-'),
                  admin_level: el.tags.admin_level
                },
                geometry: {
                  type: "Polygon", // Naive: MultiPolygon might be better but let's try Polygon with multiple outer rings or just MultiPolygon
                  coordinates: coords
                }
              });
            }
          }
        });
      }
      fs.writeFileSync('lombok_tengah_kecamatan.json', JSON.stringify(geojson, null, 2));
      console.log('Successfully fetched ' + geojson.features.length + ' kecamatan.');
    } catch (e) {
      console.error('Error parsing JSON:', e);
      fs.writeFileSync('overpass_raw.json', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.write(postData);
req.end();
