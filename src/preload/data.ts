import { ipcRenderer } from "electron";
import { randomUUID } from "node:crypto";
import type {
  DeleteProjectMode,
  GuestMigrationPayload,
  ProjectRecord,
  SaveScriptInput,
  ScriptRecord,
  ScriptsState
} from "../shared/ipc";
import { ipcChannels } from "../shared/ipc";
import { getSupabaseClient } from "./auth";

type ScriptRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  archived: boolean | null;
  pinned: boolean | null;
  project_id: string | null;
};

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

const scriptColumns = "id,user_id,title,body,created_at,updated_at,last_opened_at,archived,pinned,project_id";
const projectColumns = "id,user_id,name,created_at,updated_at";
const cloudActiveScriptKeyPrefix = "teleprompter.cloudActiveScript.";

function normalizeTitle(title: string, body: string): string {
  const trimmedTitle = title.trim();
  if (trimmedTitle) {
    return trimmedTitle.slice(0, 120);
  }

  const firstContentLine = body.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return (firstContentLine ?? "Untitled script").slice(0, 120);
}

function normalizeProjectName(name: string): string {
  return (name.trim() || "Untitled project").slice(0, 80);
}

function toScriptRecord(row: ScriptRow): ScriptRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at ?? undefined,
    archived: row.archived ?? undefined,
    pinned: row.pinned ?? undefined,
    projectId: row.project_id ?? undefined
  };
}

