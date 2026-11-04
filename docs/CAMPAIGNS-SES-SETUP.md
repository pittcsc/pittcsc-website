# Campaign sender-domain and SES setup

Status: preparation guide during design discovery. Campaign functionality is not implemented yet, and no hosted configuration is changed by this document.

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

- Create a campaign configuration set and configure the event destination selected by the final implementation design. Associate campaign sends with this configuration set and campaign/message identifiers.
- Enable delivery, bounce, complaint, and click reporting, plus operational failure events supported by the implementation. Open tracking is outside the current requested scope.
- Configure bounce/complaint suppression and verify that CRM delivery blocks prevent additional campaign sends.
- Configure working unsubscribe links and one-click unsubscribe headers. Keep campaign preference handling separate from login mail.
- Configure server-only AWS permissions and deployment credentials with only the capabilities required by the final implementation. Final variable names, event routes, worker deployment, and authentication steps must be added when implemented.
- Exercise synthetic test recipients and the SES mailbox simulator before a real campaign. Confirm reporting, unsubscribe, cancellation, retry, and uncertain-send review behavior.

SES delivery events indicate recipient-server acceptance, not inbox placement. Recorded clicks can include automated activity. Store events and campaign reports in the CRM database without application-defined expiration, as requested; provider-side event collection limits are separate from CRM retention.

References: [event publishing](https://docs.aws.amazon.com/ses/latest/dg/monitor-using-event-publishing.html), [event schema](https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html), [tracking behavior](https://docs.aws.amazon.com/ses/latest/dg/faqs-metrics.html), [one-click unsubscribe](https://aws.amazon.com/blogs/messaging-and-targeting/using-one-click-unsubscribe-with-amazon-ses/).
