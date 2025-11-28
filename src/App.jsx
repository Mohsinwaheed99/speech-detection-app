import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './component/Layout';
import VoiceDetection from './component/VoiceDetection';
import VoiceControlledForm from './component/VoiceControlledForm';
import VoiceVerification from './component/VoiceMatch';

function App() {
  const [theme, setTheme] = useState('dark');

  return (
    <Router>
      <Layout theme={theme} setTheme={setTheme}>
        <Routes>
          <Route path="/" element={<VoiceDetection theme={theme} setTheme={setTheme} />} />
          <Route path="/voice-form" element={<VoiceControlledForm theme={theme} setTheme={setTheme} />} />
          <Route path="/voice-verification" element={<VoiceVerification theme={theme} setTheme={setTheme} />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;