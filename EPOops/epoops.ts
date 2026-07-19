import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Define paths
const TOKEN_CACHE_PATH = join(import.meta.dirname, ".token_cache.json");
const ENV_PATH = join(import.meta.dirname, ".env");

// Explicitly load .env file from the script directory
if (existsSync(ENV_PATH)) {
  const envContent = readFileSync(ENV_PATH, "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index !== -1) {
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      process.env[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }
}


// Interface for Token Cache
interface TokenCache {
  accessToken: string;
  expiresAt: number; // timestamp in ms
}

// -------------------------------------------------------------
// 1. Helper functions to parse BadgerFish JSON format
// -------------------------------------------------------------

/**
 * Recursively extracts text content from BadgerFish JSON structure
 */
function extractText(obj: any): string {
  if (obj === undefined || obj === null) return "";
  if (typeof obj === "string") return obj;
  if (typeof obj === "number") return String(obj);
  
  if (Array.isArray(obj)) {
    return obj.map(extractText).filter(Boolean).join("\n");
  }
  
  // BadgerFish uses "$" for element text content
  if (obj["$"] !== undefined) {
    return String(obj["$"]);
  }
  
  // If it contains paragraphs or child elements
  if (typeof obj === "object") {
    // Check common container tags in OPS responses like 'p' or 'claim'
    for (const key of ["p", "claim", "claim-text", "invention-title", "abstract"]) {
      if (obj[key] !== undefined) {
        return extractText(obj[key]);
      }
    }
    
    // Fallback: search all fields (excluding metadata/attributes starting with '@')
    const parts: string[] = [];
    for (const key in obj) {
      if (!key.startsWith("@")) {
        const text = extractText(obj[key]);
        if (text) parts.push(text);
      }
    }
    if (parts.length > 0) return parts.join("\n");
  }
  
  return "";
}

/**
 * Helper to get a value from an object regardless of prefix namespace (e.g. "ops:range" vs "range")
 */
function getNamespacedProperty(obj: any, propName: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  if (obj[propName] !== undefined) return obj[propName];
  
  for (const key in obj) {
    if (key.endsWith(":" + propName)) {
      return obj[key];
    }
  }
  return undefined;
}

// -------------------------------------------------------------
// 2. Client Class for EPO OPS API
// -------------------------------------------------------------
class EpoOpsClient {
  private consumerKey: string;
  private consumerSecret: string;
  private baseUrl = "https://ops.epo.org/3.2/rest-services";
  private tokenUrl = "https://ops.epo.org/3.2/auth/accesstoken";

  constructor() {
    // Load environment variables (Bun loads .env automatically, but we check/warn if empty)
    this.consumerKey = process.env.EPO_CONSUMER_KEY || "";
    this.consumerSecret = process.env.EPO_CONSUMER_SECRET || "";

    if (!this.consumerKey || !this.consumerSecret) {
      console.error("\x1b[31mError: EPO_CONSUMER_KEY or EPO_CONSUMER_SECRET is not set.\x1b[0m");
      console.error(`Please edit the \x1b[33m.env\x1b[0m file in the script directory (${ENV_PATH}) with:`);
      console.error("EPO_CONSUMER_KEY=your_key");
      console.error("EPO_CONSUMER_SECRET=your_secret");
      process.exit(1);
    }
  }

  /**
   * Retrieves or refreshes OAuth 2.0 access token
   */
  private async getAccessToken(): Promise<string> {
    // 1. Check disk cache
    if (existsSync(TOKEN_CACHE_PATH)) {
      try {
        const cache: TokenCache = JSON.parse(readFileSync(TOKEN_CACHE_PATH, "utf8"));
        // Check if token is still valid (with 30 seconds safety margin)
        if (cache.expiresAt > Date.now() + 30000) {
          return cache.accessToken;
        }
      } catch (e) {
        // Cache invalid, ignore
      }
    }

    // 2. Refresh Token from EPO
    // Encode Consumer Key and Secret to Base64
    const credentials = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString("base64");
    
    console.log("\x1b[36mAuthenticating with EPO OPS API...\x1b[0m");
    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed (HTTP ${response.status}): ${errorText}`);
    }

    const data = await response.json() as { access_token: string; expires_in: string };
    const expiresInSeconds = parseInt(data.expires_in, 10) || 1200;
    
    const tokenCache: TokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (expiresInSeconds * 1000)
    };

    // Save token to cache
    writeFileSync(TOKEN_CACHE_PATH, JSON.stringify(tokenCache), "utf8");
    return tokenCache.accessToken;
  }

  /**
   * Generic request sender
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}/${endpoint}`;
    
    const headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      ...(options.headers || {})
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded (HTTP 429). Please check the Fair Use Charter guidelines.");
      }
      const errText = await response.text();
      throw new Error(`EPO API Request failed (HTTP ${response.status}): ${errText}`);
    }

    return response.json();
  }

  /**
   * Search patents using CQL (Contextual Query Language)
   */
  async search(cqlQuery: string, range = "1-10"): Promise<any> {
    const encodedQuery = encodeURIComponent(cqlQuery);
    return this.request(`published-data/search?q=${encodedQuery}`, {
      headers: {
        "X-OPS-Range": range
      }
    });
  }

  /**
   * Fetch bibliographic data for a patent
   */
  async getBiblio(number: string): Promise<any> {
    return this.request(`published-data/publication/docdb/${number}/biblio`);
  }

  /**
   * Fetch abstract text for a patent
   */
  async getAbstract(number: string): Promise<any> {
    return this.request(`published-data/publication/docdb/${number}/abstract`);
  }

  /**
   * Fetch claims text for a patent
   */
  async getClaims(number: string): Promise<any> {
    return this.request(`published-data/publication/docdb/${number}/claims`);
  }

  /**
   * Fetch description text for a patent
   */
  async getDescription(number: string): Promise<any> {
    return this.request(`published-data/publication/docdb/${number}/description`);
  }
}

