# Campaign sender-domain and SES setup

The email studio and durable delivery worker are implemented. This guide prepares live SES delivery; no hosted configuration is changed by following local development steps. See [CAMPAIGNS.md](CAMPAIGNS.md) for officer workflows and recovery.

## Information to gather

- CSC's intended From address and display name: use the existing login sender address if it can be configured as a suitable SES identity.
- The mailbox that should receive replies; confirm it is monitored.
- AWS account and SES region, plus the person who manages that account.
- The person who controls DNS for the sender domain.
- The deployed frontend/API URLs to use for subscription links and delivery-event ingestion.

Never commit credentials, app passwords, or private account details. Configure campaign credentials server-side; do not put them in `GATSBY_*` variables.

## Verify the sender domain

1. Select the intended SES region and create a domain identity for a CSC-controlled sending domain.
2. Enable Easy DKIM and publish the exact DNS records SES provides. Wait for verification; do not invent DNS record values from examples.
3. Review the domain's existing SPF and DMARC configuration with its DNS owner. Configure aligned DKIM and, if using a custom MAIL FROM domain, its SES-provided MX/SPF records. Preserve existing mail-provider records.
4. Verify the exact sender identity and any identity-specific settings needed for the chosen configuration set. Confirm the From address and Reply-To address.
5. Verify that test messages authenticate and replies reach the intended mailbox before opening campaign sending.

Verification is regional. If the current login sender is on a domain CSC cannot administer, such as Gmail, verifying that address does not grant DNS control over its domain. Resolve an appropriate CSC-controlled campaign identity and the desired Reply-To before launch. Leave Supabase login SMTP configuration unchanged unless a separate change is agreed.

References: [SES identities](https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html), [DMARC alignment](https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dmarc.html), [custom MAIL FROM](https://docs.aws.amazon.com/ses/latest/dg/mail-from.html).

## Enable production sending

Request SES production access in the selected region before sending to the imported audience. Sandbox accounts can send only to verified destinations or the mailbox simulator, with a 200-message daily limit and one message per second. Production quotas are account-specific: verify them and configure dispatch accordingly rather than assuming a fixed rate.

Reference: [SES production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

## Prepare campaign delivery and reporting

- Create a campaign configuration set and an enabled SNS event destination for the configured topic. Associate campaign sends with this configuration set and campaign/message identifiers.
- Enable delivery, bounce, complaint, and click reporting, plus operational failure events supported by the implementation. Open tracking is outside the current requested scope.
- Configure bounce/complaint suppression and verify that CRM delivery blocks prevent additional campaign sends.
- Configure working unsubscribe links and one-click unsubscribe headers. Keep campaign preference handling separate from login mail.
- Configure server-only AWS permissions and deployment credentials with only the capabilities listed below. Use the configuration and deployment steps below.
- Exercise synthetic test recipients and the SES mailbox simulator before a real campaign. Confirm reporting, unsubscribe, cancellation, retry, and uncertain-send review behavior.

SES delivery events indicate recipient-server acceptance, not inbox placement. Recorded clicks can include automated activity. Store events and campaign reports in the CRM database without application-defined expiration, as requested; provider-side event collection limits are separate from CRM retention.

References: [event publishing](https://docs.aws.amazon.com/ses/latest/dg/monitor-using-event-publishing.html), [event schema](https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html), [tracking behavior](https://docs.aws.amazon.com/ses/latest/dg/faqs-metrics.html), [one-click unsubscribe](https://aws.amazon.com/blogs/messaging-and-targeting/using-one-click-unsubscribe-with-amazon-ses/).

## Application configuration

Set these on both the API and worker, using each environment's own secrets:

```dotenv
CAMPAIGN_MAIL_MODE=ses
CAMPAIGN_FROM=Pitt CSC <YOUR_EXISTING_CSC_SENDER>
CAMPAIGN_PUBLIC_URL=https://YOUR_PUBLIC_GO_API_HOST
CAMPAIGN_CONFIGURATION_SET=YOUR_CAMPAIGN_CONFIGURATION_SET
CAMPAIGN_SNS_TOPIC_ARN=arn:aws:sns:YOUR_REGION:YOUR_ACCOUNT:YOUR_TOPIC
AWS_REGION=YOUR_SES_REGION
CAMPAIGN_MESSAGES_PER_SECOND=1
```

`CAMPAIGN_FROM` is the same CSC mailbox chosen for login; the campaign transport does not modify Supabase SMTP. The From mailbox also receives replies by default. The public URL is the Go API origin, not the Gatsby origin: accountless preferences, verification, and image routes are served by Go.

Use the AWS SDK's normal credential chain with a dedicated identity. On Cloud Run, configure the chosen workload federation/credential mechanism or inject dedicated credentials through the hosting secret service. Do not commit keys or copy local credentials into hosted settings. Keep the SNS topic in the selected SES region. Add an SNS topic policy allowing SES event publishing with restrictions to the intended account/configuration-set source.

The API/worker readiness check requires SES production access and enabled sending, a verified From domain, and an existing configuration set with enabled SEND, DELIVERY, BOUNCE, COMPLAINT, and CLICK events to the configured SNS topic. Also enable REJECT, RENDERING_FAILURE, and DELIVERY_DELAY for operational history. Configure account-level bounce/complaint suppression. Keep OPEN events disabled for the requested analytics scope.

Grant the runtime only the needed AWS actions, scoped to identities/configuration sets/topics where the AWS action supports resource scoping:

- `ses:SendEmail` for campaigns and requested resubscription confirmations.
- `ses:GetAccount`, `ses:GetEmailIdentity`, and `ses:GetConfigurationSetEventDestinations` for startup readiness.
- `sns:ConfirmSubscription` for the configured topic.

Administrative DNS, SES identity creation, production access, and SNS configuration are setup actions, not runtime permissions.

## SNS event delivery

Create an HTTPS SNS subscription to `CAMPAIGN_PUBLIC_URL/email/ses-events`, with raw message delivery **disabled** so the signed SNS envelope is included. Prefer SNS signature version 2. The endpoint verifies the exact configured topic, downloads signing certificates only from the exact regional SNS hostname and approved certificate path, validates the signature, and confirms SubscriptionConfirmation through the AWS SDK. It never follows SubscribeURL from the message. Failed database processing returns a failure so SNS can retry. Configure SNS delivery retries and a dead-letter queue/monitor for exhausted delivery failures.

Verify the subscription is confirmed in AWS and exercise delivery/bounce/complaint events using the mailbox simulator. The startup check verifies the configuration-set destination, but cannot prove that the HTTPS subscription has been confirmed or that events can reach the deployed API; the simulator check is required before a real campaign.

## API and worker deployment

Apply the committed migration to the explicitly selected hosted database only during an authorized rollout. Back up and review it first; it enrolls existing CRM accounts. No reset or managed Auth-table modification is needed.

Build the shared image from `backend/`:

```sh
docker build -t YOUR_CAMPAIGN_IMAGE .
```

The image defaults to `/api`. Deploy it as the existing Go service with its normal Auth/database/CORS environment and the campaign variables. Expose HTTPS event/preference/image routes publicly while retaining application-level authentication on private routes.

Deploy the same image as a Cloud Run Job, overriding the container command to `/campaign-worker`, with one task and the same campaign/database configuration. Set a job timeout appropriate to the batch and chosen rate (for the fixed maximum of 5,000 recipient attempts, at least two hours at one message/second). Following [Cloud Run scheduled jobs](https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule), configure a Cloud Scheduler job every minute to invoke the Cloud Run Jobs execution API using an OAuth token from a dedicated scheduler service account with permission to run that job. This is service-to-service scheduling; do not create a public unauthenticated dispatch endpoint.

A database session advisory lock allows one dispatcher at a time across overlapping executions. Other invocations exit without duplicating sends or multiplying the configured rate. The worker checks newly due campaigns as it advances through the queue, so later schedules can start during a long batch. Use `CAMPAIGN_MESSAGES_PER_SECOND` within the SES account quota and reserve room for verification mail. Due mail starts when a worker runs, not at browser confirmation time. Monitor failed jobs and campaigns requiring attention.

After deployment, verify domain authentication, reply routing, one-click/footer unsubscribe, external resubscription confirmation, event ingestion, scheduled delivery while all browsers are closed, cancellation, uncertain-send review, historical image URLs, and CSV exports. DNS/SES setup, hosting, scheduler creation, remote migrations, and real campaign sends are not performed by local setup or tests.
