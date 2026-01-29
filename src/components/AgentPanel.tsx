import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Trash2, History, X, Coins, Zap, MessageSquare, RotateCcw, Wrench, FileCode, FolderPlus, Eye, Trash, RefreshCw, ClipboardList, HelpCircle, Plus, ImageIcon, Loader2, Download, Sparkles, Brain, Terminal, Globe, Folder, AlertTriangle, Crown, ShoppingCart } from 'lucide-react';
import { useStore, calculateCost, getContextWindow } from '../hooks/useStore';
import { api } from '../services/api';
import { memoryApi } from '../services/memoryApi';
import ModelSelector from './ModelSelector';
import MemoryPanel from './MemoryPanel';
import CommandApproval from './CommandApproval';
import { openFolderPicker } from './FolderPicker';
import { getUsageStatus, getWarningLevel, formatRemaining, TOKEN_PACKS, type SubscriptionPlan } from '../services/usageLimits';
import { tursoService } from '../services/tursoService';
import { open } from '@tauri-apps/plugin-shell';
import { getCheckoutUrl } from '../services/paymentService';

type AgentMode = 'chat' | 'agent' | 'plan' | 'question' | 'image' | 'memory';

// Image generation models
const IMAGE_MODELS = [
  { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL 1.0', provider: 'Stability AI' },
  { id: 'stabilityai/stable-diffusion-3', name: 'SD 3.0', provider: 'Stability AI' },
  { id: 'black-forest-labs/flux-schnell', name: 'FLUX Schnell', provider: 'Black Forest Labs' },
  { id: 'black-forest-labs/flux-pro', name: 'FLUX Pro', provider: 'Black Forest Labs' },
];

const IMAGE_SIZES = [
  { value: '512x512', label: '512x512' },
  { value: '768x768', label: '768x768' },
  { value: '1024x1024', label: '1024x1024' },
  { value: '1024x768', label: '1024x768 (Landscape)' },
  { value: '768x1024', label: '768x1024 (Portrait)' },
  { value: '1216x832', label: '1216x832 (Wide)' },
  { value: '832x1216', label: '832x1216 (Tall)' },
];

interface GeneratedImage {
  url: string;
  prompt: string;
  timestamp: number;
}

interface ImageGenSettings {
  prompt: string;
  negativePrompt: string;
  model: string;
  size: string;
  count: number;
  seed?: number;
  steps: number;
  guidance: number;
}

// Tool definitions for file operations
const AGENT_TOOLS: import('../services/api').ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file at the given path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The file path relative to workspace root' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file with the given content',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The file path relative to workspace root' },
          content: { type: 'string', description: 'The content to write to the file' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a file or directory (moves to trash)',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The file or directory path to delete' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List all files and directories in a given path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The directory path to list (use "." for workspace root)' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_directory',
      description: 'Create a new directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The directory path to create' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for text content across files in the workspace',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The text to search for' },
          path: { type: 'string', description: 'Directory to search in (optional, defaults to workspace root)' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Execute a terminal/shell command. Commands require user approval before execution. Use for tasks like npm install, git commands, build scripts, or any shell commands.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          workingDirectory: { type: 'string', description: 'Working directory for the command (optional, defaults to workspace root)' },
          reason: { type: 'string', description: 'Brief explanation of why this command is needed' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information. Use for finding documentation, news, tutorials, or any information that might be more current than your training data.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          count: { type: 'string', description: 'Number of results to return (default 5, max 10)' }
        },
        required: ['query']
      }
    }
  }
];

const SYSTEM_PROMPTS: Record<AgentMode, string> = {
  chat: 'You are SentinelOps, an AI assistant helping developers with their code. Be concise and helpful. Answer questions, explain code, and provide guidance.',

  agent: `You are SentinelOps, an intelligent AI coding assistant with the ability to read, write, and manage files in the user's workspace.

## Your Capabilities
- Read and understand code files
- Write new files or modify existing ones
- Create directories and organize project structure
- Search through code to find specific patterns
- Delete files (safely moved to trash)
- Execute terminal commands (requires user approval)
- Search the web for current information

## How to Behave

### For Complex Tasks (new features, refactoring, multi-file changes):
1. **First, explore** - Use tools to read relevant files and understand the codebase
2. **Create a plan** - Present a clear implementation plan:

   ## Plan
   1. [Step with file and changes]
   2. [Step with file and changes]
   ...

   **Ready to proceed?**

3. **Wait for approval** - Only execute after user confirms

### For Unclear Requests:
Ask 2-3 clarifying questions before proceeding:

**Quick questions before I start:**
1. [Question about requirement]
2. [Question about preference]

### For Simple Tasks (small fixes, single file edits, quick questions):
Just do it directly - no need to plan or ask questions.

## Guidelines
- Be concise and helpful
- Match existing code style in the project
- Explain what you're doing as you work
- Ask for confirmation before destructive changes (deletes)
- If something fails, explain why and suggest alternatives`,

  plan: `You are SentinelOps, an AI coding assistant in PLANNING MODE. You MUST create a detailed plan before any implementation.

## Process
1. **Explore First** - Read relevant files to understand the codebase
2. **Create Detailed Plan**:

## Implementation Plan

### Overview
[What will be accomplished]

### Steps
1. **[filename]** - [specific changes]
2. **[filename]** - [specific changes]
...

### Considerations
- [Risks or trade-offs]
- [Dependencies needed]
- [Alternative approaches]

**Shall I proceed with this plan?**

3. **Wait for Approval** - Do NOT execute until user confirms
4. **Execute** - Implement step by step, showing progress`,

  question: `You are SentinelOps, an AI coding assistant in CLARIFICATION MODE. You MUST ask questions before doing any work.

## Process
Ask 2-4 focused questions about:
- Specific requirements or acceptance criteria
- Edge cases and error handling
- Preferred patterns or libraries
- Integration with existing code
- Constraints (performance, compatibility)

## Format

**Before I help with this, I need to understand a few things:**

1. [Specific question about the requirement]
2. [Question about preferences/approach]
3. [Question about constraints/edge cases]

Once answered, proceed with the task using the information gathered.`,

  image: '', // Image mode doesn't use text chat - handled separately
  memory: '' // Memory mode uses the MemoryPanel component
};

