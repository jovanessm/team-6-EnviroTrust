import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { ParkAnalysis } from './pages/ParkAnalysis';
import { Results } from './pages/Results';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/analyze" element={<ParkAnalysis />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
