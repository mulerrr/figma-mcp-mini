import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommandToFigma, joinChannel } from "../utils/websocket.js";
import { filterFigmaNode } from "../utils/figma-helpers.js";

/**
 * Register document-related tools to the MCP server
 * @param server - The MCP server instance
 */
export function registerDocumentTools(server: McpServer): void {
  // Document Info Tool
  server.tool(
    "get_document_info",
    "Get detailed information about the current Figma document",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_document_info");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting document info: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Selection Tool
  server.tool(
    "get_selection",
    "Get information about the current selection in Figma",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_selection");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting selection: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Node Info Tool
  server.tool(
    "get_node_info",
    "Get detailed information about a specific node in Figma",
    {
      nodeId: z.string().describe("The ID of the node to get information about"),
    },
    async ({ nodeId }) => {
      try {
        const result = await sendCommandToFigma("get_node_info", { nodeId });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(filterFigmaNode(result))
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting node info: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Nodes Info Tool
  server.tool(
    "get_nodes_info",
    "Get detailed information about multiple nodes in Figma",
    {
      nodeIds: z.array(z.string()).describe("Array of node IDs to get information about")
    },
    async ({ nodeIds }) => {
      try {
        const results = await Promise.all(
          nodeIds.map(async (nodeId) => {
            const result = await sendCommandToFigma('get_node_info', { nodeId });
            return { nodeId, info: result };
          })
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results.map((result) => filterFigmaNode(result.info)))
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting nodes info: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Get Styles Tool
  server.tool(
    "get_styles",
    "Get all styles from the current Figma document",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_styles");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting styles: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Get Local Components Tool
  server.tool(
    "get_local_components",
    "Get all local components from the Figma document",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_local_components");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting local components: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Get Annotations Tool
  server.tool(
    "get_annotations",
    "Get all annotations in the current document or specific node",
    {
      nodeId: z.string().optional().describe("Optional node ID to get annotations for specific node"),
      includeCategories: z.boolean().optional().default(true).describe("Whether to include category information")
    },
    async ({ nodeId, includeCategories }: any) => {
      try {
        const result = await sendCommandToFigma("get_annotations", {
          nodeId,
          includeCategories
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting annotations: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Get Remote Components Tool
  server.tool(
    "get_remote_components",
    "Get available components from team libraries in Figma",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_remote_components");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting remote components: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Text Node Scanning Tool
  server.tool(
    "scan_text_nodes",
    "Scan all text nodes in the selected Figma node",
    {
      nodeId: z.string().describe("ID of the node to scan"),
    },
    async ({ nodeId }) => {
      try {
        // Initial response to indicate we're starting the process
        const initialStatus = {
          type: "text" as const,
          text: "Starting text node scanning. This may take a moment for large designs...",
        };

        // Use the plugin's scan_text_nodes function with chunking flag
        const result = await sendCommandToFigma("scan_text_nodes", {
          nodeId,
          useChunking: true,  // Enable chunking on the plugin side
          chunkSize: 10       // Process 10 nodes at a time
        });

        // If the result indicates chunking was used, format the response accordingly
        if (result && typeof result === 'object' && 'chunks' in result) {
          const typedResult = result as {
            success: boolean,
            totalNodes: number,
            processedNodes: number,
            chunks: number,
            textNodes: Array<any>
          };

          const summaryText = `
          Scan completed:
          - Found ${typedResult.totalNodes} text nodes
          - Processed in ${typedResult.chunks} chunks
          `;

          return {
            content: [
              initialStatus,
              {
                type: "text" as const,
                text: summaryText
              },
              {
                type: "text" as const,
                text: JSON.stringify(typedResult.textNodes, null, 2)
              }
            ],
          };
        }

        // If chunking wasn't used or wasn't reported in the result format, return the result as is
        return {
          content: [
            initialStatus,
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error scanning text nodes: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Join Channel Tool
  server.tool(
    "join_channel",
    "Join a specific channel to communicate with Figma",
    {
      channel: z.string().describe("The name of the channel to join").default(""),
    },
    async ({ channel }) => {
      try {
        if (!channel) {
          // If no channel provided, ask the user for input
          return {
            content: [
              {
                type: "text",
                text: "Please provide a channel name to join:",
              },
            ],
            followUp: {
              tool: "join_channel",
              description: "Join the specified channel",
            },
          };
        }

        // Use joinChannel instead of sendCommandToFigma to ensure currentChannel is updated
        await joinChannel(channel);
        
        return {
          content: [
            {
              type: "text",
              //text: `Successfully joined channel: ${channel}`,
              text: [
    `Successfully joined channel: ${channel}`,
    "",
    "Next step (do NOT start analysis yet):",
    "- Read for reference: https://gist.githubusercontent.com/mulerrr/a5679a13ca0d7e78180b655a027f87fe/raw/5dc74dc8d833511aa32e685518f6189ddd259c22/legion-design-principles.md",
    "- Read for reference: https://gist.githubusercontent.com/mulerrr/3055762e0b7bf20628cb567c50b14928/raw/30b8d84e8f4f24c3c55e11c92bb74e921232cedc/general_uxw_rule.json",
    "- Only use the document above as reference, do not use other resources. If failed to fetch, keep retry fo 10 times with 1 second interval",
    "Please ask the user which task to run:",
    "1) Analyze the selected frame for compliance with Legion Design Principles.",
    "2) Analyze the selected frame’s UX Writing based on UXW Rule. Suggest to add additional resource if available. Or can download template from: https://github.com/mulerrr/simple-design-review/blob/main/02_UXWReview/uxw_product_template.json",
    "",
    "When the user picks a task:",
    "- Use existing tools from code.js to build the analysis frame, replace text (if Task 2), and add annotations.",
    "- Place the analysis frame next to the selected frame; place annotations on top of the selected frame.",
    "",
    "For task number 1 follow step below:",
    "- Read for reference: https://gist.githubusercontent.com/mulerrr/a5679a13ca0d7e78180b655a027f87fe/raw/5dc74dc8d833511aa32e685518f6189ddd259c22/legion-design-principles.md",
    "- Only use the document above as reference, do not use other resources. If failed to fetch, keep retry fo 10 times with 1 second interval",
    "- Analyze design compliance with Legion Design Principles (read the document above)",
    "- Add annotations with appropriate category",
    "- Make the result in Figma, it contains Overall Analysis, Each value analysis, Key Improvement Made, and Legion Design Principles that Applied",
    "",
    "For task number 2 follow step below:",
    "- Read for reference: https://gist.githubusercontent.com/mulerrr/3055762e0b7bf20628cb567c50b14928/raw/30b8d84e8f4f24c3c55e11c92bb74e921232cedc/general_uxw_rule.json",
    "- Only use the document above as reference, do not use other resources. If failed to fetch, keep retry fo 10 times with 1 second interval",
    "- Read attached document for additional resource for analysis if any",
    "- Analyze all text in the frame based on UXW Rule (read the document above)",
    "- Make the analysis result in Figma, it contains Overall Analysis, Key Improvement Made, and UX Writing Principles that Applied",
    "- Replace the text from analysis result",
    "- Add annotations with appropriate category, annotation contains Title (Improvement), Original Text, Improved Text, Reason text is replaced. Add category that relevant to it(Interaction, Accessibility, Content, Guideline, Tips)",     
    "",
    "If I ask you to analyze the selected frame in Figma and make the result in Figma, always follow the frame structure below:",
    "Main Frame Auto Layout:",
    "Position: Next to selected frame",
    "Add Analysis Title on Main Frame (Width: Fill)",
    "Direction: Vertical",
    "Width: Fixed (480px)",
    "Height: Hug",
    "Spacing: 20px between sections",
    "Padding: 20px on all sides",
    "Alignment: Left-aligned content",
    "Text Height: Hug",
    "Text Width: Fill Width",
    "Behavior: Height adjusts automatically based on content",
    "",
    "Section Frames Auto Layout:",
    "Direction: Vertical",
    "Width: Fill",
    "Height: Hug",
    "Spacing: 15px between elements",
    "Padding: 15px on all sides",
    "Border radius: 12 px",
    "Alignment: Left-aligned content",
    "Text Content: List, not long paragraph",
    "Text Height: Hug",
    "Text Width: Fill Width",
    "Behavior: Each section grows/shrinks based on content",
    "",
    "Reminder: Only check connection when the user says “Talk to Figma, channel {channel-ID}”. Ask which task to run if connected."
  ].join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error joining channel: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Export Node as Image Tool
  server.tool(
    "export_node_as_image",
    "Export a node as an image from Figma",
    {
      nodeId: z.string().describe("The ID of the node to export"),
      format: z
        .enum(["PNG", "JPG", "SVG", "PDF"])
        .optional()
        .describe("Export format"),
      scale: z.number().positive().optional().describe("Export scale"),
    },
    async ({ nodeId, format, scale }) => {
      try {
        const result = await sendCommandToFigma("export_node_as_image", {
          nodeId,
          format: format || "PNG",
          scale: scale || 1,
        });
        const typedResult = result as { imageData: string; mimeType: string };

        return {
          content: [
            {
              type: "image",
              data: typedResult.imageData,
              mimeType: typedResult.mimeType || "image/png",
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error exporting node as image: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
