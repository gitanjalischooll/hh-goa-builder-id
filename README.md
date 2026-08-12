# 🏝️ Hacker House Goa 2026 — Builder ID Generator

A web-based **Builder ID Card Generator** created for **Hacker House Goa 2026**.

The application allows participants to enter their details, upload a profile photo, generate a personalized Builder ID card, preview the front and back designs, download the card as a PDF, and create a temporary shareable link.

> **Where code meets the coast. Ship products, not just hacks. 🌊**

---

## ✨ Features

* 🪪 Generate personalized Builder ID cards
* 📸 Upload and process profile photos
* 🔄 Automatically correct photo orientation using EXIF data
* ✂️ Crop uploaded photos into a square format
* 🎨 Hacker House Goa themed ID card design
* 🔳 Generate dynamic QR codes
* 👤 Add builder name, title, and technology stack
* 👀 Preview front and back of the Builder ID
* 📄 Download the completed ID as a 2-page PDF
* 🔗 Generate temporary shareable Builder ID links
* 𝕏 Share Builder ID cards on X/Twitter
* 📱 Responsive and mobile-friendly interface
* ⚡ Node.js and Express backend for image, QR, PDF, and sharing functionality

---

## 🛠️ Tech Stack

### Frontend

* HTML5
* CSS3
* JavaScript
* Canvas API

### Backend

* Node.js
* Express.js
* Multer
* Sharp
* QRCode
* PDFKit
* UUID
* CORS
* Dotenv

### Development & Deployment

* Git & GitHub — Version control and collaboration
* Vercel — Frontend deployment
* Render — Backend deployment

---

## 🏗️ Project Architecture

```text
                         ┌─────────────────────┐
                         │       USER          │
                         │  Builder ID Form    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │      FRONTEND       │
                         │   HTML/CSS/JS       │
                         │      /public        │
                         └──────────┬──────────┘
                                    │
                              API Requests
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │       BACKEND       │
                         │ Node.js + Express   │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
         Image Processing       QR Generation        PDF Generation
             Sharp                QRCode                PDFKit
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    ▼
                         ┌─────────────────────┐
                         │   Builder ID Card   │
                         │   Preview / PDF     │
                         │    / Share Link     │
                         └─────────────────────┘
```

---

## 📁 Project Structure

```text
hh-goa-builder-id/
│
├── public/
│   ├── assets/
│   │   ├── idcard-front.png
│   │   ├── idcard-back.png
│   │   ├── palm-left.svg
│   │   ├── palm-right.svg
│   │   └── waves.svg
│   │
│   ├── js/
│   │   ├── apiService.js
│   │   ├── app.js
│   │   └── idCardRenderer.js
│   │
│   ├── index.html
│   └── style.css
│
├── ui-reference/
│   ├── assets/
│   ├── index.html
│   └── style.css
│
├── server.js
├── serve-frontend.js
├── package.json
├── package-lock.json
├── README.md
├── .gitignore
│
└── .env
```

> **Note:** `.env` and `node_modules/` are intentionally excluded from GitHub using `.gitignore`.

---

## ⚙️ Requirements

Before running the project locally, install:

* **Node.js 18 or higher**
* **npm**
* **Git**

Check your installed versions:

```bash
node -v
npm -v
git --version
```

---

