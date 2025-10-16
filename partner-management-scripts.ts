#!/usr/bin/env ts-node

/**
 * Partner Management Scripts
 * 
 * This file contains two main scripts for partner organization management:
 * 
 * SCRIPT 1: Create Organizations and Duplicate Assistants
 * - Creates new partner organizations
 * - Adds admin members to each organization
 * - Duplicates assistants from source organization to new organizations
 * 
 * SCRIPT 2: Connect Apps and Start Conversations
 * - Connects organizations to Hubla and WhatsApp apps
 * - Creates API tokens for organizations
 * - Starts WhatsApp conversations using the created tokens
 * 
 * SETUP INSTRUCTIONS:
 * 1. Configure environment variables:
 *    - AUTH_BASE_URL: Your auth API base URL
 *    - ASSISTANTS_BASE_URL: Your assistants API base URL
 *    - WHATSAPP_BASE_URL: Your WhatsApp API base URL
 *    - API_TOKEN: Your API authentication token
 *    - DEFAULT_MEMBER_EMAIL: Email to add as admin to each organization
 *    - SOURCE_ASSISTANT_ID: ID of the assistant to duplicate
 *    - SOURCE_ORGANIZATION_ID: ID of the source organization
 *    - HUBLA_APP_ID: ID of the Hubla app to connect
 *    - WHATSAPP_APP_ID: ID of the WhatsApp app to connect
 * 
 * 2. Or update the configuration constants below
 * 
 * 3. Update organization names and conversation parameters in the main functions
 * 
 * USAGE:
 * - Run script 1: npm run create-organizations
 * - Run script 2: npm run connect-apps
 * - Or call the functions directly in your code
 */

// Node.js globals
declare const process: any;
declare const require: any;
declare const module: any;

// ============================================================================
// CONFIGURATION
// ============================================================================

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

// ============================================================================
// TYPES
// ============================================================================

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

interface ApiKey {
  key_id: string;
  key_name: string;
  organization_id: string;
  secret: string | null;
  app_id: string | null;
  type: "app_token" | "account_token";
  is_active: boolean;
  created_at: string;
}

interface ConversationResult {
  conversation_id: string;
  status: string;
  message?: string;
}

// HTTP response handler
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Common error status codes
const ERROR_CODES = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 422
} as const;

/**
 * Handle API response with common error patterns
 */
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

/**
 * Make authenticated API request
 */
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

/**
 * Validate configuration before running scripts
 */
function validateConfiguration(): void {
  if (API_TOKEN === "your-api-token-here") {
    throw new Error("Please configure your API_TOKEN environment variable or update the constant");
  }
  if (SOURCE_ASSISTANT_ID === "your-source-assistant-id") {
    throw new Error("Please configure your SOURCE_ASSISTANT_ID environment variable or update the constant");
  }
  if (SOURCE_ORGANIZATION_ID === "your-source-organization-id") {
    throw new Error("Please configure your SOURCE_ORGANIZATION_ID environment variable or update the constant");
  }
}

// ============================================================================
// ORGANIZATION MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Create a new partner organization
 */
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

/**
 * Add a member to an organization
 */
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

/**
 * List all organizations
 */
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

/**
 * Duplicate an assistant from source organization to target organization
 */
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

// ============================================================================
// APP CONNECTION AND TOKEN MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Connect an organization to the Hubla app
 */
async function connectToHublaApp(
  organizationId: string, 
  appId: string = HUBLA_APP_ID, 
  token: string = API_TOKEN
): Promise<any> {
  const url = `${AUTH_BASE_URL}/partner/organizations/${organizationId}/apps/${appId}`;
  const result = await makeApiRequest(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return result.success ? result.data! : null;
}

/**
 * Connect an organization to the WhatsApp app
 */
async function connectToWhatsAppApp(
  organizationId: string, 
  appId: string = WHATSAPP_APP_ID, 
  token: string = API_TOKEN
): Promise<any> {
  const url = `${AUTH_BASE_URL}/partner/organizations/${organizationId}/apps/${appId}`;
  const result = await makeApiRequest(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return result.success ? result.data! : null;
}

/**
 * Create an API key for an organization
 */
async function createOrganizationToken(
  organizationId: string, 
  appId: string, 
  keyName: string | null = null, 
  token: string = API_TOKEN
): Promise<ApiKey | null> {
  const url = `${AUTH_BASE_URL}/partner/organizations/${organizationId}/tokens`;
  const result = await makeApiRequest<ApiKey>(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ key_name: keyName, app_id: appId })
  });
  return result.success ? result.data! : null;
}

// ============================================================================
// WHATSAPP CONVERSATION FUNCTIONS
// ============================================================================

/**
 * Start a WhatsApp conversation using an organization's API key
 */
