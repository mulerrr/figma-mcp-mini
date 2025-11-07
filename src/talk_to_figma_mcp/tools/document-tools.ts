import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommandToFigma, joinChannel } from "../utils/websocket.js";

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { filterFigmaNode } from "../utils/figma-helpers.js";

const __FILEDIR = path.dirname(fileURLToPath(import.meta.url));

// Optional runtime override from env (doesn't require touching other files)
let GUIDES_DIR_OVERRIDE: string | undefined = process.env.GUIDES_DIR;

function buildCandidateDirs(): string[] {
  const candidates: string[] = [];

  // 1) explicit override
  if (GUIDES_DIR_OVERRIDE) candidates.push(GUIDES_DIR_OVERRIDE);

  // 2) env
  if (process.env.GUIDES_DIR) candidates.push(process.env.GUIDES_DIR as string);

  // 3) common CWD spots
  candidates.push(
    path.resolve(process.cwd(), "guides"),
    path.resolve(process.cwd(), "guides/instructions"),
    path.resolve(process.cwd(), "context/guides")
  );

  // 4) walk up from this file up to 8 levels and try guides & context/guides
  let cur = __FILEDIR;
  for (let i = 0; i < 8; i++) {
    candidates.push(
      path.resolve(cur, "guides"),
      path.resolve(cur, "guides/instructions"),
      path.resolve(cur, "context/guides")
    );
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  // de-dupe while preserving order
  return [...new Set(candidates)];
}

// async function readGuideFile(basenameOrSlug: string): Promise<{ text: string; from: string; tried: string[] }> {
//   const tried: string[] = [];
//   const candidates = buildCandidateDirs();

//   // normalize filename candidates (accept slug or filename)
//   const base = basenameOrSlug.replace(/\.(md|markdown|json)$/i, "");
//   const nameCandidates = [
//     `${base}.md`,
//     `${base}.markdown`,
//     `${base}.json`,
//     base // allow full filename passed in
//   ];

//   for (const dir of candidates) {
//     for (const name of nameCandidates) {
//       const full = path.join(dir, name);
//       tried.push(full);
//       try {
//         const buf = await fs.readFile(full);
//         let text: string;

//         // UTF-16 LE BOM
//         if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
//           text = Buffer.from(buf).toString("utf16le");

//         // UTF-16 BE BOM -> byte-swap, then decode as LE
//         } else if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
//           const swapped = Buffer.allocUnsafe(buf.length);
//           for (let i = 0; i < buf.length; i += 2) {
//             swapped[i] = buf[i + 1];
//             swapped[i + 1] = buf[i];
//           }
//           text = swapped.toString("utf16le");

//         // UTF-8 (with or without BOM)
//         } else {
//           text = buf.toString("utf8");
//           // strip UTF-8 BOM if present
//           if (text.charCodeAt(0) === 0xFEFF) {
//             text = text.slice(1);
//           }
//         }

//         // Normalize CRLF to LF for consistent rendering
//         text = text.replace(/\r\n/g, "\n");

//         return { text, from: dir, tried };
//       } catch (e: any) {
//         if (e?.code !== "ENOENT") {
//           // escalate non-not-found errors (permissions, EISDIR, etc.)
//           throw new Error(`Failed to read "${full}": ${e.message}`);
//         }
//       }
//     }
//   }

//   throw new Error(
//     `Guide "${basenameOrSlug}" not found. Tried:\n` + tried.map(p => `- ${p}`).join("\n") +
//     `\nTip: place your files under a "guides" folder in the repo root, or set GUIDES_DIR env to an absolute path.`
//   );
// }

/**
 * Register document-related tools to the MCP server
 * @param server - The MCP server instance
 */
export function registerDocumentTools(server: McpServer): void {
  // --- Guide utilities (local file references) ---
  // server.tool(
  //   "list_guides",
  //   "List markdown/json guides discovered by the server (first 50 files per directory).",
  //   {},
  //   async () => {
  //     const dirs = buildCandidateDirs();
  //     const out: any[] = [];
  //     for (const d of dirs) {
  //       try {
  //         const entries = await fs.readdir(d);
  //         const md = entries.filter(f => /\.md$|\.markdown$|\.json$/i.test(f)).slice(0, 50);
  //         if (md.length) out.push({ dir: d, files: md });
  //       } catch {
  //         // ignore non-existent dirs
  //       }
  //     }
  //     if (!out.length) {
  //       return { content: [{ type: "text", text: "No guides found in any candidate directory." }] };
  //     }
  //     return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  //   }
  // );

  // server.tool(
  //   "read_guide",
  //   "Read a guide file by slug or filename (e.g., 'legion-design-principles', 'uxw-rule', or 'general_uxw_rule.json').",
  //   { slug: z.string().describe("Slug or filename inside the guides folder") },
  //   async ({ slug }) => {
  //     const { text, from } = await readGuideFile(slug);
  //     // choose mime based on extension for client hints
  //     const isJson = /\.json$/i.test(slug);
  //     return {
  //       content: [
  //         { type: "text", text: isJson ? text : text }, // clients interpret markdown from text
  //         { type: "text", text: `(Loaded from: ${from})` },
  //       ],
  //     };
  //   }
  // );
  // --- end Guide utilities ---
  
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
              text: [
                `Successfully joined channel: ${channel}`,
                // "",
                // "Next step (do NOT start analysis yet)",
                // "Follow the task's instruction in JSON file task (guide://instructions/started_prompt.json)"
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
  // --- Local guide resources (URI-based) ---
  // server.resource(
  //   "guide-legion",
  //   "guide://legion-design-principles.md",
  //   {
  //     title: "Legion Design Principles",
  //     description: "Markdown guide for design-principles analysis (local file)",
  //     mimeType: "text/plain",
  //   },
  //   async (uri) => {
  //     const { text } = await readGuideFile("legion-design-principles");
  //     return {
  //       contents: [{
  //         uri: uri.href,
  //         mimeType: "text/plain",
  //         text,
  //       }],
  //     };
  //   }
  // );

  // server.resource(
  //   "legion-design-principles-json",
  //   "guide://legion_design_principles.json",
  //   {
  //     title: "Legion Design Principles (JSON)",
  //     description: "JSON rules for design analysis compliance with Legion Design Principles (local file)",
  //     mimeType: "application/json",
  //   },
  //   async (uri) => {
  //     const { text } = await readGuideFile("legion_design_principles.json");
  //     return {
  //       contents: [{
  //         uri: uri.href,
  //         mimeType: "application/json",
  //         text,
  //       }],
  //     };
  //   }
  // );

  // server.resource(
  //   "guide-uxw",
  //   "guide://uxw-rule.md",
  //   {
  //     title: "UX Writing Rules",
  //     description: "Markdown guide for UX writing analysis (local file)",
  //     mimeType: "text/plain",
  //   },
  //   async (uri) => {
  //     const { text } = await readGuideFile("uxw-rule");
  //     return {
  //       contents: [{
  //         uri: uri.href,
  //         mimeType: "text/plain",
  //         text,
  //       }],
  //     };
  //   }
  // );

  // server.resource(
  //   "guide-uxw-json",
  //   "guide://general_uxw_rule.json",
  //   {
  //     title: "UX Writing Rules (JSON)",
  //     description: "JSON rules for UX writing analysis (local file)",
  //     mimeType: "application/json",
  //   },
  //   async (uri) => {
  //     const { text } = await readGuideFile("general_uxw_rule.json");
  //     return {
  //       contents: [{
  //         uri: uri.href,
  //         mimeType: "application/json",
  //         text,
  //       }],
  //     };
  //   }
  // );

  // server.resource(
  //   "heuristic-evaluation-task-json",
  //   "guide://instructios/heuristic_evaluation_task.json",
  //   {
  //     title: "NNG Heuristic Evaluation Analysis Task (JSON)",
  //     description: "JSON contains prompt and task detail to heuristic evaluation (local file)",
  //     mimeType: "application/json",
  //   },
  //   async (uri) => {
  //     const { text } = await readGuideFile("instructions/heuristic_evaluation_task.json");
  //     return {
  //       contents: [{
  //         uri: uri.href,
  //         mimeType: "application/json",
  //         text,
  //       }],
  //     };
  //   }
  // );
  // --- end Local guide resources ---
}
