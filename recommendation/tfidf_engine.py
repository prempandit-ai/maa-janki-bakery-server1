
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import json
import os
import sys

def generate_similarity_matrix(products_data):
    if not products_data:
        return None

    df = pd.DataFrame(products_data)
    
    # Combine features: name, category, and description
    # Ensure description is a string (it might be a list or multi-line string in the DB)
    def clean_description(desc):
        if isinstance(desc, list):
            return " ".join(desc)
        return str(desc)

    df['clean_description'] = df['description'].apply(clean_description)
    
    # Handle tags (assuming it's a list)
    def clean_tags(tags):
        if isinstance(tags, list):
            return " ".join(tags)
        return str(tags) if tags else ""
    
    df['clean_tags'] = df.get('tags', pd.Series([""] * len(df))).apply(clean_tags)
    
    df['content'] = df['name'] + " " + df['category'] + " " + df['clean_description'] + " " + df['clean_tags']
    
    # Initialize TF-IDF Vectorizer
    tfidf = TfidfVectorizer(stop_words='english')
    
    # Construct TF-IDF matrix
    tfidf_matrix = tfidf.fit_transform(df['content'])
    
    # Compute Cosine Similarity
    cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix)
    
    # Map product IDs to indices
    indices = pd.Series(df.index, index=df['_id']).to_dict()
    
    # Create the similarity matrix object
    similarity_matrix = {}
    for pid, idx in indices.items():
        # Get similarity scores for this product
        sim_scores = list(enumerate(cosine_sim[idx]))
        # Sort by similarity score (descending)
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
        
        # Get top 10 similar products (excluding itself)
        # Store as {product_id: score}
        top_sim = []
        for i, score in sim_scores:
            target_pid = df.iloc[i]['_id']
            if target_pid != pid:
                top_sim.append({"id": target_pid, "score": float(score)})
            if len(top_sim) >= 10:
                break
        
        similarity_matrix[pid] = top_sim
        
    return similarity_matrix

if __name__ == "__main__":
    # Use absolute paths based on the script's location
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(base_dir, "products.json")
    output_file = os.path.join(base_dir, "similarity_matrix.json")

    if os.path.exists(input_file):
        with open(input_file, "r") as f:
            data = json.load(f)
        
        matrix = generate_similarity_matrix(data)
        
        with open(output_file, "w") as f:
            json.dump(matrix, f, indent=4)
        
        print(f"Similarity matrix generated successfully at {output_file}")
    else:
        print(f"Error: Input file {input_file} not found.")
        sys.exit(1)
