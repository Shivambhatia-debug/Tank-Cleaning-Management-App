/**
 * Fix @rnmapbox/maps ESM resolution: index.js imports './Mapbox' without .js
 * which fails on some Node/Expo setups. Adds explicit .js extension.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../node_modules/@rnmapbox/maps/lib/module/index.js');
if (fs.existsSync(file)) {
  let c = fs.readFileSync(file, 'utf8');
  if (c.includes("from './Mapbox'") && !c.includes("from './Mapbox.js'")) {
    c = c.replace("from './Mapbox'", "from './Mapbox.js'");
    fs.writeFileSync(file, c);
    console.log('Patched @rnmapbox/maps lib/module/index.js');
  }
}
