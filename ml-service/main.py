from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import requests
from io import BytesIO
from PIL import Image
import numpy as np
import imagehash
import hashlib
import os
import time

app = FastAPI(
    title="Eco Platform ML Validation Service",
    description="ML microservice for validating environmental report images",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# In-memory image hash store for duplicate detection
# In production, use Redis
image_hash_store = set()

class ImageRequest(BaseModel):
    image_url: str
    report_type: Optional[str] = "garbage"

class ValidationResponse(BaseModel):
    is_valid: bool
    confidence: float
    category: str
    is_blank: bool
    is_duplicate: bool
    fraud_flag: bool
    reason: str
    processing_time_ms: float

def fetch_image(url: str) -> Image.Image:
    """Fetch image from URL"""
    try:
        response = requests.get(url, timeout=15, headers={
            'User-Agent': 'EcoPlatform-ML/1.0'
        })
        response.raise_for_status()
        return Image.open(BytesIO(response.content)).convert('RGB')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch image: {str(e)}")

def is_blank_image(image: Image.Image) -> bool:
    """Detect if image is blank/uniform"""
    gray = image.convert('L')
    arr = np.array(gray)
    variance = np.var(arr)
    return variance < 150

def compute_image_hash(image: Image.Image) -> str:
    """Compute perceptual hash for duplicate detection"""
    phash = imagehash.phash(image)
    return str(phash)

def is_duplicate_image(image: Image.Image) -> bool:
    """Check if this image was previously submitted"""
    img_hash = compute_image_hash(image)
    if img_hash in image_hash_store:
        return True
    image_hash_store.add(img_hash)
    return False

def analyze_image_content(image: Image.Image, report_type: str) -> dict:
    """
    Analyze image content based on report type.
    In production: load actual TensorFlow/PyTorch model here.
    
    Current implementation uses color-heuristic based analysis:
    - Green-dominant = tree related
    - Dark/brown with mixed colors = garbage
    - Blue/reflective = water
    """
    arr = np.array(image)
    height, width = arr.shape[:2]
    total_pixels = height * width

    # Extract channel averages
    r_mean = np.mean(arr[:, :, 0])
    g_mean = np.mean(arr[:, :, 1])
    b_mean = np.mean(arr[:, :, 2])

    # Color variance across regions (more variance = more content complexity)
    img_small = image.resize((64, 64))
    arr_small = np.array(img_small)
    color_variance = np.var(arr_small)
    
    # Dark or mixed pixels indicate potential garbage
    dark_pixels = np.sum(np.all(arr < 80, axis=2)) / total_pixels
    green_pixels = np.sum((arr[:,:,1] > arr[:,:,0]) & (arr[:,:,1] > arr[:,:,2])) / total_pixels
    blue_pixels = np.sum((arr[:,:,2] > arr[:,:,0]) & (arr[:,:,2] > arr[:,:,1])) / total_pixels

    confidence = 0.0
    detected_category = "unknown"

    if report_type == "garbage":
        # Garbage: typically has mixed colors, dark regions, complex textures
        if color_variance > 500 and dark_pixels > 0.1:
            confidence = min(0.95, 0.65 + (color_variance / 5000) + dark_pixels)
            detected_category = "garbage"
        else:
            confidence = min(0.75, 0.45 + color_variance / 8000)
            detected_category = "garbage"

    elif report_type == "tree":
        # Tree: predominantly green
        if green_pixels > 0.3:
            confidence = min(0.97, 0.60 + green_pixels + color_variance / 10000)
            detected_category = "vegetation"
        else:
            confidence = min(0.70, 0.40 + green_pixels)
            detected_category = "tree_related"

    elif report_type == "water":
        # Water: blue-dominant or reflective
        if blue_pixels > 0.2 or b_mean > 100:
            confidence = min(0.93, 0.60 + blue_pixels + (b_mean / 500))
            detected_category = "water"
        else:
            confidence = min(0.65, 0.40 + blue_pixels)
            detected_category = "water_related"
    else:
        # Generic environmental content
        confidence = min(0.85, 0.50 + color_variance / 5000)
        detected_category = "environmental"

    return {
        "confidence": round(float(confidence), 4),
        "category": detected_category,
        "color_stats": {
            "r_mean": float(r_mean),
            "g_mean": float(g_mean),
            "b_mean": float(b_mean),
            "variance": float(color_variance),
            "green_ratio": float(green_pixels),
            "blue_ratio": float(blue_pixels),
            "dark_ratio": float(dark_pixels)
        }
    }

def fraud_detection(image: Image.Image, is_blank: bool, is_duplicate: bool, confidence: float) -> tuple:
    """Determine fraud flags"""
    if is_blank:
        return True, "Image appears blank or uniform"
    if is_duplicate:
        return True, "Duplicate image detected - previously submitted"
    if confidence < 0.25:
        return True, "Image content does not match report type"
    return False, ""

@app.post("/predict", response_model=ValidationResponse)
async def predict(request: ImageRequest):
    """
    Main ML validation endpoint.
    Validates environmental report images for:
    - Blank detection
    - Content analysis
    - Duplicate detection
    - Fraud flagging
    """
    start_time = time.time()

    try:
        # Fetch image
        image = fetch_image(request.image_url)

        # Check if blank
        blank = is_blank_image(image)

        # Check for duplicates
        duplicate = is_duplicate_image(image)

        # Analyze content
        analysis = analyze_image_content(image, request.report_type)

        # Fraud detection
        fraud, reason = fraud_detection(image, blank, duplicate, analysis["confidence"])

        # Final validity
        is_valid = not fraud and analysis["confidence"] > 0.4

        processing_time = (time.time() - start_time) * 1000

        return ValidationResponse(
            is_valid=is_valid,
            confidence=analysis["confidence"],
            category=analysis["category"],
            is_blank=blank,
            is_duplicate=duplicate,
            fraud_flag=fraud,
            reason=reason if reason else ("Valid environmental report" if is_valid else "Low confidence score"),
            processing_time_ms=round(processing_time, 2)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML processing error: {str(e)}")

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "Eco Platform ML Validation",
        "version": "1.0.0",
        "hash_store_size": len(image_hash_store)
    }

@app.delete("/reset-hashes")
async def reset_hashes():
    """Reset duplicate hash store (admin use only)"""
    image_hash_store.clear()
    return {"message": "Hash store cleared", "size": 0}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
