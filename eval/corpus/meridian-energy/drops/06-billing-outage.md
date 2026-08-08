# Incident report — Legacy billing outage, 12 Jun 2024

Prepared by KT with Dana Okafor's team, for the programme record.

**What happened:** Hermes (the legacy billing engine) went down at 03:40 on
12 June during the overnight rating run and was not fully restored until 17:55
the same day — roughly 14 hours. Root cause: a storage array failure in the
data centre combined with a backup job that had been silently failing since
April. Around 60,000 customer invoices were delayed by one day. No data loss
in the end, but for most of the day that wasn't clear.

**Impact on people:** Dana's team worked through the night and the following
weekend clearing the backlog. Dana was in the war room the whole time. Her
words in the wash-up, verbatim: "This is exactly what I've been afraid of.
I've been polite about this programme so far — I'm now telling you I don't
trust anything until I see it run. Assume I'm the biggest sceptic in the
building from here on." That is a marked change from her earlier
wait-and-see stance, and everyone in the room noted it. What was previously
our working hypothesis about Dana — that avoiding blame for billing errors is
what actually drives her — she has now said essentially out loud; treat it as
confirmed rather than inferred.

**Impact on the programme:** In the wash-up Priya made a scope call on the
spot: **stabilising the legacy Hermes system (storage + backup remediation) is
now in scope for the replatform programme**, so the team keeping the lights on
and the team building the replacement are the same team with one backlog. Her
exact words: "Add Hermes stabilisation to the programme scope — I'm deciding
that now, we can't replatform a corpse."

The data-centre operations vendor's account manager sent a grovelling email
during the incident; ignore, not a stakeholder.

Follow-ups: storage array replaced (done 13 June), backup monitoring added
(done 14 June).
