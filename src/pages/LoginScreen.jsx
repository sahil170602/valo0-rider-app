import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Phone, ArrowRight, AlertCircle, User, Calendar, CheckCircle2, UploadCloud, Clock, Camera, FileCheck, XCircle, MapPin, Bell, HardDrive, ShieldAlert } from 'lucide-react';

export default function LoginScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadStatus, setUploadStatus] = useState(''); 
  
  // Flow States: 'mobile' -> 'details' -> 'documents' -> 'verification' -> 'rejected'
  const [step, setStep] = useState('mobile');

  // Permission Gateway States
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permError, setPermError] = useState('');
  const [permStatus, setPermStatus] = useState({
    location: 'pending',
    notification: 'pending',
    storage: 'granted' // Auto-granted because they successfully attached files via the browser
  });

  // Form Data
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');

  // Document Files
  const [docs, setDocs] = useState({
    aadharFront: null,
    aadharBack: null,
    panCard: null,
    drivingLicense: null,
    selfie: null
  });

  // --- 1. Check Mobile & Route ---
  const handleCheckMobile = async (e) => {
    e.preventDefault();
    if (mobile.length < 10) return setErrorMsg('Enter a valid 10-digit number.');

    try {
      setLoading(true);
      setErrorMsg('');

      const { data: rider } = await supabase.from('riders').select('*').eq('mobile', mobile).maybeSingle();

      if (rider) {
        if (rider.status === 'pending') {
          setStep('verification');
        } else if (rider.status === 'rejected') {
          setStep('rejected');
        } else {
          localStorage.setItem('valo_rider', JSON.stringify({ id: rider.id, name: rider.name, mobile: rider.mobile }));
          window.location.href = '/dashboard';
        }
      } else {
        setStep('details');
      }
    } catch (err) {
      setErrorMsg('Network error checking mobile number.');
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Details -> Documents ---
  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    if (!name || !gender || !age) return setErrorMsg('Please fill all details.');
    setStep('documents');
    setErrorMsg('');
  };

  // --- 3. Upload File Handler ---
  const handleFileChange = (e, key) => {
    if (e.target.files[0]) {
      setDocs(prev => ({ ...prev, [key]: e.target.files[0] }));
    }
  };

  const uploadToSupabase = async (file, folder) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}_${Date.now()}.${fileExt}`;
    const filePath = `${mobile}/${fileName}`;
    const { error } = await supabase.storage.from('rider_documents').upload(filePath, file);
    if (error) throw error;
    const { data } = supabase.storage.from('rider_documents').getPublicUrl(filePath);
    return data.publicUrl;
  };

  // --- 4. PRE-FLIGHT CHECK (Open Permission Gateway) ---
  const triggerPermissionGateway = (e) => {
    e.preventDefault();
    if (!docs.aadharFront || !docs.aadharBack || !docs.panCard || !docs.drivingLicense || !docs.selfie) {
      return setErrorMsg('Please upload all required documents.');
    }
    setErrorMsg('');
    setPermError('');
    setShowPermissionModal(true); // Open the permissions popup instead of submitting directly
  };

  // --- 5. REQUEST PERMISSIONS & FINALIZE SUBMISSION ---
  const requestPermissionsAndSubmit = async () => {
    setLoading(true);
    setPermError('');
    
    let notifGranted = false;
    let locGranted = false;

    try {
      // 1. Request Notifications (Works in Safari PWA, Chrome, Android)
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        notifGranted = permission === 'granted';
        setPermStatus(prev => ({ ...prev, notification: notifGranted ? 'granted' : 'denied' }));
      } else {
        notifGranted = true; // Fallback if browser doesn't support the API
      }

      // 2. Request Location GPS
      if ('geolocation' in navigator) {
        try {
          await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
          });
          locGranted = true;
          setPermStatus(prev => ({ ...prev, location: 'granted' }));
        } catch (e) {
          locGranted = false;
          setPermStatus(prev => ({ ...prev, location: 'denied' }));
        }
      } else {
        locGranted = true;
      }

      // 3. Evaluate Results
      if (notifGranted && locGranted) {
        // PERMISSIONS APPROVED: Close modal and execute final upload!
        setShowPermissionModal(false);
        await executeFinalUploadAndSave();
      } else {
        setPermError('Location and Notifications are strictly required. Please allow them in your browser/device settings.');
        setLoading(false);
      }

    } catch (err) {
      setPermError('Permission request failed or was blocked by your device settings.');
      setLoading(false);
    }
  };

  // --- 6. CORE UPLOAD & DB INSERT LOGIC ---
  const executeFinalUploadAndSave = async () => {
    try {
      setLoading(true);
      setUploadStatus('Uploading Aadhar Front...');
      const aadhar_front = await uploadToSupabase(docs.aadharFront, 'aadhar_front');
      
      setUploadStatus('Uploading Aadhar Back...');
      const aadhar_back = await uploadToSupabase(docs.aadharBack, 'aadhar_back');
      
      setUploadStatus('Uploading PAN Card...');
      const pan_card = await uploadToSupabase(docs.panCard, 'pan');
      
      setUploadStatus('Uploading Driving License...');
      const driving_license = await uploadToSupabase(docs.drivingLicense, 'dl');
      
      setUploadStatus('Uploading Selfie...');
      const selfie = await uploadToSupabase(docs.selfie, 'selfie');

      setUploadStatus('Finalizing Profile...');

      // Insert Rider into DB
      const { data: newRider, error } = await supabase.from('riders').insert([{
        mobile, name, gender, age: parseInt(age),
        aadhar_front, aadhar_back, pan_card, driving_license, selfie,
        status: 'pending'
      }]).select().single();

      if (error) throw error;

      // Send Notification to Rider Panel
      await supabase.from('notifications').insert({
        user_id: newRider.id,
        title: '📋 Documents Submitted',
        message: 'Your documents have been received and are under verification.',
        type: 'success'
      });

      setStep('verification');
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to upload documents. Please try again.');
    } finally {
      setLoading(false);
      setUploadStatus('');
    }
  };

  // Reusable UI File Button Component
  const FileUploadBtn = ({ label, fileKey, icon: Icon = UploadCloud }) => {
    const file = docs[fileKey];
    const previewUrl = file ? URL.createObjectURL(file) : null;

    return (
      <label className={`relative flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.98] mt-2 overflow-hidden ${
        file ? 'border-green-400 bg-green-50 shadow-sm' : 'border-dashed border-gray-200 bg-white hover:bg-gray-50'
      }`}>
        {previewUrl && (
          <div className="absolute inset-0 opacity-10">
            <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex items-center gap-3 relative z-10">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm transition-colors ${
            file ? 'bg-green-500 text-white' : 'bg-[#F4F0FF] text-[#6C2BFF]'
          }`}>
            {file ? <CheckCircle2 size={22} /> : <Icon size={22} />}
          </div>
          <div>
            <p className={`text-sm font-black ${file ? 'text-green-800' : 'text-gray-900'}`}>{label}</p>
            <p className={`text-[10px] font-bold ${file ? 'text-green-600' : 'text-gray-400'}`}>
              {file ? 'Tap to change photo' : 'Upload from Camera/Files'}
            </p>
          </div>
        </div>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, fileKey)} />
      </label>
    );
  };

  return (
    <div className="h-[100dvh] bg-[#F8F7FC] font-sans flex flex-col items-center justify-center p-6 overflow-hidden relative">
      <div className="absolute top-[-20%] left-[-20%] w-[80%] aspect-square bg-[#6C2BFF]/10 rounded-full blur-3xl"></div>

      <div className="w-full max-w-sm z-10 flex flex-col h-full justify-center py-6">
        
        {/* App Logo */}
        {step !== 'documents' && (
          <div className="text-center mb-6 shrink-0">
            <div className="w-20 h-20 mx-auto bg-white rounded-2xl shadow-lg p-1.5 mb-3">
              <img src="/riderapp.png" alt="Valo Rider" className="w-full h-full object-cover rounded-xl" />
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Valo Rider</h2>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 flex gap-2 text-xs font-bold text-red-600 shrink-0">
            <AlertCircle size={16} className="shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* STEP 1: MOBILE */}
        {step === 'mobile' && (
          <form onSubmit={handleCheckMobile} className="bg-white p-5 rounded-[28px] shadow-xl shadow-gray-200/50 border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="relative mb-4">
              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="tel" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} placeholder="Enter Mobile Number" className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 text-sm font-black focus:border-[#6C2BFF]/50 outline-none" />
            </div>
            <button type="submit" disabled={loading} className="w-full h-14 bg-[#6C2BFF] text-white font-black text-sm rounded-2xl shadow-lg shadow-[#6C2BFF]/20 flex items-center justify-center gap-2 active:scale-95 transition-all">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Continue'}
            </button>
          </form>
        )}

        {/* STEP 2: BASIC DETAILS */}
        {step === 'details' && (
          <form onSubmit={handleDetailsSubmit} className="bg-white p-5 rounded-[28px] shadow-xl shadow-gray-200/50 border border-gray-100 animate-in fade-in slide-in-from-right-8 space-y-4">
            <h3 className="text-lg font-black text-gray-900 text-center mb-2">Create Profile</h3>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter Full Name" className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 text-sm font-bold focus:border-[#6C2BFF]/50 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="h-14 bg-gray-50 border border-gray-100 rounded-2xl px-4 text-sm font-bold text-gray-700 outline-none focus:border-[#6C2BFF]/50 appearance-none">
                <option value="" disabled>Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <div className="relative">
                <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" maxLength={2} value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} placeholder="Age" className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 text-sm font-bold focus:border-[#6C2BFF]/50 outline-none" />
              </div>
            </div>
            <button type="submit" className="w-full h-14 bg-[#6C2BFF] text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              Next Step <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* STEP 3: DOCUMENT UPLOADS */}
        {step === 'documents' && (
          <div className="bg-white p-5 rounded-[28px] shadow-xl shadow-gray-200/50 border border-gray-100 animate-in fade-in slide-in-from-right-8 h-[80vh] flex flex-col mt-4">
            <h3 className="text-xl font-black text-gray-900 mb-1">Verify Identity</h3>
            <p className="text-xs font-bold text-gray-400 mb-5 shrink-0">Upload clear photos of your documents to complete registration.</p>
            
            <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-4 pb-4">
              
              <div className="bg-gray-50/50 p-4 rounded-[20px] border border-gray-100">
                <p className="text-sm font-black text-gray-900">Aadhaar Card</p>
                <p className="text-[10px] text-gray-500 font-bold mb-2">Ensure all details are clearly visible.</p>
                <FileUploadBtn label="Front Side" fileKey="aadharFront" />
                <FileUploadBtn label="Back Side" fileKey="aadharBack" />
              </div>

              <div className="bg-gray-50/50 p-4 rounded-[20px] border border-gray-100">
                <p className="text-sm font-black text-gray-900">PAN Card</p>
                <FileUploadBtn label="Upload PAN Card" fileKey="panCard" icon={FileCheck} />
              </div>

              <div className="bg-gray-50/50 p-4 rounded-[20px] border border-gray-100">
                <p className="text-sm font-black text-gray-900">Driving License</p>
                <FileUploadBtn label="Upload License" fileKey="drivingLicense" icon={FileCheck} />
              </div>

              <div className="bg-gray-50/50 p-4 rounded-[20px] border border-gray-100">
                <p className="text-sm font-black text-gray-900">Live Selfie</p>
                <FileUploadBtn label="Take a Selfie" fileKey="selfie" icon={Camera} />
              </div>

            </div>

            <button onClick={triggerPermissionGateway} disabled={loading} className="w-full h-14 shrink-0 bg-gray-900 hover:bg-black text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all mt-4">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="text-xs">{uploadStatus || 'Processing...'}</span>
                </div>
              ) : 'Submit for Verification'}
            </button>
          </div>
        )}

        {/* STEP 4: PENDING VERIFICATION */}
        {step === 'verification' && (
          <div className="bg-white p-8 rounded-[32px] shadow-xl shadow-gray-200/50 border border-gray-100 text-center animate-in zoom-in shrink-0">
            <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-5">
              <Clock size={36} className="animate-pulse" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Verification in Progress</h3>
            <p className="text-sm font-bold text-gray-400 leading-relaxed">
              Your documents have been submitted securely. Our team is reviewing your profile.
            </p>
            <div className="mt-6 py-3 bg-gray-50 rounded-xl border border-gray-100 text-xs font-black text-gray-500">
              Expected Approval: Up to 24 Hours
            </div>
          </div>
        )}

        {/* STEP 5: REJECTED */}
        {step === 'rejected' && (
          <div className="bg-white p-8 rounded-[32px] shadow-xl shadow-red-200/50 border border-red-100 text-center animate-in zoom-in shrink-0">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5">
              <XCircle size={36} />
            </div>
            <h3 className="text-xl font-black text-red-600 mb-2">Application Not Approved</h3>
            <p className="text-sm font-bold text-gray-600 leading-relaxed">
              Unfortunately, your profile verification was declined by team. Please contact support.
            </p>
          </div>
        )}

      </div>

      {/* 🚀 PERMISSION GATEWAY MODAL (Pops up before finalizing submission) */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 pb-10 sm:pb-6 shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden"></div>
            
            <h3 className="text-xl font-black text-gray-900 mb-2">App Permissions Required</h3>
            <p className="text-sm font-bold text-gray-500 mb-6 leading-relaxed">
              To operate as a Valo Rider and receive orders, please allow the following device access.
            </p>

            {permError && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 flex gap-2 text-xs font-bold text-red-600">
                <ShieldAlert size={16} className="shrink-0" />
                <p>{permError}</p>
              </div>
            )}

            <div className="space-y-3 mb-8">
              {/* Location Row */}
              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${permStatus.location === 'denied' ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-500'}`}>
                  <MapPin size={18} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-gray-900">Live GPS Location</h4>
                  <p className="text-[10px] font-bold text-gray-400">Required for active order dispatch.</p>
                </div>
              </div>

              {/* Notification Row */}
              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${permStatus.notification === 'denied' ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-amber-500'}`}>
                  <Bell size={18} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-gray-900">Push Notifications</h4>
                  <p className="text-[10px] font-bold text-gray-400">Required to receive incoming order alerts.</p>
                </div>
              </div>

              {/* Storage Row (Auto-granted) */}
              <div className="flex items-center gap-4 bg-green-50 p-4 rounded-2xl border border-green-100">
                <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-green-900">Storage & Camera</h4>
                  <p className="text-[10px] font-bold text-green-700">Access granted for document uploads.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowPermissionModal(false)} className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black text-sm rounded-2xl transition-colors">
                Cancel
              </button>
              <button 
                onClick={requestPermissionsAndSubmit} 
                disabled={loading}
                className="flex-1 bg-[#6C2BFF] text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-[#6C2BFF]/20"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Allow Access & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}