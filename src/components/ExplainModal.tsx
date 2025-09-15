import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Loader2, Volume2, VolumeX, Play, Pause, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
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
  
  const audioRef = useRef<HTMLAudioElement>(null);

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
        // Generate TTS for the explanation
        generateTTS(explanationText);
      } else {
        setExplanation('No explanation could be generated for this item.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get explanation');
    } finally {
      setIsLoading(false);
    }
  };

  const generateTTS = async (text: string) => {
    setIsGeneratingTTS(true);
    setTtsError('');
    
    try {
      const encodedText = encodeURIComponent(text);
      const ttsUrl = `https://text.pollinations.ai/${encodedText}?model=openai-audio&voice=nova`;
      
      // Test if the URL is accessible
      const testAudio = new Audio();
      
      testAudio.addEventListener('canplaythrough', () => {
        setAudioUrl(ttsUrl);
        setIsGeneratingTTS(false);
      });
      
      testAudio.addEventListener('error', () => {
        setTtsError('Failed to generate audio. The TTS service may be unavailable.');
        setIsGeneratingTTS(false);
      });
      
      // Set a timeout for the TTS generation
      const timeout = setTimeout(() => {
        setTtsError('TTS generation timed out. Please try again.');
        setIsGeneratingTTS(false);
      }, 10000); // 10 second timeout
      
      testAudio.addEventListener('canplaythrough', () => {
        clearTimeout(timeout);
      });
      
      testAudio.src = ttsUrl;
    } catch (err) {
      setTtsError('Failed to generate TTS audio');
      setIsGeneratingTTS(false);
      console.error('TTS generation error:', err);
    }
  };

  const retryTTS = () => {
    if (explanation) {
      generateTTS(explanation);
    }
  };

  const togglePlayback = () => {
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
    if (!audioRef.current) return;
    const newTime = (value[0] / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value);
    if (audioRef.current) {
      audioRef.current.volume = value[0];
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    
    if (isMuted) {
      audioRef.current.volume = volume[0];
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

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

    // Set initial volume
    audio.volume = volume[0];

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl, volume]);

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
              <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700 space-y-3">
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

                {ttsError && (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm">
                    <p className="text-destructive mb-2">{ttsError}</p>
                    <Button variant="outline" size="sm" onClick={retryTTS}>
                      Retry Audio Generation
                    </Button>
                  </div>
                )}

                {audioUrl && !ttsError && (
                  <div className="space-y-3">
                    {/* Playback controls */}
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={togglePlayback}
                        className="gap-2"
                      >
                        {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        {isPlaying ? 'Pause' : 'Play'}
                      </Button>
                      
                      <span className="text-sm text-slate-400">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-2">
                      <Slider
                        value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
                        onValueChange={handleSeek}
                        max={100}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

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

                {audioUrl && (
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    preload="metadata"
                  />
                )}

                {!audioUrl && !isGeneratingTTS && !ttsError && (
                  <Button variant="outline" size="sm" onClick={() => generateTTS(explanation)}>
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
