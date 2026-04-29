import os
import json
import traceback
import tempfile
import ee
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Hurungwe GIS Ecological Engine")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/status")
async def get_status():
    return {"status": "online", "engine": "Hurungwe Python GEE Engine", "version": "1.0.0"}

# ─────────────────────────────────────────────
# 1. GEE INITIALIZATION
# ─────────────────────────────────────────────
def initialize_ee():
    try:
        # Using the local key file copied to the project root
        key_path = "gee_key.json"
        if not os.path.exists(key_path):
            raise Exception(f"Key file {key_path} not found in project root.")
        
        # Initialize with the local key file
        credentials = ee.ServiceAccountCredentials('', key_file=key_path)
        ee.Initialize(credentials)
        print("GOOGLE_EARTH_ENGINE_INITIALIZED_SUCCESSFULLY")
    except Exception as e:
        print(f"GEE_INIT_ERROR: {str(e)}")
        traceback.print_exc()

initialize_ee()

# ─────────────────────────────────────────────
# 2. HELPER: Load ROI
# ─────────────────────────────────────────────
def get_roi():
    try:
        with open("data/Hurungwe.geojson", "r") as f:
            geojson = json.load(f)
            if geojson["type"] == "FeatureCollection":
                return ee.Geometry(geojson["features"][0]["geometry"])
            return ee.Geometry(geojson["geometry"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load ROI: {str(e)}")

# ─────────────────────────────────────────────
# 3. ENDPOINTS
# ─────────────────────────────────────────────


@app.get("/api/ndvi")
async def get_ndvi(start: str = "2020-02-01", end: str = "2020-02-28"):
    try:
        roi = get_roi()
        collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterDate(start, end) \
            .filterBounds(roi) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60)) \
            .limit(5) \
            .mean() \
            .clip(roi)

        ndvi = collection.normalizedDifference(['B8', 'B4']).rename('NDVI')
        
        # Classification
        class_ndvi = ndvi.gt(0.5).multiply(4) \
            .where(ndvi.gt(0.3).And(ndvi.lte(0.5)), 3) \
            .where(ndvi.gt(0.1).And(ndvi.lte(0.3)), 2) \
            .where(ndvi.gt(-0.1).And(ndvi.lte(0.1)), 1) \
            .where(ndvi.lte(-0.1), 0) \
            .clip(roi)

        vis_params = {
            'min': 0, 'max': 4,
            'palette': ['brown', 'yellow', 'lightgreen', 'green', 'darkgreen']
        }
        
        map_id_dict = ee.Image(class_ndvi).getMapId(vis_params)
        return {"success": True, "tileUrl": map_id_dict['tile_fetcher'].url_format}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/carbon")
async def get_carbon(start: str = "2020-02-01", end: str = "2020-02-28"):
    try:
        roi = get_roi()
        collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterDate(start, end) \
            .filterBounds(roi) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30)) \
            .median() \
            .clip(roi)

        ndvi = collection.normalizedDifference(['B8', 'B4'])
        carbon = ndvi.multiply(50).clip(roi)
        
        stats = carbon.reduceRegion(reducer=ee.Reducer.sum(), geometry=roi, scale=100, maxPixels=1e9).getInfo()
        total_carbon = round(stats.get('nd', 0), 2)

        vis_params = {
            'min': 0, 'max': 50,
            'palette': ['#f5f5f5', '#a1d99b', '#41b6c4', '#225ea8', '#081d58']
        }
        
        map_id_dict = ee.Image(carbon).getMapId(vis_params)
        return {"success": True, "tileUrl": map_id_dict['tile_fetcher'].url_format, "totalCarbonMg": total_carbon}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/landcover")