// -------------------------------------------------------------
// 3. CLI Presentation and Command Mapping
// -------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  const client = new EpoOpsClient();

  try {
    if (command === "search") {
      const query = args[1];
      const range = args[2] || "1-10";
      if (!query) {
        console.error("Error: Please provide a search query.");
        console.log('Example: bun scripts/EPOops/epoops.ts search "pa=Apple"');
        process.exit(1);
      }
      
      console.log(`\n\x1b[35mSearching for: "${query}" (Range: ${range})...\x1b[0m`);
      const result = await client.search(query, range);
      displaySearchResults(result);
    } 
    else if (command === "info") {
      const patentNumber = args[1];
      if (!patentNumber) {
        console.error("Error: Please provide a patent number.");
        console.log('Example: bun scripts/EPOops/epoops.ts info "EP1000000"');
        process.exit(1);
      }

      console.log(`\n\x1b[35mFetching details for patent: ${patentNumber}...\x1b[0m`);
      
      // We run requests in parallel to be fast!
      const [biblio, abstractRes, claimsRes, descRes] = await Promise.allSettled([
        client.getBiblio(patentNumber),
        client.getAbstract(patentNumber),
        client.getClaims(patentNumber),
        client.getDescription(patentNumber)
      ]);

      displayPatentInfo(
        patentNumber,
        biblio.status === "fulfilled" ? biblio.value : null,
        abstractRes.status === "fulfilled" ? abstractRes.value : null,
        claimsRes.status === "fulfilled" ? claimsRes.value : null,
        descRes.status === "fulfilled" ? descRes.value : null
      );
    } 
    else {
      console.error(`Unknown command: ${command}`);
      printUsage();
    }
  } catch (error: any) {
    console.error(`\n\x1b[31mError executing command:\x1b[0m`, error.message);
  }
}

