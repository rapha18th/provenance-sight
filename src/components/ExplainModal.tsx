import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Loader2, Volume2, VolumeX, Play, Pause, Download, RefreshCw } from 'lucide-react';
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

// Available TTS services
const TTS_SERVICES = [
  {
    name: 'Pollinations.ai',
    id: 'pollinations',
    voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
  },
  {
    name: 'Microsoft Edge',
    id: 'edge',
    voices: ['aria', 'davis', 'guy', 'jane']
  },
  {
    name: 'Web Speech API',
    id: 'webspeech',
    voices: [] // Will be populated dynamically
  }
];

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
  const [selectedService, setSelectedService] = useState('pollinations');
  const [selectedVoice, setSelectedVoice] = useState('nova');
  const [webVoices, setWebVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load available Web Speech API voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        setWebVoices(voices.filter(voice => voice.lang.startsWith('en')));
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
    const truncatedText = text.length > 500 ? text.substring(0, 500) + '...' : text;
    const encodedText = encodeURIComponent(truncatedText);
    const ttsUrl = `https://text.pollinations.ai/${encodedText}?model=openai-audio&voice=${voice}`;
    
    return new Promise((resolve, reject) => {
      const testAudio = new Audio();
      const timeout = setTimeout(() => {
        reject(new Error('TTS generation timed out'));
      }, 15000); // 15 second timeout

      testAudio.addEventListener('canplaythrough', () => {
        clearTimeout(timeout);
        resolve(ttsUrl);
      });

      testAudio.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load audio from Pollinations.ai'));
      });

      testAudio.src = ttsUrl;
    });
  };

  const generateEdgeTTS = async (text: string, voice: string): Promise<string> => {
    // Fallback to a public Edge TTS service (this is a placeholder - you'd need to implement or use a real service)
    const response = await fetch('https://api.your-edge-tts-service.com/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice })
    });
    
    if (!response.ok) {
      throw new Error('Edge TTS service unavailable');
    }
    
    const audioBlob = await response.blob();
    return URL.createObjectURL(audioBlob);
  };

  const generateWebSpeechTTS = async (text: string, voiceName: string): Promise<void> => {
    if (!('speechSynthesis' in window)) {
      throw new Error('Web Speech API not supported');
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = webVoices.find(v => v.name === voiceName) || webVoices[0];
      
      if (voice) {
        utterance.voice = voice;
      }
      
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = volume[0];
      
      utterance.onend = () => {
        setIsPlaying(false);
        resolve();
      };
      
      utterance.onerror = (event) => {
        setIsPlaying(false);
        reject(new Error(`Speech synthesis failed: ${event.error}`));
      };
      
      speechRef.current = utterance;
      speechSynthesis.speak(utterance);
      setIsPlaying(true);
      resolve();
    });
  };

  const generateTTS = async (text: string) => {
    setIsGeneratingTTS(true);
    setTtsError('');
    setAudioUrl('');
    
    try {
      let audioUrl = '';
      
      switch (selectedService) {
        case 'pollinations':
          audioUrl = await generatePollinationsTTS(text, selectedVoice);
          setAudioUrl(audioUrl);
          break;
          
        case 'edge':
          audioUrl = await generateEdgeTTS(text, selectedVoice);
          setAudioUrl(audioUrl);
          break;
          
        case 'webspeech':
          await generateWebSpeechTTS(text, selectedVoice);
          break;
          
        default:
          throw new Error('Unknown TTS service');
      }
      
    } catch (err) {
      console.error('TTS generation error:', err);
      setTtsError(err instanceof Error ? err.message : 'Failed to generate TTS audio');
      
      // Try fallback to Web Speech API
      if (selectedService !== 'webspeech' && 'speechSynthesis' in window) {
        try {
          setTtsError('Primary TTS failed, trying Web Speech API...');
          await generateWebSpeechTTS(text, webVoices[0]?.name || '');
          setTtsError('');
        } catch (fallbackErr) {
          setTtsError('All TTS services failed. Please try again later.');
        }
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
    if (selectedService === 'webspeech') {
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

    if (!audioRef.current || !audioUrl) return;

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

  const handleSeek = (value: number[]) => {
    if (!audioRef.current || selectedService === 'webspeech') return;
    const newTime = (value[0] / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value);
    if (audioRef.current) {
      audioRef.current.volume = value[0];
    }
    if (speechRef.current) {
      speechRef.current.volume = value[0];
    }
  };

  const toggleMute = () => {
    if (!audioRef.current && selectedService !== 'webspeech') return;
    
    if (isMuted) {
      if (audioRef.current) audioRef.current.volume = volume[0];
      setIsMuted(false);
    } else {
      if (audioRef.current) audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleServiceChange = (service: string) => {
    setSelectedService(service);
    setAudioUrl('');
    setTtsError('');
    setIsPlaying(false);
    
    // Reset voice selection
    const serviceInfo = TTS_SERVICES.find(s => s.id === service);
    if (serviceInfo && serviceInfo.voices.length > 0) {
      setSelectedVoice(serviceInfo.voices[0]);
    } else if (service === 'webspeech' && webVoices.length > 0) {
      setSelectedVoice(webVoices[0].name);
    }
    
    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  };

  const getAvailableVoices = () => {
    const service = TTS_SERVICES.find(s => s.id === selectedService);
    if (service?.id === 'webspeech') {
      return webVoices.map(voice => ({ id: voice.name, name: voice.name }));
    }
    return service?.voices.map(voice => ({ id: voice, name: voice })) || [];
  };

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || selectedService === 'webspeech') return;

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
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
    audio.volume = volume[0];

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl, volume, selectedService]);

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

                {/* TTS Service Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">TTS Service</label>
                    <Select value={selectedService} onValueChange={handleServiceChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TTS_SERVICES.map(service => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Voice</label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableVoices().map(voice => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name}
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

                {((audioUrl && !ttsError) || selectedService === 'webspeech') && (
                  <div className="space-y-3">
                    {/* Playback controls */}
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={togglePlayback}
                        className="gap-2"
                        disabled={selectedService === 'webspeech' && !webVoices.length}
                      >
                        {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        {isPlaying ? 'Pause' : 'Play'}
                      </Button>
                      
                      {selectedService !== 'webspeech' && (
                        <span className="text-sm text-slate-400">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      )}
                    </div>

                    {/* Progress bar (not available for Web Speech API) */}
                    {selectedService !== 'webspeech' && (
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
                    </div>
                  </div>
                )}

                {audioUrl && selectedService !== 'webspeech' && (
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    preload="metadata"
                  />
                )}

                {!audioUrl && !isGeneratingTTS && !ttsError && selectedService !== 'webspeech' && (
                  <Button variant="outline" size="sm" onClick={() => generateTTS(explanation)}>
                    Generate Audio
                  </Button>
                )}

                {selectedService === 'webspeech' && !webVoices.length && (
                  <p className="text-sm text-slate-400">Loading voices...</p>
                )}

                {selectedService === 'webspeech' && webVoices.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => generateTTS(explanation)}>
                    Speak Text
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
