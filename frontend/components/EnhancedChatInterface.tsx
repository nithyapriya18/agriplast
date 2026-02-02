'use client';

import { useState, useRef, useEffect } from 'react';
import { ConversationMessage, PlanningResult } from '@shared/types';
import { Send, Bot, User, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, RotateCcw, Brain, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface EnhancedMessage extends ConversationMessage {
  id: string;
  snapshot?: {
    planningResult: PlanningResult;
  };
  feedback?: 'up' | 'down' | null;
  workflow?: {
    thinking?: string;
    configuration?: any;
    error?: string;
  };
}

interface EnhancedChatInterfaceProps {
  conversationHistory: ConversationMessage[];
  onSendMessage: (message: string) => void;
  planningResult?: PlanningResult | null;
  onRestoreSnapshot?: (snapshot: PlanningResult) => void;
}

export default function EnhancedChatInterface({
  conversationHistory,
  onSendMessage,
  planningResult,
  onRestoreSnapshot,
}: EnhancedChatInterfaceProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [expandedWorkflow, setExpandedWorkflow] = useState<Set<string>>(new Set());
  const [messageFeedback, setMessageFeedback] = useState<Map<string, 'up' | 'down' | null>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Convert ConversationMessage to EnhancedMessage with IDs and snapshots
  const enhancedMessages: EnhancedMessage[] = conversationHistory.map((msg, index) => ({
    ...msg,
    id: `msg-${index}`,
    snapshot: planningResult ? { planningResult } : undefined,
    feedback: messageFeedback.get(`msg-${index}`) || null,
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory]);

  const handleSend = async () => {
    if (!inputMessage.trim() || sending) return;

    setSending(true);
    setInputMessage('');

    try {
      await onSendMessage(inputMessage);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleMessageExpansion = (messageId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const toggleWorkflowExpansion = (messageId: string) => {
    setExpandedWorkflow(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const handleFeedback = (messageId: string, feedback: 'up' | 'down') => {
    setMessageFeedback(prev => {
      const next = new Map(prev);
      const current = next.get(messageId);
      next.set(messageId, current === feedback ? null : feedback);
      return next;
    });
  };

  const handleRestoreClick = (message: EnhancedMessage) => {
    if (message.snapshot && onRestoreSnapshot) {
      onRestoreSnapshot(message.snapshot.planningResult);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-agriplast-green-700 to-agriplast-green-600 text-white p-4 shadow-lg">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5" />
          AI Assistant
        </h2>
        <p className="text-xs text-agriplast-green-100 mt-1">
          Ask about your plan or request changes
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {enhancedMessages.map((message) => {
          const isExpanded = expandedMessages.has(message.id);
          const isWorkflowExpanded = expandedWorkflow.has(message.id);
          const isAssistant = message.role === 'assistant';

          return (
            <div
              key={message.id}
              className={`flex gap-3 ${
                isAssistant ? 'justify-start' : 'justify-end'
              }`}
            >
              {isAssistant && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-md">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}

              <div className={`max-w-[85%] flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
                {/* Message bubble */}
                <div
                  className={`rounded-2xl p-4 shadow-md select-text ${
                    isAssistant
                      ? 'bg-white border border-gray-200'
                      : 'bg-gradient-to-br from-agriplast-green-600 to-agriplast-green-700 text-white'
                  }`}
                >
                  {/* Restore button */}
                  {isAssistant && message.snapshot && onRestoreSnapshot && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestoreClick(message);
                      }}
                      className="flex items-center gap-1 text-xs text-agriplast-green-600 hover:text-agriplast-green-700 bg-agriplast-green-50 hover:bg-agriplast-green-100 px-2 py-1 rounded mb-2 transition-colors"
                    >
                      <RotateCcw size={12} />
                      <span>Restore this state</span>
                    </button>
                  )}

                  {/* Content */}
                  <div className={`prose prose-sm max-w-none ${isAssistant ? 'prose-gray' : 'prose-invert'}`}>
                    {isAssistant ? (
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>

                  {/* Timestamp and feedback */}
                  <div className={`flex items-center justify-between mt-3 pt-3 border-t ${isAssistant ? 'border-gray-100' : 'border-white/20'}`}>
                    <p className={`text-xs ${isAssistant ? 'text-gray-500' : 'text-white/70'}`}>
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>

                    {isAssistant && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFeedback(message.id, 'up');
                          }}
                          className={`p-1.5 rounded-full transition-colors ${
                            message.feedback === 'up'
                              ? 'bg-green-100 text-green-600'
                              : 'hover:bg-gray-100 text-gray-400'
                          }`}
                        >
                          <ThumbsUp size={14} fill={message.feedback === 'up' ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFeedback(message.id, 'down');
                          }}
                          className={`p-1.5 rounded-full transition-colors ${
                            message.feedback === 'down'
                              ? 'bg-red-100 text-red-600'
                              : 'hover:bg-gray-100 text-gray-400'
                          }`}
                        >
                          <ThumbsDown size={14} fill={message.feedback === 'down' ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Workflow expansion */}
                  {isAssistant && message.workflow && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWorkflowExpansion(message.id);
                        }}
                        className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        {isWorkflowExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <Settings size={14} className="text-blue-500" />
                        <span className="font-medium">Agent Workflow</span>
                      </button>
                      {isWorkflowExpanded && (
                        <div className="mt-2 space-y-2">
                          {message.workflow.thinking && (
                            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                              <div className="flex items-center gap-2 mb-1">
                                <Brain size={14} className="text-purple-600" />
                                <span className="text-xs font-semibold text-purple-900">Reasoning</span>
                              </div>
                              <p className="text-xs text-purple-800">{message.workflow.thinking}</p>
                            </div>
                          )}
                          {message.workflow.configuration && (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex items-center gap-2 mb-1">
                                <Settings size={14} className="text-blue-600" />
                                <span className="text-xs font-semibold text-blue-900">Configuration</span>
                              </div>
                              <pre className="text-xs text-blue-800 overflow-x-auto">
                                {JSON.stringify(message.workflow.configuration, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Context dropdown for user messages */}
                {!isAssistant && message.snapshot && (
                  <button
                    onClick={() => toggleMessageExpansion(message.id)}
                    className="mt-2 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {isExpanded ? 'Hide context' : 'Show context sent'}
                  </button>
                )}
                {!isAssistant && isExpanded && message.snapshot && (
                  <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200 shadow-sm text-xs text-gray-600 max-w-full">
                    <p className="font-semibold mb-2">Context sent with this message:</p>
                    <div className="space-y-1">
                      <p>• {message.snapshot.planningResult.polyhouses.length} polyhouses</p>
                      <p>• {message.snapshot.planningResult.metadata.totalPolyhouseArea.toFixed(0)} m² area</p>
                      <p>• {message.snapshot.planningResult.metadata.utilizationPercentage.toFixed(1)}% utilization</p>
                    </div>
                  </div>
                )}
              </div>

              {!isAssistant && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-agriplast-green-600 to-agriplast-green-700 flex items-center justify-center shadow-md">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4 bg-white shadow-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about materials, costs, or request changes..."
            disabled={sending}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-agriplast-green-500 focus:border-transparent disabled:bg-gray-100 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!inputMessage.trim() || sending}
            className="px-5 py-3 bg-gradient-to-r from-agriplast-green-600 to-agriplast-green-700 text-white rounded-xl hover:shadow-lg disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium min-w-[100px]"
          >
            {sending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Try: "Why did you choose this layout?" or "Maximize my space utilization"
        </p>
      </div>
    </div>
  );
}
