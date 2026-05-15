import { useEffect } from 'react';
import { Bike } from 'lucide-react';

export default function SplashScreen() {
  return (
    <div className="h-[100dvh] bg-[#F8F7FC] flex flex-col items-center justify-center font-sans p-6 relative overflow-hidden">
      
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[80%] aspect-square bg-[#6C2BFF]/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[80%] aspect-square bg-[#6C2BFF]/5 rounded-full blur-3xl"></div>

      {/* Central Branding Elements */}
      <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
        <div className="w-24 h-24 bg-[#6C2BFF] rounded-[32px] flex items-center justify-center text-white shadow-xl shadow-[#6C2BFF]/20 animate-pulse mb-4">
          <Bike size={44} strokeWidth={1.5} />
        </div>
        
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
          VALO <span className="text-[#6C2BFF]">RIDER</span>
        </h1>
       
      </div>

      {/* System Status Indicators at bottom */}
      <div className="absolute bottom-12 flex flex-col items-center gap-2">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-[#6C2BFF] rounded-full animate-spin"></div>
      </div>

    </div>
  );
}