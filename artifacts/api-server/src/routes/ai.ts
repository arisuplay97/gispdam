import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const aiRouter = Router();

aiRouter.post("/api/ai-advice", async (req, res) => {
  try {
    const { chartRaw, pointName, period } = req.body;
    
    // Fallback if no key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({ advice: "API Key Gemini belum disetting di Environment Variable (.env) server lokal." });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Anda adalah sistem pakar / engineer senior manajemen distribusi air PDAM.
Berikut adalah rekap historis grafik PDAM rentang waktu: "${period}" untuk lokasi pengamatan: "${pointName}".
Data parameter Tinggi Air (cm) dan Tekanan (bar) berformat JSON (beserta prakiraan ke depan):
${JSON.stringify(chartRaw)}

Tugas Anda: Berikan 2 sampai 4 kalimat analisis operasional lapangan dan prediksi teknis yang singkat, padat, dan to-the-point sebagai masukan untuk Direksi Manajemen PDAM. Jika Anda mendeteksi anomali penurunan/tekanan nol, berikan saran perbaikan langsung. JANGAN menulis menggunakan blok markdown berlebihan, JANGAN merujuk ke kata-kata "Berdasarkan JSON", berpura-puralah bahwa Anda mendapat data ini langsung dari sensor SCADA real-time.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    res.json({ advice: responseText });
  } catch (e: any) {
    console.error("AI Error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default aiRouter;
