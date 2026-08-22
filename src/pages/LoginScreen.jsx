import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import OneSignal from 'react-onesignal';
import { 
  Bike, MapPin, Phone, Package, CheckCircle2, LogOut, Clock, 
  ShoppingBag, Navigation, Store, Wallet, Crosshair, QrCode, 
  Check, Bell, ChevronDown, ChevronUp, Map as MapIcon, Power,
  TrendingUp 
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF, DirectionsRenderer } from '@react-google-maps/api';

// ==========================================
// 🗺️ CUSTOM GOOGLE MAPS SVG ICONS
// ==========================================
const bikeIconSvg = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="18" fill="#6C2BFF" stroke="white" stroke-width="3" />
    <text x="20" y="25" font-size="18" text-anchor="middle" fill="white">🛵</text>
  </svg>
`);

const destIconSvg = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    <circle cx="17" cy="17" r="16" fill="#10B981" stroke="white" stroke-width="3" />
    <text x="17" y="22" font-size="14" text-anchor="middle" fill="white">📍</text>
  </svg>
`);

// ==========================================
// 🗺️ UNIFIED GOOGLE MAP COMPONENT
// ==========================================
const DynamicMap = ({ currentCoords, destCoords, isMapLoaded, recenter, setRecenter, showRoute = false }) => {
  const [mapRef, setMapRef] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);

  const centerCoord = useMemo(() => {
    return currentCoords ? { lat: Number(currentCoords.lat), lng: Number(currentCoords.lon) } : { lat: 21.4624, lng: 80.2201 };
  }, [currentCoords?.lat, currentCoords?.lon]);

  const destination = useMemo(() => {
    return destCoords ? { lat: Number(destCoords.lat), lng: Number(destCoords.lng || destCoords.lon) } : null;
  }, [destCoords?.lat, destCoords?.lon, destCoords?.lng]);

  const cLat = centerCoord.lat;
  const cLng = centerCoord.lng;
  const dLat = destination?.lat;
  const dLng = destination?.lng;

  useEffect(() => {
    if (!isMapLoaded || !window.google || !showRoute || !destination) return;
    
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      { 
        origin: { lat: cLat, lng: cLng }, 
        destination: { lat: dLat, lng: dLng }, 
        travelMode: window.google.maps.TravelMode.DRIVING 
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirectionsResponse(result);
        } else {
          setDirectionsResponse(null);
        }
      }
    );
  }, [isMapLoaded, showRoute, cLat, cLng, dLat, dLng]);

  useEffect(() => {
    if (recenter && mapRef) {
      mapRef.panTo({ lat: cLat, lng: cLng });
    }
  }, [recenter, mapRef, cLat, cLng]);

  if (!isMapLoaded) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 animate-pulse">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#6C2BFF] rounded-full animate-spin mb-3"></div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Calibrating GPS Uplink...</p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={centerCoord}
      zoom={16}
      options={{ disableDefaultUI: true, gestureHandling: 'greedy', zoomControl: false, mapId: "VALO_RIDER_MAP" }}
      onLoad={map => setMapRef(map)}
      onDragStart={() => setRecenter(false)}
    >
      {showRoute && directionsResponse ? (
        <DirectionsRenderer directions={directionsResponse} options={{ suppressMarkers: true, polylineOptions: { strokeColor: "#3B82F6", strokeWeight: 6, strokeOpacity: 0.9 } }} />
      ) : showRoute && destination ? (
        <PolylineF path={[centerCoord, destination]} options={{ strokeColor: "#3B82F6", strokeWeight: 5, strokeOpacity: 0.8 }} />
      ) : null}

      <MarkerF position={centerCoord} icon={{ url: bikeIconSvg, anchor: new window.google.maps.Point(20, 20) }} />

      {showRoute && destination && (
        <MarkerF position={destination} icon={{ url: destIconSvg, anchor: new window.google.maps.Point(17, 17) }} />
      )}
    </GoogleMap>
  );
};

