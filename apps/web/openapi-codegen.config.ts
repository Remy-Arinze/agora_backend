/**
 * OpenAPI Codegen Configuration
 * 
 * This script generates RTK Query hooks from the Swagger/OpenAPI spec.
 * Run: npm run generate-client
 * 
 * The generated code will be in src/lib/api/generated/
 */

export default {
  input: 'http://localhost:4000/api/swagger-json',
  output: './src/lib/api/generated',
  client: 'axios',
  useOptions: true,
  useUnionTypes: true,
};

