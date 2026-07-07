# AWS Bedrock AI Provider

Beckett can route Claude calls through Amazon Bedrock so AWS credits can cover AI usage.

## AWS setup

1. In AWS, open Amazon Bedrock in the region you want to use.
2. Enable model access for the Claude model you want Beckett to call.
3. Create IAM credentials with permission to call Bedrock Runtime model invocation.
4. Add the environment variables below in Vercel.

## Environment variables

Required to use Bedrock:

```bash
AI_PROVIDER=bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
BEDROCK_MODEL_ID=...
```

Optional:

```bash
AWS_SESSION_TOKEN=...
AI_PROVIDER_DISABLE_FALLBACK=true
```

If `AI_PROVIDER_DISABLE_FALLBACK` is not `true` and `ANTHROPIC_API_KEY` exists, Beckett will fall back to the direct Anthropic API when Bedrock fails. That keeps beta testing reliable, but it can still create Anthropic charges.

## Notes

- Keep `ANTHROPIC_API_KEY` set while testing if you want a safety fallback.
- Remove `ANTHROPIC_API_KEY` or set `AI_PROVIDER_DISABLE_FALLBACK=true` if you want Bedrock-only usage.
- Bedrock model IDs vary by region and model access. Use the exact model ID shown in the AWS Bedrock console for your enabled model.
