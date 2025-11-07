# Technical Context: Claude Talk to Figma MCP

## Technology Stack

### Runtime Environment
- **Primary Runtime**: Bun (JavaScript/TypeScript runtime)
  - Fast startup and execution
  - Built-in TypeScript support
  - Native WebSocket support
  - Package management and bundling
- **Node.js Compatibility**: Maintains Node.js API compatibility
- **Platform Support**: macOS, Windows, Linux

### Core Technologies

#### Backend/Server
- **Model Context Protocol (MCP)**: `@modelcontextprotocol/sdk`
  - Server implementation for AI tool integration
  - Standardized tool and resource interfaces
  - Request/response handling with schemas
- **WebSocket Communication**: `ws` library
  - Real-time bidirectional messaging
  - Connection management and reconnection
  - Message correlation and timeout handling
- **TypeScript**: Full type safety and modern language features
- **Zod**: Runtime type validation and schema definition

#### Frontend/Plugin
- **Figma Plugin API**: Direct integration with Figma's plugin system
  - Sandbox execution environment
  - Access to Figma's document model
  - UI components and messaging
- **Vanilla JavaScript**: Plugin code runs in Figma's JavaScript environment
- **HTML/CSS**: Plugin UI implementation

### Development Tools

#### Build System
- **tsup**: TypeScript bundler and build tool
  - Fast compilation and bundling
  - Multiple output formats
  - Watch mode for development
- **TypeScript Compiler**: Type checking and compilation
- **DXT Packaging**: `@anthropic-ai/dxt` for Claude Desktop extensions

#### Testing Framework
- **Jest**: Unit and integration testing
  - TypeScript support via ts-jest
  - Coverage reporting
  - Watch mode for development
- **Custom Integration Tests**: End-to-end workflow validation

#### Development Workflow
- **Bun Scripts**: Package management and script execution
- **GitHub Actions**: CI/CD pipeline for automated testing and releases
- **Version Synchronization**: Automated version management across components

## Architecture Constraints

### Figma Plugin Limitations
- **Sandbox Environment**: Limited access to external resources
- **API Restrictions**: Only specific Figma APIs available
- **Performance Limits**: UI thread blocking considerations
- **Memory Constraints**: Large operations require chunking

### WebSocket Communication
- **Port Requirements**: Default port 3055 (configurable)
- **Network Dependencies**: Requires local network connectivity
- **Connection Management**: Auto-reconnection with exponential backoff
- **Message Size Limits**: Large payloads require streaming

### MCP Protocol Requirements
- **Schema Compliance**: Strict adherence to MCP specifications
- **Tool Registration**: Dynamic tool discovery and registration
- **Error Handling**: Standardized error response formats
- **Versioning**: Backward compatibility requirements

## Configuration Management

### Environment Configuration
```typescript
// src/talk_to_figma_mcp/config/config.ts
export const SERVER_CONFIG = {
  name: "claude-talk-to-figma-mcp",
  version: "0.6.1"
};

export const serverUrl = process.env.SERVER_URL || 'localhost';
export const defaultPort = parseInt(process.env.PORT || '3055');
export const WS_URL = `ws://${serverUrl}`;
export const reconnectInterval = 5000;
```

### Build Configuration
```typescript
// tsup.config.ts
export default {
  entry: {
    'talk_to_figma_mcp/server': 'src/talk_to_figma_mcp/server.ts',
    'socket': 'src/socket.ts'
  },
  format: ['esm'],
  target: 'node18',
  clean: true,
  shims: true
};
```

### Package Configuration
```json
// package.json key configurations
{
  "type": "module",
  "bin": {
    "claude-talk-to-figma-mcp": "dist/talk_to_figma_mcp/server.js",
    "claude-talk-to-figma-mcp-socket": "dist/socket.js"
  },
  "files": ["dist", "readme.md", "LICENSE"],
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "uuid": "latest",
    "ws": "latest",
    "zod": "latest"
  }
}
```

## Development Setup

### Prerequisites
- **Bun**: Latest version for runtime and package management
- **Figma Desktop**: For plugin development and testing
- **Claude Desktop** or **Cursor**: For MCP integration testing
- **Git**: Version control and collaboration

### Local Development Workflow
```bash
# Initial setup
git clone https://github.com/arinspunk/claude-talk-to-figma-mcp.git
cd claude-talk-to-figma-mcp
bun install

