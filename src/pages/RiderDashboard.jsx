import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Bike, MapPin, Phone, Package, CheckCircle2, LogOut, Clock, ShoppingBag, Navigation } from 'lucide-react';

export default function RiderDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assigned'); // 'assigned' or 'active'

  // Retrieve current active rider profile parameters
  const riderProfile = JSON.parse(localStorage.getItem('valo_rider')) || {
    id: null,
    name: "Guest Rider",
    mobile: ""
  };

  // --- Fetch and Listen to Real-Time Order Stream ---
  useEffect(() => {
    // If no valid rider ID, kick them back to login
    if (!riderProfile.id) {
      navigate('/');
      return;
    }

    async function fetchOrders() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('rider_id', riderProfile.id) // SECURITY: Only fetch this specific rider's orders
          .in('status', ['dispatched', 'packed', 'out for delivery']) // Include packed!
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(data || []);
      } catch (err) {
        console.error('Error streaming rider orders matrix:', err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();

    // Listen to changes ONLY for this rider's orders
    const channel = supabase.channel('rider-live-board')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: `rider_id=eq.${riderProfile.id}`
      }, fetchOrders)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [navigate, riderProfile.id]);

  // --- Action: Update Order Journey Status ---
  const handleUpdateStatus = async (orderId, nextStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId);

      if (error) throw error;
      
      // Navigate tabs automatically based on flow
      if (nextStatus === 'out for delivery') setActiveTab('active');
      if (nextStatus === 'delivered') setActiveTab('assigned');
      
    } catch (err) {
      alert(`Status transition update error: ${err.message}`);
    }
  };

  // --- Action: Clear Session and Route back to Initialization screen ---
  const handleLogout = () => {
    localStorage.removeItem('valo_rider');
    window.location.href = '/';
  };

  // --- Filter Core Queues ---
  // Rider sees both dispatched (waiting for kitchen) and packed (ready to pick up)
  const assignedOrders = orders.filter(o => ['dispatched', 'packed'].includes(o.status?.toLowerCase()));
  
  // Rider changed status to 'out for delivery'
  const myActiveOrders = orders.filter(o => o.status?.toLowerCase() === 'out for delivery');

  return (
    <div className="h-[100dvh] bg-[#F8F7FC] font-sans flex flex-col overflow-hidden relative">
      
      {/* Premium Status Header */}
      <div className="bg-white pt-12 pb-4 px-5 shadow-sm border-b border-gray-100 shrink-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#F4F0FF] text-[#6C2BFF] flex items-center justify-center shadow-sm">
            <Bike size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900 leading-tight">{riderProfile.name}</h2>
            <p className="text-[10px] font-bold text-green-500 uppercase tracking-wide flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
              Duty Active • Online
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="w-10 h-10 bg-gray-50 border border-gray-100 hover:bg-red-50 hover:text-red-500 rounded-xl flex items-center justify-center text-gray-400 active:scale-95 transition-all"
        >
          <LogOut size={16} />
        </button>
      </div>

      {/* Segmented Top Navigation Tabs Map */}
      <div className="bg-white px-5 py-2.5 shadow-sm border-b border-gray-100 shrink-0 flex gap-4 z-30">
        <button 
          onClick={() => setActiveTab('assigned')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all relative flex items-center justify-center gap-2 ${
            activeTab === 'assigned' ? 'bg-[#6C2BFF] text-white shadow-md shadow-[#6C2BFF]/10' : 'bg-gray-50 text-gray-400'
          }`}
        >
          <span>Assigned Jobs</span>
          {assignedOrders.length > 0 && (
            <span className={`px-2 py-0.5 text-[9px] rounded-full font-black ${activeTab === 'assigned' ? 'bg-white text-[#6C2BFF]' : 'bg-red-500 text-white animate-pulse'}`}>
              {assignedOrders.length}
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all relative flex items-center justify-center gap-2 ${
            activeTab === 'active' ? 'bg-[#6C2BFF] text-white shadow-md shadow-[#6C2BFF]/10' : 'bg-gray-50 text-gray-400'
          }`}
        >
          <span>Active Trip</span>
          {myActiveOrders.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-ping absolute top-2 right-4"></span>
          )}
        </button>
      </div>

      {/* Main Ticket Scroll Body Canvas */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-5 pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-8 h-8 border-4 border-[#F4F0FF] border-t-[#6C2BFF] rounded-full animate-spin"></div>
          </div>
        ) : activeTab === 'assigned' ? (
          
          /* VIEW PANEL A: ASSIGNED JOBS POOL */
          assignedOrders.length === 0 ? (
            <div className="bg-white rounded-[32px] border border-gray-100 p-12 text-center shadow-sm py-20 mt-4">
              <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag size={28} />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-1">Queue is clear</h3>
              <p className="text-xs font-medium text-gray-400 max-w-[200px] mx-auto">Waiting for HQ to dispatch new orders to you.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignedOrders.map(order => {
                const isPacked = order.status?.toLowerCase() === 'packed';

                return (
                  <div key={order.id} className="bg-white rounded-[28px] p-5 border border-gray-100 shadow-sm space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-start justify-between border-b border-gray-50 pb-3">
                      <div>
                        {/* Dynamic Status Badge */}
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          isPacked ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {isPacked ? 'Packed • Ready for Pickup' : 'Assigned • Kitchen Preparing'}
                        </span>
                        <h3 className="text-xl font-black text-gray-900 mt-1.5">Room {order.room_number}</h3>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-tight mt-0.5">{order.hotel_name}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-[#6C2BFF]">₹{order.grand_total}</span>
                        <p className="text-[10px] font-medium text-gray-400 mt-1 flex items-center gap-1 justify-end">
                          <Clock size={10} />
                          {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs font-bold text-gray-500 bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                      {order.items?.map((item, idx) => (
                        <span key={idx} className="inline-block mr-3 last:mr-0">
                          {item.quantity}x {item.name}
                        </span>
                      ))}
                    </div>

                    {/* DYNAMIC PICKUP BUTTON LOGIC */}
                    {isPacked ? (
                      <button 
                        onClick={() => handleUpdateStatus(order.id, 'out for delivery')}
                        className="w-full bg-[#6C2BFF] text-white py-3.5 rounded-xl text-xs font-black shadow-md shadow-[#6C2BFF]/10 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform hover:bg-[#5B21E6]"
                      >
                        <Package size={14} />
                        Confirm Picked Up
                      </button>
                    ) : (
                      <div className="w-full bg-amber-50 border border-amber-100 text-amber-600 py-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-2">
                        <Clock size={14} className="animate-pulse" />
                        Waiting for Kitchen to Pack Order
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )

        ) : (
          
          /* VIEW PANEL B: ACTIVE ASSIGNED DELIVERY TRIP ENGINE */
          myActiveOrders.length === 0 ? (
            <div className="bg-white rounded-[32px] border border-gray-100 p-12 text-center shadow-sm py-20 mt-4">
              <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Navigation size={28} />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-1">No active trips</h3>
              <p className="text-xs font-medium text-gray-400 max-w-[200px] mx-auto">Confirm an assigned order pickup to begin navigation.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myActiveOrders.map(order => {
                return (
                  <div key={order.id} className="bg-white rounded-[28px] p-5 border border-purple-100 shadow-md space-y-4 relative overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                    
                    <div className="flex items-start justify-between border-b border-gray-50 pb-3">
                      <div>
                        <h3 className="text-2xl font-black text-gray-900">Room {order.room_number}</h3>
                        <p className="text-xs text-gray-500 font-extrabold uppercase mt-0.5">{order.hotel_name}</p>
                      </div>
                      <a 
                        href={`tel:${order.mobile_number}`}
                        className="w-11 h-11 bg-green-50 border border-green-100 text-green-600 rounded-xl flex items-center justify-center active:scale-90 transition-transform shadow-sm"
                      >
                        <Phone size={16} className="fill-current" />
                      </a>
                    </div>

                    <div className="space-y-2 text-xs font-bold text-gray-600">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-4">👤</span>
                        <span className="text-gray-800">{order.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-[#6C2BFF] w-4 shrink-0" />
                        <span className="truncate">Deliver directly to Room Doorstep</span>
                      </div>
                    </div>

                    <div className="bg-[#F8F7FC] rounded-xl p-3 border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Order items checklist</p>
                      <ul className="space-y-1.5 text-xs font-extrabold text-gray-700">
                        {order.items?.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="text-[#6C2BFF] font-black text-[11px]">{item.quantity}x</span>
                            <span>{item.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button 
                      onClick={() => handleUpdateStatus(order.id, 'delivered')}
                      className="w-full bg-green-500 hover:bg-green-600 text-white py-3.5 rounded-xl text-xs font-black shadow-md shadow-green-500/10 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                    >
                      <CheckCircle2 size={14} />
                      Mark as Delivered
                    </button>

                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

    </div>
  );
}