# Incident report — Portal pilot authentication outage, 2 Jul 2025

Prepared by RM (us) with Meridian's platform team, for the programme record.
Severity: P2 (pilot users only; no production customers affected).

**What happened:** The customer portal pilot (500 invited customers) was
unavailable from 09:10 to 15:40 on 2 July — roughly six and a half hours —
because the pilot's interim login system fell over. Root cause: the pilot had
been launched on a stopgap home-grown authentication service ("just for the
pilot", famous last words) which stopped issuing sessions when its token
store filled. The service had no monitoring. 61 pilot customers hit dead
logins; the call centre took 19 calls.

**Impact on people:** Aisha was incandescent, mostly at the situation rather
than at anyone: "we are not piloting a portal whose front door falls off."
Tom was on the bridge call within the hour.

**Decision arising, made by Tom on the incident bridge and confirmed in
writing afterwards: the portal will use an established single sign-on (SSO)
identity provider — a bought service, not the home-grown stopgap — before the
pilot re-opens.** His words: "I'm not naming the vendor today, procurement
can run their process, but the decision that we buy SSO rather than build
auth is made, by me, now." Aisha endorsed it on the same call.

The pilot re-opens once SSO is integrated; Aisha's team communicating with
the 500 pilot customers.

(The token store vendor's status page claimed 100% uptime throughout, which
the platform team found darkly hilarious. No stakeholder relevance.)
