import express from 'express';
import 'dotenv/config';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  let aiClient: GoogleGenAI | null = null;
  const getAI = () => {
    if (!aiClient) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is required");
      }
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return aiClient;
  };

  app.get("/api/v1/tree-metrics/:tree_id", (req, res) => {
    const { tree_id } = req.params;
    if (!tree_id) return res.status(400).json({ error: "Invalid Tree ID" });
    
    // Mock metrics based on user prompt
    const mock_metrics = {
      DBH: 42.5,
      height: 14.2,
      crown_spread: 9.1,
      lean_angle: 18.5,
      wind_load_resistance: "Compromised: High stress concentrated on codominant V-crotch stems"
    };

    res.json(mock_metrics);
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, biometrics } = req.body;
      const ai = getAI();
      const systemInstruction = `You are an elite ISA Certified Arborist holding a TRAQ qualification. Review the provided tree biometrics. Deliver a concise, professional structural risk assessment. Highlight biomechanical red flags such as excessive lean angles or poor live crown ratios.\nCurrent Tree Biometrics: ${JSON.stringify(biometrics)}`;

      let contents = [];
      if (messages && Array.isArray(messages)) {
        contents = messages.map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content || '' }]
        }));
      } else {
        contents = [{ role: 'user', parts: [{ text: 'Hello' }] }];
      }

      const stream = await ai.models.generateContentStream({
        model: 'gemini-3.1-pro-preview',
        contents,
        config: { systemInstruction }
      });
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      for await (const chunk of stream) {
        if (chunk.text) {
          res.write(chunk.text);
        }
      }
      res.end();
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
