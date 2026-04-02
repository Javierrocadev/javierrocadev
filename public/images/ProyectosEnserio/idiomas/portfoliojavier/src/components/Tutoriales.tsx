import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';

import TutorialHijo from './Tutorialhijo';

function Tutoriales() {
    return (
      <>
       <div>Tutoriales</div>
       <Routes>
        <Route path="/messages/:id" element={<TutorialHijo />} />
      </Routes>
      </>
    )
  }
  
  export default Tutoriales