async function startWhatsAppConversation(
  channel_id: string, 
  contact_name: string,
  contact_phone: string,
  template_id: string,
  template_parameters: Record<string, any> | null = null,
  metadata: Record<string, any> | null = null,
  client_token: string // This is the organization key created with createOrganizationToken
): Promise<boolean> {
  const url = `${WHATSAPP_BASE_URL}/start-conversation`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${client_token}`
    },
    body: JSON.stringify({ 
      channel_id, 
      contact_name, 
      contact_phone, 
      template_id, 
      template_parameters, 
      metadata 
    })
  });

  // WhatsApp API returns 204 on success (no content)
  return response.status === 204;
}

// ============================================================================
// SCRIPT 1: CREATE ORGANIZATIONS AND DUPLICATE ASSISTANTS
// ============================================================================

/**
 * SCRIPT 1: Create organizations and duplicate assistants
 */
async function createOrganizationsAndDuplicateAssistants(): Promise<Organization[]> {
  try {
    validateConfiguration();

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

    // Configuration
    const token = API_TOKEN;
    const memberEmail = DEFAULT_MEMBER_EMAIL;
    const memberRole = DEFAULT_MEMBER_ROLE;
    const sourceAssistantId = SOURCE_ASSISTANT_ID;
    const sourceOrganizationId = SOURCE_ORGANIZATION_ID;

    console.log(`🚀 Starting Script 1: Create Organizations and Duplicate Assistants`);
    console.log(`Processing ${organization_names.length} organizations...\n`);
    
    const createdOrganizations: Organization[] = [];
    
    for (const organizationName of organization_names) {
      console.log(`Processing organization: ${organizationName}`);
      
      // Step 1: Create organization
      const organization = await createPartnerOrganization(organizationName, token);
      if (!organization) {
        console.error(`Failed to create organization for ${organizationName}`);
        continue;
      }
      console.log(`✅ Created organization: ${organization.name} (${organization.id})`);
      
      // Step 2: Add member to organization
      const member = await addMemberToOrganization(organization.id, memberEmail, memberRole, token);
      if (!member) {
        console.error(`Failed to add member to organization ${organization.id}`);
      } else {
        console.log(`✅ Added member ${memberEmail} to organization ${organization.name}`);
      }
      
      // Step 3: Duplicate assistant to the new organization
      try {
        const duplicatedAssistant = await duplicateAssistant(sourceAssistantId, sourceOrganizationId, organization.id);
        console.log(`✅ Duplicated assistant to organization ${organization.name}`);
      } catch (error) {
        console.error(`Failed to duplicate assistant to organization ${organization.id}: ${error}`);
      }

      createdOrganizations.push(organization);
      console.log('---');
    }
    
    console.log('\n🎉 Script 1 completed successfully!');
    console.log(`Created ${createdOrganizations.length} organizations:`);
    createdOrganizations.forEach(org => {
      console.log(`  - ${org.name} (${org.id})`);
    });
    
    // List all organizations at the end
    console.log('\n📋 Final organization list:');
    const organizations = await listOrganizations(token);
    console.log(`Found ${organizations.length} total organizations:`);
    organizations.forEach(org => {
      console.log(`  - ${org.name} (${org.id})`);
    });

    return createdOrganizations;

  } catch (error) {
    console.error(`❌ Script 1 Error: ${error}`);
    throw error;
  }
}

// ============================================================================
// SCRIPT 2: CONNECT APPS AND START CONVERSATIONS
// ============================================================================

/**
 * SCRIPT 2: Connect apps and start conversations
 */
async function connectAppsAndStartConversations(organizations: Organization[]): Promise<void> {
  try {
    validateConfiguration();

    const token = API_TOKEN;
    const hublaAppId = HUBLA_APP_ID;
    const whatsappAppId = WHATSAPP_APP_ID;

    // Conversation parameters - customize these for your use case
    const conversationParams = {
      channel_id: "your-channel-id", // Replace with actual channel ID
      contact_name: "Test Contact",
      contact_phone: "+1234567890", // Replace with actual phone number
      template_id: "your-template-id", // Replace with actual template ID
      template_parameters: {
        // Add any template parameters here
        name: "Test User"
      },
      metadata: {
        // Add any metadata here
        source: "partner-script"
      }
    };

    console.log(`🚀 Starting Script 2: Connect Apps and Start Conversations`);
    console.log(`Processing ${organizations.length} organizations...\n`);
    
    const results: Array<{ organization: Organization; apiKey: ApiKey | null; conversationStarted: boolean }> = [];
    
    for (const organization of organizations) {
      console.log(`Processing organization for apps: ${organization.name}`);
      
      // Step 1: Connect to Hubla app
      try {
        const hublaConnection = await connectToHublaApp(organization.id, hublaAppId, token);
        if (hublaConnection) {
          console.log(`✅ Connected ${organization.name} to Hubla app`);
        } else {
          console.log(`⚠️  Failed to connect ${organization.name} to Hubla app`);
        }
      } catch (error) {
        console.error(`Failed to connect ${organization.name} to Hubla app: ${error}`);
      }
      
      // Step 2: Connect to WhatsApp app
      try {
        const whatsappConnection = await connectToWhatsAppApp(organization.id, whatsappAppId, token);
        if (whatsappConnection) {
          console.log(`✅ Connected ${organization.name} to WhatsApp app`);
        } else {
          console.log(`⚠️  Failed to connect ${organization.name} to WhatsApp app`);
        }
      } catch (error) {
        console.error(`Failed to connect ${organization.name} to WhatsApp app: ${error}`);
      }
      
      // Step 3: Create API key for WhatsApp app
      let apiKey: ApiKey | null = null;
      try {
        apiKey = await createOrganizationToken(organization.id, whatsappAppId, `Key for ${organization.name}`, token);
        if (apiKey) {
          console.log(`✅ Created API key for ${organization.name}`);
        } else {
          console.log(`⚠️  Failed to create API key for ${organization.name}`);
        }
      } catch (error) {
        console.error(`Failed to create API key for ${organization.name}: ${error}`);
      }
      
      // Step 4: Start WhatsApp conversation using the created key
      let conversationStarted = false;
      if (apiKey && apiKey.secret) {
        try {
          conversationStarted = await startWhatsAppConversation(
            conversationParams.channel_id,
            conversationParams.contact_name,
            conversationParams.contact_phone,
            conversationParams.template_id,
            conversationParams.template_parameters,
            conversationParams.metadata,
            apiKey.secret
          );
          
          if (conversationStarted) {
            console.log(`✅ Started WhatsApp conversation for ${organization.name}`);
          } else {
            console.log(`⚠️  Failed to start WhatsApp conversation for ${organization.name}`);
          }
        } catch (error) {
          console.error(`Failed to start WhatsApp conversation for ${organization.name}: ${error}`);
        }
      } else {
        console.log(`⚠️  Skipping conversation start for ${organization.name} - no API key secret available`);
      }

      results.push({ organization, apiKey, conversationStarted });
      console.log('---');
    }
    
    console.log('\n🎉 Script 2 completed successfully!');
    console.log(`Processed ${results.length} organizations:`);
    
    results.forEach(result => {
      console.log(`\n📊 ${result.organization.name}:`);
      console.log(`  - Organization ID: ${result.organization.id}`);
      console.log(`  - API Key: ${result.apiKey ? '✅ Created' : '❌ Failed'}`);
      if (result.apiKey) {
        console.log(`  - Key ID: ${result.apiKey.key_id}`);
        console.log(`  - Key Type: ${result.apiKey.type}`);
        console.log(`  - Is Active: ${result.apiKey.is_active}`);
      }
      console.log(`  - Conversation: ${result.conversationStarted ? '✅ Started' : '❌ Failed'}`);
    });

  } catch (error) {
    console.error(`❌ Script 2 Error: ${error}`);
    throw error;
  }
}

// ============================================================================
// COMBINED WORKFLOW
// ============================================================================

/**
 * Run both scripts in sequence
 */
async function runCompleteWorkflow(): Promise<void> {
  try {
    console.log('🚀 Starting Complete Partner Management Workflow\n');
    
    // Step 1: Create organizations and duplicate assistants
    const createdOrganizations = await createOrganizationsAndDuplicateAssistants();
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Step 2: Connect apps and start conversations
    await connectAppsAndStartConversations(createdOrganizations);
    
    console.log('\n🎉 Complete workflow finished successfully!');
    
  } catch (error) {
    console.error(`❌ Workflow Error: ${error}`);
    process.exit(1);
  }
}

// ============================================================================
// EXPORTS AND MAIN EXECUTION
// ============================================================================

// Export functions for use by other scripts
export {
  // Organization management endpoints
  createPartnerOrganization,
  addMemberToOrganization,
  duplicateAssistant,
  listOrganizations,
  
  // App connection endpoints
  connectToHublaApp,
  connectToWhatsAppApp,
  createOrganizationToken,
  
  // WhatsApp conversation endpoint
  startWhatsAppConversation,
  
  // Main scripts
  createOrganizationsAndDuplicateAssistants,
  connectAppsAndStartConversations,
  runCompleteWorkflow
};

// Main execution - run based on command line arguments
if (require.main === module) {
  const script = process.argv[2];
  
  switch (script) {
    case 'create-organizations':
      createOrganizationsAndDuplicateAssistants();
      break;
    case 'connect-apps':
      // For this script, you need to provide organization IDs
      // You can modify this to read from a file or pass as arguments
      console.log('⚠️  connect-apps script requires organization IDs. Use runCompleteWorkflow() or provide organization data.');
      break;
    case 'complete':
    default:
      runCompleteWorkflow();
      break;
  }
}