## 🚀 Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/gitanjalischool/hh-goa-builder-id.git
```

### 2. Open the project

```bash
cd hh-goa-builder-id
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3000
BASE_URL=http://localhost:3000
```

Do **not** upload `.env` to GitHub.

### 5. Start the backend

```bash
npm start
```

The backend runs on:

```text
http://localhost:3000
```

### 6. Start the frontend

Open another terminal:

```bash
npm run frontend
```

The frontend runs on:

```text
http://localhost:5000
```

Open the frontend in your browser:

```text
http://localhost:5000
```

---

## 🔌 API Endpoints

| Method | Endpoint                  | Purpose                                 |
| ------ | ------------------------- | --------------------------------------- |
| `POST` | `/api/process-image`      | Processes and crops the uploaded photo  |
| `POST` | `/api/generate-qr`        | Generates a QR code                     |
| `POST` | `/api/generate-pdf`       | Generates the 2-page Builder ID PDF     |
| `POST` | `/api/create-share-link`  | Creates a temporary shareable card link |
| `GET`  | `/share/:cardId`          | Displays the share preview page         |
| `GET`  | `/api/card-image/:cardId` | Returns the generated card image        |
| `GET`  | `/api/health`             | Checks backend health                   |

---

## 🖼️ Image Processing

The backend uses **Sharp** to process uploaded photos.

The image processing pipeline:

```text
Uploaded Photo
      ↓
Read EXIF Orientation
      ↓
Correct Rotation
      ↓
Resize & Crop
      ↓
600 × 600 PNG
      ↓
Return Base64 Image
```

This helps handle photos taken using mobile cameras where the image orientation may be stored in EXIF metadata.

---

## 🔳 QR Code Generation

The backend uses the **QRCode** package to generate a dynamic QR code.

By default, the QR code points to:

```text
https://hhgoa.com
```

The QR code can also be generated for another URL through the API.

---

## 📄 PDF Generation

The generated front and back Builder ID images are combined into a single PDF.

The resulting PDF contains:

```text
Page 1 → Front of Builder ID
Page 2 → Back of Builder ID
```

The PDF is generated server-side using **PDFKit**.

---

## 🔗 Shareable Builder ID

The application can create a temporary shareable Builder ID link.

The process is:

```text
Generate ID
     ↓
Create Share Link
     ↓
Temporary Card ID
     ↓
Share URL
     ↓
Preview Page
     ↓
Share on X
```

The backend stores generated card images temporarily in memory.

### Important

Share links are **temporary** and are not permanent database records.

They expire after the configured cache lifetime or when the backend restarts.

This is suitable for the hackathon/demo use case.

---

## 🌐 Deployment

### Frontend

The frontend can be deployed using **Vercel**.

The frontend files are located inside:

```text
/public
```

After deployment, the frontend should communicate with the deployed backend through the configured API URL.

### Backend

The Node.js/Express backend can be deployed using **Render**.

Typical configuration:

```text
Build Command:
npm install

Start Command:
npm start
```

The backend requires environment variables such as:

```env
PORT=10000
BASE_URL=https://your-backend-url.onrender.com
```

After deployment, verify the backend using:

```text
https://your-backend-url.onrender.com/api/health
```

---

## 🔐 Environment Variables

The `.env` file should **never be committed to GitHub**.

Example:

```env
PORT=3000
BASE_URL=http://localhost:3000
```

For production, configure environment variables directly in the hosting platform.

The project `.gitignore` contains:

```text
node_modules/
.env
*.log
```

---

## 🤝 Team Collaboration

This project is maintained as a team project using GitHub.

### Developers

| Developer             | Contribution                               |
| --------------------- | ------------------------------------------ |
| **Gitanjali Jain**    | Frontend Development & Project Integration |
| **Akshat Shrisant**   | Backend Development & API Integration      |
| **Prajusha Gangrade** | UI/UX Design & Frontend Development        |

Team members collaborate through GitHub branches and pull requests to keep the `main` branch stable.

---

## 🎯 Project Goal

The goal of this project is to provide Hacker House Goa 2026 participants with a simple and fast way to create personalized Builder ID cards.

The application combines:

* A responsive frontend
* Photo processing
* Dynamic QR generation
* Canvas-based ID rendering
* Server-side PDF generation
* Temporary share links
* Social sharing functionality

into one complete Builder ID generation workflow.

---

## 🏝️ Hacker House Goa 2026

Built for **Hacker House Goa 2026**.

**#FRAMEINGOA**
**#BUILDINPARADISE**

---

## 📄 License

This project was created as a hackathon project for **Hacker House Goa 2026**.
