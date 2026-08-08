# Meeting notes — Steering committee, 30 Jul 2024

Attendees: Priya Sharma, Marcus Webb, Dana Okafor, our side: JN.

Big one. The June outage has changed the mood — Marcus opened by saying the
incident "made the cost of standing still visible", which from him is close to
a compliment for the programme.

**Main event: the February database decision was reversed.** Priya presented
the post-incident infrastructure review: the June outage was ultimately a
data-centre storage failure, and the remediation cost plus the projected spend
to bring Meridian's data-centre operations up to the required standard changes
the economics completely. **Decision, made jointly by Marcus and Priya in the
meeting: the billing platform will run on a managed cloud PostgreSQL service,
replacing (their word: "superseding") the February decision to self-host.**
Marcus drove it — "the numbers now say cloud, so it's cloud" — and Priya
agreed on the record: "I made the February call on the old numbers. The new
numbers say managed cloud. Done."

Worth capturing for the record: **this also settles the budget-vs-speed
argument between Priya and Marcus that has been open since February.** The
managed service removes the need for the two extra platform hires Priya wanted
(the cloud provider runs the database), and the run-rate fits inside Marcus's
cost envelope on the original timeline. Both of them explicitly called the
argument closed on the back of this decision — Marcus: "this is the compromise
I can fund"; Priya: "and it keeps the timeline, so I'm good."

Dana asked pointed questions about cloud data residency for billing data and
was satisfied by the UK-region answer. Still deeply sceptical about cutover —
"nothing about today changes my position on dual-run" — noted, no change to
capture, that requirement stands as-is.

Small talk about summer holidays; Marcus off to Portugal. Next steering in Q4.
