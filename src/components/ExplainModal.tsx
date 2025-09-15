import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Loader2, Volume2, VolumeX, Play, Pause, Download, RefreshCw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api';

// Declare Puter global interface
declare global {
  interface Window {
    puter: {
      ai: {
        txt2speech: (text: string, options?: any) => Promise<HTMLAudioElement>;
      };
    };
  }
}

interface ExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'object' | 'text';
  objectId?: number;
  text?: string;
  title?: string;
}

export function ExplainModal({ isOpen, onClose, type, objectId, text, title }: ExplainModalProps) {
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // TTS states
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsError, setTtsError] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState([0.8]);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Joanna');
  const [selectedEngine, setSelectedEngine] = useState('neural');
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [webVoices, setWebVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [useWebSpeech, setUseWebSpeech] = useState(false);
  const [puterLoaded, setPuterLoaded] = useState(false);
  
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Puter.js TTS voices and engines
  const PUTER_VOICES = [
    'Joanna', 'Matthew', 'Amy', 'Brian', 'Emma', 'Aditi', 'Raveena', 'Ivy', 'Kendra', 'Kimberly', 'Salli', 'Joey', 'Justin', 'Kevin'
  ];

  const PUTER_ENGINES = [
    { id: 'standard', name: 'Standard', description: 'Good quality speech synthesis' },
    { id: 'neural', name: 'Neural', description: 'Higher quality, more natural-sounding' },
    { id: 'generative', name: 'Generative', description: 'Most human-like speech using AI' }
  ];

  const PUTER_LANGUAGES = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'it-IT', name: 'Italian' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'ko-KR', name: 'Korean' },
    { code: 'zh-CN', name: 'Chinese (Mandarin)' }
  ];

  // Load Puter.js script and Web Speech API voices
  useEffect(() => {
    // Load Puter.js if not already loaded
    if (!window.puter && !document.querySelector('script[src*="js.puter.com"]')) {
      const script = document.createElement('script');
      script.src = 'https://js.puter.com/v2/';
      script.onload = () => setPuterLoaded(true);
      script.onerror = () => {
        console.error('Failed to load Puter.js');
        setTtsError('Failed to load Puter.js library');
      };
      document.head.appendChild(script);
    } else if (window.puter) {
      setPuterLoaded(true);
    }

    // Load Web Speech API voices as fallback
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
        setWebVoices(englishVoices);
      };
      
      loadVoices();
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Format time for display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const fetchExplanation = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError('');
    setExplanation('');
    setAudioElement(null);
    setTtsError('');

    try {
      let result;
      if (type === 'object' && objectId) {
        result = await apiClient.explainObject(objectId);
      } else if (type === 'text' && text) {
        result = await apiClient.explainText(text);
      } else {
        throw new Error('Invalid explanation request');
      }

      const explanationText = result.note || result.explanation;
      if (explanationText) {
        setExplanation(explanationText);
      } else {
        setExplanation('No explanation could be generated for this item.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get explanation');
    } finally {
      setIsLoading(false);
    }
  };

  const generatePuterTTS = async (text: string): Promise<HTMLAudioElement> => {
    if (!window.puter || !puterLoaded) {
      throw new Error('Puter.js is not loaded. Please wait and try again.');
    }

    // Truncate text if too long to avoid issues
    const truncatedText = text.length > 3000 ? text.substring(0, 3000) + '...' : text;
    
    try {
      const audio = await window.puter.ai.txt2speech(truncatedText, {
        voice: selectedVoice,
        engine: selectedEngine,
        language: selectedLanguage
      });

      return audio;
    } catch (err) {
      console.error('Puter TTS error:', err);
      throw new Error('Puter TTS service failed. Please try again.');
    }
  };

  const generateWebSpeechTTS = async (text: string, voiceName: string): Promise<void> => {
    if (!('speechSynthesis' in window)) {
      throw new Error('Web Speech API not supported in this browser');
    }

    // Stop any ongoing speech
    speechSynthesis.cancel();

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Find the selected voice
      let selectedVoiceObj = webVoices.find(v => v.name === voiceName);
      if (!selectedVoiceObj && webVoices.length > 0) {
        selectedVoiceObj = webVoices[0]; // Fallback to first available voice
      }
      
      if (selectedVoiceObj) {
        utterance.voice = selectedVoiceObj;
      }
      
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = isMuted ? 0 : volume[0];
      
      utterance.onstart = () => {
        setIsPlaying(true);
      };
      
      utterance.onend = () => {
        setIsPlaying(false);
        resolve();
      };
      
      utterance.onerror = (event) => {
        setIsPlaying(false);
        reject(new Error(`Speech synthesis failed: ${event.error}`));
      };
      
      speechRef.current = utterance;
      
      try {
        speechSynthesis.speak(utterance);
      } catch (err) {
        reject(new Error('Failed to start speech synthesis'));
      }
    });
  };

  const generateTTS = async (text: string) => {
    setIsGeneratingTTS(true);
    setTtsError('');
    setAudioElement(null);
    
    try {
      if (useWebSpeech || webVoices.some(v => v.name === selectedVoice)) {
        // Use Web Speech API
        await generateWebSpeechTTS(text, selectedVoice);
        setUseWebSpeech(true);
      } else {
        // Use Puter.js TTS
        const audio = await generatePuterTTS(text);
        setAudioElement(audio);
        setUseWebSpeech(false);
        
        // Set up audio event listeners
        audio.volume = isMuted ? 0 : volume[0];
        
        audio.addEventListener('loadedmetadata', () => {
          setDuration(audio.duration || 0);
        });
        
        audio.addEventListener('timeupdate', () => {
          setCurrentTime(audio.currentTime || 0);
        });
        
        audio.addEventListener('play', () => {
          setIsPlaying(true);
        });
        
        audio.addEventListener('pause', () => {
          setIsPlaying(false);
        });
        
        audio.addEventListener('ended', () => {
          setIsPlaying(false);
          setCurrentTime(0);
        });
        
        audio.addEventListener('error', () => {
          setIsPlaying(false);
          setTtsError('Audio playback failed. Please try regenerating the audio.');
        });
      }
      
    } catch (err) {
      console.error('TTS generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate TTS audio';
      
      // Try fallback to Web Speech API if Puter fails
      if (!useWebSpeech && !webVoices.some(v => v.name === selectedVoice) && 'speechSynthesis' in window && webVoices.length > 0) {
        try {
          setTtsError('Puter TTS failed, trying browser speech...');
          await generateWebSpeechTTS(text, webVoices[0].name);
          setSelectedVoice(webVoices[0].name);
          setUseWebSpeech(true);
          setTtsError('');
        } catch (fallbackErr) {
          setTtsError('All TTS services failed. Please try again later.');
        }
      } else {
        setTtsError(errorMessage);
      }
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const retryTTS = () => {
    if (explanation) {
      generateTTS(explanation);
    }
  };

  const togglePlayback = () => {
    if (useWebSpeech) {
      if (isPlaying) {
        speechSynthesis.pause();
        setIsPlaying(false);
      } else if (speechSynthesis.paused) {
        speechSynthesis.resume();
        setIsPlaying(true);
      } else {
        generateTTS(explanation);
      }
      return;
    }

    if (!audioElement) {
      if (explanation) {
        generateTTS(explanation);
      }
      return;
    }

    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play().catch((err) => {
        console.error('Playback failed:', err);
        setTtsError('Failed to play audio. Please try again.');
        setIsPlaying(false);
      });
    }
  };

  const stopPlayback = () => {
    if (useWebSpeech) {
      speechSynthesis.cancel();
      setIsPlaying(false);
    } else if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }
  };

  const handleSeek = (value: number[]) => {
    if (useWebSpeech || !audioElement) return;
    const newTime = (value[0] / 100) * duration;
    audioElement.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value);
    if (audioElement && !useWebSpeech) {
      audioElement.volume = value[0];
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (audioElement && !useWebSpeech) {
        audioElement.volume = volume[0];
      }
    } else {
      setIsMuted(true);
      if (audioElement && !useWebSpeech) {
        audioElement.volume = 0;
      }
    }
  };

  const handleVoiceChange = (voice: string) => {
    setSelectedVoice(voice);
    
    // Reset audio state when changing voices
    setAudioElement(null);
    setTtsError('');
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    
    // Stop any current playback
    if (audioElement) {
      audioElement.pause();
    }
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    
    // Determine if this is a web speech voice
    const isWebVoice = webVoices.some(v => v.name === voice);
    setUseWebSpeech(isWebVoice);
  };

  const getAvailableVoices = () => {
    const puterVoices = PUTER_VOICES.map(voice => ({
      id: voice,
      name: `${voice} (Puter)`,
      type: 'puter'
    }));
    
    const webSpeechVoices = webVoices.map(voice => ({
      id: voice.name,
      name: `${voice.name} (Browser)`,
      type: 'webspeech'
    }));
    
    return [...puterVoices, ...webSpeechVoices];
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setExplanation('');
      setError('');
      setAudioElement(null);
      setTtsError('');
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setUseWebSpeech(false);
      if (audioElement) {
        audioElement.pause();
      }
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
    } else if (open && !explanation && !isLoading) {
      fetchExplanation();
    }
  };

  const hasAudioReady = audioElement || useWebSpeech;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] bg-card border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Explanation
            {title && <span className="text-slate-400">- {title}</span>}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-slate-400">Analyzing...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchExplanation}
                className="mt-3"
              >
                Try Again
              </Button>
            </div>
          )}

          {explanation && (
            <div className="space-y-4">
              {/* TTS Controls */}
              <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-400">
                      Audio playback {!puterLoaded && '(Loading Puter.js...)'}
                    </span>
                  </div>
                  
                  {isGeneratingTTS && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating audio...
                    </div>
                  )}
                </div>

                {/* Voice Selection */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-2 block">Voice</label>
                    <Select value={selectedVoice} onValueChange={handleVoiceChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="text-xs text-slate-400 px-2 py-1 font-medium">Puter.js TTS</div>
                        {PUTER_VOICES.map(voice => (
                          <SelectItem key={voice} value={voice}>
                            {voice}
                          </SelectItem>
                        ))}
                        {webVoices.length > 0 && (
                          <>
                            <div className="text-xs text-slate-400 px-2 py-1 font-medium border-t mt-1 pt-2">Browser Speech</div>
                            {webVoices.slice(0, 8).map(voice => (
                              <SelectItem key={voice.name} value={voice.name}>
                                {voice.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-2 block">Engine</label>
                    <Select value={selectedEngine} onValueChange={setSelectedEngine}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PUTER_ENGINES.map(engine => (
                          <SelectItem key={engine.id} value={engine.id}>
                            <div>
                              <div className="font-medium">{engine.name}</div>
                              <div className="text-xs text-slate-400">{engine.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-2 block">Language</label>
                    <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PUTER_LANGUAGES.map(lang => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {ttsError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                    <p className="text-destructive mb-2">{ttsError}</p>
                    <Button variant="outline" size="sm" onClick={retryTTS} className="gap-2">
                      <RefreshCw className="h-3 w-3" />
                      Retry
                    </Button>
                  </div>
                )}

                {hasAudioReady && (
                  <div className="space-y-3">
                    {/* Playback controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={togglePlayback}
                        className="gap-2"
                      >
                        {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        {isPlaying ? 'Pause' : 'Play'}
                      </Button>
                      
                      {isPlaying && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={stopPlayback}
                          className="gap-2"
                        >
                          <Square className="h-3 w-3" />
                          Stop
                        </Button>
                      )}
                      
                      {!useWebSpeech && duration > 0 && (
                        <span className="text-sm text-slate-400">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      )}
                      
                      {useWebSpeech && (
                        <span className="text-sm text-slate-400">
                          {isPlaying ? 'Speaking...' : 'Browser Speech Ready'}
                        </span>
                      )}
                    </div>

                    {/* Progress bar (only for Puter TTS) */}
                    {!useWebSpeech && duration > 0 && (
                      <div className="space-y-2">
                        <Slider
                          value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
                          onValueChange={handleSeek}
                          max={100}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                    )}

                    {/* Volume controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleMute}
                        className="p-1"
                      >
                        {isMuted || volume[0] === 0 ? 
                          <VolumeX className="h-4 w-4" /> : 
                          <Volume2 className="h-4 w-4" />
                        }
                      </Button>
                      
                      <Slider
                        value={isMuted ? [0] : volume}
                        onValueChange={handleVolumeChange}
                        max={1}
                        step={0.1}
                        className="w-24"
                      />
                      
                      <span className="text-xs text-slate-500 min-w-[3rem]">
                        {Math.round((isMuted ? 0 : volume[0]) * 100)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Generate Audio Button */}
                {!hasAudioReady && !isGeneratingTTS && !ttsError && puterLoaded && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => generateTTS(explanation)}
                    className="gap-2"
                  >
                    <Volume2 className="h-4 w-4" />
                    Generate Audio
                  </Button>
                )}
              </div>

              {/* Show the text being explained if it's a text explanation */}
              {type === 'text' && text && (
                <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <h4 className="font-medium text-slate-200 mb-2">Text being analyzed:</h4>
                  <p className="text-sm text-slate-400 italic">"{text}"</p>
                </div>
              )}

              <div className="prose prose-invert max-w-none">
                <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {explanation}
                </div>
              </div>
            </div>
          )}

          {!isLoading && !explanation && !error && (
            <div className="flex items-center justify-center py-12">
              <Button onClick={fetchExplanation} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Get AI Explanation
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
