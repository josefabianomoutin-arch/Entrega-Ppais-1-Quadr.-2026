
import { GoogleGenAI, Modality } from "@google/genai";

const showError = (msg: string) => {
  const div = document.createElement('div');
  div.style.position = 'fixed';
  div.style.bottom = '20px';
  div.style.right = '20px';
  div.style.background = '#ef4444';
  div.style.color = 'white';
  div.style.padding = '16px';
  div.style.borderRadius = '8px';
  div.style.zIndex = '9999';
  div.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
  div.innerText = 'Erro de Áudio: ' + msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 8000);
};

function encodeWAV(samples: Uint8Array, sampleRate: number = 24000): string {
  const buffer = new ArrayBuffer(44 + samples.length);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, 1, true); // NumChannels (Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, samples.length, true);

  new Uint8Array(buffer, 44).set(samples);

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

export class SpeechService {
  private ai: GoogleGenAI | null = null;

  private getAI(): GoogleGenAI {
    // Cache bust: 2026-03-12T08:45:10
    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return this.ai;
  }

  async speak(text: string): Promise<void> {
    try {
      console.log("Iniciando TTS para o texto:", text);
      const aiClient = this.getAI();

      const response = await aiClient.models.generateContent({
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

      let base64Audio: string | undefined;
      let mimeType: string | undefined;

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          base64Audio = part.inlineData.data;
          mimeType = part.inlineData.mimeType;
          break;
        }
      }
      
      console.log("Resposta TTS recebida. MimeType:", mimeType);
      
      if (base64Audio) {
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        console.log("Convertendo PCM para arquivo WAV...");
        const wavUrl = encodeWAV(bytes, 24000);
        
        const audio = new Audio(wavUrl);
        
        return new Promise((resolve) => {
          audio.onended = () => {
            console.log("Reprodução concluída.");
            URL.revokeObjectURL(wavUrl);
            resolve();
          };
          audio.onerror = (e) => {
            console.error("Erro no elemento Audio:", e);
            showError("Falha ao reproduzir o áudio WAV gerado.");
            URL.revokeObjectURL(wavUrl);
            resolve();
          };
          
          audio.play().then(() => {
            console.log("Reprodução iniciada com sucesso.");
          }).catch(e => {
            console.error("Erro ao iniciar reprodução:", e);
            showError("O navegador bloqueou o áudio. Tente clicar em outro lugar da tela antes.");
            resolve();
          });
        });
      } else {
        console.warn("Nenhum dado de áudio retornado pelo modelo.");
        showError("A inteligência artificial não retornou o áudio.");
      }
    } catch (error: any) {
      console.error("TTS Error:", error);
      showError(error.message || "Erro desconhecido na API do Google.");
    }
  }
}

export const speechService = new SpeechService();
