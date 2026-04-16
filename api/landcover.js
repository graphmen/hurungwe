const ee = require('@google/earthengine');

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
        await authenticateGEE();

        // ROI — Hurungwe District bounding box
        const ROI = ee.Geometry.Rectangle([
            28.8229704360000483, -17.4338938509999366,
            30.3348169510000503, -15.6071430269999496
        ]);

        // 1. Load ESA WorldCover v200 (ImageCollection → pick first image)
        const wc = ee.ImageCollection("ESA/WorldCover/v200").first().clip(ROI);

        // 2. Reclassify: map ESA codes → 6 simplified classes
        // ESA codes: 10=Tree, 20=Shrub, 30=Grass, 40=Crop, 50=Built, 60=Bare, 80=Water, 90=Wetland
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

        // 4. Area statistics per class (scale=100m for serverless speed)
        const pixelAreaHa = ee.Image.pixelArea().divide(10000);
        const classIds = [1, 2, 3, 4, 5, 6];
        const classNames = ['Forest', 'Grass/Shrub/Wetland', 'Cropland', 'Built-up', 'Bare/Sparse', 'Open Water'];

        const areaResults = await Promise.all(
            classIds.map((id) =>
                new Promise((resolve, reject) => {
                    lulc.eq(id).multiply(pixelAreaHa)
                        .reduceRegion({
                            reducer: ee.Reducer.sum(),
                            geometry: ROI,
                            scale: 200,
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
            areaStats: areaResults
        });

    } catch (err) {
        console.error("Land Cover API Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};
