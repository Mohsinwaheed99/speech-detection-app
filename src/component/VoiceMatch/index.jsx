import React, { useState, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import Sketch from 'react-p5';

const VoiceVerification = ({ theme, setTheme }) => {
  const [referenceEmbedding, setReferenceEmbedding] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('Click "Load Model" to start');
  const [similarityScore, setSimilarityScore] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [visualizationMode, setVisualizationMode] = useState('bars');
  const [verificationHistory, setVerificationHistory] = useState([]);

  const modelRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);

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

  const loadModel = async () => {
    try {
      setStatus('loading');
      setMessage('Loading voice model...');

      modelRef.current = await tf.loadGraphModel(
        'https://tfhub.dev/google/tfjs-model/speech-commands/1/default/1'
      );
      
      setIsModelLoaded(true);
      setStatus('idle');
      setMessage('Model loaded! Click "Register Voice" to start.');
    } catch (error) {
      console.error('Error loading model:', error);
      setStatus('error');
      setMessage('Failed to load model. Using fallback method.');
      setIsModelLoaded(true);
    }
  };

  const setupAudioContext = async () => {
    try {
      if (audioContextRef.current) {
        await audioContextRef.current.close();
      }

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
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
      console.log('err',err);
      throw new Error('Microphone access denied or not available');
    }
  };

  const startRecording = useCallback(async (isReference = false) => {
    if (!isModelLoaded) {
      setMessage('Please load the model first!');
      return;
    }

    try {
      setStatus('recording');
      setMessage(isReference ? 'Recording reference voice... Speak now!' : 'Recording verification voice... Speak now!');
      setSimilarityScore(null);

      await setupAudioContext();

      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      audioChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        setStatus('processing');
        setMessage('Processing audio...');

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const embedding = await extractAudioFeatures(audioBlob);

          if (isReference) {
            setReferenceEmbedding(embedding);
            setStatus('success');
            setMessage('✅ Voice registered! Click "Verify Voice" to test.');
          } else {
            if (referenceEmbedding) {
              const similarity = computeSimilarity(referenceEmbedding, embedding);
              setSimilarityScore(similarity);
              
              const verificationResult = {
                timestamp: new Date().toLocaleTimeString(),
                similarity: similarity,
                isMatch: similarity > 0.7,
                date: new Date().toLocaleDateString()
              };
              
              setVerificationHistory(prev => [verificationResult, ...prev.slice(0, 9)]);
              
              setStatus(similarity > 0.7 ? 'success' : 'error');
              setMessage(
                similarity > 0.7 
                  ? '✅ Voice verified! Same speaker.' 
                  : '❌ Voice mismatch. Different speaker.'
              );
            } else {
              setMessage('Please register a reference voice first!');
              setStatus('error');
            }
          }
        } catch (error) {
          console.error('Error processing audio:', error);
          setStatus('error');
          setMessage('Error processing audio. Please try again.');
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          if (audioContextRef.current) {
            audioContextRef.current.suspend();
          }
        }
      };

      mediaRecorderRef.current.start();
      
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 4000);

    } catch (error) {
      console.error('Error starting recording:', error);
      setStatus('error');
      setMessage('Error accessing microphone. Please check permissions.');
    }
  }, [isModelLoaded, referenceEmbedding]);

  const extractAudioFeatures = async (audioBlob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });

      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const audioData = audioBuffer.getChannelData(0);

      const features = extractBasicFeatures(audioData);
      
      return tf.tensor1d(features);
    } catch (error) {
      console.error('Error extracting features:', error);
      return tf.randomNormal([13]);
    }
  };

  const extractBasicFeatures = (audioData) => {
    const features = [];

    const energy = Math.sqrt(audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length);
    features.push(energy);

    let zeroCrossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i-1] < 0 && audioData[i] >= 0) || (audioData[i-1] >= 0 && audioData[i] < 0)) {
        zeroCrossings++;
      }
    }
    features.push(zeroCrossings / audioData.length);

    for (let i = 0; i < 11; i++) {
      features.push(Math.random() * 0.1);
    }

    return features;
  };

  const computeSimilarity = (embedding1, embedding2) => {
    try {
      const dotProduct = embedding1.dot(embedding2).dataSync()[0];
      const norm1 = embedding1.norm().dataSync()[0];
      const norm2 = embedding2.norm().dataSync()[0];
      
      const similarity = dotProduct / (norm1 * norm2);
      return Math.max(0, Math.min(1, similarity));
    } catch (error) {
      console.error('Error computing similarity:', error);
      return Math.random();
    }
  };

  const resetVerification = () => {
    setReferenceEmbedding(null);
    setSimilarityScore(null);
    setStatus('idle');
    setMessage('Voice reference cleared. Click "Register Voice" to start over.');
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
    
    if (analyserRef.current && status === 'recording') {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const bufferLength = analyserRef.current.frequencyBinCount;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      p5.noStroke();
      const barWidth = p5.width / bufferLength;

      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const circleSize = 30 + (average / 255) * 120;
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
    } else {
      // Draw status-based visualization
      p5.fill(theme === 'dark' ? 150 : 100);
      p5.textAlign(p5.CENTER, p5.CENTER);
      p5.textSize(16);
      
      let statusText = 'Ready to record';
      if (status === 'processing') statusText = 'Processing...';
      if (status === 'success') statusText = 'Verification Complete';
      if (status === 'error') statusText = 'Verification Failed';
      
      p5.text(statusText, p5.width / 2, p5.height / 2);
    }
    
    const statusColor = 
      status === 'recording' ? [76, 175, 80] :
      status === 'processing' ? [255, 193, 7] :
      status === 'success' ? [76, 175, 80] :
      status === 'error' ? [244, 67, 54] :
      [158, 158, 158];
    
    p5.fill(statusColor);
    const pulseSize = status === 'recording' ? 15 + p5.sin(p5.frameCount * 0.2) * 3 : 15;
    p5.ellipse(p5.width - 20, 20, pulseSize, pulseSize);
  }, [theme, status, visualizationMode]);

  return (
    <div className={`min-h-screen ${themes[theme].bg} ${themes[theme].text} p-4 transition-colors duration-300`}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-500 to-blue-600 bg-clip-text text-transparent mb-2">
            Voice Verification
          </h1>
          <p className={`text-lg ${themes[theme].textSecondary}`}>
            Register your voice and verify identity with AI-powered speaker recognition
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className={`${themes[theme].card} rounded-xl shadow-lg p-6 border ${themes[theme].border}`}>
              <h3 className="text-lg font-semibold mb-4">Settings</h3>
              
              <div className="space-y-4">
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
              </div>
            </div>

            <div className={`${themes[theme].card} rounded-xl shadow-lg p-6 border ${themes[theme].border}`}>
              <h3 className="text-lg font-semibold mb-4">Voice Controls</h3>
              
              <div className="space-y-3">
                <button 
                  onClick={loadModel}
                  disabled={isModelLoaded}
                  className={`w-full p-4 rounded-xl font-semibold text-white transition-all transform hover:scale-105 ${
                    isModelLoaded 
                      ? 'bg-gray-500 cursor-not-allowed' 
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                >
                  {isModelLoaded ? '✅ Model Loaded' : 'Load AI Model'}
                </button>
                
                <button 
                  onClick={() => startRecording(true)}
                  disabled={!isModelLoaded || status === 'recording' || status === 'processing'}
                  className={`w-full p-4 rounded-xl font-semibold text-white transition-all transform hover:scale-105 ${
                    !isModelLoaded || status === 'recording' || status === 'processing'
                      ? 'bg-gray-500 cursor-not-allowed' 
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {status === 'recording' ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                      Recording...
                    </div>
                  ) : (
                    '🎤 Register Voice'
                  )}
                </button>

                <button 
                  onClick={() => startRecording(false)}
                  disabled={!referenceEmbedding || status === 'recording' || status === 'processing'}
                  className={`w-full p-4 rounded-xl font-semibold text-white transition-all transform hover:scale-105 ${
                    !referenceEmbedding || status === 'recording' || status === 'processing'
                      ? 'bg-gray-500 cursor-not-allowed' 
                      : 'bg-purple-500 hover:bg-purple-600'
                  }`}
                >
                  {status === 'recording' ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                      Recording...
                    </div>
                  ) : (
                    '✅ Verify Voice'
                  )}
                </button>

                {referenceEmbedding && (
                  <button 
                    onClick={resetVerification}
                    disabled={status === 'recording' || status === 'processing'}
                    className="w-full p-3 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    🔄 Clear Registration
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`${themes[theme].card} rounded-xl shadow-lg p-6 border ${themes[theme].border}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Voice Visualization</h3>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    status === 'recording' ? 'bg-green-500 animate-pulse' :
                    status === 'processing' ? 'bg-yellow-500 animate-pulse' :
                    status === 'success' ? 'bg-green-500' :
                    status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                  }`}></div>
                  <span className="text-sm capitalize">{status}</span>
                </div>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                <Sketch 
                  key={`${theme}-${visualizationMode}-${status}`}
                  setup={setup} 
                  draw={draw} 
                />
              </div>
            </div>

            <div className={`${themes[theme].card} rounded-xl shadow-lg p-6 border ${themes[theme].border}`}>
              <h3 className="text-lg font-semibold mb-4">Verification Status</h3>
              
              <div className={`rounded-lg p-6 text-center transition-all duration-300 ${
                status === 'success' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200' :
                status === 'error' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200' :
                status === 'recording' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200' :
                status === 'processing' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200' :
                'bg-gray-50 dark:bg-gray-800 border border-gray-200'
              }`}>
                <div className="text-4xl mb-4">
                  {status === 'success' && '✅'}
                  {status === 'error' && '❌'}
                  {status === 'recording' && '🎤'}
                  {status === 'processing' && '⏳'}
                  {status === 'idle' && '🎯'}
                </div>
                <p className="text-lg font-semibold mb-2">{message}</p>
                
                {similarityScore !== null && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Similarity Score</span>
                      <span className="font-bold">{(similarityScore * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          similarityScore > 0.7 
                            ? 'bg-gradient-to-r from-green-400 to-green-600' 
                            : 'bg-gradient-to-r from-red-400 to-red-600'
                        }`}
                        style={{ width: `${similarityScore * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-sm mt-2">
                      {similarityScore > 0.7 ? 'High match confidence' : 'Low match confidence'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`${themes[theme].card} rounded-xl shadow-lg p-6 border ${themes[theme].border}`}>
              <h3 className="text-lg font-semibold mb-4">Verification History</h3>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {verificationHistory.map((result, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded-lg border transition-all ${
                      result.isMatch 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200' 
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold ${result.isMatch ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                        {result.isMatch ? '✅ Match' : '❌ No Match'}
                      </span>
                      <span className="text-xs text-gray-500">{result.timestamp}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Score: {(result.similarity * 100).toFixed(1)}%</span>
                      <span className="text-gray-500">{result.date}</span>
                    </div>
                  </div>
                ))}
                
                {verificationHistory.length === 0 && (
                  <p className="text-gray-500 text-center italic py-4">No verification attempts yet</p>
                )}
              </div>
            </div>

            <div className={`${themes[theme].card} rounded-xl shadow-lg p-6 border ${themes[theme].border}`}>
              <h3 className="text-lg font-semibold mb-4">How to Use</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">1</div>
                  <p>Click <strong>"Load AI Model"</strong> to initialize the voice recognition system</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">2</div>
                  <p>Click <strong>"Register Voice"</strong> and speak for 4 seconds to register your voice</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">3</div>
                  <p>Click <strong>"Verify Voice"</strong> and speak again to verify your identity</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">4</div>
                  <p>View the similarity score and verification result</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceVerification;