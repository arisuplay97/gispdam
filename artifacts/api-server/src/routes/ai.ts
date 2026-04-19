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

    const prompt = `ROLE:
Kamu adalah "Senior Hydraulic Engineer & Data Analyst" untuk PDAM Tirta Ardhia Rinjani. Tugasmu adalah melakukan diagnosa pada dashboard sistem monitoring distribusi air (SIM-DIST) secara real-time.

CONTEXT:
Lokasi pengamatan: "${pointName}".
Rentang waktu data: "${period}".
Status deteksi sistem saat ini: "${status ? status.toUpperCase() : 'NORMAL'}".
Data historis parameter Tinggi Air (cm) dan Tekanan (bar) dalam format JSON:
${JSON.stringify(chartRaw)}

LOGIKA ANALISA TEKNIS (Wajib Diikuti):
1. KORELASI TINGGI vs TEKANAN:
   - NORMAL: Jika Tinggi Air turun, Tekanan ikut turun sedikit karena penggunaan warga (Pola Beban Puncak).
   - ANOMALI TEKNIS: Jika Tinggi Air NAIK atau STABIL, tapi Tekanan TURUN drastis, ini tanda "Penyumbatan Katup" atau "Pipa Pecah" di jalur transmisi.
2. POLA BEBAN PUNCAK (Siklus Harian):
   - Kenali penurunan tekanan pada jam sibuk (05.00-08.00 WITA pagi dan 17.00-20.00 WITA) sebagai kondisi AMAN, bukan kerusakan.
3. ANALISA DATA CURAM:
   - Jangan melakukan "smoothing" jika terjadi penurunan >20% di luar jam beban puncak.
   - Jangan memaksa memprediksi grafik "curam" jika tren data menunjukkan stabilitas. Prediksi harus didasarkan pada REPEATABILITY (pengulangan pola).

TUGAS: Jawab HANYA dalam format JSON MURNI (tanpa markdown, tanpa backtick, tanpa penjelasan tambahan) dengan struktur berikut:
{
  "advice": "[STATUS]: NORMAL/WASPADA/KRITIS. [ANALISA]: Maks 5 kalimat teknis kondisi saat ini. [BUKTI DATA]: Sebutkan Hari/Tanggal saat anomali paling signifikan beserta angka spesifiknya. [PREDIKSI]: Tren 24-72 jam ke depan berdasarkan statistik data, jika pola anomali terlihat berulang beri peringatan keras. [CONFIDENCE]: Skor 0-100% disertai alasan singkat (contoh: 90% - data historis 7 hari sangat konsisten). [SARAN LAPANGAN]: Instruksi spesifik untuk petugas (misal: Cek Air Valve, manual flushing, pantau bukaan katup). [SARAN DIREKSI]: Rekomendasi kebijakan/eskalasi.",
  "predictions": [${Array.from({length: numPred}, (_, i) => `{"predTinggi": <angka prediksi tinggi air cm titik ke-${i+1}>, "predTekanan": <angka prediksi tekanan bar titik ke-${i+1}>}`).join(', ')}]
}

ATURAN KETAT:
- WAJIB merespons SEPENUHNYA dalam Bahasa Indonesia.
- Tone: Profesional, teknis, singkat, berorientasi tindakan lapangan. DILARANG basa-basi atau kata puitis.
- Angka predictions WAJIB realistis berdasarkan tren data dan REPEATABILITY pola. Jangan pernah mengembalikan angka negatif.
- Jika data menunjukkan anomali serius, BERANI memberikan peringatan keras dan tegas.`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 1000
      })
    });

    if (!groqResponse.ok) {
        const errorData = await groqResponse.text();
        throw new Error(`Groq API Error: ${groqResponse.status} - ${errorData}`);
    }

    const result = await groqResponse.json();
    const rawText = result.choices?.[0]?.message?.content || "{}";
    
    // Hapus blok <think>...</think> bawaan model reasoning
    const cleanText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    try {
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : cleanText;
      const parsed = JSON.parse(jsonStr);
      res.json({ advice: parsed.advice || "Gagal mendapatkan saran dari AI.", predictions: parsed.predictions || [] });
    } catch {
      res.json({ advice: cleanText, predictions: [] });
    }
  } catch (e: any) {
    console.error("AI Error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default aiRouter;
