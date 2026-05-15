import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Phone, ArrowRight, AlertCircle, User, Mail, Calendar, HelpCircle } from 'lucide-react';

export default function LoginScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // STEPPER STATE: 'mobile' (Lookup Phase) or 'register' (Collection Phase)
  const [step, setStep] = useState('mobile');

  // Input Collection Hooks
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');

  // --- Phase 1: Verify Mobile Number Existence ---
  const handleCheckMobile = async (e) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      const { data: rider, error } = await supabase
        .from('riders')
        .select('*')
        .eq('mobile', mobile.trim())
        .maybeSingle(); // Gracefully handle 0 results without errors

      if (rider) {
        // EXISTING USER MATCH: Save metrics data cache & route directly to console
        await supabase.from('riders').update({ status: 'online' }).eq('id', rider.id);
        
        localStorage.setItem('valo_rider', JSON.stringify({
          id: rider.id,
          name: rider.name,
          mobile: rider.mobile
        }));

        window.location.href = '/dashboard';
      } else {
        // NEW USER FLOW: Advance directly to profile generation sheet card step
        setStep('register');
      }
    } catch (err) {
      console.error('Lookup processing breakdown loop error:', err.message);
      setErrorMsg('Network anomaly error. Check database access keys logs.');
    } finally {
      setLoading(false);
    }
  };

  // --- Phase 2: Register New Profile Row ---
  const handleRegisterProfile = async (e) => {
    e.preventDefault();
    if (!name || !email || !gender || !age) {
      setErrorMsg('Please complete all profile details to continue.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      const newRiderPayload = {
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim().toLowerCase(),
        gender: gender,
        age: parseInt(age, 10),
        status: 'online'
      };

      const { data: insertedRider, error } = await supabase
        .from('riders')
        .insert([newRiderPayload])
        .select()
        .single();

      if (error) throw error;

      // Registration Confirmed: Save tracking metrics token parameters to cache memory
      localStorage.setItem('valo_rider', JSON.stringify({
        id: insertedRider.id,
        name: insertedRider.name,
        mobile: insertedRider.mobile
      }));

      window.location.href = '/dashboard';

    } catch (err) {
      console.error('Registration entry write error loop:', err.message);
      setErrorMsg(err.message.includes('unique') ? 'Email or number already used.' : 'Failed to register account profile logs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] bg-[#F8F7FC] font-sans flex flex-col justify-between p-6 overflow-hidden relative">
      
      {/* Decorative ambient backdrop rings */}
      <div className="absolute top-[-20%] left-[-20%] w-[80%] aspect-square bg-[#6C2BFF]/5 rounded-full blur-3xl"></div>

      {/* Top Header Section */}
      <div className="pt-12 px-2">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none">
          {step === 'mobile' ? 'Valo Rider' : 'Create Profile'}
        </h2>
        <p className="text-sm font-semibold text-gray-400 mt-2.5 leading-snug">
          {step === 'mobile' 
            ? 'Enter your mobile number to access your terminal workspace dashboard logs.' 
            : 'Welcome to the team! Provide your identity profile metadata details below.'
          }
        </p>
      </div>

      {/* Center Form Sheets Matrix Box container */}
      <div className="w-full max-w-sm mx-auto my-auto space-y-4">
        
        {errorMsg && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-2.5 text-xs font-bold text-red-600 animate-in fade-in duration-200">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="leading-tight">{errorMsg}</p>
          </div>
        )}

        {/* STEP A: ENTER PHONE CARD DISPLAY SCREEN LINK */}
        {step === 'mobile' ? (
          <form onSubmit={handleCheckMobile} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-900 font-bold text-sm select-none flex items-center gap-1.5">
                <Phone size={16} />
                <span>+91</span>
                <span className="text-gray-200">|</span>
              </div>
              <input 
                type="tel"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter Mobile Number"
                className="w-full h-14 bg-white border border-gray-400 rounded-2xl pl-20 pr-4 text-sm font-bold text-gray-800 placeholder:text-gray-500 outline-none focus:border-[#6C2BFF]/30 shadow-sm transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || mobile.length < 10}
              className="w-full h-14 bg-[#6C2BFF] text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-[#6C2BFF]/15 active:scale-[0.99] transition-all disabled:bg-gray-200 disabled:shadow-none"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Verify Number</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        ) : (
          
          /* STEP B: REGISTRATION ACCOUNT DATA COLLECTION SHEET SCREEN LINK */
          <form onSubmit={handleRegisterProfile} className="space-y-3.5 max-h-[60dvh] overflow-y-auto p-1 no-scrollbar animate-in fade-in slide-in-from-right-4 duration-300">
            
            {/* Input 1: Driver Full Name */}
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="w-full h-13 bg-white border border-gray-100 rounded-2xl pl-12 pr-4 text-xs font-bold text-gray-800 placeholder:text-gray-300 outline-none focus:border-[#6C2BFF]/30 shadow-sm"
              />
            </div>

            {/* Input 2: Communication Email string */}
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="w-full h-13 bg-white border border-gray-100 rounded-2xl pl-12 pr-4 text-xs font-bold text-gray-800 placeholder:text-gray-300 outline-none focus:border-[#6C2BFF]/30 shadow-sm"
              />
            </div>

            {/* Twin Row Selector Grid maps: Gender Options & Numeric Age fields */}
            <div className="grid grid-cols-2 gap-3">
              {/* Dropdown Options select layout */}
              <div className="relative">
                <HelpCircle size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full h-13 bg-white border border-gray-100 rounded-2xl pl-12 pr-4 text-xs font-bold text-gray-800 placeholder:text-gray-300 outline-none focus:border-[#6C2BFF]/30 shadow-sm appearance-none cursor-pointer"
                >
                  <option value="" disabled>Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Driver Numeric Age input text wrapper field */}
              <div className="relative">
                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="tel"
                  maxLength={2}
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))}
                  placeholder="Age"
                  className="w-full h-13 bg-white border border-gray-100 rounded-2xl pl-12 pr-4 text-xs font-bold text-gray-800 placeholder:text-gray-300 outline-none focus:border-[#6C2BFF]/30 shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-[#6C2BFF] text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-[#6C2BFF]/15 active:scale-[0.99] transition-all disabled:bg-gray-200"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Create Account & Go Online</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Static system layout notice parameters description footer info blocks */}
      <div className="text-center pb-[calc(0.5rem+env(safe-area-inset-bottom))] shrink-0">
        <p className="text-[10px] font-bold text-gray-400 max-w-[240px] mx-auto leading-relaxed">
          Security keys protocols powered by dynamic tracking ledgers.
        </p>
      </div>

    </div>
  );
}