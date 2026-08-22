import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Bell, AlertCircle, Package, Check } from 'lucide-react';

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const riderProfile = JSON.parse(localStorage.getItem('valo_rider')) || { id: null };

  useEffect(() => {
    async function fetchNotifications() {
      if (!riderProfile.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', riderProfile.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setNotifications(data || []);
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchNotifications();

    // 🌟 LIVE REAL-TIME SYNC
    const channel = supabase.channel('live-notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${riderProfile.id}` 
      }, (payload) => {
        // Ensure new live notifications are marked as unread in UI instantly
        const newNotification = { ...payload.new, is_read: false };
        setNotifications(prev => [newNotification, ...prev]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [riderProfile.id]);

  // 🌟 MARK SINGLE AS READ
  const markAsRead = async (id) => {
    try {
      setNotifications(current => 
        current.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // 🌟 MARK ALL AS READ
  const markAllAsRead = async () => {
    try {
      setNotifications(current => current.map(n => ({ ...n, is_read: true })));
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', riderProfile.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // 🌟 SMART DATE FORMATTER
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    
    const timeText = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeText}`;
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
    
    if (isYesterday) return `Yesterday, ${timeText}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeText}`;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="h-[100dvh] bg-[#F8F7FC] font-sans flex flex-col">
      
      {/* Header */}
      <div className="bg-white pt-12 pb-4 px-5 shadow-sm border-b border-gray-100 shrink-0 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-gray-600 active:scale-90 transition-transform cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-black text-gray-900">Notifications</h2>
        </div>
        
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="text-[#6C2BFF] text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform bg-[#6C2BFF]/10 px-3 py-1.5 rounded-full">
            <Check size={14} /> Read All
          </button>
        )}
      </div>

      <div className="flex-1 p-5 overflow-y-auto">
        {loading ? (
           <div className="flex flex-col items-center justify-center h-full pb-20">
             <div className="w-8 h-8 border-4 border-[#F4F0FF] border-t-[#6C2BFF] rounded-full animate-spin"></div>
           </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center pb-20">
            <div className="w-20 h-20 bg-[#F4F0FF] rounded-full flex items-center justify-center mb-5 border-4 border-white shadow-sm">
              <Bell size={32} className="text-[#6C2BFF]" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">No new alerts</h3>
            <p className="text-sm font-bold text-gray-400 max-w-[250px]">
              You're all caught up! System messages and order alerts will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => {
              const isOrderAlert = notif.type === 'order';
              
              return (
                <div 
                  key={notif.id} 
                  onClick={() => !notif.is_read && markAsRead(notif.id)}
                  className={`relative p-4 rounded-2xl shadow-sm border transition-all duration-300 flex items-start gap-4 ${
                    notif.is_read 
                      ? 'bg-transparent border-transparent opacity-70' 
                      : 'bg-white border-[#6C2BFF]/20 cursor-pointer hover:border-[#6C2BFF]/40'
                  }`}
                >
                  {/* Unread dot indicator */}
                  {!notif.is_read && (
                    <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-[#6C2BFF] rounded-full shadow-[0_0_8px_rgba(108,43,255,0.5)]"></div>
                  )}

                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isOrderAlert ? 'bg-blue-50 text-blue-600' : 'bg-[#F4F0FF] text-[#6C2BFF]'}`}>
                    {isOrderAlert ? <Package size={18} /> : <AlertCircle size={18} />}
                  </div>
                  <div className="flex-1 pr-4">
                    <h4 className={`text-sm mb-0.5 ${notif.is_read ? 'font-bold text-gray-700' : 'font-black text-gray-900'}`}>
                      {notif.title}
                    </h4>
                    <p className={`text-xs mt-1 leading-relaxed ${notif.is_read ? 'font-medium text-gray-500' : 'font-bold text-gray-600'}`}>
                      {notif.message}
                    </p>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2 block">
                      {formatTime(notif.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}