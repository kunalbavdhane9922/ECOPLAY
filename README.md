# EcoPlay - Gamifying Environmental Action Platform

EcoPlay is a production-ready, gamified platform designed to encourage ecological missions and track environmental actions through an immersive digital ecosystem.

## 🚀 Core Functionalities

### 1. Immersive Frontend (Web - React/Vite)
- **Gamified World Map**: 5 thematic islands with unique biomes and progression paths (Spark, Unity, Shield, Thrive, Legacy).
- **Island Progression System**: Level-based locking mechanism and dynamic pathing between mission zones.
- **Tactical Journey Maps**: Detailed 2D roadmaps for each island with interactive milestones.
- **Dynamic Status Dashboard**: Real-time XP tracking, role evolution (Explorer to Legend), and achievement points.
- **Environmental Reporting Interface**: Intuitive UI for categorizing issues (Plastic, Air, Water, Greenery) and uploading proof.
- **Responsive Animations**: Cyberpunk aesthetic with neon glows, interactive clouds, and smooth transitions.

### 2. Robust Backend Service (Node.js / Prisma)
- **Authentication Engine**: Secure registration and login workflows.
- **Geospatial Mission Engine**: Powered by **PostGIS** for location-aware environmental issue tracking.
- **Nearby Mission Discovery**: API endpoints to find environmental issues within a specific radius.
- **Mission Lifecycle Management**: Creating, accepting, and submitting missions for verification.
- **Database Architecture**: Structured schema using **Prisma** with support for users, issues, missions, and verifications.

### 3. Verification & ML Integration
- **Image Upload Integration**: Backend support for handling task and report image submissions.
- **ML Validation Pipeline**: Placeholder/System logic for automated proof verification (using Python FastAPI microservices).
- **Verification Workflow**: Structured process for reviewing submitted reports and awarding points/XP.

### 4. Mobile Application (React Native / Expo)
- **On-the-go Mission Tracking**: Mobile-first interface for real-world environmental action.
- **Cross-Platform Compatibility**: Built with React Native for deployment on Android and iOS.

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend (Web)** | React, Vite, Vanilla CSS, JS |
| **Frontend (Mobile)** | React Native, Expo, TypeScript |
| **Backend** | Node.js, Express, Prisma, JWT |
| **Database** | PostgreSQL + PostGIS (Geospatial data) |
| **Verification** | Python, FastAPI (ML Microservice) |
| **Storage** | Firebase Storage / Static File Serving |

## 📂 Project Structure Overview
- `/Version1EcoPLay`: Latest React-based Web Frontend.
- `/backend`: Node.js API with Prisma and PostGIS logic.
- `/mobile-app`: React Native implementation for mobile devices.

## 📈 Roadmap & Next Steps
- [ ] Connect full Web Frontend to the Node.js API.
- [ ] Finalize ML model integration for automated image classification.
- [ ] Implement Real-time notifications via Socket.io for mission updates.
- [ ] Deploy with MongoDB Atlas / PostgreSQL Cloud instances.
