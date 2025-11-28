import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sketch from 'react-p5';

const VoiceControlledForm = ({ theme, setTheme }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceFeedback, setVoiceFeedback] = useState('');
  const [activeField, setActiveField] = useState(null);
  const [isFormComplete, setIsFormComplete] = useState(false);

  const [formData, setFormData] = useState({
    personalInfo: {
      fullName: '',
      email: '',
      phone: '',
      birthDate: ''
    },
    preferences: {
      subscription: 'basic',
      notifications: true,
      language: 'english'
    },
    details: {
      bio: '',
      skills: [],
      experience: 'beginner',
      salary: 50000
    },
    contact: {
      address: '',
      city: '',
      country: '',
      zipCode: ''
    }
  });

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);

  const formFields = [
    {
      id: 'fullName',
      label: 'Full Name',
      type: 'text',
      section: 'personalInfo',
      placeholder: 'Say your full name',
      voiceHint: 'Please say your full name, then say "done"',
      validation: (value) => value.length >= 2
    },
    {
      id: 'email',
      label: 'Email Address',
      type: 'email',
      section: 'personalInfo',
      placeholder: 'Say your email address',
      voiceHint: 'Please say your email address, then say "done"',
      validation: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    },
    {
      id: 'phone',
      label: 'Phone Number',
      type: 'tel',
      section: 'personalInfo',
      placeholder: 'Say your phone number',
      voiceHint: 'Please say your phone number with country code, then say "done"',
      validation: (value) => value.replace(/\D/g, '').length >= 10
    },
    {
      id: 'birthDate',
      label: 'Birth Date',
      type: 'text',
      section: 'personalInfo',
      placeholder: 'Say your birth date (e.g., January 15 1990)',
      voiceHint: 'Please say your birth date in format month day year, then say "done"'
    },
    {
      id: 'subscription',
      label: 'Subscription Plan',
      type: 'select',
      section: 'preferences',
      placeholder: 'Select subscription plan',
      voiceHint: 'Say basic, premium, or enterprise',
      options: [
        { value: 'basic', label: 'Basic' },
        { value: 'premium', label: 'Premium' },
        { value: 'enterprise', label: 'Enterprise' }
      ]
    },
    {
      id: 'notifications',
      label: 'Enable Notifications',
      type: 'toggle',
      section: 'preferences',
      voiceHint: 'Say "enable notifications" or "disable notifications"'
    },
    {
      id: 'language',
      label: 'Preferred Language',
      type: 'radio',
      section: 'preferences',
      voiceHint: 'Say English, Spanish, French, or German',
      options: ['english', 'spanish', 'french', 'german']
    },
    {
      id: 'bio',
      label: 'Personal Bio',
      type: 'textarea',
      section: 'details',
      placeholder: 'Tell us about yourself',
      voiceHint: 'Please tell us about yourself, then say "done"'
    },
    {
      id: 'skills',
      label: 'Skills',
      type: 'tags',
      section: 'details',
      placeholder: 'Add your skills',
      voiceHint: 'Say a skill to add, say "remove" followed by skill name to remove, say "done" when finished'
    },
    {
      id: 'experience',
      label: 'Experience Level',
      type: 'range',
      section: 'details',
      voiceHint: 'Say beginner, intermediate, advanced, or expert',
      options: ['beginner', 'intermediate', 'advanced', 'expert']
    },
    {
      id: 'salary',
      label: 'Expected Salary',
      type: 'slider',
      section: 'details',
      min: 30000,
      max: 150000,
      step: 5000,
      voiceHint: 'Say a number between 30,000 and 150,000'
    },
    {
      id: 'address',
      label: 'Street Address',
      type: 'text',
      section: 'contact',
      placeholder: 'Say your street address',
      voiceHint: 'Please say your street address, then say "done"'
    },
    {
      id: 'city',
      label: 'City',
      type: 'text',
      section: 'contact',
      placeholder: 'Say your city',
      voiceHint: 'Please say your city, then say "done"'
    },
    {
      id: 'country',
      label: 'Country',
      type: 'text',
      section: 'contact',
      placeholder: 'Say your country',
      voiceHint: 'Please say your country, then say "done"'
    },
    {
      id: 'zipCode',
      label: 'ZIP Code',
      type: 'text',
      section: 'contact',
      placeholder: 'Say your ZIP code',
      voiceHint: 'Please say your ZIP code, then say "done"'
    }
  ];

  const themes = {
    light: {
      bg: 'bg-gray-50',
      card: 'bg-white',
      text: 'text-gray-800',
      textSecondary: 'text-gray-600',
      border: 'border-gray-200',
      input: 'bg-white border-gray-300 text-gray-800',
      button: 'bg-blue-500 hover:bg-blue-600 text-white'
    },
    dark: {
      bg: 'bg-gray-900',
      card: 'bg-gray-800',
      text: 'text-white',
      textSecondary: 'text-gray-300',
      border: 'border-gray-700',
      input: 'bg-gray-700 border-gray-600 text-white',
      button: 'bg-blue-600 hover:bg-blue-700 text-white'
    }
  };

  const globalCommands = [
    'next field', 'previous field', 'first field', 'last field',
    'submit form', 'reset form', 'complete form',
    'dark mode', 'light mode', 'toggle theme',
    'done', 'clear field', 'go to',
    'add skill', 'remove skill', 'choose color',
    'enable notifications', 'disable notifications',
    'basic plan', 'premium plan', 'enterprise plan',
    'english', 'spanish', 'french', 'german',
    'beginner', 'intermediate', 'advanced', 'expert'
  ];

  const voiceCommands = {
    'next field': () => navigateToNextField(),
    'previous field': () => navigateToPreviousField(),
    'first field': () => setActiveField(formFields[0].id),
    'last field': () => setActiveField(formFields[formFields.length - 1].id),
    
    'submit form': () => handleSubmit(),
    'reset form': () => handleReset(),
    'complete form': () => handleSubmit(),
    
    'dark mode': () => setTheme('dark'),
    'light mode': () => setTheme('light'),
    'toggle theme': () => setTheme(prev => prev === 'dark' ? 'light' : 'dark'),
    
    'done': () => handleFieldComplete(),
    'clear field': () => clearActiveField(),
    'go to': () => setVoiceFeedback('Say which field you want to go to'),
    
    'add skill': () => {
      setVoiceFeedback('Please say the skill you want to add');
      setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              }
            }
            if (finalTranscript.trim()) {
              addSkill(finalTranscript.trim());
            }
          };
        }
      }, 100);
    },
    'remove skill': () => {
      setVoiceFeedback('Please say which skill to remove');
      // Set a temporary state to capture the skill to remove
      setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              }
            }
            if (finalTranscript.trim()) {
              removeSkill(finalTranscript.trim());
            }
          };
        }
      }, 100);
    },
    
    // Preferences
    'enable notifications': () => updateFormData('preferences', 'notifications', true),
    'disable notifications': () => updateFormData('preferences', 'notifications', false),
    'basic plan': () => updateFormData('preferences', 'subscription', 'basic'),
    'premium plan': () => updateFormData('preferences', 'subscription', 'premium'),
    'enterprise plan': () => updateFormData('preferences', 'subscription', 'enterprise'),
    
    // Language selection
    'english': () => updateFormData('preferences', 'language', 'english'),
    'spanish': () => updateFormData('preferences', 'language', 'spanish'),
    'french': () => updateFormData('preferences', 'language', 'french'),
    'german': () => updateFormData('preferences', 'language', 'german'),
    
    // Experience level
    'beginner': () => updateFormData('details', 'experience', 'beginner'),
    'intermediate': () => updateFormData('details', 'experience', 'intermediate'),
    'advanced': () => updateFormData('details', 'experience', 'advanced'),
    'expert': () => updateFormData('details', 'experience', 'expert'),
  };

  // Skills management
  const addSkill = (skill) => {
    const currentSkills = formData.details.skills;
    if (!currentSkills.includes(skill)) {
      updateFormData('details', 'skills', [...currentSkills, skill]);
      setVoiceFeedback(`✅ Added skill: ${skill}`);
    } else {
      setVoiceFeedback(`ℹ️ Skill "${skill}" already exists`);
    }
  };

  const removeSkill = (skill) => {
    const currentSkills = formData.details.skills;
    const filteredSkills = currentSkills.filter(s => s.toLowerCase() !== skill.toLowerCase());
    if (filteredSkills.length < currentSkills.length) {
      updateFormData('details', 'skills', filteredSkills);
      setVoiceFeedback(`✅ Removed skill: ${skill}`);
    } else {
      setVoiceFeedback(`❌ Skill "${skill}" not found`);
    }
  };

  // Field navigation
  const navigateToNextField = () => {
    const currentIndex = formFields.findIndex(field => field.id === activeField);
    const nextIndex = (currentIndex + 1) % formFields.length;
    setActiveField(formFields[nextIndex].id);
    setVoiceFeedback(`Moved to ${formFields[nextIndex].label}`);
  };

  const navigateToPreviousField = () => {
    const currentIndex = formFields.findIndex(field => field.id === activeField);
    const prevIndex = (currentIndex - 1 + formFields.length) % formFields.length;
    setActiveField(formFields[prevIndex].id);
    setVoiceFeedback(`Moved to ${formFields[prevIndex].label}`);
  };

  const handleFieldComplete = () => {
    if (activeField) {
      navigateToNextField();
    }
  };

  const clearActiveField = () => {
    if (activeField) {
      const field = formFields.find(f => f.id === activeField);
      if (field.type === 'tags') {
        updateFormData(field.section, activeField, []);
      } else {
        updateFormData(field.section, activeField, '');
      }
      setVoiceFeedback(`Cleared ${field.label}`);
    }
  };

  const updateFormData = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleSubmit = () => {
    setIsFormComplete(true);
    setVoiceFeedback('Form submitted successfully!');
  };

  const handleReset = () => {
    setFormData({
      personalInfo: { fullName: '', email: '', phone: '', birthDate: '' },
      preferences: { subscription: 'basic', notifications: true, language: 'english' },
      details: { bio: '', skills: [], experience: 'beginner', salary: 50000 },
      contact: { address: '', city: '', country: '', zipCode: '' }
    });
    setActiveField(null);
    setIsFormComplete(false);
    setVoiceFeedback('Form reset successfully');
  };

  // Check if a command is a global command (should not be entered into fields)
  const isGlobalCommand = (command) => {
    return globalCommands.some(cmd => 
      command.toLowerCase().includes(cmd.toLowerCase())
    );
  };

  // Voice recognition setup
  const initializeRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      console.error('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      recognitionRef.current._isRecognizing = true;
      setIsListening(true);
      setVoiceFeedback('🎤 Voice control activated' + 
        (activeField ? ` - Active: ${formFields.find(f => f.id === activeField)?.label}` : ' - Say "first field" to start'));
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        processVoiceCommand(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setVoiceFeedback('⚠️ Listening error - trying to recover...');
        setTimeout(() => {
          if (recognitionRef.current) {
            recognitionRef.current.start();
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      recognitionRef.current._isRecognizing = false;
      setTimeout(() => {
        if (recognitionRef.current && !recognitionRef.current._isRecognizing) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.warn("Restart blocked:", e.message);
          }
        }
      }, 300);
    };
  }, [activeField]);

  // Process voice commands
  const processVoiceCommand = (command) => {
    console.log('Raw command:', command);
    const normalizedCommand = command.toLowerCase().trim();
    console.log('Normalized command:', normalizedCommand);
    console.log('Active field before processing:', activeField);

    // Handle "go to" navigation first
    if (normalizedCommand.includes('go to')) {
      const fieldName = normalizedCommand.replace('go to', '').trim();
      console.log('Looking for field:', fieldName);
      
      const field = formFields.find(f => 
        f.label.toLowerCase().includes(fieldName) || 
        f.id.toLowerCase().includes(fieldName) ||
        fieldName.includes(f.label.toLowerCase()) ||
        fieldName.includes(f.id.toLowerCase())
      );
      
      if (field) {
        setActiveField(field.id);
        setVoiceFeedback(`✅ Navigated to ${field.label}. You can now speak your ${field.label.toLowerCase()}.`);
        return;
      } else {
        setVoiceFeedback(`❌ Field "${fieldName}" not found. Try "full name", "email", etc.`);
        return;
      }
    }

    // Handle direct field navigation
    const fieldNavigationMap = {
      'full name': 'fullName',
      'name': 'fullName',
      'email': 'email',
      'phone': 'phone',
      'birth date': 'birthDate',
      'birthday': 'birthDate',
      'date of birth': 'birthDate',
      'subscription': 'subscription',
      'notifications': 'notifications',
      'language': 'language',
      'bio': 'bio',
      'skills': 'skills',
      'experience': 'experience',
      'salary': 'salary',
      'address': 'address',
      'city': 'city',
      'country': 'country',
      'zip code': 'zipCode',
      'zip': 'zipCode'
    };

    // Check for direct field navigation
    for (const [voiceCommand, fieldId] of Object.entries(fieldNavigationMap)) {
      if (normalizedCommand === voiceCommand || normalizedCommand.includes(voiceCommand)) {
        setActiveField(fieldId);
        const field = formFields.find(f => f.id === fieldId);
        setVoiceFeedback(`✅ Navigated to ${field.label}. You can now speak your ${field.label.toLowerCase()}.`);
        return;
      }
    }

    // Handle navigation commands
    if (normalizedCommand === 'first field' || normalizedCommand === 'start') {
      setActiveField(formFields[0].id);
      setVoiceFeedback(`✅ Started at ${formFields[0].label}. Speak your ${formFields[0].label.toLowerCase()}.`);
      return;
    }

    if (normalizedCommand === 'next field') {
      navigateToNextField();
      return;
    }

    if (normalizedCommand === 'previous field') {
      navigateToPreviousField();
      return;
    }

    // Handle "done" command
    if (normalizedCommand === 'done' || normalizedCommand === 'do one' || normalizedCommand === 'do on') {
      if (activeField) {
        const field = formFields.find(f => f.id === activeField);
        setVoiceFeedback(`✅ Moving to next field from ${field.label}`);
        navigateToNextField();
      } else {
        setVoiceFeedback('❌ No active field. Say "first field" or "go to [field name]" to start.');
      }
      return;
    }

    if (isGlobalCommand(normalizedCommand)) {
      for (const [key, action] of Object.entries(voiceCommands)) {
        if (normalizedCommand.includes(key)) {
          action();
          return;
        }
      }
    }

    if (normalizedCommand.includes(' done') || normalizedCommand.endsWith(' done')) {
      const inputText = command.replace(/ done/gi, '').trim();
      console.log('Input text from combined command:', inputText);
      
      if (inputText && activeField) {
        const field = formFields.find(f => f.id === activeField);
        updateFormData(field.section, activeField, inputText);
        setVoiceFeedback(`✅ Updated ${field.label} with "${inputText}" and moving to next field`);
        navigateToNextField();
      } else if (inputText && !activeField) {
        setVoiceFeedback('❌ No active field. Say "first field" or click on a field to select it.');
      }
      return;
    }

    if (activeField && command.trim() && !isGlobalCommand(normalizedCommand)) {
      console.log('Auto-filling active field:', activeField, 'with:', command);
      const field = formFields.find(f => f.id === activeField);
      
      if (field) {
        if (field.type === 'tags') {
          addSkill(command);
        } else if (field.id === 'birthDate') {
          updateFormData(field.section, activeField, command);
          setVoiceFeedback(`✅ Updated ${field.label} with "${command}". Say "done" to continue.`);
        } else {
          updateFormData(field.section, activeField, command);
          setVoiceFeedback(`✅ Updated ${field.label} with "${command}". Say "done" to continue.`);
        }
      }
      return;
    }

    if (!activeField && command.trim()) {
      setVoiceFeedback('❌ No field selected. Say "first field" or "go to full name" to start.');
      return;
    }

    for (const [key, action] of Object.entries(voiceCommands)) {
      if (normalizedCommand.includes(key)) {
        action();
        return;
      }
    }

    setVoiceFeedback(`❌ Command not recognized: "${command}". Say "first field" to start.`);
  };

  const startListening = async () => {
    if (recognitionRef.current && !isListening) {
      try {
        await setupAudioContext();
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start listening:', err);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current._isRecognizing=false;
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const setupAudioContext = async () => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true } 
      });
      
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (err) {
      console.error('Audio context error:', err);
    }
  };

  const setup = useCallback((p5, canvasParentRef) => {
    const existingCanvas = canvasParentRef.querySelector('canvas');
    if (existingCanvas) existingCanvas.remove();
    p5.createCanvas(400, 200).parent(canvasParentRef);
  }, []);

  const draw = useCallback((p5) => {
    p5.background(theme === 'dark' ? 30 : 240);
    
    if (analyserRef.current && isListening) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      p5.push();
      p5.stroke(theme === 'dark' ? [100, 200, 255] : [0, 100, 255]);
      p5.strokeWeight(2);
      p5.noFill();
      p5.beginShape();
      for (let i = 0; i < dataArray.length; i++) {
        const x = (i / dataArray.length) * p5.width;
        const y = p5.height / 2 + (dataArray[i] / 255) * 80 - 40;
        p5.vertex(x, y);
      }
      p5.endShape();
      p5.pop();

      if (activeField) {
        const field = formFields.find(f => f.id === activeField);
        p5.fill(theme === 'dark' ? 255 : 0);
        p5.textSize(14);
        p5.textAlign(p5.CENTER);
        p5.text(`Speaking to: ${field.label}`, p5.width / 2, 30);
      }
    }

    const filledFields = formFields.filter(field => {
      const value = formData[field.section][field.id];
      return value && (Array.isArray(value) ? value.length > 0 : value.toString().length > 0);
    }).length;
    const progress = filledFields / formFields.length;

    p5.fill(theme === 'dark' ? 100 : 200);
    p5.rect(50, p5.height - 30, p5.width - 100, 10, 5);
    p5.fill(76, 175, 80);
    p5.rect(50, p5.height - 30, (p5.width - 100) * progress, 10, 5);
    
    p5.fill(theme === 'dark' ? 255 : 0);
    p5.textSize(12);
    p5.textAlign(p5.CENTER);
    p5.text(`Progress: ${Math.round(progress * 100)}%`, p5.width / 2, p5.height - 40);
  }, [isListening, activeField, formData, theme]);

  useEffect(() => {
    initializeRecognition();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [initializeRecognition]);

  const currentTheme = themes[theme];

  // Render different input types
  const renderField = (field) => {
    const value = formData[field.section][field.id];
    const isActive = activeField === field.id;

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => updateFormData(field.section, field.id, e.target.value)}
            className={`w-full p-3 rounded-lg border-2 ${currentTheme.input} ${
              isActive ? 'ring-2 ring-blue-500' : ''
            }`}
            placeholder={field.placeholder}
            rows="3"
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => updateFormData(field.section, field.id, e.target.value)}
            className={`w-full p-3 rounded-lg border-2 ${currentTheme.input} ${
              isActive ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            {field.options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'toggle':
        return (
          <button
            onClick={() => updateFormData(field.section, field.id, !value)}
            className={`p-3 rounded-lg border-2 transition-colors ${
              value 
                ? 'bg-green-500 border-green-600 text-white' 
                : 'bg-gray-300 border-gray-400 text-gray-700'
            } ${isActive ? 'ring-2 ring-blue-500' : ''}`}
          >
            {value ? 'Enabled' : 'Disabled'}
          </button>
        );

      case 'radio':
        return (
          <div className="flex gap-4 flex-wrap">
            {field.options.map(option => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={value === option}
                  onChange={() => updateFormData(field.section, field.id, option)}
                  className="w-4 h-4"
                />
                <span className={currentTheme.textSecondary}>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
              </label>
            ))}
          </div>
        );

      case 'tags':
        return (
          <div className={`p-3 rounded-lg border-2 ${currentTheme.input} ${
            isActive ? 'ring-2 ring-blue-500' : ''
          }`}>
            <div className="flex flex-wrap gap-2 mb-2">
              {value.map((skill, index) => (
                <span key={index} className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm">
                  {skill}
                  <button
                    onClick={() => removeSkill(skill)}
                    className="ml-2 text-xs hover:text-red-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add skills with voice command 'add skill [skill name]'"
              className={`w-full p-2 rounded border ${currentTheme.input}`}
              readOnly
            />
          </div>
        );

      case 'slider':
        return (
          <div className="space-y-2">
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              value={value}
              onChange={(e) => updateFormData(field.section, field.id, parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-center font-semibold">
              ${value.toLocaleString()}
            </div>
          </div>
        );

      case 'range':
        return (
          <div className="flex gap-4 flex-wrap">
            {field.options.map(option => (
              <button
                key={option}
                onClick={() => updateFormData(field.section, field.id, option)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  value === option 
                    ? 'bg-blue-500 text-white border-blue-600' 
                    : `${currentTheme.border} ${currentTheme.textSecondary}`
                }`}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        );

      default:
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => updateFormData(field.section, field.id, e.target.value)}
            className={`w-full p-3 rounded-lg border-2 ${currentTheme.input} ${
              isActive ? 'ring-2 ring-blue-500' : ''
            }`}
            placeholder={field.placeholder}
          />
        );
    }
  };

  if (isFormComplete) {
    return (
      <div className={`min-h-screen ${currentTheme.bg} ${currentTheme.text} p-6`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className={`rounded-xl p-8 ${currentTheme.card} border ${currentTheme.border} shadow-lg`}>
            <h2 className="text-3xl font-bold mb-4">🎉 Form Submitted Successfully!</h2>
            <p className="text-lg mb-6">Thank you for completing the voice-controlled form.</p>
            <button
              onClick={handleReset}
              className={`px-6 py-3 rounded-lg ${currentTheme.button} transition-colors`}
            >
              Fill Another Form
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${currentTheme.bg} ${currentTheme.text} p-6 transition-colors duration-300`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">🎤 Voice Controlled Form</h1>
          <p className={`text-lg ${currentTheme.textSecondary}`}>
            Fill out the form using voice commands. Say "next field", "done", or specific values.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Voice Control */}
          <div className="space-y-6">
            {/* Voice Control Card */}
            <div className={`rounded-xl p-6 border ${currentTheme.border} ${currentTheme.card}`}>
              <h3 className="text-lg font-semibold mb-4">🎤 Voice Control</h3>
              
              <button 
                onClick={toggleListening}
                className={`w-full p-4 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                  isListening 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isListening ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    Stop Listening
                  </div>
                ) : (
                  'Start Voice Control'
                )}
              </button>

              {/* Theme Toggle */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex-1 p-2 rounded-lg border transition-colors ${
                    theme === 'light' 
                      ? 'bg-blue-500 text-white border-blue-500' 
                      : currentTheme.border
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex-1 p-2 rounded-lg border transition-colors ${
                    theme === 'dark' 
                      ? 'bg-blue-500 text-white border-blue-500' 
                      : currentTheme.border
                  }`}
                >
                  Dark
                </button>
              </div>

              {voiceFeedback && (
                <div className="mt-4 p-3 bg-blue-500/20 rounded-lg border border-blue-500">
                  <p className="text-sm">{voiceFeedback}</p>
                </div>
              )}

              {transcript && (
                <div className="mt-4 p-3 bg-purple-500/20 rounded-lg border border-purple-500">
                  <p className="text-sm">Heard: "{transcript}"</p>
                </div>
              )}

              {activeField && (
                <div className="mt-4 p-3 bg-green-500/20 rounded-lg border border-green-500">
                  <p className="text-sm font-semibold">
                    Active: {formFields.find(f => f.id === activeField)?.label}
                  </p>
                  <p className="text-xs mt-1">
                    {formFields.find(f => f.id === activeField)?.voiceHint}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Commands */}
            <div className={`rounded-xl p-6 border ${currentTheme.border} ${currentTheme.card}`}>
              <h3 className="text-lg font-semibold mb-4">🚀 Voice Commands</h3>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'next field', 'previous field', 'done', 'go to',
                    'dark mode', 'light mode', 'submit form', 'reset form'
                  ].map(cmd => (
                    <button
                      key={cmd}
                      onClick={() => processVoiceCommand(cmd)}
                      className={`p-2 rounded border text-xs ${currentTheme.border} hover:bg-blue-500 hover:text-white transition-colors`}
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Form Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Visualization */}
            <div className={`rounded-xl p-6 border ${currentTheme.border} ${currentTheme.card}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">📊 Voice Input Visualization</h3>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-sm">{isListening ? 'Listening...' : 'Voice Off'}</span>
                </div>
              </div>
              <div className="border-2 border-dashed border-gray-400 rounded-lg overflow-hidden">
                <Sketch setup={setup} draw={draw} />
              </div>
            </div>

            {/* Form Sections */}
            {['personalInfo', 'preferences', 'details', 'contact'].map(section => {
              const sectionFields = formFields.filter(field => field.section === section);
              const sectionTitle = section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

              return (
                <div key={section} className={`rounded-xl p-6 border ${currentTheme.border} ${currentTheme.card}`}>
                  <h3 className="text-xl font-semibold mb-6">{sectionTitle}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sectionFields.map(field => (
                      <div key={field.id} className="space-y-2">
                        <label className="block font-medium">
                          {field.label}
                          {activeField === field.id && (
                            <span className="ml-2 text-green-500 text-sm">● Active</span>
                          )}
                        </label>
                        
                        <div 
                          onClick={() => setActiveField(field.id)}
                          className="cursor-pointer"
                        >
                          {renderField(field)}
                        </div>
                        
                        <p className="text-xs text-gray-500">
                          Voice: {field.voiceHint}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Form Actions */}
            <div className={`rounded-xl p-6 border ${currentTheme.border} ${currentTheme.card}`}>
              <div className="flex gap-4">
                <button
                  onClick={handleSubmit}
                  className={`flex-1 p-4 rounded-lg font-semibold transition-colors ${
                    currentTheme.button
                  }`}
                >
                  Submit Form
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 p-4 rounded-lg font-semibold bg-gray-500 text-white hover:bg-gray-600 transition-colors"
                >
                  Reset Form
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceControlledForm;