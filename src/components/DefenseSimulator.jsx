import {
  AlertCircle,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Gauge,
  ImagePlus,
  Lightbulb,
  Loader2,
  Lock,
  Mic,
  Pause,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Square,
  Trash2,
  TrendingUp,
  Upload,
  Volume2,
} from 'lucide-react';
import { motion } from 'motion/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_CONTEXTS } from '../data/sampleTopics.js';
import { RubricRadarChart } from './RubricRadarChart.jsx';

async function fetchApiJson(url, options = {}, timeoutMs = 65000) {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timerId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'same-origin',
      signal: controller.signal,
    });

    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        const looksLikeHtml = /^\s*<!doctype|^\s*<html/i.test(text);
        if (looksLikeHtml || res.redirected) {
          const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
          const htmlTitle = titleMatch ? titleMatch[1].trim() : '';
          const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
          const isAuthRedirect =
            /sign in|google accounts|redirect notice|authorization/i.test(htmlTitle) ||
            res.url.includes('accounts.google.com');
          if (isAuthRedirect) {
            throw new Error(
              `Preview authentication redirected (${htmlTitle || 'Google Sign-In'}, HTTP ${res.status}). If third-party cookies are blocked in this preview iframe, allow cookies for this site or open the Development App link in a new tab.`
            );
          }
          throw new Error(
            `Preview proxy returned an HTML page (${htmlTitle || 'untitled'}, HTTP ${res.status}, ${elapsedSec}s) instead of JSON. Try refreshing the page or opening the preview in a new browser tab.`
          );
        }
        throw new Error(`Unexpected server response (HTTP ${res.status}).`);
      }
    }

    return { res, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        'Request timed out while waiting for Gemini AI. Try again or reduce the number of questions.'
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timerId);
  }
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getPersonaLabel(persona) {
  switch (persona) {
    case 'supportive':
      return 'Supportive expert';
    case 'rigorous':
      return 'Rigorous panel';
    default:
      return 'Standard examiner';
  }
}

function getFocusLabel(focus) {
  switch (focus) {
    case 'architecture':
      return 'System architecture';
    case 'justification':
      return 'Tool justification';
    case 'implementation':
      return 'Edge cases & testing';
    default:
      return 'Balanced defense';
  }
}

function getVerdictStyle(verdict) {
  switch (verdict) {
    case 'Distinction':
      return {
        textClass: 'text-emerald-800',
        bgClass: 'bg-emerald-50',
        borderClass: 'border-emerald-200',
        label: 'Distinction',
      };
    case 'Proficient':
      return {
        textClass: 'text-indigo-800',
        bgClass: 'bg-[#EEF0FF]',
        borderClass: 'border-indigo-200',
        label: 'Proficient',
      };
    case 'Developing':
      return {
        textClass: 'text-amber-800',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        label: 'Developing',
      };
    default:
      return {
        textClass: 'text-rose-800',
        bgClass: 'bg-rose-50',
        borderClass: 'border-rose-200',
        label: 'Needs Revision',
      };
  }
}

const BAR_COUNT = 24;

const SAMPLE_DOT_COLORS = ['bg-[#5B4DF0]', 'bg-[#06B6D4]', 'bg-[#F59E0B]'];

const CLEAR_FRAMEWORK = [
  { letter: 'C', title: 'Claim', desc: 'Lead with your answer.' },
  { letter: 'L', title: 'Logic', desc: 'Explain your reasoning.' },
  { letter: 'E', title: 'Evidence', desc: 'Ground it in your work.' },
  { letter: 'A', title: 'Acknowledge', desc: 'Name a limitation.' },
  { letter: 'R', title: 'Return', desc: 'Connect to your claim.' },
];

const FILLER_PHRASES = [
  'you know',
  'sort of',
  'kind of',
  'i guess',
  'basically',
  'actually',
  'literally',
  'maybe',
  'um',
  'uh',
  'er',
  'ah',
];

function analyzeDelivery(text, durationSeconds) {
  const clean = (text || '').trim();
  const words = clean ? clean.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const wpm =
    durationSeconds >= 5 && wordCount > 0
      ? Math.round((wordCount / durationSeconds) * 60)
      : null;

  let paceStatus = 'Typed / Short Clip';
  let paceTone = 'slate';
  if (wpm !== null) {
    if (wpm < 105) {
      paceStatus = 'Slow · Elaborate Further';
      paceTone = 'amber';
    } else if (wpm <= 155) {
      paceStatus = 'Optimal Oral Pace';
      paceTone = 'emerald';
    } else {
      paceStatus = 'Fast · Slow Down Slightly';
      paceTone = 'rose';
    }
  }

  let remainder = clean.toLowerCase();
  const fillerBreakdown = [];
  let fillerCount = 0;

  FILLER_PHRASES.forEach((phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = remainder.match(regex);
    if (matches && matches.length > 0) {
      fillerCount += matches.length;
      fillerBreakdown.push(`${phrase} ×${matches.length}`);
      remainder = remainder.replace(regex, ' ');
    }
  });

  return {
    wordCount,
    wpm,
    paceStatus,
    paceTone,
    fillerCount,
    fillerBreakdown,
  };
}

