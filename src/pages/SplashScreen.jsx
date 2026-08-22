import { useEffect } from 'react';

export default function SplashScreen() {
  return (
    <div className="h-[100dvh] bg-[#F8F7FC] flex flex-col items-center justify-center font-sans p-6 relative overflow-hidden">
      
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[80%] aspect-square bg-[#6C2BFF]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[80%] aspect-square bg-[#6C2BFF]/10 rounded-full blur-3xl"></div>

      {/* Central Branding Elements */}
      <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-700 z-10">
        
        {/* 🌟 NEW: High-Quality 3D App Icon */}
        <div className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-[32px] md:rounded-[40px] p-2 shadow-2xl shadow-gray-200/80 mb-6 relative animate-pulse-slow">
          <img 
            src="/riderapp.png" 
            alt="Valo Rider" 
            className="w-full h-full object-cover rounded-[24px] md:rounded-[32px]"
          />
          {/* Inner premium border glare */}
          <div className="absolute inset-0 rounded-[32px] md:rounded-[40px] border-2 border-white/50 pointer-events-none"></div>
        </div>
        
        <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-1">
          VALO <span className="text-[#6C2BFF]">RIDER</span>
        </h1>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
          Delivery Partner
        </p>
      </div>

      {/* System Status Indicators at bottom */}
      <div className="absolute bottom-12 flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-[3px] border-gray-200 border-t-[#6C2BFF] rounded-full animate-spin"></div>
        <p className="text-[10px] font-bold text-gray-400  tracking-wide animate-pulse">Loading App...</p>
      </div>

    </div>
  );
}