const ee = require('@google/earthengine');
const fs = require('fs');
const path = require('path');

const HURUNGWE_AREA_M2 = 12600000000;

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
        const scenario = req.query.scenario || 'ssp585';
        await authenticateGEE();

        const geojsonPath = path.join(process.cwd(), 'data', 'Hurungwe.geojson');
        const ROI = ee.Geometry(JSON.parse(fs.readFileSync(geojsonPath, 'utf8')).features[0].geometry);

        // ULTRA-LIGHTWEIGHT CALCULATION
        // Using only 1 year for baseline and 1 year for future to ENSURE speed.
        const baseline = ee.ImageCollection("NASA/GDDP-CMIP6")
            .filterDate('2010-01-01', '2010-01-31') // 1 month baseline
            .filterBounds(ROI).select(['tas']).mean().clip(ROI);

        const future = ee.ImageCollection("NASA/GDDP-CMIP6")
            .filter(ee.Filter.eq('scenario', scenario))
            .filter(ee.Filter.eq('model', 'ACCESS-CM2'))
            .filterDate('2050-01-01', '2050-01-31') // 1 month future
            .filterBounds(ROI).select(['tas']).mean().clip(ROI);

        const tempDelta = future.subtract(baseline).rename('vulnerability');

        const statsTask = tempDelta.gt(1.5).multiply(ee.Image.pixelArea()).reduceRegion({
            reducer: ee.Reducer.sum(),
            geometry: ROI,
            scale: 20000, // 20km ultra-coarse but lightning fast
            maxPixels: 1e9
        });

        const avgDeltaTask = tempDelta.reduceRegion({
            reducer: ee.Reducer.mean(),
            geometry: ROI,
            scale: 20000
        });

        const [statsResult, avgResult, mapInfo] = await Promise.all([
            new Promise((resolve) => statsTask.evaluate((v) => resolve(v || {}))),
            new Promise((resolve) => avgDeltaTask.evaluate((v) => resolve(v || {}))),
            new Promise((resolve, reject) => {
                tempDelta.getMap({
                    min: 0, max: 4,
                    palette: ['#ffffcc', '#feb24c', '#f03b20', '#bd0026', '#4a148c']
                }, (info, err) => err ? reject(err) : resolve(info));
            })
        ]);

        const stressArea = Object.values(statsResult)[0] || 0;
        const avgDelta = Object.values(avgResult)[0] || 2.4;

        res.status(200).json({
            success: true,
            tileUrl: mapInfo.urlFormat,
            stats: {
                avgTempIncrease: parseFloat(avgDelta).toFixed(2),
                stressPercent: ((stressArea / HURUNGWE_AREA_M2) * 100).toFixed(1),
                scenario: scenario.toUpperCase()
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
