import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import 'dotenv/config';
import express from 'express';
import mammoth from 'mammoth';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractText } from 'unpdf';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function getGeminiClient(options = {}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error(
      'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in Settings > Secrets.'
    );
    err.status = 500;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    ...options,
    httpOptions: {
      timeout: 38000,
      ...(options.httpOptions || {}),
      headers: {
        'User-Agent': 'aistudio-build',
        ...(options.httpOptions?.headers || {}),
      },
    },
  });
}

function getPersonaInstruction(persona) {
  switch (persona) {
    case 'supportive':
      return 'You are an encouraging yet academically rigorous project coach preparing the student for their upcoming oral defense.';
    case 'rigorous':
      return 'You are a senior external panel examiner who probes architectural trade-offs, edge cases, and justification depth closely.';
    default:
      return 'You are a university/diploma technical examiner conducting a fair, realistic oral defense.';
  }
}

function getFocusInstruction(focus) {
  switch (focus) {
    case 'architecture':
      return 'Prioritize system architecture, data flow, API boundaries, and component design choices.';
    case 'justification':
      return 'Prioritize problem statement validity, tool selection justification, and evaluation of alternatives.';
    case 'implementation':
      return 'Prioritize implementation challenges, error handling, edge cases, and testing methodology.';
    default:
      return 'Balance technical architecture, problem justification, AI/tool integration, and practical challenges.';
  }
}

const modelCooldownUntil = new Map();

function extractRawApiError(error) {
  let rawMessage = error?.message || 'An unexpected server error occurred.';
  let status = typeof error?.status === 'number' && error.status >= 400 ? error.status : 500;
  let retryDelayMs = 0;

  try {
    const parsed = JSON.parse(rawMessage);
    if (parsed?.error?.message) {
      rawMessage = parsed.error.message;
    }
    if (typeof parsed?.error?.code === 'number' && parsed.error.code >= 400) {
      status = parsed.error.code;
    }
    if (Array.isArray(parsed?.error?.details)) {
      const retryInfo = parsed.error.details.find((d) => d?.retryDelay);
      if (typeof retryInfo?.retryDelay === 'string') {
        const match = retryInfo.retryDelay.match(/^(\d+(?:\.\d+)?)s$/i);
        if (match) {
          retryDelayMs = Math.ceil(Number(match[1]) * 1000);
        }
      }
    }
  } catch {
    // keep rawMessage as-is
  }

  return { rawMessage, status, retryDelayMs };
}

function isTimeoutError(error) {
  const msg = (error?.message || '').toLowerCase();
  return (
    error?.name === 'AbortError' ||
    error?.name === 'TimeoutError' ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('aborted')
  );
}

function formatApiError(error) {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return {
      status: 413,
      message: 'Uploaded file exceeds the 20 MB limit. Please upload a smaller file.',
    };
  }
  if (error?.type === 'entity.too.large') {
    return {
      status: 413,
      message: 'Request payload is too large. Try a smaller image or shorter notes.',
    };
  }
  if (isTimeoutError(error)) {
    return {
      status: 504,
      message: 'Gemini AI took too long to respond. Please try again or reduce the number of questions.',
    };
  }

  const { rawMessage, status } = extractRawApiError(error);
  console.error(`[API Error ${status}]`, rawMessage);

  if (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'Gemini API key is invalid or unauthorized. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('RESOURCE_EXHAUSTED') || status === 429) {
    const isDailyLimit =
      rawMessage.toLowerCase().includes('per day') ||
      rawMessage.includes('limit: 20') ||
      rawMessage.includes('limit: 0');
    return {
      status: 429,
      message: isDailyLimit
        ? 'Daily free-tier Gemini API quota reached. Please try again later or select a billing-enabled key in Settings > Secrets.'
        : 'Gemini API rate limit reached. Please wait a few seconds and try again.',
    };
  }
  if (status === 503 || rawMessage.includes('UNAVAILABLE') || rawMessage.toLowerCase().includes('high demand')) {
    return {
      status: 503,
      message: 'Gemini AI is temporarily busy due to high demand. Please wait a few seconds and try again.',
    };
  }
  return { status, message: rawMessage };
}

function isTransientError(error) {
  const { rawMessage, status } = extractRawApiError(error);
  return (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    rawMessage.includes('503') ||
    rawMessage.includes('UNAVAILABLE') ||
    rawMessage.toLowerCase().includes('high demand')
  );
}

