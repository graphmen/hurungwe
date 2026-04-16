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
    // 1. CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { start, end } = req.query;
        let startDate = start || '2020-02-01';
        let endDate = end || '2020-02-28';

        await authenticateGEE();

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
        
        const ROI = ee.Geometry(geom);

        // 1. Sentinel-2 Image Collection & NDVI
        const S2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterDate(startDate, endDate)
            .filterBounds(ROI)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 90))
            .median()
            .clip(ROI);

        const ndvi = S2.normalizedDifference(['B8', 'B4']).rename('NDVI');

        // 2. Eliminate negative NDVI values before computing IPCC biomass.
        const ndviMasked = ndvi.updateMask(ndvi.gt(0));

        // 3. IPCC Carbon Empirical Formula
        // AGB (Mg/ha) = 15.5 + 185.2 × NDVI
        const agb = ndviMasked.expression('15.5 + (185.2 * NDVI)', {'NDVI': ndviMasked}).rename('AGB_Mg_ha');
        // Carbon = AGB × 0.47
        const carbon = agb.multiply(0.47).rename('Carbon_MgC_ha');

        // 4. Dynamic Visualization (Asynchronous wrapper prevents `.node-xmlhttprequest-sync` locks on Vercel)
        const carbonVis = {
            min: 0,
            max: 45,
            palette: ['f5f5f5', 'a1d99b', '41b6c4', '225ea8', '081d58']
        };

        const mapInfo = await new Promise((resolve, reject) => {
            carbon.getMap(carbonVis, (mapInfo, err) => {
                if (err) reject(err);
                else resolve(mapInfo);
            });
        });

        // 5. Total Carbon Reducer (Asynchronous Execution)
        // Using scale 100m to aggressively prevent serverless timeouts while approximating the district sum.
        const pixelAreaHa = ee.Image.pixelArea().divide(10000);
        const totalCarbonMg = carbon.multiply(pixelAreaHa).reduceRegion({
            reducer: ee.Reducer.sum(),
            geometry: ROI,
            scale: 500, 
            maxPixels: 1e13
        });
        
        // Execute the synchronous getInfo safely to return to frontend
        const result = await new Promise((resolve, reject) => {
            totalCarbonMg.evaluate((val, error) => {
                if (error) reject(error);
                else resolve(val);
            });
        });

        // Fallback for property key name (sometimes GEE appends reducer name or returns a single key)
        const carbonKey = Object.keys(result || {}).find(k => k.includes('Carbon') || k.includes('ha')) || 'Carbon_MgC_ha';
        const totalVal = result[carbonKey];

        res.status(200).json({
            success: true,
            tileUrl: mapInfo.urlFormat,
            totalCarbonMg: totalVal ? Math.round(totalVal).toLocaleString() : 'N/A'
        });

    } catch (err) {
        console.error("Carbon API Error:", err);
        res.status(500).json({ success: false, error: err.message, stack: err.stack });
    }
};
