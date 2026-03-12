
import { GoogleGenAI } from "@google/genai";

export class SpeechService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async speak(text: string): Promise<void> {
    try {
      console.log("Iniciando TTS para o texto:", text);
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Kore' is a good female voice
            },
          },
        },
      });

      console.log("Resposta TTS recebida.");
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (base64Audio) {
        console.log("Áudio recebido, decodificando...");
        // Decode base64 to binary string
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        console.log("Tamanho do áudio em bytes:", len);

        // Gemini TTS returns raw PCM data (16-bit, 24kHz, mono)
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const numSamples = bytes.length / 2;
        const audioBuffer = audioContext.createBuffer(1, numSamples, 24000);
        const channelData = audioBuffer.getChannelData(0);
        const dataView = new DataView(bytes.buffer);

        for (let i = 0; i < numSamples; i++) {
          // Read 16-bit signed integer (little-endian)
          const sample = dataView.getInt16(i * 2, true);
          // Convert to float [-1.0, 1.0]
          channelData[i] = sample < 0 ? sample / 32768 : sample / 32767;
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        
        source.onended = () => {
          console.log("Reprodução de áudio concluída.");
        };

        source.start();
        console.log("Reprodução iniciada.");
      } else {
        console.warn("Nenhum dado de áudio retornado pelo modelo.");
      }
    } catch (error) {
      console.error("TTS Error:", error);
    }
  }
}

export const speechService = new SpeechService();
