import { GoogleGenerativeAI } from "@google/generative-ai";

async function run() {
  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyAANSH9nrNR4AOyTZRm_k4MAfzZlVvFrRc";
    const res = await fetch(url);
    const data = await res.json();
    console.log("REST Response:", JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.error("Failed to list models", e.message);
  }
}
run();
