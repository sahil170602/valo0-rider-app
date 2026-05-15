import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SplashScreen from './pages/SplashScreen';
import LoginScreen from './pages/LoginScreen';
import RiderDashboard from './pages/RiderDashboard';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  
  // Directly evaluate session state criteria inside initialization functions to drop flickering states
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('valo_rider');
  });

  useEffect(() => {
    // Hold the branding splash screen active for exactly 3 seconds before sliding open auth gates
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => clearTimeout(splashTimer);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        
        {/* Core Entry Gate: If user token is found inside device cache memory, pass straight to desk */}
        <Route 
          path="/" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginScreen />} 
        />

        {/* Dashboard Operational Console Router Link */}
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <RiderDashboard /> : <Navigate to="/" replace />} 
        />

        {/* Wildcard security fallback rule maps */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}