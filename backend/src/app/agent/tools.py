"""LangChain tools for the ZEK agent."""

import json
from typing import Optional
import requests


def search_products(
    q: Optional[str] = None,
    category: Optional[str] = None,
    brand: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    limit: int = 8,
) -> str:
    """Search for products in the catalog. Use this when the user asks about products, categories, or shopping recommendations.
    
    Args:
        q: Search query for product name or description
        category: Filter by category
        brand: Filter by brand
        min_price: Minimum price filter
        max_price: Maximum price filter
        limit: Maximum number of results to return (default 8)
    
    Returns:
        JSON string containing a list of products with id, slug, name, price, compareAt, brand, and image fields
    """
    try:
        # Build query parameters
        params = {}
        if q:
            params["q"] = q
        if category:
            params["category"] = category
        if brand:
            params["brand"] = brand
        if min_price is not None:
            params["min_price"] = min_price
        if max_price is not None:
            params["max_price"] = max_price
        if limit:
            params["limit"] = limit
        
        # Call the products API
        response = requests.get(
            "http://localhost:2024/api/v1/products",
            params=params,
            timeout=5
        )
        response.raise_for_status()
        
        # Parse response
        data = response.json()
        
        # Extract products from response
        # The API returns ProductListResponse which has an 'items' field
        items = data.get("items", [])
        
        # Transform to the format expected by the frontend
        products = []
        for item in items:
            # Handle image - take first image if it's a list, or use as-is if it's a string
            image_url = ""
            if "image" in item:
                if isinstance(item["image"], list) and len(item["image"]) > 0:
                    image_url = item["image"][0]
                elif isinstance(item["image"], str):
                    image_url = item["image"]
            
            product = {
                "id": str(item.get("id", "")),
                "slug": item.get("slug", ""),
                "name": item.get("name", ""),
                "price": float(item.get("price", 0)),
                "brand": item.get("brand", ""),
                "image": image_url,
            }
            
            # Add compareAt if compare_at_price exists
            if "compare_at_price" in item and item["compare_at_price"]:
                product["compareAt"] = float(item["compare_at_price"])
            
            products.append(product)
        
        return json.dumps(products)
    
    except requests.RequestException as e:
        return json.dumps({"error": f"Failed to fetch products: {str(e)}"})
    except Exception as e:
        return json.dumps({"error": f"Unexpected error: {str(e)}"})
