export interface GitHubPushEvent {
  after: string;
  repository: { full_name: string; id: number };
  installation?: { id: number };
}

export interface GitHubPullRequestEvent {
  action: string;
  number: number;
  pull_request: {
    title: string;
    user: { login: string };
    base: { sha: string };
    head: { sha: string };
  };
  repository: { full_name: string; id: number };
  installation?: { id: number };
}

export interface GitHubInstallationEvent {
  action: string;
  installation: { id: number };
}