// Execute a tool call
interface ToolResult {
  success: boolean;
  result: string;
  requiresApproval?: boolean;
  pendingCommandId?: string;
  toolCallId?: string;
}

async function executeTool(
  name: string,
  args: Record<string, string>,
  toolCallId: string,
  addPendingCommand: (cmd: { toolCallId: string; command: string; workingDirectory: string; reason?: string }) => string,
  chatWorkingDirectory: string | null
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'read_file': {
        const res = await api.read(args.path);
        if (res.ok && res.data) {
          return { success: true, result: res.data.content };
        }
        return { success: false, result: res.error?.message || 'Failed to read file' };
      }
      case 'write_file': {
        const res = await api.write(args.path, args.content);
        if (res.ok && res.data) {
          return { success: true, result: `File written successfully: ${args.path} (${res.data.bytesWritten} bytes)` };
        }
        return { success: false, result: res.error?.message || 'Failed to write file' };
      }
      case 'delete_file': {
        const res = await api.delete(args.path, { recursive: true });
        if (res.ok && res.data) {
          return { success: true, result: `File deleted: ${args.path}` };
        }
        return { success: false, result: res.error?.message || 'Failed to delete file' };
      }
      case 'list_directory': {
        const res = await api.list(args.path || '.', false, false);
        if (res.ok && res.data) {
          const entries = res.data.entries.map(e =>
            `${e.type === 'directory' ? '📁' : '📄'} ${e.name}`
          ).join('\n');
          return { success: true, result: entries || '(empty directory)' };
        }
        return { success: false, result: res.error?.message || 'Failed to list directory' };
      }
      case 'create_directory': {
        const res = await api.mkdir(args.path);
        if (res.ok && res.data) {
          return { success: true, result: `Directory created: ${args.path}` };
        }
        return { success: false, result: res.error?.message || 'Failed to create directory' };
      }
      case 'search_files': {
        const res = await api.search(args.query, { path: args.path || '.' });
        if (res.ok && res.data) {
          if (res.data.matches.length === 0) {
            return { success: true, result: 'No matches found' };
          }
          const matches = res.data.matches.slice(0, 20).map(m =>
            `${m.path}:${m.line}: ${m.text.trim()}`
          ).join('\n');
          return { success: true, result: `Found ${res.data.count} matches:\n${matches}${res.data.truncated ? '\n...(truncated)' : ''}` };
        }
        return { success: false, result: res.error?.message || 'Search failed' };
      }
      case 'run_command': {
        // Don't execute - add to pending commands for user approval
        // Use chat working directory as the base, with optional override from args
        const effectiveWorkingDir = args.workingDirectory || chatWorkingDirectory || '.';
        const cmdId = addPendingCommand({
          toolCallId,
          command: args.command,
          workingDirectory: effectiveWorkingDir,
          reason: args.reason,
        });
        return {
          success: true,
          result: `Command "${args.command}" requires user approval. Working directory: ${effectiveWorkingDir}. Waiting for user to approve or reject.`,
          requiresApproval: true,
          pendingCommandId: cmdId,
          toolCallId,
        };
      }
      case 'web_search': {
        const count = args.count ? parseInt(args.count) : 5;
        const res = await api.webSearch(args.query, count);
        if (res.ok && res.data) {
          if (res.data.results.length === 0) {
            return { success: true, result: 'No search results found' };
          }
          const formatted = res.data.results.map((r, i) =>
            `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.description}${r.age ? ` (${r.age})` : ''}`
          ).join('\n\n');
          return { success: true, result: `Web search results for "${args.query}":\n\n${formatted}` };
        }
        return { success: false, result: res.error?.message || 'Web search failed' };
      }
      default:
        return { success: false, result: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return { success: false, result: `Error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export default function AgentPanel() {
  const {
    agentGoal,
    setAgentGoal,
    agentResponse,
    setAgentResponse,
    isAgentRunning,
    setAgentRunning,
    conversationLog,
    currentConversationId,
    addToConversation,
    startNewConversation,
    clearConversation,
    chatHistory,
    saveConversationToHistory,
    loadConversation,
    deleteChatFromHistory,
    clearChatHistory,
    addNotification,
    llmConfigured,
    llmModel,
    setLlmModel,
    sessionStats,
    updateSessionStats,
    resetSessionStats,
    workspaceRoot,
    // Pending commands for approval
    pendingCommands,
    addPendingCommand,
    updatePendingCommand,
    clearPendingCommands,
    setAgentPaused,
    setPausedAtToolCallId,
    // Per-chat working directory
    currentChatWorkingDirectory,
    setCurrentChatWorkingDirectory,
    settings,
    // For opening settings to account tab
    openSettingsToCategory,
    // Auth and usage
    authUser,
    dailyUsage,
    incrementDailyUsage,
    bonusMessages,
    useBonusMessage,
  } = useStore();

  const [showBuyTokensModal, setShowBuyTokensModal] = useState(false);

  // Calculate usage status
  const userPlan: SubscriptionPlan = authUser?.subscription?.plan || 'free';
  const userRole = authUser?.role || 'user';
  const usageStatus = getUsageStatus(userPlan, dailyUsage.messageCount, bonusMessages, userRole);
  const warningLevel = usageStatus.isUnlimited ? 'normal' : getWarningLevel(usageStatus.percentUsed);

  const [lastResponseTokens, setLastResponseTokens] = useState<{
    prompt: number;
    completion: number;
    total: number;
    cost: number;
  } | null>(null);

  // Restore a chat from history
  const restoreChat = (chat: typeof chatHistory[0]) => {
    loadConversation(chat.id);
    setLastResponseTokens(null);
    setShowHistory(false);
    setToolsUsed([]);
    addNotification({ type: 'info', title: 'Chat restored', message: '' });
  };

  const [showHistory, setShowHistory] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll conversation
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [conversationLog, agentResponse]);

  const [agentMode, setAgentMode] = useState<AgentMode>('agent');
  const [toolsUsed, setToolsUsed] = useState<{ name: string; args: Record<string, string>; result: string }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pausedMessages, setPausedMessages] = useState<any[]>([]);

  // Handle command approval
  const handleCommandApproval = async (commandId: string) => {
    const command = pendingCommands.find(c => c.id === commandId);
    if (!command) return;

    updatePendingCommand(commandId, { status: 'executing' });

    try {
      // Execute the command via terminal API
      // Use command's working directory, fall back to chat working directory, then workspace root
      const execResult = await api.terminalExecute(command.command, {
        cwd: command.workingDirectory || currentChatWorkingDirectory || workspaceRoot || '.',
      });

      if (execResult.ok && execResult.data) {
        // Poll for output
        let output = '';
        let isRunning = true;
        const terminalId = execResult.data.terminalId;
        const maxPolls = 60; // Max 30 seconds
        let polls = 0;

        while (isRunning && polls < maxPolls) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const outputResult = await api.terminalOutput(terminalId);
          if (outputResult.ok && outputResult.data) {
            output = outputResult.data.output;
            isRunning = outputResult.data.isRunning;
          }
          polls++;
        }

        updatePendingCommand(commandId, {
          status: 'completed',
          result: output || '(Command completed with no output)',
        });

        // Resume the agent with the command result
        resumeAgentWithResult(command.toolCallId, output || '(Command completed with no output)');
      } else {
        const errorMsg = execResult.error?.message || 'Failed to execute command';
        updatePendingCommand(commandId, {
          status: 'completed',
          error: errorMsg,
        });
        resumeAgentWithResult(command.toolCallId, `Error: ${errorMsg}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      updatePendingCommand(commandId, {
        status: 'completed',
        error: errorMsg,
      });
      resumeAgentWithResult(command.toolCallId, `Error: ${errorMsg}`);
    }
  };

  // Handle command rejection
  const handleCommandRejection = (commandId: string) => {
    const command = pendingCommands.find(c => c.id === commandId);
    if (!command) return;

    updatePendingCommand(commandId, { status: 'rejected' });
    resumeAgentWithResult(command.toolCallId, 'User rejected the command execution.');
  };

  // Resume agent after approval/rejection
  const resumeAgentWithResult = async (toolCallId: string, result: string) => {
    setAgentPaused(false);
    setPausedAtToolCallId(null);

    if (pausedMessages.length === 0) return;

    try {
      // Add the tool result to paused messages and continue
      const toolResult = {
        tool_call_id: toolCallId,
        role: 'tool' as const,
        content: result,
      };

      const response = await api.chatCompletionWithTools(
        [...pausedMessages, toolResult],
        AGENT_TOOLS,
        { model: llmModel, maxTokens: 4096 }
      );

      setPausedMessages([]);

      if (response.ok && response.data?.content) {
        const assistantMessage = response.data.content;
        setAgentResponse(assistantMessage);

        addToConversation({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: assistantMessage,
          timestamp: Date.now(),
        });

        const usage = response.data.usage;
        if (usage) {
          const cost = calculateCost(usage.promptTokens, usage.completionTokens, llmModel);
          setLastResponseTokens({
            prompt: usage.promptTokens,
            completion: usage.completionTokens,
            total: usage.totalTokens,
            cost,
          });
          updateSessionStats(usage.promptTokens, usage.completionTokens, llmModel);

          // Log usage to database for admin tracking
          if (authUser && tursoService.isInitialized()) {
            tursoService.logUsage(
              authUser.id,
              llmModel,
              usage.promptTokens,
              usage.completionTokens,
              cost
            ).catch(err => console.error('Failed to log usage:', err));
          }
        }

        saveConversationToHistory();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addNotification({
        type: 'error',
        title: 'Failed to resume AI',
        message: errorMsg,
      });
    } finally {
      setAgentRunning(false);
    }
  };

  // Image generation state
  const [imageSettings, setImageSettings] = useState<ImageGenSettings>({
    prompt: '',
    negativePrompt: '',
    model: IMAGE_MODELS[0].id,
    size: '1024x1024',
    count: 1,
    steps: 30,
    guidance: 7.5,
  });
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const runAgent = async () => {
    if (!agentGoal.trim() || isAgentRunning) return;

    // Check usage limits
    if (!usageStatus.canSendMessage) {
      setShowBuyTokensModal(true);
      return;
    }

    // Use bonus message if daily limit reached
    if (usageStatus.isLimitReached) {
      useBonusMessage();
    } else {
      incrementDailyUsage();
    }

    const goal = agentGoal;
    setAgentGoal('');
    setAgentRunning(true);
    setAgentResponse(null);
    setToolsUsed([]);

    // Add user message to conversation
    addToConversation({
      id: crypto.randomUUID(),
      role: 'user',
      content: goal,
      timestamp: Date.now(),
    });

    try {
      // Fetch relevant memories for context injection
      let memoryContext = '';
      try {
        const contextForSearch = conversationLog.slice(-3).map(m => m.content).join('\n') + '\n' + goal;
        const memoryResponse = await memoryApi.getRelevantMemories(contextForSearch, 5);
        if (memoryResponse.ok && memoryResponse.data && memoryResponse.data.length > 0) {
          const memoryLines = memoryResponse.data.map(m => `- ${m.memory.content}`).join('\n');
          memoryContext = `\n\n## Relevant Context from Memory\nThe following information was remembered from previous interactions:\n${memoryLines}\n\nUse this context when relevant to the conversation.`;
        }
      } catch (memErr) {
        console.log('Memory retrieval skipped:', memErr);
      }

      // Build messages with the appropriate system prompt (enhanced with memory)
      const enhancedSystemPrompt = SYSTEM_PROMPTS[agentMode] + memoryContext;
      const messages = [
        { role: 'system' as const, content: enhancedSystemPrompt },
        ...conversationLog.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
        { role: 'user' as const, content: goal },
      ];

      // Enable tools ONLY for agent and plan modes
      const useTools = agentMode === 'agent' || agentMode === 'plan';

      let response;
      const usedTools: { name: string; args: Record<string, string>; result: string }[] = [];

      if (useTools) {
        // Use tool-enabled endpoint for agent/plan modes
        response = await api.chatCompletionWithTools(
          messages,
          AGENT_TOOLS,
          { model: llmModel, maxTokens: 4096 }
        );

        // Handle tool calls in a loop
        let iterations = 0;
        const maxIterations = 10;

        while (response.ok && response.data?.toolCalls && response.data.toolCalls.length > 0 && iterations < maxIterations) {
          iterations++;

          // Execute each tool call
          const toolResults: { tool_call_id: string; role: 'tool'; content: string }[] = [];
          let hasPendingApproval = false;

          for (const toolCall of response.data.toolCalls) {
            const args = JSON.parse(toolCall.function.arguments || '{}');
            const result = await executeTool(toolCall.function.name, args, toolCall.id, addPendingCommand, currentChatWorkingDirectory);

            usedTools.push({
              name: toolCall.function.name,
              args,
              result: result.result.substring(0, 500) + (result.result.length > 500 ? '...' : ''),
            });
            setToolsUsed([...usedTools]);

            // If command requires approval, pause and wait
            if (result.requiresApproval) {
              hasPendingApproval = true;
              setAgentPaused(true);
              setPausedAtToolCallId(toolCall.id);
              // Store current state for resuming later
              setPausedMessages([
                ...messages,
                { role: 'assistant' as const, content: response.data.content || '', tool_calls: response.data.toolCalls },
              ]);
              break; // Exit the tool execution loop, wait for approval
            }

            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: result.result,
            });
          }

          // If waiting for approval, exit the main loop
          if (hasPendingApproval) {
            return; // Will resume after approval
          }

          // Continue conversation with tool results
          response = await api.chatCompletionWithTools(
            [
              ...messages,
              { role: 'assistant' as const, content: response.data.content || '', tool_calls: response.data.toolCalls },
              ...toolResults,
            ],
            AGENT_TOOLS,
            { model: llmModel, maxTokens: 4096 }
          );
        }
      } else {
        // Use regular chat endpoint for chat/question modes (no tools)
        response = await api.chatCompletion(
          messages,
          { model: llmModel, maxTokens: 4096 }
        );
      }

      if (response.ok && response.data?.content) {
        const assistantMessage = response.data.content;
        setAgentResponse(assistantMessage);

        // Add assistant response to conversation
        addToConversation({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: assistantMessage,
          timestamp: Date.now(),
        });

        // Track token usage
        const usage = response.data.usage;
        if (usage) {
          const cost = calculateCost(usage.promptTokens, usage.completionTokens, llmModel);
          setLastResponseTokens({
            prompt: usage.promptTokens,
            completion: usage.completionTokens,
            total: usage.totalTokens,
            cost,
          });
          updateSessionStats(usage.promptTokens, usage.completionTokens, llmModel);

          // Log usage to database for admin tracking
          if (authUser && tursoService.isInitialized()) {
            tursoService.logUsage(
              authUser.id,
              llmModel,
              usage.promptTokens,
              usage.completionTokens,
              cost
            ).catch(err => console.error('Failed to log usage:', err));
          }
        }

        // Auto-save conversation to history
        saveConversationToHistory();

        // Refresh files if any file operations were performed
        if (usedTools.some(t => ['write_file', 'delete_file', 'create_directory'].includes(t.name))) {
          const files = await api.list('.', false, false);
          if (files.ok && files.data) {
            useStore.getState().setFiles(files.data.entries);
          }
        }
      } else {
        const errorMsg = response.error?.message || 'Unknown error';
        addNotification({
          type: 'error',
          title: 'AI request failed',
          message: errorMsg,
        });
        setAgentResponse(`Error: ${errorMsg}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addNotification({
        type: 'error',
        title: 'AI request failed',
        message: errorMsg,
      });
      setAgentResponse(`Error: ${errorMsg}`);
    } finally {
      setAgentRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (agentMode === 'image') {
        generateImages();
      } else {
        runAgent();
      }
    }
  };

  // Image generation
  const generateImages = async () => {
    if (!imageSettings.prompt.trim() || isGeneratingImage) return;

    setIsGeneratingImage(true);

    try {
      const [width, height] = imageSettings.size.split('x').map(Number);

      const response = await api.generateImage({
        prompt: imageSettings.prompt,
        negativePrompt: imageSettings.negativePrompt || undefined,
        model: imageSettings.model,
        width,
        height,
        numImages: imageSettings.count,
        steps: imageSettings.steps,
        guidanceScale: imageSettings.guidance,
        seed: imageSettings.seed,
      });

      if (response.ok && response.data?.images) {
        const newImages: GeneratedImage[] = response.data.images.map((url: string) => ({
          url,
          prompt: imageSettings.prompt,
          timestamp: Date.now(),
        }));
        setGeneratedImages(prev => [...newImages, ...prev]);
        addNotification({
          type: 'success',
          title: 'Images Generated',
          message: `${response.data.images.length} image(s) created`,
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Generation Failed',
          message: response.error?.message || 'Failed to generate images',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Generation Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const downloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `sentinelops-image-${Date.now()}-${index}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Download Failed',
        message: 'Could not download image',
      });
    }
  };

  if (!llmConfigured) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#1E1E1E] p-8 text-center">
        <Bot className="h-16 w-16 text-[#858585] mb-4" />
        <h2 className="text-lg font-medium mb-2">AI Not Configured</h2>
        <p className="text-sm text-[#858585] max-w-md">
          Set the <code className="bg-[#3C3C3C] px-1 rounded">LLM_API_KEY</code> environment variable
          to enable AI features.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#1E1E1E]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#3E3E42]">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[#007ACC]" />
          <span className="font-medium">AI Agent</span>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center bg-[#252526] rounded-lg p-0.5 border border-[#3E3E42]">
          <button
            onClick={() => setAgentMode('chat')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              agentMode === 'chat' ? 'bg-[#094771] text-white' : 'text-[#858585] hover:text-white'
            }`}
            title="Chat mode - just conversation"
          >
            <MessageSquare className="h-3 w-3 inline mr-1" />
            Chat
          </button>
          <button
            onClick={() => setAgentMode('agent')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              agentMode === 'agent' ? 'bg-[#094771] text-white' : 'text-[#858585] hover:text-white'
            }`}
            title="Agent mode - can read/write files"
          >
            <Wrench className="h-3 w-3 inline mr-1" />
            Agent
          </button>
          <button
            onClick={() => setAgentMode('plan')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              agentMode === 'plan' ? 'bg-[#094771] text-white' : 'text-[#858585] hover:text-white'
            }`}
            title="Plan mode - creates plan before executing"
          >
            <ClipboardList className="h-3 w-3 inline mr-1" />
            Plan
          </button>
          <button
            onClick={() => setAgentMode('question')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              agentMode === 'question' ? 'bg-[#094771] text-white' : 'text-[#858585] hover:text-white'
            }`}
            title="Question mode - asks clarifying questions first"
          >
            <HelpCircle className="h-3 w-3 inline mr-1" />
            Ask
          </button>
          <button
            onClick={() => setAgentMode('image')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              agentMode === 'image' ? 'bg-[#9C27B0] text-white' : 'text-[#858585] hover:text-white'
            }`}
            title="Image mode - generate images with AI"
          >
            <ImageIcon className="h-3 w-3 inline mr-1" />
            Image
          </button>
          <button
            onClick={() => setAgentMode('memory')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              agentMode === 'memory' ? 'bg-[#7B68EE] text-white' : 'text-[#858585] hover:text-white'
            }`}
            title="Memory mode - manage AI memories"
          >
            <Brain className="h-3 w-3 inline mr-1" />
            Memory
          </button>
        </div>

        {/* Model Selector */}
        <div className="flex-1 max-w-xs">
          <ModelSelector
            value={llmModel}
            onChange={setLlmModel}
            disabled={isAgentRunning}
            onUpgradeClick={() => openSettingsToCategory('account')}
          />
        </div>

        {/* Usage Indicator */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
            usageStatus.isUnlimited
              ? 'bg-[#1E3A2E] border-[#89D185] text-[#89D185]'
              : warningLevel === 'exceeded'
              ? 'bg-[#3A1E1E] border-[#F48771] text-[#F48771]'
              : warningLevel === 'critical'
              ? 'bg-[#3A2E1E] border-[#DCB67A] text-[#DCB67A]'
              : warningLevel === 'warning'
              ? 'bg-[#2E2E1E] border-[#DCB67A]/50 text-[#DCB67A]'
              : 'bg-[#252526] border-[#3E3E42] text-[#858585]'
          }`}
          onClick={() => warningLevel === 'exceeded' ? setShowBuyTokensModal(true) : openSettingsToCategory('account')}
          title={usageStatus.isUnlimited ? 'Unlimited access' : `${usageStatus.used}/${usageStatus.limit} messages today${usageStatus.bonusAvailable > 0 ? ` + ${usageStatus.bonusAvailable} bonus` : ''}`}
        >
          {usageStatus.isUnlimited ? (
            <Crown className="h-3.5 w-3.5" />
          ) : warningLevel === 'exceeded' ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5" />
          )}
          <span className="text-xs font-medium">
            {formatRemaining(usageStatus)}
          </span>
          {warningLevel === 'exceeded' && usageStatus.bonusAvailable === 0 && (
            <ShoppingCart className="h-3 w-3 ml-1" />
          )}
        </div>

        {/* Working Directory Selector */}
        <button
          onClick={async () => {
            const selected = await openFolderPicker({
              title: 'Select Working Directory',
              defaultPath: currentChatWorkingDirectory || workspaceRoot,
              allowedFolder: settings.allowedFolder,
            });
            if (selected) {
              setCurrentChatWorkingDirectory(selected);
              saveConversationToHistory();
            }
          }}
          disabled={isAgentRunning}
          className="flex items-center gap-1.5 px-2 py-1 bg-[#252526] border border-[#3E3E42] rounded hover:bg-[#2A2D2E] text-xs max-w-[200px]"
          title={`Working directory: ${currentChatWorkingDirectory || workspaceRoot || '.'}\nClick to change`}
        >
          <Folder className="h-3 w-3 text-[#DCB67A] flex-shrink-0" />
          <span className="truncate text-[#858585]">
            {(() => {
              const dir = currentChatWorkingDirectory || workspaceRoot || '.';
              const parts = dir.split(/[/\\]/);
              // Show last 2 parts of path for better context
              if (parts.length > 2) {
                return '.../' + parts.slice(-2).join('/');
              }
              return parts.join('/') || '.';
            })()}
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              // Auto-extract memories before starting new conversation
              if (conversationLog.length >= 4) {
                try {
                  const extractResponse = await memoryApi.extractMemories({
                    conversationId: currentConversationId || crypto.randomUUID(),
                    messages: conversationLog.map(m => ({ role: m.role, content: m.content })),
                  });
                  if (extractResponse.ok && extractResponse.data && extractResponse.data.length > 0) {
                    addNotification({
                      type: 'success',
                      title: 'Memories Extracted',
                      message: `${extractResponse.data.length} memories saved`,
                    });
                  }
                } catch (err) {
                  console.log('Memory extraction skipped:', err);
                }
              }
              startNewConversation();
              setLastResponseTokens(null);
              setToolsUsed([]);
              clearPendingCommands();
              setPausedMessages([]);
            }}
            className="p-1.5 hover:bg-[#3E3E42] rounded text-[#89D185]"
            title="New Chat (saves current, extracts memories)"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-1.5 rounded transition-colors ${
              showHistory ? 'bg-[#094771] text-white' : 'hover:bg-[#3E3E42]'
            }`}
            title="Chat History"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (confirm('Clear current conversation without saving?')) {
                clearConversation();
                resetSessionStats();
                setLastResponseTokens(null);
                setToolsUsed([]);
                clearPendingCommands();
                setPausedMessages([]);
              }
            }}
            className="p-1.5 hover:bg-[#3E3E42] rounded text-[#F48771]"
            title="Clear (discard)"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Bar - hide in image mode */}
      {agentMode !== 'image' && (
        <div className="px-4 py-2 bg-[#252526] border-b border-[#3E3E42] flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5" title="Total tokens used this session">
            <Zap className="h-3 w-3 text-[#DCDCAA]" />
            <span className="text-[#858585]">Tokens:</span>
            <span className="text-[#D4D4D4]">{sessionStats.totalTokens.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Total cost this session">
            <Coins className="h-3 w-3 text-[#89D185]" />
            <span className="text-[#858585]">Cost:</span>
            <span className="text-[#D4D4D4]">${sessionStats.totalCost.toFixed(6)}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Messages this session">
            <MessageSquare className="h-3 w-3 text-[#007ACC]" />
            <span className="text-[#858585]">Messages:</span>
            <span className="text-[#D4D4D4]">{sessionStats.messageCount}</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5" title="Context window">
            <span className="text-[#858585]">Context:</span>
            <span className="text-[#D4D4D4]">
              {sessionStats.totalTokens.toLocaleString()} / {getContextWindow(llmModel).toLocaleString()}
            </span>
            <div className="w-16 h-1.5 bg-[#3C3C3C] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#007ACC] transition-all"
                style={{
                  width: `${Math.min(100, (sessionStats.totalTokens / getContextWindow(llmModel)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Last Response Stats */}
      {agentMode !== 'image' && lastResponseTokens && (
        <div className="px-4 py-1.5 bg-[#1E1E1E] border-b border-[#3E3E42] flex items-center gap-4 text-xs text-[#858585]">
          <span>Last response:</span>
          <span>
            <span className="text-[#9CDCFE]">{lastResponseTokens.prompt}</span> in /
            <span className="text-[#CE9178]"> {lastResponseTokens.completion}</span> out =
            <span className="text-[#D4D4D4]"> {lastResponseTokens.total}</span> tokens
          </span>
          <span className="text-[#89D185]">(${lastResponseTokens.cost.toFixed(6)})</span>
        </div>
      )}

      {/* Image Generation Mode */}
      {agentMode === 'image' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Image Settings Panel */}
          <div className="w-80 border-r border-[#3E3E42] flex flex-col bg-[#252526] overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* Prompt */}
              <div>
                <label className="block text-xs text-[#858585] mb-1.5">Prompt</label>
                <textarea
                  value={imageSettings.prompt}
                  onChange={(e) => setImageSettings(s => ({ ...s, prompt: e.target.value }))}
                  placeholder="A beautiful sunset over mountains..."
                  rows={3}
                  className="input w-full resize-none"
                />
              </div>

              {/* Negative Prompt */}
              <div>
                <label className="block text-xs text-[#858585] mb-1.5">Negative Prompt</label>
                <textarea
                  value={imageSettings.negativePrompt}
                  onChange={(e) => setImageSettings(s => ({ ...s, negativePrompt: e.target.value }))}
                  placeholder="blurry, bad quality, distorted..."
                  rows={2}
                  className="input w-full resize-none"
                />
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-xs text-[#858585] mb-1.5">Model</label>
                <select
                  value={imageSettings.model}
                  onChange={(e) => setImageSettings(s => ({ ...s, model: e.target.value }))}
                  className="input w-full"
                >
                  {IMAGE_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                  ))}
                </select>
              </div>

              {/* Size */}
              <div>
                <label className="block text-xs text-[#858585] mb-1.5">Size</label>
                <select
                  value={imageSettings.size}
                  onChange={(e) => setImageSettings(s => ({ ...s, size: e.target.value }))}
                  className="input w-full"
                >
                  {IMAGE_SIZES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Number of Images */}
              <div>
                <label className="block text-xs text-[#858585] mb-1.5">Number of Images: {imageSettings.count}</label>
                <input
                  type="range"
                  min={1}
                  max={4}
                  value={imageSettings.count}
                  onChange={(e) => setImageSettings(s => ({ ...s, count: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>

              {/* Advanced Settings Toggle */}
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="text-xs text-[#007ACC] hover:underline"
              >
                {showAdvancedSettings ? 'Hide' : 'Show'} Advanced Settings
              </button>

              {/* Advanced Settings */}
              {showAdvancedSettings && (
                <div className="space-y-4 pt-2 border-t border-[#3E3E42]">
                  {/* Steps */}
                  <div>
                    <label className="block text-xs text-[#858585] mb-1.5">Steps: {imageSettings.steps}</label>
                    <input
                      type="range"
                      min={10}
                      max={50}
                      value={imageSettings.steps}
                      onChange={(e) => setImageSettings(s => ({ ...s, steps: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>

                  {/* Guidance Scale */}
                  <div>
                    <label className="block text-xs text-[#858585] mb-1.5">Guidance: {imageSettings.guidance}</label>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={0.5}
                      value={imageSettings.guidance}
                      onChange={(e) => setImageSettings(s => ({ ...s, guidance: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                  </div>

                  {/* Seed */}
                  <div>
                    <label className="block text-xs text-[#858585] mb-1.5">Seed (optional)</label>
                    <input
                      type="number"
                      value={imageSettings.seed || ''}
                      onChange={(e) => setImageSettings(s => ({ ...s, seed: e.target.value ? parseInt(e.target.value) : undefined }))}
                      placeholder="Random"
                      className="input w-full"
                    />
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={generateImages}
                disabled={isGeneratingImage || !imageSettings.prompt.trim()}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate {imageSettings.count > 1 ? `${imageSettings.count} Images` : 'Image'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Images Gallery */}
          <div className="flex-1 overflow-y-auto p-4">
            {generatedImages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[#858585]">
                <div className="text-center">
                  <ImageIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p className="text-sm mb-2">No images generated yet</p>
                  <p className="text-xs text-[#606060]">Enter a prompt and click Generate</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {generatedImages.map((img, i) => (
                  <div key={`${img.timestamp}-${i}`} className="group relative bg-[#252526] rounded-lg overflow-hidden border border-[#3E3E42]">
                    <img
                      src={img.url}
                      alt={img.prompt}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                      <div className="p-3 w-full">
                        <p className="text-xs text-white/80 line-clamp-2 mb-2">{img.prompt}</p>
                        <button
                          onClick={() => downloadImage(img.url, i)}
                          className="btn btn-sm bg-white/20 hover:bg-white/30 text-white text-xs flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : agentMode === 'memory' ? (
        /* Memory Mode */
        <div className="flex-1 overflow-hidden">
          <MemoryPanel isEmbedded={true} onClose={() => setAgentMode('chat')} />
        </div>
      ) : (
      /* Main content */
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div ref={conversationRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {conversationLog.length === 0 && !agentResponse ? (
              <div className="flex h-full items-center justify-center text-[#858585]">
                <div className="text-center max-w-md">
                  <Bot className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  {agentMode === 'chat' && (
                    <>
                      <p className="text-sm mb-2">Chat Mode</p>
                      <p className="text-xs text-[#606060]">Ask me anything about your code</p>
                    </>
                  )}
                  {agentMode === 'agent' && (
                    <>
                      <p className="text-sm mb-2">Agent Mode</p>
                      <p className="text-xs text-[#606060] mb-3">I'll plan complex tasks, ask questions when needed, and execute</p>
                      <div className="flex flex-wrap justify-center gap-2 text-xs">
                        <span className="px-2 py-1 bg-[#252526] rounded flex items-center gap-1">
                          <Eye className="h-3 w-3 text-[#9CDCFE]" /> Read
                        </span>
                        <span className="px-2 py-1 bg-[#252526] rounded flex items-center gap-1">
                          <FileCode className="h-3 w-3 text-[#89D185]" /> Write
                        </span>
                        <span className="px-2 py-1 bg-[#252526] rounded flex items-center gap-1">
                          <ClipboardList className="h-3 w-3 text-[#DCDCAA]" /> Plan
                        </span>
                        <span className="px-2 py-1 bg-[#252526] rounded flex items-center gap-1">
                          <HelpCircle className="h-3 w-3 text-[#CE9178]" /> Ask
                        </span>
                      </div>
                    </>
                  )}
                  {agentMode === 'plan' && (
                    <>
                      <p className="text-sm mb-2">Plan Mode</p>
                      <p className="text-xs text-[#606060] mb-3">I'll create a detailed plan before making any changes</p>
                      <div className="flex flex-wrap justify-center gap-2 text-xs">
                        <span className="px-2 py-1 bg-[#252526] rounded flex items-center gap-1">
                          <ClipboardList className="h-3 w-3 text-[#9CDCFE]" /> Explore codebase
                        </span>
                        <span className="px-2 py-1 bg-[#252526] rounded flex items-center gap-1">
                          <ClipboardList className="h-3 w-3 text-[#DCDCAA]" /> Create plan
                        </span>
                        <span className="px-2 py-1 bg-[#252526] rounded flex items-center gap-1">
                          <ClipboardList className="h-3 w-3 text-[#89D185]" /> Execute on approval
                        </span>
                      </div>
                    </>
                  )}
                  {agentMode === 'question' && (
                    <>
                      <p className="text-sm mb-2">Question Mode</p>
                      <p className="text-xs text-[#606060] mb-3">I'll ask clarifying questions before proceeding</p>
                      <div className="flex flex-wrap justify-center gap-2 text-xs">
                        <span className="px-2 py-1 bg-[#252526] rounded flex items-center gap-1">
                          <HelpCircle className="h-3 w-3 text-[#CE9178]" /> Understand requirements
                        </span>
                        <span className="px-2 py-1 bg-[#252526] rounded flex items-center gap-1">
                          <HelpCircle className="h-3 w-3 text-[#9CDCFE]" /> Clarify edge cases
                        </span>
                      </div>
                    </>
                  )}
                  <p className="text-xs mt-3 text-[#606060]">Model: {llmModel?.split('/').pop() || 'Not selected'}</p>
                </div>
              </div>
            ) : (
              conversationLog
                .filter((m) => m.role !== 'system')
                .map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-[#007ACC] flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
                        message.role === 'user'
                          ? 'bg-[#094771] text-white'
                          : 'bg-[#252526] border border-[#3E3E42]'
                      }`}
                    >
                      <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-[#3C3C3C] flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium">You</span>
                      </div>
                    )}
                  </div>
                ))
            )}

            {/* Pending Command Approvals */}
            {pendingCommands.filter(c => c.status === 'pending' || c.status === 'executing').map(command => (
              <CommandApproval
                key={command.id}
                command={command}
                onApprove={handleCommandApproval}
                onReject={handleCommandRejection}
              />
            ))}

            {/* Tools Activity */}
            {toolsUsed.length > 0 && (
              <div className="bg-[#1E1E1E] border border-[#3E3E42] rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-[#858585]">
                  <Wrench className="h-3 w-3" />
                  <span>Tools used:</span>
                </div>
                {toolsUsed.map((tool, i) => (
                  <div key={i} className="bg-[#252526] rounded p-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      {tool.name === 'read_file' && <Eye className="h-3 w-3 text-[#9CDCFE]" />}
                      {tool.name === 'write_file' && <FileCode className="h-3 w-3 text-[#89D185]" />}
                      {tool.name === 'delete_file' && <Trash className="h-3 w-3 text-[#F48771]" />}
                      {tool.name === 'list_directory' && <FolderPlus className="h-3 w-3 text-[#DCDCAA]" />}
                      {tool.name === 'create_directory' && <FolderPlus className="h-3 w-3 text-[#89D185]" />}
                      {tool.name === 'search_files' && <RefreshCw className="h-3 w-3 text-[#CE9178]" />}
                      {tool.name === 'run_command' && <Terminal className="h-3 w-3 text-[#F48771]" />}
                      {tool.name === 'web_search' && <Globe className="h-3 w-3 text-[#569CD6]" />}
                      <span className="text-[#DCDCAA]">{tool.name}</span>
                      <span className="text-[#858585]">({Object.entries(tool.args).map(([k, v]) => `${k}: ${v}`).join(', ')})</span>
                    </div>
                    <pre className="text-[#858585] whitespace-pre-wrap text-[10px] max-h-20 overflow-y-auto">{tool.result}</pre>
                  </div>
                ))}
              </div>
            )}

            {/* Loading indicator */}
            {isAgentRunning && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#007ACC] flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-[#252526] border border-[#3E3E42] px-4 py-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-[#007ACC] rounded-full animate-bounce" />
                      <span
                        className="w-2 h-2 bg-[#007ACC] rounded-full animate-bounce"
                        style={{ animationDelay: '0.1s' }}
                      />
                      <span
                        className="w-2 h-2 bg-[#007ACC] rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                    </div>
                    {toolsUsed.length > 0 && (
                      <span className="text-xs text-[#858585]">Executing tools...</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-[#3E3E42]">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={agentGoal}
                onChange={(e) => setAgentGoal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  agentMode === 'chat' ? 'Ask me anything...' :
                  agentMode === 'agent' ? 'What would you like me to do?' :
                  agentMode === 'plan' ? 'Describe what you want to build...' :
                  'What do you need help with?'
                }
                disabled={isAgentRunning}
                rows={2}
                className="input flex-1 resize-none"
              />
              <button
                onClick={runAgent}
                disabled={isAgentRunning || !agentGoal.trim()}
                className="btn btn-primary px-4 self-end"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-[#858585] mt-2">Press Enter to send, Shift+Enter for new line</p>
          </div>
        </div>

        {/* History sidebar */}
        {/* History sidebar */}
        {showHistory && (
          <div className="w-72 border-l border-[#3E3E42] flex flex-col bg-[#252526]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#3E3E42]">
              <span className="text-sm font-medium">History</span>
              <div className="flex items-center gap-1">
                {chatHistory.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Clear all history?')) {
                        clearChatHistory();
                      }
                    }}
                    className="p-1 hover:bg-[#3E3E42] rounded text-[#F48771]"
                    title="Clear all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 hover:bg-[#3E3E42] rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chatHistory.length === 0 ? (
                <div className="p-4 text-center text-sm text-[#858585]">No history yet</div>
              ) : (
                chatHistory.map((chat) => {
                  const lastMessage = chat.messages?.filter(m => m.role === 'assistant').pop();
                  const messageCount = chat.messages?.length || 0;
                  return (
                    <div
                      key={chat.id}
                      onClick={() => restoreChat(chat)}
                      className="p-3 border-b border-[#3E3E42] hover:bg-[#2A2D2E] cursor-pointer group"
                      title="Click to restore this conversation"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{chat.title}</p>
                          {lastMessage && (
                            <p className="text-xs text-[#858585] truncate mt-1">{lastMessage.content}</p>
                          )}
                          <div className="flex items-center flex-wrap gap-2 mt-2 text-xs text-[#606060]">
                            <span>{new Date(chat.updatedAt || chat.timestamp).toLocaleDateString()}</span>
                            <span className="text-[#858585]">{messageCount} msgs</span>
                            {chat.totalTokens > 0 && (
                              <span className="text-[#9CDCFE]">
                                {chat.totalTokens.toLocaleString()} tokens
                              </span>
                            )}
                            {chat.totalCost > 0 && (
                              <span className="text-[#89D185]">${chat.totalCost.toFixed(6)}</span>
                            )}
                            <span className="text-[#858585] truncate max-w-[80px]" title={chat.model}>
                              {chat.model?.split('/').pop()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              restoreChat(chat);
                            }}
                            className="p-1 hover:bg-[#3E3E42] rounded opacity-0 group-hover:opacity-100 text-[#007ACC]"
                            title="Restore conversation"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Delete this conversation?')) {
                                deleteChatFromHistory(chat.id);
                              }
                            }}
                            className="p-1 hover:bg-[#3E3E42] rounded opacity-0 group-hover:opacity-100 text-[#F48771]"
                            title="Delete conversation"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Buy Tokens Modal */}
        {showBuyTokensModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowBuyTokensModal(false)}
          >
            <div
              className="bg-[#1E1E1E] border border-[#3E3E42] rounded-lg w-[400px] max-h-[90vh] overflow-hidden shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#3E3E42]">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-[#007ACC]/20 rounded-lg">
                    <ShoppingCart className="h-5 w-5 text-[#007ACC]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Buy More Messages</h2>
                    <p className="text-xs text-[#858585]">Add messages to continue chatting</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBuyTokensModal(false)}
                  className="p-1 hover:bg-[#3E3E42] rounded"
                >
                  <X className="h-5 w-5 text-[#858585]" />
                </button>
              </div>

              {/* Current Status */}
              <div className="p-4 border-b border-[#3E3E42] bg-[#252526]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#F48771]" />
                    <span className="text-sm text-[#F48771]">Daily limit reached</span>
                  </div>
                  <span className="text-sm text-[#858585]">
                    {usageStatus.used}/{usageStatus.limit} used
                  </span>
                </div>
                {usageStatus.bonusAvailable > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#89D185]">
                    <Coins className="h-4 w-4" />
                    <span>{usageStatus.bonusAvailable} bonus messages available</span>
                  </div>
                )}
              </div>

              {/* Token Packs */}
              <div className="p-4 space-y-3">
                <p className="text-sm text-[#858585] mb-3">Select a message pack:</p>
                {TOKEN_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={async () => {
                      const checkoutUrl = getCheckoutUrl({
                        email: authUser?.email ?? '',
                        name: authUser?.name,
                        userId: authUser?.id ?? '',
                        plan: 'pro',
                      });
                      if (checkoutUrl) {
                        try {
                          await open(checkoutUrl);
                          setShowBuyTokensModal(false);
                        } catch (error) {
                          console.error('Failed to open checkout:', error);
                        }
                      }
                    }}
                    className={`w-full p-4 rounded-lg border transition-all text-left relative ${
                      pack.popular
                        ? 'border-[#007ACC] bg-[#007ACC]/10 hover:bg-[#007ACC]/20'
                        : 'border-[#3E3E42] bg-[#252526] hover:bg-[#2A2D2E] hover:border-[#4E4E52]'
                    }`}
                  >
                    {pack.popular && (
                      <div className="absolute -top-2 right-3 px-2 py-0.5 bg-[#007ACC] text-white text-xs rounded-full font-medium">
                        Most Popular
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${pack.popular ? 'bg-[#007ACC]/30' : 'bg-[#3E3E42]'}`}>
                          <MessageSquare className={`h-5 w-5 ${pack.popular ? 'text-[#007ACC]' : 'text-[#858585]'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-lg">{pack.messages}</span>
                            <span className="text-sm text-[#858585]">messages</span>
                            {'savings' in pack && pack.savings && (
                              <span className="px-1.5 py-0.5 bg-[#89D185]/20 text-[#89D185] text-xs rounded font-medium">
                                Save {pack.savings}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#858585] mt-0.5">{pack.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold text-[#89D185]">${pack.price.toFixed(2)}</span>
                        <p className="text-xs text-[#858585]">
                          ${(pack.price / pack.messages).toFixed(3)}/msg
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Upgrade CTA */}
              <div className="p-4 border-t border-[#3E3E42] bg-[#252526]">
                <button
                  onClick={() => {
                    setShowBuyTokensModal(false);
                    openSettingsToCategory('account');
                  }}
                  className="w-full p-3 rounded-lg border border-[#4E4E52] hover:border-[#007ACC] hover:bg-[#007ACC]/10 transition-all group"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Crown className="h-4 w-4 text-[#DCB67A] group-hover:text-[#007ACC]" />
                    <span className="text-sm group-hover:text-[#007ACC]">
                      Upgrade to Pro for 300 messages/day
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
