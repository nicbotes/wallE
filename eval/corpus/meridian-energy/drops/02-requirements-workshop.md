# Workshop notes — Requirements, 24 Jan 2024

Attendees: Dana Okafor + two of her billing leads, Priya Sharma (first hour),
our side: JN, KT. Marcus not present.

Dana's headline requirement, stated three separate times and written on the
board in her handwriting: **the new engine must dual-run in parallel with
Hermes for at least three full billing cycles before anything is switched
off**. Non-negotiable from her side ("must", her word). Reason given: every
billing error becomes her team working weekends, and she will not sign off a
cutover she can't verify against Hermes output line by line.

Priya added an engineering requirement: the new platform should be
**API-first** — every billing capability exposed via API so downstream teams
can self-serve. She rated it "should have, not must have — but I'll fight for
it".

One of the billing leads (didn't catch the name, and Dana couldn't remember
who'd originally raised it when we asked at the break) put forward a
requirement for **CSV export of any billing run's line items** for the audit
team. Nobody owned it in the room but nobody disputed it either. Parking as
unowned for now.

Scope note: mobile payments came up — Dana's leads get asked about it by the
call centre constantly. No one in the room had the authority to rule it in or
out, so it goes on the list as **undecided** for the replatform.

Vendor chatter: one of the leads had seen a demo of "BillFlow" at a conference
and liked it. Priya was clear: "we have made no vendor decision, and we're not
making one today." Noting for colour only.

Dana keeps coming back to risk. Reading between the lines, what she's really
optimising for is never again being the person blamed for a billing error —
worth tracking as a working hypothesis about her motivations.

Actions: JN to draft requirement register; next checkpoint is the architecture
review in February.
