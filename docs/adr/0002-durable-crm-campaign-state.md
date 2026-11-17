# Own campaign state and delivery work in the CRM database

Campaign subscriptions, historical recipient snapshots, and delivery attempts live in the CRM Postgres database, with SES used as the delivery provider. A durable database queue and a separately scheduled worker allow dispatch to survive browser closure and API instance shutdown while preserving cancellation and review of uncertain sends. This adds worker deployment responsibilities, but avoids making subscription truth depend on a second editable SES contact list or putting campaign delivery inside a request that can time out.