function isRateLimitError(error) {
  const { rawMessage, status } = extractRawApiError(error);
  return status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED');
}

async function withRetry(fn, retries = 1, delayMs = 800) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (isTimeoutError(error) || attempt === retries) {
        throw error;
      }

      if (isTransientError(error)) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        continue;
      }

      if (isRateLimitError(error)) {
        const { rawMessage, retryDelayMs } = extractRawApiError(error);
        const isDaily =
          rawMessage.toLowerCase().includes('per day') ||
          rawMessage.includes('limit: 20') ||
          rawMessage.includes('limit: 0');
        if (!isDaily && retryDelayMs > 0 && retryDelayMs <= 8000) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs + 300));
          continue;
        }
      }

      throw error;
    }
  }
  throw lastError;
}

async function generateContentWithFallback(ai, models, params) {
  const now = Date.now();
  const activeModels = models.filter((m) => (modelCooldownUntil.get(m) || 0) <= now);
  const candidates = activeModels.length > 0 ? activeModels : [models[0]];

  let firstTransientError = null;
  let lastError = null;

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    const isLast = i === candidates.length - 1;
    const baseConfig =
      model === 'gemini-4-hydrogen'
        ? {
            ...params.config,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          }
        : params.config;

    try {
      return await withRetry(
        () =>
          ai.models.generateContent({
            model,
            ...params,
            config: {
              ...baseConfig,
              abortSignal: AbortSignal.timeout(35000),
            },
          }),
        i === 0 ? 1 : 0,
        800
      );
    } catch (error) {
      const { status, rawMessage, retryDelayMs } = extractRawApiError(error);
      console.warn(`[Model ${model} failed (${status})]:`, rawMessage);
      if (isRateLimitError(error)) {
        const isDaily =
          rawMessage.toLowerCase().includes('per day') ||
          rawMessage.includes('limit: 20') ||
          rawMessage.includes('limit: 0');
        const cooldownMs = isDaily
          ? 60 * 60_000
          : Math.min(Math.max(retryDelayMs || 60_000, 30_000), 15 * 60_000);
        modelCooldownUntil.set(model, Date.now() + cooldownMs);
      }
      if (!firstTransientError && (isTransientError(error) || isTimeoutError(error))) {
        firstTransientError = error;
      }
      lastError = error;
      const canFallback = isTransientError(error) || isRateLimitError(error) || isTimeoutError(error);
      if (!canFallback || isLast) {
        if (firstTransientError && isRateLimitError(error) && i > 0) {
          throw firstTransientError;
        }
        throw error;
      }
    }
  }
  throw lastError;
}

// Parse .pdf, .docx, .txt, .md lecture slides or proposals
app.post('/api/defense/parse-document', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }

    const lowerName = file.originalname.toLowerCase();
    let extractedText = '';
    let pageCount;

    if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
      extractedText = file.buffer.toString('utf-8').trim();
    } else if (lowerName.endsWith('.pdf')) {
      const pdfData = await extractText(new Uint8Array(file.buffer), { mergePages: true });
      extractedText = (pdfData.text || '').trim();
      pageCount = pdfData.totalPages;
      if (!extractedText) {
        res.status(422).json({
          error: `"${file.originalname}" contains no selectable text (it may be a scanned image PDF). Please paste your notes directly.`,
        });
        return;
      }
    } else if (lowerName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      extractedText = (result.value || '').trim();
    } else if (lowerName.endsWith('.doc')) {
      res.status(400).json({
        error: 'Legacy .doc format is not supported. Please save the file as .docx or .pdf and upload again.',
      });
      return;
    } else {
      res.status(400).json({
        error: 'Unsupported file format. Please upload a .pdf, .docx, .txt, or .md file.',
      });
      return;
    }

    const wordCount = extractedText ? extractedText.split(/\s+/).filter(Boolean).length : 0;

    res.json({
      text: extractedText,
      fileName: file.originalname,
      wordCount,
      pageCount,
    });
  } catch (error) {
    const { status, message } = formatApiError(error);
    res.status(status).json({ error: message });
  }
});

