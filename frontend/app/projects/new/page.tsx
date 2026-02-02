'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { PlanningResult, ConversationMessage, Coordinate } from '@shared/types';
import EnhancedChatInterface from '@/components/EnhancedChatInterface';
import QuotationPanel from '@/components/QuotationPanel';
import ControlPanel from '@/components/ControlPanel';
import OptimizationLogs from '@/components/OptimizationLogs';
import TerrainInfoPanel from '@/components/TerrainInfoPanel';
import CustomerPreferencesModal, { CustomerPreferences } from '@/components/CustomerPreferencesModal';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

// Dynamic import for MapComponent to avoid SSR issues
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <Loader2 className="w-8 h-8 animate-spin text-agriplast-green-600" />
    </div>
  ),
});

interface ProjectDetails {
  name: string;
  description: string;
  customerCompanyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  locationName: string;
  locationAddress: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<'details' | 'map'>('details');
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    name: '',
    description: '',
    customerCompanyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    locationName: '',
    locationAddress: '',
  });
  const [landBoundary, setLandBoundary] = useState<Coordinate[]>([]);
  const [planningResult, setPlanningResult] = useState<PlanningResult | null>(null);
  const [planningResultId, setPlanningResultId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [showQuotation, setShowQuotation] = useState(false);
  const [landAreaSize, setLandAreaSize] = useState<number>(10000);
  const [editMode, setEditMode] = useState(true);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [pendingCoordinates, setPendingCoordinates] = useState<Coordinate[] | null>(null);
  const [customerPreferences, setCustomerPreferences] = useState<CustomerPreferences | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login?redirectTo=/projects/new');
      return;
    }

    setUser(user);
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectDetails.name.trim()) {
      alert('Please enter a project name');
      return;
    }
    setCurrentStep('map');
  };

  const handleBoundaryComplete = (coordinates: Coordinate[]) => {
    setPendingCoordinates(coordinates);
    setLandBoundary(coordinates);
    setShowPreferencesModal(true);
  };

  const handlePreferencesSubmit = async (preferences: CustomerPreferences) => {
    setShowPreferencesModal(false);
    setCustomerPreferences(preferences); // Store preferences for chat context

    if (!pendingCoordinates) return;

    setLoading(true);

    const configOverrides = {
      polyhouseGap: preferences.vehicleAccess ? 3 : (preferences.priority === 'coverage' ? 0.5 : 2),
      minSideLength: preferences.priority === 'coverage' ? 8 : 16,
      optimization: {
        orientationStrategy: preferences.orientationPreference,
      },
    };

    try {
      // Load user settings from Supabase
      const supabase = createClient();
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Merge user settings with config overrides
      const finalConfig = {
        ...configOverrides,
        ...(userSettings && {
          blockDimensions: {
            width: userSettings.block_width,
            height: userSettings.block_height,
          },
          gutterWidth: userSettings.gutter_width,
          polyhouseGap: configOverrides.polyhouseGap || userSettings.polyhouse_gap,
          maxSideLength: userSettings.max_side_length,
          minSideLength: configOverrides.minSideLength || userSettings.min_side_length,
          minCornerDistance: userSettings.min_corner_distance,
          solarOrientation: {
            enabled: userSettings.solar_orientation_enabled,
          },
          terrain: {
            avoidWater: userSettings.avoid_water,
            considerSlope: userSettings.consider_slope,
            maxSlope: userSettings.max_slope,
          },
        }),
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/planning/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landArea: {
            name: projectDetails.locationName || `Land Area ${new Date().toLocaleDateString()}`,
            coordinates: pendingCoordinates,
          },
          configuration: finalConfig,
          customerPreferences: preferences,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.planningResult) {
        const errorMsg = data.error || data.message || 'Failed to create plan';
        console.error('API Error:', errorMsg);
        alert(`Failed to create plan: ${errorMsg}`);
        return;
      }

      if (!data.planningResult.polyhouses || data.planningResult.polyhouses.length === 0) {
        const terrainInfo = data.planningResult.terrainAnalysis;
        let message = 'No polyhouses could be placed on this land area.\n\n';

        if (terrainInfo?.restrictedZones && terrainInfo.restrictedZones.length > 0) {
          message += `Possible reasons:\n`;
          message += `• Restricted zones detected: ${terrainInfo.restrictedZones.map((z: any) => z.type).join(', ')}\n`;
          message += `• Buildable area: ${terrainInfo.buildableAreaPercentage?.toFixed(1)}%\n\n`;
          message += `Try:\n`;
          message += `• Drawing the boundary around open areas (avoiding water bodies, forests, and roads)\n`;
          message += `• Making the boundary larger\n`;
          message += `• Adjusting your preferences to allow smaller polyhouses\n\n`;
          message += `Note: Buildings can be demolished - only water bodies, forests, and roads are restricted.`;
        } else {
          message += 'Possible reasons:\n';
          message += '• Area may be too small\n';
          message += '• Shape may be too irregular\n';
          message += '• Constraints may be too restrictive\n\n';
          message += 'Try drawing a larger or more regular boundary.';
        }

        alert(message);
        return;
      }

      setPlanningResult(data.planningResult);
      setPlanningResultId(data.resultId);
      setShowQuotation(true);
      setEditMode(false);

      if (data.planningResult.metadata?.totalLandArea) {
        setLandAreaSize(data.planningResult.metadata.totalLandArea);
      }

      const initialMessage: ConversationMessage = {
        role: 'assistant',
        content: `I've created a plan with ${data.planningResult.polyhouses.length} polyhouse(s) covering ${data.planningResult.metadata.totalPolyhouseArea.toFixed(0)} sqm (${data.planningResult.metadata.utilizationPercentage.toFixed(1)}% utilization). The estimated cost is ₹${data.planningResult.quotation.totalCost.toLocaleString('en-IN')}. How can I help you with this plan?`,
        timestamp: new Date(),
      };
      setConversationHistory([initialMessage]);
      setShowChat(true);
    } catch (error) {
      console.error('Error creating plan:', error);
      alert(`Failed to create plan: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProject = async () => {
    if (!planningResult || !user) return;

    try {
      const supabase = createClient();

      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: projectDetails.name,
          description: projectDetails.description || null,
          customer_company_name: projectDetails.customerCompanyName || null,
          contact_name: projectDetails.contactName || null,
          contact_email: projectDetails.contactEmail || null,
          contact_phone: projectDetails.contactPhone || null,
          location_name: projectDetails.locationName || null,
          location_address: projectDetails.locationAddress || null,
          land_boundary: planningResult.landArea.coordinates,
          land_area_sqm: planningResult.landArea.area,
          polyhouse_count: planningResult.polyhouses.length,
          total_coverage_sqm: planningResult.metadata.totalPolyhouseAreaWithGutters,
          utilization_percentage: planningResult.metadata.utilizationPercentage,
          estimated_cost: planningResult.quotation.totalCost,
          configuration: planningResult.configuration,
          polyhouses: planningResult.polyhouses,
          quotation: planningResult.quotation,
          terrain_analysis: planningResult.terrainAnalysis,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      setProjectId(project.id);
      alert('Project saved successfully!');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project. Please try again.');
    }
  };

  const handleChatMessage = async (message: string) => {
    if (!planningResult || !planningResultId) return;

    const userMessage: ConversationMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setConversationHistory(prev => [...prev, userMessage]);

    // Add temporary "thinking" message
    const thinkingMessage: ConversationMessage = {
      role: 'assistant',
      content: 'Thinking...',
      timestamp: new Date(),
    };
    setConversationHistory(prev => [...prev, thinkingMessage]);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planningResultId: planningResultId,
          message,
          conversationHistory: [...conversationHistory, userMessage],
          userId: user?.id,
          projectId: projectId,
          customerPreferences: customerPreferences,
        }),
      });

      const data = await response.json();

      // Remove thinking message and add real response
      setConversationHistory(prev => {
        const withoutThinking = prev.slice(0, -1);
        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        };
        return [...withoutThinking, assistantMessage];
      });

      // If recalculation happened, show loading and update map
      if (data.updatedPlanningResult) {
        setLoading(true);
        // Small delay to show the loading animation
        setTimeout(() => {
          setPlanningResult(data.updatedPlanningResult);
          if (data.updatedPlanningResult.landArea) {
            setLandBoundary(data.updatedPlanningResult.landArea.coordinates);
          }
          setLoading(false);
        }, 500);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove thinking message and add error message
      setConversationHistory(prev => {
        const withoutThinking = prev.slice(0, -1);
        const errorMessage: ConversationMessage = {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        };
        return [...withoutThinking, errorMessage];
      });
    }
  };

  const handleReset = () => {
    if (!confirm('Are you sure you want to reset? All unsaved changes will be lost.')) return;

    setCurrentStep('details');
    setProjectDetails({
      name: '',
      description: '',
      customerCompanyName: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      locationName: '',
      locationAddress: '',
    });
    setLandBoundary([]);
    setPlanningResult(null);
    setPlanningResultId(null);
    setProjectId(null);
    setConversationHistory([]);
    setShowChat(false);
    setShowQuotation(false);
    setLandAreaSize(10000);
    setEditMode(true);
  };

  const handleRestoreSnapshot = (snapshot: PlanningResult) => {
    setPlanningResult(snapshot);
    setLandBoundary(snapshot.landArea.coordinates);

    const restoreMessage: ConversationMessage = {
      role: 'assistant',
      content: `✓ Restored previous state with ${snapshot.polyhouses.length} polyhouses and ${snapshot.metadata.utilizationPercentage.toFixed(1)}% utilization.`,
      timestamp: new Date(),
    };
    setConversationHistory(prev => [...prev, restoreMessage]);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  // Step 1: Project Details Form
  if (currentStep === 'details') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">New Project</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              ← Cancel
            </button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Project Information</h2>
              <p className="text-gray-600">Enter details about this polyhouse planning project</p>
            </div>

            <form onSubmit={handleDetailsSubmit} className="space-y-6">
              {/* Project Details */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">Project Details</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectDetails.name}
                    onChange={(e) => setProjectDetails({ ...projectDetails, name: e.target.value })}
                    placeholder="e.g., Bangalore Farm Expansion 2026"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={projectDetails.description}
                    onChange={(e) => setProjectDetails({ ...projectDetails, description: e.target.value })}
                    placeholder="Brief description of the project"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Customer Information */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">Customer Information</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={projectDetails.customerCompanyName}
                      onChange={(e) => setProjectDetails({ ...projectDetails, customerCompanyName: e.target.value })}
                      placeholder="Customer's company"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={projectDetails.contactName}
                      onChange={(e) => setProjectDetails({ ...projectDetails, contactName: e.target.value })}
                      placeholder="Primary contact person"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={projectDetails.contactEmail}
                      onChange={(e) => setProjectDetails({ ...projectDetails, contactEmail: e.target.value })}
                      placeholder="contact@company.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={projectDetails.contactPhone}
                      onChange={(e) => setProjectDetails({ ...projectDetails, contactPhone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Location Information */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">Location Information</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
                  <input
                    type="text"
                    value={projectDetails.locationName}
                    onChange={(e) => setProjectDetails({ ...projectDetails, locationName: e.target.value })}
                    placeholder="e.g., Whitefield Industrial Area"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
                  <textarea
                    value={projectDetails.locationAddress}
                    onChange={(e) => setProjectDetails({ ...projectDetails, locationAddress: e.target.value })}
                    placeholder="Complete address with landmarks"
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Continue to Map →
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Map Drawing and Planning
  return (
    <main className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="bg-agriplast-green-700 text-white shadow-lg z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{projectDetails.name}</h1>
            <p className="text-sm text-agriplast-green-100 mt-1">
              {projectDetails.customerCompanyName && `For ${projectDetails.customerCompanyName} • `}
              {planningResult ? 'Review and save your plan' : 'Draw your land boundary on the map'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {planningResult && !projectId && (
              <button
                onClick={handleSaveProject}
                disabled={loading}
                className="bg-white text-agriplast-green-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50"
              >
                Save Project
              </button>
            )}
            {!planningResult && (
              <button
                onClick={() => setCurrentStep('details')}
                className="text-white hover:text-gray-200 text-sm font-medium"
              >
                ← Edit Details
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="text-white hover:text-gray-200 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 relative overflow-hidden">
        <MapComponent
          landBoundary={landBoundary}
          polyhouses={planningResult?.polyhouses || []}
          onBoundaryComplete={handleBoundaryComplete}
          loading={loading}
          terrainAnalysis={planningResult?.terrainAnalysis}
          regulatoryCompliance={planningResult?.regulatoryCompliance}
          editMode={editMode}
        />

        {/* Control panel overlay */}
        <div className="absolute top-4 left-4 z-10">
          <ControlPanel
            hasLandBoundary={landBoundary.length > 0}
            hasPlan={!!planningResult}
            onReset={handleReset}
            onToggleChat={() => setShowChat(!showChat)}
            onToggleQuotation={() => setShowQuotation(!showQuotation)}
            showChat={showChat}
            showQuotation={showQuotation}
            editMode={editMode}
            onToggleEditMode={() => setEditMode(!editMode)}
          />
        </div>

        {/* Terrain Info Panel */}
        {planningResult && (planningResult.terrainAnalysis || planningResult.regulatoryCompliance) && (
          <TerrainInfoPanel
            terrainAnalysis={planningResult.terrainAnalysis}
            regulatoryCompliance={planningResult.regulatoryCompliance}
          />
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-20 p-4">
            <div className="w-full max-w-3xl">
              <OptimizationLogs
                isLoading={loading}
                landAreaSize={landAreaSize}
              />
            </div>
          </div>
        )}

        {/* Quotation Panel */}
        {showQuotation && planningResult && (
          <div className="absolute top-20 right-4 w-96 max-h-[calc(100vh-8rem)] bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-20 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">Quotation</h3>
              <button
                onClick={() => setShowQuotation(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <QuotationPanel planningResult={planningResult} />
            </div>
          </div>
        )}

        {/* Chat Interface */}
        {showChat && planningResult && (
          <div className="absolute bottom-4 right-4 w-96 h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-20 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-agriplast-green-600 text-white">
              <h3 className="font-semibold">Chat Assistant</h3>
              <button
                onClick={() => setShowChat(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <EnhancedChatInterface
                conversationHistory={conversationHistory}
                onSendMessage={handleChatMessage}
                planningResult={planningResult}
                onRestoreSnapshot={handleRestoreSnapshot}
              />
            </div>
          </div>
        )}

        {/* Customer Preferences Modal */}
        <CustomerPreferencesModal
          isOpen={showPreferencesModal}
          onClose={() => {
            setShowPreferencesModal(false);
            setPendingCoordinates(null);
          }}
          onSubmit={handlePreferencesSubmit}
        />
      </div>
    </main>
  );
}