function printUsage() {
  console.log(`
\x1b[1mEPO OPS API CLI Client Tool (Bun Runtime)\x1b[0m
------------------------------------------------
Usage:
  bun scripts/EPOops/epoops.ts <command> [arguments]

Commands:
  \x1b[36msearch "<cql_query>" [range]\x1b[0m  Search patents using CQL (Contextual Query Language)
                              range format: "begin-end" (default: "1-10", max range 100)
                              Example: bun scripts/EPOops/epoops.ts search "pa=Apple" "1-5"
                              Common keys: ti (title), pa (applicant), in (inventor), txt (full text)

  \x1b[36minfo "<patent_number>"\x1b[0m      Retrieve all details for a specific patent (Biblio, Abstract, Claims, Description)
                              Example: bun scripts/EPOops/epoops.ts info "EP1000000"
  `);
}

// Format Search Results
function displaySearchResults(res: any) {
  const root = getNamespacedProperty(res, "world-patent-data");
  const biblioSearch = getNamespacedProperty(root, "biblio-search");
  const searchResult = getNamespacedProperty(biblioSearch || root, "search-result");
  if (!searchResult) {
    console.log("No search results found or unexpected response format.");
    return;
  }

  const publications = getNamespacedProperty(searchResult, "publication-reference") || [];
  const list = Array.isArray(publications) ? publications : [publications];

  console.log(`\n\x1b[32mFound ${list.length} publications:\x1b[0m`);
  console.log("=".repeat(80));

  for (let i = 0; i < list.length; i++) {
    const pub = list[i];
    const docIdObj = getNamespacedProperty(pub, "document-id");
    const docIdList = Array.isArray(docIdObj) ? docIdObj : [docIdObj];
    
    // Find docdb representation or fallback to first
    const docId = docIdList.find(d => d && d["@document-id-type"] === "docdb") || docIdList[0];
    
    if (!docId) continue;
    
    const country = docId["country"]?.["$"] || "";
    const docNumber = docId["doc-number"]?.["$"] || "";
    const kind = docId["kind"]?.["$"] || "";
    const titleObj = getNamespacedProperty(pub, "invention-title");
    const title = extractText(titleObj);
    const titleStr = title ? ` - ${title}` : "";

    console.log(`[${i + 1}] \x1b[33m${country}.${docNumber}.${kind}\x1b[0m${titleStr}`);
  }
  console.log("=".repeat(80));
}

