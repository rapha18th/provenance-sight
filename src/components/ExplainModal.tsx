import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Loader2, Volume2, VolumeX, Play, Pause, Download, RefreshCw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api';

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
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsError, setTtsError] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState([0.8]);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [webVoices, setWebVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [useWebSpeech, setUseWebSpeech] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Available voices for Pollinations TTS
  const POLLINATIONS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

  // Load available Web Speech API voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
        setWebVoices(englishVoices);
        
        // Set default web speech voice if none selected
        if (englishVoices.length > 0 && !selectedVoice.includes('Google') && !selectedVoice.includes('Microsoft')) {
          // Don't override if user has selected a web voice
        }
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
    setAudioUrl('');
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

  const generatePollinationsTTS = async (text: string, voice: string): Promise<string> => {
    // Truncate text if too long to avoid URL length issues
    const truncatedText = text.length > 800 ? text.substring(0, 800) + '...' : text;
    const encodedText = encodeURIComponent(truncatedText);
    
    // Use the correct format from the API documentation
    const ttsUrl = `https://text.pollinations.ai/${encodedText}?model=openai-audio&voice=${voice}`;
    
    return new Promise((resolve, reject) => {
      const testAudio = new Audio();
      const timeout = setTimeout(() => {
        reject(new Error('TTS generation timed out. Service may be busy.'));
      }, 20000); // 20 second timeout

      const cleanup = () => {
        clearTimeout(timeout);
        testAudio.removeEventListener('canplaythrough', onSuccess);
        testAudio.removeEventListener('error', onError);
        testAudio.removeEventListener('loadeddata', onSuccess);
      };

      const onSuccess = () => {
        cleanup();
        resolve(ttsUrl);
      };

      const onError = () => {
        cleanup();
        reject(new Error('Pollinations TTS service is currently unavailable'));
      };

      testAudio.addEventListener('canplaythrough', onSuccess);
      testAudio.addEventListener('loadeddata', onSuccess);
      testAudio.addEventListener('error', onError);

      try {
        testAudio.src = ttsUrl;
        testAudio.load();
      } catch (err) {
        cleanup();
        reject(new Error('Failed to load TTS audio'));
      }
    });
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
    setAudioUrl('');
    
    try {
      if (useWebSpeech || webVoices.some(v => v.name === selectedVoice)) {
        // Use Web Speech API
        await generateWebSpeechTTS(text, selectedVoice);
        setUseWebSpeech(true);
      } else {
        // Use Pollinations TTS
        const audioUrl = await generatePollinationsTTS(text, selectedVoice);
        setAudioUrl(audioUrl);
        setUseWebSpeech(false);
      }
      
    } catch (err) {
      console.error('TTS generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate TTS audio';
      
      // Try fallback to Web Speech API if Pollinations fails
      if (!useWebSpeech && !webVoices.some(v => v.name === selectedVoice) && 'speechSynthesis' in window && webVoices.length > 0) {
        try {
          setTtsError('Pollinations TTS failed, trying browser speech...');
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

    if (!audioRef.current || !audioUrl) {
      if (explanation) {
        generateTTS(explanation);
      }
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
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
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }
  };

  const handleSeek = (value: number[]) => {
    if (useWebSpeech || !audioRef.current) return;
    const newTime = (value[0] / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value);
    if (audioRef.current && !useWebSpeech) {
      audioRef.current.volume = value[0];
    }
    // Note: Web Speech API volume is set when speech starts
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (audioRef.current && !useWebSpeech) {
        audioRef.current.volume = volume[0];
      }
    } else {
      setIsMuted(true);
      if (audioRef.current && !useWebSpeech) {
        audioRef.current.volume = 0;
      }
    }
  };

  const handleVoiceChange = (voice: string) => {
    setSelectedVoice(voice);
    
    // Reset audio state when changing voices
    setAudioUrl('');
    setTtsError('');
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    
    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    
    // Determine if this is a web speech voice
    const isWebVoice = webVoices.some(v => v.name === voice);
    setUseWebSpeech(isWebVoice);
  };

  const getAvailableVoices = () => {
    const pollinationsVoices = POLLINATIONS_VOICES.map(voice => ({
      id: voice,
      name: `${voice} (Pollinations)`,
      type: 'pollinations'
    }));
    
    const webSpeechVoices = webVoices.map(voice => ({
      id: voice.name,
      name: `${voice.name} (Browser)`,
      type: 'webspeech'
    }));
    
    return [...pollinationsVoices, ...webSpeechVoices];
  };

  // Audio event handlers for Pollinations TTS
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || useWebSpeech) return;

    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleError = () => {
      setIsPlaying(false);
      setTtsError('Audio playback failed. Please try regenerating the audio.');
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.volume = isMuted ? 0 : volume[0];

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl, volume, isMuted, useWebSpeech]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setExplanation('');
      setError('');
      setAudioUrl('');
      setTtsError('');
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setUseWebSpeech(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
    } else if (open && !explanation && !isLoading) {
      fetchExplanation();
    }
  };

  const hasAudioReady = audioUrl || useWebSpeech;

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
                    <span className="text-sm text-slate-400">Audio playback</span>
                  </div>
                  
                  {isGeneratingTTS && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating audio...
                    </div>
                  )}
                </div>

                {/* Voice Selection */}
                <div>
                  <label className="text-xs text-slate-400 mb-2 block">Voice</label>
                  <Select value={selectedVoice} onValueChange={handleVoiceChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="text-xs text-slate-400 px-2 py-1 font-medium">Pollinations TTS</div>
                      {POLLINATIONS_VOICES.map(voice => (
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

                    {/* Progress bar (only for Pollinations TTS) */}
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
                {!hasAudioReady && !isGeneratingTTS && !ttsError && (
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

                {/* Audio element for Pollinations TTS */}
                {audioUrl && !useWebSpeech && (
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    preload="metadata"
                  />
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
