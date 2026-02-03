'use client';

import React, { useState, useRef, useEffect } from 'react';
import { parseUserRequest, validatePolyhouseRequest } from '@/lib/services/nlpService';
import { saveChatMessage } from '@/lib/services/chatService';
import type { ChatMessage } from '@/lib/db';

interface ChatPanelProps {
  isReadOnly: boolean;
  polygonId: string | null;
  currentVersionId: string | null;
  currentPolyhouses: any[];
  onApplyRules: (userInstruction: string, versionComment: string, chatHistory?: Array<{ role: 'user' | 'system' | 'clarification'; message: string }>) => Promise<void>;
  onRevert: (versionId: string) => Promise<void>;
  versions?: Array<{
    id: string;
    version_number: number;
    version_comment?: string;
    created_at: string;
  }>;
}

export function ChatPanel({
  isReadOnly,
  polygonId,
  currentVersionId,
  currentPolyhouses,
  onApplyRules,
  onRevert,
  versions = [],
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [clarificationState, setClarificationState] = useState<{
    questions: string[];
    pendingRule: any;
    originalMessage: string;
  } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history when polygonId changes
  useEffect(() => {
    if (polygonId) {
      loadChatHistory();
    }
  }, [polygonId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async () => {
    if (!polygonId) return;
    try {
      // Use secure API route instead of direct database call
      const response = await fetch(`/api/polygons/chat?polygonId=${encodeURIComponent(polygonId)}`);
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

  const addMessage = async (
    role: 'user' | 'system' | 'clarification',
    message: string,
    metadata?: any
  ) => {
    if (!polygonId) return;

    try {
      // Use secure API route instead of direct database call
      const response = await fetch('/api/polygons/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polygonId,
          versionId: currentVersionId,
          role,
          message,
          metadata,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save message');
      }

      const data = await response.json();
      if (data.message) {
        setMessages(prev => [...prev, data.message]);
      }
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing || isReadOnly) return;

    const userMessage = input.trim();
    setInput('');
    setIsProcessing(true);

    // Add user message to chat
    await addMessage('user', userMessage);

    // If we're in clarification mode, treat this as an answer
    if (clarificationState) {
      await handleClarificationAnswer(userMessage);
      setIsProcessing(false);
      return;
    }

    // Validate request
    if (!validatePolyhouseRequest(userMessage)) {
      await addMessage(
        'system',
        'This request is not related to polyhouse design. Please only ask about modifying polyhouses, blocks, water bodies, or design constraints.'
      );
      setIsProcessing(false);
      return;
    }

    // Parse the request
    try {
      const parsed = await parseUserRequest(userMessage, currentPolyhouses, messages);

      if (!parsed.isPolyhouseRelated) {
        await addMessage('system', parsed.error || 'This request is not related to polyhouse design.');
        setIsProcessing(false);
        return;
      }

      if (parsed.needsClarification && parsed.clarificationQuestions) {
        // Store clarification state
        setClarificationState({
          questions: parsed.clarificationQuestions,
          pendingRule: parsed.rules?.[0],
          originalMessage: userMessage,
        });

        // Add clarification questions
        for (const question of parsed.clarificationQuestions) {
          await addMessage('clarification', question);
        }
      } else if (parsed.rules && parsed.rules.length > 0) {
        // Apply the user's instruction (the chat message) - backend will extract rules
        await applyRules(userMessage, userMessage);
      } else {
        await addMessage('system', parsed.error || 'I couldn\'t understand your request. Please try rephrasing.');
      }
    } catch (error) {
      console.error('Error processing request:', error);
      await addMessage('system', 'An error occurred while processing your request. Please try again.');
    }

    setIsProcessing(false);
  };

  const handleClarificationAnswer = async (answer: string) => {
    if (!clarificationState) return;

    // Combine original message with answer
    const combinedMessage = `${clarificationState.originalMessage}. ${answer}`;

    // Re-parse with the additional information
    const parsed = await parseUserRequest(combinedMessage, currentPolyhouses, messages);

    if (parsed.rules && parsed.rules.length > 0) {
      // Clear clarification state
      setClarificationState(null);
      // Apply the combined message (backend will extract rules)
      await applyRules(combinedMessage, combinedMessage);
    } else if (parsed.needsClarification && parsed.clarificationQuestions) {
      // Still needs more clarification
      setClarificationState({
        questions: parsed.clarificationQuestions,
        pendingRule: parsed.rules?.[0] || clarificationState.pendingRule,
        originalMessage: combinedMessage,
      });

      for (const question of parsed.clarificationQuestions) {
        await addMessage('clarification', question);
      }
    } else {
      // Max clarifications reached or error
      setClarificationState(null);
      await addMessage('system', parsed.error || 'I still need more information. Please try again with more details.');
    }
  };

  const applyRules = async (userMessage: string, comment: string) => {
    try {
      await addMessage('system', 'Analyzing your instructions and planning execution...');
      
      // Get current chat history for context
      const currentHistory = messages.map(msg => ({
        role: msg.role,
        message: msg.message
      }));
      
      await onApplyRules(userMessage, comment, currentHistory);
      await addMessage('system', 'Changes applied successfully! The polyhouse layout has been updated.');
    } catch (error) {
      console.error('Error applying rules:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to apply changes';
      await addMessage('system', `Failed to apply changes: ${errorMessage}. Please try again or rephrase your request.`);
    }
  };

  const handleRevert = async (versionId: string) => {
    if (!confirm('Are you sure you want to revert to this version? This will create a new version with the previous settings.')) {
      return;
    }

    try {
      await addMessage('system', 'Reverting to previous version...');
      await onRevert(versionId);
      await addMessage('system', 'Reverted successfully!');
      await loadChatHistory(); // Reload to show updated history
    } catch (error) {
      console.error('Error reverting:', error);
      await addMessage('system', 'Failed to revert. Please try again.');
    }
  };

  return (
    <div className={`fixed right-4 top-20 z-20 flex flex-col ${isCollapsed ? 'w-12' : 'w-96'} max-w-[90vw] max-h-[calc(100vh-6rem)] bg-white rounded-lg shadow-xl border border-gray-200 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!isCollapsed && (
          <h3 className="font-mono font-semibold text-gray-900">Polyhouse Assistant</h3>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {!isCollapsed && isReadOnly && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Draw polygon first
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[400px]">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                {isReadOnly ? (
                  <p>Draw a polygon and calculate polyhouses to start chatting.</p>
                ) : (
                  <p>Ask me to modify your polyhouse layout!</p>
                )}
              </div>
            ) : (
              messages.map((msg) => {
                const isExpanded = expandedMessages.has(msg.id);
                const lines = msg.message.split('\n');
                const shouldShowExpand = lines.length > 3 && !isExpanded;
                const displayText = shouldShowExpand 
                  ? lines.slice(0, 3).join('\n') + '\n...'
                  : msg.message;
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-white'
                          : msg.role === 'clarification'
                          ? 'bg-yellow-50 text-yellow-900 border border-yellow-200'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{displayText}</p>
                      {shouldShowExpand && (
                        <button
                          onClick={() => setExpandedMessages(prev => new Set(prev).add(msg.id))}
                          className={`mt-2 text-xs underline ${
                            msg.role === 'user' ? 'text-white/80' : 'text-gray-600'
                          } hover:opacity-80`}
                        >
                          Expand
                        </button>
                      )}
                      {isExpanded && lines.length > 3 && (
                        <button
                          onClick={() => setExpandedMessages(prev => {
                            const next = new Set(prev);
                            next.delete(msg.id);
                            return next;
                          })}
                          className={`mt-2 text-xs underline ${
                            msg.role === 'user' ? 'text-white/80' : 'text-gray-600'
                          } hover:opacity-80`}
                        >
                          Collapse
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <span>Processing...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Version History (if available) */}
          {versions.length > 1 && (
            <div className="border-t border-gray-200 p-4 max-h-[150px] overflow-y-auto">
              <div className="text-xs font-mono font-semibold text-gray-700 mb-2">Version History</div>
              <div className="space-y-1">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between text-xs p-2 hover:bg-gray-50 rounded"
                  >
                    <div>
                      <span className="font-medium">v{version.version_number}</span>
                      {version.version_comment && (
                        <span className="text-gray-500 ml-2">{version.version_comment}</span>
                      )}
                    </div>
                    {version.id !== currentVersionId && (
                      <button
                        onClick={() => handleRevert(version.id)}
                        className="text-primary hover:text-primary-dark text-xs"
                      >
                        Revert
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={isReadOnly ? "Draw polygon first..." : "Ask to modify polyhouses..."}
                disabled={isReadOnly || isProcessing}
                className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                rows={2}
              />
              <button
                type="submit"
                disabled={isReadOnly || isProcessing || !input.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
