const https = require('https');
const fs = require('fs');

const query = `
[out:json];
area["name"="Kabupaten Lombok Tengah"]->.searchArea;
relation["admin_level"="7"](area.searchArea);
out tags geom;
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
    fs.writeFileSync('overpass_test.json', data);
    console.log('Saved overpass_test.json');
  });
});
req.write(postData);
req.end();
