'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { PolygonSidebar } from '@/components/PolygonSidebar';
import { MapChatArea } from '@/components/MapChatArea';
import type { ChatMessage } from '@/lib/db';

export default function PolygonPage() {
  const router = useRouter();
  const params = useParams();
  const polygonId = params.polygonId as string;
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPolygonId, setCurrentPolygonId] = useState<string | null>(polygonId);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(polygonId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(null);
  const [polygon, setPolygon] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [polyhouses, setPolyhouses] = useState<any[]>([]);
  const [selectedPolyhouseId, setSelectedPolyhouseId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatMessageHandlerRef = useRef<((message: string) => Promise<void>) | null>(null);

  // Open sidebar by default on desktop
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMenuOpen(window.innerWidth >= 768);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.email) {
            setIsAuthenticated(true);
            setUserEmail(data.email);
            loadPolygon();
          } else {
            router.push('/');
          }
        } else {
          router.push('/');
        }
      } catch (error) {
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [router, polygonId]);

  // Load chat history when polygonId changes
  useEffect(() => {
    if (currentPolygonId) {
      loadChatHistory();
    } else {
      setMessages([]);
    }
  }, [currentPolygonId]);

  const loadPolygon = async () => {
    if (!polygonId || !userEmail) return;
    
    try {
      const response = await fetch(`/api/polygons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polygonId }),
      });

      if (!response.ok) {
        throw new Error('Failed to load polygon');
      }

      const data = await response.json();
      setPolygon(data.polygon);
      
      // Set map center to polygon center
      if (data.polygon?.polygon_coordinates && data.polygon.polygon_coordinates.length > 0) {
        const center = data.polygon.polygon_coordinates.reduce(
          (acc: {lat: number, lng: number}, coord: {lat: number, lng: number}) => ({
            lat: acc.lat + coord.lat,
            lng: acc.lng + coord.lng,
          }),
          { lat: 0, lng: 0 }
        );
        center.lat /= data.polygon.polygon_coordinates.length;
        center.lng /= data.polygon.polygon_coordinates.length;
        setMapCenter(center);
      }
    } catch (error) {
      console.error('Error loading polygon:', error);
      router.push('/map');
    }
  };

  const loadChatHistory = async () => {
    if (!currentPolygonId) return;
    try {
      const response = await fetch(`/api/polygons/chat?polygonId=${encodeURIComponent(currentPolygonId)}`);
      if (!response.ok) {
        throw new Error('Failed to load chat history');
      }
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error loading chat history:', error);
      setMessages([]);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentPolygonId || !text.trim()) return;

    setIsProcessing(true);
    try {
      // Save user message
      const messageResponse = await fetch('/api/polygons/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polygonId: currentPolygonId,
          versionId: currentVersionId,
          role: 'user',
          message: text,
        }),
      });

      if (!messageResponse.ok) {
        throw new Error('Failed to save message');
      }

      const messageData = await messageResponse.json();
      const userMessage = messageData.message;
      setMessages(prev => [...prev, userMessage]);

      // Reload chat history after a delay to get system response
      setTimeout(() => {
        loadChatHistory();
      }, 3000);

    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChatMessageTrigger = async (message: string) => {
    if (chatMessageHandlerRef.current) {
      await chatMessageHandlerRef.current(message);
      // Reload chat history after calculation completes
      setTimeout(() => {
        loadChatHistory();
      }, 2000);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Error logging out:', error);
    }
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#E3FFEF]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-mint mx-auto mb-4"></div>
          <p className="font-sans text-[#141309]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !polygon) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex bg-[#E3FFEF]">
      <PolygonSidebar
        isOpen={menuOpen}
        toggleSidebar={() => setMenuOpen(!menuOpen)}
        userEmail={userEmail}
        onLogout={handleLogout}
        hamburgerRef={hamburgerRef}
        onPolygonSelected={(id) => {
          setCurrentPolygonId(id);
          setCurrentVersionId(id);
          router.push(`/map/${id}`);
        }}
      />
      
      <main 
        className="flex-1 flex flex-col h-full min-w-0 overflow-hidden"
        onClick={() => {
          if (typeof window !== 'undefined' && window.innerWidth < 768 && menuOpen) {
            setMenuOpen(false);
          }
        }}
      >
        <MapChatArea
          polygonId={currentPolygonId}
          currentVersionId={currentVersionId}
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isProcessing}
          onMenuClick={() => setMenuOpen(!menuOpen)}
          isSidebarOpen={menuOpen}
          hamburgerRef={hamburgerRef}
          chatInputRef={chatInputRef}
          mapCenter={mapCenter}
          initialPolygon={polygon}
          userEmail={userEmail}
          onPolygonIdChange={(id) => {
            setCurrentPolygonId(id);
            if (id) {
              loadChatHistory();
            } else {
              setMessages([]);
            }
          }}
          onVersionIdChange={(id) => setCurrentVersionId(id)}
          onChatMessageTrigger={handleChatMessageTrigger}
          chatMessageHandlerRef={chatMessageHandlerRef}
          statistics={statistics}
          polyhouses={polyhouses}
          selectedPolyhouseId={selectedPolyhouseId}
          onPolyhouseSelect={(id) => setSelectedPolyhouseId(id)}
          onPolyhouseDeselect={() => setSelectedPolyhouseId(null)}
          onExport={() => console.log('Export clicked')}
          onStatisticsChange={(stats) => setStatistics(stats)}
          onPolyhousesChange={(ph) => setPolyhouses(ph)}
          onStartDrawing={() => setIsDrawing(true)}
          onClearPolygon={() => {
            setStatistics(null);
            setPolyhouses([]);
            setSelectedPolyhouseId(null);
          }}
          onCalculate={() => setIsCalculating(true)}
          isDrawing={isDrawing}
          isCalculating={isCalculating}
        />
      </main>
    </div>
  );
}