// Format Full Patent Details
function displayPatentInfo(patentNumber: string, biblio: any, abstract: any, claims: any, description: any) {
  console.log("\n" + "=".repeat(80));
  console.log(`\x1b[1;32mPATENT DATA SHEET: ${patentNumber}\x1b[0m`);
  console.log("=".repeat(80));

  // Helper to extract the document node (works for both exchange-document and fulltext-document formats)
  const getDocumentNode = (res: any) => {
    if (!res) return null;
    const root = getNamespacedProperty(res, "world-patent-data");
    if (!root) return null;
    
    const exchangeDocs = getNamespacedProperty(root, "exchange-documents");
    const exchangeDoc = getNamespacedProperty(exchangeDocs, "exchange-document");
    if (exchangeDoc) return exchangeDoc;
    
    const fulltextDocs = getNamespacedProperty(root, "fulltext-documents");
    const fulltextDoc = getNamespacedProperty(fulltextDocs, "fulltext-document");
    return fulltextDoc || root;
  };

  // 1. Bibliographic Information
  if (biblio) {
    try {
      const doc = getDocumentNode(biblio);
      const bib = getNamespacedProperty(doc, "bibliographic-data");
      
      if (bib) {
        const titles = getNamespacedProperty(bib, "invention-title") || [];
        const titleList = Array.isArray(titles) ? titles : [titles];
        const enTitle = titleList.find((t: any) => t["@lang"] === "en") || titleList[0];
        
        console.log(`\x1b[36mTitle (EN):\x1b[0m  ${extractText(enTitle)}`);
        
        // Inventors
        const inventorsObj = bib["patent-inventors"]?.["inventors"]?.["inventor"] || [];
        const inventorList = Array.isArray(inventorsObj) ? inventorsObj : [inventorsObj];
        const inventors = inventorList.map((inv: any) => {
          const nameObj = inv["inventor-name"]?.["name"];
          return nameObj ? extractText(nameObj) : "";
        }).filter(Boolean).join(", ");
        console.log(`\x1b[36mInventors:\x1b[0m   ${inventors || "Not listed"}`);

        // Applicants
        const applicantsObj = bib["patent-applicants"]?.["applicants"]?.["applicant"] || [];
        const applicantList = Array.isArray(applicantsObj) ? applicantsObj : [applicantsObj];
        const applicants = applicantList.map((app: any) => {
          const nameObj = app["applicant-name"]?.["name"];
          return nameObj ? extractText(nameObj) : "";
        }).filter(Boolean).join(", ");
        console.log(`\x1b[36mApplicants:\x1b[0m  ${applicants || "Not listed"}`);

        // Dates
        const pubRef = getNamespacedProperty(bib, "publication-reference");
        const docIdObj = pubRef?.["document-id"];
        const docIdList = Array.isArray(docIdObj) ? docIdObj : [docIdObj];
        const docId = docIdList.find((d: any) => d["@document-id-type"] === "docdb") || docIdList[0];
        const pubDate = docId?.["date"]?.["$"] || "N/A";
        console.log(`\x1b[36mPub Date:\x1b[0m    ${pubDate}`);
      } else {
        console.log("\x1b[31mCould not find bibliographic-data in response.\x1b[0m");
      }
    } catch (e: any) {
      console.log("\x1b[31m[Warning] Could not parse bibliographic data fully.\x1b[0m");
    }
  } else {
    console.log("\x1b[31mBibliographic data request failed or not found.\x1b[0m");
  }

  // 2. Abstract
  console.log("\n" + "-".repeat(40));
  console.log(`\x1b[1;36mABSTRACT\x1b[0m`);
  console.log("-".repeat(40));
  if (abstract) {
    try {
      const doc = getDocumentNode(abstract);
      const abst = getNamespacedProperty(doc, "abstract");
      console.log(extractText(abst).trim() || "(Empty Abstract)");
    } catch (e) {
      console.log("(Failed to parse abstract content)");
    }
  } else {
    console.log("(Abstract not found / not published)");
  }

  // 3. Claims
  console.log("\n" + "-".repeat(40));
  console.log(`\x1b[1;36mCLAIMS\x1b[0m`);
  console.log("-".repeat(40));
  if (claims) {
    try {
      const doc = getDocumentNode(claims);
      const cls = getNamespacedProperty(doc, "claims");
      console.log(extractText(cls).trim() || "(Empty Claims)");
    } catch (e) {
      console.log("(Failed to parse claims content)");
    }
  } else {
    console.log("(Claims not found / not published)");
  }

  // 4. Description
  console.log("\n" + "-".repeat(40));
  console.log(`\x1b[1;36mDESCRIPTION (Truncated first 1000 chars)\x1b[0m`);
  console.log("-".repeat(40));
  if (description) {
    try {
      const doc = getDocumentNode(description);
      const desc = getNamespacedProperty(doc, "description");
      const text = extractText(desc).trim();
      if (text.length > 1000) {
        console.log(text.substring(0, 1000) + "\n\n... [Truncated for brevity] ...");
      } else {
        console.log(text || "(Empty Description)");
      }
    } catch (e) {
      console.log("(Failed to parse description content)");
    }
  } else {
    console.log("(Description not found / not published)");
  }
  console.log("=".repeat(80) + "\n");
}

// Run CLI
main();