// ==========================================
// 🚀 MAIN DASHBOARD COMPONENT
// ==========================================
export default function RiderDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [kitchens, setKitchens] = useState({}); 
  const [hotels, setHotels] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Rider State
  const [currentCoords, setCurrentCoords] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  
  // Local Flow State to persist across refreshes
  const [acknowledgedOrders, setAcknowledgedOrders] = useState(() => JSON.parse(localStorage.getItem('valo_ack_orders') || '[]'));
  const [riderStep, setRiderStep] = useState(() => localStorage.getItem('valo_rider_step') || 'nav_kitchen');
  
  // UI State
  const [recenter, setRecenter] = useState(true);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);

  const riderProfile = JSON.parse(localStorage.getItem('valo_rider')) || { id: null, name: "Guest Rider", mobile: "" };
  
  // 🌟 BULLETPROOF DUAL AUDIO ENGINE
  const alarmAudio = useRef(new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'));
  const defaultToneAudio = useRef(new Audio('https://actions.google.com/sounds/v1/ui/message_notification.ogg'));
  
  // 🌟 ONE-SIGNAL STRICT MODE TRACKER
  const isOneSignalInitialized = useRef(false);

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  // 🌟 INITIALIZE ONESIGNAL (RIDER APP)
  useEffect(() => {
    async function initOneSignal() {
      if (!riderProfile.id || isOneSignalInitialized.current) return;
      
      try {
        await OneSignal.init({
          appId: "340731c6-2da8-48e8-bad0-28cf7234928a", // Rider App ID
          allowLocalhostAsSecureOrigin: true,
          notifyButton: { enable: false } 
        });
        
        isOneSignalInitialized.current = true;
        OneSignal.Slidedown.promptPush();
        OneSignal.login(`rider_${riderProfile.id}`);
        
      } catch (error) {
        if (error && !error.message?.includes("already initialized")) {
          console.error("OneSignal Init Error:", error);
        }
      }
    }
    initOneSignal();
  }, [riderProfile.id]);

  // --- DATA FETCHING ---
  const fetchOrdersAndLocations = async (showLoader = false) => {
    if (!riderProfile.id) return;
    try {
      if (showLoader) setLoading(true);
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('rider_id', riderProfile.id)
        .order('created_at', { ascending: false });

      if (orderError) throw orderError;

      if (orderData && orderData.length > 0) {
        const uniqueKitchenIds = [...new Set(orderData.map(o => o.kitchen_id).filter(Boolean))];
        const uniqueHotelIds = [...new Set(orderData.map(o => o.hotel_id).filter(Boolean))];
        
        if (uniqueKitchenIds.length > 0) {
          const { data: kitchenData } = await supabase.from('kitchens').select('*').in('id', uniqueKitchenIds);
          if (kitchenData) {
            const kitchenMap = {};
            kitchenData.forEach(k => {
              kitchenMap[k.id] = { name: k.name || k.kitchen_name || 'Kitchen', address: k.address || k.location || '', lat: Number(k.latitude || k.lat || 21.4624), lon: Number(k.longitude || k.lng || 80.2201) }; 
            });
            setKitchens(kitchenMap);
          }
        }
        if (uniqueHotelIds.length > 0) {
          const { data: hotelData } = await supabase.from('hotels').select('*').in('id', uniqueHotelIds);
          if (hotelData) {
            const hotelMap = {};
            hotelData.forEach(h => {
              hotelMap[h.id] = { name: h.hotel_name || h.property_name || 'Hotel', address: h.address || h.location || '', lat: Number(h.latitude || h.lat || 21.4700), lon: Number(h.longitude || h.lng || 80.2300) }; 
            });
            setHotels(hotelMap);
          }
        }
      }
      setOrders(orderData || []);
    } catch (err) {
      console.error('Data sync error:', err.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    if (!riderProfile.id) return navigate('/');
    fetchOrdersAndLocations(true);
    const channel = supabase.channel('rider-live-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `rider_id=eq.${riderProfile.id}` }, () => {
        fetchOrdersAndLocations(false); 
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [navigate, riderProfile.id]);

  const activeOrder = orders.find(o => ['out for delivery', 'dispatched', 'confirmed', 'preparing', 'packed'].includes(o.status?.toLowerCase()));
  const activeOrderId = activeOrder?.id;

  // 🌟 BULLETPROOF ALARM LOGIC FOR NEW ORDERS
  useEffect(() => {
    if (activeOrder && !acknowledgedOrders.includes(activeOrder.id)) {
      alarmAudio.current.loop = true;
      const playPromise = alarmAudio.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn("⚠️ Browser blocked the alarm. Tap screen to allow audio!", error);
        });
      }
    } else {
      alarmAudio.current.pause();
      alarmAudio.current.currentTime = 0;
    }
    
    return () => {
      alarmAudio.current.pause();
    };
  }, [activeOrder, acknowledgedOrders]);

  // --- GPS TELEMETRY ---
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentCoords({ lat: latitude, lon: longitude });
        
        if (activeOrderId) {
          supabase.from('orders').update({ rider_lat: latitude, rider_lng: longitude }).eq('id', activeOrderId).then();
        }
      },
      (error) => {
        setCurrentCoords(prev => prev || { lat: 21.4624, lon: 80.2201 });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeOrderId]);

  useEffect(() => {
    localStorage.setItem('valo_ack_orders', JSON.stringify(acknowledgedOrders));
  }, [acknowledgedOrders]);

  useEffect(() => {
    localStorage.setItem('valo_rider_step', riderStep);
  }, [riderStep]);

  // 🌟 INTERNAL RIDER IN-APP NOTIFICATION
  const logInAppNotification = async (title, message, type) => {
    try {
      defaultToneAudio.current.currentTime = 0;
      const playPromise = defaultToneAudio.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => console.warn("⚠️ Audio blocked by browser interaction rules.", e));
      }

      await supabase.from('notifications').insert({
        user_id: riderProfile.id,
        title: title,
        message: message,
        type: type 
      });
    } catch (err) {
      console.error("Failed to log notification:", err);
    }
  };

  // 🌟 FIRE NOTIFICATION TO CUSTOMER (USER APP)
  const notifyUser = async (order, title, message) => {
    if (!order.user_id) return;
    try {
      // 1. Log in Supabase so User sees it in their notification history
      await supabase.from('notifications').insert({
        user_id: order.user_id,
        title: title,
        message: message,
        type: 'order'
      });

      // 2. Trigger OneSignal Push to User's Phone
      const userAppRestKey = import.meta.env.VITE_USER_APP_REST_API_KEY;
      const userAppId = "c91ace59-eb44-4808-a7d7-673349417cab"; // Exact User App ID

      if (userAppRestKey) {
        await fetch('https://api.onesignal.com/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${userAppRestKey}`
          },
          body: JSON.stringify({
            app_id: userAppId,
            target_channel: "push",
            include_aliases: { external_id: [`user_${order.user_id}`] },
            headings: { en: title },
            contents: { en: message }
          })
        });
      }
    } catch (e) {
      console.error("Failed to notify customer:", e);
    }
  };

  // --- HELPERS ---
  const handleUpdateStatus = async (orderId, nextStatus) => {
    try {
      const { error } = await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
      if (error) throw error;
      
      await logInAppNotification(
        "Order Update", 
        `Order #${orderId.slice(0,5)} status changed to ${nextStatus.toUpperCase()}`, 
        "order"
      );
      
      return true;
    } catch (err) {
      alert(`Update error: ${err.message}`);
      return false;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('valo_rider');
    window.location.href = '/';
  };

  const getGoogleMapsUrl = (lat, lon) => {
    if (lat && lon) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    return `https://www.google.com/maps`;
  };

  const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  };

  const isToday = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  const deliveredOrders = orders.filter(o => ['delivered', 'completed'].includes(o.status?.toLowerCase()));
  const todaysDeliveredOrders = deliveredOrders.filter(o => isToday(o.created_at));
  const todaysDeliveredCount = todaysDeliveredOrders.length;
  const totalDeliveredCount = deliveredOrders.length;
  const todaysEarnings = todaysDeliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
  const totalEarnings = deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);

  useEffect(() => {
    if (activeOrder) {
      const s = activeOrder.status?.toLowerCase();
      if (s === 'out for delivery' && !['nav_hotel', 'at_hotel', 'paid'].includes(riderStep)) {
        setRiderStep('nav_hotel');
      }
    } else {
      setRiderStep('nav_kitchen');
      setShowQrModal(false);
      setIsPaymentConfirmed(false);
    }
  }, [activeOrder?.status, riderStep]);

  // ==========================================
  // VIEW: NEW ORDER FULL-SCREEN POPUP
  // ==========================================
  if (activeOrder && !acknowledgedOrders.includes(activeOrder.id)) {
    const kitchenData = kitchens[activeOrder.kitchen_id];
    const hotelData = hotels[activeOrder.hotel_id];
    const hotelDisplayTitle = hotelData?.name || activeOrder.hotel_name || 'Hotel';
    
    return (
      <div className="fixed inset-0 z-50 bg-[#6C2BFF] flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <Bell size={40} className="text-white" />
        </div>
        <h1 className="text-4xl font-black text-white mb-2 leading-tight">New Order<br/>Assigned!</h1>
        <p className="text-white/80 font-bold mb-10 text-sm">Pickup from: {kitchenData?.name || 'Kitchen'}</p>
        
        <div className="bg-white rounded-3xl p-5 w-full max-w-sm mb-8 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-400 font-bold text-xs uppercase">Payout</span>
            <span className="text-2xl font-black text-green-600">₹{activeOrder.delivery_fee || 30}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-bold text-xs uppercase">Drop-off</span>
            <span className="text-sm font-black text-gray-900">{hotelDisplayTitle}</span>
          </div>
        </div>

        <button 
          onClick={() => {
            setAcknowledgedOrders([...acknowledgedOrders, activeOrder.id]);
            setRiderStep('nav_kitchen');
            logInAppNotification("Order Accepted", "You accepted a new order.", "system");
          }}
          className="w-full max-w-sm bg-white text-[#6C2BFF] py-4 rounded-2xl text-lg font-black uppercase tracking-wider shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          Go to Kitchen <Navigation size={20} />
        </button>
      </div>
    );
  }

  if (activeOrder) {
    const isPhase2 = ['nav_hotel', 'at_hotel', 'paid'].includes(riderStep);
    const kitchenData = kitchens[activeOrder.kitchen_id];
    const hotelData = hotels[activeOrder.hotel_id];
    
    const targetCoords = isPhase2 
      ? { lat: Number(hotelData?.lat || activeOrder.hotel_lat), lon: Number(hotelData?.lon || activeOrder.hotel_lng) }
      : { lat: Number(kitchenData?.lat || activeOrder.kitchen_lat), lon: Number(kitchenData?.lon || activeOrder.kitchen_lng) };

    const mapUrl = getGoogleMapsUrl(targetCoords.lat, targetCoords.lon);
    const hotelDisplayTitle = hotelData?.name || activeOrder.hotel_name || 'Hotel';

    const handleReachKitchen = () => {
      if (!targetCoords.lat || !targetCoords.lon || !currentCoords) {
        logInAppNotification("Arrived", "You have reached the kitchen.", "system");
        return setRiderStep('at_kitchen');
      }
      const dist = calculateDistanceMeters(currentCoords.lat, currentCoords.lon, targetCoords.lat, targetCoords.lon);
      if (dist <= 50) {
        setRiderStep('at_kitchen');
        logInAppNotification("Arrived", "You have reached the kitchen.", "system");
        
        setTimeout(() => {
          if (activeOrder.status?.toLowerCase() === 'packed') {
            alert("✅ Order is Packed! Please pick it up from the counter.");
          } else {
            alert("⏳ Order is still preparing. Please wait in the designated area.");
          }
        }, 100);
      } else {
        alert(`First reached kitchen! You are still ${Math.round(dist)}m away.`);
      }
    };

    const handlePickUp = () => {
      setRiderStep('picked_up');
    };

    // 🌟 RIDER STARTS DELIVERY -> NOTIFY CUSTOMER
    const handleStartDelivery = async () => {
      const success = await handleUpdateStatus(activeOrder.id, 'out for delivery');
      if (success) {
        setRiderStep('nav_hotel');
        await notifyUser(
          activeOrder, 
          "🛵 Out for Delivery!", 
          `Your valet ${riderProfile.name} has picked up your food and is heading to your room!`
        );
      }
    };

    const handleReachDestination = () => {
      if (!targetCoords.lat || !targetCoords.lon || !currentCoords) {
        setRiderStep('at_hotel');
        setShowQrModal(true);
        logInAppNotification("Arrived", "You have reached the customer location.", "system");
        return;
      }
      const dist = calculateDistanceMeters(currentCoords.lat, currentCoords.lon, targetCoords.lat, targetCoords.lon);
      if (dist <= 100) {
        setRiderStep('at_hotel');
        setShowQrModal(true);
        logInAppNotification("Arrived", "You have reached the customer location.", "system");
      } else {
        alert(`Go to delivery address first! You are ${Math.round(dist)}m away.`);
      }
    };

    // 🌟 RIDER COMPLETES DELIVERY -> NOTIFY CUSTOMER
    const handleCompleteDelivery = async () => {
      const success = await handleUpdateStatus(activeOrder.id, 'delivered');
      if (success) {
        setRiderStep('nav_kitchen');
        setShowQrModal(false);
        setIsPaymentConfirmed(false);
        await notifyUser(
          activeOrder, 
          "✅ Delivered!", 
          `Order delivered successfully by ${riderProfile.name}. Enjoy your meal!`
        );
      }
    };

    return (
      <div className="h-[100dvh] flex flex-col bg-[#F8F7FC] font-sans">
        {/* Header */}
        <div className="bg-white pt-12 pb-4 px-5 shadow-sm border-b border-gray-100 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F4F0FF] text-[#6C2BFF] flex items-center justify-center font-black text-lg">
              {riderProfile.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-sm font-black text-gray-900">{riderProfile.name}</h2>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{isOnline ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={(e) => { e.preventDefault(); navigate('/notifications'); }} className="relative p-2 text-gray-400 hover:text-gray-900 transition-colors">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </button>
            <button type="button" onClick={handleLogout} className="relative p-2 text-gray-400 hover:text-red-500 transition-colors">
              <Power size={20} />
            </button>
          </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative z-0 overflow-hidden">
          <DynamicMap currentCoords={currentCoords} destCoords={targetCoords} isMapLoaded={isMapLoaded} recenter={recenter} setRecenter={setRecenter} showRoute={true} />
          {!recenter && isMapLoaded && (
            <button onClick={() => setRecenter(true)} className="absolute bottom-6 right-4 z-10 bg-white text-[#6C2BFF] w-12 h-12 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center justify-center active:scale-90 transition-transform">
              <Crosshair size={20} />
            </button>
          )}
        </div>

        {/* Bottom Action Sheet */}
        <div className="bg-white rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-20 flex flex-col pb-[env(safe-area-inset-bottom)]">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-2"></div>
          
          <div className="px-6 pb-6 pt-2 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#6C2BFF] bg-[#F4F0FF] px-2 py-0.5 rounded flex items-center gap-1 mb-1.5 w-fit">
                  {isPhase2 ? 'Phase 2: Delivery' : 'Phase 1: Pickup'}
                </span>
                <h3 className="text-xl font-black text-gray-900 leading-tight">
                  {isPhase2 ? `Room ${activeOrder.room_number}` : kitchenData?.name || 'Kitchen'}
                </h3>
                <p className="text-xs font-bold text-gray-400 mt-1 truncate max-w-[200px]">
                  {isPhase2 ? hotelDisplayTitle : kitchenData?.address}
                </p>
              </div>
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm active:scale-90 transition-transform">
                <Navigation size={24} className="fill-current" />
              </a>
            </div>

            <div className="space-y-3">
              {!isPhase2 && (
                <>
                  {riderStep === 'nav_kitchen' && (
                    <button onClick={handleReachKitchen} className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-2xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                      <MapPin size={18} /> Reached Kitchen
                    </button>
                  )}
                  {riderStep === 'at_kitchen' && (
                    <button 
                      disabled={activeOrder.status?.toLowerCase() !== 'packed'}
                      onClick={handlePickUp} 
                      className={`w-full py-4 rounded-2xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${activeOrder.status?.toLowerCase() === 'packed' ? 'bg-[#6C2BFF] text-white shadow-lg shadow-[#6C2BFF]/25' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    >
                      <Package size={18} /> {activeOrder.status?.toLowerCase() === 'packed' ? 'Pick Up Order' : 'Waiting for Packing...'}
                    </button>
                  )}
                  {riderStep === 'picked_up' && (
                    <button onClick={handleStartDelivery} className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-green-500/25">
                      <Bike size={18} /> Start Delivery
                    </button>
                  )}
                </>
              )}

              {isPhase2 && (
                <>
                  {riderStep === 'nav_hotel' && (
                    <button onClick={handleReachDestination} className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-2xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                      <MapPin size={18} /> Reached Destination
                    </button>
                  )}
                  {(riderStep === 'at_hotel' || riderStep === 'paid') && (
                    <button 
                      disabled={!isPaymentConfirmed}
                      onClick={handleCompleteDelivery} 
                      className={`w-full py-4 rounded-2xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${isPaymentConfirmed ? 'bg-green-500 text-white shadow-lg shadow-green-500/25 active:scale-[0.98]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    >
                      <CheckCircle2 size={18} /> Complete Delivery
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* 🌟 PAYMENT & QR CODE MODAL FOR DELIVERY COMPLETION */}
        {showQrModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] max-w-sm w-full p-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-200">
              <div className="w-12 h-12 rounded-2xl bg-[#F4F0FF] text-[#6C2BFF] flex items-center justify-center mb-3">
                <QrCode size={26} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-1">Customer Settlement</h3>
              <p className="text-xs text-gray-400 font-medium mb-4">Verify payment collection before closing order.</p>
              <div className="bg-[#F8F7FC] border border-gray-100 rounded-2xl p-4 w-full mb-5">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Amount to Collect</p>
                <h2 className="text-3xl font-black text-[#6C2BFF]">₹{activeOrder.grand_total || 0}</h2>
                <span className="text-[10px] font-bold uppercase bg-green-50 text-green-600 px-2 py-0.5 rounded mt-2 inline-block">
                  Mode: {activeOrder.payment_method || 'Online / COD'}
                </span>
              </div>
              <div className="bg-white border-2 border-dashed border-gray-200 p-4 rounded-2xl mb-6 w-40 h-40 flex flex-col items-center justify-center">
                <div className="w-full h-full bg-gray-900 text-white rounded-xl flex items-center justify-center font-mono text-[10px] text-center p-2">
                  [ UPI QR CODE ]
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsPaymentConfirmed(true);
                  setRiderStep('paid');
                  setShowQrModal(false);
                }}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all mb-3"
              >
                <Check size={18} /> Confirm Payment
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: HOME SCREEN (NO ACTIVE ORDER)
  // ==========================================
  return (
    <div className="h-[100dvh] bg-[#F8F7FC] font-sans flex flex-col overflow-hidden relative">
      <div className="bg-white pt-12 pb-4 px-5 shadow-sm border-b border-gray-100 shrink-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#F4F0FF] text-[#6C2BFF] flex items-center justify-center font-black text-lg shadow-sm">
            {riderProfile.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900 leading-tight">{riderProfile.name}</h2>
            <button onClick={() => setIsOnline(!isOnline)} className="flex items-center gap-1 mt-0.5 cursor-pointer active:scale-95 transition-transform">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>{isOnline ? 'Online' : 'Offline'}</span>
              <ChevronDown size={10} className="text-gray-400" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={(e) => { e.preventDefault(); navigate('/notifications'); }} className="relative p-2 text-gray-400 hover:text-gray-900 transition-colors">
            <Bell size={20} />
          </button>
          <button type="button" onClick={handleLogout} className="w-10 h-10 bg-gray-50 border border-gray-100 hover:bg-red-50 hover:text-red-500 rounded-xl flex items-center justify-center text-gray-400 active:scale-90 transition-transform">
            <Power size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto smooth-scroll flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-[#F4F0FF] border-t-[#6C2BFF] rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="h-48 w-full shrink-0 relative bg-gray-100 z-0 overflow-hidden">
              <DynamicMap currentCoords={currentCoords} isMapLoaded={isMapLoaded} recenter={recenter} setRecenter={setRecenter} showRoute={false} />
              {!recenter && isMapLoaded && (
                <button onClick={() => setRecenter(true)} className="absolute bottom-4 right-4 z-10 bg-white text-[#6C2BFF] w-10 h-10 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.1)] flex items-center justify-center active:scale-90 transition-transform">
                  <Crosshair size={16} />
                </button>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#F8F7FC] via-transparent pointer-events-none z-10"></div>
            </div>

            <div className="px-5 pt-5 relative z-20 pb-10 flex-1 flex flex-col">
              <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Today Orders</span>
                    <Package size={14} className="text-[#6C2BFF]" />
                  </div>
                  <h4 className="text-2xl font-black text-gray-900">{todaysDeliveredCount}</h4>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Today Earning</span>
                    <Wallet size={14} className="text-green-500" />
                  </div>
                  <h4 className="text-2xl font-black text-green-600">₹{todaysEarnings}</h4>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Total Orders</span>
                    <CheckCircle2 size={14} className="text-blue-500" />
                  </div>
                  <h4 className="text-2xl font-black text-gray-900">{totalDeliveredCount}</h4>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Total Earning</span>
                    <TrendingUp size={14} className="text-amber-500" />
                  </div>
                  <h4 className="text-2xl font-black text-gray-900">₹{totalEarnings}</h4>
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                <h3 className="text-sm font-black text-gray-900 tracking-tight sticky top-0 bg-[#F8F7FC] py-3 z-30 flex items-center gap-2">
                  <Clock size={16} className="text-[#6C2BFF]" /> Order History
                </h3>
                
                <div className="space-y-3 pb-8">
                  {deliveredOrders.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
                      <p className="text-xs font-bold text-gray-400">No completed orders yet.</p>
                    </div>
                  ) : (
                    deliveredOrders.map(order => {
                      const isExpanded = expandedHistoryId === order.id;
                      const dateObj = new Date(order.created_at);
                      
                      let distKm = "N/A";
                      const kLat = order.kitchen_lat || kitchens[order.kitchen_id]?.lat;
                      const kLon = order.kitchen_lng || kitchens[order.kitchen_id]?.lon;
                      const hLat = order.hotel_lat || hotels[order.hotel_id]?.lat;
                      const hLon = order.hotel_lng || hotels[order.hotel_id]?.lon;

                      if (kLat && kLon && hLat && hLon) {
                        const distMeters = calculateDistanceMeters(Number(kLat), Number(kLon), Number(hLat), Number(hLon));
                        distKm = ((distMeters * 1.3) / 1000).toFixed(1) + " km";
                      }
                      
                      const historyHotelName = hotels[order.hotel_id]?.name || order.hotel_name || 'Hotel';

                      return (
                        <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300">
                          <div onClick={() => setExpandedHistoryId(isExpanded ? null : order.id)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/50">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                                <CheckCircle2 size={18} />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-gray-900 leading-tight">Order #{order.order_id || order.id.slice(0,6)}</h4>
                                <p className="text-[10px] font-bold text-gray-400 mt-0.5">{dateObj.toLocaleDateString()} • {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-right">
                              <div>
                                <p className="text-sm font-black text-[#6C2BFF]">₹{order.delivery_fee || 30}</p>
                                <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Earned</p>
                              </div>
                              {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 border-t border-gray-50 bg-gray-50/30">
                              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                                <div className="relative">
                                  <div className="absolute -left-6 top-0.5 w-4 h-4 bg-white border-2 border-[#6C2BFF] rounded-full flex items-center justify-center z-10">
                                    <div className="w-1.5 h-1.5 bg-[#6C2BFF] rounded-full"></div>
                                  </div>
                                  <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Pickup</p>
                                  <p className="text-xs font-bold text-gray-900 mt-0.5">{kitchens[order.kitchen_id]?.name || 'Kitchen'}</p>
                                </div>
                                <div className="relative">
                                  <div className="absolute -left-6 top-0.5 w-4 h-4 bg-white border-2 border-green-500 rounded-full flex items-center justify-center z-10">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                  </div>
                                  <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Drop-off</p>
                                  <p className="text-xs font-bold text-gray-900 mt-0.5">{historyHotelName} • Room {order.room_number}</p>
                                </div>
                              </div>
                              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500">
                                <div className="flex items-center gap-1.5">
                                  <MapIcon size={14} className="text-gray-400" /> Distance: <span className="text-gray-900">{distKm}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Clock size={14} className="text-gray-400" /> Status: <span className="text-green-600 uppercase text-[10px] tracking-widest font-black">Delivered</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}