export function DefenseSimulator({ sessionResetKey, onNavigateTab }) {
  // Stage 1: Material & Examiner Config
  const [contextText, setContextText] = useState('');
  const [uploadedMeta, setUploadedMeta] = useState(null);
  const [diagramImage, setDiagramImage] = useState(null);
  const [fileStatus, setFileStatus] = useState({ type: 'idle', message: '' });
  const [persona, setPersona] = useState('supportive');
  const [focus, setFocus] = useState('balanced');
  const [questionCount, setQuestionCount] = useState(3);
  const [sessionMode, setSessionMode] = useState('practice');
  const [isSetupExpanded, setIsSetupExpanded] = useState(true);

  // Stage 2: Questions, Pacing & Voice Recording
  const [questions, setQuestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showKeyPoints, setShowKeyPoints] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  const [captureMode, setCaptureMode] = useState('dictation');
  const [pacingTargetSec, setPacingTargetSec] = useState(60);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribingClip, setIsTranscribingClip] = useState(false);
  const [micStatus, setMicStatus] = useState(
    'Press Start Speaking and defend your project clearly.'
  );
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevels, setAudioLevels] = useState(Array(BAR_COUNT).fill(14));

  // Audio TTS state
  const [playingAudioKey, setPlayingAudioKey] = useState(null);
  const [loadingAudioKey, setLoadingAudioKey] = useState(null);
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const ttsWaveTimerRef = useRef(null);
  const lastAutoPlayedRef = useRef('');

  // Stage 3: Evaluation & Session Ledger
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState('');
  const [attemptsByQuestionId, setAttemptsByQuestionId] = useState({});
  const [previousScoreByQuestionId, setPreviousScoreByQuestionId] = useState({});

  // Refs for voice capture, navigation & waveform
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const baseTranscriptRef = useRef('');
  const isRecordingRef = useRef(false);
  const manualStopRef = useRef(false);
  const restartTimeoutRef = useRef(null);
  const dictationCapturedWordsRef = useRef(false);
  const transcriptValueRef = useRef('');
  const recordingSecondsRef = useRef(0);
  const autoSubmitPendingRef = useRef(false);
  const setupRef = useRef(null);
  const chamberRef = useRef(null);
  const verdictRef = useRef(null);
  const readinessRef = useRef(null);
  const transcriptRef = useRef(null);

  useEffect(() => {
    transcriptValueRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    recordingSecondsRef.current = recordingSeconds;
  }, [recordingSeconds]);

  const speechApiSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    if (!speechApiSupported) {
      setCaptureMode('clip');
    }
  }, [speechApiSupported]);

  // Animate acoustic bars gently while Examiner TTS audio plays
  useEffect(() => {
    if (playingAudioKey === 'question') {
      let tick = 0;
      ttsWaveTimerRef.current = window.setInterval(() => {
        tick += 0.45;
        setAudioLevels(
          Array.from({ length: BAR_COUNT }, (_, idx) => {
            const wave = Math.sin(tick + idx * 0.55) * 0.5 + 0.5;
            return Math.round(22 + wave * 64);
          })
        );
      }, 85);
    } else if (!isRecordingRef.current) {
      if (ttsWaveTimerRef.current !== null) {
        window.clearInterval(ttsWaveTimerRef.current);
        ttsWaveTimerRef.current = null;
      }
      setAudioLevels(Array(BAR_COUNT).fill(14));
    }

    return () => {
      if (ttsWaveTimerRef.current !== null) {
        window.clearInterval(ttsWaveTimerRef.current);
        ttsWaveTimerRef.current = null;
      }
    };
  }, [playingAudioKey]);

  const stopAllMediaAndAudio = () => {
    manualStopRef.current = true;
    isRecordingRef.current = false;
    setIsRecording(false);

    if (restartTimeoutRef.current !== null) {
      window.clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop errors
      }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (ttsWaveTimerRef.current !== null) {
      window.clearInterval(ttsWaveTimerRef.current);
      ttsWaveTimerRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setAudioLevels(Array(BAR_COUNT).fill(14));
    setPlayingAudioKey(null);
  };

  useEffect(() => {
    return () => {
      stopAllMediaAndAudio();
    };
  }, []);

  useEffect(() => {
    if (sessionResetKey === 0) return;
    stopAllMediaAndAudio();
    setQuestions([]);
    setActiveIndex(0);
    setTranscript('');
    setDiagramImage(null);
    setAttemptsByQuestionId({});
    setPreviousScoreByQuestionId({});
    setIsSetupExpanded(true);
    setGenError('');
    setEvalError('');
    setRecordingSeconds(0);
    lastAutoPlayedRef.current = '';
    autoSubmitPendingRef.current = false;
    setMicStatus('Press Start Speaking and defend your project clearly.');
  }, [sessionResetKey]);

  const activeQuestion = questions[activeIndex];
  const activeAttempt = activeQuestion ? attemptsByQuestionId[activeQuestion.id] : undefined;
  const previousScore = activeQuestion ? previousScoreByQuestionId[activeQuestion.id] : undefined;

  const currentStage = activeAttempt ? 3 : questions.length > 0 ? 2 : 1;

  const wordCount = useMemo(() => {
    const trimmed = contextText.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [contextText]);

  const spokenWordCount = useMemo(() => {
    const trimmed = transcript.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [transcript]);

  const sessionStats = useMemo(() => {
    const attempts = Object.values(attemptsByQuestionId);
    const totalAnswered = attempts.length;
    const avgScore =
      totalAnswered > 0
        ? attempts.reduce((sum, item) => sum + item.evaluation.overallScore, 0) / totalAnswered
        : 0;
    const totalSeconds = attempts.reduce((sum, item) => sum + item.durationSeconds, 0);
    return {
      totalAnswered,
      avgScore: Number(avgScore.toFixed(1)),
      totalSeconds,
    };
  }, [attemptsByQuestionId]);

  const totalQuestionSlots = questions.length > 0 ? questions.length : questionCount;
  const progressPercent =
    questions.length > 0
      ? Math.round((sessionStats.totalAnswered / questions.length) * 100)
      : 0;

  const pacingPercent = Math.min(100, Math.round((recordingSeconds / pacingTargetSec) * 100));
  const isOverPacing = recordingSeconds > pacingTargetSec;
  const remainingSeconds = Math.max(0, pacingTargetSec - recordingSeconds);
  const liveDelivery = useMemo(
    () => analyzeDelivery(transcript, recordingSeconds),
    [transcript, recordingSeconds]
  );

  const startWaveformMonitor = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        return null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateBars = () => {
        if (!isRecordingRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const bars = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          const val = dataArray[i % dataArray.length] ?? 0;
          bars.push(Math.max(14, Math.min(100, Math.round((val / 255) * 100))));
        }
        setAudioLevels(bars);
        rafRef.current = requestAnimationFrame(updateBars);
      };
      rafRef.current = requestAnimationFrame(updateBars);
      return stream;
    } catch {
      return null;
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileStatus({ type: 'loading', message: `Extracting text from "${file.name}"...` });
    setGenError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { res, data } = await fetchApiJson('/api/defense/parse-document', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse document.');
      }

      setContextText(data.text);
      const pageLabel = data.pageCount ? ` · ${data.pageCount} pages` : '';
      setUploadedMeta(`${data.fileName} · ${data.wordCount.toLocaleString()} words${pageLabel}`);
      setFileStatus({
        type: 'success',
        message: `Extracted ${data.wordCount.toLocaleString()} words from "${data.fileName}".`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to read uploaded file.';
      setFileStatus({ type: 'error', message: msg });
    } finally {
      e.target.value = '';
    }
  };

  const handleDiagramUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setFileStatus({
        type: 'error',
        message:
          'Unsupported image format. Please upload a .png, .jpg, or .webp diagram/slide screenshot.',
      });
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileStatus({
        type: 'error',
        message: 'Diagram screenshot must be under 5 MB.',
      });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const originalDataUrl = String(reader.result || '');
      const originalBase64 = originalDataUrl.split(',')[1] || '';
      if (!originalBase64) return;

      const img = new Image();
      img.onload = () => {
        const maxSide = 1280;
        const needsResize = img.width > maxSide || img.height > maxSide || file.size > 350 * 1024;

        let finalDataUrl = originalDataUrl;
        let finalBase64 = originalBase64;
        let finalMime = file.type;

        if (needsResize) {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            finalDataUrl = canvas.toDataURL('image/jpeg', 0.86);
            finalBase64 = finalDataUrl.split(',')[1] || originalBase64;
            finalMime = 'image/jpeg';
          }
        }

        const sizeKb = Math.max(1, Math.round((finalBase64.length * 3) / 4 / 1024));
        setDiagramImage({
          data: finalBase64,
          mimeType: finalMime,
          name: file.name,
          previewUrl: finalDataUrl,
          sizeLabel: `${sizeKb} KB`,
        });
        setFileStatus({
          type: 'success',
          message: `Attached visual diagram "${file.name}" (${sizeKb} KB) for multimodal examiner critique.`,
        });
        setGenError('');
      };
      img.onerror = () => {
        const sizeKb = Math.max(1, Math.round(file.size / 1024));
        setDiagramImage({
          data: originalBase64,
          mimeType: file.type,
          name: file.name,
          previewUrl: originalDataUrl,
          sizeLabel: `${sizeKb} KB`,
        });
        setGenError('');
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLoadSample = (sampleId) => {
    const found = SAMPLE_CONTEXTS.find((s) => s.id === sampleId);
    if (!found) return;
    setContextText(found.content);
    setUploadedMeta(`${found.title} · Demo Topic`);
    setFileStatus({ type: 'success', message: `Loaded demo context: "${found.label}".` });
    setGenError('');
  };

  const handleGenerateQuestions = async () => {
    if (!contextText.trim() && !diagramImage) {
      setGenError(
        'Upload slides/notes or a diagram image, paste your abstract, or pick a demo topic first.'
      );
      return;
    }

    stopAllMediaAndAudio();
    lastAutoPlayedRef.current = '';
    autoSubmitPendingRef.current = false;
    setIsGenerating(true);
    setGenError('');
    setEvalError('');

    try {
      const { res, data } = await fetchApiJson('/api/defense/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: contextText,
          diagramImage: diagramImage
            ? { data: diagramImage.data, mimeType: diagramImage.mimeType }
            : null,
          persona,
          focus,
          count: questionCount,
        }),
      });

      if (!res.ok || !data.questions?.length) {
        throw new Error(data.error || 'Could not generate defense questions.');
      }

      setQuestions(data.questions);
      setActiveIndex(0);
      setTranscript('');
      setAttemptsByQuestionId({});
      setPreviousScoreByQuestionId({});
      setShowKeyPoints(false);
      setRecordingSeconds(0);
      setIsSetupExpanded(false);
      setTimeout(() => {
        chamberRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to reach question generator.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectQuestion = (index) => {
    if (isRecording) {
      stopRecording();
    }
    setActiveIndex(index);
    setShowKeyPoints(false);
    setEvalError('');
    const target = questions[index];
    const existing = target ? attemptsByQuestionId[target.id] : undefined;
    setTranscript(existing ? existing.transcript : '');
    setRecordingSeconds(existing ? existing.durationSeconds : 0);
  };

  const startRecording = async () => {
    setEvalError('');
    setRecordingSeconds(0);
    manualStopRef.current = false;
    dictationCapturedWordsRef.current = false;
    if (restartTimeoutRef.current !== null) {
      window.clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingAudioKey(null);
    }

    const transcribeAudioBlob = async (blob, mimeType) => {
      if (!blob || blob.size === 0) {
        autoSubmitPendingRef.current = false;
        return;
      }

      setIsTranscribingClip(true);
      setMicStatus('Transcribing spoken response with Gemini 3.5 Transcribe...');
      try {
        const reader = new FileReader();
        const base64 = await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const result = String(reader.result || '');
            const parts = result.split(',');
            resolve(parts[1] || '');
          };
          reader.onerror = () => reject(new Error('Failed to encode audio clip.'));
          reader.readAsDataURL(blob);
        });

        const { res, data } = await fetchApiJson('/api/defense/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64: base64, mimeType }),
        });
        if (!res.ok) {
          throw new Error(data.error || 'Audio transcription failed.');
        }
        if (data.transcript) {
          const combined = transcriptValueRef.current.trim()
            ? `${transcriptValueRef.current.trim()} ${data.transcript}`
            : data.transcript;
          transcriptValueRef.current = combined;
          setTranscript(combined);
          setMicStatus('Audio transcribed. Review your transcript below before evaluating.');
          if (autoSubmitPendingRef.current) {
            autoSubmitPendingRef.current = false;
            handleEvaluateAnswer(combined, recordingSecondsRef.current);
          }
        } else {
          autoSubmitPendingRef.current = false;
          setMicStatus('No speech detected in audio clip. Please check your mic input and try again.');
        }
      } catch (err) {
        autoSubmitPendingRef.current = false;
        setMicStatus(err instanceof Error ? err.message : 'Audio transcription error.');
      } finally {
        setIsTranscribingClip(false);
      }
    };

    try {
      isRecordingRef.current = true;
      const stream = await startWaveformMonitor();
      if (!stream) {
        isRecordingRef.current = false;
        setMicStatus(
          'Microphone permission is blocked or no mic was detected. Allow mic access in your browser bar (or open the Development URL in a new tab).'
        );
        return;
      }

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
      ];
      const supportedMime =
        typeof MediaRecorder !== 'undefined'
          ? preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || ''
          : '';

      if (typeof MediaRecorder !== 'undefined') {
        const recorder = supportedMime
          ? new MediaRecorder(stream, { mimeType: supportedMime })
          : new MediaRecorder(stream);
        const resolvedMime = recorder.mimeType || supportedMime || 'audio/webm';
        audioChunksRef.current = [];

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            audioChunksRef.current.push(ev.data);
          }
        };

        recorder.onstop = async () => {
          const shouldTranscribe =
            captureMode === 'clip' || !dictationCapturedWordsRef.current;
          if (!shouldTranscribe) {
            audioChunksRef.current = [];
            return;
          }
          const blob = new Blob(audioChunksRef.current, { type: resolvedMime });
          audioChunksRef.current = [];
          await transcribeAudioBlob(blob, resolvedMime);
        };

        mediaRecorderRef.current = recorder;
        recorder.start(1000);
      }

      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      if (captureMode === 'dictation' && speechApiSupported) {
        const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
        baseTranscriptRef.current = transcriptValueRef.current.trim()
          ? `${transcriptValueRef.current.trim()} `
          : '';

        const launchRecognitionSession = () => {
          if (!RecognitionCtor || !isRecordingRef.current || manualStopRef.current) return;
          const recognition = new RecognitionCtor();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event) => {
            let sessionFinal = '';
            let sessionInterim = '';
            for (let i = 0; i < event.results.length; i++) {
              const piece = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                sessionFinal += piece;
              } else {
                sessionInterim += piece;
              }
            }
            const spokenNow = `${sessionFinal}${sessionInterim}`.trim();
            if (spokenNow) {
              dictationCapturedWordsRef.current = true;
            }
            const combined = `${baseTranscriptRef.current}${sessionFinal}${sessionInterim}`.trimStart();
            transcriptValueRef.current = combined;
            setTranscript(combined);
          };

          recognition.onerror = (event) => {
            if (
              !manualStopRef.current &&
              (event.error === 'no-speech' ||
                event.error === 'aborted' ||
                event.error === 'network')
            ) {
              return;
            }
            // Keep MediaRecorder running so the user's audio is still captured and transcribed on stop.
            if (!dictationCapturedWordsRef.current) {
              setMicStatus(
                'Live browser dictation unavailable here—capturing audio via Gemini Transcribe until you click Stop.'
              );
            }
          };

          recognition.onend = () => {
            if (isRecordingRef.current && !manualStopRef.current) {
              const snapshot = transcriptValueRef.current.trim();
              baseTranscriptRef.current = snapshot ? `${snapshot} ` : '';
              restartTimeoutRef.current = window.setTimeout(() => {
                launchRecognitionSession();
              }, 140);
            }
          };

          recognitionRef.current = recognition;
          try {
            recognition.start();
          } catch {
            // Backup MediaRecorder remains active even if browser speech recognition refuses to start.
          }
        };

        launchRecognitionSession();
        setMicStatus(
          'Listening live... Speak clearly until you click Stop (auto-transcribes if browser dictation is blocked).'
        );
      } else {
        setMicStatus('Recording audio clip... Click Stop recording to transcribe.');
      }
    } catch (err) {
      setMicStatus(err instanceof Error ? err.message : 'Microphone access failed.');
      stopRecording();
    }
  };

  const stopRecording = () => {
    manualStopRef.current = true;
    isRecordingRef.current = false;
    setIsRecording(false);

    if (restartTimeoutRef.current !== null) {
      window.clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setAudioLevels(Array(BAR_COUNT).fill(14));
    if (captureMode === 'dictation') {
      setMicStatus('Recording stopped. Review or refine technical terms below, then evaluate.');
    }
  };

  const handleToggleSpeechPlayback = async (key, textToSpeak, role) => {
    if (playingAudioKey === key) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingAudioKey(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setLoadingAudioKey(key);
    setPlayingAudioKey(null);

    try {
      const { res, data } = await fetchApiJson('/api/defense/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, role }),
      });
      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || 'Could not synthesize examiner voice.');
      }

      const binary = atob(data.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingAudioKey(null);
      };
      setPlayingAudioKey(key);
      await audio.play();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to play synthesized audio.';
      if (!msg.toLowerCase().includes('notallowed') && !msg.toLowerCase().includes('user didn')) {
        setEvalError(msg);
      }
      setPlayingAudioKey(null);
    } finally {
      setLoadingAudioKey(null);
    }
  };

  // Auto-play examiner voice when stepping onto an unanswered question in Exam Mode
  useEffect(() => {
    if (sessionMode !== 'exam' || !activeQuestion || activeAttempt || isGenerating) {
      return;
    }
    const autoKey = `${activeQuestion.id}-${activeIndex}`;
    if (lastAutoPlayedRef.current === autoKey) return;
    lastAutoPlayedRef.current = autoKey;
    handleToggleSpeechPlayback('question', activeQuestion.question, 'examiner');
  }, [sessionMode, activeQuestion, activeAttempt, activeIndex, isGenerating]);

  const handleEvaluateAnswer = async (overrideAnswer, overrideDuration) => {
    if (!activeQuestion) return;
    const finalAnswer =
      typeof overrideAnswer === 'string' ? overrideAnswer : transcriptValueRef.current;
    const finalDuration =
      typeof overrideDuration === 'number' ? overrideDuration : recordingSecondsRef.current;

    if (!finalAnswer.trim()) {
      setEvalError('Please speak or type your answer before requesting evaluation.');
      return;
    }
    if (isRecordingRef.current) {
      stopRecording();
    }

    setIsEvaluating(true);
    setEvalError('');

    try {
      const { res, data } = await fetchApiJson('/api/defense/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: contextText,
          diagramImage: diagramImage
            ? { data: diagramImage.data, mimeType: diagramImage.mimeType }
            : null,
          question: activeQuestion.question,
          answer: finalAnswer,
          persona,
          durationSeconds: finalDuration,
        }),
      });

      if (!res.ok || !data.evaluation) {
        throw new Error(data.error || 'Evaluation failed.');
      }

      const existingAttempt = attemptsByQuestionId[activeQuestion.id];
      if (existingAttempt) {
        setPreviousScoreByQuestionId((prev) => ({
          ...prev,
          [activeQuestion.id]: existingAttempt.evaluation.overallScore,
        }));
      }

      const delivery = analyzeDelivery(finalAnswer, finalDuration);

      const attempt = {
        questionId: activeQuestion.id,
        questionText: activeQuestion.question,
        category: activeQuestion.category,
        transcript: finalAnswer.trim(),
        durationSeconds: finalDuration,
        delivery,
        evaluation: data.evaluation,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setAttemptsByQuestionId((prev) => ({
        ...prev,
        [activeQuestion.id]: attempt,
      }));
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Unable to evaluate answer.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Enforce automatic countdown cutoff & auto-evaluation in Exam Pressure Mode
  useEffect(() => {
    if (sessionMode !== 'exam' || !isRecording || recordingSeconds < pacingTargetSec) {
      return;
    }
    if (captureMode === 'clip') {
      autoSubmitPendingRef.current = true;
      stopRecording();
      setMicStatus('Time up! Transcribing clip and submitting automatically for Exam Mode...');
    } else {
      stopRecording();
      if (transcriptValueRef.current.trim()) {
        setMicStatus('Time up! Submitting spoken defense automatically for Exam Mode...');
        handleEvaluateAnswer(transcriptValueRef.current, pacingTargetSec);
      } else {
        setEvalError('Exam timer ended before speech was detected. Please try recording again.');
      }
    }
  }, [sessionMode, isRecording, recordingSeconds, pacingTargetSec, captureMode]);

  const handleRetryCurrentQuestion = () => {
    if (!activeQuestion) return;
    setTranscript('');
    setRecordingSeconds(0);
    setEvalError('');
    setMicStatus('Try applying the examiner feedback—press Start Speaking when ready.');
    chamberRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      transcriptRef.current?.focus();
    }, 250);
  };

  const handlePracticeFollowUp = (followUpText) => {
    if (!followUpText.trim()) return;
    const newId = `followup-${questions.length + 1}`;
    const newQuestion = {
      id: newId,
      question: followUpText.trim(),
      category: 'Examiner Follow-Up',
      difficulty: 'Challenging',
      expectedKeyPoints: [
        'Directly address the specific gap or trade-off raised in the follow-up probe.',
        'Reference concrete design constraints or alternative comparisons.',
      ],
    };
    const nextList = [...questions, newQuestion];
    setQuestions(nextList);
    setActiveIndex(nextList.length - 1);
    setTranscript('');
    setRecordingSeconds(0);
    setShowKeyPoints(false);
    setEvalError('');
    chamberRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleExportSessionMarkdown = () => {
    const attempts = Object.values(attemptsByQuestionId);
    if (attempts.length === 0) return;

    const lines = [
      '# BeReady AI — Oral Defense Session Proof',
      `Date: ${new Date().toLocaleDateString()}`,
      `Examiner Persona: ${persona}`,
      `Average Score: ${sessionStats.avgScore} / 10`,
      `Questions Completed: ${sessionStats.totalAnswered} / ${questions.length}`,
      '',
      '---',
      '',
    ];

    attempts.forEach((item, idx) => {
      const paceText = item.delivery?.wpm
        ? `${item.delivery.wpm} WPM (${item.delivery.paceStatus})`
        : 'Typed / <5s';
      const fillerText = item.delivery
        ? `${item.delivery.fillerCount} filler/hedge words`
        : 'N/A';

      lines.push(`## ${idx + 1}. [${item.category}] ${item.questionText}`);
      lines.push(
        `**Spoken Duration:** ${formatDuration(item.durationSeconds)} | **Delivery Pace:** ${paceText} | **Fillers:** ${fillerText} | **Score:** ${item.evaluation.overallScore} / 10 (${item.evaluation.verdict})`
      );
      lines.push('');
      lines.push('### Student Transcript');
      lines.push(item.transcript);
      lines.push('');
      lines.push('### Rubric Breakdown');
      lines.push(`- Technical Accuracy: ${item.evaluation.criteria.technicalAccuracy}/10`);
      lines.push(`- Justification Depth: ${item.evaluation.criteria.justificationDepth}/10`);
      lines.push(`- Clarity & Structure: ${item.evaluation.criteria.clarityAndStructure}/10`);
      lines.push(
        `- Confidence & Conciseness: ${item.evaluation.criteria.confidenceAndConciseness}/10`
      );
      lines.push('');
      lines.push('### Strengths');
      item.evaluation.strengths.forEach((s) => lines.push(`- ${s}`));
      lines.push('');
      lines.push('### Areas for Improvement');
      item.evaluation.areasForImprovement.forEach((a) => lines.push(`- ${a}`));
      lines.push('');
      lines.push('### Model Spoken Answer');
      lines.push(item.evaluation.modelAnswer);
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'beready-ai-session-proof.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Hero Section: Full-Bleed Dark Midnight Dot-Grid Band */}
      <section className="hero-dot-grid pt-12 pb-22 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
            {/* Hero Headline */}
            <div className="lg:col-span-7">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded bg-[#67E8B5] px-2.5 py-1 text-[11px] font-bold tracking-wider text-[#0B3B2B] uppercase">
                  Gemini-Powered
                </span>
                <span className="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
                  Oral Defense Studio
                </span>
              </div>

              <h1 className="mt-5 font-display text-4xl font-bold leading-[1.12] tracking-tight text-white sm:text-5xl text-balance">
                Turn your research into a{' '}
                <span className="block text-[#67E8B5]">confident presentation.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
                Practice the questions that matter. BeReady listens, challenges your ideas, and
                helps you present with clarity under pressure.
              </p>
            </div>

            {/* Hero Right Panel: Live Studio Configuration Preview */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3.5">
                  <span className="text-[11px] font-bold tracking-[0.12em] text-[#67E8B5] uppercase">
                    Active Defense Profile
                  </span>
                  <span className="rounded bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    {sessionMode === 'exam' ? 'Exam Pressure' : 'Practice Mode'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3.5 text-xs">
                  <div className="rounded-xl border border-white/10 bg-[#131037]/60 p-3">
                    <span className="block text-[11px] text-slate-400">Examiner style</span>
                    <span className="mt-1 block truncate font-semibold text-white">
                      {getPersonaLabel(persona)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#131037]/60 p-3">
                    <span className="block text-[11px] text-slate-400">Question focus</span>
                    <span className="mt-1 block truncate font-semibold text-white">
                      {getFocusLabel(focus)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#131037]/60 p-3">
                    <span className="block text-[11px] text-slate-400">Questions ready</span>
                    <span className="mt-1 block font-semibold text-[#67E8B5] tabular-nums">
                      {questions.length > 0
                        ? `${questions.length} Generated`
                        : `${questionCount} Questions`}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#131037]/60 p-3">
                    <span className="block text-[11px] text-slate-400">Multimodal input</span>
                    <span className="mt-1 block truncate font-semibold text-white">
                      {diagramImage
                        ? 'Text + Diagram'
                        : wordCount > 0
                        ? `${wordCount.toLocaleString()} words`
                        : 'Slides / Notes'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-3.5 w-3.5 text-[#67E8B5]" />
                    <span>Voice TTS · Live Mic · 4-Axis Rubric</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">AI Examiner Ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Overlapping White 3-Step Strip */}
      <div className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-indigo-950/5">
          <div className="grid grid-cols-1 divide-y divide-slate-200/70 md:grid-cols-3 md:divide-x md:divide-y-0">
            {[
              {
                step: 1,
                eyebrow: 'PREPARE',
                title: 'Add your material',
              },
              {
                step: 2,
                eyebrow: 'PRACTICE',
                title: 'Enter the chamber',
              },
              {
                step: 3,
                eyebrow: 'IMPROVE',
                title: 'Review your score',
              },
            ].map((item) => {
              const isCurrent = currentStage === item.step;
              const isDone = currentStage > item.step;
              const canJump =
                item.step === 1 ||
                (item.step === 2 && questions.length > 0) ||
                (item.step === 3 && Boolean(activeAttempt));

              return (
                <button
                  key={item.step}
                  type="button"
                  disabled={!canJump}
                  onClick={() => {
                    if (item.step === 1) {
                      setIsSetupExpanded(true);
                      setupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else if (item.step === 2) {
                      chamberRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else if (item.step === 3) {
                      verdictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-4 border-t-[3px] px-6 py-4 text-left transition-colors disabled:cursor-default ${
                    isCurrent
                      ? 'border-t-[#5B4DF0] bg-white'
                      : isDone
                      ? 'border-t-[#67E8B5] bg-white hover:bg-slate-50/70'
                      : 'border-t-transparent bg-white hover:bg-slate-50/60'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${
                      isCurrent
                        ? 'bg-[#5B4DF0] text-white shadow-xs shadow-[#5B4DF0]/30'
                        : isDone
                        ? 'bg-[#67E8B5] text-[#0B3B2B]'
                        : 'bg-[#EEF0FF] text-[#5B4DF0]'
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : item.step}
                  </span>
                  <div className="min-w-0">
                    <span
                      className={`block text-[10px] font-bold tracking-[0.12em] uppercase ${
                        isCurrent ? 'text-[#5B4DF0]' : 'text-slate-400'
                      }`}
                    >
                      {item.eyebrow}
                    </span>
                    <span className="mt-0.5 block truncate font-display text-sm font-bold text-slate-900">
                      {item.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* Left Primary Column */}
          <div className="space-y-6 lg:col-span-8">
            {/* Step 01: Build Your Practice Session */}
            <section
              ref={setupRef}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-indigo-950/5 sm:p-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5B4DF0] text-white shadow-sm shadow-[#5B4DF0]/25">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="block text-[11px] font-bold tracking-[0.12em] text-[#5B4DF0] uppercase">
                      Step 01
                    </span>
                    <h2 className="mt-0.5 font-display text-xl font-bold tracking-tight text-slate-900">
                      Build your practice session
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {uploadedMeta
                        ? uploadedMeta
                        : wordCount > 0
                        ? `${wordCount.toLocaleString()} words ready in context`
                        : 'Give your AI examiner enough context to ask meaningful questions.'}
                    </p>
                  </div>
                </div>

                {questions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsSetupExpanded((v) => !v)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    {isSetupExpanded ? (
                      <>
                        <span>Collapse Setup</span>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Edit Material</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>

              {isSetupExpanded && (
                <div className="mt-6 space-y-6">
                  {/* Upload + Demo Topics Row */}
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#B7B2F8] bg-[#F8F9FF] px-5 py-7 text-center transition-colors hover:border-[#5B4DF0] hover:bg-[#F3F2FF]">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAE8FE] text-[#5B4DF0]">
                        <Upload className="h-5 w-5" />
                      </span>
                      <span className="mt-3.5 font-display text-sm font-bold text-slate-900">
                        Drop your slides here
                      </span>
                      <span className="mt-1 text-xs text-slate-500">
                        PDF, DOCX, TXT or MD • up to 20 MB
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleFileUpload}
                        className="sr-only"
                      />
                    </label>

                    <div className="rounded-xl border border-slate-200/80 bg-[#FBFBFE] p-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] text-slate-500 uppercase">
                        <Sparkles className="h-3.5 w-3.5 text-[#5B4DF0]" />
                        <span>Or try a demo topic</span>
                      </div>

                      <div className="mt-3 space-y-2.5">
                        {SAMPLE_CONTEXTS.map((sample, idx) => (
                          <button
                            key={sample.id}
                            type="button"
                            onClick={() => handleLoadSample(sample.id)}
                            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800 shadow-2xs transition-all hover:border-[#5B4DF0]/45 hover:bg-[#F8F9FF]"
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  SAMPLE_DOT_COLORS[idx % SAMPLE_DOT_COLORS.length]
                                }`}
                              />
                              <span className="truncate">{sample.label}</span>
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Multimodal Architecture Diagram / Slide Screenshot Strip */}
                  <div className="rounded-xl border border-slate-200/80 bg-[#F8F9FF] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAE8FE] text-[#5B4DF0]">
                          <ImagePlus className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            Architecture Diagram or Slide Screenshot (Optional Vision Critique)
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Attach a PNG/JPG/WEBP flowchart or ERD—Gemini inspects visual boxes and
                            asks targeted defense questions.
                          </p>
                        </div>
                      </div>

                      {!diagramImage ? (
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#5B4DF0]/30 bg-white px-3.5 py-2 text-xs font-semibold text-[#5B4DF0] transition-colors hover:bg-[#EEF0FF] whitespace-nowrap shrink-0">
                          <Upload className="h-3.5 w-3.5" />
                          <span>Attach diagram</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleDiagramUpload}
                            className="sr-only"
                          />
                        </label>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDiagramImage(null)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove diagram</span>
                        </button>
                      )}
                    </div>

                    {diagramImage && (
                      <div className="mt-3 flex items-center gap-3 border-t border-slate-200/80 pt-3">
                        <img
                          src={diagramImage.previewUrl}
                          alt={diagramImage.name}
                          className="h-14 w-24 shrink-0 rounded-lg border border-slate-200 bg-white object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {diagramImage.name}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-[#5B4DF0]">
                            {diagramImage.sizeLabel} · Multimodal vision active for questions &amp;
                            grading
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* File / Context Status Alert */}
                  {fileStatus.type !== 'idle' && (
                    <div
                      role="status"
                      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${
                        fileStatus.type === 'error'
                          ? 'border-rose-200 bg-rose-50 text-rose-800'
                          : fileStatus.type === 'success'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-indigo-200 bg-[#EEF0FF] text-[#5B4DF0]'
                      }`}
                    >
                      {fileStatus.type === 'loading' && (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      )}
                      {fileStatus.type === 'success' && (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      )}
                      {fileStatus.type === 'error' && (
                        <AlertCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>{fileStatus.message}</span>
                    </div>
                  )}

                  {/* Project Abstract / Study Notes Input */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        htmlFor="defense-context-input"
                        className="text-sm font-semibold text-slate-900"
                      >
                        Project abstract or study notes
                      </label>
                      <span className="font-mono text-xs text-slate-400 tabular-nums">
                        {wordCount.toLocaleString()} words
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors focus-within:border-[#5B4DF0] focus-within:ring-2 focus-within:ring-[#5B4DF0]/15">
                      <textarea
                        id="defense-context-input"
                        rows={5}
                        value={contextText}
                        onChange={(e) => setContextText(e.target.value)}
                        placeholder="Tell us what you're presenting. Include your main argument, methods, findings, and anything the panel should know..."
                        className="block w-full resize-y border-0 bg-white px-4 pt-3.5 pb-2 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      />
                      <div className="px-3.5 pb-3">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EEF0FF] px-2.5 py-1 text-[11px] font-semibold text-[#5B4DF0]">
                          <Sparkles className="h-3 w-3" />
                          <span>Gemini reads this context</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Examiner Configuration Row */}
                  <div className="grid grid-cols-1 gap-4 border-t border-slate-200/80 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label
                        htmlFor="examiner-persona"
                        className="block text-xs font-semibold text-slate-800"
                      >
                        Examiner style
                      </label>
                      <select
                        id="examiner-persona"
                        value={persona}
                        onChange={(e) => setPersona(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#5B4DF0] focus:outline-none focus:ring-2 focus:ring-[#5B4DF0]/15"
                      >
                        <option value="supportive">Supportive expert</option>
                        <option value="standard">Standard examiner</option>
                        <option value="rigorous">Rigorous panel</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="defense-focus"
                        className="block text-xs font-semibold text-slate-800"
                      >
                        Question focus
                      </label>
                      <select
                        id="defense-focus"
                        value={focus}
                        onChange={(e) => setFocus(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#5B4DF0] focus:outline-none focus:ring-2 focus:ring-[#5B4DF0]/15"
                      >
                        <option value="balanced">Balanced defense</option>
                        <option value="architecture">System architecture</option>
                        <option value="justification">Tool justification</option>
                        <option value="implementation">Edge cases &amp; testing</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="question-count"
                        className="block text-xs font-semibold text-slate-800"
                      >
                        Session length
                      </label>
                      <select
                        id="question-count"
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Number(e.target.value))}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#5B4DF0] focus:outline-none focus:ring-2 focus:ring-[#5B4DF0]/15"
                      >
                        <option value={3}>3 questions · 6 min</option>
                        <option value={5}>5 questions · 10 min</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-slate-800">
                        Simulation mode
                      </span>
                      <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-[#F7F8FC] p-1">
                        <button
                          type="button"
                          onClick={() => setSessionMode('practice')}
                          className={`cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                            sessionMode === 'practice'
                              ? 'bg-white text-[#5B4DF0] shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Practice
                        </button>
                        <button
                          type="button"
                          onClick={() => setSessionMode('exam')}
                          className={`cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                            sessionMode === 'exam'
                              ? 'bg-[#1A1646] text-[#67E8B5] shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Exam Mode
                        </button>
                      </div>
                    </div>
                  </div>

                  {genError && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{genError}</span>
                    </div>
                  )}

                  {/* Footer CTA */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Check className="h-4 w-4 shrink-0 text-[#10B981]" />
                      <span>Questions stay grounded in your uploaded material.</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateQuestions}
                      disabled={isGenerating}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#5B4DF0] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#5B4DF0]/25 transition-colors hover:bg-[#4B3DE0] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none whitespace-nowrap shrink-0"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Preparing session...</span>
                        </>
                      ) : (
                        <>
                          <span>Start practice session</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Step 02: Dark Midnight Defense Chamber */}
            {questions.length > 0 && activeQuestion && (
              <motion.section
                ref={chamberRef}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-indigo-950/5"
              >
                {/* Midnight Indigo Chamber Header */}
                <div className="hero-dot-grid p-6 text-white sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold tracking-[0.12em] text-[#67E8B5] uppercase">
                          Step 02 · Defense Chamber
                        </span>
                        <span className="text-white/30">·</span>
                        <span className="text-xs font-medium text-slate-200">
                          {getPersonaLabel(persona)}
                        </span>
                        <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {sessionMode === 'exam' ? 'Exam Pressure' : 'Practice Mode'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">
                        Question {activeIndex + 1} of {questions.length} · {activeQuestion.category}{' '}
                        · {activeQuestion.difficulty}
                      </p>
                    </div>

                    {/* Question Switcher Pills */}
                    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-[#120F33]/80 p-1">
                      {questions.map((q, idx) => {
                        const attempt = attemptsByQuestionId[q.id];
                        const isCurrent = idx === activeIndex;
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => handleSelectQuestion(idx)}
                            className={`cursor-pointer rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                              isCurrent
                                ? 'bg-[#5B4DF0] text-white shadow-xs'
                                : 'text-slate-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            Q{idx + 1}
                            {attempt ? ` · ${attempt.evaluation.overallScore}` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Spoken Question + Voice Button */}
                  <div className="mt-5 flex flex-col gap-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <p className="font-display text-lg font-semibold leading-snug text-white sm:text-xl">
                        &ldquo;{activeQuestion.question}&rdquo;
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          handleToggleSpeechPlayback(
                            'question',
                            activeQuestion.question,
                            'examiner'
                          )
                        }
                        disabled={loadingAudioKey === 'question'}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#67E8B5] px-4 py-2.5 text-xs font-bold text-[#0B3B2B] shadow-xs transition-colors hover:bg-[#52DFA7] disabled:opacity-60 whitespace-nowrap shrink-0"
                      >
                        {loadingAudioKey === 'question' ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Synthesizing...</span>
                          </>
                        ) : playingAudioKey === 'question' ? (
                          <>
                            <Pause className="h-3.5 w-3.5" />
                            <span>Stop examiner</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3.5 w-3.5" />
                            <span>Listen to question</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* 24-Bar Acoustic Spectrum Strip */}
                    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#120F33]/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-semibold text-white">
                          {isRecording
                            ? 'Microphone live'
                            : playingAudioKey === 'question'
                            ? 'Examiner speaking'
                            : 'Acoustic monitor ready'}
                        </span>
                        <span className="text-white/30">·</span>
                        <span className="font-mono text-[#67E8B5] tabular-nums">
                          {spokenWordCount} words captured
                          {liveDelivery.wpm !== null ? ` · ${liveDelivery.wpm} WPM` : ''}
                        </span>
                      </div>

                      <div aria-hidden="true" className="flex h-8 items-center gap-1">
                        {audioLevels.map((level, idx) => {
                          const liveColors = [
                            'bg-[#67E8B5]',
                            'bg-[#5B4DF0]',
                            'bg-cyan-400',
                            'bg-amber-400',
                          ];
                          const ttsColors = [
                            'bg-[#67E8B5]',
                            'bg-indigo-300',
                            'bg-cyan-300',
                            'bg-[#5B4DF0]',
                          ];
                          return (
                            <span
                              key={idx}
                              className={`w-1.5 rounded-full transition-all duration-75 ${
                                isRecording
                                  ? liveColors[idx % liveColors.length]
                                  : playingAudioKey === 'question'
                                  ? ttsColors[idx % ttsColors.length]
                                  : 'bg-white/25'
                              }`}
                              style={{ height: `${Math.max(18, level)}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Examiner Key Points Hint OR Exam Pressure Lock */}
                    {sessionMode === 'exam' ? (
                      <div className="flex items-center gap-2 text-xs font-medium text-rose-200">
                        <ShieldAlert className="h-4 w-4 shrink-0 text-rose-300" />
                        <span>
                          Exam Pressure Mode: Hints hidden · Examiner voice auto-plays · Transcript
                          locked to microphone until countdown completes
                        </span>
                      </div>
                    ) : (
                      activeQuestion.expectedKeyPoints.length > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setShowKeyPoints((v) => !v)}
                            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-white"
                          >
                            <Lightbulb className="h-3.5 w-3.5 text-[#67E8B5]" />
                            <span>
                              {showKeyPoints
                                ? 'Hide examiner checklist'
                                : 'Peek at what examiner listens for'}
                            </span>
                          </button>

                          {showKeyPoints && (
                            <ul className="mt-2.5 space-y-1.5 border-t border-white/10 pt-3 text-xs text-slate-200">
                              {activeQuestion.expectedKeyPoints.map((pt, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="font-mono text-[#67E8B5]">0{i + 1}.</span>
                                  <span>{pt}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Chamber Controls & Spoken Response */}
                <div className="space-y-5 p-6 sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-[#F7F8FC] p-1">
                      <button
                        type="button"
                        disabled={!speechApiSupported || isRecording}
                        onClick={() => setCaptureMode('dictation')}
                        className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:cursor-not-allowed disabled:opacity-50 ${
                          captureMode === 'dictation'
                            ? 'bg-white text-[#5B4DF0] shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Live dictation
                      </button>
                      <button
                        type="button"
                        disabled={isRecording}
                        onClick={() => setCaptureMode('clip')}
                        className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:cursor-not-allowed disabled:opacity-50 ${
                          captureMode === 'clip'
                            ? 'bg-white text-[#5B4DF0] shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Audio clip (Gemini Transcribe)
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs font-medium text-slate-600">Target pace:</span>
                      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-[#F7F8FC] p-1">
                        {[30, 60, 90].map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setPacingTargetSec(sec)}
                            className={`cursor-pointer rounded-lg px-2.5 py-1 font-mono text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                              pacingTargetSec === sec
                                ? 'bg-white text-[#5B4DF0] shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Mic Control & Live Timer */}
                  <div className="rounded-xl border border-slate-200/80 bg-[#F8F9FF] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        {!isRecording ? (
                          <button
                            type="button"
                            onClick={startRecording}
                            disabled={isTranscribingClip}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#5B4DF0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#5B4DF0]/25 transition-colors hover:bg-[#4B3DE0] disabled:cursor-not-allowed disabled:bg-slate-400 whitespace-nowrap shrink-0"
                          >
                            <Mic className="h-4 w-4" />
                            <span>Start speaking</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#1A1646] px-4 py-2.5 text-sm font-semibold text-[#67E8B5] transition-colors hover:bg-[#272262] whitespace-nowrap shrink-0"
                          >
                            <Square className="h-3.5 w-3.5 fill-current" />
                            <span>Stop recording</span>
                          </button>
                        )}

                        <div className="text-xs text-slate-600">
                          {isTranscribingClip ? (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-[#5B4DF0]">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>{micStatus}</span>
                            </span>
                          ) : (
                            <span>{micStatus}</span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`font-mono text-xs font-bold tabular-nums shrink-0 ${
                          sessionMode === 'exam'
                            ? remainingSeconds <= 10
                              ? 'text-rose-700'
                              : 'text-[#1A1646]'
                            : isOverPacing
                            ? 'text-amber-700'
                            : 'text-[#5B4DF0]'
                        }`}
                      >
                        {sessionMode === 'exam'
                          ? `${formatDuration(remainingSeconds)} left`
                          : `${formatDuration(recordingSeconds)} / ${formatDuration(pacingTargetSec)}`}
                      </span>
                    </div>

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${
                          sessionMode === 'exam'
                            ? 'bg-rose-500'
                            : isOverPacing
                            ? 'bg-amber-500'
                            : 'bg-[#5B4DF0]'
                        }`}
                        style={{ width: `${pacingPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Spoken Transcript */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label
                        htmlFor="defense-transcript"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900"
                      >
                        {sessionMode === 'exam' && <Lock className="h-3.5 w-3.5 text-rose-600" />}
                        <span>
                          {sessionMode === 'exam'
                            ? 'Your spoken defense transcript (locked in Exam Mode)'
                            : 'Your spoken defense transcript'}
                        </span>
                      </label>
                      {transcript && sessionMode === 'practice' && (
                        <button
                          type="button"
                          onClick={() => {
                            setTranscript('');
                            setRecordingSeconds(0);
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Clear</span>
                        </button>
                      )}
                    </div>
                    <textarea
                      ref={transcriptRef}
                      id="defense-transcript"
                      rows={5}
                      value={transcript}
                      readOnly={sessionMode === 'exam'}
                      onChange={(e) => {
                        if (sessionMode === 'practice') {
                          setTranscript(e.target.value);
                        }
                      }}
                      placeholder={
                        sessionMode === 'exam'
                          ? 'Exam Mode active: press Start speaking above. Typing is disabled.'
                          : 'Speak into your microphone above, or type/refine key technical terms here...'
                      }
                      className={`w-full rounded-xl border px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                        sessionMode === 'exam'
                          ? 'border-rose-200 bg-rose-50/30 focus:border-rose-400 focus:ring-rose-500/15'
                          : 'border-slate-200 bg-white focus:border-[#5B4DF0] focus:ring-[#5B4DF0]/15'
                      }`}
                    />
                  </div>

                  {evalError && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{evalError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => handleEvaluateAnswer()}
                      disabled={isEvaluating || isTranscribingClip}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#5B4DF0] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#5B4DF0]/25 transition-colors hover:bg-[#4B3DE0] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none whitespace-nowrap shrink-0"
                    >
                      {isEvaluating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Grading response...</span>
                        </>
                      ) : (
                        <>
                          <Award className="h-4 w-4" />
                          <span>Evaluate my answer</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.section>
            )}

            {/* Step 03: Examiner Rubric Evaluation */}
            {activeAttempt && (
              <motion.section
                ref={verdictRef}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-indigo-950/5 sm:p-7"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 pb-5">
                  <div>
                    <span className="block text-[11px] font-bold tracking-[0.12em] text-[#5B4DF0] uppercase">
                      Step 03 · Rubric Verdict
                    </span>
                    <h2 className="mt-0.5 font-display text-xl font-bold text-slate-900">
                      Examiner rubric evaluation
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Evaluated at {activeAttempt.timestamp} · Spoken response duration{' '}
                      {formatDuration(activeAttempt.durationSeconds)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-right">
                      <span className="block text-xs text-slate-500">Overall score</span>
                      <div className="flex items-baseline justify-end gap-2">
                        <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                          {activeAttempt.evaluation.overallScore.toFixed(1)}{' '}
                          <span className="text-sm font-normal text-slate-400">/ 10</span>
                        </span>
                        {typeof previousScore === 'number' && (
                          <span
                            className={`inline-flex items-center gap-0.5 font-mono text-xs font-bold tabular-nums ${
                              activeAttempt.evaluation.overallScore >= previousScore
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            <TrendingUp className="h-3 w-3" />
                            <span>
                              {activeAttempt.evaluation.overallScore - previousScore >= 0
                                ? '+'
                                : ''}
                              {(activeAttempt.evaluation.overallScore - previousScore).toFixed(1)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const style = getVerdictStyle(activeAttempt.evaluation.verdict);
                      return (
                        <div
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${style.bgClass} ${style.borderClass} ${style.textClass}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{style.label}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Radar Geometry + 4-Axis Progress Bars */}
                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-12 md:items-center">
                  <div className="md:col-span-5">
                    <RubricRadarChart criteria={activeAttempt.evaluation.criteria} />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:col-span-7">
                    {[
                      {
                        label: 'Technical Accuracy',
                        score: activeAttempt.evaluation.criteria.technicalAccuracy,
                        barClass: 'bg-[#5B4DF0]',
                        scoreClass: 'text-[#5B4DF0]',
                      },
                      {
                        label: 'Justification & Trade-Offs',
                        score: activeAttempt.evaluation.criteria.justificationDepth,
                        barClass: 'bg-[#0D9488]',
                        scoreClass: 'text-[#0D9488]',
                      },
                      {
                        label: 'Clarity & Oral Structure',
                        score: activeAttempt.evaluation.criteria.clarityAndStructure,
                        barClass: 'bg-[#0284C7]',
                        scoreClass: 'text-[#0284C7]',
                      },
                      {
                        label: 'Confidence & Conciseness',
                        score: activeAttempt.evaluation.criteria.confidenceAndConciseness,
                        barClass: 'bg-[#D97706]',
                        scoreClass: 'text-[#D97706]',
                      },
                    ].map((axis) => (
                      <div
                        key={axis.label}
                        className="rounded-xl border border-slate-200/80 bg-[#F8F9FF] p-3.5"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                          <span>{axis.label}</span>
                          <span className={`font-mono font-bold tabular-nums ${axis.scoreClass}`}>
                            {axis.score.toFixed(1)} / 10
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${axis.barClass}`}
                            style={{
                              width: `${Math.min(100, Math.max(0, axis.score * 10))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Speech Delivery Coach */}
                {activeAttempt.delivery && (
                  <div className="mt-5 rounded-xl border border-slate-200/80 bg-[#F7F8FC] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-[#5B4DF0]" />
                        <h3 className="text-xs font-bold text-slate-900">
                          Speech delivery coach
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500">
                        Target academic pace: 105–155 WPM
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-4 divide-y divide-slate-200/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                      <div className="pt-2 sm:pt-0">
                        <span className="block text-xs text-slate-500">Speaking rate</span>
                        <span className="mt-0.5 block font-mono text-base font-bold text-slate-900 tabular-nums">
                          {activeAttempt.delivery.wpm !== null
                            ? `${activeAttempt.delivery.wpm} WPM`
                            : '—'}
                        </span>
                        <span
                          className={`mt-0.5 block text-xs font-semibold ${
                            activeAttempt.delivery.paceTone === 'emerald'
                              ? 'text-emerald-700'
                              : activeAttempt.delivery.paceTone === 'rose'
                              ? 'text-rose-700'
                              : activeAttempt.delivery.paceTone === 'amber'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {activeAttempt.delivery.paceStatus}
                        </span>
                      </div>

                      <div className="pt-2 sm:pl-4 sm:pt-0">
                        <span className="block text-xs text-slate-500">Response length</span>
                        <span className="mt-0.5 block font-mono text-base font-bold text-slate-900 tabular-nums">
                          {activeAttempt.delivery.wordCount} words
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Duration {formatDuration(activeAttempt.durationSeconds)}
                        </span>
                      </div>

                      <div className="pt-2 sm:pl-4 sm:pt-0">
                        <span className="block text-xs text-slate-500">Filler &amp; hedge words</span>
                        <span
                          className={`mt-0.5 block font-mono text-base font-bold tabular-nums ${
                            activeAttempt.delivery.fillerCount === 0
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {activeAttempt.delivery.fillerCount} detected
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {activeAttempt.delivery.fillerBreakdown.length > 0
                            ? activeAttempt.delivery.fillerBreakdown.join(' · ')
                            : 'Clean technical phrasing'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Strengths & Areas for Improvement */}
                <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200/80 pt-5 md:grid-cols-2">
                  <div className="rounded-xl border border-[#BEEAD3] bg-[#EFFBF5] p-4">
                    <h3 className="text-sm font-bold text-emerald-950">Strengths</h3>
                    <ul className="mt-2.5 space-y-2 text-sm text-slate-800">
                      {activeAttempt.evaluation.strengths.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-[#FCE2B4] bg-[#FFF9EE] p-4">
                    <h3 className="text-sm font-bold text-amber-950">Areas for improvement</h3>
                    <ul className="mt-2.5 space-y-2 text-sm text-slate-800">
                      {activeAttempt.evaluation.areasForImprovement.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Missed Concepts */}
                {activeAttempt.evaluation.missedConcepts.length > 0 && (
                  <div className="mt-5 border-t border-slate-200/80 pt-4">
                    <span className="text-xs font-bold text-rose-700">
                      Key terms &amp; concepts to mention:{' '}
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {activeAttempt.evaluation.missedConcepts.join(' · ')}
                    </span>
                  </div>
                )}

                {/* A+ Model Spoken Answer */}
                <div className="mt-5 rounded-xl border border-[#CBE4FA] bg-[#F2F8FE] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">A+ Model spoken answer</h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRetryCurrentQuestion}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-[#5B4DF0]" />
                        <span>Re-record to beat score</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleSpeechPlayback(
                            'model',
                            activeAttempt.evaluation.modelAnswer,
                            'model'
                          )
                        }
                        disabled={loadingAudioKey === 'model'}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#5B4DF0] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#4B3DE0] whitespace-nowrap shrink-0"
                      >
                        {loadingAudioKey === 'model' ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Synthesizing...</span>
                          </>
                        ) : playingAudioKey === 'model' ? (
                          <>
                            <Pause className="h-3.5 w-3.5" />
                            <span>Stop voice</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3.5 w-3.5" />
                            <span>Hear model answer</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-800">
                    {activeAttempt.evaluation.modelAnswer}
                  </p>
                </div>

                {/* Dynamic Follow-Up Probe */}
                {activeAttempt.evaluation.followUpQuestion && (
                  <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#5B4DF0]/25 bg-[#F8F9FF] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-bold tracking-wider text-[#5B4DF0] uppercase">
                        Next examiner follow-up probe
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {activeAttempt.evaluation.followUpQuestion}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handlePracticeFollowUp(activeAttempt.evaluation.followUpQuestion)
                      }
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#1A1646] px-4 py-2.5 text-xs font-semibold text-[#67E8B5] transition-colors hover:bg-[#272262] whitespace-nowrap shrink-0"
                    >
                      <span>Practice follow-up</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </motion.section>
            )}
          </div>

          {/* Right Sidebar: Session Readiness & C.L.E.A.R. Tip */}
          <aside ref={readinessRef} className="space-y-6 lg:col-span-4">
            {/* Live Overview / Session Readiness Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-indigo-950/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="block text-[11px] font-bold tracking-[0.12em] text-[#5B4DF0] uppercase">
                    Live Overview
                  </span>
                  <h2 className="mt-0.5 font-display text-lg font-bold text-slate-900">
                    Session readiness
                  </h2>
                </div>
                <span
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                    questions.length === 0
                      ? 'bg-slate-100 text-slate-500'
                      : sessionStats.totalAnswered === questions.length
                      ? 'bg-[#EFFBF5] text-emerald-700'
                      : 'bg-[#EEF0FF] text-[#5B4DF0]'
                  }`}
                >
                  {questions.length === 0
                    ? 'Not started'
                    : sessionStats.totalAnswered === questions.length
                    ? 'Completed'
                    : 'In progress'}
                </span>
              </div>

              {/* 3 Compact KPI Tiles */}
              <div className="mt-5 grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-slate-200/70 bg-[#FBFBFE] p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EDE9FE] text-[#5B4DF0]">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-[10px] font-medium text-slate-500">
                        Avg. score
                      </span>
                      <span className="block font-display text-sm font-bold text-slate-900 tabular-nums">
                        {sessionStats.totalAnswered > 0 ? sessionStats.avgScore.toFixed(1) : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/70 bg-[#FBFBFE] p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E0F7FA] text-[#0891B2]">
                      <Mic className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-[10px] font-medium text-slate-500">
                        Answered
                      </span>
                      <span className="block font-display text-sm font-bold text-slate-900 tabular-nums">
                        {sessionStats.totalAnswered} / {totalQuestionSlots}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/70 bg-[#FBFBFE] p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7] text-[#D97706]">
                      <Clock className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-[10px] font-medium text-slate-500">
                        Speaking
                      </span>
                      <span className="block font-display text-sm font-bold text-slate-900 tabular-nums">
                        {formatDuration(sessionStats.totalSeconds)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Question Progress Bar */}
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Question progress</span>
                  <span className="font-mono font-bold text-[#5B4DF0] tabular-nums">
                    {progressPercent}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
                  <div
                    className="h-full rounded-full bg-[#5B4DF0] transition-all duration-300"
                    style={{ width: `${Math.max(progressPercent, questions.length === 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>

              {/* Quiet Practice Room Empty State vs Live Progress */}
              {questions.length === 0 ? (
                <div className="mt-5 rounded-xl bg-[#F7F8FC] px-4 py-8 text-center">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#5B4DF0] shadow-sm shadow-indigo-950/5">
                    <Mic className="h-5 w-5" />
                  </span>
                  <p className="mt-3.5 font-display text-sm font-bold text-slate-900">
                    Your practice room is quiet
                  </p>
                  <p className="mx-auto mt-1 max-w-[230px] text-xs leading-relaxed text-slate-500">
                    Start a session to see your confidence and clarity improve in real time.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {/* Score Trajectory Mini Chart */}
                  <div className="rounded-xl border border-slate-200/80 bg-[#F8F9FF] p-3">
                    <div className="mb-2 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700">Score trajectory</span>
                      <span className="font-mono font-semibold text-[#5B4DF0]">Target 8.0+</span>
                    </div>
                    <div className="flex h-16 items-end gap-2">
                      {questions.map((q, idx) => {
                        const attempt = attemptsByQuestionId[q.id];
                        const score = attempt ? attempt.evaluation.overallScore : 0;
                        const heightPct = attempt ? Math.max(14, Math.round(score * 10)) : 10;
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => handleSelectQuestion(idx)}
                            className="flex flex-1 cursor-pointer flex-col items-center gap-1"
                            title={`Q${idx + 1}: ${attempt ? `${score.toFixed(1)}/10` : 'Pending'}`}
                          >
                            <div className="flex h-10 w-full items-end justify-center">
                              <div
                                className={`w-full max-w-[26px] rounded-t transition-all duration-300 ${
                                  attempt
                                    ? score >= 8
                                      ? 'bg-[#10B981]'
                                      : score >= 6
                                      ? 'bg-[#5B4DF0]'
                                      : 'bg-amber-500'
                                    : 'bg-slate-200'
                                }`}
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] font-medium text-slate-500">
                              Q{idx + 1}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clickable Question Rows */}
                  <ul className="divide-y divide-slate-200/80">
                    {questions.map((q, idx) => {
                      const attempt = attemptsByQuestionId[q.id];
                      const isCurrent = idx === activeIndex;
                      return (
                        <li key={q.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectQuestion(idx)}
                            className={`flex w-full cursor-pointer items-start justify-between gap-3 py-2.5 text-left transition-colors ${
                              isCurrent
                                ? 'text-[#5B4DF0]'
                                : 'text-slate-700 hover:text-slate-900'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="block text-xs font-semibold">
                                Q{idx + 1} · {q.category}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-slate-500">
                                {q.question}
                              </span>
                            </div>
                            <span
                              className={`font-mono text-xs font-semibold tabular-nums shrink-0 ${
                                attempt ? 'text-emerald-700' : 'text-slate-400'
                              }`}
                            >
                              {attempt ? `${attempt.evaluation.overallScore.toFixed(1)}/10` : 'Pending'}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Export Session Report Button */}
              <div className="mt-5">
                <button
                  type="button"
                  disabled={sessionStats.totalAnswered === 0}
                  onClick={handleExportSessionMarkdown}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-[#5B4DF0]/40 hover:bg-[#F8F9FF] hover:text-[#5B4DF0] disabled:cursor-not-allowed disabled:bg-slate-50/70 disabled:text-slate-400 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export practice summary</span>
                </button>
              </div>
            </div>

            {/* Dark Indigo AI Coach Tip: Answer with C.L.E.A.R. */}
            <div className="relative overflow-hidden rounded-2xl bg-[#1A1646] p-6 text-white shadow-md shadow-indigo-950/10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/[0.06]"
              />

              <div className="relative flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5B4DF0] text-white">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <span className="block text-[10px] font-bold tracking-[0.14em] text-[#67E8B5] uppercase">
                    AI Coach Tip
                  </span>
                  <h2 className="font-display text-lg font-bold text-white">
                    Answer with C.L.E.A.R.
                  </h2>
                </div>
              </div>

              <div className="relative mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
                {CLEAR_FRAMEWORK.map((item) => (
                  <div key={item.letter} className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 font-display text-xs font-bold text-[#67E8B5]">
                      {item.letter}
                    </span>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-white">{item.title}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-slate-300">
                        {item.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Bottom White Section: Practice Every Part of the Conversation */}
      <section className="border-t border-slate-200/80 bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="block text-[11px] font-bold tracking-[0.14em] text-[#5B4DF0] uppercase">
                Designed for real panel pressure
              </span>
              <h2 className="mt-2 max-w-lg font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl text-balance">
                Practice every part of the conversation.
              </h2>
            </div>

            <p className="max-w-sm text-sm leading-relaxed text-slate-500">
              Not just what you say — how clearly, confidently, and concisely you say it.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Card 01: Listen */}
            <div className="rounded-2xl border border-[#CBE4FA] bg-[#F2F8FE] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D8ECFC] text-[#0284C7]">
                <Mic className="h-5 w-5" />
              </span>
              <span className="mt-5 block text-[11px] font-bold tracking-[0.12em] text-[#0284C7] uppercase">
                01 · Listen
              </span>
              <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
                Hear the examiner
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Natural spoken questions help you practice reacting by ear, not reading from a
                screen.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (questions.length > 0) {
                    chamberRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    setIsSetupExpanded(true);
                    setupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="mt-5 inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-[#0284C7] transition-colors hover:text-[#0369A1]"
              >
                <span>Explore voice practice</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Card 02: Deliver */}
            <div className="rounded-2xl border border-[#FCE2B4] bg-[#FFF9EE] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDE8C8] text-[#C27803]">
                <Clock className="h-5 w-5" />
              </span>
              <span className="mt-5 block text-[11px] font-bold tracking-[0.12em] text-[#C27803] uppercase">
                02 · Deliver
              </span>
              <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
                Beat the pacing clock
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Live timing and pacing cues help your answers stay focused without feeling rushed.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (questions.length > 0) {
                    chamberRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    readinessRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="mt-5 inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-[#B45309] transition-colors hover:text-[#92400E]"
              >
                <span>See speaking metrics</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Card 03: Improve */}
            <div className="rounded-2xl border border-[#BEEAD3] bg-[#EFFBF5] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D1F5E3] text-[#0D9488]">
                <FileText className="h-5 w-5" />
              </span>
              <span className="mt-5 block text-[11px] font-bold tracking-[0.12em] text-[#0D9488] uppercase">
                03 · Improve
              </span>
              <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
                Get specific feedback
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Review rubric scores, missed concepts, and an AI model answer after every response.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (activeAttempt) {
                    verdictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else if (onNavigateTab) {
                    onNavigateTab('how-it-works');
                  }
                }}
                className="mt-5 inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-[#047857] transition-colors hover:text-[#065F46]"
              >
                <span>See how it works</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