// Generate structured oral defense questions (supports text + optional diagram/slide screenshot)
app.post('/api/defense/generate-questions', async (req, res) => {
  try {
    const {
      context = '',
      diagramImage = null,
      persona = 'standard',
      focus = 'balanced',
      count = 3,
    } = req.body || {};

    const hasText = Boolean(context && context.trim());
    const hasImage = Boolean(diagramImage?.data && diagramImage?.mimeType);

    if (!hasText && !hasImage) {
      res.status(400).json({
        error: 'Please upload a document/diagram, paste your notes, or load a sample project first.',
      });
      return;
    }

    const questionCount = Math.min(Math.max(Number(count) || 3, 1), 6);
    const ai = getGeminiClient();

    const parts = [];
    if (hasImage) {
      parts.push({
        inlineData: {
          mimeType: diagramImage.mimeType,
          data: diagramImage.data,
        },
      });
    }
    parts.push({
      text: hasText
        ? `Student Study Material / Project Context:\n${context.trim().slice(0, 8000)}${
            hasImage
              ? '\n\nAn architecture diagram or presentation slide screenshot is attached above. Directly inspect its visual components, labels, and flows when framing questions.'
              : ''
          }`
        : 'The student uploaded the project diagram or presentation slide screenshot attached above. Inspect all visible labels, components, and data flows to generate grounded oral defense questions.',
    });

    const imageInstruction = hasImage
      ? ' Because a slide/diagram screenshot is attached, ensure at least 1 or 2 questions explicitly probe a specific component, data flow, bottleneck, or design choice visible in the image.'
      : '';

    const response = await generateContentWithFallback(
      ai,
      ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
      {
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: `${getPersonaInstruction(persona)} ${getFocusInstruction(focus)}${imageInstruction}
Generate exactly ${questionCount} distinct, realistic oral defense questions grounded directly in the student's uploaded material.
For each question, include a concise category label (e.g., "System Architecture", "Tool Justification", "Diagram Defense", "Problem Validity", "Edge Cases", "Methodology"), a difficulty level ("Foundational", "Standard", or "Challenging"), and 3 concise expectedKeyPoints that an examiner listens for in a strong spoken answer.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    category: { type: Type.STRING },
                    difficulty: { type: Type.STRING },
                    expectedKeyPoints: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['id', 'question', 'category', 'difficulty', 'expectedKeyPoints'],
                },
              },
            },
            required: ['questions'],
          },
        },
      }
    );

    const parsed = JSON.parse(response.text || '{"questions":[]}');
    const normalized = (parsed.questions || []).map((q, index) => ({
      id: q.id || `q-${index + 1}`,
      question: q.question,
      category: q.category || 'Technical Defense',
      difficulty:
        q.difficulty === 'Foundational' || q.difficulty === 'Challenging'
          ? q.difficulty
          : 'Standard',
      expectedKeyPoints: Array.isArray(q.expectedKeyPoints) ? q.expectedKeyPoints : [],
    }));

    res.json({ questions: normalized });
  } catch (error) {
    const { status, message } = formatApiError(error);
    res.status(status).json({ error: message });
  }
});

// Evaluate spoken/transcribed defense answer with multi-criteria rubric
app.post('/api/defense/evaluate-answer', async (req, res) => {
  try {
    const {
      context = '',
      diagramImage = null,
      question,
      answer,
      persona = 'standard',
      durationSeconds = 0,
    } = req.body || {};

    if (!question?.trim() || !answer?.trim()) {
      res.status(400).json({ error: 'Both the examiner question and your spoken answer transcript are required.' });
      return;
    }

    const ai = getGeminiClient();
    const hasImage = Boolean(diagramImage?.data && diagramImage?.mimeType);

    const parts = [];
    if (hasImage) {
      parts.push({
        inlineData: {
          mimeType: diagramImage.mimeType,
          data: diagramImage.data,
        },
      });
    }
    parts.push({
      text: `Context / Project Notes:\n${context.trim().slice(0, 6000) || '(See attached diagram/slide screenshot)'}\n\nExaminer Question:\n${question.trim()}\n\nStudent Spoken Answer (${durationSeconds}s response):\n${answer.trim()}`,
    });

    const response = await generateContentWithFallback(
      ai,
      ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
      {
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: `${getPersonaInstruction(persona)}
Evaluate the student's oral defense response objectively across four 0-10 rubric dimensions:
1. technicalAccuracy: factual and engineering correctness relative to their material${hasImage ? ' and attached diagram' : ''}.
2. justificationDepth: clarity of "why" decisions were made, trade-offs, and evidence.
3. clarityAndStructure: logical flow suitable for an oral defense.
4. confidenceAndConciseness: directness without rambling or vagueness.
Compute overallScore (0 to 10, rounded to 1 decimal place) and assign verdict as one of: "Distinction", "Proficient", "Developing", or "Needs Revision".
Note that the answer may come from speech-to-text, so focus on conceptual substance rather than minor punctuation.
Also provide:
- strengths: 2-3 specific things the student articulated well.
- areasForImprovement: 2-3 concrete gaps or ways to sharpen the defense.
- missedConcepts: 1-4 specific technical keywords or reasoning steps omitted.
- modelAnswer: a crisp, natural spoken A+ response (3-5 sentences) demonstrating how to answer clearly in a live defense.
- followUpQuestion: 1 realistic follow-up probe an examiner would ask immediately after hearing this exact answer.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallScore: { type: Type.NUMBER },
              verdict: { type: Type.STRING },
              criteria: {
                type: Type.OBJECT,
                properties: {
                  technicalAccuracy: { type: Type.NUMBER },
                  justificationDepth: { type: Type.NUMBER },
                  clarityAndStructure: { type: Type.NUMBER },
                  confidenceAndConciseness: { type: Type.NUMBER },
                },
                required: [
                  'technicalAccuracy',
                  'justificationDepth',
                  'clarityAndStructure',
                  'confidenceAndConciseness',
                ],
              },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING } },
              missedConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
              modelAnswer: { type: Type.STRING },
              followUpQuestion: { type: Type.STRING },
            },
            required: [
              'overallScore',
              'verdict',
              'criteria',
              'strengths',
              'areasForImprovement',
              'missedConcepts',
              'modelAnswer',
              'followUpQuestion',
            ],
          },
        },
      }
    );

    const evaluation = JSON.parse(response.text || '{}');
    res.json({ evaluation });
  } catch (error) {
    const { status, message } = formatApiError(error);
    res.status(status).json({ error: message });
  }
});

