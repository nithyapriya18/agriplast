'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { PlanningResult, Polyhouse, ConversationMessage } from '@shared/types';
import QuotationPanel from '@/components/QuotationPanel';
import EnhancedChatInterface from '@/components/EnhancedChatInterface';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Download } from 'lucide-react';
import { generateProjectPDF } from '@/lib/pdfExport';

const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <Loader2 className="w-8 h-8 animate-spin text-agriplast-green-600" />
    </div>
  ),
});

interface Project {
  id: string;
  name: string;
  location_name: string | null;
  land_boundary: any;
  land_area_sqm: number;
  polyhouse_count: number;
  total_coverage_sqm: number;
  utilization_percentage: number;
  estimated_cost: number;
  configuration: any;
  polyhouses: Polyhouse[];
  quotation: any;
  terrain_analysis: any;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuotation, setShowQuotation] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modifiedBoundary, setModifiedBoundary] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [planningResultId, setPlanningResultId] = useState<string | null>(null);

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?redirectTo=/projects/' + id);
        return;
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      console.log('Loaded project:', data);
      console.log('Land boundary:', data?.land_boundary);
      console.log('Polyhouses raw:', data?.polyhouses);
      console.log('Polyhouses type:', typeof data?.polyhouses);
      console.log('Polyhouse count:', data?.polyhouses?.length);

      // CRITICAL FIX: Ensure polyhouses is always an array
      if (data && (!data.polyhouses || !Array.isArray(data.polyhouses))) {
        console.warn('⚠️ Polyhouses is null/undefined or not an array. Setting to empty array.');
        data.polyhouses = [];
      }

      // Log sample polyhouse structure if available
      if (data?.polyhouses && data.polyhouses.length > 0) {
        console.log('=== POLYHOUSE DEBUG INFO ===');
        console.log('Total polyhouses:', data.polyhouses.length);
        console.log('Sample polyhouse structure:', {
          id: data.polyhouses[0].id,
          blocksCount: data.polyhouses[0].blocks?.length,
          hasBlocks: !!data.polyhouses[0].blocks,
          hasBounds: !!data.polyhouses[0].bounds,
          boundsLength: data.polyhouses[0].bounds?.length,
          sampleBound: data.polyhouses[0].bounds?.[0],
          firstBlock: data.polyhouses[0].blocks?.[0],
          hasCorners: data.polyhouses[0].blocks?.[0]?.corners?.length > 0,
          cornersLength: data.polyhouses[0].blocks?.[0]?.corners?.length,
          sampleCorner: data.polyhouses[0].blocks?.[0]?.corners?.[0],
        });
        console.log('Full first polyhouse:', JSON.stringify(data.polyhouses[0], null, 2));

        // FIX: Regenerate corners for blocks that don't have them
        let needsRegeneration = false;
        data.polyhouses.forEach((polyhouse: any) => {
          if (!polyhouse.blocks || polyhouse.blocks.length === 0) return;

          // Check if any block is missing corners
          const hasMissingCorners = polyhouse.blocks.some((block: any) =>
            !block.corners || block.corners.length === 0
          );

          if (hasMissingCorners) {
            needsRegeneration = true;
            console.warn(`Polyhouse ${polyhouse.id} has blocks missing corners, regenerating...`);

            // Calculate polyhouse center from bounds (geographic coordinates)
            if (!polyhouse.bounds || polyhouse.bounds.length === 0) {
              console.error(`Cannot regenerate corners: polyhouse ${polyhouse.id} has no bounds`);
              return;
            }

            const centerLng = polyhouse.bounds.reduce((sum: number, p: any) => sum + p.x, 0) / polyhouse.bounds.length;
            const centerLat = polyhouse.bounds.reduce((sum: number, p: any) => sum + p.y, 0) / polyhouse.bounds.length;

            polyhouse.blocks.forEach((block: any) => {
              if (!block.corners || block.corners.length === 0) {
                const angleRad = (block.rotation || 0) * Math.PI / 180;

                // Block position is in LOCAL coordinates (meters, already rotated)
                const blockPosX = block.position?.x || 0;
                const blockPosY = block.position?.y || 0;

                // Create the 4 corners of the block (standard 8m x 4m rectangle)
                const localCorners = [
                  { x: 0, y: 0 },
                  { x: block.width, y: 0 },
                  { x: block.width, y: block.height },
                  { x: 0, y: block.height },
                ];

                // Rotate each corner and add to block position (all in local space)
                const rotatedLocalCorners = localCorners.map((corner: any) => {
                  const rotatedX = corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad);
                  const rotatedY = corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad);

                  return {
                    x: blockPosX + rotatedX,
                    y: blockPosY + rotatedY,
                  };
                });

                // Convert from local meters to geographic coordinates
                block.corners = rotatedLocalCorners.map((corner: any) => {
                  const cornerLat = centerLat + corner.y / 111320;
                  const cornerLng = centerLng + corner.x / (111320 * Math.cos(centerLat * Math.PI / 180));

                  return {
                    x: cornerLng,
                    y: cornerLat,
                  };
                });

                console.log(`  ✓ Regenerated ${block.corners.length} corners for block ${block.id}`);
              }
            });
          }
        });

        if (needsRegeneration) {
          console.log('✓ Finished regenerating corners for all blocks');
        }
      }

      setProject(data);

      // Load the project into the backend's planningResults Map for chat
      // This is necessary because the chat API expects the planning result to be in memory
      try {
        const planningResultForChat: PlanningResult = {
          success: true,
          landArea: {
            id: data.id,
            name: data.location_name || 'Unnamed',
            coordinates: data.land_boundary || [],
            centroid: (() => {
              if (data.land_boundary && data.land_boundary.length > 0) {
                const lat = data.land_boundary.reduce((sum: number, c: any) => sum + c.lat, 0) / data.land_boundary.length;
                const lng = data.land_boundary.reduce((sum: number, c: any) => sum + c.lng, 0) / data.land_boundary.length;
                return { lat, lng };
              }
              return { lat: 0, lng: 0 };
            })(),
            area: data.land_area_sqm,
            createdAt: new Date(data.created_at),
          },
          polyhouses: Array.isArray(data.polyhouses) ? data.polyhouses : [],
          configuration: data.configuration,
          quotation: data.quotation,
          warnings: [],
          errors: [],
          metadata: {
            numberOfPolyhouses: data.polyhouse_count,
            totalPolyhouseArea: data.total_coverage_sqm,
            totalPolyhouseAreaWithGutters: data.total_coverage_sqm,
            totalLandArea: data.land_area_sqm,
            utilizationPercentage: data.utilization_percentage,
            computationTime: 0,
            unbuildableRegions: [],
            constraintViolations: [],
          },
          terrainAnalysis: data.terrain_analysis,
          regulatoryCompliance: undefined,
        };

        // Store this in the backend's planningResults Map by making a POST request
        // We'll use the project ID as the planning result ID
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/planning/load`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planningResultId: data.id,
            planningResult: planningResultForChat,
          }),
        });

        if (response.ok) {
          setPlanningResultId(data.id);
          console.log('Project loaded into backend memory for chat');
        } else {
          console.warn('Failed to load project into backend memory, chat may not work');
          setPlanningResultId(data.id); // Still set it, user can try chatting
        }
      } catch (loadError) {
        console.warn('Failed to load project for chat:', loadError);
        setPlanningResultId(data.id); // Still set it, user can try chatting
      }
    } catch (error) {
      console.error('Error loading project:', error);
      alert('Failed to load project');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!project) return;

    setStatusUpdating(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', project.id);

      if (error) throw error;

      setProject({ ...project, status: newStatus });
      alert('Status updated successfully');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) throw error;

      alert('Project deleted successfully');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    }
  };

  const handleChatMessage = async (message: string) => {
    if (!project || !planningResultId) {
      alert('Unable to process chat. Please try refreshing the page.');
      return;
    }

    const userMessage: ConversationMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setConversationHistory(prev => [...prev, userMessage]);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planningResultId: planningResultId,
          message,
          conversationHistory: [...conversationHistory, userMessage],
        }),
      });

      const data = await response.json();

      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };
      setConversationHistory(prev => [...prev, assistantMessage]);

      // If the backend returns an updated planning result, update the project
      if (data.updatedPlanningResult) {
        const supabase = createClient();
        const { error } = await supabase
          .from('projects')
          .update({
            polyhouses: data.updatedPlanningResult.polyhouses,
            configuration: data.updatedPlanningResult.configuration,
            quotation: data.updatedPlanningResult.quotation,
            polyhouse_count: data.updatedPlanningResult.polyhouses.length,
            total_coverage_sqm: data.updatedPlanningResult.metadata.totalPolyhouseAreaWithGutters,
            utilization_percentage: data.updatedPlanningResult.metadata.utilizationPercentage,
            estimated_cost: data.updatedPlanningResult.quotation.totalCost,
            updated_at: new Date().toISOString(),
          })
          .eq('id', project.id);

        if (error) {
          console.error('Error updating project:', error);
        } else {
          // Reload the project to show updated data
          await loadProject();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ConversationMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setConversationHistory(prev => [...prev, errorMessage]);
    }
  };

  const handleRestoreSnapshot = (snapshot: PlanningResult) => {
    // For existing projects, we'd need to save the snapshot to the database
    alert('Snapshot restore is not yet supported for saved projects. Please use the chat to request changes.');
  };

  const handleExportPDF = async () => {
    if (!project || !planningResult) {
      alert('Unable to export. Project data is not available.');
      return;
    }

    try {
      await generateProjectPDF({
        projectName: project.name,
        locationName: project.location_name || 'Not specified',
        landAreaSqm: project.land_area_sqm,
        polyhouseCount: project.polyhouse_count,
        totalCoverageSqm: project.total_coverage_sqm,
        utilizationPercentage: project.utilization_percentage,
        estimatedCost: project.estimated_cost,
        polyhouses: planningResult.polyhouses,
        quotation: project.quotation,
        createdAt: project.created_at,
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const handleBoundaryComplete = (boundary: any) => {
    if (editMode) {
      setModifiedBoundary(boundary);
    }
  };

  const handleSave = async (saveAsNew: boolean) => {
    if (!project) return;
    if (!modifiedBoundary && !saveAsNew) {
      alert('No changes detected');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();

      const boundaryToUse = modifiedBoundary || project.land_boundary;

      // Trigger re-optimization with the new boundary
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/planning/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landArea: {
            name: project.location_name || 'Land Area',
            coordinates: boundaryToUse,
          },
          configuration: project.configuration,
        }),
      });

      if (!response.ok) throw new Error('Optimization failed');
      const optimizationResult = await response.json();

      if (saveAsNew) {
        // Create new project
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const newProject = {
          user_id: user.id,
          name: `${project.name} (Copy)`,
          location_name: project.location_name,
          land_boundary: boundaryToUse,
          land_area_sqm: optimizationResult.metadata.totalLandArea,
          polyhouse_count: optimizationResult.metadata.numberOfPolyhouses,
          total_coverage_sqm: optimizationResult.metadata.totalPolyhouseArea,
          utilization_percentage: optimizationResult.metadata.utilizationPercentage,
          estimated_cost: optimizationResult.quotation?.totalCost || 0,
          configuration: project.configuration,
          polyhouses: optimizationResult.polyhouses,
          quotation: optimizationResult.quotation,
          terrain_analysis: optimizationResult.terrainAnalysis,
          status: 'draft',
        };

        const { data, error } = await supabase
          .from('projects')
          .insert([newProject])
          .select()
          .single();

        if (error) throw error;

        alert('New project created successfully');
        router.push(`/projects/${data.id}`);
      } else {
        // Update existing project
        const { error } = await supabase
          .from('projects')
          .update({
            land_boundary: boundaryToUse,
            land_area_sqm: optimizationResult.metadata.totalLandArea,
            polyhouse_count: optimizationResult.metadata.numberOfPolyhouses,
            total_coverage_sqm: optimizationResult.metadata.totalPolyhouseArea,
            utilization_percentage: optimizationResult.metadata.utilizationPercentage,
            estimated_cost: optimizationResult.quotation?.totalCost || 0,
            polyhouses: optimizationResult.polyhouses,
            quotation: optimizationResult.quotation,
            terrain_analysis: optimizationResult.terrainAnalysis,
            updated_at: new Date().toISOString(),
          })
          .eq('id', project.id);

        if (error) throw error;

        alert('Project updated successfully');
        setEditMode(false);
        setModifiedBoundary(null);
        await loadProject(); // Reload the project to show updated data
      }
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      quoted: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      installed: 'bg-purple-100 text-purple-700',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Create PlanningResult object for components that need it
  const planningResult: PlanningResult | null = project ? {
    success: true,
    landArea: {
      id: project.id,
      name: project.location_name || 'Unnamed',
      coordinates: project.land_boundary || [],
      centroid: (() => {
        // Calculate centroid from coordinates
        if (project.land_boundary && project.land_boundary.length > 0) {
          const lat = project.land_boundary.reduce((sum: number, c: any) => sum + c.lat, 0) / project.land_boundary.length;
          const lng = project.land_boundary.reduce((sum: number, c: any) => sum + c.lng, 0) / project.land_boundary.length;
          return { lat, lng };
        }
        return { lat: 0, lng: 0 };
      })(),
      area: project.land_area_sqm,
      createdAt: new Date(project.created_at),
    },
    polyhouses: Array.isArray(project.polyhouses) ? project.polyhouses : [],
    configuration: project.configuration,
    quotation: project.quotation,
    warnings: [],
    errors: [],
    metadata: {
      numberOfPolyhouses: project.polyhouse_count,
      totalPolyhouseArea: project.total_coverage_sqm,
      totalPolyhouseAreaWithGutters: project.total_coverage_sqm,
      totalLandArea: project.land_area_sqm,
      utilizationPercentage: project.utilization_percentage,
      computationTime: 0,
            unbuildableRegions: [],
            constraintViolations: [],
    },
    terrainAnalysis: project.terrain_analysis,
    regulatoryCompliance: undefined,
  } : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project || !planningResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Project not found</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 text-green-600 hover:text-green-700"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ←
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    {project.location_name} • Created {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {getStatusBadge(project.status)}

              <button
                onClick={() => setShowQuotation(!showQuotation)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                {showQuotation ? 'Hide' : 'Show'} Quotation
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Land Area</p>
              <p className="text-lg font-bold text-gray-900">{project.land_area_sqm.toFixed(0)} m²</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Polyhouses</p>
              <p className="text-lg font-bold text-gray-900">{project.polyhouse_count}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Utilization</p>
              <p className="text-lg font-bold text-gray-900">{project.utilization_percentage.toFixed(1)}%</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Estimated Cost</p>
              <p className="text-lg font-bold text-gray-900">₹{project.estimated_cost.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 relative overflow-hidden" id="project-map-container">
        <MapComponent
          landBoundary={(() => {
            console.log('Passing landBoundary to MapComponent:', planningResult.landArea.coordinates);
            return planningResult.landArea.coordinates;
          })()}
          polyhouses={(() => {
            console.log('Passing polyhouses to MapComponent:', planningResult.polyhouses);
            return planningResult.polyhouses;
          })()}
          onBoundaryComplete={handleBoundaryComplete}
          loading={false}
          terrainAnalysis={planningResult.terrainAnalysis}
          regulatoryCompliance={planningResult.regulatoryCompliance}
          editMode={editMode}
        />

        {/* Actions Overlay */}
        <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Actions</h3>

          {!editMode ? (
            <>
              <button
                onClick={() => setShowChat(!showChat)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                {showChat ? 'Hide Chat' : 'Chat Assistant'}
              </button>

              <button
                onClick={handleExportPDF}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Export PDF
              </button>

              <button
                onClick={() => setEditMode(true)}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                Edit Project
              </button>

              <div>
                <label className="block text-sm text-gray-600 mb-2">Update Status</label>
                <select
                  value={project.status}
                  onChange={(e) => handleStatusUpdate(e.target.value)}
                  disabled={statusUpdating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="quoted">Quoted</option>
                  <option value="approved">Approved</option>
                  <option value="installed">Installed</option>
                </select>
              </div>

              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                Delete Project
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-2">Edit mode enabled. Modify the land boundary on the map.</p>

              <button
                onClick={() => setEditMode(false)}
                disabled={saving}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Cancel
              </button>

              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>

              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save as New Project'}
              </button>
            </>
          )}
        </div>

        {/* Quotation Panel */}
        {showQuotation && (
          <div className="absolute top-4 right-4 w-96 max-h-[calc(100vh-2rem)] bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-20 flex flex-col">
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
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-green-600 text-white">
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
      </div>
    </main>
  );
}
