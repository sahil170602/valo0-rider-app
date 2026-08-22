import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SplashScreen from './pages/SplashScreen';
import LoginScreen from './pages/LoginScreen';
import RiderDashboard from './pages/RiderDashboard';
import NotificationsScreen from './pages/NotificationsScreen';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('valo_rider');
  });

  useEffect(() => {
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
        
        <Route 
          path="/" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginScreen />} 
        />

        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <RiderDashboard /> : <Navigate to="/" replace />} 
        />

        {/* 🌟 New Route for Notifications Screen */}
        <Route 
          path="/notifications" 
          element={isAuthenticated ? <NotificationsScreen /> : <Navigate to="/" replace />} 
        />

        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}