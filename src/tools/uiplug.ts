import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const SUPABASE_URL = "https://uuoexpurygmgfouiawuc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1b2V4cHVyeWdtZ2ZvdWlhd3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NzI5MTMsImV4cCI6MjA4NzI0ODkxM30.4gogFo90o8lfZ9_iKZfhXQ9QHtx2VKhMu9Hgy_2lI_g";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function validateApiKey(apiKey: string | undefined): Promise<{ userId: string | null; error: string | null }> {
  if (!apiKey) return { userId: null, error: "No API key provided." };
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, user_id, is_active")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();
  if (error || !data) return { userId: null, error: "Invalid or revoked API key." };
  supabase.rpc("increment_api_key_usage", { p_key_id: data.id }).then(() => {});
  return { userId: data.user_id, error: null };
}

export const uiplugTools = [
  {
    name: "list_components",
    description:
      "List published UI components from the UIPlug marketplace. " +
      "Optionally filter by framework, category, or group_slug.",
    input_schema: {
      type: "object",
      properties: {
        framework: { type: "string", description: "Filter by framework (e.g. React, Vue, Svelte)" },
        category: { type: "string", description: "Filter by category (e.g. Layout, Input, Navigation)" },
        limit: { type: "number", description: "Max results (default 20, max 50)" },
        group_slug: { type: "string", description: "Filter to a specific group slug" },
      },
    },
  },
  {
    name: "search_components",
    description: "Search UIPlug components by name, description, or tag.",
    input_schema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Search term" },
        framework: { type: "string", description: "Narrow by framework" },
        group_slug: { type: "string", description: "Narrow to a specific group" },
      },
    },
  },
  {
    name: "get_component",
    description: "Get full source code and metadata for a UIPlug component by ID.",
    input_schema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Component UUID from list_components or search_components" },
      },
    },
  },
  {
    name: "get_my_profile",
    description: "Get your UIPlug profile info including username and component stats.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_my_components",
    description: "List all components you have created on UIPlug, including pending ones.",
    input_schema: {
      type: "object",
      properties: {
        framework: { type: "string" },
        category: { type: "string" },
        status: { type: "string", enum: ["pending", "published", "rejected"] },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "search_my_components",
    description: "Search through your own UIPlug components by name, description, or tag.",
    input_schema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
        framework: { type: "string" },
        status: { type: "string", enum: ["pending", "published", "rejected"] },
      },
    },
  },
  {
    name: "list_groups",
    description: "List the UIPlug groups you are an active member of.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_component",
    description:
      "Submit a new UI component to UIPlug. Must be a complete, self-contained file with imports and default export.",
    input_schema: {
      type: "object",
      required: ["name", "description", "framework", "category", "code"],
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        framework: { type: "string", description: "React | Vue | Svelte | Angular | HTML / CSS | Flutter | SwiftUI" },
        category: { type: "string", description: "Layout | Navigation | Input | Data Display | Feedback" },
        code: { type: "string", description: "Complete component source with imports and default export" },
        installation: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        model: { type: "string", description: "AI model used (e.g. Claude Sonnet 4.6)" },
        group_slug: { type: "string" },
        visibility: { type: "string", enum: ["public", "private"] },
      },
    },
  },
];

