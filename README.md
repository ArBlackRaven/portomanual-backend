# Portfolio Backend API

Node.js/Express backend for my personal portfolio website.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL (mysql2)
- **Auth**: JSON Web Tokens (jsonwebtoken)
- **File Uploads**: Multer
- **Security**: sanitize-html, file-type

## Features
- Projects CRUD with file uploads (thumbnail + gallery)
- Tech stack management
- Journey log (Jlog) entries
- Contact info management
- Messages inbox with image support
- Announcements/popup system
- JWT-based admin authentication

## Setup

```bash
npm install
```

Create a MySQL database and import your schema, then update `db.js` with your connection details.

```bash
npm run dev   # development with nodemon
node index.js # production
```

## API Routes
| Route | Description |
|-------|-------------|
| `POST /login` | Admin login |
| `/projects` | Projects CRUD |
| `/techs` | Tech stack CRUD |
| `/jlogs` | Journey log CRUD |
| `/contacts` | Contact info CRUD |
| `/messages` | Messages inbox |
| `/announcements` | Site announcements |
