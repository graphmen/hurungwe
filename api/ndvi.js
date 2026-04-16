const ee = require('@google/earthengine');
const fs = require('fs');
const path = require('path');

/**
 * Authetication utility using the provided JSON key.
 */
function authenticate() {
    return new Promise((resolve, reject) => {
        if (!process.env.GEE_PRIVATE_KEY_JSON) {
            return reject(new Error('Missing GEE_PRIVATE_KEY_JSON environment variable.'));
        }
        
        let privateKey;
        try {
            privateKey = JSON.parse(process.env.GEE_PRIVATE_KEY_JSON);
        } catch (e) {
            return reject(new Error('Invalid JSON format in GEE_PRIVATE_KEY_JSON'));
        }

        ee.data.authenticateViaPrivateKey(privateKey, () => {
            ee.initialize(null, null, resolve, reject);
        }, reject);
    });
}

// -----------------------------------------------------
// VERCEL SERVERLESS HANDLER
// -----------------------------------------------------
module.exports = async (req, res) => {
    // 1. CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log("Initializing Google Earth Engine Authentication...");
        await authenticate();
        console.log("GEE Init Success.");

        // 2. Parse Query Params
        const startDate = req.query.start || '2020-02-01';
        const endDate = req.query.end || '2020-02-28';
        console.log(`Processing NDVI for dates: ${startDate} to ${endDate}`);

        // 3. EXECUTE GEE LOGIC (Mirrored from User's Script)
        
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
        
        // Use true complex multi-polygon geometry for perfect clipping
        const ROI = ee.Geometry(geom);

        const S2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterDate(startDate, endDate)
            .filterBounds(ROI)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 90))
            .median()
            .clip(ROI);

        const ndvi = S2.normalizedDifference(['B8', 'B4']).rename('NDVI');

        const classNDVI = ndvi.gt(0.5).multiply(4)
            .where(ndvi.gt(0.3).and(ndvi.lte(0.5)), 3)
            .where(ndvi.gt(0.1).and(ndvi.lte(0.3)), 2)
            .where(ndvi.gt(-0.1).and(ndvi.lte(0.1)), 1)
            .where(ndvi.lte(-0.1), 0)
            .clip(ROI);

        const ndviVis = {
            min: 0, 
            max: 4,
            palette: ['brown', 'yellow', 'lightgreen', 'green', 'darkgreen']
        };

        // 4. Generate the MapID and Token
        console.log("Requesting MapID from GEE...");
        const mapInfo = await new Promise((resolve, reject) => {
            classNDVI.getMap(ndviVis, (mapInfo, err) => {
                if (err) reject(err);
                else resolve(mapInfo);
            });
        });

        // 5. Respond with Leaflet Tile URL
        res.status(200).json({ 
            success: true,
            tileUrl: mapInfo.urlFormat,
            dates: { start: startDate, end: endDate }
        });

    } catch (error) {
        console.error("GEE_API_ERROR:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Error processing Earth Engine script.' 
        });
    }
};