export async function executeUiplugTool(
  name: string,
  input: Record<string, unknown>,
  apiKey: string
): Promise<string> {
  try {
    const { userId, error: authError } = await validateApiKey(apiKey);
    if (authError) return `UIPlug auth error: ${authError}`;

    const keyHash = createHash("sha256").update(apiKey).digest("hex");

    if (name === "list_components") {
      const { framework, category, limit = 20, group_slug } = input as Record<string, unknown>;
      let rows: Record<string, unknown>[] = [];

      if (group_slug) {
        const { data, error } = await supabase.rpc("get_group_components", {
          p_key_hash: keyHash,
          p_group_slug: group_slug,
          p_search: null,
          p_limit: Math.min(Number(limit), 50),
        });
        if (error) return `Error: ${error.message}`;
        rows = ((data ?? []) as Record<string, unknown>[]).filter(
          (c) => (!framework || c.framework === framework) && (!category || c.category === category)
        );
      } else {
        let query = supabase
          .from("components")
          .select(
            "id, name, description, category, framework, downloads, likes, model, " +
              "profiles!components_author_id_fkey(username)"
          )
          .eq("status", "published")
          .eq("visibility", "public")
          .order("downloads", { ascending: false })
          .limit(Math.min(Number(limit), 50));
        if (framework) query = query.eq("framework", framework as string);
        if (category) query = query.eq("category", category as string);
        const { data, error } = await query;
        if (error) return `Error: ${error.message}`;
        rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((c) => ({
          ...c,
          author: (c.profiles as Record<string, unknown>)?.username ?? "Unknown",
        }));
      }

      if (rows.length === 0) return group_slug ? `No components found in group "${group_slug}".` : "No components found.";
      return (
        `Found ${rows.length} component(s).\n\n` +
        rows
          .map((c) => {
            const author = (c.author ?? (c.profiles as Record<string, unknown>)?.username ?? "Unknown") as string;
            return `**${c.name}** (${c.framework} · ${c.category})\n  ID: ${c.id}\n  ${c.description}\n  Author: ${author} · ↓${c.downloads ?? 0} ♥${c.likes ?? 0}`;
          })
          .join("\n\n")
      );
    }

    if (name === "search_components") {
      const { query: q, framework, group_slug } = input as Record<string, unknown>;

      if (group_slug) {
        const { data, error } = await supabase.rpc("get_group_components", {
          p_key_hash: keyHash,
          p_group_slug: group_slug,
          p_search: q,
          p_limit: 30,
        });
        if (error) return `Error: ${error.message}`;
        const results = ((data ?? []) as Record<string, unknown>[]).filter(
          (c) => !framework || c.framework === framework
        );
        if (results.length === 0) return `No components found in group "${group_slug}" matching "${q}".`;
        return (
          `Found ${results.length} result(s) in group "${group_slug}" for "${q}":\n\n` +
          results
            .map(
              (c) =>
                `**${c.name}** (${c.framework} · ${c.category})\n  ID: ${c.id}\n  ${c.description}`
            )
            .join("\n\n")
        );
      }

      let nameQuery = supabase
        .from("components")
        .select(
          "id, name, description, category, framework, downloads, likes, profiles!components_author_id_fkey(username)"
        )
        .eq("status", "published")
        .eq("visibility", "public")
        .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
        .order("downloads", { ascending: false })
        .limit(20);
      if (framework) nameQuery = nameQuery.eq("framework", framework as string);

      const { data: tagData } = await supabase.from("tags").select("id").ilike("name", `%${q}%`);
      const tagIds = (tagData ?? []).map((t) => t.id);
      let tagComponentIds: string[] = [];
      if (tagIds.length > 0) {
        const { data: ctData } = await supabase.from("component_tags").select("component_id").in("tag_id", tagIds);
        tagComponentIds = (ctData ?? []).map((ct) => ct.component_id);
      }

      const { data: nameResults, error } = await nameQuery;
      if (error) return `Error: ${error.message}`;

      let tagResults: Record<string, unknown>[] = [];
      const existingIds = new Set((nameResults ?? []).map((c) => c.id));
      const newTagIds = tagComponentIds.filter((id) => !existingIds.has(id));
      if (newTagIds.length > 0) {
        let tq = supabase
          .from("components")
          .select(
            "id, name, description, category, framework, downloads, likes, profiles!components_author_id_fkey(username)"
          )
          .eq("status", "published")
          .eq("visibility", "public")
          .in("id", newTagIds)
          .limit(10);
        if (framework) tq = tq.eq("framework", framework as string);
        const { data } = await tq;
        tagResults = (data ?? []) as Record<string, unknown>[];
      }

      const all = [...(nameResults ?? []), ...tagResults] as Record<string, unknown>[];
      if (all.length === 0) return `No components found matching "${q}".`;
      return (
        `Found ${all.length} result(s) for "${q}":\n\n` +
        all
          .map(
            (c) =>
              `**${c.name}** (${c.framework} · ${c.category})\n  ID: ${c.id}\n  ${c.description}\n  Author: ${(c.profiles as Record<string, unknown>)?.username ?? "Unknown"} · ↓${c.downloads ?? 0}`
          )
          .join("\n\n")
      );
    }

    if (name === "get_component") {
      const { id } = input as { id: string };
      const [compRes, tagRes] = await Promise.all([
        supabase
          .from("components")
          .select(
            "id, name, description, category, framework, downloads, likes, model, installation, code_component, " +
              "profiles!components_author_id_fkey(username)"
          )
          .eq("id", id)
          .eq("status", "published")
          .single(),
        supabase.from("component_tags").select("tags(name)").eq("component_id", id),
      ]);

      if (compRes.error || !compRes.data) return `Component not found: ${compRes.error?.message ?? id}`;
      const c = compRes.data as unknown as Record<string, unknown>;
      const tags = (tagRes.data ?? [])
        .map((t) => (t.tags as unknown as Record<string, unknown>)?.name)
        .filter(Boolean);

      await supabase.rpc("increment_downloads", { component_id: id }).maybeSingle();

      const ext =
        c.framework === "Flutter" ? "dart"
        : c.framework === "SwiftUI" ? "swift"
        : c.framework === "React" ? "tsx"
        : c.framework === "Vue" ? "vue"
        : c.framework === "Svelte" ? "svelte"
        : c.framework === "HTML / CSS" ? "html"
        : "kt";

      const installSection = c.installation ? `\n## Installation\n\`\`\`\n${c.installation}\n\`\`\`` : "";
      return (
        `# ${c.name}\n\n` +
        `**Framework:** ${c.framework}\n**Category:** ${c.category}\n` +
        `**Author:** ${(c.profiles as Record<string, unknown>)?.username ?? "Unknown"}\n` +
        `**Tags:** ${tags.length ? tags.join(", ") : "none"}\n` +
        `**Downloads:** ${c.downloads ?? 0} · **Likes:** ${c.likes ?? 0}` +
        (c.model ? `\n**Built with:** ${c.model}` : "") +
        `\n\n## Description\n${c.description}` +
        installSection +
        `\n\n## Code\n\`\`\`${ext}\n${c.code_component}\n\`\`\``
      );
    }

    if (name === "get_my_profile") {
      const [profileRes, statsRes, groupsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, avatar_url, created_at, is_verified")
          .eq("id", userId!)
          .single(),
        supabase.from("components").select("id, status, downloads, likes").eq("author_id", userId!),
        supabase.rpc("list_user_groups", { p_key_hash: keyHash }),
      ]);

      if (profileRes.error || !profileRes.data) return `Profile not found: ${profileRes.error?.message}`;
      const p = profileRes.data as Record<string, unknown>;
      const components = (statsRes.data ?? []) as Record<string, unknown>[];
      const published = components.filter((c) => c.status === "published").length;
      const pending = components.filter((c) => c.status === "pending").length;
      const rejected = components.filter((c) => c.status === "rejected").length;
      const totalDownloads = components.reduce((sum, c) => sum + ((c.downloads as number) ?? 0), 0);
      const totalLikes = components.reduce((sum, c) => sum + ((c.likes as number) ?? 0), 0);
      const groups = (groupsRes.data ?? []) as Record<string, unknown>[];
      const groupSection =
        groups.length > 0
          ? `\n## Groups (${groups.length})\n` + groups.map((g) => `- **${g.group_name}** (\`${g.group_slug}\`) — ${g.role}`).join("\n")
          : `\n## Groups\n- Not a member of any groups yet.`;

      return (
        `# Your UIPlug Profile\n\n` +
        `**Username:** ${p.username ?? "—"}\n` +
        `**Verified:** ${p.is_verified ? "✅ Yes" : "No"}\n` +
        `**Member since:** ${p.created_at ? new Date(p.created_at as string).toDateString() : "—"}\n\n` +
        `## Components (${components.length} total)\n` +
        `- ✅ Published: ${published}\n- ⏳ Pending: ${pending}\n- ❌ Rejected: ${rejected}\n` +
        `- ↓ Total downloads: ${totalDownloads}\n- ♥ Total likes: ${totalLikes}` +
        groupSection
      );
    }

    if (name === "list_my_components") {
      const { framework, category, status, limit = 20 } = input as Record<string, unknown>;
      let query = supabase
        .from("components")
        .select("id, name, description, category, framework, downloads, likes, model, status, visibility, created_at")
        .eq("author_id", userId!)
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(limit), 50));
      if (framework) query = query.eq("framework", framework as string);
      if (category) query = query.eq("category", category as string);
      if (status) query = query.eq("status", status as string);
      const { data, error } = await query;
      if (error) return `Error: ${error.message}`;
      const rows = (data ?? []) as Record<string, unknown>[];
      if (rows.length === 0) return "You have no saved components yet.";
      return (
        `You have ${rows.length} component(s):\n\n` +
        rows
          .map((c) => {
            const emoji = c.status === "published" ? "✅" : c.status === "pending" ? "⏳" : "❌";
            const lock = c.visibility === "private" ? " 🔒" : "";
            return (
              `${emoji} **${c.name}**${lock} (${c.framework} · ${c.category})\n  ID: ${c.id}\n  ${c.description}\n  Status: ${c.status} · ↓${c.downloads ?? 0} ♥${c.likes ?? 0}` +
              (c.model ? ` · Built with ${c.model}` : "")
            );
          })
          .join("\n\n")
      );
    }

    if (name === "search_my_components") {
      const { query: q, framework, status } = input as Record<string, unknown>;
      let nameQuery = supabase
        .from("components")
        .select("id, name, description, category, framework, downloads, likes, status, visibility, model, created_at")
        .eq("author_id", userId!)
        .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
        .order("created_at", { ascending: false });
      if (framework) nameQuery = nameQuery.eq("framework", framework as string);
      if (status) nameQuery = nameQuery.eq("status", status as string);

      const { data: tagData } = await supabase.from("tags").select("id").ilike("name", `%${q}%`);
      const tagIds = (tagData ?? []).map((t) => t.id);
      let tagComponentIds: string[] = [];
      if (tagIds.length > 0) {
        const { data: ctData } = await supabase.from("component_tags").select("component_id").in("tag_id", tagIds);
        tagComponentIds = (ctData ?? []).map((ct) => ct.component_id);
      }

      const { data: nameResults, error } = await nameQuery;
      if (error) return `Error: ${error.message}`;

      let tagResults: Record<string, unknown>[] = [];
      const existingIds = new Set((nameResults ?? []).map((c) => c.id));
      const newTagIds = tagComponentIds.filter((id) => !existingIds.has(id));
      if (newTagIds.length > 0) {
        let tq = supabase
          .from("components")
          .select("id, name, description, category, framework, downloads, likes, status, visibility, model, created_at")
          .eq("author_id", userId!)
          .in("id", newTagIds)
          .limit(10);
        if (framework) tq = tq.eq("framework", framework as string);
        if (status) tq = tq.eq("status", status as string);
        const { data } = await tq;
        tagResults = (data ?? []) as Record<string, unknown>[];
      }

      const all = [...(nameResults ?? []), ...tagResults] as Record<string, unknown>[];
      if (all.length === 0) return `No components found matching "${q}" in your saved components.`;
      return (
        `Found ${all.length} of your component(s) matching "${q}":\n\n` +
        all
          .map((c) => {
            const emoji = c.status === "published" ? "✅" : c.status === "pending" ? "⏳" : "❌";
            const lock = c.visibility === "private" ? " 🔒" : "";
            return (
              `${emoji} **${c.name}**${lock} (${c.framework} · ${c.category})\n  ID: ${c.id}\n  ${c.description}\n  Status: ${c.status}` +
              (c.model ? ` · Built with ${c.model}` : "")
            );
          })
          .join("\n\n")
      );
    }

    if (name === "list_groups") {
      const { data, error } = await supabase.rpc("list_user_groups", { p_key_hash: keyHash });
      if (error) return `Error: ${error.message}`;
      const groups = (data ?? []) as Record<string, unknown>[];
      if (groups.length === 0)
        return "You are not a member of any groups yet.\nCreate or join a group at: https://uiplug.com/dashboard/groups";
      return (
        `You are a member of ${groups.length} group(s):\n\n` +
        groups.map((g) => `**${g.group_name}** (slug: \`${g.group_slug}\`) — ${g.role}`).join("\n")
      );
    }

    if (name === "create_component") {
      const { name: compName, description, framework, category, code, installation, tags, model, group_slug, visibility = "public" } =
        input as Record<string, unknown>;
      const { data: componentId, error } = await supabase.rpc("create_component", {
        p_key_hash: keyHash,
        p_name: compName,
        p_description: description,
        p_framework: framework,
        p_category: category,
        p_code: code,
        p_installation: installation ?? null,
        p_tags: tags ?? [],
        p_model: model ?? null,
        p_group_slug: group_slug ?? null,
        p_visibility: group_slug ? (visibility ?? "public") : "public",
      });
      if (error) return `Error submitting component: ${error.message}`;
      return (
        `Component submitted for review!\n\n` +
        `**Name:** ${compName}\n**Framework:** ${framework}\n**Category:** ${category}\n**ID:** ${componentId}\n` +
        `View it at: https://uiplug.com/dashboard/components`
      );
    }

    return `Unknown UIPlug tool: ${name}`;
  } catch (err: unknown) {
    const error = err as { message?: string };
    return `UIPlug error: ${error.message ?? "unknown"}`;
  }
}
