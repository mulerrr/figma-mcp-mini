# System Patterns: Claude Talk to Figma MCP

## Architecture Overview

The system follows a **layered architecture** with clear separation of concerns across four main components:

```
Claude Desktop ↔ MCP Server ↔ WebSocket Server ↔ Figma Plugin
```

### Component Responsibilities

#### 1. MCP Server (`src/talk_to_figma_mcp/`)
- **Role**: Business logic layer and API contract
- **Responsibilities**:
  - Tool registration and validation
  - Parameter processing and defaults
  - Error handling and user feedback
  - Protocol compliance (Model Context Protocol)
- **Key Files**: `server.ts`, `tools/`, `types/`

#### 2. WebSocket Server (`src/socket.ts`)
- **Role**: Communication bridge and message routing
- **Responsibilities**:
  - Real-time bidirectional messaging
  - Connection management and reconnection
  - Request/response correlation
  - Progress update streaming
- **Port**: 3055 (configurable)

#### 3. Figma Plugin (`src/claude_mcp_plugin/`)
- **Role**: Command executor within Figma sandbox
- **Responsibilities**:
  - Direct Figma API manipulation
  - UI management for connection
  - Progress reporting
  - Error propagation
- **Key Files**: `code.js`, `ui.html`, `manifest.json`

## Key Design Patterns

### 1. Command Pattern
Each tool implements a consistent command interface:
```typescript
interface FigmaCommand {
  command: string;
  params: Record<string, unknown>;
  id: string;
}
```

**Benefits**:
- Uniform tool interface
- Easy testing and validation
- Extensible command set
- Clear error boundaries

### 2. Promise-Based Request/Response
WebSocket communication uses promise-based correlation:
```typescript
const pendingRequests = new Map<string, PendingRequest>();

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  lastActivity: number;
}
```

**Benefits**:
- Async/await compatibility
- Timeout handling
- Request correlation
- Memory leak prevention

### 3. Progressive Enhancement
Tools provide intelligent defaults and progressive complexity:
```typescript
// Simple usage
createRectangle({ x: 0, y: 0 })

// Advanced usage
createRectangle({ 
  x: 0, y: 0, width: 100, height: 50,
  fillColor: { r: 1, g: 0, b: 0, a: 1 },
  strokeColor: { r: 0, g: 0, b: 0, a: 1 },
  strokeWeight: 2,
  parentId: "frame-123"
})
```

### 4. Chunked Processing Pattern
For bulk operations, the system uses chunked processing:
```typescript
// Process in chunks to avoid UI freezing
const CHUNK_SIZE = 5;
const chunks = [];
for (let i = 0; i < items.length; i += CHUNK_SIZE) {
  chunks.push(items.slice(i, i + CHUNK_SIZE));
}

// Process chunks with progress updates
for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
  const chunk = chunks[chunkIndex];
  sendProgressUpdate(commandId, 'processing', progress, total, processed, message);
  await processChunk(chunk);
  await delay(1000); // Prevent overwhelming Figma
}
```

### 5. Error Boundary Pattern
Each layer handles errors appropriately:
- **MCP Layer**: Validates inputs, provides defaults
- **WebSocket Layer**: Handles connection issues, timeouts
- **Plugin Layer**: Catches Figma API errors, provides context

## Tool Organization Patterns

### Categorical Organization
Tools are organized by functional domain:

#### Document Tools (`document-tools.ts`)
- Document inspection and analysis
- Selection management
- Export functionality
- Style queries

#### Creation Tools (`creation-tools.ts`)
- Shape creation (rectangles, ellipses, polygons, stars)
- Frame and text creation
- Component instantiation
- Node cloning and grouping

#### Modification Tools (`modification-tools.ts`)
- Property changes (colors, sizes, positions)
- Layout management (auto-layout)
- Effects and styling
- Node manipulation

#### Text Tools (`text-tools.ts`)
- Text content management
- Typography properties
- Font loading and validation
- Bulk text operations

#### Component Tools (`component-tools.ts`)
- Local component management
- Remote component access
- Instance creation

### Tool Implementation Pattern
Each tool follows a consistent structure:
```typescript
export function registerToolName(server: McpServer): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [{
      name: "tool_name",
      description: "Clear description of what the tool does",
      inputSchema: {
        type: "object",
        properties: {
          // Parameter definitions with validation
        },
        required: ["essential_params"]
      }
    }]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "tool_name") {
      // Input validation
      // Default value application
      // Command execution via WebSocket
      // Error handling and user feedback
    }
  });
}
```

## Communication Patterns

### 1. Channel-Based Communication
```typescript
// Connection establishment
await joinChannel(channelId);

// Command execution
const result = await sendCommandToFigma(command, params);
```

### 2. Progress Streaming
For long-running operations:
```typescript
function sendProgressUpdate(
  commandId: string,
  commandType: string,
  status: 'started' | 'in_progress' | 'completed' | 'error',
  progress: number,
  totalItems: number,
  processedItems: number,
  message: string,
  payload?: any
) {
  // Stream progress to UI and MCP client
}
```

### 3. Timeout Management
Multiple timeout strategies:
- **Connection timeout**: 10 seconds for initial connection
- **Command timeout**: 30 seconds for standard operations
- **Extended timeout**: 60 seconds for complex operations
- **Inactivity timeout**: Reset on progress updates

## Data Flow Patterns

### 1. Request Flow
```
User Input → MCP Tool → WebSocket Message → Figma Plugin → Figma API
```

### 2. Response Flow
```
Figma API → Plugin Processing → WebSocket Response → MCP Result → User
```

### 3. Progress Flow
```
Plugin Progress → WebSocket Stream → MCP Progress → User Feedback
```

## Error Handling Patterns

### 1. Layered Error Handling
- **Input Validation**: At MCP layer
- **Connection Errors**: At WebSocket layer
- **API Errors**: At Plugin layer
- **Timeout Errors**: At all layers

### 2. Error Context Enhancement
```typescript
try {
  await figmaOperation();
} catch (error) {
  throw new Error(`Error in ${operation}: ${error.message}`);
}
```

### 3. Graceful Degradation
- Fallback fonts for text operations
- Default values for missing parameters
- Partial success reporting for bulk operations

## Performance Patterns

### 1. Lazy Loading
- Fonts loaded on demand
- Components fetched when needed
- Pages loaded only when accessed

### 2. Batching
- Multiple text updates in single operation
- Bulk node operations with chunking
- Grouped API calls where possible

### 3. Caching
- Font availability caching
- Component library caching
- Connection state management

## Security Patterns

### 1. Sandbox Execution
- All Figma operations run in plugin sandbox
- No direct API access from external tools
- Controlled command surface area

### 2. Input Validation
- Parameter type checking
- Range validation for numeric inputs
- Enum validation for constrained values

### 3. Error Information Filtering
- Sanitized error messages
- No internal state exposure
- Safe error propagation

## Extensibility Patterns

### 1. Plugin Architecture
- New tools added via registration functions
- Consistent tool interface
- Modular tool organization

### 2. Configuration Management
- Environment-based configuration
- Runtime parameter adjustment
- Feature flags for experimental tools

### 3. Version Management
- Backward-compatible tool evolution
- Graceful handling of missing features
- Progressive enhancement approach
