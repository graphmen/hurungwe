const ee = require('@google/earthengine');
const fs = require('fs');

function authenticateGEE() {
    return new Promise((resolve, reject) => {
        const privateKeyConfig = process.env.GEE_PRIVATE_KEY_JSON;
        if (!privateKeyConfig) return reject(new Error("Missing GEE_PRIVATE_KEY_JSON"));
        let keyConfig = JSON.parse(privateKeyConfig);
        ee.data.authenticateViaPrivateKey(keyConfig, () => {
            ee.initialize(null, null, resolve, (err) => reject(new Error("Init Failure: " + err)));
        }, (err) => reject(new Error("Auth Failure: " + err)));
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { lat, lon, scenario } = req.query;
        if (!lat || !lon) return res.status(400).json({ error: "Missing lat/lon" });

        await authenticateGEE();

        const point = ee.Geometry.Point([parseFloat(lon), parseFloat(lat)]);
        const model = 'ACCESS-CM2';

        // Same lightweight logic as map for consistency
        const baseline = ee.ImageCollection("NASA/GDDP-CMIP6")
            .filter(ee.Filter.eq('scenario', 'historical'))
            .filter(ee.Filter.eq('model', model))
            .filterDate('2005-01-01', '2014-12-31') 
            .filterBounds(point)
            .select(['tas']).mean();

        const future = ee.ImageCollection("NASA/GDDP-CMIP6")
            .filter(ee.Filter.eq('scenario', scenario || 'ssp585'))
            .filter(ee.Filter.eq('model', model))
            .filterDate('2050-01-01', '2050-12-31') 
            .filterBounds(point)
            .select(['tas']).mean();

        const tempDelta = future.subtract(baseline).rename('delta');

        // Sample the point
        const result = await new Promise((resolve, reject) => {
            tempDelta.reduceRegion({
                reducer: ee.Reducer.mean(),
                geometry: point,
                scale: 1000
            }).evaluate((val, err) => err ? reject(err) : resolve(val));
        });

        res.status(200).json({
            success: true,
            delta: parseFloat(result.delta || 0).toFixed(2),
            lat, lon
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