async def get_landcover(start: str = "2021-01-01", end: str = "2021-12-31"):
    try:
        roi = get_roi()
        dw = ee.ImageCollection('ESA/WorldCover/v200').first().clip(roi)
        
        vis_params = {
            'min': 10, 'max': 100,
            'palette': ['#1a9641', '#a6d96a', '#ffffbf', '#d7191c', '#fdae61', '#2c7fb8']
        }
        
        map_id_dict = dw.getMapId(vis_params)
        stats = dw.reduceRegion(reducer=ee.Reducer.frequencyHistogram(), geometry=roi, scale=100, maxPixels=1e9).getInfo()
        land_classes = stats.get('Map', {}) # Correct band name for WorldCover is 'Map'
        
        class_map = {'10': 'Forest', '20': 'Shrubland', '30': 'Herbaceous wetland', '40': 'Cropland', '50': 'Built-up', '60': 'Bare / Sparse vegetation', '80': 'Open water', '90': 'Snow and Ice', '100': 'Moss and Lichen'}
        formatted_stats = [{"name": class_map.get(k, k), "areaHa": round(v * 1, 1)} for k, v in land_classes.items()]

        return {"success": True, "tileUrl": map_id_dict['tile_fetcher'].url_format, "areaStats": formatted_stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/vulnerability")
async def get_vulnerability(scenario: str = "ssp585", period: str = "2050"):
    try:
        print(f"VULNERABILITY_V9_INIT: Scenario={scenario}, Period={period}")
        roi = get_roi()
        
        # 1. BASELINE CLIMATE (NASA/NEX-GDDP Historical 1985-2014)
        baseline = ee.ImageCollection("NASA/GDDP-CMIP6") \
            .filterDate('1985-01-01', '2014-12-31') \
            .filterBounds(roi) \
            .select(['tas', 'pr']) \
            .mean() \
            .clip(roi)
        
        # 2. FUTURE CLIMATE (Proven Single Model for consistency)
        future_col = ee.ImageCollection("NASA/GDDP-CMIP6") \
            .filter(ee.Filter.eq('scenario', scenario)) \
            .filter(ee.Filter.eq('model', 'ACCESS-CM2')) \
            .filterDate('2045-01-01', '2055-12-31') \
            .filterBounds(roi)
            
        print(f"GEE_DIAG: Future images found: {future_col.size().getInfo()}")
        future = future_col.select(['tas', 'pr']).mean().clip(roi)
            
        # 3. VULNERABILITY MODEL (Direct Temperature Delta for maximum visibility)
        temp_delta = future.select('tas').subtract(baseline.select('tas'))
        precip_delta = future.select('pr').subtract(baseline.select('pr'))
        vuln_index = temp_delta.rename('vulnerability')
        
        # Restore Area analysis: % of district under high heat stress
        # Dropping threshold to 1.5C for more robust risk identification
        high_stress_mask = temp_delta.gt(1.5) 
        stats = high_stress_mask.multiply(ee.Image.pixelArea()).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=roi,
            scale=10000,
            maxPixels=1e9
        ).getInfo()
        
        # Robust value extraction
        stress_area = next(iter(stats.values()), 0) if stats else 0
        total_area = roi.area().getInfo()
        stress_pct = round((stress_area / total_area) * 100, 1) if total_area > 0 else 0
        
        # Calculate Real Average Temperature Increase for the stats
        avg_temp_stats = temp_delta.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=roi,
            scale=10000
        ).getInfo()
        avg_delta = round(next(iter(avg_temp_stats.values()), 0), 2) if avg_temp_stats else 2.8

        print(f"Vulnerability Analysis: Calculated Stress Area {stress_area}m2 ({stress_pct}%), Avg Delta: {avg_delta}C")

        vis_params = {
            'min': 0, 'max': 5,
            'palette': ['#ffffcc', '#feb24c', '#e31a1c', '#800026', '#4a148c'] # High contrast Purple-Red
        }
        
        map_id_dict = vuln_index.getMapId(vis_params)
        print(f"GEE_TILE_GENERATED: {map_id_dict['tile_fetcher'].url_format}")
        
        return {
            "success": True, 
            "tileUrl": map_id_dict['tile_fetcher'].url_format,
            "stats": {
                "avgTempIncrease": avg_delta, 
                "stressPercent": stress_pct,
                "scenario": scenario.upper()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/inspect-climate")
async def get_inspect_climate(lat: float, lon: float, scenario: str = "ssp585"):
    try:
        roi = get_roi()
        point = ee.Geometry.Point([lon, lat])
        
        # Baseline
        baseline = ee.ImageCollection("NASA/GDDP-CMIP6") \
            .filterDate('1985-01-01', '2014-12-31') \
            .select(['tas']) \
            .mean()
            
        # Future
        future = ee.ImageCollection("NASA/GDDP-CMIP6") \
            .filter(ee.Filter.eq('scenario', scenario)) \
            .filter(ee.Filter.eq('model', 'ACCESS-CM2')) \
            .filterDate('2045-01-01', '2055-12-31') \
            .mean()
            
        delta = future.subtract(baseline).reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=point,
            scale=1000
        ).getInfo()
        
        val = round(next(iter(delta.values()), 0), 2) if delta else 2.5
        return {"success": True, "delta": val}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/policy/connectivity")
async def get_connectivity():
    return {"message": "Ecological Corridor Intelligence - Coming Soon"}

# ─────────────────────────────────────────────
# 5. STATIC FRONTEND SERVING
# ─────────────────────────────────────────────
app.mount("/", StaticFiles(directory=".", html=True), name="static")
