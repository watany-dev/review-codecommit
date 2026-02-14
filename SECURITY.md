# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in review-codecommit, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please use [GitHub Security Advisories](https://github.com/watany-dev/review-codecommit/security/advisories/new) to report the vulnerability privately.

You should receive a response within 72 hours. If the vulnerability is confirmed, a fix will be released as soon as possible.

## Security Considerations

- review-codecommit uses the AWS SDK credential chain. No credentials are stored or transmitted by the application itself.
- All AWS API calls are made through the official `@aws-sdk/client-codecommit` SDK.
- Error messages are sanitized to prevent leaking AWS account IDs or resource ARNs.
