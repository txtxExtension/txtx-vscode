export interface TxtxConfig {
  name: string;
  id: string;
  environments: Record<string, { svm_rpc_api_url: string }>;
  runbooks: RunbookConfig[];
}

export interface RunbookConfig {
  name: string;
  id: string;
  description?: string;
  location: string;
  state?: { location: string };
}

export type RunbookStatus = "idle" | "running" | "success" | "error";

export interface RunbookState {
  status: RunbookStatus;
  lastRun?: Date;
}
