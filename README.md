# Smart Data Insights Dashboard

Portfolio-ready full-stack Data Science and Machine Learning dashboard.

Upload CSV, Excel, or JSON data, process it with Python, save metadata through Node.js, and explore the results in a React dashboard.

## Stack

- React 18 + Vite + Tailwind CSS + Recharts
- Node.js + Express + Multer + JWT + MongoDB/Mongoose
- Python + FastAPI + Pandas + Scikit-learn + Joblib
- Docker Compose for local running and deployment preparation

## Quick Start with Docker

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:3000
- Node API: http://localhost:5000/api/health
- Python API: http://localhost:8000/health
- MongoDB: localhost:27017

## Run Without Docker

### Backend
```bash
cd server
npm install
cp .env.example .env
npm run dev
```

### Python service
```bash
cd python-service
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd client
npm install
cp .env.example .env
npm run dev
```

## Demo Workflow

1. Create an account.
2. Upload `database/sample_students.csv`.
3. Open the dataset and click **Analyze Dataset**.
4. View analytics charts.
5. Train an ML model using `passed` as the target column.
6. Generate insights.
7. Make predictions from the trained model.

## Project Structure

```text
smart-data-insights/
├── client/          React dashboard
├── server/          Node.js API
├── python-service/  FastAPI processing and ML service
├── database/        Sample datasets
└── docker-compose.yml
```

## Portfolio Value

This project demonstrates full-stack development, API integration, file upload handling, data cleaning, exploratory data analysis, machine learning, model persistence, prediction APIs, dashboard UI, authentication, and Docker deployment readiness.

## New: Reporter Dashboard Upgrade

The Analytics page is now designed as a visual data reporter, not just a table viewer.
After processing a CSV, Excel, or JSON file, the Python service returns dashboard-ready JSON for:

- KPI cards with mini sparklines
- Main trend analyzer
- Category share donut chart
- Category breakdown bars
- Numeric distribution histogram
- Correlation finder
- Scatter relationship chart
- Data preview table
- Insight Reporter feedback: health score, main finding, risk, recommendation, best ML option, and next action

Run with:

```bash
docker compose up --build
```

Then open `http://localhost:3000`, upload `database/sample_students.csv`, analyze it, and open the Analytics page.

---

## Updated Reporter Workflow

The app now follows a stronger SDLC-aligned dashboard flow:

1. Upload a dataset.
2. Open the dataset.
3. Click **Analyze & open report**.
4. Python processes the file and creates chart-ready analytics.
5. The app automatically generates reporter feedback.
6. You are redirected to the **Insight Reporter** page.

The report includes:

- Dataset health score
- Executive summary
- Trend analyzer
- Data risks
- Machine learning recommendation
- Next action
- Exportable text report

See `docs/SDLC.md` for the project SDLC plan and testing checklist.
# smart-data-insights
# smart-data-insights
