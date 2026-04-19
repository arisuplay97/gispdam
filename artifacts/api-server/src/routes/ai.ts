import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const aiRouter = Router();

aiRouter.post("/api/ai-advice", async (req, res) => {
  try {
    const { chartRaw, pointName, period, status } = req.body;
    
    // Fallback if no key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({ advice: "API Key Gemini belum disetting di Environment Variable (.env) server lokal." });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Anda adalah sistem pakar / engineer senior manajemen distribusi air PDAM.
Berikut adalah rekap historis grafik PDAM rentang waktu: "${period}" untuk lokasi pengamatan: "${pointName}".
Saat ini algoritma pendeteksi sistem menyatakan status titik ini adalah: "${status ? status.toUpperCase() : 'NORMAL'}".
Data parameter Tinggi Air (cm) dan Tekanan (bar) berformat JSON (beserta prediksi peramalan ke depan):
${JSON.stringify(chartRaw)}

Tugas Anda: Berikan 2 sampai 4 kalimat analisis operasional lapangan dan prediksi teknis yang singkat, padat, dan to-the-point sebagai masukan untuk Direksi Manajemen PDAM. Jika status saat ini adalah KRITIS atau WASPADA (atau jika data hari/titik pengamatan terakhir menunjukkan anomali/angka drop), FOKUSKAN kalimat pertama peringatan Anda pada keadaan DARURAT terbaru tersebut ("Hari ini...", "Saat ini...") dan abaikan data normal di awal minggu/bulan. JANGAN menulis menggunakan blok markdown berlebihan, JANGAN merujuk ke kata-kata "Berdasarkan JSON", berpura-puralah bahwa Anda mendapat data ini langsung dari pantauan lapangan sensor SCADA real-time hari ini.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    res.json({ advice: responseText });
  } catch (e: any) {
    console.error("AI Error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default aiRouter;
