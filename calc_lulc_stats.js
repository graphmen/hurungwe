const ee = require('@google/earthengine');
const fs = require('fs');
const path = require('path');

// Use the environment variable if available, otherwise try local file
const privateKeyJson = process.env.GEE_PRIVATE_KEY_JSON || fs.readFileSync('./gee_credentials.json', 'utf8');
const privateKey = JSON.parse(privateKeyJson);

ee.data.authenticateViaPrivateKey(privateKey, () => {
    ee.initialize(null, null, async () => {
        try {
            const geojsonPath = './data/Hurungwe.geojson';
            const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
            const boundary = ee.Geometry(geojson.features ? geojson.features[0].geometry : geojson.geometry || geojson);

            const calculateForYear = async (colPath) => {
                const wc = ee.ImageCollection(colPath).first().clip(boundary);
                const lulc = wc.remap([10, 20, 30, 40, 50, 60, 80, 90], [1, 2, 2, 3, 4, 5, 6, 2], 0);
                const pixelAreaHa = ee.Image.pixelArea().divide(10000);
                
                return new Promise((resolve, reject) => {
                    lulc.addBands(pixelAreaHa).reduceRegion({
                        reducer: ee.Reducer.sum().group({ groupField: 0, groupName: 'classId' }),
                        geometry: boundary,
                        scale: 100,
                        maxPixels: 1e13
                    }).evaluate((result, err) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
            };

            console.log("CALCULATING 2020 (v100)...");
            const stats2020 = await calculateForYear("ESA/WorldCover/v100");
            console.log("2020 Stats:", JSON.stringify(stats2020));

            console.log("CALCULATING 2021 (v200)...");
            const stats2021 = await calculateForYear("ESA/WorldCover/v200");
            console.log("2021 Stats:", JSON.stringify(stats2021));

            process.exit(0);
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    });
});
