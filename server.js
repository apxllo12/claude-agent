import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg";
import puppeteer from "puppeteer";
import jsQR from "jsqr";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create tables
pool.query(`
  CREATE TABLE IF NOT EXISTS qr_verifications (
    id BIGSERIAL PRIMARY KEY,
    qr_data TEXT UNIQUE NOT NULL,
    phone_number TEXT,
    verification_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
  );
  
  CREATE TABLE IF NOT EXISTS claude_accounts (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone_used TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );
`);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/scan-qr", async (req, res) => {
  try {
    const { qrData } = req.body;
    
    await pool.query(
      `INSERT INTO qr_verifications (qr_data, verification_status) 
       VALUES ($1, 'approved') 
       ON CONFLICT (qr_data) DO UPDATE SET verification_status = 'approved'`,
      [qrData]
    );
    
    res.json({ success: true, status: "Account Verified ✅" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/create-claude", async (req, res) => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // TODO: Add SMS API integration here
    const email = `test${Date.now()}@10minutemail.com`;
    const password = "TestPass123!";
    const phone = "+15005550006"; // Test number
    
    await page.goto("https://claude.ai/login");
    // Full signup flow here
    
    await browser.close();
    
    await pool.query(
      `INSERT INTO claude_accounts (email, password, phone_used) VALUES ($1, $2, $3)`,
      [email, password, phone]
    );
    
    res.json({ success: true, account: { email, password } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
