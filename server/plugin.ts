import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import {
  isDay,
  isLikelihood,
  normalizeName,
  type StoredVotes,
} from "../src/votes.ts";
import {
  applyDayVote,
  applyRemoveDayVote,
  applyRemoveUnavailable,
  applyUnavailableVote,
  getVotes,
} from "./store.ts";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid-json");
  }
  return parsed as Record<string, unknown>;
}

function peopleResponse(state: StoredVotes) {
  return { weekId: state.weekId, people: state.people };
}

export async function handleVotesRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = req.url?.split("?")[0] ?? "";
  if (!url.startsWith("/api/votes")) {
    return false;
  }

  try {
    if (req.method === "GET" && url === "/api/votes") {
      sendJson(res, 200, peopleResponse(await getVotes()));
      return true;
    }

    if (req.method === "POST" && url === "/api/votes/day") {
      const body = await parseJsonBody(req);
      const name = typeof body.name === "string" ? normalizeName(body.name) : "";
      if (!name || !isDay(body.day) || !isLikelihood(body.likelihood)) {
        sendJson(res, 400, { error: "Ogiltig röst." });
        return true;
      }

      sendJson(
        res,
        200,
        peopleResponse(await applyDayVote(name, body.day, body.likelihood)),
      );
      return true;
    }

    if (req.method === "DELETE" && url === "/api/votes/day") {
      const body = await parseJsonBody(req);
      const name = typeof body.name === "string" ? normalizeName(body.name) : "";
      if (!name || !isDay(body.day)) {
        sendJson(res, 400, { error: "Ogiltig röst." });
        return true;
      }

      sendJson(res, 200, peopleResponse(await applyRemoveDayVote(name, body.day)));
      return true;
    }

    if (req.method === "POST" && url === "/api/votes/unavailable") {
      const body = await parseJsonBody(req);
      const name = typeof body.name === "string" ? normalizeName(body.name) : "";
      if (!name) {
        sendJson(res, 400, { error: "Ogiltig röst." });
        return true;
      }

      sendJson(res, 200, peopleResponse(await applyUnavailableVote(name)));
      return true;
    }

    if (req.method === "DELETE" && url === "/api/votes/unavailable") {
      const body = await parseJsonBody(req);
      const name = typeof body.name === "string" ? normalizeName(body.name) : "";
      if (!name) {
        sendJson(res, 400, { error: "Ogiltig röst." });
        return true;
      }

      sendJson(res, 200, peopleResponse(await applyRemoveUnavailable(name)));
      return true;
    }

    sendJson(res, 404, { error: "Hittades inte." });
  } catch {
    sendJson(res, 500, { error: "Kunde inte spara rösten." });
  }

  return true;
}

export function votesApiPlugin(): Plugin {
  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    if (!(await handleVotesRequest(req, res))) {
      next();
    }
  };

  return {
    name: "votes-api",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