// Transcribe recorded audio clip using Gemini 3.5 Transcribe
app.post('/api/defense/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body || {};

    if (!audioBase64) {
      res.status(400).json({ error: 'Audio payload is required for transcription.' });
      return;
    }

    const cleanMimeType = String(mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
    const ai = getGeminiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: cleanMimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe this student oral examination response verbatim into clean English text, preserving technical terms and acronyms accurately.',
            },
          ],
        },
      })
    );

    res.json({ transcript: (response.text || '').trim() });
  } catch (error) {
    const { status, message } = formatApiError(error);
    res.status(status).json({ error: message });
  }
});

const ttsCache = new Map();

// Generate spoken examiner question or model answer audio via Gemini TTS
app.post('/api/defense/speak', async (req, res) => {
  try {
    const { text, role = 'examiner' } = req.body || {};

    if (!text?.trim()) {
      res.status(400).json({ error: 'Text is required for speech synthesis.' });
      return;
    }

    const cleanText = text.trim().slice(0, 1500);
    const voiceName = role === 'examiner' ? 'Charon' : 'Kore';
    const cacheKey = `${voiceName}:${cleanText}`;
    if (ttsCache.has(cacheKey)) {
      res.json({
        audioBase64: ttsCache.get(cacheKey),
        mimeType: 'audio/wav',
      });
      return;
    }

    const ttsAi = getGeminiClient({ apiVersion: 'v1beta' });

    const response = await withRetry(() =>
      ttsAi.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      })
    );

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      res.status(502).json({ error: 'Speech synthesis returned empty audio data.' });
      return;
    }

    if (ttsCache.size >= 25) {
      const oldestKey = ttsCache.keys().next().value;
      if (oldestKey) ttsCache.delete(oldestKey);
    }
    ttsCache.set(cacheKey, base64Audio);

    res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error) {
    const { status, message } = formatApiError(error);
    res.status(status).json({ error: message });
  }
});

app.get('/BeReady_AI_Presentation.pptx', (_req, res) => {
  res.download(
    path.join(__dirname, 'public', 'BeReady_AI_Presentation.pptx'),
    'BeReady_AI_Presentation.pptx'
  );
});

// Ensure unmatched /api/* routes and Express middleware errors always return JSON (never HTML)
app.all('/api/*', (_req, res) => {
  res.status(404).json({
    error: 'API endpoint not found. Please refresh the page so the latest app loads.',
  });
});

app.use('/api', (err, _req, res, _next) => {
  const { status, message } = formatApiError(err);
  res.status(status).json({ error: message });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BeReady AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
