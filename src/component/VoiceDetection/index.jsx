import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sketch from 'react-p5';

const VoiceDetection = ({ theme, setTheme }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [volume, setVolume] = useState(0);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [isContinuous, setIsContinuous] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [visualizationMode, setVisualizationMode] = useState('bars'); 

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);

  const languages = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'it-IT', name: 'Italian' },
  ];

  const themes = {
    light: {
      bg: 'bg-gray-50',
      card: 'bg-white',
      text: 'text-gray-800',
      textSecondary: 'text-gray-600',
      border: 'border-gray-200',
    },
    dark: {
      bg: 'bg-gray-900',
      card: 'bg-gray-800',
      text: 'text-white',
      textSecondary: 'text-gray-300',
      border: 'border-gray-700',
    },
  };

  const initializeRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setIsSupported(false);
      setError('Speech recognition is not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    const recognition = recognitionRef.current;
    recognition.continuous = isContinuous;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      setError('');
    };

    recognition.onresult = (event) => {
      let newInterimTranscript = '';
      let newFinalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptText = result[0].transcript;
        
        if (result.isFinal) {
          newFinalTranscript += transcriptText;
          setConfidence(result[0].confidence);
          
          if (transcriptText.trim()) {
            setCommandHistory(prev => [{
              text: transcriptText,
              confidence: result[0].confidence,
              timestamp: new Date().toLocaleTimeString(),
            }, ...prev.slice(0, 9)]); 
          }
        } else {
          newInterimTranscript += transcriptText;
        }
      }

      setInterimTranscript(newInterimTranscript);
      if (newFinalTranscript) {
        setTranscript(prev => prev + newFinalTranscript + ' ');
        setInterimTranscript('');
      }
    };

    recognition.onerror = (event) => {
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  }, [language, isContinuous]);

  useEffect(() => {
    initializeRecognition();
  }, [initializeRecognition]);

  const setupAudioContext = async () => {
    try {
      if (audioContextRef.current) {
        await audioContextRef.current.close();
      }

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      microphoneRef.current.connect(analyserRef.current);
      analyserRef.current.fftSize = 512;
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (err) {
      setError('Microphone access denied or not available');
      console.error('Audio context error:', err);
    }
  };

  const startListening = async () => {
    if (recognitionRef.current && !isListening) {
      try {
        await setupAudioContext();
        recognitionRef.current.start();
      } catch (err) {
        setError('Failed to start listening: ' + err.message);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      if (audioContextRef.current) {
        audioContextRef.current.suspend();
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const clearTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
    setCommandHistory([]);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcript);
  };

  const downloadTranscript = () => {
    const element = document.createElement('a');
    const file = new Blob([transcript], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'voice-transcript.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const setup = useCallback((p5, canvasParentRef) => {
    const existingCanvas = canvasParentRef.querySelector('canvas');
    if (existingCanvas) {
      existingCanvas.remove();
    }
    
    p5.createCanvas(400, 200).parent(canvasParentRef);
  }, []);

  const draw = useCallback((p5) => {
    p5.background(theme === 'dark' ? 30 : 240);
    
    if (analyserRef.current && isListening) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const bufferLength = analyserRef.current.frequencyBinCount;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalizedVolume = average / 255;
      setVolume(normalizedVolume);
      
      p5.noStroke();
      const barWidth = p5.width / bufferLength;
      const circleSize = 30 + normalizedVolume * 120;
      const pulse = p5.sin(p5.frameCount * 0.1) * 10;

      switch (visualizationMode) {
        case 'bars':
          p5.fill(theme === 'dark' ? [100, 200, 255] : [0, 150, 255]);
          for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * p5.height;
            p5.rect(i * barWidth, p5.height - barHeight, barWidth - 1, barHeight);
          }
          break;
          
        case 'circle':
          p5.fill(255, 100, 100, 150);
          p5.ellipse(p5.width / 2, p5.height / 2, circleSize + pulse, circleSize + pulse);
          
          for (let i = 1; i <= 3; i++) {
            p5.noFill();
            p5.stroke(theme === 'dark' ? 100 : 200, 100);
            p5.strokeWeight(1);
            p5.ellipse(p5.width / 2, p5.height / 2, circleSize * i);
          }
          break;
          
        case 'waveform':
          p5.stroke(theme === 'dark' ? [100, 200, 255] : [0, 150, 255]);
          p5.strokeWeight(2);
          p5.noFill();
          p5.beginShape();
          for (let i = 0; i < bufferLength; i++) {
            const x = (i / bufferLength) * p5.width;
            const y = p5.height - (dataArray[i] / 255) * p5.height;
            p5.vertex(x, y);
          }
          p5.endShape();
          break;
      }
      
      p5.fill(theme === 'dark' ? 200 : 50);
      p5.textAlign(p5.CENTER, p5.TOP);
      p5.textSize(14);
      p5.text(`Volume: ${(normalizedVolume * 100).toFixed(0)}%`, p5.width / 2, 10);
    } else {
      p5.fill(theme === 'dark' ? 150 : 100);
      p5.textAlign(p5.CENTER, p5.CENTER);
      p5.textSize(16);
      p5.text('Click "Start Listening" to begin', p5.width / 2, p5.height / 2);
    }
    
    p5.fill(isListening ? [76, 175, 80] : [244, 67, 54]);
    const pulseSize = isListening ? 15 + p5.sin(p5.frameCount * 0.2) * 3 : 15;
    p5.ellipse(p5.width - 20, 20, pulseSize, pulseSize);
  }, [theme, isListening, visualizationMode]);

  if (!isSupported) {
    return (
      <div className={`min-h-screen ${themes[theme].bg} ${themes[theme].text} p-6`}>
        <div className="max-w-4xl mx-auto">
          <div className={`${themes[theme].card} rounded-xl shadow-lg p-6 border ${themes[theme].border}`}>
            <div className="text-center">
              <h3 className="text-xl font-bold text-red-500 mb-2">Browser Not Supported</h3>
              <p className={themes[theme].textSecondary}>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themes[theme].bg} ${themes[theme].text} p-4 transition-colors duration-300`}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent mb-2">
            Voice Detection
          </h1>
          <p className={`text-lg ${themes[theme].textSecondary}`}>
            Real-time speech recognition with interactive visualization
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className={`${themes[theme].card} rounded-xl shadow-lg p-6 border ${themes[theme].border}`}>
              <h3 className="text-lg font-semibold mb-4">Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Language</label>
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className={`w-full p-2 rounded-lg border ${themes[theme].border} ${themes[theme].bg} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    disabled={isListening}
                  >
                    {languages.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Theme</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex-1 p-2 rounded-lg border ${
                        theme === 'light' 
                          ? 'bg-blue-500 text-white border-blue-500' 
                          : themes[theme].border
                      } transition-colors`}
                    >
                      Light
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 p-2 rounded-lg border ${
                        theme === 'dark' 
                          ? 'bg-blue-500 text-white border-blue-500' 
                          : themes[theme].border
                      } transition-colors`}
                    >
                      Dark
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Visualization</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['bars', 'circle', 'waveform'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => setVisualizationMode(mode)}
                        className={`p-2 rounded-lg border text-sm capitalize ${
                          visualizationMode === mode 
                            ? 'bg-blue-500 text-white border-blue-500' 
                            : themes[theme].border
                        } transition-colors`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Continuous Mode</label>
                  <button
                    onClick={() => setIsContinuous(!isContinuous)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isContinuous ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isContinuous ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className={`${themes[theme].card} rounded-xl shadow-lg p-6 border ${themes[theme].border}`}>
              <h3 className="text-lg font-semibold mb-4">Controls</h3>
              
              <div className="space-y-3">
                <button 
                  onClick={toggleListening}
                  className={`w-full p-4 rounded-xl font-semibold text-white transition-all transform hover:scale-105 ${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {isListening ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                      Stop Listening
                    </div>
                  ) : (
                    'Start Listening'
                  )}
                </button>
                
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={clearTranscript}
                    className="p-3 rounded-lg bg-gray-500 text-white hover:bg-gray-600 transition-colors disabled:opacity-50"
                    disabled={!transcript && !interimTranscript}
                  >
                    Clear
                  </button>
                  <button 
                    onClick={copyToClipboard}
                    className="p-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                    disabled={!transcript}
                  >
                    Copy
                  </button>
                </div>
                
                <button 
                  onClick={downloadTranscript}
                  className="w-full p-3 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors disabled:opacity-50"
                  disabled={!transcript}
                >
                  Download Transcript
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`${themes[theme].card} rounded-xl shadow-lg p-6 border ${themes[theme].border}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Voice Visualization</h3>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-sm">{isListening ? 'Listening...' : 'Ready'}</span>
                </div>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                <Sketch 
                  key={`${theme}-${visualizationMode}-${isListening}`}
                  setup={setup} 
                  draw={draw} 
                />
              </div>
            </div>

            <div className={`${themes[theme].card} rounded-xl shadow-lg p-6 border ${themes[theme].border}`}>
              <h3 className="text-lg font-semibold mb-4">Live Transcript</h3>
              <div className={`rounded-lg p-4 min-h-[200px] max-h-[300px] overflow-y-auto border ${themes[theme].border} transition-all duration-300 ${
                isListening ? 'ring-2 ring-blue-500' : ''
              }`}>
                {transcript && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-2">Final:</p>
                    <p className="leading-relaxed">{transcript}</p>
                  </div>
                )}
                {interimTranscript && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Interim (Listening...):</p>
                    <p className="leading-relaxed text-blue-500 italic">{interimTranscript}</p>
                  </div>
                )}
                {!transcript && !interimTranscript && (
                  <p className="text-gray-500 text-center italic">Start speaking to see transcript here...</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`${themes[theme].card} rounded-xl shadow-lg p-6 border ${themes[theme].border}`}>
              <h3 className="text-lg font-semibold mb-4">Real-time Metrics</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Volume Level</span>
                    <span>{(volume * 100).toFixed(1)}%</span>
                  </div>
                  <div className={`w-full bg-gray-200 rounded-full h-3 ${themes[theme].bg}`}>
                    <div 
                      className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full transition-all duration-150"
                      style={{ width: `${volume * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Confidence</span>
                    <span>{(confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className={`w-full bg-gray-200 rounded-full h-3 ${themes[theme].bg}`}>
                    <div 
                      className="bg-gradient-to-r from-purple-400 to-pink-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${confidence * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <div className="text-2xl font-bold text-blue-600">{commandHistory.length}</div>
                    <div className="text-sm text-blue-600">Commands</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <div className="text-2xl font-bold text-green-600">
                      {transcript.split(' ').filter(word => word.length > 0).length}
                    </div>
                    <div className="text-sm text-green-600">Words</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${themes[theme].card} rounded-xl shadow-lg p-6 border ${themes[theme].border}`}>
              <h3 className="text-lg font-semibold mb-4">Recent Commands</h3>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {commandHistory.map((command, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded-lg border ${themes[theme].border} transition-all hover:scale-105 cursor-pointer`}
                    onClick={() => setTranscript(prev => prev + command.text + ' ')}
                  >
                    <p className="text-sm mb-1">{command.text}</p>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{(command.confidence * 100).toFixed(0)}% confident</span>
                      <span>{command.timestamp}</span>
                    </div>
                  </div>
                ))}
                
                {commandHistory.length === 0 && (
                  <p className="text-gray-500 text-center italic py-4">No commands yet</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg animate-pulse">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">Error:</span>
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceDetection;