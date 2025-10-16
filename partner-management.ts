#!/usr/bin/env ts-node

/**
 * Partner Organization Management Script
 * Generic TypeScript script to manage partner organizations via API
 * 
 * SETUP INSTRUCTIONS:
 * 1. Configure environment variables:
 *    - AUTH_BASE_URL: Your auth API base URL
 *    - ASSISTANTS_BASE_URL: Your assistants API base URL  
 *    - API_TOKEN: Your API authentication token
 *    - DEFAULT_MEMBER_EMAIL: Email to add as admin to each organization
 *    - SOURCE_ASSISTANT_ID: ID of the assistant to duplicate
 *    - SOURCE_ORGANIZATION_ID: ID of the source organization
 * 
 * 2. Or update the configuration constants below
 * 
 * 3. Update organization names in the main function
 * 
 * WHAT IT DOES:
 * For each organization name:
 * - Creates a new partner organization
 * - Adds a member as admin to the organization
 * - Duplicates an assistant to the new organization
 */

// Node.js globals
declare const process: any;
declare const require: any;
declare const module: any;

// Configuration - Update these values or use environment variables
const AUTH_BASE_URL = "https://services.antonnia.com/auth/api/v1";
const ASSISTANTS_BASE_URL = "https://services.antonnia.com/assistants/api/v1";
const WHATSAPP_BASE_URL = "https://services.antonnia.com/whatsapp/api/v1";
const API_TOKEN = process.env.API_TOKEN || "your-api-token-here";

// Default configuration values
const DEFAULT_MEMBER_EMAIL = process.env.DEFAULT_MEMBER_EMAIL || "admin@example.com";
const DEFAULT_MEMBER_ROLE = process.env.DEFAULT_MEMBER_ROLE || "admin";
const SOURCE_ASSISTANT_ID = process.env.SOURCE_ASSISTANT_ID || "your-source-assistant-id";
const SOURCE_ORGANIZATION_ID = process.env.SOURCE_ORGANIZATION_ID || "your-source-organization-id";
const HUBLA_APP_ID = process.env.HUBLA_APP_ID || "519e9f1e-9e9c-4365-b803-36a3f07d8937";
const WHATSAPP_APP_ID = process.env.WHATSAPP_APP_ID || "abc2ba2e-2e7c-4f31-a3d0-e44cf8b5ca7fd";
// Types
interface Organization {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  type: string;
  partner_id: string;
}

interface Member {
  id?: string;
  email?: string;
  role: string;
}

// HTTP response handler
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Common error status codes
const ERROR_CODES = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 422
} as const;

// Handle API response with common error patterns
async function handleApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  if (response.status === ERROR_CODES.UNAUTHORIZED) {
    return { success: false, error: 'Authentication failed - check your Bearer token' };
  }
  
  if (response.status === ERROR_CODES.FORBIDDEN) {
    return { success: false, error: 'Forbidden - you may not have partner account permissions' };
  }
  
  if (response.status === ERROR_CODES.VALIDATION_ERROR) {
    return { success: false, error: 'Validation error - check the request data format' };
  }

  if (!response.ok) {
    return { success: false, error: `Request failed: ${response.status} ${response.statusText}` };
  }

  const data = await response.json();
  return { success: true, data };
}

// Make authenticated API request
async function makeApiRequest<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    }
  });
  
  return handleApiResponse<T>(response);
}


// Create partner organization
async function createPartnerOrganization(name: string, token: string): Promise<Organization | null> {
  const url = `${AUTH_BASE_URL}/partner/organizations`;
  
  const result = await makeApiRequest<Organization>(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name })
  });

  return result.success ? result.data! : null;
}

// Add member to organization
async function addMemberToOrganization(
  organizationId: string, 
  email: string, 
  role: string = 'member', 
  token: string = API_TOKEN
): Promise<Member | null> {
  const url = `${AUTH_BASE_URL}/partner/organizations/${organizationId}/members`;
  
  const result = await makeApiRequest<Member>(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ email, role })
  });

  return result.success ? result.data! : null;
}

// List organizations
async function listOrganizations(token: string = API_TOKEN): Promise<Organization[]> {
  const url = `${AUTH_BASE_URL}/partner/organizations`;
  
  const result = await makeApiRequest<Organization[]>(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!result.success) {
    throw new Error(`Failed to list organizations: ${result.error}`);
  }

  return result.data!;
}

// Duplicate assistant
async function duplicateAssistant(
  assistantId: string, 
  organizationId: string, 
  targetOrganizationId: string
): Promise<any> {
  const url = `${ASSISTANTS_BASE_URL}/assistants/${assistantId}/duplicate`;
  
  const result = await makeApiRequest(url, {
    method: 'POST',
    headers: {
      'X-Organization-Id': organizationId,
      'X-Target-Organization-Id': targetOrganizationId
    }
  });

  if (!result.success) {
    throw new Error(`Failed to duplicate assistant: ${result.error}`);
  }

  return result.data;
}

// Complete workflow for each organization
async function processOrganization(
  organizationName: string, 
  token: string, 
  memberEmail: string, 
  memberRole: string,
  sourceAssistantId: string,
  sourceOrganizationId: string
): Promise<void> {
  console.log(`Processing organization: ${organizationName}`);
  
  // Step 1: Create organization
  const organization = await createPartnerOrganization(organizationName, token);
  if (!organization) {
    console.error(`Failed to create organization for ${organizationName}`);
    return;
  }
  console.log(`✅ Created organization: ${organization.name} (${organization.id})`);
  
  // Step 2: Add member to organization
  const member = await addMemberToOrganization(organization.id, memberEmail, memberRole, token);
  if (!member) {
    console.error(`Failed to add member to organization ${organization.id}`);
    return;
  }
  console.log(`✅ Added member ${memberEmail} to organization ${organization.name}`);
  
  // Step 3: Duplicate assistant to the new organization
  try {
    const duplicatedAssistant = await duplicateAssistant(sourceAssistantId, sourceOrganizationId, organization.id);
    console.log(`✅ Duplicated assistant to organization ${organization.name}`);
  } catch (error) {
    console.error(`Failed to duplicate assistant to organization ${organization.id}: ${error}`);
  }
}

// Process all organizations
async function processAllOrganizations(
  organizationNames: string[], 
  token: string, 
  memberEmail: string, 
  memberRole: string,
  sourceAssistantId: string,
  sourceOrganizationId: string
): Promise<void> {
  for (const organizationName of organizationNames) {
    await processOrganization(organizationName, token, memberEmail, memberRole, sourceAssistantId, sourceOrganizationId);
    console.log('---');
  }
}


async function connectToHublaApp(organizationId: string = SOURCE_ORGANIZATION_ID, appId: string = HUBLA_APP_ID, token: string = API_TOKEN) {

  const url = `${AUTH_BASE_URL}/partner/organizations/${organizationId}/apps/${appId}`;
  const result = await makeApiRequest(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return result.success ? result.data! : null;
}

async function connectToWhatsAppApp(organizationId: string = SOURCE_ORGANIZATION_ID, appId: string = WHATSAPP_APP_ID, token: string = API_TOKEN) {
  const url = `${AUTH_BASE_URL}/partner/organizations/${organizationId}/apps/${appId}`;
  const result = await makeApiRequest(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return result.success ? result.data! : null;
}

async function createOrganizationToken(organizationId: string, appId: string, keyName: string | null = null, token: string = API_TOKEN) {
  const url = `${AUTH_BASE_URL}/partner/organizations/${organizationId}/tokens`;
  const result = await makeApiRequest(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ key_name: keyName, app_id: appId })
  });
  return result.success ? result.data! : null;
}

async function startWhatsAppConversation(
  channel_id: string, 
  contact_name: string,
  contact_phone: string,
  template_id: string,
  template_parameters: Record<string, any> | null = null,
  metadata: Record<string, any> | null = null,
  client_token: string, // THIS IS NOT PARTNER TOKEN< ITS THE ONE CREATED USING createOrganizationToken
) {
  const url = `${WHATSAPP_BASE_URL}/start-conversation`;
  const result = await makeApiRequest(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${client_token}`
    },
    body: JSON.stringify({ channel_id, contact_name, contact_phone, template_id, template_parameters, metadata })
  });
  return result.success ? result.data! : null;
}

// Main execution
async function createOrganizationsWithPartnerToken() {
  try {
    const organization_names = [
        "Company A",
        "Company B",
        "Company C",
        "Company D",
        "Company E",
        "Company F",
        "Company G",
        "Company H",
    ];

    // Configuration - these can be overridden by environment variables
    const token = API_TOKEN;
    const memberEmail = DEFAULT_MEMBER_EMAIL;
    const memberRole = DEFAULT_MEMBER_ROLE;
    const sourceAssistantId = SOURCE_ASSISTANT_ID;
    const sourceOrganizationId = SOURCE_ORGANIZATION_ID;
    
    // Validate configuration
    if (token === "your-api-token-here" || sourceAssistantId === "your-source-assistant-id" || sourceOrganizationId === "your-source-organization-id") {
      throw new Error("Please configure your API token, source assistant ID, and source organization ID before running the script");
    }

    console.log(`Starting processing of ${organization_names.length} organizations...\n`);
    
    // Process all organizations: create org, add member, duplicate assistant
    await processAllOrganizations(organization_names, token, memberEmail, memberRole, sourceAssistantId, sourceOrganizationId);
    
    console.log('\n🎉 All organizations processed successfully!');
    
    // List all organizations at the end
    console.log('\nFinal organization list:');
    const organizations = await listOrganizations(token);
    console.log(`Found ${organizations.length} organizations:`);
    organizations.forEach(org => {
      console.log(`  - ${org.name} (${org.id})`);
    });

  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createOrganizationsWithPartnerToken();
}
