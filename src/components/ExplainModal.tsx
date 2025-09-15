import { useState, useRef } from 'react';
import { X, Sparkles, Loader2, Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const fetchExplanation = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError('');
    setExplanation('');

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
        await generateTTS(explanationText);
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
    try {
      const encodedText = encodeURIComponent(text);
      const ttsUrl = `https://text.pollinations.ai/${encodedText}?model=openai-audio&voice=nova`;
      setAudioUrl(ttsUrl);
    } catch (err) {
      console.error('Failed to generate TTS:', err);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setExplanation('');
      setError('');
      setAudioUrl('');
      setIsPlaying(false);
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
              <div className="flex items-center gap-2 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                <Volume2 className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-400">Audio playback:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePlayback}
                  disabled={!audioUrl}
                  className="gap-2"
                >
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
                {audioUrl && (
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => setIsPlaying(false)}
                    onError={() => setIsPlaying(false)}
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