# JanSevak - Government Complaint Management System

## Overview

JanSevak is a comprehensive government complaint management system built for the Smart India Hackathon (SIH). The system enables citizens to submit complaints through WhatsApp and provides an admin dashboard for authorities to track, manage, and resolve these complaints efficiently.

## 🏗️ Architecture

The project consists of two main components:

- **Backend**: FastAPI-based server with WhatsApp integration and AI chatbot
- **Frontend**: React + TypeScript admin dashboard with real-time analytics

## ✨ Features

### For Citizens (WhatsApp Bot)
- 📱 Submit complaints via WhatsApp
- 📸 Attach images to complaints
- 📍 Automatic location capture
- 🤖 AI-powered conversation flow
- 📊 Real-time complaint status updates

### For Administrators (Web Dashboard)
- 📊 Interactive dashboard with analytics
- 🗺️ Geographic complaint visualization (Jharkhand heatmap)
- 📋 Complaint management and tracking
- 🏛️ Department-wise complaint assignment
- 📈 Statistical insights and reporting
- 🤖 Integrated chatbot for data queries

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLite** - Database for complaint storage
- **Google Gemini AI** - AI chatbot integration
- **LangChain** - AI conversation management
- **Python-dotenv** - Environment variable management

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component library
- **Mapbox GL** - Interactive maps
- **Recharts** - Data visualization

## 📁 Project Structure

```
├── Backend/
│   ├── server.py           # Main FastAPI server
│   ├── chatbot.py          # AI chatbot implementation
│   ├── database.py         # Database operations
│   ├── models.py           # Data models
│   ├── workflow.py         # Complaint workflow logic
│   ├── requirements.txt    # Python dependencies
│   ├── uploads/           # Image uploads storage
│   └── .env               # Environment variables
├── Frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # API services
│   │   ├── hooks/         # Custom React hooks
│   │   └── styles/        # CSS styles
│   ├── package.json       # Node.js dependencies
│   └── .env               # Environment variables
└── whatsapp_bot.db        # SQLite database
```

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn
- Google Gemini API key

### Backend Setup

1. **Navigate to Backend directory**
   ```bash
   cd Backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   # or
   source venv/bin/activate  # Linux/Mac
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   ```bash
   # Create .env file in Backend directory
   GEMINI_API_KEY=your_gemini_api_key_here
   WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
   WHATSAPP_VERIFY_TOKEN=your_verify_token
   ```

5. **Start the server**
   ```bash
   python server.py
   ```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to Frontend directory**
   ```bash
   cd Frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Create .env file in Frontend directory
   VITE_API_BASE_URL=http://localhost:8000
   VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173`

## 🔧 API Endpoints

### Complaint Management
- `POST /webhook` - WhatsApp webhook endpoint
- `GET /complaints` - Retrieve all complaints
- `GET /complaints/{id}` - Get specific complaint
- `PUT /complaints/{id}` - Update complaint status
- `DELETE /complaints/{id}` - Delete complaint

### Analytics
- `GET /statistics` - Get complaint statistics
- `GET /department-stats` - Department-wise statistics
- `GET /location-data` - Geographic complaint data

### Chatbot
- `POST /chat` - Chat with AI assistant
- `GET /chat/history` - Get chat history

## 🗺️ Geographic Features

The system includes a specialized Jharkhand heatmap showing:
- Complaint density by district
- Priority-based color coding
- Interactive district information
- Real-time data updates

## 🤖 AI Chatbot Features

- Natural language query processing
- Complaint data analysis
- Statistical insights generation
- Multi-language support (Hindi/English)
- Context-aware conversations

## 📊 Database Schema

### complaint_reports table
```sql
- report_id (TEXT): Unique complaint identifier
- phone_number (TEXT): Citizen's phone number
- description (TEXT): Complaint description
- category (TEXT): Complaint category
- priority (TEXT): Priority level
- department (TEXT): Assigned department
- status (TEXT): Current status
- created_at (DATETIME): Submission timestamp
- updated_at (DATETIME): Last update timestamp
- coordinates (TEXT): Location coordinates
- session_id (TEXT): Session identifier
- image_path (TEXT): Path to attached image
- resolution_days (INTEGER): Days to resolve
```

## 🔐 Security Features

- Environment variables for sensitive data
- CORS configuration for secure API access
- Input validation and sanitization
- Secure file upload handling

## 🚀 Deployment

### Production Setup

1. **Backend Deployment**
   - Use Gunicorn or Uvicorn for production server
   - Configure reverse proxy (Nginx)
   - Set up SSL certificates
   - Use PostgreSQL for production database

2. **Frontend Deployment**
   - Build production bundle: `npm run build`
   - Deploy to static hosting (Vercel, Netlify)
   - Configure environment variables

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit pull request

## 📝 License

This project is developed for Smart India Hackathon 2025.

## 👥 Team

- **Frontend Development**: React TypeScript Dashboard
- **Backend Development**: FastAPI Server & AI Integration
- **Database Design**: SQLite Schema & Operations
- **AI/ML**: Google Gemini Integration & Chatbot

## 📞 Support

For support and queries, please contact the development team or create an issue in the repository.

---

*Built with ❤️ for Smart India Hackathon 2025*