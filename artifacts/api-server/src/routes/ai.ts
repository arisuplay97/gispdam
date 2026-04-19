import { Router } from "express";

const aiRouter = Router();

aiRouter.post("/api/ai-advice", async (req, res) => {
  try {
    const { chartRaw, pointName, period, status, predCount } = req.body;
    
    // Fallback if no key
    if (!process.env.GROQ_API_KEY) {
      return res.status(200).json({ advice: "API Key Groq belum disetting di Environment Variable (.env) server lokal." });
    }

    const numPred = predCount || 3;

    const prompt = `Anda adalah sistem pakar / engineer senior manajemen distribusi air PDAM.
Berikut adalah rekap historis grafik PDAM rentang waktu: "${period}" untuk lokasi pengamatan: "${pointName}".
Saat ini algoritma pendeteksi sistem menyatakan status titik ini adalah: "${status ? status.toUpperCase() : 'NORMAL'}".
Data parameter Tinggi Air (cm) dan Tekanan (bar) berformat JSON:
${JSON.stringify(chartRaw)}

TUGAS: Jawab HANYA dalam format JSON MURNI (tanpa markdown, tanpa backtick) dengan struktur berikut:
{
  "advice": "2-4 kalimat analisis operasional lapangan dan prediksi teknis singkat untuk Direksi PDAM. Jika status KRITIS/WASPADA, FOKUSKAN kalimat pertama pada keadaan DARURAT terbaru. Berpura-puralah data berasal dari sensor SCADA real-time.",
  "predictions": [${Array.from({length: numPred}, (_, i) => `{"predTinggi": <angka prediksi tinggi air cm titik ke-${i+1}>, "predTekanan": <angka prediksi tekanan bar titik ke-${i+1}>}`).join(', ')}]
}
Pastikan angka predictions realistis berdasarkan tren data historis. Jangan pernah mengembalikan angka negatif.`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen/qwen3-32b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 700
      })
    });

    if (!groqResponse.ok) {
        const errorData = await groqResponse.text();
        throw new Error(`Groq API Error: ${groqResponse.status} - ${errorData}`);
    }

    const result = await groqResponse.json();
    const rawText = result.choices?.[0]?.message?.content || "{}";
    
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
      const parsed = JSON.parse(jsonStr);
      res.json({ advice: parsed.advice || "Gagal mendapatkan saran dari AI.", predictions: parsed.predictions || [] });
    } catch {
      res.json({ advice: rawText, predictions: [] });
    }
  } catch (e: any) {
    console.error("AI Error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default aiRouter;
