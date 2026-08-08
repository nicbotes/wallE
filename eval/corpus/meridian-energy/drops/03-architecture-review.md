# Meeting notes — Architecture review, 14 Feb 2024

Attendees: Priya Sharma, Marcus Webb (joined late, left early), two Meridian
platform engineers, our side: KT, JN.

Valentine's day; someone had put hearts on the whiteboard. Priya drew the
database architecture over them.

Main event: the database platform decision. Priya walked through the options
her team had assessed (managed cloud database vs self-hosted on Meridian's own
infrastructure). **Decision, made by Priya in the meeting: the new billing
platform will run on self-hosted PostgreSQL on Meridian's existing data-centre
infrastructure.** Her reasoning: the platform team knows Postgres well, the
data-centre capacity is already paid for, and energy-sector data residency
reviews are simpler on their own tin. She said explicitly "this is my call and
I'm making it today — self-hosted Postgres."

Marcus, before leaving, pushed back hard on overall programme pace vs cost —
not on the database specifically. He and Priya went back and forth for ten
minutes: Priya wants to hire two more platform engineers to hit the original
timeline; Marcus refuses any headcount growth this quarter and suggested
stretching the timeline instead. Neither moved. Priya: "we can't have it both
ways — speed costs money." Marcus: "then it can be slow." **This is now a live
disagreement between the two of them — budget vs speed — and it is not
resolved.** It will shape everything downstream; flagging it clearly.

The platform engineers raised operational questions about backup tooling for
self-hosted Postgres (noted, engineering-level detail, no bearing on the
programme record).

One of the engineers mentioned Kubernetes migration plans for unrelated
internal services — nothing to do with billing, ignore.

Actions: KT to write up the database decision record. Next: delivery updates
monthly.
