import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';

import Home from './components/Home';
import Tutoriales from './components/Tutoriales';
import TutorialHijo from './components/Tutorialhijo';

function App() {
  return (
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/t" element={<Tutoriales />} />
      </Routes>
  
  );
}

export default App;
