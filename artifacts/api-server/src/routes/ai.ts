import { Router } from "express";

const aiRouter = Router();

aiRouter.post("/api/ai-advice", async (req, res) => {
  try {
    const { chartRaw, pointName, period, status } = req.body;
    
    // Fallback if no key
    if (!process.env.GROQ_API_KEY) {
      return res.status(200).json({ advice: "API Key Groq belum disetting di Environment Variable (.env) server lokal." });
    }

    const prompt = `Anda adalah sistem pakar / engineer senior manajemen distribusi air PDAM.
Berikut adalah rekap historis grafik PDAM rentang waktu: "${period}" untuk lokasi pengamatan: "${pointName}".
Saat ini algoritma pendeteksi sistem menyatakan status titik ini adalah: "${status ? status.toUpperCase() : 'NORMAL'}".
Data parameter Tinggi Air (cm) dan Tekanan (bar) berformat JSON (beserta prediksi peramalan ke depan):
${JSON.stringify(chartRaw)}

Tugas Anda: Berikan 2 sampai 4 kalimat analisis operasional lapangan dan prediksi teknis yang singkat, padat, dan to-the-point sebagai masukan untuk Direksi Manajemen PDAM. Jika status saat ini adalah KRITIS atau WASPADA (atau jika data hari/titik pengamatan terakhir menunjukkan anomali/angka drop), FOKUSKAN kalimat pertama peringatan Anda pada keadaan DARURAT terbaru tersebut ("Hari ini...", "Saat ini...") dan abaikan data normal di awal minggu/bulan. JANGAN menulis menggunakan blok markdown berlebihan, JANGAN merujuk ke kata-kata "Berdasarkan JSON", berpura-puralah bahwa Anda mendapat data ini langsung dari pantauan lapangan sensor SCADA real-time hari ini.`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 500
      })
    });

    if (!groqResponse.ok) {
        const errorData = await groqResponse.text();
        throw new Error(`Groq API Error: ${groqResponse.status} - ${errorData}`);
    }

    const result = await groqResponse.json();
    const responseText = result.choices?.[0]?.message?.content || "Gagal mendapatkan saran dari AI.";
    
    res.json({ advice: responseText });
  } catch (e: any) {
    console.error("AI Error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default aiRouter;
