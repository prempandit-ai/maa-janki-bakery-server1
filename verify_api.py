import requests
import json

def verify_api():
    try:
        response = requests.get('http://localhost:5000/api/product/list')
        data = response.json()
        
        if not data.get('success'):
            print("API returned failure.")
            return

        products = data.get('products', [])
        print(f"Verifying {len(products)} products...")
        
        for p in products[:5]: # Check first 5
            name = p.get('name')
            images = p.get('images', [])
            print(f"Product: {name}, Images: {images}")
            
    except Exception as e:
        print(f"Verification failed: {e}")

if __name__ == "__main__":
    verify_api()
