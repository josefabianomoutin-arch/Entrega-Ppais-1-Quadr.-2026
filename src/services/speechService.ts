
import { GoogleGenAI, Modality } from "@google/genai";

export class SpeechService {
  private ai: GoogleGenAI;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  private initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  async speak(text: string): Promise<void> {
    try {
      console.log("Iniciando TTS para o texto:", text);
      const ctx = this.initAudioContext();

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const base64Audio = inlineData?.data;
      const mimeType = inlineData?.mimeType;
      
      console.log("Resposta TTS recebida. MimeType:", mimeType);
      
      if (base64Audio) {
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        let audioBuffer: AudioBuffer;

        try {
          // Tenta decodificar como um arquivo de áudio padrão (WAV, MP3, OGG)
          console.log("Tentando decodificar com decodeAudioData...");
          audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
          console.log("Decodificado com sucesso como arquivo padrão.");
        } catch (e) {
          console.log("Falha ao decodificar como arquivo padrão, assumindo PCM raw (16-bit, 24kHz)...", e);
          // Fallback para PCM raw
          const numSamples = bytes.length / 2;
          audioBuffer = ctx.createBuffer(1, numSamples, 24000);
          const channelData = audioBuffer.getChannelData(0);
          const dataView = new DataView(bytes.buffer);

          for (let i = 0; i < numSamples; i++) {
            const sample = dataView.getInt16(i * 2, true);
            channelData[i] = sample < 0 ? sample / 32768 : sample / 32767;
          }
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        
        return new Promise((resolve) => {
          source.onended = () => {
            console.log("Reprodução de áudio concluída.");
            resolve();
          };
          source.start();
          console.log("Reprodução iniciada.");
        });
      } else {
        console.warn("Nenhum dado de áudio retornado pelo modelo.");
      }
    } catch (error) {
      console.error("TTS Error:", error);
    }
  }
}

export const speechService = new SpeechService();
