import os
import re
import time
import requests
import feedparser
from bs4 import BeautifulSoup
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION_SECS = 300  # 5 minutes

def clean_text(html_content):
    """Extract clean plain text from HTML, ensuring correct spacing."""
    soup = BeautifulSoup(html_content, 'html.parser')
    # Use space as a separator to avoid squishing words
    text = soup.get_text(separator=" ")
    # Replace multiple spaces/newlines with a single space
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def fetch_and_parse_feed():
    """Fetch the feed and parse it into structured JSON."""
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        # Parse using feedparser
        feed = feedparser.parse(response.content)
        
        parsed_entries = []
        
        for entry in feed.entries:
            content_html = ''
            if 'content' in entry and entry['content']:
                content_html = entry['content'][0].get('value', '')
            elif 'summary' in entry:
                content_html = entry.get('summary', '')
                
            soup = BeautifulSoup(content_html, 'html.parser')
            
            updates = []
            current_type = "General"
            current_elements = []
            
            # Iterate through child nodes to group paragraphs by h3 headers
            for child in soup.children:
                # Filter out raw string objects that are just newlines
                if child.name == 'h3':
                    # Save the previous update if we accumulated elements for it
                    if current_elements:
                        html_str = "".join(str(el) for el in current_elements)
                        updates.append({
                            'type': current_type,
                            'html': html_str,
                            'text': clean_text(html_str)
                        })
                        current_elements = []
                    current_type = child.get_text().strip()
                elif child.name is not None:
                    current_elements.append(child)
            
            # Append final remaining update
            if current_elements:
                html_str = "".join(str(el) for el in current_elements)
                updates.append({
                    'type': current_type,
                    'html': html_str,
                    'text': clean_text(html_str)
                })
            
            # If no updates parsed but we have content, treat as one General update
            if not updates and content_html.strip():
                updates.append({
                    'type': "General",
                    'html': content_html,
                    'text': clean_text(content_html)
                })
                
            parsed_entries.append({
                'id': entry.get('id'),
                'title': entry.get('title'),  # Usually the date, e.g., "June 17, 2026"
                'link': entry.get('link'),
                'updated': entry.get('updated') or entry.get('published'),
                'updates': updates
            })
            
        return {
            "success": True,
            "entries": parsed_entries,
            "count": len(parsed_entries),
            "timestamp": time.time()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": time.time()
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('force_refresh', '').lower() == 'true'
    now = time.time()
    
    # Return cache if valid and not force-refreshing
    if cache["data"] and not force_refresh and (now - cache["last_fetched"] < CACHE_DURATION_SECS):
        return jsonify({
            "cached": True,
            "last_fetched": cache["last_fetched"],
            "data": cache["data"]
        })
        
    # Otherwise fetch fresh details
    result = fetch_and_parse_feed()
    if result.get("success"):
        cache["data"] = result
        cache["last_fetched"] = now
        return jsonify({
            "cached": False,
            "last_fetched": now,
            "data": result
        })
    else:
        # If fetch failed but we have stale cache, return it with a warning
        if cache["data"]:
            return jsonify({
                "cached": True,
                "warning": "Failed to fetch fresh feed, returning cached data. Error: " + result.get("error", "Unknown"),
                "last_fetched": cache["last_fetched"],
                "data": cache["data"]
            })
        return jsonify({
            "success": False,
            "error": result.get("error", "Failed to fetch feed details")
        }), 500

if __name__ == '__main__':
    # Default Flask runs on localhost:5000
    app.run(debug=True, host='127.0.0.1', port=5000)
