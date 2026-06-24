# SDLC Plan — Smart Data Insights Dashboard

## 1. Problem Definition
Users need a simple way to upload raw CSV, Excel, or JSON files and receive a visual dashboard, an analyst-style report, and optional machine learning feedback without writing Python code manually.

## 2. Requirements

### Functional Requirements
- Register and log in with JWT authentication.
- Upload CSV, Excel, or JSON datasets.
- Process uploaded files using Python and Pandas.
- Display chart-ready analytics instead of only a table.
- Generate an Insight Reporter page after analysis.
- Show data quality, risks, trends, recommendations, and ML suggestions.
- Train ML models using Scikit-learn.
- Make predictions from trained models.
- Export the analyst report as a text file.

### Non-Functional Requirements
- Docker-ready local execution.
- Clear separation between frontend, backend, Python ML service, and database.
- Responsive UI.
- User-isolated datasets.
- Basic error handling and user feedback through toast messages.

## 3. Architecture

```text
React Dashboard
      ↓ REST API
Node.js Express API
      ↓ file handoff / JSON
Python FastAPI ML Service
      ↓ results
MongoDB stores users, datasets, analysis, insights, and ML model metadata
```

## 4. Main Workflow

```text
Upload file
↓
Node.js stores upload
↓
User clicks Analyze & open report
↓
Python cleans data and creates chart data
↓
Node.js saves analysis
↓
Python generates reporter feedback
↓
React opens Insight Reporter page
```

## 5. Testing Checklist

- User can register.
- User can log in.
- User can upload `database/sample_students.csv`.
- Dataset appears in Datasets page.
- Clicking Analyze & open report redirects to Insight Reporter.
- Reporter page shows data health, summary, trends, risks, and recommendations.
- Charts page shows KPI cards and charts.
- ML Lab can train a model from a selected target column.
- Docker Compose starts all services.

## 6. Future Improvements

- PDF export for reports.
- Real AI text generation using an LLM.
- More chart types such as heatmaps and boxplots.
- Data cleaning controls before training.
- Admin dashboard for users and uploads.
