const ee = require('@google/earthengine');
const fs = require('fs');
const path = require('path');

/**
 * Authentication utility for Google Earth Engine
 */
function authenticateGEE() {
    return new Promise((resolve, reject) => {
        const privateKeyConfig = process.env.GEE_PRIVATE_KEY_JSON;
        if (!privateKeyConfig) {
            reject(new Error("Missing GEE_PRIVATE_KEY_JSON environment variable."));
            return;
        }
        let keyConfig;
        try {
            keyConfig = JSON.parse(privateKeyConfig);
        } catch (e) {
            reject(new Error("GEE_PRIVATE_KEY_JSON is not a valid JSON string."));
            return;
        }
        ee.data.authenticateViaPrivateKey(
            keyConfig,
            () => {
                ee.initialize(null, null, resolve, (err) => {
                    reject(new Error("GEE Initialization Failed: " + err));
                });
            },
            (err) => reject(new Error("GEE Authentication Failed: " + err))
        );
    });
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { start } = req.query;
        const selectedYear = start ? new Date(start).getFullYear() : 2021;
        
        // ESA v100 is 2020, v200 is 2021. For anything else we pick the closest.
        const collectionPath = selectedYear <= 2020 ? "ESA/WorldCover/v100" : "ESA/WorldCover/v200";

        await authenticateGEE();

        // Load Hurungwe District Boundary from local GeoJSON
        const geojsonPath = path.join(process.cwd(), 'data', 'Hurungwe.geojson');
        const geojsonRaw = fs.readFileSync(geojsonPath, 'utf8');
        const geojsonData = JSON.parse(geojsonRaw);
        
        let geom;
        if (geojsonData.type === 'FeatureCollection') {
            geom = geojsonData.features[0].geometry;
        } else if (geojsonData.type === 'Feature') {
            geom = geojsonData.geometry;
        } else {
            geom = geojsonData;
        }
        
        const boundary = ee.Geometry(geom);

        // 1. Load the specific ESA version collection and clip
        const wc = ee.ImageCollection(collectionPath).first().clip(boundary);

        // 2. Reclassify: map ESA codes → 6 simplified classes
        // Our classes: 1=Forest, 2=Grass/Shrub/Wetland, 3=Cropland, 4=Built-up, 5=Bare/Sparse, 6=Open Water
        const lulc = wc.remap(
            [10, 20, 30, 40, 50, 60, 80, 90],
            [1,  2,  2,  3,  4,  5,  6,  2],
            0
        ).rename('LULC').updateMask(wc.remap([10,20,30,40,50,60,80,90],[1,2,2,3,4,5,6,2],0).gt(0));

        // 3. Visualization palette
        const lulcVis = {
            min: 1,
            max: 6,
            palette: ['1a9641', 'a6d96a', 'ffffbf', 'd7191c', 'fdae61', '2c7fb8']
        };

        const mapInfo = await new Promise((resolve, reject) => {
            lulc.getMap(lulcVis, (info, err) => {
                if (err) reject(err);
                else resolve(info);
            });
        });

        // 4. Area statistics per class
        const pixelAreaHa = ee.Image.pixelArea().divide(10000);
        const classIds = [1, 2, 3, 4, 5, 6];
        const classNames = ['Forest', 'Grass/Shrub/Wetland', 'Cropland', 'Built-up', 'Bare/Sparse', 'Open Water'];

        const areaResults = await Promise.all(
            classIds.map((id) =>
                new Promise((resolve, reject) => {
                    lulc.eq(id).multiply(pixelAreaHa)
                        .reduceRegion({
                            reducer: ee.Reducer.sum(),
                            geometry: boundary,
                            scale: 250, 
                            maxPixels: 1e13
                        })
                        .evaluate((val, err) => {
                            if (err) reject(err);
                            else {
                                const areaHa = val ? Math.round(Object.values(val)[0] || 0) : 0;
                                resolve({ id, name: classNames[id - 1], areaHa });
                            }
                        });
                })
            )
        );

        res.status(200).json({
            success: true,
            tileUrl: mapInfo.urlFormat,
            areaStats: areaResults,
            yearSource: selectedYear <= 2020 ? 2020 : 2021
        });

    } catch (err) {
        console.error("Land Cover API Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};