# Development build with watch mode
bun run dev

# Start WebSocket server for testing
bun socket

# Run tests
bun run test
bun run test:watch
bun run test:integration

# Production build
bun run build        # macOS/Linux
bun run build:win    # Windows

# Package for distribution
bun run build:dxt    # Create DXT package
```

### Plugin Development
```bash
# Import plugin manifest in Figma
# File: src/claude_mcp_plugin/manifest.json

# Configure AI tool (Claude Desktop)
bun run configure-claude

# Test integration
node scripts/test-integration.js
```

## Deployment Patterns

### NPM Distribution
- **Package Name**: `claude-talk-to-figma-mcp`
- **Registry**: npm public registry
- **Versioning**: Semantic versioning (semver)
- **Binary Distribution**: Executable scripts in `dist/`

### DXT Package Distribution
- **Format**: Claude Desktop extension package
- **Build Process**: Automated via GitHub Actions
- **Installation**: One-click installation in Claude Desktop
- **Version Sync**: Automatic version synchronization

### GitHub Releases
- **Automated Releases**: CI/CD pipeline creates releases
- **Asset Packaging**: DXT files attached to releases
- **Changelog**: Automated changelog generation
- **Version Tags**: Git tags for version tracking

## Performance Considerations

### Memory Management
- **Chunked Processing**: Large operations split into manageable chunks
- **Request Cleanup**: Automatic cleanup of pending requests
- **Connection Pooling**: Efficient WebSocket connection reuse
- **Garbage Collection**: Proper cleanup of event listeners and timeouts

### Network Optimization
- **Connection Reuse**: Single WebSocket connection per session
- **Message Batching**: Group related operations when possible
- **Timeout Management**: Progressive timeout strategies
- **Reconnection Logic**: Exponential backoff for failed connections

### Figma API Optimization
- **Font Caching**: Cache loaded fonts to avoid repeated loading
- **Batch Operations**: Group similar operations to reduce API calls
- **Progress Streaming**: Real-time feedback for long operations
- **Error Recovery**: Graceful handling of API limitations

## Security Considerations

### Plugin Security
- **Sandbox Execution**: All operations run within Figma's secure sandbox
- **API Surface**: Limited to Figma's approved plugin APIs
- **No External Access**: Plugin cannot make external network requests
- **User Permissions**: Requires explicit user installation and activation

### Communication Security
- **Local Network Only**: WebSocket server runs on localhost
- **No Authentication**: Relies on local machine security
- **Message Validation**: All messages validated before processing
- **Error Sanitization**: Internal errors sanitized before user exposure

### Data Privacy
- **No Data Storage**: No persistent storage of user data
- **Local Processing**: All operations performed locally
- **No Telemetry**: No usage data collection (configurable)
- **User Control**: Users control all data and operations

## Testing Strategy

### Unit Testing
- **Tool Validation**: Individual tool parameter validation
- **Utility Functions**: Helper function testing
- **Error Handling**: Error condition testing
- **Type Safety**: TypeScript compilation testing

### Integration Testing
- **End-to-End Workflows**: Complete user workflow testing
- **WebSocket Communication**: Connection and message testing
- **Figma Plugin Integration**: Plugin command execution testing
- **Error Recovery**: Connection failure and recovery testing

### Manual Testing Checklist
- [ ] WebSocket server starts successfully
- [ ] Figma plugin connects and generates channel ID
- [ ] AI tool recognizes MCP server
- [ ] Basic commands execute correctly
- [ ] Error handling works properly
- [ ] Performance is acceptable for typical operations

## Troubleshooting Patterns

### Common Issues
1. **Connection Problems**: Port conflicts, firewall issues
2. **Plugin Loading**: Manifest import, development mode
3. **Font Issues**: Font availability, loading failures
4. **Performance**: Large document handling, memory usage
5. **Compatibility**: AI tool integration, version mismatches

### Diagnostic Tools
- **Server Logs**: Detailed logging for debugging
- **WebSocket Status**: Connection status endpoint
- **Plugin Console**: Figma plugin development console
- **Network Monitoring**: WebSocket message inspection
- **Performance Profiling**: Memory and CPU usage monitoring

### Recovery Strategies
- **Automatic Reconnection**: WebSocket connection recovery
- **Graceful Degradation**: Fallback options for failed operations
- **User Feedback**: Clear error messages and recovery instructions
- **State Recovery**: Restore operations after connection issues
