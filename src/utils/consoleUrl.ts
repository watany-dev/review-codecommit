export function buildConsoleUrl(
  region: string,
  repositoryName: string,
  pullRequestId: string,
): string {
  return `https://${region}.console.aws.amazon.com/codesuite/codecommit/repositories/${encodeURIComponent(repositoryName)}/pull-requests/${encodeURIComponent(pullRequestId)}/details`;
}