function toProjectRecord(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function throwCloudError(error: { message?: string } | null): void {
  if (error) {
    throw new Error(error.message || "Cloud data request failed.");
  }
}

async function getAuthenticatedUserId(): Promise<string | undefined> {
  const client = getSupabaseClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  throwCloudError(sessionError);

  if (!sessionData.session) {
    return undefined;
  }

  const { data, error } = await client.auth.getUser();
  throwCloudError(error);
  if (!data.user) {
    throw new Error("The signed-in user could not be verified.");
  }

  return data.user.id;
}

function getCloudActiveScriptId(userId: string): string | undefined {
  return window.sessionStorage.getItem(`${cloudActiveScriptKeyPrefix}${userId}`) ?? undefined;
}

function setCloudActiveScriptId(userId: string, scriptId?: string): void {
  const key = `${cloudActiveScriptKeyPrefix}${userId}`;
  if (scriptId) {
    window.sessionStorage.setItem(key, scriptId);
  } else {
    window.sessionStorage.removeItem(key);
  }
}

async function publishCloudState(state: ScriptsState): Promise<ScriptsState> {
  await ipcRenderer.invoke(ipcChannels.scriptsSetCloudState, state);
  return state;
}

async function getCloudState(userId: string): Promise<ScriptsState> {
  const client = getSupabaseClient();
  const [scriptsResult, projectsResult] = await Promise.all([
    client.from("scripts").select(scriptColumns).eq("user_id", userId),
    client.from("projects").select(projectColumns).eq("user_id", userId)
  ]);
  throwCloudError(scriptsResult.error);
  throwCloudError(projectsResult.error);

  const scripts = ((scriptsResult.data ?? []) as ScriptRow[]).map(toScriptRecord);
  const projects = ((projectsResult.data ?? []) as ProjectRow[]).map(toProjectRecord);
  const activeScriptId = getCloudActiveScriptId(userId);
  const activeScript = scripts.find((script) => script.id === activeScriptId);

  if (activeScriptId && !activeScript) {
    setCloudActiveScriptId(userId);
  }

  return publishCloudState({ scripts, projects, activeScript, ownerId: userId });
}

async function invokeGuest<TResult>(channel: string, ...args: unknown[]): Promise<TResult> {
  await ipcRenderer.invoke(ipcChannels.scriptsUseGuest);
  return ipcRenderer.invoke(channel, ...args) as Promise<TResult>;
}

async function withOwner<TResult>(
  guest: () => Promise<TResult>,
  authenticated: (userId: string) => Promise<TResult>
): Promise<TResult> {
  const userId = await getAuthenticatedUserId();
  return userId ? authenticated(userId) : guest();
}

async function getScriptsState(): Promise<ScriptsState> {
  return withOwner(
    () => invokeGuest(ipcChannels.scriptsGetState),
    getCloudState
  );
}

async function saveScript(input: SaveScriptInput): Promise<ScriptsState> {
  return withOwner(
    () => invokeGuest(ipcChannels.scriptsSave, input),
    async (userId) => {
      const client = getSupabaseClient();
      const now = new Date().toISOString();
      let existing: ScriptRow | null = null;

      if (input.id) {
        const result = await client.from("scripts").select(scriptColumns)
          .eq("id", input.id).eq("user_id", userId).maybeSingle();
        throwCloudError(result.error);
        existing = result.data as ScriptRow | null;
      }

      let projectId = input.projectId ?? existing?.project_id ?? null;
      if (projectId) {
        const projectResult = await client.from("projects").select("id")
          .eq("id", projectId).eq("user_id", userId).maybeSingle();
        throwCloudError(projectResult.error);
        if (!projectResult.data) {
          projectId = null;
        }
      }

      const row = {
        title: normalizeTitle(input.title, input.body),
        body: input.body,
        updated_at: now,
        last_opened_at: now,
        project_id: projectId
      };

      const result = existing
        ? await client.from("scripts").update(row).eq("id", existing.id).eq("user_id", userId).select(scriptColumns).single()
        : await client.from("scripts").insert({
            id: randomUUID(),
            user_id: userId,
            ...row,
            created_at: now,
            archived: false,
            pinned: false
          }).select(scriptColumns).single();
      throwCloudError(result.error);
      const saved = result.data as ScriptRow;
      setCloudActiveScriptId(userId, saved.id);
      return getCloudState(userId);
    }
  );
}

async function setActiveScript(id: string): Promise<ScriptsState> {
  return withOwner(
    () => invokeGuest(ipcChannels.scriptsSetActive, id),
    async (userId) => {
      const result = await getSupabaseClient().from("scripts")
        .update({ last_opened_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", userId).select("id").maybeSingle();
      throwCloudError(result.error);
      if (result.data) {
        setCloudActiveScriptId(userId, id);
      }
      return getCloudState(userId);
    }
  );
}

async function renameScript(id: string, title: string): Promise<ScriptsState> {
  return withOwner(
    () => invokeGuest(ipcChannels.scriptsRename, id, title),
    async (userId) => {
      const client = getSupabaseClient();
      const current = await client.from("scripts").select("body").eq("id", id).eq("user_id", userId).maybeSingle();
      throwCloudError(current.error);
      if (current.data) {
        const result = await client.from("scripts").update({
          title: normalizeTitle(title, current.data.body as string),
          updated_at: new Date().toISOString()
        }).eq("id", id).eq("user_id", userId);
        throwCloudError(result.error);
      }
      return getCloudState(userId);
    }
  );
}

async function setScriptPinned(id: string, pinned: boolean): Promise<ScriptsState> {
  return withOwner(
    () => invokeGuest(ipcChannels.scriptsSetPinned, id, pinned),
    async (userId) => {
      const result = await getSupabaseClient().from("scripts").update({ pinned })
        .eq("id", id).eq("user_id", userId);
      throwCloudError(result.error);
      return getCloudState(userId);
    }
  );
}

async function moveScriptToProject(id: string, projectId?: string): Promise<ScriptsState> {
  return withOwner(
    () => invokeGuest(ipcChannels.scriptsMoveToProject, id, projectId),
    async (userId) => {
      const client = getSupabaseClient();
      let ownedProjectId: string | null = null;
      if (projectId) {
        const project = await client.from("projects").select("id")
          .eq("id", projectId).eq("user_id", userId).maybeSingle();
        throwCloudError(project.error);
        ownedProjectId = project.data ? projectId : null;
      }
      const result = await client.from("scripts").update({
        project_id: ownedProjectId,
        updated_at: new Date().toISOString()
      }).eq("id", id).eq("user_id", userId);
      throwCloudError(result.error);
      return getCloudState(userId);
    }
  );
}

async function deleteScripts(ids: string[]): Promise<ScriptsState> {
  return withOwner(
    () => invokeGuest(ipcChannels.scriptsDeleteMany, ids),
    async (userId) => {
      if (ids.length) {
        const result = await getSupabaseClient().from("scripts").delete()
          .in("id", ids).eq("user_id", userId);
        throwCloudError(result.error);
        if (ids.includes(getCloudActiveScriptId(userId) ?? "")) {
          setCloudActiveScriptId(userId);
        }
      }
      return getCloudState(userId);
    }
  );
}

async function deleteScript(id: string): Promise<ScriptsState> {
  return deleteScripts([id]);
}

async function clearActiveScript(): Promise<ScriptsState> {
  return withOwner(
    () => invokeGuest(ipcChannels.scriptsClearActive),
    async (userId) => {
      setCloudActiveScriptId(userId);
      return getCloudState(userId);
    }
  );
}

async function createProject(name: string): Promise<ScriptsState> {
  return withOwner(
    () => invokeGuest(ipcChannels.projectsCreate, name),
    async (userId) => {
      const normalizedName = normalizeProjectName(name);
      const existing = await getCloudState(userId);
      if (existing.projects.some((project) => project.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
        throw new Error("A project with this name already exists.");
      }
      const now = new Date().toISOString();
      const result = await getSupabaseClient().from("projects").insert({
        id: randomUUID(),
        user_id: userId,
        name: normalizedName,
        created_at: now,
        updated_at: now
      });
      throwCloudError(result.error);
      return getCloudState(userId);
    }
  );
}

async function renameProject(id: string, name: string): Promise<ScriptsState> {
  return withOwner(
    () => invokeGuest(ipcChannels.projectsRename, id, name),
    async (userId) => {
      const normalizedName = normalizeProjectName(name);
      const state = await getCloudState(userId);
      if (state.projects.some((project) => project.id !== id && project.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
        throw new Error("A project with this name already exists.");
      }
      const result = await getSupabaseClient().from("projects").update({
        name: normalizedName,
        updated_at: new Date().toISOString()
      }).eq("id", id).eq("user_id", userId);
      throwCloudError(result.error);
      return getCloudState(userId);
    }
  );
}

async function deleteProject(id: string, mode: DeleteProjectMode): Promise<ScriptsState> {
  return withOwner(
    () => invokeGuest(ipcChannels.projectsDelete, id, mode),
    async (userId) => {
      const client = getSupabaseClient();
      const scriptsResult = mode === "deleteScripts"
        ? await client.from("scripts").delete().eq("project_id", id).eq("user_id", userId)
        : await client.from("scripts").update({ project_id: null }).eq("project_id", id).eq("user_id", userId);
      throwCloudError(scriptsResult.error);
      const projectResult = await client.from("projects").delete().eq("id", id).eq("user_id", userId);
      throwCloudError(projectResult.error);
      return getCloudState(userId);
    }
  );
}

async function migrateGuestDataToCurrentUser(): Promise<{ ok: boolean; message?: string }> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return { ok: false, message: "Sign in before migrating Guest data." };
    }

    const payload = await ipcRenderer.invoke(ipcChannels.guestMigrationGetPayload) as GuestMigrationPayload;
    const projects = payload.projects.map((project) => ({
      id: project.id,
      name: project.name,
      created_at: project.createdAt,
      updated_at: project.updatedAt
    }));
    const scripts = payload.scripts.map((script) => ({
      id: script.id,
      title: script.title,
      body: script.body,
      created_at: script.createdAt,
      updated_at: script.updatedAt,
      last_opened_at: script.lastOpenedAt ?? null,
      archived: script.archived ?? false,
      pinned: script.pinned ?? false,
      project_id: script.projectId ?? null
    }));

    if (projects.length || scripts.length) {
      const { error } = await getSupabaseClient().rpc("migrate_guest_data", {
        p_migration_id: payload.migrationId,
        p_projects: projects,
        p_scripts: scripts
      });
      throwCloudError(error);
    }

    await ipcRenderer.invoke(ipcChannels.guestMigrationComplete, payload.migrationId);
    await getCloudState(userId);
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Guest data migration failed."
    };
  }
}

export const ownerAwareScriptsApi = {
  getScriptsState,
  saveScript,
  setActiveScript,
  renameScript,
  setScriptPinned,
  moveScriptToProject,
  deleteScript,
  deleteScripts,
  clearActiveScript,
  createProject,
  renameProject,
  deleteProject,
  migrateGuestDataToCurrentUser
};
