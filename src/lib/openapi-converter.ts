import type { OpenAPIV3 } from 'openapi-types';

export interface MCPToolDefinition {
  name: string;
  description: string;
  method: string;
  path: string;
  parameters: any;
  requestBody?: any;
}

export function convertOpenAPIToTools(spec: OpenAPIV3.Document | any): MCPToolDefinition[] {
  const tools: MCPToolDefinition[] = [];
  const paths = spec.paths || {};
  
  for (const [path, pathItem] of Object.entries(paths)) {
    const methods = ['get', 'post', 'put', 'patch', 'delete'];
    
    for (const method of methods) {
      const operation = (pathItem as any)[method];
      if (!operation) continue;
      
      const toolName = generateToolName(operation.operationId || `${method}_${path}`);
      const description = operation.summary || operation.description || `${method.toUpperCase()} ${path}`;
      
      const parameters = convertParameters(operation.parameters || []);
      const requestBody = operation.requestBody ? convertRequestBody(operation.requestBody) : undefined;
      
      tools.push({
        name: toolName,
        description,
        method: method.toUpperCase(),
        path,
        parameters,
        requestBody
      });
    }
  }
  
  return tools;
}

function generateToolName(operationId: string): string {
  // Convert operationId to a valid MCP tool name
  return operationId
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

function convertParameters(parameters: any[]): any {
  const properties: any = {};
  const required: string[] = [];
  
  for (const param of parameters) {
    const schema = param.schema || { type: 'string' };
    properties[param.name] = {
      ...schema,
      description: param.description,
      in: param.in // Keep track of where the parameter goes
    };
    
    if (param.required) {
      required.push(param.name);
    }
  }
  
  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined
  };
}

function convertRequestBody(requestBody: any): any {
  const content = requestBody.content || {};
  const jsonContent = content['application/json'];
  
  if (jsonContent && jsonContent.schema) {
    return {
      schema: jsonContent.schema,
      required: requestBody.required || false
    };
  }
  
  return null;
}