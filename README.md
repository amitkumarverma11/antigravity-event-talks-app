# BigQuery Release Radar 🚀

A premium real-time dashboard built using a **Python Flask** backend and a **Vanilla HTML5, Javascript, and CSS3** frontend. It fetches, parses, caches, and presents the official Google Cloud BigQuery Release Notes feed in a responsive timeline, with built-in Twitter/X sharing integration.

---

## 🌟 Key Features

- **Granular Update Cards**: Splitting calendar day logs into individual, focused updates based on their categories (*Features, Announcements, Issues, Deprecations*).
- **Server-Side Cache**: Fetched notes are cached in-memory for 5 minutes to avoid rate-limiting. Bypassed instantly when manual refresh is requested.
- **Dynamic Category Filters & Search**: Search updates by text content or filter by categories with auto-calculating indicator badges.
- **Interactive Twitter/X Composer**: 
  - Dynamic draft layout resembling a standard Twitter/X post.
  - Automatically truncates long updates to fit standard character limits (280 max).
  - SVG progress ring indicating remaining character counts (Blue ➔ Yellow warning ➔ Pink error).
  - Preset hashtag toggle buttons (`#BigQuery`, `#GoogleCloud`, `#GCP`, etc.).

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12, Flask, BeautifulSoup4, Feedparser
- **Frontend**: HTML5, Vanilla CSS3, ES6 Javascript
- **Icons & Typography**: Google Fonts (Inter & Outfit), FontAwesome

---

## 📁 Project Structure

```
agy-cli-projects/
├── app.py                 # Flask server (Feed parser API & templates router)
├── templates/
│   └── index.html         # Main dashboard HTML template
├── static/
│   ├── app.js             # Client state, dynamic filters & Twitter composer
│   └── style.css          # Glassmorphism dark-theme styling sheet
├── .gitignore             # Standard git ignore configurations
└── README.md              # Project documentation
```

---

## ⚙️ Installation & Local Setup

### Prerequisites
Make sure Python 3.12+ and Git are installed on your machine.

### 1. Clone the Repository
```bash
git clone https://github.com/amitkumarverma11/antigravity-event-talks-app.git
cd antigravity-event-talks-app
```

### 2. Install Dependencies
Install Flask, BeautifulSoup4, and feedparser:
```bash
pip install flask requests feedparser beautifulsoup4
```

### 3. Run the Application
Start the Flask dev server:
```bash
python app.py
```

The application will start running at **[http://127.0.0.1:5000/](http://127.0.0.1:5000/)**.

---

## 📊 API Endpoint

### `GET /api/releases`
Fetches and returns the parsed and structured release notes.
- **Query Parameters**:
  - `force_refresh=true`: Ignore the 5-minute memory cache and fetch fresh notes from Google.
- **Example Response**:
  ```json
  {
    "cached": false,
    "last_fetched": 1718974500,
    "data": {
      "count": 30,
      "entries": [
        {
          "id": "tag:google.com,2016:bigquery-release-notes#June_17_2026",
          "title": "June 17, 2026",
          "link": "https://docs.cloud.google.com/bigquery/docs/release-notes#June_17_2026",
          "updated": "2026-06-17T00:00:00-07:00",
          "updates": [
            {
              "type": "Feature",
              "html": "<p>You can enable autonomous embedding...</p>",
              "text": "You can enable autonomous embedding..."
            }
          ]
        }
      ]
    }
  }
  ```
