# Provenance Radar

**An advanced investigation tool for identifying objects with potentially problematic ownership histories in museum collections**

Provenance Radar combines AI-powered risk assessment, network analysis, and timeline visualization to help researchers, curators, and investigators identify cultural heritage objects that may have been looted, stolen, or otherwise acquired through problematic means.

## 🚀 Features

### Core Investigation Tools
- **Risk Assessment Dashboard**: AI-powered scoring system that evaluates objects based on historical patterns, ownership gaps, and suspicious transaction indicators
- **Network Graph Visualization**: Interactive relationship mapping showing connections between objects, actors, places, and events with policy-aware edge coloring
- **Timeline Analysis**: Chronological visualization of provenance events with support for date ranges and source references
- **Geographic Mapping**: Location-based visualization showing the movement of objects through time and space
- **Evidence Sentences**: Full-text search through provenance documentation with AI similarity matching

### AI-Powered Analysis
- **Semantic Search**: Find similar objects and patterns using advanced embedding-based similarity search
- **AI Explanations**: Get detailed explanations of risk factors and suspicious patterns with text-to-speech playback
- **Pattern Detection**: Automatically identify common red flags like wartime sales, export restrictions, and ownership gaps

### Advanced Search & Filtering
- **Multi-source Search**: Search across multiple museum databases and collections
- **Risk-based Filtering**: Filter results by risk score thresholds and specific signal types
- **Source-specific Analysis**: Focus on particular institutions or collection sources
- **Real-time Statistics**: Live counts of objects, risk signals, and evidence sentences

## 🏗️ Architecture

### Frontend (React/TypeScript)
Built with modern web technologies for responsive, accessible investigation tools:

- **React 18** with TypeScript for type-safe component development
- **Tailwind CSS** with custom design system for consistent, professional UI
- **shadcn/ui** components for accessible, customizable interface elements
- **D3.js** for interactive network graphs and data visualizations
- **React Router** for seamless navigation between investigation views
- **Zustand** for efficient client-side state management

### Backend (Flask-Backend/)

The backend API is built with Flask and provides the core data processing and AI analysis capabilities:

```
Flask-Backend/
├── main.py              # Main Flask application and API endpoints
├── requirements.txt     # Python dependencies
└── Dockerfile          # Container configuration for deployment
```

**Key API Endpoints:**
- `/api/health` - System health and database statistics
- `/api/leads` - Filtered list of high-risk objects
- `/api/object/:id` - Detailed object information with events and risks
- `/api/graph/:id` - Network relationships for visualization
- `/api/timeline/:id` - Chronological event data
- `/api/places/:id` - Geographic data for mapping
- `/api/similar` - Semantic similarity search
- `/api/explain/object/:id` - AI-generated risk explanations
- `/api/explain/text` - AI analysis of arbitrary text
- `/api/policy/windows` - Policy period definitions for compliance

**Technologies:**
- **Flask** web framework with CORS support
- **AI/ML Integration** for risk scoring and explanation generation
- **Vector Database** for semantic search capabilities
- **REST API** design following OpenAPI specifications

### Data Ingestion (TiDB-Ingest-Notebook/)

The ingestion system processes museum collection data and builds the knowledge graph:

```
TiDB-Ingest-Notebook/
└── ingest-tidb.ipynb    # Jupyter notebook for data processing and ingestion
```

**Processing Pipeline:**
1. **Data Collection**: Ingests museum collection records from multiple sources
2. **Entity Extraction**: Identifies people, places, organizations, and events
3. **Relationship Mapping**: Builds connections between entities based on provenance records
4. **Risk Scoring**: Applies AI models to assess ownership history problems
5. **Vector Embeddings**: Creates semantic representations for similarity search
6. **Database Population**: Stores processed data in TiDB with proper indexing

**Key Features:**
- Support for multiple museum data formats (CSV, JSON, XML)
- Named Entity Recognition (NER) for automatic entity extraction
- Temporal analysis for detecting suspicious ownership patterns
- Geographic coding of locations mentioned in provenance records
- Integration with external databases (Getty vocabularies, Wikidata, etc.)

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+ (for backend development)
- Docker (for containerized deployment)

### Frontend Setup
```bash
# Clone the repository
git clone <repository-url>
cd provenance-radar

# Install dependencies
npm install

# Set environment variables
echo "VITE_API_BASE=https://rairo-provenance-api.hf.space" > .env

# Start development server
npm run dev
```

### Backend Setup
```bash
# Navigate to backend directory
cd Flask-Backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run Flask development server
python main.py
```

### Data Ingestion Setup
```bash
# Install Jupyter and required packages
pip install jupyter pandas numpy sqlalchemy

# Launch notebook
cd TiDB-Ingest-Notebook
jupyter notebook ingest-tidb.ipynb
```

## 🚀 Deployment

### Frontend Deployment
The frontend is optimized for deployment on modern hosting platforms:

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

Deploy the `dist/` folder to any static hosting service (Vercel, Netlify, etc.).

### Backend Deployment
The Flask backend includes Docker support for containerized deployment:

```bash
# Build Docker image
cd Flask-Backend
docker build -t provenance-radar-api .

# Run container
docker run -p 5000:5000 provenance-radar-api
```

## 📊 Data Sources

Provenance Radar is designed to work with various museum collection management systems:

- **Collection Management Systems**: TMS, EMu, CollectiveAccess
- **Digital Asset Management**: CONTENTdm, Omeka, DSpace
- **Standard Formats**: Dublin Core, CIDOC-CRM, LIDO
- **APIs**: Getty vocabularies, Wikidata, museum open data initiatives

## 🤝 Contributing

We welcome contributions to improve Provenance Radar's capabilities:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📈 Performance & Scalability

- **Lazy Loading**: Heavy visualization libraries load only when needed
- **Efficient Caching**: API responses cached for improved performance
- **Progressive Enhancement**: Core functionality works without JavaScript
- **Responsive Design**: Optimized for desktop and mobile investigation workflows
- **Accessibility**: WCAG 2.1 AA compliant for screen readers and keyboard navigation

## 🔒 Privacy & Security

- **No Personal Data Storage**: Only publicly available collection information
- **Secure API Communication**: HTTPS enforced for all data transmission
- **Client-side Processing**: Sensitive analysis performed locally when possible
- **Open Source**: Full transparency in algorithms and data handling

## 📄 License

MIT License

Copyright (c) 2024 Provenance Radar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 🙏 Acknowledgments

- Built with [Lovable](https://lovable.dev) for rapid prototyping and deployment
- Icons provided by [Lucide React](https://lucide.dev)
- UI components based on [shadcn/ui](https://ui.shadcn.com)
- TTS functionality powered by [Pollinations AI](https://pollinations.ai)
- Gemini for the AI
- Flask for the server hosted on Huggingface
- TiDB for the database and vector search
---

**Note**: This tool is designed to assist researchers and cultural heritage professionals. All findings should be verified through proper academic and legal channels before taking any action regarding object ownership or restitution claims.
