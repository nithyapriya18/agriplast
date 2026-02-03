'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { PolygonSidebar } from '@/components/PolygonSidebar';
import { MapChatArea } from '@/components/MapChatArea';
import type { ChatMessage } from '@/lib/db';

export default function MapPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPolygonId, setCurrentPolygonId] = useState<string | null>(null);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [polyhouses, setPolyhouses] = useState<any[]>([]);
  const [selectedPolyhouseId, setSelectedPolyhouseId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

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
  }, [router]);

  // Load chat history when polygonId changes
  useEffect(() => {
    if (currentPolygonId) {
      loadChatHistory();
    } else {
      setMessages([]);
    }
  }, [currentPolygonId]);

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

  const chatMessageHandlerRef = useRef<((message: string) => Promise<void>) | null>(null);

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

  // Callbacks to receive statistics and polyhouses from GoogleMap
  const handleStatisticsChange = (stats: any) => {
    setStatistics(stats);
  };

  const handlePolyhousesChange = (ph: any[]) => {
    setPolyhouses(ph);
  };

  const handleSelectedPolyhouseChange = (id: string | null) => {
    setSelectedPolyhouseId(id);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Error logging out:', error);
    }
    router.push('/');
  };

  const handlePolygonSelected = async (polygonId: string) => {
    setCurrentPolygonId(polygonId);
    setCurrentVersionId(polygonId);
    
    // Load polygon data to get coordinates for map center
    try {
      const response = await fetch(`/api/polygons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polygonId }),
      });
      if (response.ok) {
        const data = await response.json();
        const polygon = data.polygon;
        if (polygon?.polygon_coordinates && polygon.polygon_coordinates.length > 0) {
          const center = polygon.polygon_coordinates.reduce(
            (acc: {lat: number, lng: number}, coord: {lat: number, lng: number}) => ({
              lat: acc.lat + coord.lat,
              lng: acc.lng + coord.lng,
            }),
            { lat: 0, lng: 0 }
          );
          center.lat /= polygon.polygon_coordinates.length;
          center.lng /= polygon.polygon_coordinates.length;
          setMapCenter(center);
        }
      }
    } catch (error) {
      console.error('Error loading polygon data:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#141309]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-mint mx-auto mb-4"></div>
          <p className="font-sans text-[#FFFFFD]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex bg-[#141309]">
      <PolygonSidebar
        isOpen={menuOpen}
        toggleSidebar={() => setMenuOpen(!menuOpen)}
        userEmail={userEmail}
        onLogout={handleLogout}
        hamburgerRef={hamburgerRef}
        onPolygonSelected={handlePolygonSelected}
      />
      
      <main 
        className="flex-1 flex flex-col h-full min-w-0 overflow-hidden"
        onClick={() => {
          // Close sidebar on mobile when clicking main area
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
          userEmail={userEmail}
          statistics={statistics}
          polyhouses={polyhouses}
          selectedPolyhouseId={selectedPolyhouseId}
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
          onPolyhouseSelect={(id) => setSelectedPolyhouseId(id)}
          onPolyhouseDeselect={() => setSelectedPolyhouseId(null)}
          onExport={() => {
            // TODO: Implement export functionality
            console.log('Export clicked');
          }}
          onStatisticsChange={handleStatisticsChange}
          onPolyhousesChange={handlePolyhousesChange}
          onStartDrawing={() => {
            // Trigger drawing start in GoogleMap
            setIsDrawing(true);
          }}
          onClearPolygon={() => {
            // Clear will be handled by GoogleMap
            setStatistics(null);
            setPolyhouses([]);
            setSelectedPolyhouseId(null);
          }}
          onCalculate={() => {
            // Calculate will be triggered via GoogleMap
            setIsCalculating(true);
          }}
          isDrawing={isDrawing}
          isCalculating={isCalculating}
        />
      </main>
    </div>
  );
}
